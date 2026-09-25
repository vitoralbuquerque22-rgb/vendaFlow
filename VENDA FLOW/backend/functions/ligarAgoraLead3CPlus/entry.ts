import { createClientFromRequest } from "../../src/sdk.ts";
import {
  carregarConfig3C, chamar3C, credencialAgente, credencialGestor, Erro3C, respostaErro3C, type Credencial3C,
} from "../../src/telefonia3c.ts";

const LOCK_TIMEOUT_MIN = 15;

// POST form-urlencoded no 3C Plus com a credencial informada (gestor ou agente).
// URL base e autenticação (Bearer + X-Agent-Id) vêm de chamar3C.
async function post3C(cred: Credencial3C, path: string, form: Record<string, string>, timeoutMs = 10000) {
  const res = await chamar3C(cred, path, { method: 'POST', form, timeoutMs });
  let json: any = {};
  try { json = await res.json(); } catch { /* sem body */ }
  return { status: res.status, ok: res.ok || res.status === 204, json };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }

  if (req.method !== 'POST')
    return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const CORS = { 'Access-Control-Allow-Origin': '*' };

  try {
    const api = createClientFromRequest(req);
    const user   = await api.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401, headers: CORS });

    let body;
    try { body = await req.json(); }
    catch { return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400, headers: CORS }); }

    const { empresaId, lead_id, forcar_metodo } = body;

    if (!empresaId || !lead_id)
      return Response.json({ error: 'empresaId e lead_id são obrigatórios' }, { status: 400, headers: CORS });

    const agora = new Date();

    // Buscar Lead — Lead.get() primeiro, fallback para filter se falhar
    let lead = null;
    try { lead = await api.asServiceRole.entities.Lead.get(lead_id); }
    catch (e) { console.warn('[ligarAgoraLead] Lead.get falhou:', e.message); }

    if (!lead) {
      try {
        const todos = await api.asServiceRole.entities.Lead.filter({ empresaId });
        lead = todos.find(l => l.id === lead_id) ?? null;
      } catch (e) { console.warn('[ligarAgoraLead] fallback filter falhou:', e.message); }
    }

    if (!lead) return Response.json({ error: 'Lead não encontrado', lead_id }, { status: 404, headers: CORS });

    // Verificar lock
    if (lead.is_locked_for_call) {
      const lockAt  = lead.lock_at ? new Date(lead.lock_at) : null;
      const minLock = lockAt ? (agora.getTime() - lockAt.getTime()) / 60000 : 999;
      if (minLock < LOCK_TIMEOUT_MIN)
        return Response.json({
          error: 'Lead bloqueado', codigo: 'LEAD_LOCKED',
          agent_lock: lead.lock_agent_email,
          mensagem: `${lead.lock_agent_email} já está em ligação com este lead.`,
        }, { status: 409, headers: CORS });
    }

    // Idempotência: evitar dupla ligação iniciada em < 30s pelo mesmo agente para o mesmo lead
    const sessoesRecentes = await api.asServiceRole.entities.CallSession.filter({
      lead_id: lead.id,
      sdr_email: user.email,
      status: 'iniciando',
    });
    const IDEMPOTENCY_WINDOW_MS = 30_000;
    const sessaoIdempotente = sessoesRecentes.find(s => {
      const criada = s.iniciada_em ? new Date(s.iniciada_em).getTime() : 0;
      return (agora.getTime() - criada) < IDEMPOTENCY_WINDOW_MS;
    });
    if (sessaoIdempotente) {
      console.warn('[ligarAgoraLead] Sessão duplicada detectada — retornando sessão existente', sessaoIdempotente.id);
      return Response.json({
        success: true,
        call_session_id: sessaoIdempotente.id,
        chamada_id_3cplus: sessaoIdempotente.chamada_id_3cplus || null,
        lead_id: lead.id,
        metodo_usado: 'idempotent_return',
        mensagem: 'Ligação já em andamento — retornando sessão existente.',
      }, { headers: CORS });
    }

    // Integração 3C Plus (existência + domínio) — mantém o 424 de antes
    try {
      await carregarConfig3C(api, empresaId);
    } catch (e) {
      if (!(e instanceof Erro3C) || e.status >= 500) throw e;
      return Response.json({ error: 'Integração 3C Plus não configurada', detalhe: e.message }, { status: 424, headers: CORS });
    }

    // Credencial do agente (usuário logado) — token de serviço + X-Agent-Id,
    // ou token pessoal na transição (resolvido pelo módulo central)
    let credAgente: Credencial3C;
    try {
      credAgente = await credencialAgente(api, empresaId, user.email);
    } catch (e) {
      if (!(e instanceof Erro3C) || e.status >= 500) throw e;
      return Response.json({
        error: 'Token do agente não encontrado', codigo: 'TOKEN_NOT_FOUND',
        mensagem: `${e.message} Email: ${user.email}`,
      }, { status: 400, headers: CORS });
    }
    const cfg = credAgente.config;

    // Ramal do agente (necessário para o click2call)
    let ramalAgente = null;
    try {
      const profiles = await api.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      ramalAgente = String(profiles[0]?.ramal_3cplus || '').trim() || null;
    } catch (e) { console.warn('[ligarAgoraLead] UserProfile erro:', e.message); }

    const telefone = String(lead.telefone || '').replace(/\D/g, '');
    if (telefone.length < 8)
      return Response.json({ error: 'Telefone do lead inválido', telefone_raw: lead.telefone },
        { status: 400, headers: CORS });

    // Lock do lead
    await api.asServiceRole.entities.Lead.update(lead.id, {
      is_locked_for_call: true, lock_agent_email: user.email, lock_at: agora.toISOString(),
    });

    // Criar CallSession
    const sessao = await api.asServiceRole.entities.CallSession.create({
      empresaId, lead_id: lead.id, lead_nome: lead.nome || '',
      lead_telefone: telefone, sdr_email: user.email,
      campanha_id_3cplus: String(cfg.campanha_id_padrao || ''),
      status: 'iniciando', origem: 'manual', session_scope: 'lead',
      iniciada_em: agora.toISOString(), spin_preenchido: false, gravacao_processada: false,
    });

    await api.asServiceRole.entities.Lead.update(lead.id, { call_session_id: sessao.id });

    let chamadaId = null, erroChamada = null, metodoUsado = '';

    const podeClick = !forcar_metodo || forcar_metodo === 'click2call';

    // Credencial de gestor para o click2call — opcional (sem ela, vai direto para enter+dial)
    const credGestor = (podeClick && ramalAgente)
      ? await credencialGestor(api, empresaId).catch((e) => {
          console.warn('[ligarAgoraLead] token de gestor indisponível — click2call ignorado:', e.message);
          return null;
        })
      : null;

    // MÉTODO A: click2call (se tiver token gestor + ramal)
    if (podeClick && ramalAgente && credGestor) {
      metodoUsado = 'click2call';
      const r = await post3C(credGestor, '/click2call', {
        extension: String(parseInt(ramalAgente, 10)),
        phone: String(parseInt(telefone, 10)),
      });

      if (r.ok) {
        chamadaId = r.json?.data?.call?.id || r.json?.data?.id || r.json?.id || null;
      } else if (r.status === 422) {
        console.warn('[ligarAgoraLead] click2call 422 — fallback enter+dial');
        metodoUsado = 'click2call_fallback_enter_dial';
      } else {
        erroChamada = `click2call falhou: ${r.json?.detail || r.json?.message || r.status}`;
      }
    }

    // MÉTODO B: enter+dial (principal ou fallback)
    if (!chamadaId && !erroChamada) {
      if (!metodoUsado) metodoUsado = 'enter_dial';

      const rEnter = await post3C(credAgente, '/agent/manual_call/enter', {}, 8000);
      const enterOk = rEnter.status === 204 || rEnter.status === 200 || rEnter.status === 422;

      if (!enterOk) {
        erroChamada = `manual_call/enter falhou (${rEnter.status})`;
      } else {
        const rDial = await post3C(credAgente, '/agent/manual_call/dial', {
          phone: String(parseInt(telefone, 10)),
        });

        if (rDial.ok) {
          chamadaId = rDial.json?.data?.call?.id || rDial.json?.data?.id || rDial.json?.id || null;
        } else {
          erroChamada = `manual_call/dial falhou: ${rDial.json?.detail || rDial.json?.message || rDial.status}`;
        }
      }
    }

    // Falha: reverter
    if (erroChamada) {
      await api.asServiceRole.entities.Lead.update(lead.id, {
        is_locked_for_call: false, lock_agent_email: null, lock_at: null, call_session_id: null,
      });
      await api.asServiceRole.entities.CallSession.update(sessao.id, {
        status: 'failed', finalizada_em: new Date().toISOString(), erro_mensagem: erroChamada,
      });
      return Response.json({
        error: 'Falha ao iniciar ligação no 3C Plus', codigo: 'API_3C_ERROR',
        detalhe_3c: erroChamada, metodo_tentado: metodoUsado,
      }, { status: 502, headers: CORS });
    }

    if (chamadaId)
      await api.asServiceRole.entities.CallSession.update(sessao.id, {
        chamada_id_3cplus: chamadaId, status: 'ringing',
      });

    return Response.json({
      success: true, call_session_id: sessao.id, chamada_id_3cplus: chamadaId,
      lead_id: lead.id, metodo_usado: metodoUsado,
      mensagem: 'Ligação iniciada. Aguarde o atendimento.',
    }, { headers: CORS });

  } catch (error) {
    console.error('[ligarAgoraLead]', error.message);
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
};
