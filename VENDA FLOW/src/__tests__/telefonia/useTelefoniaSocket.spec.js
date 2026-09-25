/* eslint-env jest */
/* global describe, it, beforeEach, afterEach, expect, jest */
/**
 * SPEC: useTelefoniaSocket
 *
 * Verifica o roteamento de eventos Socket.IO → handlers corretos.
 * Cobre: conexão, classificação de eventos, cleanup.
 *
 * IMPORTANTE: Qualquer alteração nas listas de eventos (atendimentos,
 * encerramentos, naoAtendidos) ou na URL de conexão quebrará estes testes.
 */
import { renderHook } from '@testing-library/react';
import { useTelefoniaSocket } from '@/contexts/telefonia/useTelefoniaSocket';

// ── Mock socket.io-client ────────────────────────────────────
const mockSocket = {
  on: jest.fn(),
  onAny: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
};
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));
import { io } from 'socket.io-client';

// ── Helpers ──────────────────────────────────────────────────
function getOnAnyCallback() {
  // onAny recebe o handler de todos os eventos
  return mockSocket.onAny.mock.calls[0]?.[0];
}

const CFG = { tokenAgente: 'token-abc', dominio: 'empresa-teste' };

describe('useTelefoniaSocket', () => {
  let handlers;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {
      onAtendimento:  jest.fn(),
      onNaoAtendido:  jest.fn(),
      onEncerramento: jest.fn(),
      onManualMode:   jest.fn(),
      onEventoAgente: jest.fn(),
    };
  });

  // ── Conexão ──────────────────────────────────────────────────
  describe('conexão', () => {
    it('deve conectar na URL correta do subdomínio', () => {
      renderHook(() => useTelefoniaSocket({ cfgTelefonia: CFG, user: {}, ...handlers }));
      expect(io).toHaveBeenCalledWith(
        'https://empresa-teste.3c.plus',
        expect.objectContaining({ query: { token: 'token-abc' } })
      );
    });

    it('deve usar transporte websocket', () => {
      renderHook(() => useTelefoniaSocket({ cfgTelefonia: CFG, user: {}, ...handlers }));
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ transports: ['websocket'] })
      );
    });

    it('não deve conectar sem tokenAgente', () => {
      renderHook(() => useTelefoniaSocket({ cfgTelefonia: { dominio: 'teste' }, user: {}, ...handlers }));
      expect(io).not.toHaveBeenCalled();
    });

    it('não deve conectar sem dominio', () => {
      renderHook(() => useTelefoniaSocket({ cfgTelefonia: { tokenAgente: 'abc' }, user: {}, ...handlers }));
      expect(io).not.toHaveBeenCalled();
    });

    it('deve desconectar ao desmontar', () => {
      const { unmount } = renderHook(() => useTelefoniaSocket({ cfgTelefonia: CFG, user: {}, ...handlers }));
      unmount();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  // ── Roteamento de eventos ────────────────────────────────────
  describe('roteamento de eventos', () => {
    const eventosAtendimento = ['call-was-connected', 'manual-call-was-answered', 'call-was-answered', 'call-answered'];
    const eventosNaoAtendido = ['call-was-not-answered', 'call-not-answered', 'call-was-busy', 'call-was-failed', 'call-failed'];
    const eventosEncerramento = ['call-was-finished', 'call-finished', 'call-ended'];
    const eventosAgente = [
      'agent-is-idle', 'agent-is-free', 'agent-is-connected', 'agent-entered-call',
      'agent-in-acw', 'agent-entered-manual-acw', 'agent-entered-work-break',
      'agent-left-work-break', 'agent-left-manual-mode', 'agent-was-logged-out',
    ];

    function dispararEvento(evento, data = {}) {
      const cb = getOnAnyCallback();
      if (cb) cb(evento, data);
    }

    beforeEach(() => {
      renderHook(() => useTelefoniaSocket({ cfgTelefonia: CFG, user: {}, ...handlers }));
    });

    eventosAtendimento.forEach(evento => {
      it(`"${evento}" deve chamar onAtendimento`, () => {
        dispararEvento(evento, { phone: '11999990000' });
        expect(handlers.onAtendimento).toHaveBeenCalledWith({ phone: '11999990000' }, evento);
        expect(handlers.onNaoAtendido).not.toHaveBeenCalled();
        expect(handlers.onEncerramento).not.toHaveBeenCalled();
      });
    });

    eventosNaoAtendido.forEach(evento => {
      it(`"${evento}" deve chamar onNaoAtendido`, () => {
        dispararEvento(evento, {});
        expect(handlers.onNaoAtendido).toHaveBeenCalledWith({}, evento);
        expect(handlers.onAtendimento).not.toHaveBeenCalled();
      });
    });

    eventosEncerramento.forEach(evento => {
      it(`"${evento}" deve chamar onEncerramento`, () => {
        dispararEvento(evento, {});
        expect(handlers.onEncerramento).toHaveBeenCalledWith({}, evento);
        expect(handlers.onAtendimento).not.toHaveBeenCalled();
      });
    });

    eventosAgente.forEach(evento => {
      it(`"${evento}" deve chamar onEventoAgente`, () => {
        dispararEvento(evento, {});
        expect(handlers.onEventoAgente).toHaveBeenCalledWith(evento, {});
      });
    });

    it('"agent-entered-manual-mode" deve chamar onManualMode', () => {
      dispararEvento('agent-entered-manual-mode', { foo: 'bar' });
      expect(handlers.onManualMode).toHaveBeenCalledWith({ foo: 'bar' });
      expect(handlers.onEventoAgente).not.toHaveBeenCalled();
    });

    it('"agent-entered-manual" deve chamar onManualMode', () => {
      dispararEvento('agent-entered-manual', {});
      expect(handlers.onManualMode).toHaveBeenCalled();
    });

    it('evento desconhecido não deve chamar nenhum handler', () => {
      dispararEvento('evento-inexistente', {});
      expect(handlers.onAtendimento).not.toHaveBeenCalled();
      expect(handlers.onNaoAtendido).not.toHaveBeenCalled();
      expect(handlers.onEncerramento).not.toHaveBeenCalled();
      expect(handlers.onEventoAgente).not.toHaveBeenCalled();
      expect(handlers.onManualMode).not.toHaveBeenCalled();
    });
  });
});