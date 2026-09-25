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
  ROTAS_SOCKET,
  AVISO_EVENTS,
  rotaDoEvento,
  acaoCicloDeVida,
  MENSAGENS_FALHA_AGENTE,
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

describe('Roteamento de eventos do socket', () => {
  // Eventos oficiais que o CRM deliberadamente não trata no socket do agente
  // (consulta/transferência, espera e espionagem não são usados; os demais são informativos)
  const SEM_ROTA = [
    'agent-left-manual-acw-x', // sentinela: evento inexistente
    SOCKET_EVENTS.CALL_WAS_CREATED, SOCKET_EVENTS.CALL_WAS_ENDED, SOCKET_EVENTS.CALL_WAS_ABANDONED_DUE_AMD,
    SOCKET_EVENTS.CALL_HISTORY_WAS_CREATED, SOCKET_EVENTS.MANUAL_CALL_ACW_CONNECTED, SOCKET_EVENTS.MANUAL_CALL_ACW_DISCONNECTED,
    SOCKET_EVENTS.HOLD_CALL, SOCKET_EVENTS.SPY_STARTED, SOCKET_EVENTS.SPY_ENDED, SOCKET_EVENTS.SPY_FAILED,
    SOCKET_EVENTS.CONSULT_HOLD, SOCKET_EVENTS.CONSULT_EXIT, SOCKET_EVENTS.CONSULT_TRANSFER, SOCKET_EVENTS.CONSULT_CANCEL_HOLD,
    SOCKET_EVENTS.CONSULT_CONNECTED, SOCKET_EVENTS.CONSULT_FAILED, SOCKET_EVENTS.CONSULT_TRANSFER_FAILED,
    SOCKET_EVENTS.CALL_IS_TRYING, SOCKET_EVENTS.CALL_WAS_AMD,
  ];

  it('todo evento oficial tem rota ou está na lista explícita de ignorados', () => {
    const semClassificacao = Object.values(SOCKET_EVENTS).filter((e) => rotaDoEvento(e) === null && !SEM_ROTA.includes(e));
    expect(semClassificacao).toEqual([]);
  });

  it('eventos ignorados não têm rota nem ação de ciclo de vida', () => {
    SEM_ROTA.forEach((e) => {
      expect(rotaDoEvento(e)).toBeNull();
      expect(acaoCicloDeVida(e)).toBeNull();
    });
  });

  it('avisos operacionais: agendamento, lista vazia e limite de agentes', () => {
    expect(AVISO_EVENTS).toEqual(['agent-schedule', 'list-empty', 'reached-max-online-agents']);
    AVISO_EVENTS.forEach((e) => {
      expect(rotaDoEvento(e)).toBe(ROTAS_SOCKET.AVISO_OPERACIONAL);
      expect(acaoCicloDeVida(e)).toBeNull();
    });
  });

  it('nomes antigos continuam roteados como os oficiais', () => {
    expect(rotaDoEvento('call-answered')).toBe(rotaDoEvento(SOCKET_EVENTS.CALL_WAS_ANSWERED));
    expect(rotaDoEvento('call-finished')).toBe(rotaDoEvento(SOCKET_EVENTS.CALL_WAS_FINISHED));
    expect(rotaDoEvento('call-not-answered')).toBe(rotaDoEvento(SOCKET_EVENTS.CALL_WAS_NOT_ANSWERED));
    expect(rotaDoEvento('agent-entered-manual-mode')).toBe(rotaDoEvento(SOCKET_EVENTS.AGENT_ENTERED_MANUAL));
  });

  it('ações de ciclo de vida', () => {
    expect(acaoCicloDeVida('agent-entered-manual')).toBe('START_CALL');
    expect(acaoCicloDeVida('call-was-connected')).toBe('CONNECTED');
    expect(acaoCicloDeVida('manual-call-was-answered')).toBe('CONNECTED_MANUAL');
    expect(acaoCicloDeVida('call-was-abandoned')).toBe('HANGUP');
    expect(acaoCicloDeVida('call-was-failed')).toBe('NOT_ANSWERED');
    expect(acaoCicloDeVida('agent-login-failed')).toBe('RESET');
    expect(acaoCicloDeVida('agent-was-logged-out')).toBe('RESET');
    expect(acaoCicloDeVida('agent-is-idle')).toBeNull();
  });

  it('toda falha de ação do agente tem mensagem e chega ao handler do agente', () => {
    const falhas = [
      SOCKET_EVENTS.AGENT_FAILED_TO_ENTER_MANUAL, SOCKET_EVENTS.AGENT_FAILED_TO_LEAVE_MANUAL,
      SOCKET_EVENTS.AGENT_ENTER_WORK_BREAK_FAILED, SOCKET_EVENTS.AGENT_LEAVE_WORK_BREAK_FAILED,
    ];
    expect(Object.keys(MENSAGENS_FALHA_AGENTE).sort()).toEqual([...falhas].sort());
    falhas.forEach((e) => expect(rotaDoEvento(e)).toBe(ROTAS_SOCKET.AGENTE));
  });

  it('aceita entrada vazia sem quebrar', () => {
    expect(rotaDoEvento(undefined)).toBeNull();
    expect(acaoCicloDeVida(null)).toBeNull();
  });
});