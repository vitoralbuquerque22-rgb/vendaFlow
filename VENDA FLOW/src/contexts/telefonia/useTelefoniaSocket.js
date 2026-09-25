/**
 * useTelefoniaSocket
 * Responsabilidade única: conexão WebSocket com o 3C Plus.
 * SINGLETON: usa uma instância global para evitar sockets duplicados
 * (React StrictMode monta/desmonta componentes duas vezes em dev).
 *
 * Reconexão após sleep/troca de aba: o browser pode matar silenciosamente
 * o WebSocket ao suspender a aba. Solução:
 *  1. visibilitychange → se socket não está conectado ao voltar, forçar reconexão.
 *  2. Após reconectar, consultar estado atual do agente via REST para reprocessar
 *     qualquer evento perdido durante o sleep.
 */
import { useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { callLifecycle } from './CallLifecycleManager';

// ── Singleton global — garante que só existe 1 socket por token ──
let _globalSocket = null;
let _globalToken  = null;

function desconectarGlobal() {
  if (_globalSocket) {
    _globalSocket.disconnect();
    _globalSocket = null;
    _globalToken  = null;
  }
}

export function useTelefoniaSocket({
  cfgTelefonia,
  user,
  onAtendimento,
  onNaoAtendido,
  onEncerramento,
  onManualMode,
  onManualAtendida,
  onEventoAgente,
  onReconnect,
  onLoginFailed,
}) {
  // Refs para os handlers — evita stale closures sem reconectar
  const handlersRef = useRef({});
  handlersRef.current = { onAtendimento, onNaoAtendido, onEncerramento, onManualMode, onManualAtendida, onEventoAgente, onReconnect, onLoginFailed };

  const socketRef = useRef(null);

  useEffect(() => {
    const token = cfgTelefonia?.tokenAgente;
    if (!token) return;

    // Se já existe socket global com o mesmo token, apenas apontar para ele
    if (_globalSocket && _globalToken === token) {
      socketRef.current = _globalSocket;
      return;
    }

    // Desconectar socket anterior se token mudou
    desconectarGlobal();

    const socket = io('https://new-socket.3c.plus', {
      transports: ['websocket'],
      query: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    // ── Reconexão após sleep: ao reconectar, reprocessar estado atual ──
    socket.on('connect', () => {
    });

    socket.on('reconnect', (attemptNumber) => {
      // Restaurar estado completo (campanha + agente) — 3C+ é fonte da verdade
      handlersRef.current.onReconnect?.(token);
      reprocessarEstadoAgente(token);
    });

    socket.onAny((eventName, data) => {
      const evento = String(eventName || '');
      // Logar apenas eventos relevantes (não spam de dialer)
      const eventosRelevantes = [
        'agent-', 'call-was-connected', 'call-was-answered', 'call-answered',
        'manual-call-was-answered', 'call-was-finished', 'call-finished',
        'call-ended', 'call-was-not-answered', 'call-not-answered',
        'call-was-abandoned', 'agent-login-failed',
      ];
      const isRelevante = eventosRelevantes.some(p => evento.startsWith(p) || evento === p);


      // ── Dispatch para CallLifecycleManager (camada paralela) ──
      if (evento === 'agent-entered-manual-mode' || evento === 'agent-entered-manual') {
        callLifecycle.dispatch('START_CALL', { campaignId: data?.campaign_id });
      }
      if (evento === 'call-was-connected' || evento === 'call-was-answered' || evento === 'call-answered') {
        callLifecycle.dispatch('CONNECTED', {
          callId: data?.call?.id || data?.call_id || data?.id,
          uniqueId: data?.call?.telephony_id || data?.telephony_id,
          qualifications: data?.qualifications || data?.call?.qualifications || [],
          mailing: data?.mailing || data?.call?.mailing || null,
          campaignId: data?.campaign_id || data?.call?.campaign_id,
        });
      }
      if (evento === 'manual-call-was-answered') {
        callLifecycle.dispatch('CONNECTED', {
          callId: data?.call?.id || data?.call_id,
          uniqueId: data?.call?.telephony_id || data?.telephony_id,
          qualifications: data?.qualifications || [],
          mailing: null,
          campaignId: null,
        });
      }
      if (['call-was-finished', 'call-finished', 'call-ended', 'call-was-abandoned'].includes(evento)) {
        callLifecycle.dispatch('HANGUP', { reason: evento });
      }
      if (['call-was-not-answered', 'call-not-answered', 'call-was-busy', 'call-was-failed', 'call-failed'].includes(evento)) {
        callLifecycle.dispatch('NOT_ANSWERED', { reason: evento });
      }
      if (evento === 'agent-was-logged-out' || evento === 'agent-login-failed') {
        callLifecycle.dispatch('RESET');
      }

      const h = handlersRef.current;

      if (evento === 'agent-login-failed') {
        console.error('[Socket.IO 3C Plus] agent-login-failed payload:', JSON.stringify(data));
        h.onLoginFailed?.(data);
        return;
      }

      if (evento === 'agent-entered-manual-mode' || evento === 'agent-entered-manual') {
        h.onManualMode?.(data);
        return;
      }

      const eventosAgente = [
        'agent-is-idle', 'agent-is-free', 'agent-is-connected', 'agent-entered-call',
        'agent-in-acw', 'agent-entered-manual-acw', 'agent-entered-work-break',
        'agent-left-work-break', 'agent-left-manual-mode', 'agent-was-logged-out',
        'agent-login-failed', 'agent-failed-to-enter-manual',
        'agent-enter-work-break-failed', 'agent-leave-work-break-failed',
        'agent-left-manual-acw',
      ];
      if (eventosAgente.includes(evento)) {
        h.onEventoAgente?.(evento, data);
        return;
      }

      const naoAtendidos  = ['call-was-not-answered', 'call-not-answered', 'call-was-busy', 'call-was-failed', 'call-failed'];
      const encerramentos = ['call-was-finished', 'call-finished', 'call-ended', 'call-was-abandoned'];
      // manual-call-was-answered roteado separadamente para não abrir modal de campanha
      const atendimentos  = ['call-was-connected', 'call-was-answered', 'call-answered'];

      if (naoAtendidos.includes(evento))         { h.onNaoAtendido?.(data, evento);    return; }
      if (encerramentos.includes(evento))        { h.onEncerramento?.(data, evento);   return; }
      if (evento === 'manual-call-was-answered') { h.onManualAtendida?.(data);          return; }
      if (atendimentos.includes(evento))         { h.onAtendimento?.(data, evento);    return; }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket.IO 3C Plus] desconectado:', reason);
    });
    socket.on('connect_error', (err) => console.error('[Socket.IO 3C Plus] erro de conexão:', err.message));

    _globalSocket     = socket;
    _globalToken      = token;
    socketRef.current = socket;

    // NÃO desconectar no cleanup — o socket é singleton global
    // Só desconecta quando o token muda (acima) ou app fecha
  }, [cfgTelefonia?.tokenAgente]);

  // ── Page Visibility API — detectar retorno do sleep ──
  useEffect(() => {
    const token = cfgTelefonia?.tokenAgente;
    if (!token) return;

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      const socket = _globalSocket;
      if (!socket) return;

        if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
          handlersRef.current.onReconnect?.(token);
          reprocessarEstadoAgente(token);
        });
      } else {
        // Socket ainda conectado mas pode ter perdido eventos — restaurar estado completo
        handlersRef.current.onReconnect?.(token);
        reprocessarEstadoAgente(token);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cfgTelefonia?.tokenAgente]);

  return { socketRef };
}

/**
 * Consulta o estado atual do agente via REST após reconexão/retorno do sleep.
 * Se o agente estiver em ligação ativa, dispara onAtendimento para abrir o modal
 * que pode ter sido perdido durante o sleep.
 */
function reprocessarEstadoAgente(_token) {
  // Dispara imediatamente e tenta novamente após 500ms e 1500ms
  // para cobrir race condition onde TelefoniaContext ainda não montou o listener
  const disparar = () => window.dispatchEvent(new CustomEvent('vendaflow:reprocessar-agente'));
  disparar();
  setTimeout(disparar, 500);
  setTimeout(disparar, 1500);
}