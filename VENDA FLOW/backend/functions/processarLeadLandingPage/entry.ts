import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const { landingPageId, formData, respostas } = await req.json();

    // Buscar landing page (service role para não precisar de auth)
    const lps = await api.asServiceRole.entities.LandingPage.filter({ 
      slug: landingPageId,
      ativa: true 
    });

    if (lps.length === 0) {
      return Response.json({ error: 'Landing page não encontrada' }, { status: 404 });
    }

    const lp = lps[0];

    // Verificar se lead já existe DENTRO do mesmo tenant — nunca cross-tenant
    const leadsExistentes = formData.email
      ? await api.asServiceRole.entities.Lead.filter({
          email: formData.email,
          empresaId: lp.empresaId,
        })
      : [];

    let lead;
    const leadData = {
      empresaId: lp.empresaId,
      nome: formData.nome,
      email: formData.email,
      telefone: formData.telefone,
      empresa: formData.empresa || "",
      origem: "landing_page",
      campanha: lp.titulo,
      status: "novo",
      fonte_externa: true,
      app_origem: "landing_page",
      respostas_formulario: JSON.stringify(respostas),
    };

    if (leadsExistentes.length > 0) {
      lead = leadsExistentes[0];
      await api.asServiceRole.entities.Lead.update(lead.id, leadData);
    } else {
      lead = await api.asServiceRole.entities.Lead.create(leadData);
    }

    // Calcular pontuação
    let pontuacao = 0;
    if (lp.formulario?.perguntas_diagnostico) {
      lp.formulario.perguntas_diagnostico.forEach((pergunta, index) => {
        if (respostas[index]) {
          pontuacao += pergunta.peso_score || 0;
        }
      });
    }

    // Salvar resposta
    const respostasArray = lp.formulario?.perguntas_diagnostico?.map((p, index) => ({
      pergunta: p.pergunta,
      resposta: respostas[index] || '',
      peso_score: p.peso_score || 0
    })) || [];

    await api.asServiceRole.entities.RespostaDiagnostico.create({
      landing_page_id: lp.id,
      landing_page_titulo: lp.titulo,
      lead_id: lead.id,
      dados_basicos: formData,
      respostas: respostasArray,
      pontuacao_diagnostico: pontuacao,
    });

    // Atualizar conversões
    await api.asServiceRole.entities.LandingPage.update(lp.id, {
      total_conversoes: (lp.total_conversoes || 0) + 1,
      taxa_conversao: lp.total_visitas > 0 
        ? ((lp.total_conversoes + 1) / lp.total_visitas) * 100 
        : 0
    });

    // Calcular score do lead
    try {
      await api.asServiceRole.functions.invoke('calcularLeadScore', { lead_id: lead.id });
    } catch (e) {
      console.error('Erro ao calcular score:', e);
    }

    return Response.json({ 
      success: true, 
      lead_id: lead.id,
      pontuacao
    });

  } catch (error) {
    console.error('Erro ao processar lead:', error);
    return Response.json({ 
      error: 'Erro ao processar lead',
      details: error.message 
    }, { status: 500 });
  }
};
