import { createClientFromRequest } from "../../src/sdk.ts";

// Rate limiting por IP — 30 requests / 60s por IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Normaliza valor monetário de qualquer formato para número
function normalizeRevenue(value) {
  if (!value && value !== 0) return 0;
  const cleaned = String(value)
    .replace(/[^\d,\.]/g, '')  // remove R$, espaços, etc
    .replace(/\.(?=\d{3}(?:[,\.]|$))/g, '') // remove separador de milhar (ponto antes de 3 dígitos)
    .replace(',', '.'); // vírgula decimal → ponto
  return Number(cleaned) || 0;
}

export default async (req) => {
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

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('cf-connecting-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Access-Control-Allow-Origin': '*', 'Retry-After': '60' } }
    );
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 });
  }

  // Campos obrigatórios
  if (!payload.nome && !payload.name) {
    return Response.json({ error: 'Campo obrigatório: nome (ou name)' }, { status: 400 });
  }
  if (!payload.telefone && !payload.phone) {
    return Response.json({ error: 'Campo obrigatório: telefone (ou phone)' }, { status: 400 });
  }

  // empresaId — body ou query param
  const url = new URL(req.url);
  const empresaId = payload.empresaId || url.searchParams.get('empresaId');
  if (!empresaId) {
    return Response.json(
      { error: 'empresaId é obrigatório (no body ou ?empresaId=...)' },
      { status: 400 }
    );
  }

  const api = createClientFromRequest(req);

  // JUSTIFICATIVA: Webhook público de landing pages — chamado sem autenticação de usuário.
  // Realiza upsert de Lead, registra faturamento e cria atividade de rastreabilidade.
  // Nunca há token de usuário neste fluxo. Nunca exposto como ação de usuário no frontend.
  const webhookToken = payload.webhook_token || url.searchParams.get('webhook_token');
  const empresas = await api.asServiceRole.entities.Empresa.filter({ id: empresaId });
  if (empresas.length === 0) {
    return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }
  const empresa = empresas[0];
  if (empresa.webhook_token && empresa.webhook_token !== webhookToken) {
    return Response.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    const nome = payload.nome || payload.name;
    const telefone = String(payload.telefone || payload.phone).replace(/\D/g, '');
    const email = payload.email || '';
    const source = payload.source || 'landing_page';

    // ── 1. UPSERT DO LEAD (evita duplicidade por telefone) ─────────────────
    let lead;
    let isNew = false;

    const existentes = await api.asServiceRole.entities.Lead.filter({
      empresaId,
      telefone,
    });

    if (existentes.length > 0) {
      // Lead já existe → atualiza dados que vieram do form (sem sobrescrever campos manuais preenchidos)
      lead = existentes[0];
      const updates = {};
      if (payload.email && !lead.email) updates.email = email;
      if ((payload.empresa || payload.company_name) && !lead.empresa)
        updates.empresa = payload.empresa || payload.company_name;
      if ((payload.cidade || payload.city) && !lead.cidade)
        updates.cidade = payload.cidade || payload.city;
      if ((payload.cargo || payload.profile_type) && !lead.cargo)
        updates.cargo = payload.cargo || payload.profile_type;
      if (payload.campanha && !lead.campanha) updates.campanha = payload.campanha;
      if (Object.keys(updates).length > 0) {
        lead = await api.asServiceRole.entities.Lead.update(lead.id, updates);
      }
    } else {
      // Lead novo — cria com todos os campos disponíveis
      lead = await api.asServiceRole.entities.Lead.create({
        empresaId,
        nome,
        telefone,
        email,
        empresa: payload.empresa || payload.company_name || '',
        cargo: payload.cargo || payload.profile_type || '',
        origem: payload.origem || 'outro',
        campanha: payload.campanha || payload.form_name || '',
        status: 'novo',
        cidade: payload.cidade || payload.city || '',
        estado: payload.estado || payload.state || '',
        observacoes: payload.observacoes || payload.notes || '',
        fonte_externa: true,
        app_origem: source,
        campos_personalizados: payload.campos_personalizados || payload.extra || {},
        // Campos de perfil direto do form
        ...(payload.has_partners !== undefined && { tem_socios: Boolean(payload.has_partners) }),
        ...(payload.is_client !== undefined && { ja_cliente: Boolean(payload.is_client) }),
        ...(payload.company_structure && { observacoes: `Estrutura: ${payload.company_structure}` }),
      });
      isNew = true;
    }

    // ── 2. FATURAMENTO AUTOMÁTICO (se vier no payload) ─────────────────────
    const revenueRaw = payload.revenue ?? payload.faturamento ?? null;
    const revenueAmount = normalizeRevenue(revenueRaw);
    let revenueRegistrado = false;

    if (revenueAmount > 0) {
      await api.asServiceRole.entities.FaturamentoLead.create({
        lead_id: lead.id,
        empresaId,
        revenue_amount: revenueAmount,
        observacao: `Capturado via ${source}${payload.form_name ? ` — ${payload.form_name}` : ''}`,
        created_by: null,
        source: source === 'landing_page' ? 'landing_page' : source === 'form' ? 'form' : 'api',
      });
      revenueRegistrado = true;
    }

    // ── 3. LOG DE ATIVIDADE (rastreabilidade) ─────────────────────────────
    const descricao = isNew
      ? `Lead capturado via ${source}${payload.form_name ? ` (${payload.form_name})` : ''}`
      : `Lead atualizado via ${source}${payload.form_name ? ` (${payload.form_name})` : ''} — telefone já existia`;

    await api.asServiceRole.entities.Atividade.create({
      empresaId,
      lead_id: lead.id,
      lead_nome: lead.nome,
      tipo: 'anotacao',
      resultado: 'outro',
      observacao: descricao + (revenueRegistrado ? ` | Faturamento registrado: R$ ${revenueAmount.toLocaleString('pt-BR')}` : ''),
    });

    return Response.json(
      {
        success: true,
        lead_id: lead.id,
        is_new: isNew,
        revenue_registered: revenueRegistrado,
        mensagem: isNew ? 'Lead criado com sucesso!' : 'Lead já existia — histórico atualizado.',
      },
      {
        status: isNew ? 201 : 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[capturarLead] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
