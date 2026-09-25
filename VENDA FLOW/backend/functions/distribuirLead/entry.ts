import { createClientFromRequest } from "../../src/sdk.ts";
import { format, addDays } from 'npm:date-fns@3.6.0';

export default async (req) => {
  try {
    const api = createClientFromRequest(req);

    // Aceitar chamada autenticada (usuário) OU via secret interno (webhook/automação)
    const secret = req.headers.get('X-Internal-Secret');
    const expectedSecret = Deno.env.get('INTERNAL_API_SECRET');
    const user = await api.auth.me().catch(() => null);

    const isAuthorized = (user?.role === 'admin' || user?.role === 'gestor') ||
                         (expectedSecret && secret === expectedSecret);

    if (!isAuthorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { lead_id } = payload;

    if (!lead_id) return Response.json({ error: 'lead_id é obrigatório' }, { status: 400 });

    const leads = await api.asServiceRole.entities.Lead.filter({ id: lead_id });
    const lead  = leads[0];
    if (!lead) return Response.json({ error: 'Lead não encontrado' }, { status: 404 });

    if (lead.sdr_responsavel) {
      return Response.json({ message: 'Lead já possui SDR atribuído', lead_id, sdr_atribuido: lead.sdr_responsavel });
    }

    const empresaId = lead.empresaId;

    // Buscar programação ativa para a empresa (round robin geral)
    const programacoes = await api.asServiceRole.entities.ProgramacaoDistribuicao.filter({ empresaId, ativa: true });
    const prog = programacoes[0];

    // Buscar regras específicas por campanha/origem
    const regras = await api.asServiceRole.entities.RegraDistribuicao.filter({ ativa: true, empresaId: lead.empresaId });
    const regrasEmpresa = regras.filter(r => r.empresaId === empresaId || !r.empresaId);
    const regrasOrdenadas = regrasEmpresa.sort((a, b) => (a.prioridade || 1) - (b.prioridade || 1));

    let regraAplicavel = null;
    for (const regra of regrasOrdenadas) {
      if (regra.tipo === 'campanha' && lead.campanha && lead.campanha === regra.campanha) { regraAplicavel = regra; break; }
      if (regra.tipo === 'origem'   && lead.origem   && lead.origem   === regra.origem)   { regraAplicavel = regra; break; }
    }

    // ── Elegibilidade por papel ──────────────────────────────
    // Papéis operacionais recebem leads normalmente. Supervisores só recebem
    // quando estão atuando como closer (modo_ativo === 'closer').
    const PAPEIS_OPERACIONAIS = ['sdr', 'closer', 'cs', 'social_seller'];

    // Vínculos da empresa (multi-tenant) para mapear papel por email
    const vinculosEmpresa = await api.asServiceRole.entities.VinculoEmpresa.filter({ empresaId, status: 'ativo' });
    const papelPorEmail = {};
    for (const v of vinculosEmpresa) {
      if (v.userEmail) papelPorEmail[v.userEmail.toLowerCase()] = v.papel;
    }

    // UserProfiles (mesma empresa) para checar modo_ativo dos supervisores
    const perfisEmpresa = await api.asServiceRole.entities.UserProfile.filter({ empresaId });
    const modoAtivoPorEmail = {};
    for (const p of perfisEmpresa) {
      if (p.user_email) modoAtivoPorEmail[p.user_email.toLowerCase()] = p.modo_ativo;
    }

    const emailElegivel = (email) => {
      const norm = (email || '').toLowerCase();
      const papel = papelPorEmail[norm];
      // Sem vínculo mapeado → mantém comportamento atual (elegível)
      if (!papel) return true;
      if (papel === 'supervisor') return modoAtivoPorEmail[norm] === 'closer';
      return PAPEIS_OPERACIONAIS.includes(papel) || papel === 'gestor' || papel === 'admin';
    };

    // Round-robin sobre a lista, pulando emails não elegíveis
    const selecionarDaFila = async (candidatos, indiceAtualRaw) => {
      const total = candidatos.length;
      const indiceAtual = indiceAtualRaw ?? -1;
      for (let i = 1; i <= total; i++) {
        const idx = (indiceAtual + i) % total;
        if (emailElegivel(candidatos[idx])) {
          return { email: candidatos[idx], indice: idx };
        }
      }
      return null;
    };

    let sdrSelecionado = null;
    let cadenciaId     = null;

    if (regraAplicavel && regraAplicavel.sdrs_atribuidos?.length > 0) {
      const escolha = await selecionarDaFila(regraAplicavel.sdrs_atribuidos, regraAplicavel.ultimo_indice_fila);
      if (escolha) {
        sdrSelecionado = escolha.email;
        cadenciaId     = regraAplicavel.cadencia_id || null;
        await api.asServiceRole.entities.RegraDistribuicao.update(regraAplicavel.id, { ultimo_indice_fila: escolha.indice });
      }
    } else if (prog && prog.sdrs_atribuidos?.length > 0) {
      const escolha = await selecionarDaFila(prog.sdrs_atribuidos, prog.ultimo_indice_fila);
      if (escolha) {
        sdrSelecionado = escolha.email;
        cadenciaId     = prog.cadencia_id || null;
        await api.asServiceRole.entities.ProgramacaoDistribuicao.update(prog.id, { ultimo_indice_fila: escolha.indice });
      }
    }

    if (!sdrSelecionado) {
      return Response.json({ message: 'Nenhum operador disponível para distribuição', lead_id });
    }

    const agora = new Date().toISOString();
    const hoje  = format(new Date(), 'yyyy-MM-dd');

    await api.asServiceRole.entities.Lead.update(lead_id, {
      sdr_responsavel: sdrSelecionado,
      data_atribuicao: agora,
      status: lead.fonte_externa ? 'novo' : lead.status,
    });

    await api.asServiceRole.entities.Tarefa.create({
      empresaId,
      lead_id:       lead.id,
      lead_nome:     lead.nome,
      lead_telefone: lead.telefone,
      sdr_email:     sdrSelecionado,
      tipo:          'ligacao',
      data_prevista: hoje,
      periodo:       'manha',
      status:        'pendente',
      cadencia_id:   cadenciaId,
      campanha:      lead.campanha || null,
      observacao:    lead.fonte_externa ? '🔴 LEAD URGENTE — Contato imediato' : null,
    });

    if (cadenciaId) {
      const cadencias = await api.asServiceRole.entities.Cadencia.filter({ id: cadenciaId });
      const cadencia  = cadencias[0];
      if (cadencia) {
        await api.asServiceRole.entities.Lead.update(lead_id, {
          status: 'em_cadencia',
          cadencia_id: cadencia.id,
          dia_cadencia: 1,
          data_inicio_cadencia: hoje,
        });
        for (const etapa of cadencia.etapas || []) {
          if (etapa.dia === 1) continue;
          const dataPrevista = addDays(new Date(), etapa.dia - 1);
          await api.asServiceRole.entities.Tarefa.create({
            empresaId,
            lead_id:       lead.id,
            lead_nome:     lead.nome,
            lead_telefone: lead.telefone,
            sdr_email:     sdrSelecionado,
            tipo:          etapa.tipo,
            data_prevista: format(dataPrevista, 'yyyy-MM-dd'),
            periodo:       etapa.periodo || 'manha',
            status:        'pendente',
            dia_cadencia:  etapa.dia,
            cadencia_id:   cadencia.id,
            script_id:     etapa.script_id || null,
            campanha:      lead.campanha || null,
          });
        }
      }
    }

    return Response.json({ success: true, lead_id, sdr_atribuido: sdrSelecionado, cadencia_iniciada: !!cadenciaId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
