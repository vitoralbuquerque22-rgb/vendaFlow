import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { base44 } from "@/api/base44Client";
import { callLifecycle } from '@/contexts/telefonia/CallLifecycleManager';
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "./useEmpresaAtual";
import { buscarUserProfile, buscarIntegracaoTelefonia, buscarCallSessionAtiva, buscarCallSessionPorId, criarCallSession, atualizarCallSession } from "@/lib/services/telefoniaService";
import { listarLeadsPorTelefone, atualizarLead } from "@/lib/services/leadService";

const DEBUG_MODE = import.meta.env.DEV || localStorage.getItem('vendaflow_debug') === 'true';
const log = (...args) => { if (DEBUG_MODE) console.log(...args); };
const warn = (...args) => { if (DEBUG_MODE) console.warn(...args); };

export function useTelefonia3CPlus() {
  const { empresaId } = useEmpresaAtual();
  const [callSession, setCallSession] = useState(null);
  const [agentStatus, setAgentStatus] = useState({
    status: "livre",
    timestamp: null,
  });
  const [estadoCampanha, setEstadoCampanha] = useState('idle'); // 'idle'|'aguardando'|'falando'|'tpa'
  const [tempoEstado, setTempoEstado]       = useState(0);
  const tempoEstadoRef                      = useRef(0);
  const intervalEstadoRef                   = useRef(null);

  const iniciarCronometroEstado = useCallback((estado) => {
    if (intervalEstadoRef.current) clearInterval(intervalEstadoRef.current);
    tempoEstadoRef.current = 0;
    setTempoEstado(0);
    setEstadoCampanha(estado);
    intervalEstadoRef.current = setInterval(() => {
      tempoEstadoRef.current += 1;
      setTempoEstado(t => t + 1);
    }, 1000);
  }, []);

  const pararCronometroEstado = useCallback(() => {
    if (intervalEstadoRef.current) { clearInterval(intervalEstadoRef.current); intervalEstadoRef.current = null; }
    setTempoEstado(0);
    setEstadoCampanha('idle');
  }, []);
  const [cronometro, setCronometro] = useState(0);
  const [qualificacoesCampanha, setQualificacoesCampanha] = useState([]);
  const qualificacoesCampanhaRef = useRef([]);
  const [modalAtendimentoAberto, setModalAtendimentoAberto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agenteCampanhaAtiva, setAgenteCampanhaAtiva] = useState(false);
  const [nomeCampanhaAtiva, setNomeCampanhaAtiva] = useState(null);
  const [manualCallSession, setManualCallSession] = useState(null);
  const manualCallSessionRef = useRef(null);
  const [manualCallStatus, setManualCallStatus] = useState(null);
  // null | "chamando" | "em_ligacao" | "encerrado"
  const [leadCallStatus, setLeadCallStatus] = useState(null);
  // null | "ligando" | "chamando" | "em_ligacao" | "encerrado"
  const [duracaoLigacao, setDuracaoLigacao] = useState(0);
  const duracaoIntervalRef = useRef(null);
  const [cfgTelefonia, setCfgTelefonia] = useState(null);
  const cronometroIntervalRef = useRef(null);
  const socketRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // ─────────────────────────────────────────────────────────────
  // 0. CARREGAR CONFIG 3C PLUS UMA VEZ
  // ─────────────────────────────────────────────────────────────

  // UserProfile via useQuery compartilhado — mesma chave do Softphone
  // staleTime: 0 + refetchOnMount: 'always' garante leitura fresca sem cache stale
  const { data: userProfileHook } = useQuery({
    queryKey: ["userProfile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      return buscarUserProfile(user.email);
    },
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!empresaId || !user?.email) return;
    if (userProfileHook === undefined) return; // aguardar carregar
    async function carregarCfg() {
      try {
        const integracao = await buscarIntegracaoTelefonia(empresaId);
        if (!integracao) return;
        const cfg = integracao.configuracao;
        const emailNorm = (user.email || "").toLowerCase();

        // Token do UserProfile via useQuery (evita race condition e RLS)
        const tokenDoProfile = userProfileHook?.token_3cplus || null;
        // Fallback para mapeamento legado
        const mapeamento = cfg.mapeamento_agentes || {};
        const tokenLegado = mapeamento[emailNorm] || mapeamento[user.email] || cfg.token_agente || null;

        const tokenAgente = tokenDoProfile || tokenLegado || null;
        log('[useTelefonia3CPlus] token encontrado:', tokenAgente ? 'sim' : 'null', '| via:', tokenDoProfile ? 'UserProfile' : tokenLegado ? 'legado' : 'nenhum');
        setCfgTelefonia({ dominio: cfg.dominio, tokenAgente, token: tokenAgente });
      } catch (e) {
        console.warn("[useTelefonia3CPlus] Erro ao carregar cfg:", e.message);
      }
    }
    carregarCfg();
  }, [empresaId, user?.email, userProfileHook?.token_3cplus]);

  // ─────────────────────────────────────────────────────────────
  // RESTAURAR SESSÃO ATIVA AO RECARREGAR A PÁGINA
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!empresaId || !user?.email) return;

    async function restaurarSessaoAtiva() {
      try {
        // Buscar CallSessions ativas deste agente
        const sessoes = await buscarCallSessionAtiva(empresaId, user.email).then(s => s ? [s] : []);

        if (!sessoes || sessoes.length === 0) return;

        // Pegar a mais recente
        const sessao = sessoes.sort((a, b) =>
          new Date(b.iniciada_em || 0) - new Date(a.iniciada_em || 0)
        )[0];

        // Verificar se não é muito antiga (mais de 2 horas = abandonada)
        const iniciada = sessao.iniciada_em ? new Date(sessao.iniciada_em) : null;
        if (iniciada && (Date.now() - iniciada.getTime()) > 2 * 60 * 60 * 1000) return;



        // ── Verificar se ligação ainda está ativa no 3C Plus ──
        // Via serverless — token nunca exposto no navegador
        let ligacaoAindaAtiva = false;
        try {
          const resp = await base44.functions.invoke('executarComando3CPlus', {
            empresaId,
            comando: 'get-agent-status',
          });
          const agentes = resp?.data?.dados?.data || resp?.data?.dados || [];
          if (Array.isArray(agentes)) {
            // Verificar se algum agente com email do usuário está em ligação (status 2 ou 5)
            const agenteEmLigacao = agentes.find(a =>
              (a.status === 2 || a.status === 5) &&
              (a.email === user.email || a.name?.toLowerCase().includes(user.email.split('@')[0].toLowerCase()))
            );
            ligacaoAindaAtiva = !!agenteEmLigacao;
          }
        } catch (e) {
          console.warn('[useTelefonia3CPlus] Erro ao verificar 3C Plus:', e.message);
          // Em caso de erro na verificação, assume que está ativa para não perder dados
          ligacaoAindaAtiva = true;
        }

        // Verificação dupla no banco — o socket pode ter processado call-was-finished durante o delay
        const sessaoAtualizada = await buscarCallSessionPorId(sessao.id).catch(() => null);
        if (sessaoAtualizada?.status === 'finished' || sessaoAtualizada?.status === 'abandoned') {
          console.warn('[useTelefonia3CPlus] Sessão já finalizada durante delay — abortando restauração');
          return;
        }

        if (!ligacaoAindaAtiva) {
          // Ligação não existe mais no 3C Plus — marcar como abandonada no banco
          console.warn('[useTelefonia3CPlus] Ligação não encontrada no 3C Plus — marcando como abandonada');
          try {
            await atualizarCallSession(sessao.id, {
              status: 'abandoned',
              finalizada_em: new Date().toISOString(),
              erro_mensagem: 'Sessão abandonada — ligação não encontrada no 3C Plus ao recarregar',
            });
          } catch (e) {
            console.warn('[useTelefonia3CPlus] Erro ao marcar como abandonada:', e.message);
          }
          return; // Não restaurar
        }

        if (sessao.session_scope === 'manual') {
          // Restaurar ligação manual
          const sessaoRestaurada = {
            id: sessao.id,
            lead_id: sessao.lead_id || null,
            lead_nome: sessao.lead_nome || sessao.lead_telefone,
            lead_telefone: sessao.lead_telefone,
            chamada_id_3cplus: sessao.chamada_id_3cplus || null,
            status: 'answered',
            session_scope: 'manual',
            sdr_email: sessao.sdr_email,
            iniciada_em: sessao.iniciada_em,
            atendida_em: sessao.atendida_em,
          };
          setManualCallSession(sessaoRestaurada);
          manualCallSessionRef.current = sessaoRestaurada;
          setManualCallStatus('em_ligacao');
          setAgentStatus({ status: 'em_ligacao', timestamp: new Date() });
        } else {
          // Restaurar ligação de lead
          const sessaoRestaurada = {
            id: sessao.id,
            lead_id: sessao.lead_id,
            lead_nome: sessao.lead_nome,
            lead_telefone: sessao.lead_telefone,
            chamada_id_3cplus: sessao.chamada_id_3cplus || null,
            status: 'answered',
            session_scope: 'lead',
            sdr_email: sessao.sdr_email,
            iniciada_em: sessao.iniciada_em,
            atendida_em: sessao.atendida_em,
          };
          setCallSession(sessaoRestaurada);
          setLeadCallStatus('em_ligacao');
          setModalAtendimentoAberto(true);
          setAgentStatus({ status: 'em_ligacao', timestamp: new Date() });
        }

      } catch (e) {
        console.warn('[useTelefonia3CPlus] Erro ao restaurar sessão:', e.message);
      }
    }

    // Aguarda 3s para o socket conectar e receber eventos pendentes antes de restaurar
    // Evita restaurar sessão que já foi encerrada durante o delay
    const timer = setTimeout(restaurarSessaoAtiva, 3000);
    return () => clearTimeout(timer);
  }, [empresaId, user?.email]);

  // ─────────────────────────────────────────────────────────────
  // 1. FORMATADORES
  // ─────────────────────────────────────────────────────────────

  const cronometroFormatado = useCallback(() => {
    const minutos = Math.floor(cronometro / 60);
    const segundos = cronometro % 60;
    return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  }, [cronometro]);

  const aguardandoAtendimento = callSession?.status === "iniciando" || callSession?.status === "ringing";
  const emLigacao = callSession?.status === "answered";

  useEffect(() => {
    if (!callSession) return;
    const iniciada = callSession.iniciada_em ? new Date(callSession.iniciada_em).getTime() : Date.now();
    const ms30min = 30 * 60 * 1000;
    const restante = ms30min - (Date.now() - iniciada);
    if (restante <= 0) { setCallSession(null); return; }
    const timer = setTimeout(() => setCallSession(null), restante);
    return () => clearTimeout(timer);
  }, [callSession?.id]);

  // ─────────────────────────────────────────────────────────────
  // 2. CRONÔMETRO
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!emLigacao) {
      setCronometro(0);
      if (cronometroIntervalRef.current) clearInterval(cronometroIntervalRef.current);
      return;
    }
    cronometroIntervalRef.current = setInterval(() => {
      setCronometro((prev) => prev + 1);
    }, 1000);
    return () => {
      if (cronometroIntervalRef.current) clearInterval(cronometroIntervalRef.current);
    };
  }, [emLigacao]);

  // ─────────────────────────────────────────────────────────────
  // 3. SOCKET.IO — EVENTOS EM TEMPO REAL DO 3C PLUS
  // ─────────────────────────────────────────────────────────────

  const callSessionRef = useRef(null);
  const pendingAnsweredEventRef = useRef(null);
  const ligacaoAtendidaProcessandoRef = useRef(false);
  const hangupManualEmAndamentoRef = useRef(false); // guard anti-duplo-hangup
  // Sinaliza que uma discagem manual está em andamento (invoke ainda não resolveu)
  // Evita race condition: socket call-was-connected chega antes do invoke retornar
  // e criarSessaoCampanhaAutomatica cria callSession duplicado
  const discagemManualPendenteRef = useRef(false);
  useEffect(() => { callSessionRef.current = callSession; }, [callSession]);
  useEffect(() => { manualCallSessionRef.current = manualCallSession; }, [manualCallSession]);

  // Funções unificadas para atendimento e encerramento (fora do useEffect para reutilização)
  const marcarLigacaoNaoAtendida = useCallback(async (data, origem) => {
    const sessaoAtual = callSessionRef.current;
    
    if (!sessaoAtual?.id) {
      console.warn(`[Socket.IO] ${origem} recebido sem callSession ativa`);
      return;
    }

    // Atualizar CallSession para finished/failed
    try {
      await atualizarCallSession(sessaoAtual.id, {
        status: "finished",
        finalizada_em: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[Socket.IO] erro ao finalizar sessão (${origem}):`, e.message);
    }

    callLifecycle.dispatch('NOT_ANSWERED');
    setLeadCallStatus("encerrado");
    setTimeout(() => {
      setCallSession(null);
      setModalAtendimentoAberto(false);
      setCronometro(0);
      pendingAnsweredEventRef.current = null;
      setLeadCallStatus(null);
    }, 3000);
  }, []);

  // T1/T2/T3 — Criar CallSession on-the-fly para ligações de campanha automática
  const criarSessaoCampanhaAutomatica = useCallback(async (data) => {
    const agora = new Date().toISOString();
    const telefone = String(
      data.call?.number || data.number || data.phone || data.call_phone || ''
    ).replace(/\D/g, '');
    const chamadaId  = data.call?.id || data.call_id || data.id || null;
    const telefonyId = data.call?.telephony_id || data.telephony_id || null;
    const campanhaId = data.campaign_id || data.call?.campaign_id || null;

    let leadId = null, leadNome = telefone, leadTelefone = telefone;
    if (telefone && empresaId) {
      try {
        const leads = await listarLeadsPorTelefone(empresaId, telefone);
        if (leads[0]) {
          leadId      = leads[0].id;
          leadNome    = leads[0].nome || telefone;
          leadTelefone = leads[0].telefone || telefone;
          await atualizarLead(leadId, {
            is_locked_for_call: true,
            lock_agent_email: user?.email,
            lock_at: agora,
          });
        }
      } catch (e) {
        console.warn('[useTelefonia3CPlus] criarSessaoCampanhaAutomatica: erro ao buscar lead:', (e).message);
      }
    }

    // empresaId obrigatório — evento pode chegar antes do hook inicializar
    if (!empresaId || !user?.email) {
      console.warn('[criarSessaoCampanhaAutomatica] empresaId ou user não disponível ainda, ignorando');
      return null;
    }

    // lead_id omitido quando null — schema required não aceita null explícito
    const payloadSessao = {
      empresaId,
      lead_nome:          leadNome || telefone || 'Lead não identificado',
      lead_telefone:      leadTelefone || telefone || '',
      sdr_email:          user.email,
      campanha_id_3cplus: String(campanhaId || ''),
      status:             'answered',
      origem:             'campanha_automatica',
      iniciada_em:        agora,
      atendida_em:        agora,
      chamada_id_3cplus:  chamadaId  || '',
      telephony_id_3cplus: telefonyId || '',
      spin_preenchido:    false,
      gravacao_processada: false,
    };
    // Só incluir lead_id se tiver valor — campo required não aceita null
    if (leadId) payloadSessao.lead_id = leadId;

    try {
      const sessao = await criarCallSession(payloadSessao);
      return sessao;
    } catch (e) {
      console.error('[useTelefonia3CPlus] erro ao criar sessão automática:', (e).message);
      return null;
    }
  }, [empresaId, user?.email]);

  const marcarLigacaoAtendida = useCallback(async (data, origem) => {
    // Guard contra processamento duplo — race condition
    if (ligacaoAtendidaProcessandoRef.current) {
      warn(`[Socket.IO] marcarLigacaoAtendida (${origem}) IGNORADO — já processando`);
      return;
    }
    let sessaoAtual = callSessionRef.current;

    // Discagem manual pendente: o socket call-was-connected pode chegar antes do invoke retornar.
    // Guardar evento para processar após invoke resolver — evita sessão automática duplicada.
    if (!sessaoAtual?.id && discagemManualPendenteRef.current) {
      pendingAnsweredEventRef.current = { data, origem };
      return;
    }

    // Sem sessão = campanha automática do 3C → criar on-the-fly
    if (!sessaoAtual?.id) {
      ligacaoAtendidaProcessandoRef.current = true;

      const novaSessao = await criarSessaoCampanhaAutomatica(data);
      if (!novaSessao) {
        warn(`[Socket.IO] ${origem} — falha ao criar sessão automática, descartando evento`);
        ligacaoAtendidaProcessandoRef.current = false;
        return;
      }
      setCallSession(novaSessao);
      callSessionRef.current = novaSessao;
      sessaoAtual = novaSessao;
    } else {
      ligacaoAtendidaProcessandoRef.current = true;
    }

    // Capturar IDs em múltiplos locais possíveis no webhook
    const chamadaIdNova =
      data.call?.id ||
      data.call_id ||
      data.id ||
      sessaoAtual.chamada_id_3cplus ||
      null;
    const telefonyId =
      data.call?.telephony_id ||
      data.telephony_id ||
      sessaoAtual.telephony_id_3cplus ||
      null;

    setCallSession(prev => prev ? {
      ...prev,
      status: "answered",
      atendida_em: new Date().toISOString(),
      chamada_id_3cplus: chamadaIdNova,
      telephony_id_3cplus: telefonyId,
    } : prev);

    setLeadCallStatus("em_ligacao");
    // Iniciar cronômetro da duração real da ligação
    if (duracaoIntervalRef.current) clearInterval(duracaoIntervalRef.current);
    const inicioAtendimento = Date.now();
    setDuracaoLigacao(0);
    duracaoIntervalRef.current = setInterval(() => {
      setDuracaoLigacao(Math.floor((Date.now() - inicioAtendimento) / 1000));
    }, 1000);
    setModalAtendimentoAberto(true);

    try {
      await atualizarCallSession(sessaoAtual.id, {
        status: "answered",
        chamada_id_3cplus: chamadaIdNova,
        telephony_id_3cplus: telefonyId,
        atendida_em: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[Socket.IO] erro ao atualizar sessão (${origem}):`, e.message);
    }
    ligacaoAtendidaProcessandoRef.current = false;
  }, []);

  const marcarLigacaoEncerrada = useCallback(async (data, origem) => {
    const sessaoAtual = callSessionRef.current;
    if (sessaoAtual?.id && sessaoAtual.status !== "finished") {
      try {
        await atualizarCallSession(sessaoAtual.id, {
          status: "finished",
          finalizada_em: new Date().toISOString(),
        });
      } catch (e) {
        console.warn(`[Socket.IO] erro ao finalizar sessão (${origem}):`, e.message);
      }
      setLeadCallStatus("encerrado");
      // Parar cronômetro — duracaoLigacao fica congelado com o valor final
      if (duracaoIntervalRef.current) {
        clearInterval(duracaoIntervalRef.current);
        duracaoIntervalRef.current = null;
      }
      // NÃO limpar callSession aqui — SDR precisa qualificar no modal
      // A limpeza acontece em finalizarLigacao após qualify + acw/exit
    }
  }, []);

  useEffect(() => {
    const tokenAgente = cfgTelefonia?.tokenAgente;

    if (!tokenAgente) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (socketRef.current?.connected) return;

    const socket = io("https://new-socket.3c.plus", {
      query: { token: tokenAgente },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
    });

    // Registrar todos os eventos para debug e roteamento automático
    socket.onAny(async (eventName, data) => {
      const evento = String(eventName || "");

      // Eventos de não-atendimento (processar ANTES dos eventos positivos)
      if (evento === "agent-entered-manual-mode" || evento === "agent-entered-manual") {
        if (manualCallSessionRef.current?.session_scope === "manual") {
          setManualCallStatus("chamando");
        }
        return;
      }

      // Estados de campanha automática
      if (evento === "agent-is-idle" || evento === "agent-is-free") {
        iniciarCronometroEstado('aguardando');
        return;
      }

      if (evento === "agent-is-connected" || evento === "agent-entered-call") {
        iniciarCronometroEstado('falando');
        return;
      }

      if (evento === "agent-in-acw" || evento === "agent-entered-manual-acw") {
        iniciarCronometroEstado('tpa');
        return;
      }

      if (evento === "agent-left-manual-mode" || evento === "agent-left-work-break") {
        iniciarCronometroEstado('aguardando');
        return;
      }

      if (evento === "agent-entered-work-break") {
        pararCronometroEstado();
        return;
      }

      if (evento === "agent-was-logged-out") {
        pararCronometroEstado();
        setQualificacoesCampanha([]);
        qualificacoesCampanhaRef.current = [];
        return;
      }

      const eventosNaoAtendidos = [
        "call-was-not-answered",
        "call-not-answered",
        "call-was-busy",
        "call-failed",
        "call-was-failed",
        "call-was-abandoned",
        "call-was-abandoned-due-amd"
      ];

      // Eventos de encerramento
      const eventosEncerramento = [
        "call-was-finished",
        "call-finished",
        "call-ended",
        "call-was-ended",
        "call-hangup"
      ];

      // Eventos de atendimento (conectado)
      const eventosAtendimento = [
        "call-was-connected",
        "manual-call-was-answered",
        "call-was-answered",
        "call-answered"
      ];

      if (evento === "call-was-created") {
         return;
      }

      if (evento === "agent-login-failed") {
         import('sonner').then(({ toast }) => toast.error('Falha no login do agente 3C Plus'));
         setAgenteCampanhaAtiva(false);
         setNomeCampanhaAtiva(null);
         window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', { detail: { ativa: false, nome: null } }));
         return;
      }

      if (eventosNaoAtendidos.includes(evento)) {
        marcarLigacaoNaoAtendida(data || {}, evento);
        return;
      }

      if (eventosEncerramento.includes(evento)) {
        const sessaoManual = manualCallSessionRef.current;
        if (sessaoManual?.id) {

          await hangupManualCall();
        } else {
          marcarLigacaoEncerrada(data || {}, evento);
        }
        return;
      }

      if (eventosAtendimento.includes(evento)) {
        const qualifs = data?.qualifications || data?.call?.qualifications || [];
        if (qualifs.length > 0) {
          setQualificacoesCampanha(qualifs);
          qualificacoesCampanhaRef.current = qualifs;
        }
        const sessaoManual = manualCallSessionRef.current;
        if (sessaoManual?.session_scope === "manual") {
          // Ligação manual atendida — atualizar manualCallSession
          setManualCallSession(prev => prev ? {
            ...prev,
            status: "answered",
            atendida_em: new Date().toISOString(),
            chamada_id_3cplus: data?.call?.id || data?.call_id || prev.chamada_id_3cplus,
          } : prev);
          setManualCallStatus("em_ligacao");
        } else {
          marcarLigacaoAtendida(data || {}, evento);
        }
        return;
      }
    });

    socket.on("disconnect", () => {
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO 3C Plus] erro de conexão:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cfgTelefonia?.tokenAgente, marcarLigacaoAtendida, marcarLigacaoEncerrada, marcarLigacaoNaoAtendida, criarSessaoCampanhaAutomatica]);

  // ─────────────────────────────────────────────────────────────
  // HANGUP REAL NA 3C PLUS
  // ─────────────────────────────────────────────────────────────

  const hangup3CPlus = useCallback(async () => {
    const sessaoAtual = callSessionRef.current;
    const callId = sessaoAtual?.chamada_id_3cplus;

    if (!callId) {
      throw new Error("Dados insuficientes para hangup 3C Plus");
    }

    const resp = await base44.functions.invoke('executarComando3CPlus', {
      empresaId,
      comando: 'end-call',
      chamada_id: callId,
    });

    if (resp.data?.success || resp.data?.async) return true;

    // 404/409 = chamada já encerrada — tratar como sucesso
    const status = resp.status || 0;
    if (status === 404 || status === 409) {
      console.warn('[hangup3CPlus] chamada já encerrada no 3C Plus —', status, '— ignorando');
      return true;
    }

    throw new Error(`Hangup 3C Plus falhou: ${resp.data?.error || 'erro desconhecido'}`);
  }, [empresaId]);

  const hangupManualCall = useCallback(async () => {
    // Guard anti-duplo-hangup: se já está em andamento, ignorar segunda chamada
    if (hangupManualEmAndamentoRef.current) {
      console.warn("[hangupManualCall] hangup já em andamento — ignorando chamada duplicada");
      return;
    }
    hangupManualEmAndamentoRef.current = true;

    const sessaoManual = manualCallSessionRef.current;

    // Encerrar na API do 3C Plus via serverless (token nunca exposto no navegador)
    if (sessaoManual?.chamada_id_3cplus) {
      try {
        await base44.functions.invoke('executarComando3CPlus', {
          empresaId,
          comando: 'end-call',
          chamada_id: sessaoManual.chamada_id_3cplus,
        });
      } catch (e) {
        console.warn("[hangupManualCall] hangup 3C falhou:", e.message);
      }
    }

    // Sair do ACW — obrigatório para agente voltar ao idle (via serverless)
    try {
      await base44.functions.invoke('executarComando3CPlus', {
        empresaId,
        comando: 'acw-exit',
      });
    } catch (e) {
      console.warn("[hangupManualCall] acw/exit falhou:", e.message);
    }

    // Atualizar sessão no CRM
    if (sessaoManual?.id) {
      try {
        await atualizarCallSession(sessaoManual.id, {
          status: "finished",
          finalizada_em: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[hangupManualCall] erro ao finalizar sessão:", e.message);
      }
    }

    setManualCallStatus("encerrado");
    setTimeout(() => {
      setManualCallSession(null);
      manualCallSessionRef.current = null;
      setManualCallStatus(null);
      setAgentStatus({ status: "livre", timestamp: new Date() });
      hangupManualEmAndamentoRef.current = false; // libera guard após limpeza
    }, 3000);
  }, [empresaId]);

  // ── Polling Fallback para BUG 1 ─────────────────────────
  useEffect(() => {
    if (!callSession?.id || !pendingAnsweredEventRef.current) return;
    const pending = pendingAnsweredEventRef.current;
    pendingAnsweredEventRef.current = null;
    marcarLigacaoAtendida(pending.data, pending.origem + ":pending-effect");
  }, [callSession?.id, marcarLigacaoAtendida]);

  // ── Polling Fallback ─────────────────────────────────────────
  useEffect(() => {
    if (!callSession?.id || !aguardandoAtendimento) return;

    const startedAt = Date.now();

    const interval = setInterval(async () => {
      try {
        const sessoes = [await buscarCallSessionPorId(callSession.id)].filter(Boolean);
        const sessaoAtual = sessoes[0];
        if (!sessaoAtual) return;

        if (sessaoAtual.status === "answered") {
    
          setCallSession(prev => prev ? {
            ...prev,
            ...sessaoAtual,
            status: "answered"
          } : prev);
          setModalAtendimentoAberto(true);
          clearInterval(interval);
          return;
        }

        if (["finished", "failed", "timeout"].includes(sessaoAtual.status)) {

          setCallSession(null);
          setModalAtendimentoAberto(false);
          setCronometro(0);
          clearInterval(interval);
          return;
        }

        if (Date.now() - startedAt > 3 * 60 * 1000) {
          console.warn("[polling] timeout aguardando atendimento");
          clearInterval(interval);
        }
      } catch (e) {
        console.warn("[polling] erro:", e.message);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [callSession?.id, aguardandoAtendimento]);

  // ─────────────────────────────────────────────────────────────
  // 4. AÇÕES
  // ─────────────────────────────────────────────────────────────

  // ── ligarAgoraLead ────────────────────────────────────────────
  // Função dedicada ao botão "Ligar agora" em cards de lead/tarefa.
  // Chama a function ligarAgoraLead3CPlus que decide o método
  // correto (click2call ou enter+dial) sem depender de estado do frontend.
  const ligarAgoraLead = useCallback(
    async (leadId, leadNome) => {
      if (!empresaId || !user?.email) return { sucesso: false, erro: "Usuário não logado" };
      if (!leadId) return { sucesso: false, erro: "lead_id obrigatório" };

      setIsLoading(true);
      try {
        const resultado = await base44.functions.invoke("ligarAgoraLead3CPlus", {
          empresaId,
          lead_id: leadId,
        });

        if (resultado.data?.success) {

          const novaSessao = {
            id:                resultado.data.call_session_id,
            lead_id:           leadId,
            lead_nome:         leadNome || "",
            chamada_id_3cplus: resultado.data.chamada_id_3cplus || null,
            status:            "iniciando",
            session_scope:     "lead",
            sdr_email:         user.email,
            iniciada_em:       new Date().toISOString(),
          };
          setCallSession(novaSessao);
          setLeadCallStatus("ligando");

          // Processar evento pendente se já havia chegado antes da sessão
          const pending = pendingAnsweredEventRef.current;
          if (pending) {
            pendingAnsweredEventRef.current = null;
            setTimeout(() => marcarLigacaoAtendida(pending.data, `${pending.origem}:pending`), 0);
          }

          return { sucesso: true, call_session_id: resultado.data.call_session_id };
        }

        return {
          sucesso:    false,
          erro:       resultado.data?.error || "Erro ao iniciar ligação",
          detalhe:    resultado.data?.detalhe_3c,
          dica:       resultado.data?.dica,
          metodo:     resultado.data?.metodo_tentado,
        };
      } catch (e) {
        console.error("[ligarAgoraLead]", e.message);
        const status = e.response?.status;
        const data   = e.response?.data;

        if (status === 409) return { sucesso: false, erro: "LEAD_LOCKED", agent_lock: data?.agent_lock || "" };
        if (status === 502) return {
          sucesso:     false,
          erro:        "FALHA_API_3C",
          detalhe:     data?.detalhe_3c || data?.detalhe || e.message,
          dica:        data?.dica || "",
          mensagem3C:  data?.detalhe_3c || data?.detalhe || "",
        };
        return { sucesso: false, erro: data?.error || e.message };
      } finally {
        setIsLoading(false);
      }
    },
    [empresaId, user?.email, marcarLigacaoAtendida]
  );

  const iniciarLigacao = useCallback(
    async (leadId, leadNome, opcoes = {}) => {
      if (!empresaId || !user?.email) return { sucesso: false, erro: "Usuário não logado" };

      // opcoes pode conter: { agente_em_campanha, campanha_id, origem }
      // agente_em_campanha do argumento tem prioridade sobre o estado interno
      const agenteEmCampanha =
        opcoes.agente_em_campanha !== undefined
          ? !!opcoes.agente_em_campanha
          : !!agenteCampanhaAtiva;

      setIsLoading(true);
      try {
        const resultado = await base44.functions.invoke("iniciarLigacao3CPlus", {
          empresaId,
          lead_id: leadId,
          agente_em_campanha: agenteEmCampanha,
          origem: opcoes.origem || "manual",
        });

        if (resultado.data?.success) {
          const novaSessao = {
            id: resultado.data.call_session_id,
            lead_id: leadId,
            lead_nome: leadNome,
            chamada_id_3cplus: resultado.data.chamada_id_3cplus || null,
            status: "iniciando",
            sdr_email: user.email,
            iniciada_em: new Date().toISOString(),
          };
          setCallSession(novaSessao);
          setLeadCallStatus("ligando");
          setAgentStatus({ status: "em_ligacao", timestamp: new Date() });

          // Se há evento pendente aguardando essa sessão, executar agora
          const pending = pendingAnsweredEventRef.current;
          if (pending) {
            pendingAnsweredEventRef.current = null;
            setTimeout(() => marcarLigacaoAtendida(pending.data, `${pending.origem}:pending`), 0);
          }

          return { sucesso: true, call_session_id: resultado.data.call_session_id };
        } else {
          return { sucesso: false, erro: resultado.data?.error || "Erro ao iniciar ligação" };
        }
      } catch (e) {
        console.error("[iniciarLigacao]", e.message);
        const status = e.response?.status;
        const data   = e.response?.data;

        // 409: Lead bloqueado
        if (status === 409) {
          return { sucesso: false, erro: "LEAD_LOCKED", agent_lock: data?.agent_lock || "" };
        }

        // 422: Agente não logado ou outro erro do 3C
        if (status === 422) {
          const codigo = data?.codigo || "";
          if (codigo === "AGENT_NOT_LOGGED") return { sucesso: false, erro: "AGENT_NOT_LOGGED" };
          return { sucesso: false, erro: data?.mensagem || data?.detalhe || data?.error || e.message };
        }

        // 502: Falha na API do 3C Plus — exibir detalhe real
        if (status === 502) {
          const detalheReal = data?.detalhe || data?.mensagem || data?.error || e.message;
          return { sucesso: false, erro: "FALHA_API_3C", detalhe: detalheReal, mensagem3C: data?.detalhe || data?.detail || data?.mensagem || detalheReal };
        }

        // Outros erros
        return { sucesso: false, erro: data?.mensagem || data?.detalhe || data?.error || e.message };
      } finally {
        setIsLoading(false);
      }
    },
    [empresaId, user?.email, marcarLigacaoAtendida]
  );

  const iniciarLigacaoManual = useCallback(
    async (telefoneOuOpcoes) => {
      if (!empresaId || !user?.email) return { sucesso: false, erro: "Usuário não logado" };

      // Aceita string ("11999990000") ou objeto ({ telefone_manual, lead_nome, lead_id })
      const rawTelefone =
        typeof telefoneOuOpcoes === "object" && telefoneOuOpcoes !== null
          ? telefoneOuOpcoes.telefone_manual || telefoneOuOpcoes.telefone || ""
          : telefoneOuOpcoes || "";
      const leadNomeExterno =
        typeof telefoneOuOpcoes === "object" ? telefoneOuOpcoes.lead_nome || "" : "";
      const leadIdExterno =
        typeof telefoneOuOpcoes === "object" ? telefoneOuOpcoes.lead_id || null : null;

      const telefoneLimpo = String(rawTelefone).replace(/\D/g, "");
      if (telefoneLimpo.length < 8) return { sucesso: false, erro: "Número inválido" };

      setIsLoading(true);
      // Sinalizar antes do invoke para bloquear criarSessaoCampanhaAutomatica
      // caso call-was-connected chegue durante o await (race condition de ~1-2s)
      discagemManualPendenteRef.current = true;
      try {
        const resultado = await base44.functions.invoke("iniciarDiscagemManual3CPlus", {
          empresaId,
          telefone_manual: telefoneLimpo,
          lead_id: leadIdExterno || "",
          lead_nome: leadNomeExterno || telefoneLimpo,
        });

        if (resultado.data?.success) {

          const novaSessao = {
            id: resultado.data.call_session_id,
            lead_id: leadIdExterno || null,
            lead_nome: leadNomeExterno || telefoneLimpo,
            lead_telefone: telefoneLimpo,
            chamada_id_3cplus: resultado.data.chamada_id_3cplus || null,
            status: "ringing",
            session_scope: "manual",
            sdr_email: user.email,
            iniciada_em: new Date().toISOString(),
          };
          setManualCallSession(novaSessao);
          manualCallSessionRef.current = novaSessao;
          setAgentStatus({ status: "em_ligacao", timestamp: new Date() });

          // Processar evento pendente que chegou durante o invoke
          const pending = pendingAnsweredEventRef.current;
          if (pending) {
            pendingAnsweredEventRef.current = null;

            // Atualizar sessão com dados do socket (chamada_id)
            const chamadaIdSocket = pending.data?.call?.id || pending.data?.call_id || null;
            if (chamadaIdSocket && !novaSessao.chamada_id_3cplus) {
              const sessaoAtualizada = { ...novaSessao, chamada_id_3cplus: chamadaIdSocket, status: "answered" };
              setManualCallSession(sessaoAtualizada);
              manualCallSessionRef.current = sessaoAtualizada;
            }
            setManualCallStatus("em_ligacao");
          }

          return { sucesso: true, call_session_id: novaSessao.id };
        }

        return { sucesso: false, erro: resultado.data?.detalhe || resultado.data?.error || "Erro ao iniciar discagem manual" };
      } catch (e) {
        const data = e.response?.data;
        return { sucesso: false, erro: data?.detalhe || data?.error || e.message };
      } finally {
        discagemManualPendenteRef.current = false; // liberar após invoke concluir
        setIsLoading(false);
      }
    },
    [empresaId, user?.email]
  );

  const finalizarLigacao = useCallback(
    async (resultado, spin = null, observacao = "", qualification_id = null, novo_status_lead = null) => {
      if (!callSession) return { sucesso: false, erro: "Sem sessão ativa" };

      setIsLoading(true);
      callLifecycle.dispatch('SUBMIT');
      try {
        const resposta = await base44.functions.invoke("finalizarLigacao3CPlus", {
          empresaId,
          call_session_id: callSession.id,
          crmData: {
            resultado,
            spin,
            observacao,
            qualification_id: qualification_id ?? callSession.qualification_id_selecionado ?? null,
            novo_status_lead,
          },
        });

        if (resposta.data?.success) {
          callLifecycle.dispatch('FINALIZED');
          setCallSession(null);
          callSessionRef.current = null;
          setModalAtendimentoAberto(false);
          setCronometro(0);
          setLeadCallStatus(null);
          return { sucesso: true };
        } else {
          return { sucesso: false, erro: resposta.data?.error };
        }
      } catch (e) {
        console.error("[finalizarLigacao]", e.message);
        import('sonner').then(({ toast }) => toast.error('Erro ao finalizar — tente novamente'));
        return { sucesso: false, erro: e.message };
      } finally {
        setIsLoading(false);
      }
    },
    [callSession, empresaId]
  );

  const executarComando = useCallback(
    async (comando, params = {}) => {
      if (!empresaId) return;

      setIsLoading(true);
      try {
        if (comando === "end-call" || comando === "hangup") {
          try {
            await hangup3CPlus();
          } catch (e) {
            console.error("[executarComando] hangup 3C falhou:", e.message);
            setIsLoading(false);
            return;
          }
          // Só depois do hangup ok: registrar no CRM
          await base44.functions.invoke("finalizarLigacao3CPlus", {
            empresaId,
            call_session_id: callSession?.id,
            resultado: "nao_atendeu",
            observacao: "Encerrado pelo agente via softphone",
            duracao_segundos: 0,
          });
          setLeadCallStatus("encerrado");
          setTimeout(() => {
            setCallSession(null);
            setModalAtendimentoAberto(false);
            setCronometro(0);
            setLeadCallStatus(null);
          }, 3000);
          return;
        }
        await base44.functions.invoke("executarComando3CPlus", {
          empresaId,
          comando,
          ...params,
        });
      } catch (e) {
        console.error("[executarComando]", e.message);
      } finally {
        setIsLoading(false);
      }
    },
    [empresaId, callSession?.id, hangup3CPlus]
  );

  const fecharModalAtendimento = useCallback(() => {
    setModalAtendimentoAberto(false);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 5. CLEANUP
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (cronometroIntervalRef.current) clearInterval(cronometroIntervalRef.current);
      if (duracaoIntervalRef.current) clearInterval(duracaoIntervalRef.current);
      if (intervalEstadoRef.current) clearInterval(intervalEstadoRef.current);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // RETORNO
  // ─────────────────────────────────────────────────────────────

  return {
    callSession,
    manualCallSession,
    manualCallStatus,
    leadCallStatus,
    duracaoLigacao,
    agentStatus,
    cronometro,
    cronometroFormatado: cronometroFormatado(),
    modalAtendimentoAberto,
    isLoading,
    aguardandoAtendimento,
    emLigacao,
    agenteCampanhaAtiva,
    setAgenteCampanhaAtiva,
    estadoCampanha,
    tempoEstado,
    pararCronometroEstado,
    limparSessaoManual: () => {
      setManualCallSession(null);
      manualCallSessionRef.current = null;
      setManualCallStatus(null);
    },
    qualificacoesCampanha,
    nomeCampanhaAtiva,
    setNomeCampanhaAtiva,
    ligarAgoraLead,
    iniciarLigacao,
    iniciarLigacaoManual,
    finalizarLigacao,
    hangupManualCall,
    executarComando,
    fecharModalAtendimento,
    // Escape hatch: limpa todo estado de chamada localmente sem chamar o backend
    // Usar quando finalizarLigacao3CPlus falha e o softphone fica travado
    forceClearCallState: () => {
      setCallSession(null);
      callSessionRef.current = null;
      setLeadCallStatus(null);
      setModalAtendimentoAberto(false);
      setCronometro(0);
      setDuracaoLigacao(0);
      pendingAnsweredEventRef.current = null;
      ligacaoAtendidaProcessandoRef.current = false;
      if (duracaoIntervalRef.current) { clearInterval(duracaoIntervalRef.current); duracaoIntervalRef.current = null; }
    },
    setModalAtendimentoAberto,
  };
}