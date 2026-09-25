import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook público — chamado por sistemas externos sem autenticação de usuário.
Deno.serve(async (req) => {
  // CORS preflight
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

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Corpo da requisição inválido. Envie JSON válido.' }, { status: 400 });
  }

  const empresaId = body.empresaId || body.empresa_id || '';
  if (!empresaId) {
    return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // JUSTIFICATIVA: Webhook público — chamado por sistemas externos (Meta Ads, Google Ads, etc.)
    // sem autenticação de usuário. Cria Lead na empresa alvo após validar webhook_token.
    // Nunca há token de usuário neste fluxo. Nunca exposto como ação de usuário no frontend.
    const url = new URL(req.url);
    const webhookToken = body.webhook_token || url.searchParams.get('webhook_token');
    const empresas = await base44.asServiceRole.entities.Empresa.filter({ id: empresaId });
    if (empresas.length === 0) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }
    const empresa = empresas[0];
    if (!empresa.webhook_token) {
      return Response.json({ error: 'Empresa não possui webhook_token configurado' }, { status: 403 });
    }
    if (!webhookToken || empresa.webhook_token !== webhookToken) {
      return Response.json({ error: 'Token inválido' }, { status: 401 });
    }

    const leadData = {
      empresaId,
      nome: body.nome || body.name || body.lead_name || 'Sem nome',
      telefone: body.telefone || body.phone || body.tel || '',
      email: body.email || '',
      empresa: body.empresa || body.company || '',
      cargo: body.cargo || body.role || body.position || '',
      origem: body.origem || body.source || 'outro',
      campanha: body.campanha || body.campaign || '',
      status: 'novo',
      observacoes: body.observacoes || body.notes || '',
      fonte_externa: true,
      app_origem: body.app_origem || body.app_id || 'externo',
      campos_personalizados: body.campos_personalizados || body.extra || {},
    };

    const novoLead = await base44.asServiceRole.entities.Lead.create(leadData);

    return Response.json(
      { success: true, id: novoLead.id },
      {
        status: 201,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[receberLeadExterno] Erro ao criar lead:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});