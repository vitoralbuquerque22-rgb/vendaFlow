import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialGestor, Erro3C } from "../../src/telefonia3c.ts";

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const api = createClientFromRequest(req);
  const user = await api.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

  if (!body.empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

  // Credencial de gestor (token de serviço 3cs_ ou, na transição, token pessoal legado)
  let cred;
  try {
    cred = await credencialGestor(api, body.empresaId);
  } catch (e) {
    // Mantém o 424 que a função já devolvia para integração/token ausente
    if (e instanceof Erro3C) return Response.json({ error: e.message }, { status: e.status >= 500 ? e.status : 424 });
    throw e;
  }

  try {
    const r = await chamar3C(cred, '/campaigns', { query: { per_page: 100 } });
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
};
