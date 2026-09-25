import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook público — chamado por sistemas externos sem autenticação de usuário.
// Usa asServiceRole do SDK (não chama auth.me()).
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

  // Campos obrigatórios mínimos
  if (!body.nome || !body.telefone) {
    return Response.json({ error: 'Campos obrigatórios: nome, telefone' }, { status: 400 });
  }

  // empresaId é obrigatório — pode vir no body ou como query param
  const url = new URL(req.url);
  const empresaId = body.empresaId || url.searchParams.get('empresaId');

  if (!empresaId) {
    return Response.json(
      { error: 'empresaId é obrigatório (no body ou query param ?empresaId=...)' },
      { status: 400 }
    );
  }

  // Validar webhook_token para evitar injeção de leads por terceiros
  const webhookToken = body.webhook_token || url.searchParams.get('webhook_token');
  const base44 = createClientFromRequest(req);

  let empresa;
  try {
    const empresas = await base44.asServiceRole.entities.Empresa.filter({ id: empresaId });
    if (empresas.length === 0) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }
    empresa = empresas[0];
  } catch (lookupErr) {
    console.error('[webhookReceberLead] Erro ao buscar empresa:', lookupErr.message);
    return Response.json({ error: 'Erro ao validar empresa' }, { status: 500 });
  }

  // Se a empresa tiver um webhook_token configurado, ele é obrigatório e deve bater.
  // Se não tiver token configurado, aceita o lead apenas validando que a empresa existe (empresaId).
  if (empresa.webhook_token) {
    if (!webhookToken || empresa.webhook_token !== webhookToken) {
      return Response.json({ error: 'Token inválido' }, { status: 401 });
    }
  }

  try {

    // origem e app_origem: body tem prioridade, depois query param, depois default
    const origemFinal    = body.origem     || url.searchParams.get('origem')     || 'outro';
    const appOrigemFinal = body.app_origem || url.searchParams.get('app_origem') || 'webhook_externo';
    const campanhaFinal  = body.campanha   || url.searchParams.get('campanha')   || '';

    // fonte_externa: sempre true — todo lead que chega via webhook é por definição externo
    const fonteExterna = true;

    console.log(`[webhookReceberLead] origem=${origemFinal} | app=${appOrigemFinal} | fonte_externa=${fonteExterna}`);

    const lead = await base44.asServiceRole.entities.Lead.create({
      empresaId,
      nome: body.nome,
      telefone: body.telefone,
      email: body.email || '',
      empresa: body.empresa || '',
      cargo: body.cargo || '',
      origem: origemFinal,
      campanha: campanhaFinal,
      observacoes: body.observacoes || '',
      status: 'novo',
      fonte_externa: fonteExterna,
      app_origem: appOrigemFinal,
      campos_personalizados: body.campos_personalizados || body.extra || {},
    });

    // Distribuição imediata — chama distribuirLead autenticado via secret interno
    try {
      const distribuirUrl = req.url.replace(/\/[^\/]+$/, '/distribuirLead');
      const internalSecret = Deno.env.get('BRIDGE_WEBHOOK_SECRET') || '';
      await fetch(distribuirUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
        body: JSON.stringify({ lead_id: lead.id }),
      });
    } catch (distErr) {
      console.warn('[webhookReceberLead] Distribuição automática falhou (não crítico):', distErr.message);
    }

    // Faturamento automático — se vier campo revenue no payload, registra histórico
    const revenueRaw = body.revenue ?? body.faturamento ?? null;
    if (revenueRaw !== null && revenueRaw !== '') {
      const revenueStr = String(revenueRaw).trim();
      // Se for uma string descritiva (ex: "De 60 a 70 mil/mês"), preserva como texto no revenue_amount=0 e observacao
      // Se for numérico puro (ex: "6070" ou "6070.50"), converte normalmente
      const isNumeric = /^[\d\s.,R$%]+$/.test(revenueStr);
      const revenueAmount = isNumeric
        ? Number(revenueStr.replace(/[^0-9,.]/g, "").replace(",", ".")) || 0
        : 0;
      await base44.asServiceRole.entities.FaturamentoLead.create({
        lead_id: lead.id,
        empresaId,
        revenue_amount: revenueAmount,
        observacao: `${revenueStr} — Capturado automaticamente via ${appOrigemFinal}`,
        created_by: null,
        source: 'api',
      });
    }

    const attr = body.attribution || {};
    const hasAttribution =
      attr.source || attr.channel || attr.utm_source ||
      body.utm_source || body.utm_medium || body.utm_campaign ||
      body.gclid || attr.gclid;

    if (hasAttribution) {
      try {
        await base44.asServiceRole.entities.MarketingAttribution.create({
          lead_id:      lead.id,
          empresaId,
          source:       attr.source      || body.utm_source   || '',
          channel:      attr.channel     || body.utm_medium   || '',
          campaign:     attr.campaign    || body.utm_campaign || campanhaFinal || '',
          content:      attr.content     || body.utm_content  || '',
          audience:     attr.audience    || '',
          touchpoint:   attr.touchpoint  || '',
          identifier:   attr.identifier  || '',
          utm_source:   body.utm_source   || attr.utm_source   || attr.source   || '',
          utm_medium:   body.utm_medium   || attr.utm_medium   || attr.channel  || '',
          utm_campaign: body.utm_campaign || attr.utm_campaign || attr.campaign || '',
          utm_content:  body.utm_content  || attr.utm_content  || attr.content  || '',
          utm_term:     body.utm_term     || attr.utm_term     || '',
          campaign_id:  attr.campaign_id  || body.campaign_id  || '',
          adset_id:     attr.adset_id     || body.adset_id     || '',
          ad_id:        attr.ad_id        || body.ad_id        || '',
          placement:    attr.placement    || body.placement    || '',
          gclid:        attr.gclid        || body.gclid        || '',
          landing_page: attr.landing_page || body.landing_page || '',
          first_touch:  attr.first_touch  || attr.captured_at || new Date().toISOString(),
          last_touch:   attr.last_touch   || attr.captured_at || new Date().toISOString(),
          captured_at:  attr.captured_at  || new Date().toISOString(),
        });
        console.log(`[webhookReceberLead] MarketingAttribution criado para lead ${lead.id}`);
      } catch (attrErr) {
        console.error('[webhookReceberLead] Erro ao salvar MarketingAttribution:', attrErr.message);
      }
    }

    return Response.json(
      { success: true, lead_id: lead.id, mensagem: 'Lead recebido com sucesso!' },
      {
        status: 201,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[webhookReceberLead] Erro ao criar lead:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});