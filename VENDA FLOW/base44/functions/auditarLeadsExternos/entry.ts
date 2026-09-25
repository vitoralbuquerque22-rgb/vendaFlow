import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const EMPRESA = "69e151eb2bf26dd959c278d4";
    const BATCH = 500;

    // Buscar em dois lotes para cobrir mais registros
    const [lote1, lote2] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ empresaId: EMPRESA }, '-created_date', BATCH),
      base44.asServiceRole.entities.Lead.filter({ empresaId: EMPRESA }, 'created_date', BATCH),
    ]);

    // Deduplicar por id
    const mapa = new Map();
    for (const l of [...lote1, ...lote2]) mapa.set(l.id, l);
    const leads = [...mapa.values()];

    const webhookOrigem = leads.filter(l => l.app_origem === 'webhook_externo');
    const externoTrue  = webhookOrigem.filter(l => l.fonte_externa === true);
    const externoFalse = webhookOrigem.filter(l => l.fonte_externa === false);
    const externoNulo  = webhookOrigem.filter(l => l.fonte_externa === undefined || l.fonte_externa === null);

    // Distribuição por data dos leads webhook
    const porData = {};
    for (const l of webhookOrigem) {
      const dia = (l.created_date || '').substring(0, 10);
      porData[dia] = (porData[dia] || 0) + 1;
    }

    // Distribuição por data de todos com fonte_externa true
    const todosExternos = leads.filter(l => l.fonte_externa === true);
    const porDataExternos = {};
    for (const l of todosExternos) {
      const dia = (l.created_date || '').substring(0, 10);
      porDataExternos[dia] = (porDataExternos[dia] || 0) + 1;
    }

    // App origens distintas
    const appOrigens = {};
    for (const l of leads) {
      const app = l.app_origem || 'sem_app_origem';
      appOrigens[app] = (appOrigens[app] || 0) + 1;
    }

    return Response.json({
      total_leads_amostrados: leads.length,
      app_origens_distintas: appOrigens,
      webhook_externo: {
        total: webhookOrigem.length,
        fonte_externa_true: externoTrue.length,
        fonte_externa_false: externoFalse.length,
        fonte_externa_nulo: externoNulo.length,
        por_data: Object.entries(porData).sort((a,b) => b[0].localeCompare(a[0])),
      },
      todos_fonte_externa_true: {
        total: todosExternos.length,
        por_data: Object.entries(porDataExternos).sort((a,b) => b[0].localeCompare(a[0])),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});