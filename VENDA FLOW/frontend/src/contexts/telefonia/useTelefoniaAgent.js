/**
 * useTelefoniaAgent
 * Responsabilidade única: estado do agente na campanha.
 *
 * FONTE DA VERDADE: 3C Plus API — nunca useState/localStorage sozinhos.
 *
 * current3CSession = {
 *   connected, campaignId, campaignName, agentStatus, startedAt, elapsedSeconds
 * }
 *
 * O cronômetro NÃO usa setInterval como fonte da verdade.
 * elapsed = Math.floor((Date.now() - startedAt) / 1000) → sobrevive a F5.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/api/client';

export function get3CBaseUrl(dominio) {
  if (dominio) return `https://${dominio}.3c.plus/api/v1`;
  return null; // domínio obrigatório — sem fallback para evitar URLs erradas
}

function normalize3CResponse(campaignRaw) {
  const campaign = campaignRaw?.data ?? campaignRaw ?? null;
  const campaignId   = campaign?.id   ?? campaign?.campaign_id   ?? null;
  const campaignName = campaign?.name ?? campaign?.campaign_name ?? null;
  return { campaignId, campaignName, status: null, startedAt: null };
}

// Estado inicial "desconectado"
const SESSION_VAZIA = {
  connected: false,
  campaignId: null,
  campaignName: null,
  agentStatus: 'offline',
  startedAt: null,
  elapsedSeconds: 0,
};

export function useTelefoniaAgent() {
  const [agentStatus, setAgentStatus]               = useState({ status: 'livre', timestamp: new Date() });
  const [agenteCampanhaAtiva, setAgenteCampanhaAtiva] = useState(false);
  const [nomeCampanhaAtiva, setNomeCampanhaAtiva]   = useState(null);
  const [estadoCampanha, setEstadoCampanha]         = useState('idle');
  const [tempoEstado, setTempoEstado]               = useState(0);
  const [current3CSession, setCurrent3CSession]     = useState(SESSION_VAZIA);

  const [loginPending, setLoginPending]             = useState(false);
  const loginPendingRef                             = useRef(false);

  const estadoInicializadoRef  = useRef(false);
  const restoreInProgressRef   = useRef(false);  // Impede execuções concorrentes
  const current3CSessionRef    = useRef(SESSION_VAZIA); // Leitura síncrona do estado atual
  const tempoEstadoRef         = useRef(0);
  const intervalEstadoRef      = useRef(null);
  // Tick para recalcular elapsed a partir de startedAt (sobrevive a F5 via Date.now())
  const tickIntervalRef        = useRef(null);

  const marcarLoginPending = useCallback((pending) => {
    loginPendingRef.current = pending;
    setLoginPending(pending);
  }, []);

  // ── Cronômetro de estado (aguardando/falando/tpa) ────────────────────
  // Atualiza tempoEstado a cada segundo mas calcula a partir de startedAt
  const iniciarCronometroEstado = useCallback((estado, startedAtMs = null) => {
    if (intervalEstadoRef.current) clearInterval(intervalEstadoRef.current);
    const origem = startedAtMs || Date.now();
    tempoEstadoRef.current = Math.floor((Date.now() - origem) / 1000);
    setTempoEstado(tempoEstadoRef.current);
    setEstadoCampanha(estado);
    intervalEstadoRef.current = setInterval(() => {
      tempoEstadoRef.current = Math.floor((Date.now() - origem) / 1000);
      setTempoEstado(tempoEstadoRef.current);
    }, 1000);
  }, []);

  const pararCronometroEstado = useCallback(() => {
    if (intervalEstadoRef.current) { clearInterval(intervalEstadoRef.current); intervalEstadoRef.current = null; }
    tempoEstadoRef.current = 0;
    setTempoEstado(0);
    setEstadoCampanha('idle');
  }, []);

  // ── Tick para elapsed do current3CSession ───────────────────────────
  useEffect(() => {
    if (!current3CSession.connected || !current3CSession.startedAt) {
      if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
      return;
    }
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      setCurrent3CSession(s => s.startedAt
        ? { ...s, elapsedSeconds: Math.floor((Date.now() - s.startedAt) / 1000) }
        : s
      );
    }, 1000);
    return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
  }, [current3CSession.connected, current3CSession.startedAt]);

  // ── Atualizar session a partir de um status 3C ────────────────────
  const _aplicarStatus3C = useCallback((status3C, campanha, startedAt) => {
    const agentSt3C = status3C || 'idle';
    const connected = !!campanha;
    const agentStatusMap = {
      'idle': 'aguardando', 'free': 'aguardando',
      'in_call': 'falando', 'connected': 'falando', 'talking': 'falando',
      'acw': 'tpa', 'in_acw': 'tpa',
      'work_break': 'pausa',
      'manual': 'manual',
    };
    const estadoVisual = agentStatusMap[agentSt3C] || 'idle';

    const newSession = {
      connected,
      campaignId:    campanha?.id   || campanha?.campaign_id || null,
      campaignName:  campanha?.name || campanha?.campaign_name || null,
      agentStatus:   agentSt3C,
      startedAt,
      elapsedSeconds: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
    };
    current3CSessionRef.current = newSession;
    setCurrent3CSession(newSession);

    if (connected) {
      setAgenteCampanhaAtiva(true);
      setNomeCampanhaAtiva(campanha?.name || campanha?.campaign_name || null);
      if (estadoVisual !== 'idle') {
        iniciarCronometroEstado(estadoVisual, startedAt || undefined);
      } else {
        iniciarCronometroEstado('aguardando', startedAt || undefined);
      }
      // Propagar para SeletorCampanha via CustomEvent
      window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', {
        detail: {
          ativa: true,
          nome: campanha?.name || campanha?.campaign_name,
          id: campanha?.id || campanha?.campaign_id,
        },
      }));
    } else {
      setAgenteCampanhaAtiva(false);
      setNomeCampanhaAtiva(null);
      pararCronometroEstado();
      setCurrent3CSession(SESSION_VAZIA);
    }
  }, [iniciarCronometroEstado, pararCronometroEstado]);

  // ── restoreAgentState — fonte da verdade = 3C Plus ──────────────────
  const restoreAgentState = useCallback(async (token, forceReset = false, dominio = null, empresaId = null) => {
    if (!token) return;
    if (!forceReset && estadoInicializadoRef.current) return;

    if (restoreInProgressRef.current) return;
    restoreInProgressRef.current = true;
    estadoInicializadoRef.current = true;

    try {
      if (!empresaId) {
        console.warn('[useTelefoniaAgent] restoreAgentState — empresaId obrigatório (chamadas diretas ao 3C foram removidas)');
        restoreInProgressRef.current = false;
        return;
      }

      // Via serverless — token nunca exposto no frontend
      const resp = await api.functions.invoke('executarComando3CPlus', {
        empresaId,
        comando: 'get-logged-campaign',
      });
      const campanhaRaw = resp?.data?.dados ?? resp?.dados ?? null;

      const { campaignId, campaignName, status, startedAt } = normalize3CResponse(campanhaRaw);
      const hasCampanha = !!campaignId;

      if (hasCampanha) {
        const current = current3CSessionRef.current;
        if (current.connected && current.campaignId && String(current.campaignId) !== String(campaignId)) {
          console.warn('[useTelefoniaAgent] restoreAgentState — sessão ativa em campanha diferente, ignorando sobrescrita', {
            atual: current.campaignId, nova: campaignId,
          });
          return;
        }
        _aplicarStatus3C(status || 'idle', { id: campaignId, name: campaignName }, startedAt);
      } else {
        // loggedCampaign é não-confiável (422 p/ webphone:false). Só limpar se
        // NÃO houver sessão local ativa — senão tratar null como inconclusivo.
        if (!current3CSessionRef.current?.connected) {
          current3CSessionRef.current = SESSION_VAZIA;
          setCurrent3CSession(SESSION_VAZIA);
          setAgenteCampanhaAtiva(false);
          setNomeCampanhaAtiva(null);
          pararCronometroEstado();
        } else {
          console.warn('[useTelefoniaAgent] restoreAgentState — loggedCampaign vazio mas sessão local ativa; mantendo estado (endpoint não-confiável)');
        }
      }
    } catch (e) {
      console.warn('[useTelefoniaAgent] restoreAgentState erro:', e.message);
      if (!current3CSessionRef.current?.connected) {
        current3CSessionRef.current = SESSION_VAZIA;
        setCurrent3CSession(SESSION_VAZIA);
        setAgenteCampanhaAtiva(false);
        setNomeCampanhaAtiva(null);
        pararCronometroEstado();
      }
    } finally {
      restoreInProgressRef.current = false;
    }
  }, [_aplicarStatus3C, pararCronometroEstado]);

  // Alias para compatibilidade com código anterior
  const sincronizarEstadoInicial = restoreAgentState;

  // ── Verificar antes de fazer login (evita "Limite excedido") ─────────
  // Via serverless — sem chamadas diretas ao 3C a partir do navegador
  const verificarAntesDeEntrar = useCallback(async (token, campanhaId, dominio = null, empresaId = null) => {
    if (!empresaId) return { jaConectado: false };
    try {
      const resp = await api.functions.invoke('executarComando3CPlus', {
        empresaId,
        comando: 'get-logged-campaign',
      });
      const raw = resp?.data?.dados ?? resp?.dados ?? null;

      const { campaignId: currentCampaignId, campaignName } = normalize3CResponse(raw);
      const jaConectado   = !!currentCampaignId;
      const mesmaCampanha = String(currentCampaignId) === String(campanhaId);

      if (jaConectado) {
        _aplicarStatus3C('idle', { id: currentCampaignId, name: campaignName }, null);
      }

      return { jaConectado, mesmaCampanha, campanha: { id: currentCampaignId, name: campaignName } };
    } catch {
      return { jaConectado: false };
    }
  }, [_aplicarStatus3C]);

  // ── Handlers de eventos socket ───────────────────────────────────────
  const processarEventoAgente = useCallback((evento) => {
    switch (evento) {
      case 'agent-is-idle':
      case 'agent-is-free':
      case 'agent-left-manual-mode':
      case 'agent-left-work-break':
        marcarLoginPending(false);
        iniciarCronometroEstado('aguardando');
        setCurrent3CSession(s => ({ ...s, agentStatus: 'idle' }));
        break;
      case 'agent-is-connected':
      case 'agent-entered-call':
        iniciarCronometroEstado('falando');
        setCurrent3CSession(s => ({ ...s, agentStatus: 'in_call' }));
        break;
      case 'agent-in-acw':
      case 'agent-entered-manual-acw':
        iniciarCronometroEstado('tpa');
        setCurrent3CSession(s => ({ ...s, agentStatus: 'acw' }));
        break;
      case 'agent-entered-manual-mode':
      case 'agent-entered-manual':
      case 'agent-left-manual-acw': // saiu do TPA manual → volta ao modo manual (EVENT_TO_STATUS)
        pararCronometroEstado();
        setCurrent3CSession(s => ({ ...s, agentStatus: 'manual' }));
        break;
      case 'agent-entered-work-break':
        pararCronometroEstado();
        setAgentStatus({ status: 'em_pausa', timestamp: new Date() });
        setCurrent3CSession(s => ({ ...s, agentStatus: 'work_break' }));
        break;
      case 'agent-was-logged-out':
        pararCronometroEstado();
        setAgenteCampanhaAtiva(false);
        setNomeCampanhaAtiva(null);
        setCurrent3CSession(SESSION_VAZIA);
        break;
      case 'agent-login-failed':
        // Com webphone:false o 3C emite agent-login-failed mesmo quando o ramal
        // registra via extensão. NÃO limpar o estado de campanha aqui — logout real
        // vem por agent-was-logged-out ou pelo botão "Sair".
        console.warn('[useTelefoniaAgent] agent-login-failed ignorado (webphone:false — ramal registra via extensão)');
        marcarLoginPending(false);
        break;
    }
  }, [iniciarCronometroEstado, pararCronometroEstado, marcarLoginPending]);

  useEffect(() => {
    return () => {
      if (intervalEstadoRef.current) clearInterval(intervalEstadoRef.current);
      if (tickIntervalRef.current)   clearInterval(tickIntervalRef.current);
    };
  }, []);

  return {
    agentStatus, setAgentStatus,
    agenteCampanhaAtiva, setAgenteCampanhaAtiva,
    nomeCampanhaAtiva, setNomeCampanhaAtiva,
    estadoCampanha, tempoEstado,
    current3CSession, setCurrent3CSession,
    iniciarCronometroEstado, pararCronometroEstado,
    processarEventoAgente,
    restoreAgentState,
    sincronizarEstadoInicial, // alias de compatibilidade
    verificarAntesDeEntrar,
    SESSION_VAZIA,
    loginPending, marcarLoginPending, loginPendingRef,
  };
}