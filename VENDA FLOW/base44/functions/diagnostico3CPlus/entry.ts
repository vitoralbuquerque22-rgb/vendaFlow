import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch {}
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const token   = body.token;
  const dominio = body.dominio || 'oficinasmaster'; // mantido para referência/info
  const mode    = body.mode || 'default'; // 'qa' para rodar QA completo
  // API REST sempre em 3c.fluxoti.com — dominio.3c.plus é só painel web/WebSocket
  const BASE    = 'https://3c.fluxoti.com/api/v1';

  // ── Modo QA: testa múltiplos endpoints ────────────────────────────
  if (mode === 'qa') {
    async function hit(label, tok, method, path, bodyStr, isJson) {
      const url = `${BASE}${path}`;
      const h = { 'Authorization': `Bearer ${tok}`, 'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded' };
      const opts = { method, headers: h, signal: AbortSignal.timeout(8000) };
      if (bodyStr !== null) opts.body = bodyStr;
      try {
        const res = await fetch(url, opts);
        let d = {}; try { d = await res.json(); } catch {}
        return { label, status: res.status, d };
      } catch (e) { return { label, status: 0, d: { error: e.message } }; }
    }

    const TOKEN_J = body.token_juliano || token;
    const TOKEN_G = body.token_gestor  || token;
    const CAMP    = body.campanha_id   || 264353;

    const r = [];
    r.push(await hit('T1: GET /agent/campaigns (Juliano)',     TOKEN_J, 'GET',  '/agent/campaigns', null, false));
    r.push(await hit('T2: GET /campaigns/agent/loggedCampaign',TOKEN_J, 'GET',  `/campaigns/agent/loggedCampaign?api_token=${TOKEN_J}`, null, false));
    r.push(await hit('T3: POST /agent/connect (Juliano)',      TOKEN_J, 'POST', '/agent/connect', '', false));
    r.push(await hit('T4: POST /agent/login 264353',           TOKEN_J, 'POST', '/agent/login', JSON.stringify({campaign: CAMP}), true));
    r.push(await hit('T5: POST /agent/manual_call/enter',      TOKEN_J, 'POST', '/agent/manual_call/enter', '', false));
    r.push(await hit('T6: POST /agent/manual_call/dial',       TOKEN_J, 'POST', '/agent/manual_call/dial', 'phone=11999999999', false));
    r.push(await hit('T7: POST /agent/manual_call_acw/enter',  TOKEN_J, 'POST', '/agent/manual_call_acw/enter', '', false));
    r.push(await hit('T8: POST /agent/manual_call_acw/dial',   TOKEN_J, 'POST', '/agent/manual_call_acw/dial', 'phone=11999999999', false));
    r.push(await hit('T9: POST /agent/manual_call/exit',       TOKEN_J, 'POST', '/agent/manual_call/exit', '', false));
    r.push(await hit('T10: GET /agent/campaigns (Gestor)',     TOKEN_G, 'GET',  '/agent/campaigns', null, false));
    r.push(await hit('T11: POST /agent/connect (Gestor)',      TOKEN_G, 'POST', '/agent/connect', '', false));

    const summary = r.map(x => ({
      test: x.label,
      status: x.status,
      ok: x.status >= 200 && x.status < 300,
      detail: x.d?.detail ?? x.d?.error ?? (x.d?.data ? JSON.stringify(x.d.data).slice(0,150) : JSON.stringify(x.d).slice(0,150)),
      raw: x.d,
    }));

    return Response.json({ summary }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // ── Modo default: diagnóstico original ────────────────────────────
  const resultados = {};

  try {
    const r = await fetch(`${BASE}/filters?api_token=${token}&include=route_groups,routes,teams`);
    const d = await r.json().catch(() => ({}));
    resultados.GET_filters = { status: r.status, routes: d?.routes?.slice(0,3) || [], route_groups: d?.route_groups?.slice(0,3) || [] };
  } catch (e) { resultados.GET_filters = { erro: e.message }; }

  try {
    const payload = {
      name: `[TESTE CRM - DELETAR] ${new Date().toISOString()}`,
      start_time: '08:00', end_time: '18:30',
      qualification_list: 22256, allows_manual: true, is_predictive: false,
      distribution_type: 'teams_and_agents', teams: [13536],
      dialer_settings: { wait_time: 3, call_time: 30, recalls: 3 },
      route_landline_id: 16092, route_mobile_id: 16092,
    };
    const r = await fetch(`${BASE}/campaigns?api_token=${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    resultados.POST_campaigns_completo = { status: r.status, data: d };
  } catch (e) { resultados.POST_campaigns_completo = { erro: e.message }; }

  return Response.json(resultados, { headers: { 'Access-Control-Allow-Origin': '*' } });
});