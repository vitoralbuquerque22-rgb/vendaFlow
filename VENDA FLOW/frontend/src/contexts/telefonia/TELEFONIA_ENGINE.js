export const ENGINE_VERSION = '1.0.0';

// ── Estados do Login ─────────────────────────────────────────
export const LOGIN_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  CONNECTED: 'connected',
  FAILED: 'failed',
};

// ── Estados do Agente (máquina de estados visual) ────────────
// OFFLINE → IDLE → IN_CALL → ACW → IDLE
//                → MANUAL → IDLE
//                → WORK_BREAK → IDLE
export const AGENT_STATUS = {
  OFFLINE: 'offline',
  IDLE: 'idle',
  IN_CALL: 'in_call',
  ACW: 'acw',
  MANUAL: 'manual',
  WORK_BREAK: 'work_break',
  MANUAL_ACW: 'manual_acw',
};

// ── Mapeamento: estado 3C → estado visual do CRM ────────────
export const STATUS_VISUAL = {
  [AGENT_STATUS.OFFLINE]: 'offline',
  [AGENT_STATUS.IDLE]: 'aguardando',
  [AGENT_STATUS.IN_CALL]: 'falando',
  [AGENT_STATUS.ACW]: 'tpa',
  [AGENT_STATUS.MANUAL]: 'manual',
  [AGENT_STATUS.WORK_BREAK]: 'pausa',
  [AGENT_STATUS.MANUAL_ACW]: 'tpa',
};

// ── Transições válidas ───────────────────────────────────────
export const VALID_TRANSITIONS = {
  [AGENT_STATUS.OFFLINE]: [AGENT_STATUS.IDLE],
  [AGENT_STATUS.IDLE]: [AGENT_STATUS.IN_CALL, AGENT_STATUS.MANUAL, AGENT_STATUS.WORK_BREAK, AGENT_STATUS.OFFLINE],
  [AGENT_STATUS.IN_CALL]: [AGENT_STATUS.ACW, AGENT_STATUS.IDLE],
  [AGENT_STATUS.ACW]: [AGENT_STATUS.IDLE, AGENT_STATUS.MANUAL],
  [AGENT_STATUS.MANUAL]: [AGENT_STATUS.IDLE, AGENT_STATUS.MANUAL_ACW, AGENT_STATUS.IN_CALL],
  [AGENT_STATUS.MANUAL_ACW]: [AGENT_STATUS.IDLE, AGENT_STATUS.MANUAL],
  [AGENT_STATUS.WORK_BREAK]: [AGENT_STATUS.IDLE],
};

// ── Eventos Socket.IO oficiais (Swagger 3C Plus) ────────────
export const SOCKET_EVENTS = {
  // Agente
  AGENT_IS_IDLE: 'agent-is-idle',
  AGENT_IN_ACW: 'agent-in-acw',
  AGENT_LOGIN_FAILED: 'agent-login-failed',
  AGENT_WAS_LOGGED_OUT: 'agent-was-logged-out',
  AGENT_ENTERED_MANUAL: 'agent-entered-manual',
  AGENT_FAILED_TO_ENTER_MANUAL: 'agent-failed-to-enter-manual',
  AGENT_LEFT_MANUAL_MODE: 'agent-left-manual-mode',
  AGENT_FAILED_TO_LEAVE_MANUAL: 'agent-failed-to-leave-manual-mode',
  AGENT_ENTERED_MANUAL_ACW: 'agent-entered-manual-acw',
  AGENT_LEFT_MANUAL_ACW: 'agent-left-manual-acw',
  AGENT_ENTERED_WORK_BREAK: 'agent-entered-work-break',
  AGENT_ENTER_WORK_BREAK_FAILED: 'agent-enter-work-break-failed',
  AGENT_LEFT_WORK_BREAK: 'agent-left-work-break',
  AGENT_LEAVE_WORK_BREAK_FAILED: 'agent-leave-work-break-failed',
  AGENT_SCHEDULE: 'agent-schedule',
  // Chamadas
  CALL_WAS_CREATED: 'call-was-created',
  CALL_WAS_ANSWERED: 'call-was-answered',
  CALL_WAS_CONNECTED: 'call-was-connected',
  CALL_WAS_ENDED: 'call-was-ended',
  CALL_WAS_FINISHED: 'call-was-finished',
  CALL_WAS_ABANDONED: 'call-was-abandoned',
  CALL_WAS_ABANDONED_DUE_AMD: 'call-was-abandoned-due-amd',
  CALL_WAS_NOT_ANSWERED: 'call-was-not-answered',
  CALL_WAS_FAILED: 'call-was-failed',
  CALL_HISTORY_WAS_CREATED: 'call-history-was-created',
  // Manual
  MANUAL_CALL_ACW_CONNECTED: 'manual-call-acw-connected',
  MANUAL_CALL_ACW_DISCONNECTED: 'manual-call-acw-disconnected',
  // Spy
  SPY_STARTED: 'spy-started',
  SPY_ENDED: 'spy-ended',
  SPY_FAILED: 'spy-failed',
  // Outros
  HOLD_CALL: 'hold-call',
  LIST_EMPTY: 'list-empty',
  REACHED_MAX_ONLINE_AGENTS: 'reached-max-online-agents',
  // Consulta/Transferência
  CONSULT_HOLD: 'consult-hold',
  CONSULT_EXIT: 'consult-exit',
  CONSULT_TRANSFER: 'consult-transfer',
  CONSULT_CANCEL_HOLD: 'consult-cancel-hold',
  CONSULT_CONNECTED: 'consult-connected',
  CONSULT_FAILED: 'consult-failed',
  CONSULT_TRANSFER_FAILED: 'consult-transfer-failed',
  // Emitidos pelo socket em produção, mas ausentes do Swagger (observados em 25/09/2026)
  CALL_IS_TRYING: 'call-is-trying',
  CALL_WAS_AMD: 'call-was-amd',
};

