import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64decode(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function decryptToken(value) {
  if (!value) return '';
  if (!value.startsWith('enc:')) return value;
  try {
    const [, ivB64, ctB64] = value.split(':');
    const keyB64 = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (!keyB64) throw new Error('TOKEN_ENCRYPTION_KEY não configurada');
    const raw = b64decode(keyB64);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(ivB64) }, key, b64decode(ctB64));
    return new TextDecoder().decode(pt);
  } catch (e) {
    console.error('[decryptToken] falha ao decriptar token:', e.message);
    return '';
  }
}

/**
 * buscarQualificacoes3CPlus
 *
 * Retorna a lista REAL de qualificações disponíveis para uma campanha do 3C Plus.
 * Fluxo conforme a doc oficial:
 *   1. GET /campaigns/{id} → obtém qualification_list_id da campanha
 *   2. GET /qualification_lists/{id}/qualifications → lista de qualificações
 *
 * Assim o modal de atendimento renderiza exatamente as qualificações que o
 * agente vê no 3C (com id/nome/behavior corretos) — o agente seleciona e
 * enviamos o qualification_id exato na finalização (sem casar por string).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Corpo inválido' }, { status: 400 }); }

    if (!body.empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // Integração 3C Plus
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId: body.empresaId, tipo: 'telefonia',
    });
    const integracao = integracoes.find(i =>
      i.configuracao?.fornecedor === '3cplus' &&
      (i.ativa === true || i.ativa === 'true' || i.ativa == null)
    );
    if (!integracao) return Response.json({ error: 'Integração 3C Plus não encontrada' }, { status: 404 });

    const cfg = integracao.configuracao || {};
    const dominio = String(cfg.dominio || '').trim();
    const BASE_URL = dominio ? `https://${dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';

    // Token do agente (mesma resolução do finalizarLigacao3CPlus)
    let token = null;
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      token = await decryptToken(profiles[0]?.token_3cplus || '') || null;
    } catch (e) {
      console.warn('[buscarQualificacoes3CPlus] erro UserProfile:', e.message);
    }
    if (!token) {
      const mapeamento = cfg.mapeamento_agentes || {};
      token = mapeamento[(user.email || '').toLowerCase()] || mapeamento[user.email] || cfg.token_gestor || null;
    }
    if (!token) return Response.json({ error: 'Token 3C Plus não configurado' }, { status: 400 });

    const qToken = `?api_token=${encodeURIComponent(token)}`;
    const headers = { 'accept': 'application/json' };

    // 1. Descobrir qualification_list_id
    // Prioridade: body → config da integração → campanha → lista padrão da conta
    let qualificationListId = body.qualification_list_id || cfg.qualification_list_id || null;

    // 1a. Tentar pela campanha (algumas campanhas expõem qualification_list_id)
    if (!qualificationListId && body.campaign_id) {
      const rCamp = await fetch(`${BASE_URL}/campaigns/${body.campaign_id}${qToken}`, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
      if (rCamp?.ok) {
        const camp = await rCamp.json().catch(() => ({}));
        qualificationListId = camp?.data?.qualification_list_id || camp?.qualification_list_id || null;
      }
    }

    // 1b. Fallback: a campanha não define uma lista própria (comum no 3C Plus).
    // Buscar as listas da conta e escolher automaticamente:
    //   preferir a lista do CRM (type === 4) → depois "Padrão" → depois a que tiver
    //   mais qualificações. Assim o agente sempre vê as qualificações reais.
    if (!qualificationListId) {
      const rLists = await fetch(`${BASE_URL}/qualification_lists${qToken}`, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
      if (rLists?.ok) {
        const listsData = await rLists.json().catch(() => ({}));
        const lists = (listsData?.data || listsData || []).filter(l => (l.qualification_count ?? 1) > 0);
        if (lists.length > 0) {
          const crmList = lists.find(l => l.type === 4);
          const padraoList = lists.find(l => String(l.name || '').toLowerCase().includes('padr'));
          const maisQualif = [...lists].sort((a, b) => (b.qualification_count || 0) - (a.qualification_count || 0))[0];
          qualificationListId = (crmList || padraoList || maisQualif)?.id || null;
        }
      }
    }

    if (!qualificationListId) {
      return Response.json(
        { error: 'qualification_list_id não encontrado', mensagem: 'Nenhuma lista de qualificação encontrada na conta 3C Plus.' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 2. Buscar qualificações da lista
    const rQualif = await fetch(
      `${BASE_URL}/qualification_lists/${qualificationListId}/qualifications${qToken}`,
      { headers, signal: AbortSignal.timeout(6000) }
    );
    if (!rQualif.ok) {
      return Response.json({ error: 'Erro ao buscar qualificações', status: rQualif.status }, { status: rQualif.status, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const data = await rQualif.json().catch(() => ({}));
    const qualificacoes = (data?.data || []).map(q => ({
      id: q.id,
      nome: q.name,
      behavior: q.behavior,
      comportamento: q.readable_behavior_text || q.behavior_text || '',
      is_conversion: !!q.is_conversion,
      is_dmc: !!q.is_dmc,
      cor: q.color || null,
    }));

    return Response.json(
      { success: true, qualification_list_id: qualificationListId, qualificacoes },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[buscarQualificacoes3CPlus]', error.message);
    return Response.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});