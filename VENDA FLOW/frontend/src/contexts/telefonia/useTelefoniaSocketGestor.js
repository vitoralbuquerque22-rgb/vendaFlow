/**
 * useTelefoniaSocketGestor
 * Eventos de TODOS os agentes da empresa (monitoramento), recebidos pela ponte do backend:
 * o token de gestor do 3C nunca chega ao navegador. O backend só deixa entrar na sala quem
 * tem papel de supervisão (supervisor, gerente, gestor, admin).
 * Usado por MonitoramentoAoVivo e PainelSupervisor.
 * SINGLETON: uma assinatura por empresa.
 */
import { useRef, useEffect, useCallback } from 'react';
import { SOCKET_EVENTS } from './TELEFONIA_ENGINE';
import { criarSocketPonte, salaGestor } from './socketPonte';

// Avisos que interessam ao gestor (ele é quem pode agir: subir lista, liberar vaga de agente)
const AVISOS_GESTOR = [SOCKET_EVENTS.LIST_EMPTY, SOCKET_EVENTS.REACHED_MAX_ONLINE_AGENTS];

let _gestorSocket = null;
let _gestorEmpresa = null;

function desconectarGestor() {
  if (_gestorSocket) {
    _gestorSocket.disconnect();
    _gestorSocket = null;
    _gestorEmpresa = null;
  }
}

export function useTelefoniaSocketGestor({ empresaId, habilitado = true, onEventoAgente, onEventoCampanha, onEventoChamada, onAvisoOperacional }) {
  const handlersRef = useRef({});
  handlersRef.current = { onEventoAgente, onEventoCampanha, onEventoChamada, onAvisoOperacional };

  const socketRef = useRef(null);
  const conectado = useRef(false);
  const alvo = habilitado && empresaId ? empresaId : null;

  useEffect(() => {
    if (!alvo) return;

    if (_gestorSocket && _gestorEmpresa === alvo) {
      socketRef.current = _gestorSocket;
      conectado.current = _gestorSocket.connected;
      return;
    }

    desconectarGestor();

    const socket = criarSocketPonte(salaGestor(alvo));

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

      if (AVISOS_GESTOR.includes(evento)) {
        h.onAvisoOperacional?.(evento, data);
        return;
      }

      // Eventos de agente (status, login, logout, break, etc)
      if (evento.startsWith('agent-')) {
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
      }
    });

    _gestorSocket = socket;
    _gestorEmpresa = alvo;
    socketRef.current = socket;
  }, [alvo]);

  const desconectar = useCallback(() => {
    desconectarGestor();
    conectado.current = false;
  }, []);

  return { socketRef, conectado, desconectar };
}
