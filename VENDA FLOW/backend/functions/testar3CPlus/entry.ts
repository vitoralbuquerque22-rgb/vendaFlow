import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, type Credencial3C } from "../../src/telefonia3c.ts";

/**
 * Monta uma credencial com um token DIGITADO na tela (ainda não salvo na integração).
 * Token de serviço (3cs_) de agente exige o id 3C do agente (X-Agent-Id) — vem em body.agente_id.
 */
function credencialDigitada(token: string, papel: 'gestor' | 'agente', dominio: string, agenteId?: unknown): Credencial3C {
  const t = String(token || '').trim();
  const origem = t.startsWith('3cs_') ? 'servico' : 'pessoal';
  const id = Number(agenteId);
  return {
    papel,
    dominio,
    baseUrl: `https://${dominio}.3c.plus/api/v1`,
    token: t,
    // X-Agent-Id só faz sentido para token de serviço de agente
    agenteId: origem === 'servico' && papel === 'agente' && id > 0 ? id : undefined,
    origem,
    config: {},
  };
}

/** Converte o corpo "cru" usado nos testes (JSON ou form-urlencoded em string) para as opções do chamar3C. */
function corpoParaOpcoes(bodyStr: string | null, isJson: boolean) {
  if (bodyStr === null || bodyStr === undefined) return {};
  if (isJson) return { json: bodyStr ? JSON.parse(bodyStr) : {} };
  return { form: Object.fromEntries(new URLSearchParams(bodyStr)) };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const api = createClientFromRequest(req);
  let user = null;
  try { user = await api.auth.me(); } catch {}
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Corpo inválido' }, { status: 400 }); }

  const { token, dominio = 'oficinasmaster', endpoint = '/agent/campaigns', method = 'GET', payload, mode } = body;
  if (!token && mode !== 'qa') return Response.json({ error: 'token e dominio são obrigatórios' }, { status: 400 });

  // ── Modo QA completo ───────────────────────────────────────────────
  if (mode === 'qa') {
    const TOKEN_J = body.token_juliano;
    const TOKEN_G = body.token_gestor;
    const CAMP    = body.campanha_id || 264353;

    if (!TOKEN_J) return Response.json({ error: 'token_juliano obrigatório no modo qa' }, { status: 400 });

    // Credenciais montadas com os tokens digitados (agente = "Juliano", gestor opcional)
    const CRED_J = credencialDigitada(TOKEN_J, 'agente', dominio, body.agente_id);
    const CRED_G = TOKEN_G ? credencialDigitada(TOKEN_G, 'gestor', dominio) : null;

    async function hit(label, cred, meth, path, bodyStr, isJson) {
      try {
        const res = await chamar3C(cred, path, { method: meth, ...corpoParaOpcoes(bodyStr, isJson), timeoutMs: 8000 });
        let d = {}; try { d = await res.json(); } catch {}
        return { label, status: res.status, d };
      } catch (e) { return { label, status: 0, d: { error: e.message } }; }
    }

    const PHONE_TEST = body.phone_test || '44999328592';
    const r = [];

    // ── Fase 1: endpoints de leitura (stateless) ──
    r.push(await hit('T01: GET /agent/campaigns (Juliano)',      CRED_J, 'GET',  '/agent/campaigns', null, false));
    r.push(await hit('T02: GET /agent/loggedCampaign',           CRED_J, 'GET',  '/agent/loggedCampaign', null, false));

    // ── Fase 2: connect + login em campanha ──
    r.push(await hit('T03: POST /agent/logout (idempotente)',    CRED_J, 'POST', '/agent/logout', '{}', true));
    r.push(await hit('T04: POST /agent/connect',                 CRED_J, 'POST', '/agent/connect', '', false));
    await new Promise(res => setTimeout(res, 600));
    r.push(await hit('T05: POST /agent/login campanha',          CRED_J, 'POST', '/agent/login', `campaign=${CAMP}`, false));
    await new Promise(res => setTimeout(res, 400));
    r.push(await hit('T06: GET /agent/loggedCampaign (pós-login)', CRED_J, 'GET', '/agent/loggedCampaign', null, false));

    // ── Fase 3: logout + manual_call/enter + dial ──
    r.push(await hit('T07: POST /agent/logout (pré-manual)',     CRED_J, 'POST', '/agent/logout', '{}', true));
    r.push(await hit('T08: POST /agent/connect (pré-manual)',    CRED_J, 'POST', '/agent/connect', '', false));
    await new Promise(res => setTimeout(res, 800));
    r.push(await hit('T09: POST /agent/manual_call/enter',       CRED_J, 'POST', '/agent/manual_call/enter', '', false));
    r.push(await hit('T10: POST /agent/manual_call/dial',        CRED_J, 'POST', '/agent/manual_call/dial', `phone=${PHONE_TEST}`, false));
    await new Promise(res => setTimeout(res, 2000));
    r.push(await hit('T11: POST /agent/manual_call/exit',        CRED_J, 'POST', '/agent/manual_call/exit', '', false));

    // ── Fase 4: gestor ──
    if (TOKEN_G) {
      r.push(await hit('T12: GET /agents/status (Gestor)',       CRED_G, 'GET',  '/agents/status', null, false));
      r.push(await hit('T13: GET /qualification_lists',          CRED_G, 'GET',  '/qualification_lists', null, false));
      r.push(await hit('T14: GET /qualifs list 22257',           CRED_G, 'GET',  '/qualification_lists/22257/qualifications', null, false));
      r.push(await hit('T15: GET campaigns/264353/intervals',    CRED_G, 'GET',  '/campaigns/264353/intervals', null, false));
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
  // Papel informativo: endpoints /agent/* agem como agente; o resto, como gestor
  const papel = body.papel === 'gestor' || body.papel === 'agente'
    ? body.papel
    : (String(endpoint).startsWith('/agent/') ? 'agente' : 'gestor');
  const cred = credencialDigitada(token, papel, dominio, body.agente_id);
  const corpo = !payload ? {} : isJson ? { json: payload } : { form: Object.fromEntries(new URLSearchParams(String(payload))) };

  const res = await chamar3C(cred, endpoint, { method, ...corpo, timeoutMs: 8000 });
  let data = {}; try { data = await res.json(); } catch {}

  return Response.json({ success: res.ok, status: res.status, dados: data }, { headers: { 'Access-Control-Allow-Origin': '*' } });
};
