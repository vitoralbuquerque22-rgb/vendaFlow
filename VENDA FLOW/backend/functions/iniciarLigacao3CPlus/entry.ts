import { createClientFromRequest } from "../../src/sdk.ts";
import { carregarConfig3C, chamar3C, credencialAgente, Erro3C, respostaErro3C } from "../../src/telefonia3c.ts";

const LOCK_TIMEOUT_MINUTOS = 15;
const INTERVALO_MINIMO_MINUTOS = 30;

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
      lead = await api.asServiceRole.entities.Lead.get(body.lead_id);
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

    // ── 3. Integração 3C Plus (existência + domínio) — mantém o 424 de antes ──
    try {
      await carregarConfig3C(api, body.empresaId);
    } catch (e) {
      if (!(e instanceof Erro3C) || e.status >= 500) throw e;
      return Response.json({ error: e.message }, { status: 424 });
    }

    // ── Credencial do agente (usuário logado): token de serviço + X-Agent-Id,
    //    ou token pessoal na transição — resolvido pelo módulo central ────────
    let cred;
    try {
      cred = await credencialAgente(api, body.empresaId, user.email);
      console.log('[iniciarLigacao3CPlus] credencial do agente OK:', cred.origem, '| agente:', cred.agenteId ?? '-');
    } catch (e) {
      if (!(e instanceof Erro3C) || e.status >= 500) throw e;
      return Response.json({
        error: 'Token do agente não encontrado',
        codigo: 'TOKEN_NOT_FOUND',
        mensagem: `${e.message} (usuário ${user.email})`,
      }, { status: 400 });
    }

    const cfg = cred.config;

    // ── 4. Lock no Lead ANTES de chamar o 3C Plus ────────────────────────────
    await api.asServiceRole.entities.Lead.update(lead.id, {
      is_locked_for_call: true,
      lock_agent_email: user.email,
      lock_at: agora.toISOString(),
    });

    // ── 5. Criar CallSession com status "iniciando" ───────────────────────────
    const sessao = await api.asServiceRole.entities.CallSession.create({
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

    await api.asServiceRole.entities.Lead.update(lead.id, {
      call_session_id: sessao.id,
    });

    // ── 6. Chamar API do 3C Plus ──────────────────────────────────────────────
    // Autenticação (Bearer + X-Agent-Id) e URL base ficam a cargo de chamar3C
    const telefone = String(lead.telefone || '').replace(/\D/g, '');

    let chamadaId = null;
    let erroChamada = null;

    try {
      // Entrar em modo manual — 422 = já estava em manual (idempotente, ok)
      // Erros 4xx diferentes de 422 (ex: 401 = token inválido, 403 = offline) bloqueiam a discagem
      const resEnter = await chamar3C(cred, '/agent/manual_call/enter', {
        method: 'POST', form: {}, timeoutMs: 5000,
      }).catch(e => {
        console.warn('[iniciarLigacao3CPlus] manual_call/enter network error:', e.message);
        return null;
      });
      if (resEnter !== null && !resEnter.ok && resEnter.status !== 422) {
        const errEnter = await resEnter.text().catch(() => '');
        console.warn('[iniciarLigacao3CPlus] manual_call/enter falhou:', resEnter.status, errEnter);
        // 401/403 = agente offline ou token inválido → não discar, seria erro silencioso
        if (resEnter.status === 401 || resEnter.status === 403) {
          await api.asServiceRole.entities.Lead.update(lead.id, {
            is_locked_for_call: false, lock_agent_email: null, lock_at: null, call_session_id: null,
          });
          await api.asServiceRole.entities.CallSession.update(sessao.id, {
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
      const resposta3C = await chamar3C(cred, '/agent/manual_call/dial', {
        method: 'POST',
        form: { phone: telefone },
        timeoutMs: 10000,
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
      await api.asServiceRole.entities.Lead.update(lead.id, {
        is_locked_for_call: false,
        lock_agent_email: null,
        lock_at: null,
        call_session_id: null,
      });
      await api.asServiceRole.entities.CallSession.update(sessao.id, {
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
      await api.asServiceRole.entities.CallSession.update(sessao.id, {
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
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
};
