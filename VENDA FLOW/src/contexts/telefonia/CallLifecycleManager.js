// ─────────────────────────────────────────────────────────────
// CallLifecycleManager.js
// Máquina de estados pura (sem React) para ciclo de vida de ligação
// ─────────────────────────────────────────────────────────────

export const IDLE          = 'IDLE';
export const DISCANDO      = 'DISCANDO';
export const TOCANDO       = 'TOCANDO';
export const ATENDIDA      = 'ATENDIDA';
export const EM_ATENDIMENTO = 'EM_ATENDIMENTO';
export const ENCERRADA     = 'ENCERRADA';
export const QUALIFICANDO  = 'QUALIFICANDO';
export const ACW           = 'ACW';
export const PRONTA        = 'PRONTA';

// Transições válidas: { [fromState]: { [action]: toState } }
const TRANSITIONS = {
  [IDLE]:           { START_CALL: DISCANDO, CONNECTED: ATENDIDA, NOT_ANSWERED: PRONTA },
  [DISCANDO]:       { RINGING: TOCANDO,       CONNECTED: ATENDIDA, HANGUP: ENCERRADA, NOT_ANSWERED: ENCERRADA },
  [TOCANDO]:        { CONNECTED: ATENDIDA,    HANGUP: ENCERRADA, NOT_ANSWERED: ENCERRADA },
  [ATENDIDA]:       { HANGUP: ENCERRADA },
  [EM_ATENDIMENTO]: { HANGUP: ENCERRADA,      SELECT_RESULT: QUALIFICANDO },
  [ENCERRADA]:      { SELECT_RESULT: QUALIFICANDO },
  [QUALIFICANDO]:   { SUBMIT: ACW },
  [ACW]:            { FINALIZED: PRONTA },
  [PRONTA]:         {},
};

const RESET_ACTION = 'RESET';

function makeSession() {
  return {
    callId: null,
    uniqueId: null,
    campaignId: null,
    leadId: null,
    qualifications: [],
    startedAt: null,
    events: [],
  };
}

export function createCallLifecycle() {
  let state   = IDLE;
  let session = makeSession();
  const subscribers = new Set();

  function notify() {
    subscribers.forEach(fn => { try { fn(state, session); } catch (e) { console.error('[CallLifecycle] subscriber error:', e); } });
  }

  function logEvent(action, payload, fromState, toState) {
    session.events.push({ type: action, at: new Date().toISOString(), data: payload || null, fromState, toState });
  }

  function transitionTo(action, toState, payload) {
    const from = state;
    state = toState;
    logEvent(action, payload, from, toState);
    notify();
    return state;
  }

  function dispatch(action, payload) {
    // Reset forçado — de qualquer estado
    if (action === RESET_ACTION) {
      const from = state;
      state   = IDLE;
      session = makeSession();
      notify();
      console.log(`[CallLifecycle] RESET forçado de ${from}`);
      return state;
    }

    const allowed = TRANSITIONS[state] || {};
    const toState = allowed[action];

    if (!toState) {
      console.warn(`[CallLifecycle] Transição inválida: ${action} em estado ${state}`);
      return state;
    }

    // Atualizar sessão por action antes de transicionar
    if (action === 'START_CALL') {
      session.leadId     = payload?.leadId     || null;
      session.campaignId = payload?.campaignId || null;
    }

    if (action === 'CONNECTED') {
      session.callId         = payload?.callId    || null;
      session.uniqueId       = payload?.uniqueId  || null;
      session.qualifications = payload?.qualifications || [];
      session.startedAt      = new Date().toISOString();
      if (payload?.mailing) session.mailing = payload.mailing;
    }

    if (action === 'SELECT_RESULT') {
      session.resultado        = payload?.resultado       || null;
      session.qualificationId  = payload?.qualificationId || null;
    }

    // Transicionar para toState
    transitionTo(action, toState, payload);

    // CONNECTED: transição automática ATENDIDA -> EM_ATENDIMENTO
    if (action === 'CONNECTED') {
      const from = state; // ATENDIDA
      state = EM_ATENDIMENTO;
      logEvent('CONNECTED_AUTO', null, from, EM_ATENDIMENTO);
      notify();
    }

    // FINALIZED: auto-reset após 1500ms
    if (action === 'FINALIZED') {
      setTimeout(() => dispatch(RESET_ACTION), 1500);
    }

    return state;
  }

  function getState() {
    return state;
  }

  function getSession() {
    return session;
  }

  function subscribe(listener) {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  }

  function reset() {
    return dispatch(RESET_ACTION);
  }

  return { getState, getSession, dispatch, subscribe, reset };
}

// Singleton compartilhado pela aplicação
export const callLifecycle = createCallLifecycle();