import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const EMPRESA_ID = "69e151eb2bf26dd959c278d4";
    const BATCH_SIZE = 200;
    let totalUpdated = 0;
    let hasMore = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (hasMore && iterations < MAX_ITERATIONS) {
      iterations++;
      // Busca leads sem empresaId (null, undefined ou vazio)
      const leads = await base44.asServiceRole.entities.Lead.filter(
        { $or: [{ empresaId: null }, { empresaId: "" }] },
        null,
        BATCH_SIZE
      );

      if (!leads || leads.length === 0) {
        hasMore = false;
        break;
      }

      // Atualiza cada lead
      const updates = leads.map(lead =>
        base44.asServiceRole.entities.Lead.update(lead.id, {
          empresaId: EMPRESA_ID,
          status: lead.status || "novo",
          origem: lead.origem || "lista_fria"
        })
      );

      await Promise.all(updates);
      totalUpdated += leads.length;

      if (leads.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    return Response.json({ 
      success: true, 
      totalUpdated,
      iterations,
      message: `${totalUpdated} leads vinculados à empresa ${EMPRESA_ID}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});