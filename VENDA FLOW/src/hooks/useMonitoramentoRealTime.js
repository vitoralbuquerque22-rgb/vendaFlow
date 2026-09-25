/**
 * useMonitoramentoRealTime
 * Mantém estado de agentes/campanhas em memória via socket gestor.
 * Faz fetch REST inicial para estado completo, depois atualiza via socket.
 * Exporta dados no formato que MonitoramentoAoVivo já consome.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTelefoniaSocketGestor } from '@/contexts/telefonia/useTelefoniaSocketGestor';

const STATUS_MAP = {
  0:  { label: 'Offline',     cor: 'slate',   icone: '⚫' },
  1:  { label: 'Disponível',  cor: 'emerald', icone: '🟢' },
  2:  { label: 'Em ligação',  cor: 'sky',     icone: '📞' },
  3:  { label: 'Pós-atend.',  cor: 'amber',   icone: '⏳' },
  4:  { label: 'Manual',      cor: 'violet',  icone: '📱' },
  5:  { label: 'Em ligação',  cor: 'sky',     icone: '📞' },
  6:  { label: 'Em pausa',    cor: 'orange',  icone: '⏸️' },
  21: { label: 'Pós-manual',  cor: 'amber',   icone: '⏳' },
};

const EVENTO_PARA_STATUS = {
  'agent-is-idle':              1,
  'agent-is-free':              1,
  'agent-is-connected':         2,
  'agent-entered-call':         2,
  'agent-in-acw':               3,
  'agent-entered-manual-acw':   21,
  'agent-entered-manual-mode':  4,
  'agent-left-manual-mode':     1,
  'agent-entered-work-break':   6,
  'agent-left-work-break':      1,
  'agent-was-logged-out':       0,
  'agent-logged-out':           0,
};

function calcularMetricas(agentesMap) {
  const lista = Array.from(agentesMap.values());
  return {
    emLigacao:   lista.filter(a => a.em_ligacao).length,
    disponiveis: lista.filter(a => a.disponivel).length,
    emPausa:     lista.filter(a => a.em_pausa).length,
    total:       lista.length,
  };
}

export function useMonitoramentoRealTime({ empresaId, tokenGestor, habilitado = true }) {
  const [agentes, setAgentes] = useState([]);
  const [metricas, setMetricas] = useState({});
  const [campanhas, setCampanhas] = useState([]);
  const [conectadoSocket, setConectadoSocket] = useState(false);
  const [ultimaAtt, setUltimaAtt] = useState(null);
  const agentesMapRef = useRef(new Map());

  // Atualizar state a partir do map
  const sincronizarState = useCallback(() => {
    const lista = Array.from(agentesMapRef.current.values())
      .sort((a, b) => b.status - a.status);
    setAgentes(lista);
    setMetricas(calcularMetricas(agentesMapRef.current));
    setUltimaAtt(new Date());
  }, []);

  // Fetch REST inicial — carrega estado completo de todos os agentes
  const carregarEstadoInicial = useCallback(async () => {
    if (!empresaId) return;
    try {
      const res = await base44.functions.invoke('monitoramento3CPlus', { empresaId });
      const dados = res?.data || res;
      if (!dados?.agentes) return;
      agentesMapRef.current.clear();
      for (const a of dados.agentes) {
        agentesMapRef.current.set(a.id, a);
      }
      setCampanhas(dados.campanhas || []);
      sincronizarState();
    } catch (e) {
      console.warn('[useMonitoramentoRealTime] erro no fetch inicial:', e.message);
    }
  }, [empresaId, sincronizarState]);

  // Handlers do socket gestor
  const onEventoAgente = useCallback((evento, data) => {
    const novoStatus = EVENTO_PARA_STATUS[evento];
    if (novoStatus === undefined) return;

    const agenteId = data?.agent_id || data?.agent?.id || data?.id;
    if (!agenteId) return;

    const existente = agentesMapRef.current.get(agenteId);
    if (existente) {
      const statusInfo = STATUS_MAP[novoStatus] || STATUS_MAP[0];
      agentesMapRef.current.set(agenteId, {
        ...existente,
        status: novoStatus,
        status_label: statusInfo.label,
        status_cor: statusInfo.cor,
        status_icone: statusInfo.icone,
        em_ligacao: novoStatus === 2 || novoStatus === 5,
        em_pausa: novoStatus === 6,
        disponivel: novoStatus === 1,
        duracao: 0,
      });
    } else {
      // Agente novo — adicionar com dados básicos do evento
      const statusInfo = STATUS_MAP[novoStatus] || STATUS_MAP[0];
      agentesMapRef.current.set(agenteId, {
        id: agenteId,
        nome: data?.agent?.name || data?.name || `Agente ${agenteId}`,
        email: data?.agent?.email || data?.email || '',
        ramal: data?.agent?.extension || '',
        status: novoStatus,
        status_label: statusInfo.label,
        status_cor: statusInfo.cor,
        status_icone: statusInfo.icone,
        campanha_id: data?.campaign_id || null,
        campanha_nome: '',
        duracao: 0,
        em_ligacao: novoStatus === 2 || novoStatus === 5,
        em_pausa: novoStatus === 6,
        disponivel: novoStatus === 1,
      });
    }
    sincronizarState();
  }, [sincronizarState]);

  const onEventoCampanha = useCallback((evento, data) => {
    // Futuro: tratar eventos de campanha (pausada, retomada, etc)
    console.log('[MonitoramentoRT] evento campanha:', evento);
  }, []);

  const onEventoChamada = useCallback((_evento, _data) => {
    // Chamadas já são tratadas indiretamente via status do agente
  }, []);

  // Socket gestor
  const { conectado } = useTelefoniaSocketGestor({
    tokenGestor: habilitado ? tokenGestor : null,
    onEventoAgente,
    onEventoCampanha,
    onEventoChamada,
  });

  // Atualizar flag de conexão
  useEffect(() => {
    setConectadoSocket(conectado.current);
  }, [conectado.current]);

  // Carregar estado inicial ao montar
  useEffect(() => {
    if (habilitado && empresaId) {
      carregarEstadoInicial();
    }
  }, [habilitado, empresaId, carregarEstadoInicial]);

  return {
    agentes,
    metricas,
    campanhas,
    conectadoSocket,
    ultimaAtt,
    recarregar: carregarEstadoInicial,
  };
}