import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

  if (!body.empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

  const integracoes = await base44.asServiceRole.entities.Integracao.filter({ empresaId: body.empresaId, tipo: 'telefonia', ativa: true });
  const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
  if (!integracao) return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424 });

  const cfg = integracao.configuracao;
  const token = String(cfg.token_gestor || '').trim();
  if (!token) return Response.json({ error: 'token_gestor não configurado' }, { status: 424 });

  const baseUrl = cfg.dominio ? `https://${cfg.dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';

  try {
    const r = await fetch(`${baseUrl}/campaigns?api_token=${encodeURIComponent(token)}&per_page=100`);
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      return Response.json({ error: 'Erro ao buscar campanhas', detalhe: d }, { status: r.status });
    }

    // A API retorna paginação: { data: { data: [...], meta: {...} } } ou { data: [...] }
    const rawList = Array.isArray(d?.data?.data) ? d.data.data
                  : Array.isArray(d?.data)        ? d.data
                  : Array.isArray(d)              ? d
                  : [];

    const campanhas = rawList.map(c => ({
      id_3cplus:     c.id,
      nome:          c.name,
      // Swagger: campo "active" (boolean), não "paused"
      ativa:         c.active !== undefined ? c.active : c.paused !== undefined ? !c.paused : true,
      start_time:    c.start_time,
      end_time:      c.end_time,
      is_predictive: c.is_predictive,
      allows_manual: c.allows_manual,
    }));

    return Response.json(
      { campanhas, total: campanhas.length },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});