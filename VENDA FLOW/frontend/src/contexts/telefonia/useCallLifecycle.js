import { useSyncExternalStore, useCallback } from 'react';
import { callLifecycle, IDLE, DISCANDO, TOCANDO, ATENDIDA, EM_ATENDIMENTO, ENCERRADA, QUALIFICANDO, ACW, PRONTA } from './CallLifecycleManager';

export const STATES = { IDLE, DISCANDO, TOCANDO, ATENDIDA, EM_ATENDIMENTO, ENCERRADA, QUALIFICANDO, ACW, PRONTA };

export function useCallLifecycle() {
  const state = useSyncExternalStore(
    callLifecycle.subscribe,
    callLifecycle.getState,
    callLifecycle.getState
  );

  const session = useSyncExternalStore(
    callLifecycle.subscribe,
    callLifecycle.getSession,
    callLifecycle.getSession
  );

  const dispatch = useCallback((action, payload) => {
    return callLifecycle.dispatch(action, payload);
  }, []);

  const qualificacoes = session?.qualifications || [];
  const eventos = session?.events || [];
  const callId = session?.callId || null;
  const leadId = session?.leadId || null;

  // Helpers de estado
  const isIdle = state === STATES.IDLE;
  const isEmLigacao = state === STATES.EM_ATENDIMENTO;
  const isEncerrada = state === STATES.ENCERRADA;
  const isQualificando = state === STATES.QUALIFICANDO;
  const isAcw = state === STATES.ACW;
  const isPronta = state === STATES.PRONTA;
  const podeSelecionarResultado = state === STATES.EM_ATENDIMENTO || state === STATES.ENCERRADA || state === STATES.QUALIFICANDO;
  const podeSelecionarQualificacao = state === STATES.ENCERRADA || state === STATES.QUALIFICANDO;
  const podeRegistrar = state === STATES.QUALIFICANDO;
  const modalAberto = state !== STATES.IDLE && state !== STATES.PRONTA;

  return {
    state,
    session,
    dispatch,
    qualificacoes,
    eventos,
    callId,
    leadId,
    isIdle,
    isEmLigacao,
    isEncerrada,
    isQualificando,
    isAcw,
    isPronta,
    podeSelecionarResultado,
    podeSelecionarQualificacao,
    podeRegistrar,
    modalAberto,
    STATES,
  };
}