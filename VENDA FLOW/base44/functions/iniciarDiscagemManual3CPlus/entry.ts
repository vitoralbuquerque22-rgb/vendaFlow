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
    const user   = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    if (!body.empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const telefone = String(body.telefone_manual || '').replace(/\D/g, '');
    console.log('[iniciarDiscagemManual3CPlus] telefone recebido:', body.telefone_manual, '| limpo:', telefone, '| length:', telefone.length);

    if (!telefone || telefone.length < 8) {
      return Response.json({
        error: 'Telefone inválido', codigo: 'INVALID_PHONE',
        recebido: body.telefone_manual, limpo: telefone, length: telefone.length,
      }, { status: 400 });
    }

    // ── Buscar integração 3C Plus ────────────────────────────────────────────
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId: body.empresaId,
      tipo: 'telefonia',
    });

    console.log('[iniciarDiscagemManual3CPlus] integrações encontradas:', integracoes.length,
      integracoes.map(i => ({ id: i.id, fornecedor: i.configuracao?.fornecedor, ativa: i.ativa })));

    const integracao = integracoes.find(i =>
      i.configuracao?.fornecedor === '3cplus' &&
      (i.ativa === true || i.ativa === 'true' || i.ativa == null)
    );

    if (!integracao) {
      return Response.json({ error: 'Integração 3C Plus não configurada ou inativa' }, { status: 424 });
    }

    const cfg = integracao.configuracao;

    // ── Token do agente: UserProfile → mapeamento legado ────────────────────
    const emailLower = (user.email || '').toLowerCase();
    let tokenAgente = null;

    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      tokenAgente = await decryptToken(profiles[0]?.token_3cplus || '') || null;
      if (tokenAgente) console.log('[iniciarDiscagemManual3CPlus] token via UserProfile OK');
    } catch (e) {
      console.warn('[iniciarDiscagemManual3CPlus] erro ao buscar UserProfile:', e.message);
    }

    if (!tokenAgente) {
      const mapeamento = cfg.mapeamento_agentes || {};
      tokenAgente = mapeamento[emailLower] || mapeamento[user.email] || cfg.token_agente || null;
      if (tokenAgente) console.log('[iniciarDiscagemManual3CPlus] token via mapeamento legado');
    }

    if (!tokenAgente) {
      return Response.json({
        error: 'Token do agente não encontrado', codigo: 'TOKEN_NOT_FOUND',
        mensagem: `Configure o token 3C Plus em Perfil → Telefonia 3C Plus. Email: ${user.email}`,
      }, { status: 400 });
    }

    const BASE_URL = cfg.dominio ? `https://${cfg.dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
    const qToken   = `?api_token=${encodeURIComponent(tokenAgente)}`;
    const hAgent   = { 'Content-Type': 'application/x-www-form-urlencoded', 'accept': 'application/json' };

    // ── PASSO 1: manual_call/enter (idempotente — 422 = já estava no modo, ignorar) ──
    const resEnter = await fetch(`${BASE_URL}/agent/manual_call/enter${qToken}`, {
      method: 'POST', headers: hAgent, signal: AbortSignal.timeout(8000),
    }).catch(() => ({ status: 0 }));
    const enterOk = resEnter.status === 204 || resEnter.status === 200 || resEnter.status === 422;
    console.log('[iniciarDiscagemManual3CPlus] manual_call/enter status:', resEnter.status, '| ok:', enterOk);
    if (!enterOk) {
      const errEnter = await resEnter.text?.().catch(() => '');
      return Response.json({
        error: 'Falha ao entrar em modo manual',
        statusCode: resEnter.status,
        detalhe: errEnter?.substring(0, 200),
        dica: 'Verifique se o agente está logado no softphone e com ramal ativo.',
      }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // ── PASSO 2: manual_call/dial ──────────────────────────────────────────────
    const resDial = await fetch(`${BASE_URL}/agent/manual_call/dial${qToken}`, {
      method: 'POST',
      headers: hAgent,
      body: `phone=${encodeURIComponent(telefone)}`,
      signal: AbortSignal.timeout(10000),
    });

    console.log('[iniciarDiscagemManual3CPlus] manual_call/dial status:', resDial.status, 'telefone:', telefone);

    // 422 = agente já estava discando (3C Plus aceita a chamada mesmo assim) — tratar como sucesso
    const dialOk = resDial.ok || resDial.status === 204 || resDial.status === 422;
    if (!dialOk) {
      const errBody = await resDial.text().catch(() => '');
      const errJson = (() => { try { return JSON.parse(errBody); } catch { return {}; } })();
      console.error('[iniciarDiscagemManual3CPlus] manual_call/dial falhou:', resDial.status, errBody);

      return Response.json({
        error: 'Falha ao discar',
        detalhe: errJson?.detail || errBody.substring(0, 300),
        statusCode: resDial.status,
        telefone,
        dica: 'Verifique o token e o telefone.',
      }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (resDial.status === 422) {
      console.log('[iniciarDiscagemManual3CPlus] dial retornou 422 — agente já discando, continuando...');
    }

    const dadosDial   = resDial.status !== 204 ? await resDial.json().catch(() => ({})) : {};
    const chamadaId   = dadosDial?.data?.call?.id || dadosDial?.call?.id || null;
    const telephonyId = dadosDial?.data?.agent?.telephony_id || dadosDial?.agent?.telephony_id || null;

    console.log('[iniciarDiscagemManual3CPlus] MANUAL_CALL_STARTED', { sdr: user.email, telefone, chamadaId, telephonyId });

    // ── Criar CallSession ────────────────────────────────────────────────────
    const agora  = new Date();
    const sessao = await base44.asServiceRole.entities.CallSession.create({
      empresaId:           body.empresaId,
      lead_id:             body.lead_id   || '',
      lead_nome:           body.lead_nome || telefone,
      lead_telefone:       telefone,
      sdr_email:           user.email,
      campanha_id_3cplus:  cfg.campanha_id_padrao || '',
      chamada_id_3cplus:   chamadaId    || '',
      telephony_id_3cplus: telephonyId  || '',
      status:              'iniciando',
      origem:              'discador_manual',
      session_scope:       'manual',
      iniciada_em:         agora.toISOString(),
      spin_preenchido:     false,
      gravacao_processada: false,
    });

    // Lock no lead se informado (ligação manual com lead vinculado)
    if (body.lead_id) {
      await base44.asServiceRole.entities.Lead.update(body.lead_id, {
        is_locked_for_call: true,
        lock_agent_email: user.email,
        lock_at: agora.toISOString(),
        call_session_id: sessao.id,
      }).catch(e => console.warn('[iniciarDiscagemManual3CPlus] lock lead falhou:', e.message));
    }

    return Response.json({
      success:           true,
      call_session_id:   sessao.id,
      session_scope:     'manual',
      chamada_id_3cplus: chamadaId,
      telephony_id:      telephonyId,
      lead_telefone:     telefone,
      mensagem:          'Discagem manual iniciada com sucesso.',
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error('[iniciarDiscagemManual3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});