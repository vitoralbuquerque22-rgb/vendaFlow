import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const { landingPageId } = await req.json();

    const lps = await api.asServiceRole.entities.LandingPage.filter({ 
      slug: landingPageId,
      ativa: true 
    });

    if (lps.length === 0) {
      return Response.json({ error: 'Landing page não encontrada' }, { status: 404 });
    }

    const lp = lps[0];

    await api.asServiceRole.entities.LandingPage.update(lp.id, {
      total_visitas: (lp.total_visitas || 0) + 1
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Erro ao registrar visita:', error);
    return Response.json({ 
      error: 'Erro ao registrar visita',
      details: error.message 
    }, { status: 500 });
  }
};
