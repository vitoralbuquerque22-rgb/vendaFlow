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

const LOCK_TIMEOUT_MIN = 15;
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded', 'accept': 'application/json' };

function qToken(token) {
  return `?api_token=${encodeURIComponent(token)}`;
}

function getBase(dominio) {
  return dominio ? `https://${dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
}

async function post3C(path, token, formBody, dominio, timeoutMs = 10000) {
  const url = `${getBase(dominio)}${path}${qToken(token)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: formBody,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let json = {};
  try { json = await res.json(); } catch { /* sem body */ }
  return { status: res.status, ok: res.ok || res.status === 204, json };
}

Deno.serve(async (req) => {
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
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
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
    try { lead = await base44.asServiceRole.entities.Lead.get(lead_id); }
    catch (e) { console.warn('[ligarAgoraLead] Lead.get falhou:', e.message); }

    if (!lead) {
      try {
        const todos = await base44.asServiceRole.entities.Lead.filter({ empresaId });
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
    const sessoesRecentes = await base44.asServiceRole.entities.CallSession.filter({
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

    // Buscar integração — sem ativa:true no filter (pode ser string no Base44)
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId, tipo: 'telefonia',
    });
    const integracao = integracoes.find(i =>
      i.configuracao?.fornecedor === '3cplus' &&
      (i.ativa === true || i.ativa === 'true' || i.ativa == null)
    );

    if (!integracao)
      return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424, headers: CORS });

    const cfg         = integracao.configuracao;
    const dominio     = String(cfg.dominio || '').trim();
    const tokenGestor = String(cfg.token_gestor || '').trim();

    // Token e ramal do agente — UserProfile → mapeamento legado
    const emailNorm = (user.email || '').toLowerCase();
    let tokenAgente = null, ramalAgente = null;

    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      const profile  = profiles[0] ?? null;
      if (profile) {
        tokenAgente = await decryptToken(profile.token_3cplus || '') || null;
        ramalAgente = String(profile.ramal_3cplus || '').trim() || null;
      }
    } catch (e) { console.warn('[ligarAgoraLead] UserProfile erro:', e.message); }

    if (!tokenAgente) {
      const mapeamento = cfg.mapeamento_agentes || {};
      tokenAgente = mapeamento[emailNorm] || mapeamento[user.email] || String(cfg.token_agente || '').trim() || null;
    }

    if (!tokenAgente)
      return Response.json({
        error: 'Token do agente não encontrado', codigo: 'TOKEN_NOT_FOUND',
        mensagem: `Configure token 3C Plus em Perfil → Telefonia. Email: ${user.email}`,
      }, { status: 400, headers: CORS });

    const telefone = String(lead.telefone || '').replace(/\D/g, '');
    if (telefone.length < 8)
      return Response.json({ error: 'Telefone do lead inválido', telefone_raw: lead.telefone },
        { status: 400, headers: CORS });

    // Lock do lead
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      is_locked_for_call: true, lock_agent_email: user.email, lock_at: agora.toISOString(),
    });

    // Criar CallSession
    const sessao = await base44.asServiceRole.entities.CallSession.create({
      empresaId, lead_id: lead.id, lead_nome: lead.nome || '',
      lead_telefone: telefone, sdr_email: user.email,
      campanha_id_3cplus: String(cfg.campanha_id_padrao || ''),
      status: 'iniciando', origem: 'manual', session_scope: 'lead',
      iniciada_em: agora.toISOString(), spin_preenchido: false, gravacao_processada: false,
    });

    await base44.asServiceRole.entities.Lead.update(lead.id, { call_session_id: sessao.id });

    let chamadaId = null, erroChamada = null, metodoUsado = '';

    const podeClick = !forcar_metodo || forcar_metodo === 'click2call';

    // MÉTODO A: click2call (se tiver token gestor + ramal)
    if (podeClick && ramalAgente && tokenGestor) {
      metodoUsado = 'click2call';
      const r = await post3C('/click2call', tokenGestor,
        `extension=${parseInt(ramalAgente, 10)}&phone=${parseInt(telefone, 10)}`, dominio);

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

      const rEnter = await post3C('/agent/manual_call/enter', tokenAgente, '', dominio, 8000);
      const enterOk = rEnter.status === 204 || rEnter.status === 200 || rEnter.status === 422;

      if (!enterOk) {
        erroChamada = `manual_call/enter falhou (${rEnter.status})`;
      } else {
        const rDial = await post3C('/agent/manual_call/dial', tokenAgente,
          `phone=${parseInt(telefone, 10)}`, dominio);

        if (rDial.ok) {
          chamadaId = rDial.json?.data?.call?.id || rDial.json?.data?.id || rDial.json?.id || null;
        } else {
          erroChamada = `manual_call/dial falhou: ${rDial.json?.detail || rDial.json?.message || rDial.status}`;
        }
      }
    }

    // Falha: reverter
    if (erroChamada) {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        is_locked_for_call: false, lock_agent_email: null, lock_at: null, call_session_id: null,
      });
      await base44.asServiceRole.entities.CallSession.update(sessao.id, {
        status: 'failed', finalizada_em: new Date().toISOString(), erro_mensagem: erroChamada,
      });
      return Response.json({
        error: 'Falha ao iniciar ligação no 3C Plus', codigo: 'API_3C_ERROR',
        detalhe_3c: erroChamada, metodo_tentado: metodoUsado,
      }, { status: 502, headers: CORS });
    }

    if (chamadaId)
      await base44.asServiceRole.entities.CallSession.update(sessao.id, {
        chamada_id_3cplus: chamadaId, status: 'ringing',
      });

    return Response.json({
      success: true, call_session_id: sessao.id, chamada_id_3cplus: chamadaId,
      lead_id: lead.id, metodo_usado: metodoUsado,
      mensagem: 'Ligação iniciada. Aguarde o atendimento.',
    }, { headers: CORS });

  } catch (error) {
    console.error('[ligarAgoraLead]', error.message);
    return Response.json({ error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});