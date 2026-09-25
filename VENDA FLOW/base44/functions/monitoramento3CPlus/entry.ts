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

  const dominio = cfg.dominio || '3c.fluxoti';
  const baseUrl = `https://${dominio}.3c.plus/api/v1`;
  const apiToken = `api_token=${encodeURIComponent(token)}`;

  const STATUS_MAP = {
    0:  { label: 'Offline',     cor: 'slate',   icone: '⚫' },
    1:  { label: 'Disponível',  cor: 'emerald', icone: '🟢' },
    2:  { label: 'Em ligação',  cor: 'sky',     icone: '📞' },
    3:  { label: 'Pós-atend.', cor: 'amber',   icone: '⏳' },
    4:  { label: 'Manual',      cor: 'violet',  icone: '📱' },
    5:  { label: 'Em ligação',  cor: 'sky',     icone: '📞' },
    6:  { label: 'Em pausa',    cor: 'orange',  icone: '⏸️' },
    21: { label: 'Pós-manual', cor: 'amber',   icone: '⏳' },
  };

  try {
    const rCamp = await fetch(`${baseUrl}/campaigns?${apiToken}&per_page=100`, { signal: AbortSignal.timeout(10000) });
    if (!rCamp.ok) return Response.json({ error: 'Erro ao buscar campanhas' }, { status: 502 });
    const dCamp = await rCamp.json().catch(() => ({}));
    const campanhas = (dCamp?.data || []).filter(c => !c.paused);

    const resultados = await Promise.allSettled(
      campanhas.map(c =>
        fetch(`${baseUrl}/campaigns/${c.id}/agents/status?${apiToken}`, { signal: AbortSignal.timeout(8000) })
          .then(r => r.json())
          .then(d => ({ campanhaId: c.id, campanhaNome: c.name, agentes: d?.data || [] }))
      )
    );

    const agentesMap = new Map();
    for (const res of resultados) {
      if (res.status !== 'fulfilled') continue;
      const { campanhaId, campanhaNome, agentes } = res.value;
      for (const a of agentes) {
        const existente = agentesMap.get(a.id);
        if (!existente || a.status > existente.status) {
          const info = STATUS_MAP[a.status] || { label: `Status ${a.status}`, cor: 'slate', icone: '❓' };
          const duracao = a.status_start_time ? Math.floor(Date.now() / 1000 - a.status_start_time) : 0;
          const ramal = typeof a.extension === 'object'
            ? (a.extension?.extension_number || a.extension?.id || '')
            : String(a.extension || '');
          agentesMap.set(a.id, {
            id: a.id, nome: a.name, ramal,
            status: a.status, status_label: info.label, status_cor: info.cor, status_icone: info.icone,
            campanha_id: a.logged_campaign || campanhaId, campanha_nome: campanhaNome,
            duracao,
            em_ligacao: a.status === 2 || a.status === 5 || a.status === 4,
            em_manual: a.status === 4,
            em_pausa: a.status === 6,
            disponivel: a.status === 1,
          });
        }
      }
    }

    const agentesFormatados = Array.from(agentesMap.values()).sort((a, b) => b.status - a.status);
    const metricas = {
      em_ligacao: agentesFormatados.filter(a => a.em_ligacao).length,
      disponiveis: agentesFormatados.filter(a => a.disponivel).length,
      em_pausa: agentesFormatados.filter(a => a.em_pausa).length,
      total: agentesFormatados.length,
      offline: agentesFormatados.filter(a => a.status === 0).length,
    };
    const campanhasLista = campanhas.map(c => ({ id: c.id, nome: c.name }));

    return Response.json(
      { agentes: agentesFormatados, metricas, campanhas: campanhasLista },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});