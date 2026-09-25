import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Busca com serviceRole ignora RLS
    const batch1 = await base44.asServiceRole.entities.Lead.list('-created_date', 200);
    const batch2 = await base44.asServiceRole.entities.Lead.list('created_date', 200);

    // Pega 5 dos mais recentes para inspecionar
    const recentes = batch1.slice(0, 5).map(l => ({
      id: l.id,
      nome: l.nome,
      created_date: l.created_date,
      empresaId: l.empresaId
    }));

    // Conta distintos sem empresaId
    const semEmpresa = batch1.filter(l => !l.empresaId || l.empresaId === '').length;

    return Response.json({
      batch1_count: batch1.length,
      sem_empresaId_nos_200_mais_recentes: semEmpresa,
      recentes
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});