import { useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useRamalStatus } from '@/hooks/useRamalStatus';
import {
  LOGIN_STATUS,
  COMMANDS,
  TIMEOUTS,
  SOCKET_EVENTS,
} from './TELEFONIA_ENGINE';

export function useTelefoniaActions({ empresaId, marcarLoginPending, socketRef }) {
  const loginEmAndamentoRef = useRef(false);
  const logoutEmAndamentoRef = useRef(false);

  const { aguardarRamalRegistrado } = useRamalStatus();

  // Timeouts por estado (facilita depurar produção)
  const RAMAL_TIMEOUT_MS = 8000;
  const SOCKET_CONFIRM_TIMEOUT_MS = 4000;

  const invocar = useCallback(async (comando, params = {}, signal) => {
    const resp = await base44.functions.invoke('executarComando3CPlus', {
      empresaId,
      comando,
      ...params,
    });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (resp?.error) throw new Error(resp.error);
    return resp;
  }, [empresaId]);

  // Aguarda confirmação do login por evento de socket. Dependendo do mode do login
  // o 3C emite agent-is-idle (dialer) OU agent-entered-manual (manual) — aceitamos ambos.
  // agent-login-failed = falha real. Timeout = otimista (ramal ok + 204 já aceitos).
  const aguardarConfirmacaoSocket = useCallback((timeoutMs) => {
    const SUCCESS_EVENTS = ['agent-is-idle', 'agent-is-free', 'agent-entered-manual', 'agent-entered-manual-mode'];
    return new Promise((resolve) => {
      const socket = socketRef?.current;
      let done = false;
      const handlers = [];
      const finish = (result) => {
        if (done) return;
        done = true;
        if (socket) {
          SUCCESS_EVENTS.forEach((ev, i) => { try { socket.off(ev, handlers[i]); } catch {} });
          try { socket.off(SOCKET_EVENTS.AGENT_LOGIN_FAILED, onFailed); } catch {}
        }
        clearTimeout(timer);
        resolve(result);
      };
      const onFailed = () => finish({ ok: false, reason: 'agent-login-failed' });
      if (socket) {
        SUCCESS_EVENTS.forEach((ev) => {
          const h = () => finish({ ok: true, via: ev });
          handlers.push(h);
          socket.on(ev, h);
        });
        socket.on(SOCKET_EVENTS.AGENT_LOGIN_FAILED, onFailed);
      }
      const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    });
  }, [socketRef]);

  // ── Login na campanha (máquina de estados orientada a eventos) ──
  // SET_AGENT → aguarda ramal (extensão) → connect → login → aguarda agent-is-idle.
  // Ordem correta da doc oficial 3C: o ramal WebRTC precisa estar registrado ANTES
  // do login, senão o 3C emite agent-login-failed.
  const loginCampanha = useCallback(async (campanhaId, opts = {}) => {
    const { token, dominio } = opts;
    if (!empresaId || !campanhaId) throw new Error('empresaId e campanhaId são obrigatórios');
    if (loginEmAndamentoRef.current) return { status: 'already_in_progress' };

    loginEmAndamentoRef.current = true;
    marcarLoginPending?.(true);

    try {
      // 1. SET_AGENT — registrar ramal WebRTC via extensão (token em texto puro)
      if (token && !String(token).startsWith('enc:') && dominio) {
        window.postMessage({ type: 'VENDAFLOW_SET_AGENT', config: { token, dominio } }, '*');
      }

      // 2. Aguardar o ramal registrar (consulta primeiro p/ F5 instantâneo; senão evento)
      const ramalOk = await aguardarRamalRegistrado(RAMAL_TIMEOUT_MS);
      if (!ramalOk) {
        throw new Error('RAMAL_NAO_REGISTRADO: a extensão VendaFlow não registrou o ramal. Verifique se a extensão está instalada e ativa.');
      }

      // 3. POST /agent/connect (idempotente — pode falhar se já conectado)
      try {
        await invocar(COMMANDS.AGENT_CONNECT);
      } catch (e) {
        console.warn('[loginCampanha] agent-connect falhou (pode já estar conectado):', e.message);
      }

      // 4. POST /agent/login (HTTP 204 = comando aceito)
      await invocar(COMMANDS.AGENT_LOGIN, { campanha_id: campanhaId });

      // 5. Confirmar via socket: agent-is-idle (sucesso) ou agent-login-failed (erro real)
      const evt = await aguardarConfirmacaoSocket(SOCKET_CONFIRM_TIMEOUT_MS);
      if (evt.ok) {
        console.log('[loginCampanha] Login confirmado via socket (agent-is-idle)');
        return { status: LOGIN_STATUS.CONNECTED };
      }
      if (evt.reason === 'agent-login-failed') {
        throw new Error('LOGIN_FALHOU: o 3C recusou o login (agent-login-failed). O ramal pode não ter respondido.');
      }
      // timeout sem evento: ramal registrou + 204 aceito → assumir conectado, mas avisar
      console.warn('[loginCampanha] Sem agent-is-idle/failed em', SOCKET_CONFIRM_TIMEOUT_MS, 'ms — assumindo conectado (ramal ok + 204 aceito)');
      return { status: LOGIN_STATUS.CONNECTED, warning: 'sem_confirmacao_socket' };
    } catch (e) {
      marcarLoginPending?.(false);
      throw e;
    } finally {
      loginEmAndamentoRef.current = false;
    }
  }, [empresaId, invocar, marcarLoginPending, aguardarRamalRegistrado, aguardarConfirmacaoSocket]);

  // ── Logout da campanha ─────────────────────────────────────
  // POST /agent/logout → aguardar agent-was-logged-out (10s timeout)
  // Se timeout: GET /agent/loggedCampaign para confirmar estado real
  const sairDaCampanha = useCallback(async () => {
    if (!empresaId) return;
    if (logoutEmAndamentoRef.current) return { status: 'already_in_progress' };

    logoutEmAndamentoRef.current = true;

    try {
      await invocar(COMMANDS.AGENT_LOGOUT);

      // O POST /agent/logout (204) já confirma o comando aceito. Damos uma curta
      // janela para o evento agent-was-logged-out; se não vier, liberamos a UI
      // (nunca travar em "Aguardando 3C saindo"). Sem polling de loggedCampaign (não-confiável).
      const resultado = await new Promise((resolve) => {
        const socket = socketRef?.current;
        let done = false;
        const finish = (result) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          if (socket) { try { socket.off(SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT, onLogout); } catch {} }
          resolve(result);
        };
        function onLogout() { finish({ status: 'confirmed_via_socket' }); }
        if (socket) socket.on(SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT, onLogout);
        const timeout = setTimeout(() => finish({ status: 'assumed_offline' }), 2500);
      });

      return resultado;
    } finally {
      logoutEmAndamentoRef.current = false;
    }
  }, [empresaId, invocar, socketRef]);

  // ── Restaurar estado do agente ─────────────────────────────
  // GET /agent/loggedCampaign via serverless
  const restaurarEstadoAgente = useCallback(async () => {
    if (!empresaId) return null;
    try {
      const resp = await invocar(COMMANDS.GET_LOGGED_CAMPAIGN);
      return resp?.dados || null;
    } catch (e) {
      console.warn('[useTelefoniaActions] restaurarEstadoAgente falhou:', e.message);
      return null;
    }
  }, [empresaId, invocar]);

  // ── Listar campanhas disponíveis ───────────────────────────
  const listarCampanhas = useCallback(async () => {
    if (!empresaId) return [];
    try {
      const resp = await invocar(COMMANDS.GET_CAMPAIGNS);
      return resp?.dados?.data || resp?.dados || [];
    } catch (e) {
      console.warn('[useTelefoniaActions] listarCampanhas falhou:', e.message);
      return [];
    }
  }, [empresaId, invocar]);

  return {
    loginCampanha,
    sairDaCampanha,
    restaurarEstadoAgente,
    listarCampanhas,
    loginEmAndamentoRef,
    logoutEmAndamentoRef,
  };
}