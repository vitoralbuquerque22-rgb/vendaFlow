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

  const api = createClientFromRequest(req);
  let user = null;
  try { user = await api.auth.me(); } catch {}
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const token   = body.token;
  const dominio = body.dominio || 'oficinasmaster';
  const mode    = body.mode || 'default'; // 'qa' para rodar QA completo
  // API REST em {dominio}.3c.plus (ver docs/TELEFONIA_CONTRATO.md) — a URL base vem da credencial

  // ── Modo QA: testa múltiplos endpoints ────────────────────────────
  if (mode === 'qa') {
    async function hit(label, cred, method, path, bodyStr, isJson) {
      try {
        const res = await chamar3C(cred, path, { method, ...corpoParaOpcoes(bodyStr, isJson), timeoutMs: 8000 });
        let d = {}; try { d = await res.json(); } catch {}
        return { label, status: res.status, d };
      } catch (e) { return { label, status: 0, d: { error: e.message } }; }
    }

    const TOKEN_J = body.token_juliano || token;
    const TOKEN_G = body.token_gestor  || token;
    const CAMP    = body.campanha_id   || 264353;
    // Credenciais montadas com os tokens digitados (agente = "Juliano"; gestor)
    const CRED_J  = credencialDigitada(TOKEN_J, 'agente', dominio, body.agente_id);
    const CRED_G  = credencialDigitada(TOKEN_G, 'gestor', dominio);

    const r = [];
    r.push(await hit('T1: GET /agent/campaigns (Juliano)',     CRED_J, 'GET',  '/agent/campaigns', null, false));
    r.push(await hit('T2: GET /campaigns/agent/loggedCampaign',CRED_J, 'GET',  '/campaigns/agent/loggedCampaign', null, false));
    r.push(await hit('T3: POST /agent/connect (Juliano)',      CRED_J, 'POST', '/agent/connect', '', false));
    r.push(await hit('T4: POST /agent/login 264353',           CRED_J, 'POST', '/agent/login', JSON.stringify({campaign: CAMP}), true));
    r.push(await hit('T5: POST /agent/manual_call/enter',      CRED_J, 'POST', '/agent/manual_call/enter', '', false));
    r.push(await hit('T6: POST /agent/manual_call/dial',       CRED_J, 'POST', '/agent/manual_call/dial', 'phone=11999999999', false));
    r.push(await hit('T7: POST /agent/manual_call_acw/enter',  CRED_J, 'POST', '/agent/manual_call_acw/enter', '', false));
    r.push(await hit('T8: POST /agent/manual_call_acw/dial',   CRED_J, 'POST', '/agent/manual_call_acw/dial', 'phone=11999999999', false));
    r.push(await hit('T9: POST /agent/manual_call/exit',       CRED_J, 'POST', '/agent/manual_call/exit', '', false));
    r.push(await hit('T10: GET /agent/campaigns (Gestor)',     CRED_G, 'GET',  '/agent/campaigns', null, false));
    r.push(await hit('T11: POST /agent/connect (Gestor)',      CRED_G, 'POST', '/agent/connect', '', false));

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
  // Diagnóstico de campanhas usa o token digitado como gestor
  const credDiag = credencialDigitada(token, 'gestor', dominio);

  try {
    const r = await chamar3C(credDiag, '/filters', { query: { include: 'route_groups,routes,teams' } });
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
    const r = await chamar3C(credDiag, '/campaigns', { method: 'POST', json: payload });
    const d = await r.json().catch(() => ({}));
    resultados.POST_campaigns_completo = { status: r.status, data: d };
  } catch (e) { resultados.POST_campaigns_completo = { erro: e.message }; }

  return Response.json(resultados, { headers: { 'Access-Control-Allow-Origin': '*' } });
};
