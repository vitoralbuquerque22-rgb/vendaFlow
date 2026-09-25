import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId } = await req.json();
    if (!leadId) return Response.json({ error: 'leadId obrigatório' }, { status: 400 });

    // Buscar o lead para verificar permissão
    const lead = await base44.entities.Lead.get(leadId);
    if (!lead) return Response.json({ error: 'Lead não encontrado' }, { status: 404 });

    // Excluir registros relacionados em paralelo
    const [tarefas, atividades, callSessions, leadScores, faturamentos, gravacoes, spinRespostas] = await Promise.all([
      base44.entities.Tarefa.filter({ lead_id: leadId }).catch(() => []),
      base44.entities.Atividade.filter({ lead_id: leadId }).catch(() => []),
      base44.entities.CallSession.filter({ lead_id: leadId }).catch(() => []),
      base44.entities.LeadScore.filter({ lead_id: leadId }).catch(() => []),
      base44.entities.FaturamentoLead.filter({ lead_id: leadId }).catch(() => []),
      base44.entities.GravacaoLigacao.filter({ lead_id: leadId }).catch(() => []),
      base44.entities.SpinResposta.filter({ lead_id: leadId }).catch(() => []),
    ]);

    const deletions = [];
    const addDeletions = (items, entity) => {
      for (const item of items) {
        deletions.push(entity.delete(item.id).catch(() => null));
      }
    };

    addDeletions(tarefas, base44.entities.Tarefa);
    addDeletions(atividades, base44.entities.Atividade);
    addDeletions(callSessions, base44.entities.CallSession);
    addDeletions(leadScores, base44.entities.LeadScore);
    addDeletions(faturamentos, base44.entities.FaturamentoLead);
    addDeletions(gravacoes, base44.entities.GravacaoLigacao);
    addDeletions(spinRespostas, base44.entities.SpinResposta);

    await Promise.all(deletions);

    // Excluir o lead
    await base44.entities.Lead.delete(leadId);

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
});