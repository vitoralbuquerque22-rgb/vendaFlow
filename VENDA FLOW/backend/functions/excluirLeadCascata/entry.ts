import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId } = await req.json();
    if (!leadId) return Response.json({ error: 'leadId obrigatório' }, { status: 400 });

    // Buscar o lead para verificar permissão
    const lead = await api.entities.Lead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead não encontrado' }, { status: 404 });

    // Excluir registros relacionados em paralelo
    const [tarefas, atividades, callSessions, leadScores, faturamentos, gravacoes, spinRespostas] = await Promise.all([
      api.entities.Tarefa.filter({ lead_id: leadId }).catch(() => []),
      api.entities.Atividade.filter({ lead_id: leadId }).catch(() => []),
      api.entities.CallSession.filter({ lead_id: leadId }).catch(() => []),
      api.entities.LeadScore.filter({ lead_id: leadId }).catch(() => []),
      api.entities.FaturamentoLead.filter({ lead_id: leadId }).catch(() => []),
      api.entities.GravacaoLigacao.filter({ lead_id: leadId }).catch(() => []),
      api.entities.SpinResposta.filter({ lead_id: leadId }).catch(() => []),
    ]);

    const deletions = [];
    const addDeletions = (items, entity) => {
      for (const item of items) {
        deletions.push(entity.delete(item.id).catch(() => null));
      }
    };

    addDeletions(tarefas, api.entities.Tarefa);
    addDeletions(atividades, api.entities.Atividade);
    addDeletions(callSessions, api.entities.CallSession);
    addDeletions(leadScores, api.entities.LeadScore);
    addDeletions(faturamentos, api.entities.FaturamentoLead);
    addDeletions(gravacoes, api.entities.GravacaoLigacao);
    addDeletions(spinRespostas, api.entities.SpinResposta);

    await Promise.all(deletions);

    // Excluir o lead
    await api.entities.Lead.delete(leadId);

    const resumo = {
      tarefas: tarefas.length,
      atividades: atividades.length,
      callSessions: callSessions.length,
      leadScores: leadScores.length,
      faturamentos: faturamentos.length,
      gravacoes: gravacoes.length,
      spinRespostas: spinRespostas.length,
    };

    console.log(`Lead ${leadId} excluído em cascata:`, resumo);

    return Response.json({ success: true, resumo });
  } catch (error) {
    console.error('Erro ao excluir lead em cascata:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
