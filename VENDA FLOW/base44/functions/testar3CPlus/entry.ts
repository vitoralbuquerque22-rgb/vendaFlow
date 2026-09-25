import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch {}
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Corpo inválido' }, { status: 400 }); }

  const { token, dominio = 'oficinasmaster', endpoint = '/agent/campaigns', method = 'GET', payload, mode } = body;
  if (!token && mode !== 'qa') return Response.json({ error: 'token e dominio são obrigatórios' }, { status: 400 });

  const BASE = `https://${dominio}.3c.plus/api/v1`;

  // ── Modo QA completo ───────────────────────────────────────────────
  if (mode === 'qa') {
    const TOKEN_J = body.token_juliano;
    const TOKEN_G = body.token_gestor;
    const CAMP    = body.campanha_id || 264353;

    if (!TOKEN_J) return Response.json({ error: 'token_juliano obrigatório no modo qa' }, { status: 400 });

    async function hit(label, tok, meth, path, bodyStr, isJson) {
      const url = `${BASE}${path}`;
      const h = { 'Authorization': `Bearer ${tok}`, 'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded' };
      const opts = { method: meth, headers: h, signal: AbortSignal.timeout(8000) };
      if (bodyStr !== null) opts.body = bodyStr;
      try {
        const res = await fetch(url, opts);
        let d = {}; try { d = await res.json(); } catch {}
        return { label, status: res.status, d };
      } catch (e) { return { label, status: 0, d: { error: e.message } }; }
    }

    const PHONE_TEST = body.phone_test || '44999328592';
    const r = [];

    // ── Fase 1: endpoints de leitura (stateless) ──
    r.push(await hit('T01: GET /agent/campaigns (Juliano)',      TOKEN_J, 'GET',  '/agent/campaigns', null, false));
    r.push(await hit('T02: GET /agent/loggedCampaign',           TOKEN_J, 'GET',  '/agent/loggedCampaign', null, false));

    // ── Fase 2: connect + login em campanha ──
    r.push(await hit('T03: POST /agent/logout (idempotente)',    TOKEN_J, 'POST', '/agent/logout', '{}', true));
    r.push(await hit('T04: POST /agent/connect',                 TOKEN_J, 'POST', '/agent/connect', '', false));
    await new Promise(res => setTimeout(res, 600));
    r.push(await hit('T05: POST /agent/login campanha',          TOKEN_J, 'POST', '/agent/login', `campaign=${CAMP}`, false));
    await new Promise(res => setTimeout(res, 400));
    r.push(await hit('T06: GET /agent/loggedCampaign (pós-login)', TOKEN_J, 'GET', '/agent/loggedCampaign', null, false));

    // ── Fase 3: logout + manual_call/enter + dial ──
    r.push(await hit('T07: POST /agent/logout (pré-manual)',     TOKEN_J, 'POST', '/agent/logout', '{}', true));
    r.push(await hit('T08: POST /agent/connect (pré-manual)',    TOKEN_J, 'POST', '/agent/connect', '', false));
    await new Promise(res => setTimeout(res, 800));
    r.push(await hit('T09: POST /agent/manual_call/enter',       TOKEN_J, 'POST', '/agent/manual_call/enter', '', false));
    r.push(await hit('T10: POST /agent/manual_call/dial',        TOKEN_J, 'POST', '/agent/manual_call/dial', `phone=${PHONE_TEST}`, false));
    await new Promise(res => setTimeout(res, 2000));
    r.push(await hit('T11: POST /agent/manual_call/exit',        TOKEN_J, 'POST', '/agent/manual_call/exit', '', false));

    // ── Fase 4: gestor ──
    if (TOKEN_G) {
      r.push(await hit('T12: GET /agents/status (Gestor)',       TOKEN_G, 'GET',  '/agents/status', null, false));
      r.push(await hit('T13: GET /qualification_lists',          TOKEN_G, 'GET',  '/qualification_lists', null, false));
      r.push(await hit('T14: GET /qualifs list 22257',           TOKEN_G, 'GET',  '/qualification_lists/22257/qualifications', null, false));
      r.push(await hit('T15: GET campaigns/264353/intervals',    TOKEN_G, 'GET',  '/campaigns/264353/intervals', null, false));
    }

    const summary = r.map(x => ({
      test: x.label,
      status: x.status,
      ok: x.status >= 200 && x.status < 300,
      detail: x.d?.detail ?? x.d?.error ?? (x.d?.data ? JSON.stringify(x.d.data).slice(0,200) : JSON.stringify(x.d).slice(0,200)),
    }));

    return Response.json({ summary }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // ── Modo single endpoint ───────────────────────────────────────────
  const isJson = payload && typeof payload === 'object';
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(8000),
  };
  if (payload) opts.body = isJson ? JSON.stringify(payload) : payload;

  const res = await fetch(`${BASE}${endpoint}`, opts);
  let data = {}; try { data = await res.json(); } catch {}

  return Response.json({ success: res.ok, status: res.status, dados: data }, { headers: { 'Access-Control-Allow-Origin': '*' } });
});