import { createClientFromRequest } from "../../src/sdk.ts";
import { format } from 'npm:date-fns@3.6.0';

const DUAS_HORAS_MS  = 2  * 60 * 60 * 1000;
const VINTE_QUATRO_H = 24 * 60 * 60 * 1000;

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user   = await api.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));

    // Sem empresaId (execução agendada) → processa todas as empresas com programação ativa
    let empresaIds = [];
    if (payload.empresaId || user?.empresaAtualId) {
      empresaIds = [payload.empresaId || user.empresaAtualId];
    } else {
      const progsAtivas = await api.asServiceRole.entities.ProgramacaoDistribuicao.filter({ ativa: true });
      empresaIds = [...new Set(progsAtivas.map(p => p.empresaId).filter(Boolean))];
    }

    if (empresaIds.length === 0) {
      return Response.json({ ok: true, mensagem: 'Nenhuma empresa com programação ativa' });
    }

    const agora = Date.now();
    const hoje  = format(new Date(), 'yyyy-MM-dd');
    const resultadoGlobal = { empresas: 0, urgente_sem_toque: 0, retentativa_24h: 0, retorno_vencido: 0, tarefas_encerradas: 0, erros: 0 };

    for (const empresaId of empresaIds) {
      const programacoes = await api.asServiceRole.entities.ProgramacaoDistribuicao.filter({ empresaId, ativa: true });
      const prog = programacoes[0];
      if (!prog || !prog.sdrs_atribuidos?.length) continue;
      resultadoGlobal.empresas++;

      const sdrs   = prog.sdrs_atribuidos;
      let   indice = prog.ultimo_indice_fila || 0;

      const proximoSdr = () => {
        const sdr = sdrs[indice % sdrs.length];
        indice = (indice + 1) % sdrs.length;
        return sdr;
      };

      // Índice: última atividade por lead
      const atividades = await api.asServiceRole.entities.Atividade.filter({ empresaId });
      const ultimaAtiv = {};
      atividades.forEach(a => {
        if (!a.lead_id) return;
        const t = new Date(a.created_date || 0).getTime();
        if (!ultimaAtiv[a.lead_id] || t > ultimaAtiv[a.lead_id]) ultimaAtiv[a.lead_id] = t;
      });

      // Todas as tarefas pendentes da empresa em UMA query (evita N+1 no loop)
      const tarefasPendentes = await api.asServiceRole.entities.Tarefa.filter({ empresaId, status: 'pendente' });
      const tarefasPorLead = {};
      tarefasPendentes.forEach(t => {
        if (!t.lead_id) return;
        if (!tarefasPorLead[t.lead_id]) tarefasPorLead[t.lead_id] = [];
        tarefasPorLead[t.lead_id].push(t);
      });

      const leadsAtivos = await api.asServiceRole.entities.Lead.filter({ empresaId });
      const leadsElegiveis = leadsAtivos.filter(l =>
        l.sdr_responsavel &&
        !['desqualificado', 'sem_interesse', 'cliente', 'venda_sucesso', 'perdido'].includes(l.status)
      );

      const redistribuir = async (lead, motivo, novoSdr) => {
        // 1. Encerrar TODAS as tarefas pendentes antigas do lead — impede que as
        //    vencidas continuem disparando redistribuição a cada execução (loop)
        const antigas = tarefasPorLead[lead.id] || [];
        for (const t of antigas) {
          await api.asServiceRole.entities.Tarefa.update(t.id, {
            status: 'encerrada_automaticamente',
            motivo_encerramento: 'transferencia',
          });
          resultadoGlobal.tarefas_encerradas++;
        }

        // 2. Atualizar o lead com o novo responsável
        await api.asServiceRole.entities.Lead.update(lead.id, {
          sdr_responsavel:       novoSdr,
          redistribuicoes_count: (lead.redistribuicoes_count || 0) + 1,
          redistribuido_em:      new Date().toISOString(),
          motivo_redistribuicao: motivo,
          data_atribuicao:       new Date().toISOString(),
        });

        // 3. Criar UMA tarefa nova para o novo SDR
        await api.asServiceRole.entities.Tarefa.create({
          empresaId,
          lead_id:       lead.id,
          lead_nome:     lead.nome,
          lead_telefone: lead.telefone,
          sdr_email:     novoSdr,
          tipo:          'ligacao',
          data_prevista: hoje,
          periodo:       'manha',
          status:        'pendente',
          observacao:    `🔄 Redistribuído automaticamente (${motivo})`,
        });
      };

      for (const lead of leadsElegiveis) {
        try {
          // Guarda anti-loop: no máximo 1 redistribuição por lead a cada 24h
          if (lead.redistribuido_em && (agora - new Date(lead.redistribuido_em).getTime()) < VINTE_QUATRO_H) {
            continue;
          }

          const ultima = ultimaAtiv[lead.id];
          const criado = new Date(lead.created_date || 0).getTime();

          // Condição 1: lead externo sem nenhum toque há > 2h
          if (lead.fonte_externa && !ultima && (agora - criado) > DUAS_HORAS_MS) {
            await redistribuir(lead, 'urgente_sem_toque', proximoSdr());
            resultadoGlobal.urgente_sem_toque++;
            continue;
          }

          // Condição 2: última atividade com resultado negativo há > 24h
          if (ultima && (agora - ultima) > VINTE_QUATRO_H) {
            const ultimaAtivObj = atividades
              .filter(a => a.lead_id === lead.id)
              .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
            const resultadosRetentativa = ['nao_atendeu', 'ocupado', 'caixa_postal'];
            if (ultimaAtivObj && resultadosRetentativa.includes(ultimaAtivObj.resultado)) {
              await redistribuir(lead, 'retentativa_24h', proximoSdr());
              resultadoGlobal.retentativa_24h++;
              continue;
            }
          }

          // Condição 3: tarefa de ligação vencida
          const vencidas = (tarefasPorLead[lead.id] || []).filter(
            t => t.tipo === 'ligacao' && t.data_prevista && t.data_prevista < hoje
          );
          if (vencidas.length > 0) {
            await redistribuir(lead, 'retorno_vencido', proximoSdr());
            resultadoGlobal.retorno_vencido++;
          }

        } catch (err) {
          resultadoGlobal.erros++;
          console.error('[redistribuirLeadsVencidos] erro no lead', lead.id, err.message);
        }
      }

      // Salvar índice atualizado
      await api.asServiceRole.entities.ProgramacaoDistribuicao.update(prog.id, {
        ultimo_indice_fila: indice,
        ultima_execucao: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, ...resultadoGlobal });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
