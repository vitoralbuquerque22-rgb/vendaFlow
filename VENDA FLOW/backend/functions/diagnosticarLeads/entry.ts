import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);

    // Usa serviceRole puro, sem RLS de nenhum tipo
    const leads = await api.asServiceRole.entities.Lead.list('-created_date', 200);

    const porEmpresa = {};
    for (const l of leads) {
      const eid = l.empresaId || '__sem_empresa__';
      porEmpresa[eid] = (porEmpresa[eid] || 0) + 1;
    }

    return Response.json({
      total_buscados: leads.length,
      por_empresa: porEmpresa,
      primeiros_5: leads.slice(0, 5).map(l => ({
        id: l.id,
        nome: l.nome,
        empresaId: l.empresaId,
        status: l.status,
        origem: l.origem,
        created_date: l.created_date
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