// Nomes alternativos que o socket já emitiu em versões anteriores. Tratados como sinônimos
// dos eventos oficiais para não perder ligações se o 3C voltar a usá-los.
const ALIASES = {
  ATENDIDA: ['call-answered'],
  ENCERRADA: ['call-finished', 'call-ended'],
  NAO_ATENDIDA: ['call-not-answered', 'call-was-busy', 'call-failed'],
  MODO_MANUAL: ['agent-entered-manual-mode'],
  AGENTE: ['agent-is-free', 'agent-is-connected', 'agent-entered-call'],
};

// ── Roteamento dos eventos do socket do agente ───────────────
// Para onde cada evento vai no TelefoniaContext. Função pura, coberta por testes.
export const ROTAS_SOCKET = {
  LOGIN_FALHOU: 'login_falhou',
  MODO_MANUAL: 'modo_manual',
  AGENTE: 'agente',
  NAO_ATENDIDA: 'nao_atendida',
  ENCERRADA: 'encerrada',
  MANUAL_ATENDIDA: 'manual_atendida',
  ATENDIDA: 'atendida',
  AVISO_OPERACIONAL: 'aviso_operacional',
};

// Avisos que o agente precisa ver, mas que não mudam o estado da ligação
export const AVISO_EVENTS = [
  SOCKET_EVENTS.AGENT_SCHEDULE,
  SOCKET_EVENTS.LIST_EMPTY,
  SOCKET_EVENTS.REACHED_MAX_ONLINE_AGENTS,
];

const ROTA_POR_EVENTO = new Map([
  [SOCKET_EVENTS.AGENT_LOGIN_FAILED, ROTAS_SOCKET.LOGIN_FALHOU],
  ...[SOCKET_EVENTS.AGENT_ENTERED_MANUAL, ...ALIASES.MODO_MANUAL].map((e) => [e, ROTAS_SOCKET.MODO_MANUAL]),
  ...[
    SOCKET_EVENTS.AGENT_IS_IDLE, SOCKET_EVENTS.AGENT_IN_ACW, SOCKET_EVENTS.AGENT_ENTERED_MANUAL_ACW,
    SOCKET_EVENTS.AGENT_ENTERED_WORK_BREAK, SOCKET_EVENTS.AGENT_LEFT_WORK_BREAK, SOCKET_EVENTS.AGENT_LEFT_MANUAL_MODE,
    SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT, SOCKET_EVENTS.AGENT_FAILED_TO_ENTER_MANUAL,
    SOCKET_EVENTS.AGENT_FAILED_TO_LEAVE_MANUAL,
    SOCKET_EVENTS.AGENT_ENTER_WORK_BREAK_FAILED, SOCKET_EVENTS.AGENT_LEAVE_WORK_BREAK_FAILED,
    SOCKET_EVENTS.AGENT_LEFT_MANUAL_ACW, ...ALIASES.AGENTE,
  ].map((e) => [e, ROTAS_SOCKET.AGENTE]),
  ...[SOCKET_EVENTS.CALL_WAS_NOT_ANSWERED, SOCKET_EVENTS.CALL_WAS_FAILED, ...ALIASES.NAO_ATENDIDA].map((e) => [e, ROTAS_SOCKET.NAO_ATENDIDA]),
  ...[SOCKET_EVENTS.CALL_WAS_FINISHED, SOCKET_EVENTS.CALL_WAS_ABANDONED, ...ALIASES.ENCERRADA].map((e) => [e, ROTAS_SOCKET.ENCERRADA]),
  ['manual-call-was-answered', ROTAS_SOCKET.MANUAL_ATENDIDA],
  ...[SOCKET_EVENTS.CALL_WAS_CONNECTED, SOCKET_EVENTS.CALL_WAS_ANSWERED, ...ALIASES.ATENDIDA].map((e) => [e, ROTAS_SOCKET.ATENDIDA]),
  ...AVISO_EVENTS.map((e) => [e, ROTAS_SOCKET.AVISO_OPERACIONAL]),
]);

