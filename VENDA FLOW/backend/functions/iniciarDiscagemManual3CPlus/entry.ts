import { createClientFromRequest } from "../../src/sdk.ts";
import { carregarConfig3C, chamar3C, credencialAgente, Erro3C, respostaErro3C } from "../../src/telefonia3c.ts";

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
    const user   = await api.auth.me();

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

    // ── Integração 3C Plus (existência + domínio) — mantém o 424 de antes ────
    try {
      await carregarConfig3C(api, body.empresaId);
    } catch (e) {
      if (!(e instanceof Erro3C) || e.status >= 500) throw e;
      return Response.json({ error: 'Integração 3C Plus não configurada ou inativa', detalhe: e.message }, { status: 424 });
    }

    // ── Credencial do agente (usuário logado): token de serviço + X-Agent-Id,
    //    ou token pessoal na transição — resolvido pelo módulo central ────────
    let cred;
    try {
      cred = await credencialAgente(api, body.empresaId, user.email);
      console.log('[iniciarDiscagemManual3CPlus] credencial do agente OK:', cred.origem, '| agente:', cred.agenteId ?? '-');
    } catch (e) {
      if (!(e instanceof Erro3C) || e.status >= 500) throw e;
      return Response.json({
        error: 'Token do agente não encontrado', codigo: 'TOKEN_NOT_FOUND',
        mensagem: `${e.message} Email: ${user.email}`,
      }, { status: 400 });
    }

    const cfg = cred.config;

    // ── PASSO 1: manual_call/enter (idempotente — 422 = já estava no modo, ignorar) ──
    const resEnter: any = await chamar3C(cred, '/agent/manual_call/enter', {
      method: 'POST', form: {}, timeoutMs: 8000,
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
    const resDial = await chamar3C(cred, '/agent/manual_call/dial', {
      method: 'POST',
      form: { phone: telefone },
      timeoutMs: 10000,
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
    const sessao = await api.asServiceRole.entities.CallSession.create({
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
      await api.asServiceRole.entities.Lead.update(body.lead_id, {
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
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
};
