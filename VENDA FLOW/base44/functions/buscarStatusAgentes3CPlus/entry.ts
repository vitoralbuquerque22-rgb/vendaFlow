import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    console.warn('[buscarStatusAgentes3CPlus] DEPRECADO — esta função será substituída pelo socket gestor (useMonitoramentoRealTime). Chamada por:', user.email);

    const { empresaId } = await req.json();
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId, tipo: 'telefonia', ativa: true,
    });
    const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
    if (!integracao) return Response.json({ error: 'Integração 3C Plus não encontrada' }, { status: 404 });

    const cfg = integracao.configuracao;
    const tokenGestor = cfg.token_gestor;
    const campanhaId  = cfg.campanha_id_padrao;

    if (!tokenGestor || !campanhaId) {
      return Response.json({ error: 'token_gestor ou campanha_id_padrao não configurados' }, { status: 400 });
    }

    const dominio = cfg.dominio || '3c.fluxoti';
    const baseUrl = `https://${dominio}.3c.plus/api/v1`;
    const resp = await fetch(
      `${baseUrl}/campaigns/${campanhaId}/agents/status?api_token=${encodeURIComponent(tokenGestor)}`
    );

    if (!resp.ok) {
      const texto = await resp.text().catch(() => '');
      return Response.json({ error: `3C Plus retornou ${resp.status}`, detalhe: texto }, { status: resp.status });
    }

    const dados = await resp.json();
    return Response.json({ success: true, data: dados.data || [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error('[buscarStatusAgentes3CPlus]', error.message);
    return Response.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});