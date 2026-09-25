import { createClientFromRequest } from "../../src/sdk.ts";
import { credencialGestor, fetch3C, respostaErro3C } from "../../src/telefonia3c.ts";

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

  const { empresaId, campanha_id_3cplus, lista_id_3cplus } = body;

  if (!empresaId || !campanha_id_3cplus) {
    return Response.json({ error: 'empresaId e campanha_id_3cplus são obrigatórios' }, { status: 400 });
  }

  // Credencial de gestor (token de serviço 3cs_ ou pessoal legado) resolvida pelo módulo central.
  // A URL base passa a ser a do domínio da empresa (cred.baseUrl); o token vai no header, não na URL.
  let cred;
  try {
    cred = await credencialGestor(api, empresaId);
  } catch (error) {
    console.error('[buscarMetricasCampanha3CPlus]', error.message);
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
  const baseUrl = cred.baseUrl;

  // Período padrão — últimos 30 dias
  const hoje = new Date();
  const ha30dias = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = ha30dias.toISOString().slice(0, 10);
  const endDate = hoje.toISOString().slice(0, 10);

  const resultados = {};

  // 1. Métricas totais da lista de mailing
  try {
    const r = await fetch3C(
      cred,
      `${baseUrl}/campaigns/${campanha_id_3cplus}/lists/total_metrics?trashed[0]=campaign&start_date=${startDate}&end_date=${endDate}`
    );
    const d = await r.json().catch(() => ({}));
    resultados.total_metrics = r.ok ? (d?.data || d) : null;
  } catch (e) {
    resultados.total_metrics = null;
    console.warn('[buscarMetricasCampanha3CPlus] total_metrics erro:', e.message);
  }

  // 2. Estatísticas conectadas por dia (Swagger: GET /agent/statistics)
  // Exige start_date/end_date no formato Y-m-d H:i:s + campaign_id
  try {
    const r2 = await fetch3C(
      cred,
      `${baseUrl}/agent/statistics?start_date=${encodeURIComponent(startDate + ' 00:00:00')}&end_date=${encodeURIComponent(endDate + ' 23:59:59')}&campaign_id=${campanha_id_3cplus}`
    );
    const d = await r2.json().catch(() => ({}));
    resultados.general_metrics = r2.ok ? (d?.data || d) : null;
  } catch (e) {
    resultados.general_metrics = null;
    console.warn('[buscarMetricasCampanha3CPlus] general_metrics erro:', e.message);
  }

  // 2b. Estatísticas de qualificação por dia (Swagger: GET /qualification/statistics)
  try {
    const r2b = await fetch3C(
      cred,
      `${baseUrl}/qualification/statistics?start_date=${encodeURIComponent(startDate + ' 00:00:00')}&end_date=${encodeURIComponent(endDate + ' 23:59:59')}&campaign_id=${campanha_id_3cplus}`
    );
    const d = await r2b.json().catch(() => ({}));
    resultados.qualification_metrics = r2b.ok ? (d?.data || d) : null;
  } catch (e) {
    resultados.qualification_metrics = null;
    console.warn('[buscarMetricasCampanha3CPlus] qualification_metrics erro:', e.message);
  }

  // 3. Status dos agentes na campanha (ao vivo)
  try {
    const r = await fetch3C(
      cred,
      `${baseUrl}/campaigns/${campanha_id_3cplus}/agents`
    );
    const d = await r.json().catch(() => ({}));
    resultados.agentes = r.ok ? (d?.data || d) : null;
  } catch (e) {
    resultados.agentes = null;
    console.warn('[buscarMetricasCampanha3CPlus] agentes erro:', e.message);
  }

  // 4. Métricas da lista (se lista_id_3cplus fornecido)
  if (lista_id_3cplus) {
    try {
      const r = await fetch3C(
        cred,
        `${baseUrl}/campaigns/${campanha_id_3cplus}/lists/${lista_id_3cplus}/metrics?start_date=${startDate}&end_date=${endDate}`
      );
      const d = await r.json().catch(() => ({}));
      resultados.lista_metrics = r.ok ? (d?.data || d) : null;
    } catch (e) {
      resultados.lista_metrics = null;
      console.warn('[buscarMetricasCampanha3CPlus] lista_metrics erro:', e.message);
    }
  }

  return Response.json({ success: true, data: resultados });
};
