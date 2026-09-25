import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialGestor, respostaErro3C } from "../../src/telefonia3c.ts";

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    console.warn('[buscarStatusAgentes3CPlus] DEPRECADO — esta função será substituída pelo socket gestor (useMonitoramentoRealTime). Chamada por:', user.email);

    const { empresaId } = await req.json();
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    // Credencial de gestor (token de serviço 3cs_ ou pessoal legado) resolvida pelo módulo central;
    // integração/token ausentes viram Erro3C e são respondidos no catch.
    const cred = await credencialGestor(api, empresaId);
    const campanhaId  = cred.config.campanha_id_padrao;

    if (!campanhaId) {
      return Response.json({ error: 'campanha_id_padrao não configurado' }, { status: 400 });
    }

    const resp = await chamar3C(cred, `/campaigns/${campanhaId}/agents/status`);

    if (!resp.ok) {
      const texto = await resp.text().catch(() => '');
      return Response.json({ error: `3C Plus retornou ${resp.status}`, detalhe: texto }, { status: resp.status });
    }

    const dados = await resp.json();
    return Response.json({ success: true, data: dados.data || [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error('[buscarStatusAgentes3CPlus]', error.message);
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
};
