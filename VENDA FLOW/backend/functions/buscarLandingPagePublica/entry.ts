import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const { slug } = await req.json();

    // Usar service role para buscar e atualizar (landing page tem read público agora)
    const lps = await api.asServiceRole.entities.LandingPage.filter({ 
      slug, 
      ativa: true 
    });

    if (lps.length === 0) {
      return Response.json({ landingPage: null });
    }

    const lp = lps[0];

    // Registrar visita
    try {
      await api.asServiceRole.entities.LandingPage.update(lp.id, {
        total_visitas: (lp.total_visitas || 0) + 1
      });
    } catch (e) {
      console.error('Erro ao registrar visita:', e);
    }

    return Response.json({ landingPage: lp });

  } catch (error) {
    console.error('Erro ao buscar landing page:', error);
    return Response.json({ 
      error: 'Erro ao buscar landing page',
      details: error.message 
    }, { status: 500 });
  }
};
