import { describe, it, expect } from 'vitest';
import {
  ENGINE_VERSION,
  LOGIN_STATUS,
  AGENT_STATUS,
  STATUS_VISUAL,
  VALID_TRANSITIONS,
  SOCKET_EVENTS,
  EVENT_TO_STATUS,
  COMMANDS,
  TIMEOUTS,
  COMMAND_CONTRACTS,
  AGENT_STATE_EVENTS,
  LOGIN_SUCCESS_EVENTS,
  LOGIN_FAILURE_EVENTS,
  HEARTBEAT_CONDITIONS,
  SOCKET_URL,
  getExtensionUrl,
  isValidTransition,
} from '@/contexts/telefonia/TELEFONIA_ENGINE';

describe('TELEFONIA_ENGINE — Contratos', () => {
  it('ENGINE_VERSION deve ser semver válido', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  describe('LOGIN_STATUS', () => {
    it('deve ter todos os estados obrigatórios', () => {
      expect(LOGIN_STATUS.IDLE).toBe('idle');
      expect(LOGIN_STATUS.CONNECTING).toBe('connecting');
      expect(LOGIN_STATUS.WAITING_CONFIRMATION).toBe('waiting_confirmation');
      expect(LOGIN_STATUS.CONNECTED).toBe('connected');
      expect(LOGIN_STATUS.FAILED).toBe('failed');
    });
  });

  describe('AGENT_STATUS', () => {
    it('deve ter todos os 7 estados', () => {
      const estados = Object.keys(AGENT_STATUS);
      expect(estados).toHaveLength(7);
      expect(estados).toContain('OFFLINE');
      expect(estados).toContain('IDLE');
      expect(estados).toContain('IN_CALL');
      expect(estados).toContain('ACW');
      expect(estados).toContain('MANUAL');
      expect(estados).toContain('WORK_BREAK');
      expect(estados).toContain('MANUAL_ACW');
    });
  });

  describe('STATUS_VISUAL', () => {
    it('cada AGENT_STATUS deve ter mapeamento visual', () => {
      Object.values(AGENT_STATUS).forEach(status => {
        expect(STATUS_VISUAL[status]).toBeDefined();
      });
    });

    it('mapeamentos corretos', () => {
      expect(STATUS_VISUAL[AGENT_STATUS.IDLE]).toBe('aguardando');
      expect(STATUS_VISUAL[AGENT_STATUS.IN_CALL]).toBe('falando');
      expect(STATUS_VISUAL[AGENT_STATUS.ACW]).toBe('tpa');
      expect(STATUS_VISUAL[AGENT_STATUS.MANUAL]).toBe('manual');
      expect(STATUS_VISUAL[AGENT_STATUS.WORK_BREAK]).toBe('pausa');
    });
  });

  describe('VALID_TRANSITIONS', () => {
    it('OFFLINE só pode ir para IDLE', () => {
      expect(VALID_TRANSITIONS[AGENT_STATUS.OFFLINE]).toEqual([AGENT_STATUS.IDLE]);
    });

    it('IDLE pode ir para IN_CALL, MANUAL, WORK_BREAK ou OFFLINE', () => {
      const destinos = VALID_TRANSITIONS[AGENT_STATUS.IDLE];
      expect(destinos).toContain(AGENT_STATUS.IN_CALL);
      expect(destinos).toContain(AGENT_STATUS.MANUAL);
      expect(destinos).toContain(AGENT_STATUS.WORK_BREAK);
      expect(destinos).toContain(AGENT_STATUS.OFFLINE);
    });

    it('WORK_BREAK só pode voltar para IDLE', () => {
      expect(VALID_TRANSITIONS[AGENT_STATUS.WORK_BREAK]).toEqual([AGENT_STATUS.IDLE]);
    });

    it('IN_CALL pode ir para ACW ou IDLE', () => {
      const destinos = VALID_TRANSITIONS[AGENT_STATUS.IN_CALL];
      expect(destinos).toContain(AGENT_STATUS.ACW);
      expect(destinos).toContain(AGENT_STATUS.IDLE);
    });
  });

  describe('isValidTransition', () => {
    it('transição válida OFFLINE → IDLE retorna true', () => {
      expect(isValidTransition(AGENT_STATUS.OFFLINE, AGENT_STATUS.IDLE)).toBe(true);
    });

    it('transição inválida OFFLINE → IN_CALL retorna false', () => {
      expect(isValidTransition(AGENT_STATUS.OFFLINE, AGENT_STATUS.IN_CALL)).toBe(false);
    });

    it('transição válida IDLE → WORK_BREAK retorna true', () => {
      expect(isValidTransition(AGENT_STATUS.IDLE, AGENT_STATUS.WORK_BREAK)).toBe(true);
    });

    it('transição inválida WORK_BREAK → IN_CALL retorna false', () => {
      expect(isValidTransition(AGENT_STATUS.WORK_BREAK, AGENT_STATUS.IN_CALL)).toBe(false);
    });

    it('estado desconhecido retorna false', () => {
      expect(isValidTransition('desconhecido', AGENT_STATUS.IDLE)).toBe(false);
    });
  });

  describe('SOCKET_EVENTS', () => {
    it('agent-is-idle deve existir', () => {
      expect(SOCKET_EVENTS.AGENT_IS_IDLE).toBe('agent-is-idle');
    });

    it('agent-login-failed deve existir', () => {
      expect(SOCKET_EVENTS.AGENT_LOGIN_FAILED).toBe('agent-login-failed');
    });

    it('call-was-connected deve existir', () => {
      expect(SOCKET_EVENTS.CALL_WAS_CONNECTED).toBe('call-was-connected');
    });

    it('LOGIN_SUCCESS_EVENTS contém agent-is-idle', () => {
      expect(LOGIN_SUCCESS_EVENTS).toContain('agent-is-idle');
    });

    it('LOGIN_FAILURE_EVENTS contém agent-login-failed', () => {
      expect(LOGIN_FAILURE_EVENTS).toContain('agent-login-failed');
    });
  });

  describe('EVENT_TO_STATUS', () => {
    it('agent-is-idle mapeia para IDLE', () => {
      expect(EVENT_TO_STATUS[SOCKET_EVENTS.AGENT_IS_IDLE]).toBe(AGENT_STATUS.IDLE);
    });

    it('agent-login-failed mapeia para OFFLINE', () => {
      expect(EVENT_TO_STATUS[SOCKET_EVENTS.AGENT_LOGIN_FAILED]).toBe(AGENT_STATUS.OFFLINE);
    });

    it('agent-entered-work-break mapeia para WORK_BREAK', () => {
      expect(EVENT_TO_STATUS[SOCKET_EVENTS.AGENT_ENTERED_WORK_BREAK]).toBe(AGENT_STATUS.WORK_BREAK);
    });
  });

  describe('COMMANDS', () => {
    it('deve ter todos os comandos do serverless', () => {
      expect(COMMANDS.AGENT_CONNECT).toBe('agent-connect');
      expect(COMMANDS.AGENT_LOGIN).toBe('agent-login');
      expect(COMMANDS.AGENT_LOGOUT).toBe('agent-logout');
      expect(COMMANDS.GET_LOGGED_CAMPAIGN).toBe('get-logged-campaign');
      expect(COMMANDS.GET_CAMPAIGNS).toBe('get-campaigns');
    });
  });

  describe('COMMAND_CONTRACTS', () => {
    it('agent-login deve confirmar via agent-is-idle e falhar via agent-login-failed', () => {
      const contrato = COMMAND_CONTRACTS[COMMANDS.AGENT_LOGIN];
      expect(contrato.confirmationEvent).toBe(SOCKET_EVENTS.AGENT_IS_IDLE);
      expect(contrato.failureEvent).toBe(SOCKET_EVENTS.AGENT_LOGIN_FAILED);
      expect(contrato.timeout).toBe(TIMEOUTS.LOGIN_CONFIRMATION);
    });

    it('agent-logout deve confirmar via agent-was-logged-out', () => {
      const contrato = COMMAND_CONTRACTS[COMMANDS.AGENT_LOGOUT];
      expect(contrato.confirmationEvent).toBe(SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT);
      expect(contrato.timeout).toBe(TIMEOUTS.LOGOUT_CONFIRMATION);
    });

    it('agent-connect não tem evento de confirmação', () => {
      const contrato = COMMAND_CONTRACTS[COMMANDS.AGENT_CONNECT];
      expect(contrato.confirmationEvent).toBeNull();
    });
  });

  describe('TIMEOUTS', () => {
    it('login deve ter 15s', () => {
      expect(TIMEOUTS.LOGIN_CONFIRMATION).toBe(15000);
    });

    it('logout deve ter 10s', () => {
      expect(TIMEOUTS.LOGOUT_CONFIRMATION).toBe(10000);
    });

    it('heartbeat deve ter 60s', () => {
      expect(TIMEOUTS.HEARTBEAT_INTERVAL).toBe(60000);
    });
  });

  describe('HEARTBEAT_CONDITIONS', () => {
    it('deve ter 4 condições', () => {
      expect(Object.keys(HEARTBEAT_CONDITIONS)).toHaveLength(4);
      expect(HEARTBEAT_CONDITIONS.TAB_VISIBLE).toBeDefined();
      expect(HEARTBEAT_CONDITIONS.USER_LOGGED_IN).toBeDefined();
      expect(HEARTBEAT_CONDITIONS.CAMPAIGN_ACTIVE).toBeDefined();
      expect(HEARTBEAT_CONDITIONS.SOCKET_CONNECTED).toBeDefined();
    });
  });

  describe('SOCKET_URL', () => {
    it('deve ser socket.3c.plus', () => {
      expect(SOCKET_URL).toBe('https://socket.3c.plus');
    });
  });

  describe('getExtensionUrl', () => {
    it('deve gerar URL correta', () => {
      const url = getExtensionUrl('minha-empresa', 'meu-token');
      expect(url).toBe('https://minha-empresa.3c.plus/extension?api_token=meu-token');
    });

    it('deve encodar token com caracteres especiais', () => {
      const url = getExtensionUrl('empresa', 'token com espaço&especial');
      expect(url).toContain('api_token=token%20com%20espa%C3%A7o%26especial');
    });
  });

  describe('AGENT_STATE_EVENTS', () => {
    it('deve conter agent-login-failed', () => {
      expect(AGENT_STATE_EVENTS).toContain(SOCKET_EVENTS.AGENT_LOGIN_FAILED);
    });

    it('deve conter agent-enter-work-break-failed', () => {
      expect(AGENT_STATE_EVENTS).toContain(SOCKET_EVENTS.AGENT_ENTER_WORK_BREAK_FAILED);
    });

    it('deve conter todos os eventos de mudança de estado', () => {
      expect(AGENT_STATE_EVENTS.length).toBeGreaterThanOrEqual(13);
    });
  });
});