// Falhas de ação do agente: o 3C recusou o pedido (a API já tinha respondido 204).
// O estado do agente não muda — só precisamos avisar quem clicou.
export const MENSAGENS_FALHA_AGENTE = {
  [SOCKET_EVENTS.AGENT_FAILED_TO_ENTER_MANUAL]: 'O 3C Plus não conseguiu colocar você no modo de ligação manual.',
  [SOCKET_EVENTS.AGENT_FAILED_TO_LEAVE_MANUAL]: 'O 3C Plus não conseguiu tirar você do modo de ligação manual.',
  [SOCKET_EVENTS.AGENT_ENTER_WORK_BREAK_FAILED]: 'O 3C Plus não conseguiu iniciar o seu intervalo.',
  [SOCKET_EVENTS.AGENT_LEAVE_WORK_BREAK_FAILED]: 'O 3C Plus não conseguiu encerrar o seu intervalo.',
};

export function rotaDoEvento(evento) {
  return ROTA_POR_EVENTO.get(String(evento || '')) ?? null;
}

// ── Ações no CallLifecycleManager disparadas por cada evento ─
export function acaoCicloDeVida(evento) {
  switch (rotaDoEvento(evento)) {
    case ROTAS_SOCKET.MODO_MANUAL: return 'START_CALL';
    case ROTAS_SOCKET.ATENDIDA: return 'CONNECTED';
    case ROTAS_SOCKET.MANUAL_ATENDIDA: return 'CONNECTED_MANUAL';
    case ROTAS_SOCKET.ENCERRADA: return 'HANGUP';
    case ROTAS_SOCKET.NAO_ATENDIDA: return 'NOT_ANSWERED';
    case ROTAS_SOCKET.LOGIN_FALHOU: return 'RESET';
    default:
      return evento === SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT ? 'RESET' : null;
  }
}

// Eventos que confirmam login bem-sucedido
export const LOGIN_SUCCESS_EVENTS = [SOCKET_EVENTS.AGENT_IS_IDLE];

// Eventos que indicam falha no login
export const LOGIN_FAILURE_EVENTS = [SOCKET_EVENTS.AGENT_LOGIN_FAILED];

// Eventos de mudança de estado do agente (para roteamento no socket)
export const AGENT_STATE_EVENTS = [
  SOCKET_EVENTS.AGENT_IS_IDLE,
  SOCKET_EVENTS.AGENT_IN_ACW,
  SOCKET_EVENTS.AGENT_LOGIN_FAILED,
  SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT,
  SOCKET_EVENTS.AGENT_ENTERED_MANUAL,
  SOCKET_EVENTS.AGENT_FAILED_TO_ENTER_MANUAL,
  SOCKET_EVENTS.AGENT_LEFT_MANUAL_MODE,
  SOCKET_EVENTS.AGENT_ENTERED_MANUAL_ACW,
  SOCKET_EVENTS.AGENT_LEFT_MANUAL_ACW,
  SOCKET_EVENTS.AGENT_ENTERED_WORK_BREAK,
  SOCKET_EVENTS.AGENT_ENTER_WORK_BREAK_FAILED,
  SOCKET_EVENTS.AGENT_LEFT_WORK_BREAK,
  SOCKET_EVENTS.AGENT_LEAVE_WORK_BREAK_FAILED,
];

// Mapeamento: evento socket → novo estado do agente
export const EVENT_TO_STATUS = {
  [SOCKET_EVENTS.AGENT_IS_IDLE]: AGENT_STATUS.IDLE,
  [SOCKET_EVENTS.AGENT_IN_ACW]: AGENT_STATUS.ACW,
  [SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT]: AGENT_STATUS.OFFLINE,
  [SOCKET_EVENTS.AGENT_ENTERED_MANUAL]: AGENT_STATUS.MANUAL,
  [SOCKET_EVENTS.AGENT_LEFT_MANUAL_MODE]: AGENT_STATUS.IDLE,
  [SOCKET_EVENTS.AGENT_ENTERED_MANUAL_ACW]: AGENT_STATUS.MANUAL_ACW,
  [SOCKET_EVENTS.AGENT_LEFT_MANUAL_ACW]: AGENT_STATUS.MANUAL,
  [SOCKET_EVENTS.AGENT_ENTERED_WORK_BREAK]: AGENT_STATUS.WORK_BREAK,
  [SOCKET_EVENTS.AGENT_LEFT_WORK_BREAK]: AGENT_STATUS.IDLE,
  [SOCKET_EVENTS.AGENT_LOGIN_FAILED]: AGENT_STATUS.OFFLINE,
};

