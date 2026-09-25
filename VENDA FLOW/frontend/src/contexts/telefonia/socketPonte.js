/**
 * socketPonte — eventos do 3C Plus recebidos pela ponte do backend.
 *
 * O navegador não conecta mais no socket do 3C Plus (o token de serviço não pode sair do
 * servidor). O backend mantém essa conexão e publica cada evento numa sala do nosso Socket.IO:
 *   telefonia:agente:<userId>    → eventos do agente do usuário logado
 *   telefonia:gestor:<empresaId> → eventos de todos os agentes (monitoramento)
 *
 * Este adaptador imita a interface do socket.io-client (on/off/once/onAny/connected) para que
 * o restante da telefonia continue igual. Os eventos de ciclo de vida da ponte ("__ponte:*")
 * viram os eventos padrão connect / disconnect / reconnect / connect_error.
 */
import { api } from '@/api/client';

const CICLO_DE_VIDA = {
  '__ponte:connect': 'connect',
  '__ponte:disconnect': 'disconnect',
  '__ponte:reconnect': 'reconnect',
  '__ponte:connect_error': 'connect_error',
};

export function salaAgente(userId) {
  return `telefonia:agente:${userId}`;
}

export function salaGestor(empresaId) {
  return `telefonia:gestor:${empresaId}`;
}

export function criarSocketPonte(sala) {
  const handlers = new Map(); // evento → Set<fn>
  const handlersAny = new Set();
  let jaConectou = false;

  const disparar = (evento, ...args) => {
    for (const h of [...(handlers.get(evento) ?? [])]) {
      try {
        h(...args);
      } catch (err) {
        console.error(`[socketPonte] handler de ${evento} falhou`, err);
      }
    }
  };

  const socket = {
    sala,
    connected: false,
    on(evento, h) {
      if (!handlers.has(evento)) handlers.set(evento, new Set());
      handlers.get(evento).add(h);
      return socket;
    },
    off(evento, h) {
      if (h) handlers.get(evento)?.delete(h);
      else handlers.delete(evento);
      return socket;
    },
    once(evento, h) {
      const uma = (...args) => {
        socket.off(evento, uma);
        h(...args);
      };
      return socket.on(evento, uma);
    },
    onAny(h) {
      handlersAny.add(h);
      return socket;
    },
    offAny(h) {
      if (h) handlersAny.delete(h);
      else handlersAny.clear();
      return socket;
    },
    // A reconexão é automática (cliente da API + ponte no backend)
    connect() {
      return socket;
    },
    disconnect() {
      pararSala();
      pararConexao();
      socket.connected = false;
      return socket;
    },
  };

  const pararSala = api.realtime.subscribe(sala, (payload) => {
    const { evento, data } = payload ?? {};
    if (!evento) return;

    const ciclo = CICLO_DE_VIDA[evento];
    if (ciclo === 'connect') {
      const reconexao = jaConectou && !socket.connected;
      socket.connected = true;
      jaConectou = true;
      disparar('connect');
      if (reconexao) disparar('reconnect');
      return;
    }
    if (ciclo === 'disconnect') {
      socket.connected = false;
      disparar('disconnect', data?.reason);
      return;
    }
    if (ciclo === 'reconnect') return; // já tratado no connect que acompanha a reconexão
    if (ciclo === 'connect_error') {
      disparar('connect_error', new Error(data?.message || 'Falha na conexão com o 3C Plus'));
      return;
    }

    for (const h of [...handlersAny]) {
      try {
        h(evento, data);
      } catch (err) {
        console.error(`[socketPonte] onAny falhou em ${evento}`, err);
      }
    }
    disparar(evento, data);
  });

  // Queda da nossa própria conexão com o backend também derruba os eventos
  const pararConexao = api.realtime.onConexao((estado) => {
    if (estado === 'desconectado' && socket.connected) {
      socket.connected = false;
      disparar('disconnect', 'backend');
    }
  });

  return socket;
}
