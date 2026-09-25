/**
 * useTelefoniaSocketGestor
 * Socket.IO com token GESTOR — recebe eventos de TODOS os agentes.
 * Usado por MonitoramentoAoVivo e PainelSupervisor.
 * SINGLETON: mesma abordagem do useTelefoniaSocket (1 socket por token).
 */
import { useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

let _gestorSocket = null;
let _gestorToken = null;

function desconectarGestor() {
  if (_gestorSocket) {
    _gestorSocket.disconnect();
    _gestorSocket = null;
    _gestorToken = null;
  }
}

export function useTelefoniaSocketGestor({ tokenGestor, onEventoAgente, onEventoCampanha, onEventoChamada }) {
  const handlersRef = useRef({});
  handlersRef.current = { onEventoAgente, onEventoCampanha, onEventoChamada };

  const socketRef = useRef(null);
  const conectado = useRef(false);

  useEffect(() => {
    if (!tokenGestor) return;

    if (_gestorSocket && _gestorToken === tokenGestor) {
      socketRef.current = _gestorSocket;
      conectado.current = _gestorSocket.connected;
      return;
    }

    desconectarGestor();

    const socket = io('https://socket.3c.plus', {
      transports: ['websocket'],
      query: { token: tokenGestor },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
    });

    socket.on('connect', () => {
      console.log('[SocketGestor] conectado');
      conectado.current = true;
    });

    socket.on('disconnect', (reason) => {
      console.warn('[SocketGestor] desconectado:', reason);
      conectado.current = false;
    });

    socket.on('connect_error', (err) => {
      console.error('[SocketGestor] erro de conexão:', err.message);
    });

    socket.onAny((eventName, data) => {
      const evento = String(eventName || '');
      const h = handlersRef.current;

      // Eventos de agente (status, login, logout, break, etc)
      const eventosAgente = [
        'agent-is-idle', 'agent-is-free', 'agent-is-connected',
        'agent-entered-call', 'agent-in-acw', 'agent-entered-manual-acw',
        'agent-entered-work-break', 'agent-left-work-break',
        'agent-entered-manual-mode', 'agent-left-manual-mode',
        'agent-was-logged-out', 'agent-logged-out', 'agent-login-failed',
      ];
      if (eventosAgente.some(e => evento === e || evento.startsWith('agent-'))) {
        h.onEventoAgente?.(evento, data);
        return;
      }

      // Eventos de campanha
      if (evento.startsWith('campaign-')) {
        h.onEventoCampanha?.(evento, data);
        return;
      }

      // Eventos de chamada (para monitoramento)
      const eventosChamada = [
        'call-was-connected', 'call-was-answered', 'call-answered',
        'call-was-finished', 'call-finished', 'call-ended',
        'call-was-not-answered', 'call-not-answered',
        'call-was-abandoned', 'call-history-was-created',
        'manual-call-was-answered',
      ];
      if (eventosChamada.includes(evento)) {
        h.onEventoChamada?.(evento, data);
        return;
      }
    });

    _gestorSocket = socket;
    _gestorToken = tokenGestor;
    socketRef.current = socket;
  }, [tokenGestor]);

  // Page Visibility — reconectar após sleep
  useEffect(() => {
    if (!tokenGestor) return;

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const socket = _gestorSocket;
      if (!socket) return;
      if (!socket.connected) {
        socket.connect();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tokenGestor]);

  const desconectar = useCallback(() => {
    desconectarGestor();
    conectado.current = false;
  }, []);

  return { socketRef, conectado, desconectar };
}