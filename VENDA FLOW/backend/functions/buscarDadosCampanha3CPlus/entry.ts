import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialGestor, respostaErro3C } from "../../src/telefonia3c.ts";

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

  // Credencial de gestor (token de serviço 3cs_ ou pessoal legado) resolvida pelo módulo central
  let cred;
  try {
    cred = await credencialGestor(api, body.empresaId);
  } catch (error) {
    console.error('[buscarDadosCampanha3CPlus]', error.message);
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
  const cfg = cred.config;

  const [resEquipes, resQualificacoes, resAgentes] = await Promise.all([
    chamar3C(cred, '/teams'),
    chamar3C(cred, '/qualification_lists'),
    chamar3C(cred, '/agents', { query: { per_page: 100 } }),
  ]);

  const dadosEquipes        = await resEquipes.json().catch(() => ({}));
  const dadosQualificacoes  = await resQualificacoes.json().catch(() => ({}));
  const dadosAgentes        = await resAgentes.json().catch(() => ({}));

  const equipes = (dadosEquipes?.data || dadosEquipes || []).map(e => ({
    id: e.id, nome: e.name, total_agentes: e.team_count || 0,
  }));

  const qualificacoes = (dadosQualificacoes?.data || dadosQualificacoes || []).map(q => ({
    id: q.id, nome: q.name, tipo: q.type, total: q.qualification_count || 0,
  }));

  let intervalos = [];
  try {
    // Busca intervalos da campanha padrão configurada
    const campanhaId = cfg.campanha_id_padrao;
    if (campanhaId) {
      const r = await chamar3C(cred, `/campaigns/${campanhaId}/intervals`);
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        intervalos = (d?.data || d || []).map(i => ({ id: i.id, nome: i.name }));
      }
    }
  } catch (e) { console.warn('[buscarDadosCampanha3CPlus] intervals erro:', e.message); }

  // Agent.active é boolean (true = ativo) conforme model oficial
  const agentes = (dadosAgentes?.data || dadosAgentes || [])
    .filter(a => a.active === true || a.active === 1)
    .map(a => ({
      id: a.id,
      nome: a.name,
      ramal: typeof a.extension === 'object'
        ? (a.extension?.extension_number || a.extension?.id || '')
        : String(a.extension || ''),
    }));

  return Response.json(
    { equipes, qualificacoes, intervalos, agentes },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
};
