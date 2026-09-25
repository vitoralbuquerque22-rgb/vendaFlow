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

const LOCK_TIMEOUT_MINUTOS = 15;
const INTERVALO_MINIMO_MINUTOS = 30;

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

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    if (!body.empresaId || !body.lead_id) {
      return Response.json({ error: 'empresaId e lead_id são obrigatórios' }, { status: 400 });
    }

    const agora = new Date();

    // ── 1. Buscar Lead via Lead.get (corrige 404) ────────────────────────────
    let lead = null;
    try {
      lead = await base44.asServiceRole.entities.Lead.get(body.lead_id);
    } catch (e) {
      console.warn('[iniciarLigacao3CPlus] Lead.get falhou:', e.message);
    }
    if (!lead || lead.empresaId !== body.empresaId) {
      return Response.json({ error: 'Lead não encontrado', lead_id: body.lead_id }, { status: 404 });
    }

    // ── 2. Regras de negócio ─────────────────────────────────────────────────

    // 2a. Lead lock
    if (lead.is_locked_for_call) {
      const lockAt = lead.lock_at ? new Date(lead.lock_at) : null;
      const minutosLock = lockAt ? (agora.getTime() - lockAt.getTime()) / 60000 : 999;
      if (minutosLock < LOCK_TIMEOUT_MINUTOS) {
        const isAdmin = user.role === 'admin';
        if (!isAdmin || !body.forcar) {
          return Response.json({
            error: 'Lead bloqueado',
            codigo: 'LEAD_LOCKED',
            agent_lock: lead.lock_agent_email,
            mensagem: `${lead.lock_agent_email} está em ligação com este lead. Aguarde ou peça ao admin para forçar.`,
          }, { status: 409 });
        }
      }
    }

    // 2b. Cadência ativa — power dialer não liga leads em cadência
    if (body.origem === 'power_dialer' && lead.cadencia_id) {
      return Response.json({
        error: 'Lead em cadência ativa',
        codigo: 'LEAD_IN_CADENCE',
        mensagem: 'Power dialer não liga para leads com cadência ativa. Use ligação manual.',
      }, { status: 409 });
    }

    // 2c. Intervalo mínimo (30min) — só power dialer
    if (lead.ultima_ligacao_em && body.origem === 'power_dialer') {
      const minutosDesde = (agora.getTime() - new Date(lead.ultima_ligacao_em).getTime()) / 60000;
      if (minutosDesde < INTERVALO_MINIMO_MINUTOS) {
        return Response.json({
          error: 'Intervalo mínimo não respeitado',
          codigo: 'CALL_TOO_SOON',
          minutos_restantes: Math.ceil(INTERVALO_MINIMO_MINUTOS - minutosDesde),
          mensagem: `Aguarde ${Math.ceil(INTERVALO_MINIMO_MINUTOS - minutosDesde)} minutos para ligar novamente.`,
        }, { status: 429 });
      }
    }

    // ── 3. Buscar integração 3C Plus — sem ativa:true no filter ──────────────
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId: body.empresaId,
      tipo: 'telefonia',
    });

    const integracao = integracoes.find(i =>
      i.configuracao?.fornecedor === '3cplus' &&
      (i.ativa === true || i.ativa === 'true' || i.ativa == null)
    );

    if (!integracao) {
      return Response.json({ error: 'Integração 3C Plus não configurada ou inativa' }, { status: 424 });
    }

    const cfg = integracao.configuracao;

    if (!cfg.dominio) {
      return Response.json({ error: 'Domínio 3C Plus não configurado na integração' }, { status: 424 });
    }

    // ── Token do agente: UserProfile.token_3cplus → mapeamento legado ────────
    const emailLower = (user.email || '').toLowerCase();
    let tokenAgente = null;

    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      tokenAgente = await decryptToken(profiles[0]?.token_3cplus || '') || null;
      if (tokenAgente) console.log('[iniciarLigacao3CPlus] token via UserProfile OK');
    } catch (e) {
      console.warn('[iniciarLigacao3CPlus] erro ao buscar UserProfile:', e.message);
    }

    if (!tokenAgente) {
      const mapeamento = cfg.mapeamento_agentes || {};
      tokenAgente = mapeamento[emailLower] || mapeamento[user.email] || cfg.token_agente || null;
      if (tokenAgente) console.log('[iniciarLigacao3CPlus] token via mapeamento legado');
    }

    if (!tokenAgente) {
      return Response.json({
        error: 'Token do agente não encontrado',
        codigo: 'TOKEN_NOT_FOUND',
        mensagem: `O usuário ${user.email} não possui token 3C Plus configurado. Peça ao admin para adicionar em Integrações → Telefonia → Mapeamento de Agentes.`,
      }, { status: 400 });
    }

    // ── 4. Lock no Lead ANTES de chamar o 3C Plus ────────────────────────────
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      is_locked_for_call: true,
      lock_agent_email: user.email,
      lock_at: agora.toISOString(),
    });

    // ── 5. Criar CallSession com status "iniciando" ───────────────────────────
    const sessao = await base44.asServiceRole.entities.CallSession.create({
      empresaId: body.empresaId,
      lead_id: lead.id,
      lead_nome: lead.nome,
      lead_telefone: lead.telefone,
      sdr_email: user.email,
      campanha_id_3cplus: cfg.campanha_id_padrao || '',
      status: 'iniciando',
      origem: body.origem || 'manual',
      iniciada_em: agora.toISOString(),
      spin_preenchido: false,
      gravacao_processada: false,
    });

    await base44.asServiceRole.entities.Lead.update(lead.id, {
      call_session_id: sessao.id,
    });

    // ── 6. Chamar API do 3C Plus ──────────────────────────────────────────────
    const BASE_URL = cfg.dominio ? `https://${cfg.dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
    const qToken = `?api_token=${encodeURIComponent(tokenAgente)}`;
    const hAgent = { 'Content-Type': 'application/x-www-form-urlencoded', 'accept': 'application/json' };
    const telefone = String(lead.telefone || '').replace(/\D/g, '');

    let chamadaId = null;
    let erroChamada = null;

    try {
      // Entrar em modo manual — 422 = já estava em manual (idempotente, ok)
      // Erros 4xx diferentes de 422 (ex: 401 = token inválido, 403 = offline) bloqueiam a discagem
      const resEnter = await fetch(`${BASE_URL}/agent/manual_call/enter${qToken}`, {
        method: 'POST', headers: hAgent, signal: AbortSignal.timeout(5000),
      }).catch(e => {
        console.warn('[iniciarLigacao3CPlus] manual_call/enter network error:', e.message);
        return null;
      });
      if (resEnter !== null && !resEnter.ok && resEnter.status !== 422) {
        const errEnter = await resEnter.text().catch(() => '');
        console.warn('[iniciarLigacao3CPlus] manual_call/enter falhou:', resEnter.status, errEnter);
        // 401/403 = agente offline ou token inválido → não discar, seria erro silencioso
        if (resEnter.status === 401 || resEnter.status === 403) {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            is_locked_for_call: false, lock_agent_email: null, lock_at: null, call_session_id: null,
          });
          await base44.asServiceRole.entities.CallSession.update(sessao.id, {
            status: 'failed', finalizada_em: new Date().toISOString(),
            erro_mensagem: `Agente offline ou token inválido (HTTP ${resEnter.status})`,
          });
          return Response.json({
            error: 'Agente offline ou token inválido',
            codigo: 'AGENT_OFFLINE',
            detalhe: errEnter.substring(0, 200),
            mensagem: 'Verifique se o softphone está conectado e o token é válido.',
          }, { status: 424, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        // Outros erros (ex: 500 do 3C Plus): logar mas continuar tentando discar
      }

      // Discar
      const resposta3C = await fetch(`${BASE_URL}/agent/manual_call/dial${qToken}`, {
        method: 'POST',
        headers: hAgent,
        body: `phone=${encodeURIComponent(telefone)}`,
        signal: AbortSignal.timeout(10000),
      });

      if (resposta3C.status === 204) {
        // Sucesso assíncrono
      } else if (resposta3C.ok) {
        const dados = await resposta3C.json().catch(() => ({}));
        chamadaId = dados?.data?.call?.id || dados?.call?.id || dados.id || dados.call_id || null;
      } else {
        const err = await resposta3C.text().catch(() => '');
        erroChamada = `3C Plus API error ${resposta3C.status}: ${err}`;
      }
    } catch (e) {
      erroChamada = `Falha ao conectar na API do 3C Plus: ${e.message}`;
    }

    if (erroChamada) {
      console.error('[iniciarLigacao3CPlus] ERRO 3C Plus:', erroChamada);
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        is_locked_for_call: false,
        lock_agent_email: null,
        lock_at: null,
        call_session_id: null,
      });
      await base44.asServiceRole.entities.CallSession.update(sessao.id, {
        status: 'failed',
        finalizada_em: new Date().toISOString(),
        erro_mensagem: erroChamada,
      });
      return Response.json(
        { error: 'Falha ao iniciar ligação no 3C Plus', detalhe: erroChamada },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (chamadaId) {
      await base44.asServiceRole.entities.CallSession.update(sessao.id, {
        chamada_id_3cplus: chamadaId,
        status: 'ringing',
      });
    }

    return Response.json({
      success: true,
      call_session_id: sessao.id,
      chamada_id_3cplus: chamadaId,
      lead_id: lead.id,
      mensagem: 'Ligação iniciada. Aguarde o atendimento.',
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error('[iniciarLigacao3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});