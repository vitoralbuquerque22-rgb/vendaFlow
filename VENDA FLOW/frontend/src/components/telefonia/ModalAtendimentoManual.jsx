import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { atualizarLead } from "@/lib/services/leadService";
import { buscarTarefasPendentesDoLead, encerrarTarefasAutomaticamente, criarTarefa } from "@/lib/services/tarefaService";
import { criarAtividade } from "@/lib/services/atividadeService";
import ModalAtendimentoBase from "./ModalAtendimentoBase";

export default function ModalAtendimentoManual({ telefonia }) {
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });
  const { manualCallSession, manualCallStatus, callSession } = telefonia || {};

  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [duracaoManual, setDuracaoManual] = useState(0);
  const [tmaManual, setTmaManual] = useState(0);
  const [salvando, setSalvando] = useState(false);

  // Qualificações reais do 3C Plus — a ligação manual não vem de campanha com
  // qualification_list_id, então a função faz fallback para a lista padrão/CRM da conta.
  const { data: qualifData, isLoading: qualifCarregando } = useQuery({
    queryKey: ["qualificacoes-manual", empresaId, aberto],
    queryFn: async () => {
      const resp = await api.functions.invoke('buscarQualificacoes3CPlus', { empresaId });
      return resp?.data?.qualificacoes || [];
    },
    enabled: !!empresaId && aberto,
    staleTime: 5 * 60_000,
  });
  const qualificacoes3C = qualifData || [];

  const duracaoRef = useRef(null);
  const tmaRef = useRef(null);
  const duracaoInicioRef = useRef(null);
  const tmaInicioRef = useRef(null);
  const tmaCongeladoRef = useRef(0);

  useEffect(() => {
    // Não abre o modal manual se já há uma ligação de campanha/lead em andamento
    // (evita dois modais de atendimento simultâneos).
    if (manualCallSession?.status === 'answered' && !aberto && !callSession) setAberto(true);
  }, [manualCallSession?.status, callSession, aberto]);

  useEffect(() => {
    if (manualCallStatus === 'em_ligacao' && !duracaoRef.current) {
      duracaoInicioRef.current = Date.now();
      setDuracaoManual(0);
      duracaoRef.current = setInterval(() => {
        setDuracaoManual(Math.floor((Date.now() - duracaoInicioRef.current) / 1000));
      }, 1000);
    }
    if (manualCallStatus === 'encerrado') {
      if (duracaoRef.current) { clearInterval(duracaoRef.current); duracaoRef.current = null; }
    }
    if (!manualCallStatus) {
      if (duracaoRef.current) { clearInterval(duracaoRef.current); duracaoRef.current = null; }
      setDuracaoManual(0);
    }
  }, [manualCallStatus]);

  useEffect(() => {
    if (aberto && !tmaRef.current) {
      tmaInicioRef.current = Date.now();
      tmaRef.current = setInterval(() => {
        const atual = Math.floor((Date.now() - tmaInicioRef.current) / 1000);
        setTmaManual(atual);
        tmaCongeladoRef.current = atual;
      }, 1000);
    }
  }, [aberto]);

  const handleClose = useCallback(() => {
    setAberto(false);
    setMinimizado(false);
    if (tmaRef.current) { clearInterval(tmaRef.current); tmaRef.current = null; }
    if (duracaoRef.current) { clearInterval(duracaoRef.current); duracaoRef.current = null; }
    setTmaManual(0); setDuracaoManual(0);
    tmaCongeladoRef.current = 0; tmaInicioRef.current = null;
    telefonia?.limparSessaoManual?.();
  }, [telefonia]);

  const handleRegistrar = useCallback(async (dados) => {
    if (!dados?.resultado || salvando) return;
    setSalvando(true);
    try {
      const leadId = dados.lead_id_vinculado || manualCallSession?.lead_id;
      const leadNome = manualCallSession?.lead_nome || manualCallSession?.lead_telefone || 'Ligação manual';

      // Chamar finalizarLigacao3CPlus para: qualify no 3C Plus + ACW exit + criar Atividade + liberar lock
      let finalizouNoBackend = false;
      if (manualCallSession?.id && empresaId) {
        try {
          await api.functions.invoke('finalizarLigacao3CPlus', {
            empresaId,
            call_session_id: manualCallSession.id,
            resultado: dados.resultado,
            spin: dados.spin || null,
            observacao: dados.observacao || '',
            duracao_segundos: dados.duracao_segundos || duracaoManual,
            tma_segundos: dados.tma_segundos || tmaCongeladoRef.current,
            novo_status_lead: dados.status_lead && dados.status_lead !== 'manter' ? dados.status_lead : null,
            lead_id_vinculado: leadId || null,
          });
          finalizouNoBackend = true;
        } catch (e) {
          console.warn('[ModalAtendimentoManual] finalizarLigacao3CPlus erro:', e.message);
          // Continua para garantir que o estado local seja limpo
        }
      }

      // Fallback: se a finalização no backend falhou, garantir que o agente saia
      // do ACW/TPA de qualquer forma — evita o agente ficar preso em TPA.
      if (!finalizouNoBackend && empresaId) {
        await api.functions.invoke('executarComando3CPlus', {
          empresaId, comando: 'acw-exit',
        }).catch(() => {});
      }

      // Atualizar status do lead se necessário (complementa o backend)
      if (leadId && dados.status_lead && dados.status_lead !== 'manter') {
        await atualizarLead(leadId, { status: dados.status_lead }).catch(() => {});
      }

      // Desqualificação / sem interesse via ligação manual → encerrar tarefas pendentes
      if (leadId && (dados.status_lead === 'desqualificado' || dados.status_lead === 'sem_interesse')) {
        try {
          const tarefasPendDesq = await buscarTarefasPendentesDoLead(empresaId, leadId);
          if (tarefasPendDesq.length > 0) {
            await encerrarTarefasAutomaticamente(
              tarefasPendDesq,
              dados.status_lead === 'sem_interesse' ? 'sem_interesse' : 'desqualificacao'
            );
          }
        } catch (e) {
          console.warn('[ModalAtendimentoManual] erro ao encerrar tarefas do lead desqualificado:', e.message);
        }
      }

      // Agendar próximo contato
      if (dados.agendar_proximo_contato && dados.data_proximo_contato && leadId) {
        const dataProximoContato = new Date(dados.data_proximo_contato);
        const periodoHora = dataProximoContato.getHours() < 13 ? 'manha' : 'tarde';
        const tarefasPend = await buscarTarefasPendentesDoLead(empresaId, leadId);
        await encerrarTarefasAutomaticamente(tarefasPend, 'followup_agendado');
        await criarTarefa({
          empresaId, lead_id: leadId, lead_nome: leadNome,
          lead_telefone: manualCallSession?.lead_telefone || '',
          sdr_email: user?.email, tipo: dados.tipo_proximo_contato || 'ligacao',
          data_prevista: dados.data_proximo_contato.split('T')[0],
          periodo: periodoHora, status: 'pendente',
          origem: 'proximo_contato',
        });
        // Registrar no histórico
        const dataFormatada = dataProximoContato.toLocaleDateString('pt-BR');
        const horaFormatada = dataProximoContato.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        await criarAtividade({
          empresaId,
          lead_id: leadId,
          lead_nome: leadNome,
          sdr_email: user?.email,
          tipo: 'anotacao',
          resultado: 'agendamento',
          observacao: `📅 Próximo contato agendado: ${dados.tipo_proximo_contato || 'contato'} em ${dataFormatada} às ${horaFormatada} · Responsável: ${user?.full_name || user?.email}`,
        });
        queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      }

      // 3.5 Agendamento de reunião → transferir para closer
      if (dados.agendar_reuniao && dados.data_reuniao && dados.closer_email && leadId) {
        try {
          await atualizarLead(leadId, {
            status: "reuniao_agendada",
            data_reuniao: dados.data_reuniao,
            closer_responsavel: dados.closer_email,
          });
          const tarefasPendReuniao = await buscarTarefasPendentesDoLead(empresaId, leadId);
          if (tarefasPendReuniao.length > 0) {
            await encerrarTarefasAutomaticamente(tarefasPendReuniao, "reuniao_agendada");
          }
          const dataReuniao = new Date(dados.data_reuniao);
          await criarTarefa({
            empresaId,
            lead_id: leadId,
            lead_nome: leadNome,
            lead_telefone: manualCallSession?.lead_telefone || "",
            sdr_email: dados.closer_email,
            tipo: "reuniao",
            data_prevista: dados.data_reuniao.split("T")[0],
            periodo: dataReuniao.getHours() < 13 ? "manha" : "tarde",
            status: "pendente",
            observacao: `Reunião agendada via ligação manual por ${user?.full_name || user?.email}`,
          });
        queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
        } catch (e) {
          console.error("[ModalAtendimentoManual] erro agendar reunião:", e.message);
        }
      }

    } finally {
      // Sempre limpa o estado local (fecha modal, para timers e remove o badge
      // "Modo manual" do softphone) mesmo se o agendamento acima falhar.
      handleClose();
      setSalvando(false);
    }
  }, [manualCallSession, empresaId, user, duracaoManual, salvando, handleClose]);

  const leadCallStatusManual =
    manualCallStatus === 'em_ligacao' ? 'em_ligacao' :
    manualCallStatus === 'encerrado'  ? 'encerrado'  : 'em_ligacao';

  const dotColor = manualCallStatus === 'encerrado' ? '#64748b' : '#38bdf8';
  const dotGlow  = manualCallStatus === 'encerrado' ? 'none' : '0 0 10px #38bdf8';

  return (
    <ModalAtendimentoBase
      aberto={aberto}
      minimizado={minimizado}
      setMinimizado={setMinimizado}
      confirmCancelar={confirmCancelar}
      setConfirmCancelar={setConfirmCancelar}
      leadNome={manualCallSession?.lead_nome}
      leadTelefone={manualCallSession?.lead_telefone}
      tma={tmaManual}
      duracaoLigacao={duracaoManual}
      leadCallStatus={leadCallStatusManual}
      onClose={handleClose}
      onSave={handleRegistrar}
      qualificacoes3C={qualificacoes3C}
      qualificacoesCarregando={qualifCarregando}
      dotColor={dotColor}
      dotGlow={dotGlow}
      tarefa={{
        id: manualCallSession?.id,
        lead_id: manualCallSession?.lead_id || null,
        lead_nome: manualCallSession?.lead_nome || manualCallSession?.lead_telefone || 'Ligação manual',
        lead_telefone: manualCallSession?.lead_telefone || '',
        tipo: 'ligacao', status: 'em_andamento',
        titulo: `Ligação Manual — ${manualCallSession?.lead_telefone || ''}`,
      }}
    />
  );
}