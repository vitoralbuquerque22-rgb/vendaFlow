import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * removerLeadDaCadencia
 *
 * Remove um lead da cadência ("devolver à base"):
 *   1. Exclui todas as tarefas do lead
 *   2. Registra a remoção no histórico (Atividade)
 *   3. Limpa cadência, responsáveis e volta o status para "novo"
 *
 * Usa asServiceRole para garantir que a escrita aconteça mesmo quando o lead
 * pertence a outro SDR/closer — o RLS do usuário filtra por SDR e faria o
 * update falhar silenciosamente (registro não encontrado), deixando o painel
 * "removendo com sucesso" sem refletir no banco nem no histórico.
 */
Deno.serve(async (req) => {
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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    if (!body.lead_id) {
      return Response.json({ error: 'lead_id é obrigatório' }, { status: 400 });
    }

    // Buscar o lead (service role — pode pertencer a outro SDR)
    let lead;
    try {
      lead = await base44.asServiceRole.entities.Lead.get(body.lead_id);
    } catch {
      return Response.json({ error: 'Lead não encontrado' }, { status: 404 });
    }
    if (!lead) return Response.json({ error: 'Lead não encontrado' }, { status: 404 });

    // Excluir tarefas do lead
    const tarefasLead = await base44.asServiceRole.entities.Tarefa.filter({ lead_id: lead.id });
    for (const t of tarefasLead) {
      await base44.asServiceRole.entities.Tarefa.delete(t.id);
    }

    // Registrar no histórico
    await base44.asServiceRole.entities.Atividade.create({
      empresaId: lead.empresaId,
      lead_id: lead.id,
      lead_nome: lead.nome,
      lead_telefone: lead.telefone,
      tipo: 'anotacao',
      resultado: 'outro',
      sdr_email: user.email,
      observacao: `Lead removido da cadência manualmente por ${user.full_name || user.email || 'gestor'}. SDR: ${lead.sdr_responsavel || '—'} | Closer: ${lead.closer_responsavel || '—'} | ${tarefasLead.length} tarefa(s) excluída(s).`,
      origem_sincronizacao: 'manual',
    });

    // Limpar cadência e devolver à base
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      cadencia_id: null,
      dia_cadencia: null,
      data_inicio_cadencia: null,
      sdr_responsavel: null,
      closer_responsavel: null,
      status: 'novo',
    });

    return Response.json(
      { success: true, lead_id: lead.id, tarefas_excluidas: tarefasLead.length },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('[removerLeadDaCadencia]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});