// ── Comandos HTTP (serverless executarComando3CPlus) ─────────
export const COMMANDS = {
  AGENT_CONNECT: 'agent-connect',
  AGENT_LOGIN: 'agent-login',
  AGENT_LOGOUT: 'agent-logout',
  AGENT_PAUSE: 'agent-pause',
  AGENT_RESUME: 'agent-resume',
  MANUAL_DIAL: 'manual-dial',
  QUALIFY_CALL: 'qualify-call',
  END_CALL: 'end-call',
  GET_AGENT_STATUS: 'get-agent-status',
  GET_LOGGED_CAMPAIGN: 'get-logged-campaign',
  GET_CAMPAIGNS: 'get-campaigns',
  GET_WORK_BREAKS: 'get-work-breaks',
  GET_QUALIFICATIONS: 'get-qualifications',
};

// ── Timeouts (ms) ────────────────────────────────────────────
export const TIMEOUTS = {
  LOGIN_CONFIRMATION: 15000,
  LOGOUT_CONFIRMATION: 10000,
  HTTP_REQUEST: 8000,
  HEARTBEAT_INTERVAL: 60000,
  RECONNECT_DELAY: 2000,
  RECONNECT_MAX_ATTEMPTS: 10,
  RESTORE_RETRY_DELAYS: [0, 500, 1500],
};

// ── Condições do Heartbeat ───────────────────────────────────
// O heartbeat só roda quando TODAS as condições são verdadeiras
export const HEARTBEAT_CONDITIONS = {
  TAB_VISIBLE: 'tab_visible',
  USER_LOGGED_IN: 'user_logged_in',
  CAMPAIGN_ACTIVE: 'campaign_active',
  SOCKET_CONNECTED: 'socket_connected',
};

// ── Contratos dos comandos ───────────────────────────────────
// Cada comando documenta: entrada, saída esperada, evento de confirmação, timeout
export const COMMAND_CONTRACTS = {
  [COMMANDS.AGENT_CONNECT]: {
    method: 'POST',
    endpoint: '/agent/connect',
    params: [],
    httpResponse: 204,
    confirmationEvent: null,
    timeout: TIMEOUTS.HTTP_REQUEST,
  },
  [COMMANDS.AGENT_LOGIN]: {
    method: 'POST',
    endpoint: '/agent/login',
    params: ['campanha_id'],
    httpResponse: 204,
    confirmationEvent: SOCKET_EVENTS.AGENT_IS_IDLE,
    failureEvent: SOCKET_EVENTS.AGENT_LOGIN_FAILED,
    timeout: TIMEOUTS.LOGIN_CONFIRMATION,
  },
  [COMMANDS.AGENT_LOGOUT]: {
    method: 'POST',
    endpoint: '/agent/logout',
    params: [],
    httpResponse: 204,
    confirmationEvent: SOCKET_EVENTS.AGENT_WAS_LOGGED_OUT,
    timeout: TIMEOUTS.LOGOUT_CONFIRMATION,
  },
  [COMMANDS.GET_LOGGED_CAMPAIGN]: {
    method: 'GET',
    endpoint: '/agent/loggedCampaign',
    params: [],
    httpResponse: 200,
    confirmationEvent: null,
    timeout: TIMEOUTS.HTTP_REQUEST,
  },
};

// ── Socket URL oficial ───────────────────────────────────────
// Domínio documentado desde 02/03/2025. new-socket.3c.plus é o mesmo serviço (entrega os
// mesmos eventos — verificado em 25/09/2026); VITE_3CPLUS_SOCKET_URL permite trocar sem deploy de código.
export const SOCKET_URL = import.meta.env?.VITE_3CPLUS_SOCKET_URL || 'https://socket.3c.plus';

// ── Extension/WebRTC URL ─────────────────────────────────────
export function getExtensionUrl(dominio, token) {
  return `https://${dominio}.3c.plus/extension?api_token=${encodeURIComponent(token)}`;
}

// ── Validador de transição ───────────────────────────────────
export function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}