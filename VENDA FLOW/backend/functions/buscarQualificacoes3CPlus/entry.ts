import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialAgente, credencialGestor, Erro3C, respostaErro3C } from "../../src/telefonia3c.ts";

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
export default async (req) => {
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
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Corpo inválido' }, { status: 400 }); }

    if (!body.empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // Credencial do agente do usuário logado (token de serviço + X-Agent-Id, ou token pessoal
    // na transição). Como antes, se o agente não tiver credencial, cai no token de gestor.
    let cred;
    try {
      cred = await credencialAgente(api, body.empresaId, user.email);
    } catch (e) {
      if (!(e instanceof Erro3C)) throw e;
      console.warn('[buscarQualificacoes3CPlus] sem credencial de agente, usando gestor:', e.message);
      cred = await credencialGestor(api, body.empresaId);
    }
    const cfg = cred.config;

    // 1. Descobrir qualification_list_id
    // Prioridade: body → config da integração → campanha → lista padrão da conta
    let qualificationListId = body.qualification_list_id || cfg.qualification_list_id || null;

    // 1a. Tentar pela campanha (algumas campanhas expõem qualification_list_id)
    if (!qualificationListId && body.campaign_id) {
      const rCamp = await chamar3C(cred, `/campaigns/${body.campaign_id}`, { timeoutMs: 6000 }).catch(() => null);
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
      const rLists = await chamar3C(cred, '/qualification_lists', { timeoutMs: 6000 }).catch(() => null);
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
    const rQualif = await chamar3C(cred, `/qualification_lists/${qualificationListId}/qualifications`, { timeoutMs: 6000 });
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
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
};
