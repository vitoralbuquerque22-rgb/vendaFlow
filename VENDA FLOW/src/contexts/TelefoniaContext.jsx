/**
 * TelefoniaContext
 * T1/T2/T3/T4: Interface pública IDÊNTICA ao hook anterior.
 * Nenhum consumidor (Layout, Tarefas, SeletorCampanha, Modais) precisa mudar.
 */
import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { atualizarCallSession, criarCallSession } from '@/lib/services/telefoniaService';
import { listarLeadsPorTelefone, atualizarLead } from '@/lib/services/leadService';
import { criarAtividade } from '@/lib/services/atividadeService';
import { extrairDadosCall3C } from '@/lib/telefonia3cDados';
import { useTelefoniaConfig }    from './telefonia/useTelefoniaConfig';
import { useTelefoniaAgent }     from './telefonia/useTelefoniaAgent';
import { useTelefoniaSocket }    from './telefonia/useTelefoniaSocket';
import { useTelefoniaGravacoes } from './telefonia/useTelefoniaGravacoes';
import { useTelefoniaHeartbeat } from './telefonia/useTelefoniaHeartbeat';
import { toast } from 'sonner';

const TelefoniaContext = createContext(null);

export function TelefoniaProvider({ children }) {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  // ── Sub-hooks ───────────────────────────────────────────────
  const { cfgTelefonia, carregandoConfig, empresaId } = useTelefoniaConfig(user);

  const {
    agentStatus, setAgentStatus,
    agenteCampanhaAtiva, setAgenteCampanhaAtiva,
    nomeCampanhaAtiva, setNomeCampanhaAtiva,
    estadoCampanha, tempoEstado,
    current3CSession, setCurrent3CSession,
    iniciarCronometroEstado, pararCronometroEstado,
    processarEventoAgente,
    restoreAgentState,
    sincronizarEstadoInicial,
    verificarAntesDeEntrar,
    SESSION_VAZIA,
    loginPending, marcarLoginPending, loginPendingRef,
  } = useTelefoniaAgent();

  // ── Estado de sessão (compartilhado entre sub-hooks) ────────
  const [callSession, setCallSession]                         = useState(null);
  const [manualCallSession, setManualCallSession]             = useState(null);
  const [manualCallStatus, setManualCallStatus]               = useState(null);
  const [leadCallStatus, setLeadCallStatus]                   = useState(null);
  const [modalAtendimentoAberto, setModalAtendimentoAberto]   = useState(false);
  const [cronometro, setCronometro]                           = useState(0);
  const [aguardandoAtendimento, setAguardandoAtendimento]     = useState(false);
  const [qualificacoes3C, setQualificacoes3C]                 = useState([]);
  const [qualificacoesCarregando, setQualificacoesCarregando] = useState(false);
  const callSessionRef                = useRef(null);
  const finalizarLigacaoRef           = useRef(null); // preenchido após criar as actions (evita TDZ no fecharModalAtendimento)
  const manualCallSessionRef          = useRef(null);
  const ligacaoAtendidaProcessandoRef = useRef(false);
  const cronometroIntervalRef         = useRef(null);
  const cronometroRef                 = useRef(0); // espelha cronometro para acesso sem stale closure

  const emLigacao = callSession?.status === 'answered';

  const cronometroFormatado = (() => {
    const m = Math.floor(cronometro / 60);
    const s = cronometro % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  const duracaoLigacao = cronometro;

  // ── Handler específico para ligação manual atendida ────────
  const marcarLigacaoManualAtendida = useCallback((data) => {
    setManualCallStatus('em_ligacao');
    const sessao = manualCallSessionRef.current;
    if (sessao && data?.call?.id) {
      const sessaoAtendida = { ...sessao, status: 'answered', chamada_id_3cplus: data.call.id };
      setManualCallSession(sessaoAtendida);
      manualCallSessionRef.current = sessaoAtendida;
      atualizarCallSession(sessao.id, {
        status: 'answered',
        atendida_em: new Date().toISOString(),
        chamada_id_3cplus: data.call.id,
      }).catch(() => {});
    }
  }, []);

  // ── Handlers de socket ──────────────────────────────────────
  const marcarLigacaoAtendida = useCallback(async (data, origem) => {
    if (ligacaoAtendidaProcessandoRef.current) return;

    // Nova ligação chegou com sessão anterior ainda ativa — limpar para evitar dois modais
    if (callSessionRef.current?.id && origem !== 'agent-is-connected') {

      clearInterval(cronometroIntervalRef.current);
      cronometroRef.current = 0;
      setCronometro(0);
      setCallSession(null);
      callSessionRef.current = null;
      setLeadCallStatus(null);
      setModalAtendimentoAberto(false);
      pararCronometroEstado();
    }

    // Bloquear imediatamente — só libera em marcarLigacaoEncerrada/marcarLigacaoNaoAtendida
    // para impedir que eventos simultâneos abram o modal duas vezes.
    ligacaoAtendidaProcessandoRef.current = true;

    try {
      let sessao = callSessionRef.current;

      // Cancelar timeout de sessão fantasma — socket confirmou a ligação
      if (sessao?._timeoutId) {
        clearTimeout(sessao._timeoutId);
        const sessaoSemTimeout = { ...sessao, _timeoutId: undefined, status: 'answered' };
        setCallSession(sessaoSemTimeout);
        callSessionRef.current = sessaoSemTimeout;
        sessao = sessaoSemTimeout;
      }

      // agent-is-connected com sessão existente mas sem chamada_id → atualizar
      if (sessao?.id && !sessao?.chamada_id_3cplus && data?.call?.id && origem === 'agent-is-connected') {
        const atualizada = { ...sessao, chamada_id_3cplus: data.call.id };
        setCallSession(atualizada);
        callSessionRef.current = atualizada;
        atualizarCallSession(sessao.id, { chamada_id_3cplus: data.call.id }).catch(() => {});

        ligacaoAtendidaProcessandoRef.current = false;
        return;
      }

      // Sem sessão = campanha automática discou → criar sessão on-the-fly
      if (!sessao?.id) {
        // Extrair TODO o payload real do call-was-connected (Biblioteca de Dados 3C)
        const info = extrairDadosCall3C(data);
        const telefone = info.telefone;
        const campanhaId = info.campanha_id;
        const chamadaId  = info.chamada_id;

        let leadId = null, leadNome = info.nome_mailing || telefone;
        if (telefone && empresaId) {
          try {
            // Tentativa 1: número como veio do evento
            let leadEncontrado = (await listarLeadsPorTelefone(empresaId, telefone).catch(() => []))[0] || null;

            // Tentativa 2: sem DDI 55 (ex: 5511999... → 11999...)
            if (!leadEncontrado && telefone.startsWith('55') && telefone.length >= 12) {
              leadEncontrado = (await listarLeadsPorTelefone(empresaId, telefone.slice(2)).catch(() => []))[0] || null;
            }

            // Tentativa 3: com DDI 55 (ex: 11999... → 5511999...)
            if (!leadEncontrado && !telefone.startsWith('55') && telefone.length >= 10) {
              leadEncontrado = (await listarLeadsPorTelefone(empresaId, '55' + telefone).catch(() => []))[0] || null;
            }

            if (leadEncontrado) {
              leadId = leadEncontrado.id;
              leadNome = leadEncontrado.nome || info.nome_mailing || telefone;
              atualizarLead(leadEncontrado.id, {
                is_locked_for_call: true,
                lock_agent_email: user?.email || '',
                lock_at: new Date().toISOString(),
              }).catch(() => {});
            }
          } catch {}
        }

        const payload = {
          empresaId,
          lead_nome: leadNome,
          lead_telefone: telefone,
          sdr_email: user?.email || '',
          campanha_id_3cplus: String(campanhaId || ''),
          chamada_id_3cplus: chamadaId || '',
          status: 'answered',
          origem: 'campanha_automatica',
          iniciada_em: new Date().toISOString(),
          atendida_em: new Date().toISOString(),
          spin_preenchido: false,
          gravacao_processada: false,
          gravacao_url: info.gravacao_url || undefined,
        };
        if (leadId) payload.lead_id = leadId;

        try {
          sessao = await criarCallSession(payload);
          sessao._info3c = info;

          // Registro automático no histórico: "atendido via campanha X" ao conectar,
          // independente de o SDR qualificar depois. Só registra se cruzou lead.
          if (leadId) {
            criarAtividade({
              empresaId,
              lead_id: leadId,
              lead_nome: leadNome,
              lead_telefone: telefone,
              sdr_email: user?.email || '',
              tipo: 'ligacao',
              call_session_id: sessao.id,
              chamada_id_3cplus: chamadaId || '',
              campanha: info.campanha_nome || '',
              gravacao_url: info.gravacao_url || '',
              origem_sincronizacao: '3cplus',
              observacao: `📞 Atendido via campanha ${info.campanha_nome || '(discador)'}${info.protocolo ? ` · Protocolo ${info.protocolo}` : ''}`,
            }).catch(() => {});
          }
        } catch (e) {
          console.error('[marcarLigacaoAtendida] erro ao criar sessão automática:', e.message);
          ligacaoAtendidaProcessandoRef.current = false;
          return;
        }
      }
      await atualizarCallSession(sessao.id, {
        status: 'answered', atendida_em: new Date().toISOString(),
      }).catch(() => {});
      const updated = { ...sessao, status: 'answered' };
      setCallSession(updated);
      callSessionRef.current = updated;
      setLeadCallStatus('em_ligacao');
      setModalAtendimentoAberto(true);
      iniciarCronometroEstado('falando');

      // Uma ligação de campanha assumiu — descartar qualquer sessão manual pendente
      // para não abrir dois modais de atendimento ao mesmo tempo.
      if (manualCallSessionRef.current) {
        setManualCallSession(null);
        manualCallSessionRef.current = null;
        setManualCallStatus(null);
      }

      // Qualificações REAIS da campanha para o modal de atendimento.
      // 1º) se o evento já trouxe as qualificações embutidas, usa direto.
      // 2º) senão, busca via backend pelo campaign_id.
      const info3c = sessao?._info3c || extrairDadosCall3C(data);
      if (info3c?.qualificacoes?.length) {
        setQualificacoes3C(info3c.qualificacoes);
        setQualificacoesCarregando(false);
      } else {
        // Sempre buscar — se não houver campaign_id, o backend faz fallback para a
        // lista de qualificação padrão/CRM da conta. Assim campanhas sem lista
        // própria também exibem as qualificações reais.
        const campanhaIdQualif = info3c?.campanha_id || (sessao?.campanha_id_3cplus ? Number(sessao.campanha_id_3cplus) : null);
        if (empresaId) {
          setQualificacoes3C([]);
          setQualificacoesCarregando(true);
          // Timeout de segurança: nunca deixa o spinner preso mais que 8s
          const safetyTimeout = setTimeout(() => setQualificacoesCarregando(false), 8000);
          base44.functions.invoke('buscarQualificacoes3CPlus', {
            empresaId,
            campaign_id: campanhaIdQualif || undefined,
            qualification_list_id: info3c?.qualification_list_id || undefined,
          }).then((resp) => {
            setQualificacoes3C(resp?.data?.qualificacoes || []);
          }).catch(() => {
            setQualificacoes3C([]);
          }).finally(() => {
            // Sempre encerra o loading — vazio/erro mostra o select com "Automático".
            clearTimeout(safetyTimeout);
            setQualificacoesCarregando(false);
          });
        } else {
          setQualificacoes3C([]);
          setQualificacoesCarregando(false);
        }
      }

      if (cronometroIntervalRef.current) clearInterval(cronometroIntervalRef.current);
      cronometroRef.current = 0;
      cronometroIntervalRef.current = setInterval(() => {
        cronometroRef.current += 1;
        setCronometro(cronometroRef.current);
      }, 1000);
    } catch (e) {
      // Só libera a guard em caso de erro para permitir retry
      ligacaoAtendidaProcessandoRef.current = false;
      console.error('[marcarLigacaoAtendida] erro:', e.message);
    }
  }, [empresaId, user, iniciarCronometroEstado]);

  const marcarLigacaoNaoAtendida = useCallback(async (data, origem) => {
    const sessao = callSessionRef.current;
    // GUARD: ignorar eventos sem sessão ativa do agente
    if (!sessao?.id) {
      return;
    }
    // Cancelar timeout — socket respondeu (mesmo que não atendida)
    if (sessao?._timeoutId) {
      clearTimeout(sessao._timeoutId);
    }
    ligacaoAtendidaProcessandoRef.current = false; // libera guard para próxima ligação
    clearInterval(cronometroIntervalRef.current);
    setLeadCallStatus('nao_atendeu');
    setTimeout(() => {
      setCallSession(null); callSessionRef.current = null;
      setLeadCallStatus(null); setCronometro(0);
    }, 2000);
  }, []);

  const marcarLigacaoEncerrada = useCallback(async (data, origem) => {
    // GUARD: ignorar eventos sem sessão ativa do agente
    if (!callSessionRef.current?.id) {
      return;
    }
    if (callSessionRef.current?._timeoutId) {
      clearTimeout(callSessionRef.current._timeoutId);
    }
    ligacaoAtendidaProcessandoRef.current = false; // libera guard para próxima ligação
    clearInterval(cronometroIntervalRef.current);
    setAgentStatus({ status: 'livre', timestamp: new Date() });
    // NÃO limpar callSession — SDR ainda precisa dos dados para registrar
    // NÃO fechar modal — SDR precisa clicar 'Registrar ligação'
    // Mudar status para 'encerrado' para o modal saber que a ligação caiu
    setLeadCallStatus('encerrado');
    iniciarCronometroEstado('tpa');
    // Modal permanece aberto para o SDR registrar o resultado

  }, [iniciarCronometroEstado]);

  const fecharModalAtendimento = useCallback(() => {
    // Liberar lock do lead se sessão de campanha automática foi fechada sem registrar
    const sessao = callSessionRef.current;
    if (sessao?.lead_id && sessao?.origem === 'campanha_automatica') {
      atualizarLead(sessao.lead_id, {
        is_locked_for_call: false,
        lock_agent_email: null,
        lock_at: null,
      }).catch(() => {});
    }

    // BLINDAGEM ACW: se há uma sessão de chamada real (com id) sendo fechada sem
    // registro, qualificar no 3C ANTES de sair do TPA — nunca sair do ACW sem
    // qualificação. Usa 'outro' (não exige SPIN) → o backend aplica qualificação
    // padrão do sistema e faz qualify → acw/exit na ordem correta.
    const temSessaoReal = sessao?.id && sessao?.chamada_id_3cplus && empresaId;
    const finalizar = finalizarLigacaoRef.current;
    if (temSessaoReal && finalizar) {
      finalizar('outro', {}, 'Encerrada sem registro pelo agente', undefined, null).catch(() => {
        // Fallback: se a finalização falhar, garantir saída do ACW
        base44.functions.invoke('executarComando3CPlus', { empresaId, comando: 'acw-exit' }).catch(() => {});
      });
    } else if (empresaId) {
      // Sem chamada real associada — apenas sair do ACW (token decriptado no backend)
      base44.functions.invoke('executarComando3CPlus', { empresaId, comando: 'acw-exit' }).catch(() => {});
    }

    setModalAtendimentoAberto(false);
    // Limpar estado de sessão e TPA para evitar travamento
    setCallSession(null);
    callSessionRef.current = null;
    setLeadCallStatus(null);
    setQualificacoes3C([]);
    cronometroRef.current = 0;
    setCronometro(0);
    pararCronometroEstado();
    ligacaoAtendidaProcessandoRef.current = false;
  }, [pararCronometroEstado, empresaId]);

  const limparSessaoManual = useCallback(() => {
    setManualCallSession(null); manualCallSessionRef.current = null;
    setManualCallStatus(null);
  }, []);

  // ── Restaurar estado do agente ao montar / trocar empresa ──────────
  // 3C Plus é a única fonte da verdade. forceReset=true garante re-execução ao trocar token.
  useEffect(() => {
    const token = cfgTelefonia?.tokenAgente;
    if (!token || !empresaId) return;
    restoreAgentState(token, true, cfgTelefonia?.dominio, empresaId);
  }, [cfgTelefonia?.tokenAgente, empresaId]);

  // ── Socket ──────────────────────────────────────────────────
  const { socketRef } = useTelefoniaSocket({
    cfgTelefonia, user,
    onAtendimento:   marcarLigacaoAtendida,
    onNaoAtendido:   marcarLigacaoNaoAtendida,
    onEncerramento:  marcarLigacaoEncerrada,
    onManualAtendida: marcarLigacaoManualAtendida,
    onReconnect: (token) => restoreAgentState(token, true, cfgTelefonia?.dominio, empresaId),
    onManualMode:   (data) => {
      // agent-entered-manual-mode = modo manual iniciado, lead ainda NÃO atendeu.
      // Apenas atualizar chamada_id — status 'answered' só vem via manual-call-was-answered.
      if (manualCallSessionRef.current) {
        const sessaoAtual = manualCallSessionRef.current;
        if (sessaoAtual && data?.call?.id) {
          const sessaoAtualizada = { ...sessaoAtual, chamada_id_3cplus: data.call.id };
          setManualCallSession(sessaoAtualizada);
          manualCallSessionRef.current = sessaoAtualizada;
          atualizarCallSession(sessaoAtual.id, { chamada_id_3cplus: data.call.id }).catch(() => {});
        }
      }
    },
    onEventoAgente: (evento) => processarEventoAgente(evento),
    onLoginFailed: (data) => {
      // Só logar — não mostrar toast de erro.
      // O agent-login-failed é esperado quando o agente não tem webphone habilitado
      // e pode chegar mesmo quando o login HTTP foi bem-sucedido.
      if (!loginPendingRef?.current) {
        console.warn('[Telefonia] agent-login-failed recebido (agente pode não ter webphone):', data?.agent?.email);
      }
    },
  });

  // ── Heartbeat de reconciliação ───────────────────────────────
  useTelefoniaHeartbeat({
    empresaId,
    current3CSession,
    socketRef,
    _aplicarStatus3C: undefined,
    pararCronometroEstado,
    setCurrent3CSession,
    setAgenteCampanhaAtiva,
    setNomeCampanhaAtiva,
    SESSION_VAZIA,
  });

  // ── ligarAgoraLead — chama ligarAgoraLead3CPlus (com fallback) ──
  const ligarAgoraLead = useCallback(async (leadId, leadNome) => {
    if (!empresaId || !leadId) return { sucesso: false, erro: 'empresaId e lead_id obrigatórios' };
    try {
      const resultado = await base44.functions.invoke('ligarAgoraLead3CPlus', {
        empresaId,
        lead_id: leadId,
      });
      if (resultado.data?.success) {
        const timeoutId = setTimeout(() => {
          if (callSessionRef.current?.status === 'aguardando_confirmacao') {
            console.warn('[ligarAgoraLead] timeout 15s sem confirmação via socket');
            setCallSession(null);
            callSessionRef.current = null;
            setLeadCallStatus(null);
          }
        }, 15000);
        const novaSessao = {
          id: resultado.data.call_session_id,
          lead_id: leadId,
          lead_nome: leadNome || '',
          status: 'aguardando_confirmacao',
          _timeoutId: timeoutId,
        };
        setCallSession(novaSessao);
        callSessionRef.current = novaSessao;
        setLeadCallStatus('discando');
        return { sucesso: true };
      }
      return { sucesso: false, erro: resultado.data?.error || resultado.data?.detalhe_3c || 'Erro desconhecido' };
    } catch (e) {
      return { sucesso: false, erro: e.message };
    }
  }, [empresaId, setCallSession, setLeadCallStatus, callSessionRef]);

  // ── Discagem manual — invoca iniciarDiscagemManual3CPlus ────────
  const iniciarLigacaoManual = useCallback(async ({ telefone_manual, lead_nome, lead_id } = {}) => {
    if (!empresaId) return { sucesso: false, erro: 'empresaId obrigatório' };
    const telefone = String(telefone_manual || '').replace(/\D/g, '');
    if (telefone.length < 8) return { sucesso: false, erro: 'Telefone inválido' };

    setManualCallStatus('chamando');
    try {
      const resp = await base44.functions.invoke('iniciarDiscagemManual3CPlus', {
        empresaId,
        telefone_manual: telefone,
        lead_nome: lead_nome || telefone,
        lead_id: lead_id || '',
      });

      const dados = resp?.data || {};
      if (!dados.success) {
        setManualCallStatus(null);
        return { sucesso: false, erro: dados.error || dados.detalhe || dados.mensagem || 'Erro desconhecido' };
      }

      const sessao = {
        id: dados.call_session_id,
        lead_id: lead_id || null,
        lead_nome: lead_nome || telefone,
        lead_telefone: telefone,
        chamada_id_3cplus: dados.chamada_id_3cplus || '',
        telephony_id_3cplus: dados.telephony_id || '',
        status: 'iniciando',
        origem: 'discador_manual',
      };
      setManualCallSession(sessao);
      manualCallSessionRef.current = sessao;
      // status 'answered' vem depois via socket (manual-call-was-answered)
      return { sucesso: true, call_session_id: dados.call_session_id };
    } catch (e) {
      setManualCallStatus(null);
      return { sucesso: false, erro: e.message };
    }
  }, [empresaId]);

  // ── executarComando — proxy genérico para executarComando3CPlus ──
  const executarComando = useCallback(async (comando, params = {}) => {
    if (!empresaId) return { sucesso: false, erro: 'empresaId obrigatório' };
    try {
      const resp = await base44.functions.invoke('executarComando3CPlus', {
        empresaId, comando, ...params,
      });
      return { sucesso: true, dados: resp?.data };
    } catch (e) {
      return { sucesso: false, erro: e.message };
    }
  }, [empresaId]);

  // ── finalizarLigacao — qualify + acw/exit + Atividade + libera lock ──
  // Assinatura canônica: (resultado, spin, observacao, novoStatusLead, qualificationId)
  const finalizarLigacao = useCallback(async (resultado, spin, observacao, novoStatusLead, qualificationId) => {
    const sessao = callSessionRef.current;
    if (!empresaId || !sessao?.id) {
      // Sem sessão real — apenas limpar estado local
      setCallSession(null); callSessionRef.current = null;
      setLeadCallStatus(null); setModalAtendimentoAberto(false);
      setQualificacoes3C([]); cronometroRef.current = 0; setCronometro(0);
      pararCronometroEstado();
      return { sucesso: false, erro: 'Sessão não encontrada' };
    }
    try {
      const resp = await base44.functions.invoke('finalizarLigacao3CPlus', {
        empresaId,
        call_session_id: sessao.id,
        resultado,
        spin: spin || null,
        observacao: observacao || '',
        duracao_segundos: cronometroRef.current || 0,
        novo_status_lead: novoStatusLead || null,
        qualification_id: qualificationId || null,
      });
      const dados = resp?.data || {};
      // Limpar estado local independentemente (o 3C já foi tabulado no backend)
      setCallSession(null); callSessionRef.current = null;
      setLeadCallStatus(null); setModalAtendimentoAberto(false);
      setQualificacoes3C([]); cronometroRef.current = 0; setCronometro(0);
      pararCronometroEstado();
      ligacaoAtendidaProcessandoRef.current = false;
      if (dados.error) return { sucesso: false, erro: dados.error, ...dados };
      return { sucesso: true, atividade_id: dados.atividade_id, id: dados.atividade_id, ...dados };
    } catch (e) {
      return { sucesso: false, erro: e.message };
    }
  }, [empresaId, pararCronometroEstado]);

  // ── iniciarLigacao — ligação para lead via iniciarLigacao3CPlus ──
  const iniciarLigacao = useCallback(async (leadId, leadNome, opcoes = {}) => {
    if (!empresaId || !leadId) return { sucesso: false, erro: 'empresaId e lead_id obrigatórios' };
    setLeadCallStatus('discando');
    try {
      const resp = await base44.functions.invoke('iniciarLigacao3CPlus', {
        empresaId, lead_id: leadId, ...opcoes,
      });
      const dados = resp?.data || {};
      if (!dados.success) {
        setLeadCallStatus(null);
        return { sucesso: false, erro: dados.error || dados.detalhe || 'Erro desconhecido' };
      }
      const novaSessao = {
        id: dados.call_session_id,
        lead_id: leadId,
        lead_nome: leadNome || '',
        status: 'aguardando_confirmacao',
      };
      setCallSession(novaSessao);
      callSessionRef.current = novaSessao;
      return { sucesso: true, call_session_id: dados.call_session_id };
    } catch (e) {
      setLeadCallStatus(null);
      return { sucesso: false, erro: e.message };
    }
  }, [empresaId]);

  // Login/campanha (loginCampanha, sairDaCampanha) são consumidos diretamente
  // pelo Softphone via useTelefoniaActions com o socketRef do contexto — não
  // precisam ser instanciados aqui. isLoading é derivado das ações locais.
  const isLoading = false;

  // Mantém o ref de finalizarLigacao atualizado para o fecharModalAtendimento
  // poder qualificar antes do acw-exit sem depender da ordem de declaração.
  finalizarLigacaoRef.current = finalizarLigacao;

  // ── Gravações ────────────────────────────────────────────────
  const { buscarGravacoes, obterUrlGravacao, processarGravacao } = useTelefoniaGravacoes({ empresaId });

  // ── Hangup manual ────────────────────────────────────────────
  // Via serverless — sem chamadas diretas ao 3C Plus (token nunca no navegador)
  const hangupManualCall = useCallback(async () => {
    // Feedback visual imediato — evita o botão "Hang up" piscar sem resposta
    setManualCallStatus('encerrado');

    if (!empresaId) {
      limparSessaoManual();
      return;
    }

    const sessaoManual = manualCallSessionRef.current;
    if (sessaoManual?.chamada_id_3cplus) {
      await base44.functions.invoke('executarComando3CPlus', {
        empresaId,
        comando: 'end-call',
        chamada_id: sessaoManual.chamada_id_3cplus,
      }).catch(() => {});
    }

    // Sair do ACW (manual + normal) — o comando acw-exit já cobre ambos no backend
    await base44.functions.invoke('executarComando3CPlus', {
      empresaId,
      comando: 'acw-exit',
    }).catch(() => {});

    limparSessaoManual();
  }, [empresaId, limparSessaoManual]);

  // Receber evento de recovery de reconexão (emit() local não dispara onAny)
  useEffect(() => {
    function handleReconnectRecovery(e) {
      marcarLigacaoAtendida(e.detail, 'reconnect-recovery');
    }
    window.addEventListener('vendaflow:reconnect-call-recovery', handleReconnectRecovery);
    return () => window.removeEventListener('vendaflow:reconnect-call-recovery', handleReconnectRecovery);
  }, [marcarLigacaoAtendida]);

  // Sair da campanha (softphone ou seletor) → limpar current3CSession imediatamente.
  // Sem isso, current3CSession.connected fica true até o próximo poll e o SeletorCampanha
  // continua achando que o agente está em campanha mesmo já offline no 3C.
  useEffect(() => {
    function handleCampanhaAlterada(e) {
      if (e.detail?.ativa === false) {
        setCurrent3CSession(SESSION_VAZIA);
        setAgenteCampanhaAtiva(false);
        setNomeCampanhaAtiva(null);
        pararCronometroEstado();
      }
    }
    window.addEventListener('vendaflow:campanha-alterada', handleCampanhaAlterada);
    return () => window.removeEventListener('vendaflow:campanha-alterada', handleCampanhaAlterada);
  }, [setCurrent3CSession, setAgenteCampanhaAtiva, setNomeCampanhaAtiva, pararCronometroEstado, SESSION_VAZIA]);

  // C1: escutar evento de reprocessamento pós-reconexão/sleep disparado pelo useTelefoniaSocket
  useEffect(() => {
    function handleReprocessarAgente() {
      const token = cfgTelefonia?.tokenAgente;
      const dominio = cfgTelefonia?.dominio;
      if (token && empresaId) restoreAgentState(token, true, dominio, empresaId);
    }
    window.addEventListener('vendaflow:reprocessar-agente', handleReprocessarAgente);
    return () => window.removeEventListener('vendaflow:reprocessar-agente', handleReprocessarAgente);
  }, [cfgTelefonia?.tokenAgente, cfgTelefonia?.dominio, restoreAgentState, empresaId]);

  useEffect(() => {
    return () => { clearInterval(cronometroIntervalRef.current); };
  }, []);

  // ── Valor do contexto — T1: interface IDÊNTICA ao hook anterior ──
  const value = {
    // Estado de sessão
    callSession, manualCallSession, manualCallStatus,
    leadCallStatus, duracaoLigacao, agentStatus,
    cronometro, cronometroFormatado,
    modalAtendimentoAberto, isLoading,
    aguardandoAtendimento, emLigacao,
    // Qualificações reais da campanha 3C (para o modal de atendimento)
    qualificacoes3C, qualificacoesCarregando,
    // Estado do agente — current3CSession é a fonte da verdade
    current3CSession,
    agenteCampanhaAtiva, setAgenteCampanhaAtiva,
    nomeCampanhaAtiva, setNomeCampanhaAtiva,
    estadoCampanha, tempoEstado, pararCronometroEstado,
    verificarAntesDeEntrar: (token, campanhaId, dominio) =>
      verificarAntesDeEntrar(token, campanhaId, dominio, empresaId),
    restoreAgentState,
    // Ações — iniciarLigacao injeta agenteCampanhaAtiva automaticamente
    iniciarLigacao: (leadId, leadNome, opcoes = {}) =>
      iniciarLigacao(leadId, leadNome, {
        agente_em_campanha: agenteCampanhaAtiva,
        campanha_id: cfgTelefonia?.campanhaId || null,
        ...opcoes,
      }),
    ligarAgoraLead,
    iniciarLigacaoManual,
    finalizarLigacao, hangupManualCall,
    executarComando, fecharModalAtendimento,
    setModalAtendimentoAberto, limparSessaoManual,
    // Escape hatch: limpa estado local quando backend falha e softphone trava
    forceClearCallState: () => {
      setCallSession(null);
      callSessionRef.current = null;
      setLeadCallStatus(null);
      setModalAtendimentoAberto(false);
      cronometroRef.current = 0;
      setCronometro(0);
      pararCronometroEstado();
    },
    // Gravações
    buscarGravacoes, obterUrlGravacao, processarGravacao,
    // Config (para Softphone)
    cfgTelefonia, carregandoConfig,
    // Socket e login pending
    socketRef,
    loginPending, marcarLoginPending,
  };

  return (
    <TelefoniaContext.Provider value={value}>
      {children}
    </TelefoniaContext.Provider>
  );
}

// T1/T2/T3/T4: hook público — interface idêntica
export function useTelefonia() {
  return useContext(TelefoniaContext);
}