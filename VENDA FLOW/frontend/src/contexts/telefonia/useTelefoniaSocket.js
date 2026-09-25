/**
 * useTelefoniaSocket
 * Responsabilidade única: eventos em tempo real do agente no 3C Plus.
 *
 * Os eventos chegam pela ponte do backend (socketPonte.js): o navegador não conecta no
 * socket do 3C nem recebe token. SINGLETON: uma única assinatura por usuário
 * (React StrictMode monta/desmonta componentes duas vezes em dev).
 *
 * Reconexão após sleep/troca de aba: ao voltar, consultar o estado atual do agente via
 * REST para reprocessar qualquer evento perdido.
 */
import { useRef, useEffect } from 'react';
import { callLifecycle } from './CallLifecycleManager';
import { ROTAS_SOCKET, rotaDoEvento, acaoCicloDeVida } from './TELEFONIA_ENGINE';
import { criarSocketPonte, salaAgente } from './socketPonte';

// ── Singleton global — garante que só existe 1 assinatura por usuário ──
let _globalSocket = null;
let _globalChave  = null;

function desconectarGlobal() {
  if (_globalSocket) {
    _globalSocket.disconnect();
    _globalSocket = null;
    _globalChave  = null;
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
  onAvisoOperacional,
}) {
  // Refs para os handlers — evita stale closures sem reconectar
  const handlersRef = useRef({});
  handlersRef.current = { onAtendimento, onNaoAtendido, onEncerramento, onManualMode, onManualAtendida, onEventoAgente, onReconnect, onLoginFailed, onAvisoOperacional };

  const socketRef = useRef(null);

  // Muda de empresa → o backend reabre a ponte com a credencial da empresa nova
  const chave = cfgTelefonia?.agenteHabilitado && user?.id ? `${user.id}:${cfgTelefonia.integracaoId}` : null;

  useEffect(() => {
    if (!chave) return;

    // Se já existe assinatura global para o mesmo usuário/integração, apenas apontar para ela
    if (_globalSocket && _globalChave === chave) {
      socketRef.current = _globalSocket;
      return;
    }

    // Desconectar a anterior se o usuário ou a integração mudou
    desconectarGlobal();

    const socket = criarSocketPonte(salaAgente(user.id));

    socket.on('reconnect', () => {
      // Restaurar estado completo (campanha + agente) — 3C+ é fonte da verdade
      handlersRef.current.onReconnect?.();
      reprocessarEstadoAgente();
    });

    socket.onAny((eventName, data) => {
      const evento = String(eventName || '');

      // ── Dispatch para CallLifecycleManager (camada paralela) ──
      switch (acaoCicloDeVida(evento)) {
        case 'START_CALL':
          callLifecycle.dispatch('START_CALL', { campaignId: data?.campaign_id });
          break;
        case 'CONNECTED':
          callLifecycle.dispatch('CONNECTED', {
            callId: data?.call?.id || data?.call_id || data?.id,
            uniqueId: data?.call?.telephony_id || data?.telephony_id,
            qualifications: data?.qualifications || data?.call?.qualifications || [],
            mailing: data?.mailing || data?.call?.mailing || null,
            campaignId: data?.campaign_id || data?.call?.campaign_id,
          });
          break;
        case 'CONNECTED_MANUAL':
          callLifecycle.dispatch('CONNECTED', {
            callId: data?.call?.id || data?.call_id,
            uniqueId: data?.call?.telephony_id || data?.telephony_id,
            qualifications: data?.qualifications || [],
            mailing: null,
            campaignId: null,
          });
          break;
        case 'HANGUP':
          callLifecycle.dispatch('HANGUP', { reason: evento });
          break;
        case 'NOT_ANSWERED':
          callLifecycle.dispatch('NOT_ANSWERED', { reason: evento });
          break;
        case 'RESET':
          callLifecycle.dispatch('RESET');
          break;
      }

      // ── Handlers do TelefoniaContext (rotas em TELEFONIA_ENGINE.rotaDoEvento) ──
      const h = handlersRef.current;
      switch (rotaDoEvento(evento)) {
        case ROTAS_SOCKET.LOGIN_FALHOU:
          console.error('[Socket.IO 3C Plus] agent-login-failed payload:', JSON.stringify(data));
          h.onLoginFailed?.(data);
          break;
        case ROTAS_SOCKET.MODO_MANUAL:
          h.onManualMode?.(data);
          break;
        case ROTAS_SOCKET.AGENTE:
          h.onEventoAgente?.(evento, data);
          break;
        case ROTAS_SOCKET.NAO_ATENDIDA:
          h.onNaoAtendido?.(data, evento);
          break;
        case ROTAS_SOCKET.ENCERRADA:
          h.onEncerramento?.(data, evento);
          break;
        // manual-call-was-answered tem rota própria para não abrir o modal de campanha
        case ROTAS_SOCKET.MANUAL_ATENDIDA:
          h.onManualAtendida?.(data);
          break;
        case ROTAS_SOCKET.ATENDIDA:
          h.onAtendimento?.(data, evento);
          break;
        case ROTAS_SOCKET.AVISO_OPERACIONAL:
          h.onAvisoOperacional?.(evento, data);
          break;
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket.IO 3C Plus] desconectado:', reason);
    });
    socket.on('connect_error', (err) => console.error('[Socket.IO 3C Plus] erro de conexão:', err.message));

    _globalSocket     = socket;
    _globalChave      = chave;
    socketRef.current = socket;

    // NÃO desconectar no cleanup — a assinatura é singleton global
    // Só desconecta quando o usuário/integração muda (acima) ou app fecha
  }, [chave]);

  // ── Page Visibility API — detectar retorno do sleep ──
  useEffect(() => {
    if (!chave) return;

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      const socket = _globalSocket;
      if (!socket) return;

      if (!socket.connected) {
        // A reconexão é automática; ao voltar, reprocessar o estado
        socket.once('connect', () => {
          handlersRef.current.onReconnect?.();
          reprocessarEstadoAgente();
        });
      } else {
        // Ainda conectado mas pode ter perdido eventos — restaurar estado completo
        handlersRef.current.onReconnect?.();
        reprocessarEstadoAgente();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [chave]);

  return { socketRef };
}

/**
 * Consulta o estado atual do agente via REST após reconexão/retorno do sleep.
 * Se o agente estiver em ligação ativa, dispara onAtendimento para abrir o modal
 * que pode ter sido perdido durante o sleep.
 */
function reprocessarEstadoAgente() {
  // Dispara imediatamente e tenta novamente após 500ms e 1500ms
  // para cobrir race condition onde TelefoniaContext ainda não montou o listener
  const disparar = () => window.dispatchEvent(new CustomEvent('vendaflow:reprocessar-agente'));
  disparar();
  setTimeout(disparar, 500);
  setTimeout(disparar, 1500);
}