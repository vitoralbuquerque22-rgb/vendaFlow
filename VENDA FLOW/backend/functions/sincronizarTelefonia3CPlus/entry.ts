import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialGestor, Erro3C, listarAgentes } from "../../src/telefonia3c.ts";

/**
 * sincronizarTelefonia3CPlus
 *
 * Chamada por agendamento (n8n) ou manualmente pelo gestor.
 * Busca chamadas recentes na API REST do 3C Plus e as sincroniza
 * como Atividades no CRM, atualizando o status do Lead conforme
 * a qualificação registrada.
 *
 * Por que REST e não Socket.io?
 * Funções do backend não mantêm conexões
 * persistentes. O Socket.io do 3C Plus serve para sistemas
 * que ficam 24h conectados. Aqui usamos o endpoint GET /calls
 * para buscar o histórico do último intervalo de execução.
 */

// Mapeamento: qualificação 3C Plus → status Lead no CRM
const QUALIFICACAO_PARA_STATUS = {
  'Atendeu - Interesse':        'respondeu',
  'Atendeu - Sem Interesse':    'sem_interesse',
  'Atendeu - Reunião Agendada': 'reuniao_agendada',
  'Não Atendeu':                'em_cadencia',
  'Caixa Postal':               'em_cadencia',
  'Número Inválido':            'desqualificado',
  'Desqualificado':             'desqualificado',
};

