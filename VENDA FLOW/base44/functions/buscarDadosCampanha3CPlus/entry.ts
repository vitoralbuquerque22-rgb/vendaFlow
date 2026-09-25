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

  const [resEquipes, resQualificacoes, resAgentes] = await Promise.all([
    fetch(`${baseUrl}/teams?api_token=${encodeURIComponent(token)}`),
    fetch(`${baseUrl}/qualification_lists?api_token=${encodeURIComponent(token)}`),
    fetch(`${baseUrl}/agents?api_token=${encodeURIComponent(token)}&per_page=100`),
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
      const r = await fetch(`${baseUrl}/campaigns/${campanhaId}/intervals?api_token=${encodeURIComponent(token)}`);
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
});