// Mapeamento: status AMD / disposição → resultado Atividade
const DISPOSICAO_PARA_RESULTADO = {
  'answered':  'atendeu',
  'no-answer': 'nao_atendeu',
  'busy':      'ocupado',
  'failed':    'numero_invalido',
  'voicemail': 'caixa_postal',
  'machine':   'caixa_postal',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'gestor')) {
      return Response.json({ error: 'Acesso restrito a admin ou gestor' }, { status: 403 });
    }

    // Aceita empresaId via body (chamada manual) ou processa todas as empresas (cron)
    let body = {};
    try { body = await req.json(); } catch { /* cron sem body */ }

    const janelaMinutos = body.janela_minutos ?? 360; // Busca última janela de X minutos (6h — fallback/reconciliação)
    // API /calls exige formato Y-m-d H:i:s (não ISO) e start_date + end_date obrigatórios
    const fmtData = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
    const dataInicio = fmtData(new Date(Date.now() - janelaMinutos * 60 * 1000));
    const dataFim = fmtData(new Date());

    // JUSTIFICATIVA: Job sistêmico (cron ou acionado por gestor) — varre integrações 3C Plus
    // de todas as empresas, cria Atividades e atualiza status de Leads com base no histórico
    // de chamadas. Requer acesso cross-SDR dentro do tenant. Nunca exposto ao frontend.
    const filtroIntegracao = { tipo: 'telefonia', ativa: true };
    if (body.empresaId) filtroIntegracao.empresaId = body.empresaId;

    const integracoes = await api.asServiceRole.entities.Integracao.filter(filtroIntegracao);

    const resultado = {
      integracoes_processadas: 0,
      chamadas_sincronizadas: 0,
      atividades_criadas: 0,
      ja_sincronizadas_realtime: 0,
      leads_atualizados: 0,
      erros: [],
    };

    for (const integracao of integracoes) {
      const cfg = integracao.configuracao || {};

      if (cfg.fornecedor !== '3cplus') continue;
      // Credencial de gestor da empresa (token de serviço 3cs_ ou, na transição, token pessoal legado)
      let cred;
      try {
        cred = await credencialGestor(api, String(integracao.empresaId));
      } catch (e) {
        if (!(e instanceof Erro3C)) throw e;
        resultado.erros.push(`Integração ${integracao.id}: ${e.message}`);
        continue;
      }

      resultado.integracoes_processadas++;
      const empresaId = integracao.empresaId;

      // -------------------------------------------------------
      // 1. Buscar histórico de chamadas do período
      // -------------------------------------------------------
      let chamadas = [];
      try {
        const respChamadas = await chamar3C(cred, '/calls', {
          query: { start_date: dataInicio, end_date: dataFim, per_page: 200 },
          timeoutMs: 30000, // antes não havia timeout; 15s (padrão) pode ser pouco para o histórico
        });

        if (!respChamadas.ok) {
          resultado.erros.push(
            `Integração ${integracao.id}: erro ao buscar chamadas (${respChamadas.status})`
          );
          continue;
        }

        const dadosChamadas = await respChamadas.json();
        chamadas = dadosChamadas.data || dadosChamadas.calls || dadosChamadas || [];
      } catch (e) {
        resultado.erros.push(`Integração ${integracao.id}: falha na requisição — ${e.message}`);
        continue;
      }

      resultado.chamadas_sincronizadas += chamadas.length;

      // Índices carregados UMA vez por integração — evita N+1, rate limit 429 e estouro de memória
      const leadsEmpresa = await api.asServiceRole.entities.Lead.filter({ empresaId });
      const leadPorTelefone = {};
      for (const l of leadsEmpresa) {
        const tel = String(l.telefone || '').replace(/\D/g, '');
        if (tel) leadPorTelefone[tel] = l;
      }
      const atividadesJaSync = await api.asServiceRole.entities.Atividade.filter({ empresaId, origem_sincronizacao: '3cplus' });
      const chamadasSincronizadas = new Set(atividadesJaSync.map(a => a.chamada_id_3cplus).filter(Boolean));

      // Mapeia nome do agente (3C) → email do SDR via vínculos da empresa
      const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({ empresaId });
      const nomeParaEmail = {};
      for (const v of vinculos) {
        if (v.userName) nomeParaEmail[v.userName.toLowerCase().trim()] = v.userEmail;
      }

      // -------------------------------------------------------
      // 2. Para cada chamada, localizar o Lead e criar Atividade
      // -------------------------------------------------------
      for (const chamada of chamadas) {
        try {
          // Campos conforme model oficial CallHistoryReport
          const chamadaId    = String(chamada.id || '');
          const telefone     = String(chamada.number || '');
          const agenteNome   = String(chamada.agent || '');
          const duracao      = Number(chamada.speaking_time || 0);
          const tpa          = Number(chamada.acw_time || 0);
          const qualificacao = String(chamada.readable_status_text || '');
          const disposicao   = String(chamada.status_id || 'no-answer').toLowerCase();
          const gravacaoUrl  = String(chamada.recording || '');
          const dataHora     = String(chamada.call_date_rfc3339 || chamada.call_date || new Date().toISOString());

          if (!chamadaId) continue;

          // Dedup em memória (sem query por chamada)
          if (chamadasSincronizadas.has(chamadaId)) {
            resultado.ja_sincronizadas_realtime++;
            continue;
          }

          // Lead via índice em memória (sem query por chamada)
          const telefoneNormalizado = telefone.replace(/\D/g, '');
          let lead = leadPorTelefone[telefoneNormalizado];
          if (!lead && telefoneNormalizado) {
            const match = Object.keys(leadPorTelefone).find(
              t => t.endsWith(telefoneNormalizado) || telefoneNormalizado.endsWith(t)
            );
            if (match) lead = leadPorTelefone[match];
          }

          // Schema exige lead_id como string — pular chamadas sem lead casado
          if (!lead?.id) continue;

          const resultado_atividade = DISPOSICAO_PARA_RESULTADO[disposicao] ?? 'outro';

          await api.asServiceRole.entities.Atividade.create({
            empresaId,
            tipo: 'ligacao',
            resultado: resultado_atividade,
            duracao_segundos: duracao,
            tpa_segundos: tpa,
            chamada_id_3cplus: chamadaId,
            gravacao_url: gravacaoUrl,
            observacao: qualificacao ? `Qualificação 3C Plus: ${qualificacao}` : '',
            sdr_email: nomeParaEmail[agenteNome.toLowerCase().trim()] || '',
            lead_id: lead.id,
            lead_telefone: telefone,
            lead_nome: String(lead.nome || telefone),
            created_date: dataHora,
            origem_sincronizacao: '3cplus',
          });
          chamadasSincronizadas.add(chamadaId);

          resultado.atividades_criadas++;

          // Atualizar status do Lead se tiver qualificação mapeada
          if (lead && qualificacao) {
            const novoStatus = QUALIFICACAO_PARA_STATUS[qualificacao];
            if (novoStatus && novoStatus !== lead.status) {
              await api.asServiceRole.entities.Lead.update(lead.id, {
                status: novoStatus,
              });
              resultado.leads_atualizados++;
            }
          }
        } catch (eChamada) {
          resultado.erros.push(`Chamada ${chamada.id}: ${eChamada.message}`);
        }
      }

      // -------------------------------------------------------
      // 3. Atualizar status dos agentes no campo Integracao
      // -------------------------------------------------------
      try {
        const respAgentes = await listarAgentes(cred).then((data) => ({ ok: true, json: async () => ({ data }) })); // todas as páginas
        if (respAgentes.ok) {
          const dadosAgentes = await respAgentes.json();
          const agentes = dadosAgentes.data || dadosAgentes || [];
          await api.asServiceRole.entities.Integracao.update(integracao.id, {
            ultima_sincronizacao: new Date().toISOString(),
            status_conexao: 'ativa',
            dados_cache: { agentes_ao_vivo: agentes },
          });
        }
      } catch { /* não bloqueia se falhar */ }
    }

    console.log(`[sincronizarTelefonia3CPlus] Resumo: ${resultado.atividades_criadas} novas, ${resultado.ja_sincronizadas_realtime} já via real-time, ${resultado.chamadas_sincronizadas} total chamadas`);

    return Response.json(
      { success: true, ...resultado },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('[sincronizarTelefonia3CPlus]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
