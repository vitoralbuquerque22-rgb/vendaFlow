import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { gerarResumoIA } from "@/lib/gerarResumoIA";
import { buscarTarefasPendentesDoLead, encerrarTarefasAutomaticamente, criarTarefa } from "@/lib/services/tarefaService";
import { criarAtividade } from "@/lib/services/atividadeService";
import { atualizarLead } from "@/lib/services/leadService";
import { toast } from "sonner";
import ModalAtendimentoBase from "./ModalAtendimentoBase";

export default function ModalAtendimentoLead({ telefonia }) {
  const {
    callSession, modalAtendimentoAberto, leadCallStatus,
    duracaoLigacao, tmaLigacao, fecharModalAtendimento, finalizarLigacao,
    qualificacoes3C, qualificacoesCarregando,
  } = telefonia || {};

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const [minimizado, setMinimizado] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);

  useEffect(() => {
    if (!modalAtendimentoAberto) { setMinimizado(false); setConfirmCancelar(false); }
  }, [modalAtendimentoAberto]);

  if (!modalAtendimentoAberto || !callSession) return null;

  const handleClose = () => { setMinimizado(false); setConfirmCancelar(false); fecharModalAtendimento?.(); };

  const handleSave = async (dados) => {
    setMinimizado(false);
    const leadIdEfetivo = dados?.lead_id_vinculado || callSession?.lead_id;

    if (dados?.agendar_proximo_contato && dados?.data_proximo_contato && leadIdEfetivo) {
      try {
        const dataProximoContato = new Date(dados.data_proximo_contato);
        const periodoHora = dataProximoContato.getHours() < 13 ? 'manha' : 'tarde';
        const tarefasPend = await buscarTarefasPendentesDoLead(empresaId, leadIdEfetivo);
        await encerrarTarefasAutomaticamente(tarefasPend, 'followup_agendado');
        await criarTarefa({
          empresaId, lead_id: leadIdEfetivo,
          lead_nome: callSession.lead_nome || '', lead_telefone: callSession.lead_telefone || '',
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
          lead_id: leadIdEfetivo,
          lead_nome: callSession.lead_nome || '',
          sdr_email: user?.email,
          tipo: 'anotacao',
          resultado: 'agendamento',
          observacao: `📅 Próximo contato agendado: ${dados.tipo_proximo_contato || 'contato'} em ${dataFormatada} às ${horaFormatada} · Responsável: ${user?.full_name || user?.email}`,
        });
        queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      } catch {}
    }

    if (dados?.agendar_reuniao && dados?.data_reuniao && dados?.closer_email && callSession?.lead_id) {
      try {
        await atualizarLead(callSession.lead_id, {
          status: "reuniao_agendada",
          data_reuniao: dados.data_reuniao,
          closer_responsavel: dados.closer_email,
        });

        const tarefasPend = await buscarTarefasPendentesDoLead(empresaId, callSession.lead_id);
        if (tarefasPend.length > 0) {
          await encerrarTarefasAutomaticamente(tarefasPend, "reuniao_agendada");
        }

        const dataReuniao = new Date(dados.data_reuniao);
        const periodoReuniao = dataReuniao.getHours() < 13 ? "manha" : "tarde";
        await criarTarefa({
          empresaId,
          lead_id: callSession.lead_id,
          lead_nome: callSession.lead_nome || "",
          lead_telefone: callSession.lead_telefone || "",
          sdr_email: dados.closer_email,
          tipo: "reuniao",
          data_prevista: dados.data_reuniao.split("T")[0],
          periodo: periodoReuniao,
          status: "pendente",
          observacao: `Reunião agendada via ligação por ${user?.full_name || user?.email}`,
        });

        toast.success("Reunião agendada e tarefas anteriores encerradas!");
        queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      } catch (e) {
        console.error("[ModalAtendimentoLead] erro ao agendar reunião:", e.message);
        toast.error("Erro ao agendar reunião: " + e.message);
      }
    }

    // Desqualificação / sem interesse via ligação → encerrar tarefas pendentes do lead
    if ((dados?.status_lead === 'desqualificado' || dados?.status_lead === 'sem_interesse') && leadIdEfetivo) {
      try {
        const tarefasPendDesq = await buscarTarefasPendentesDoLead(empresaId, leadIdEfetivo);
        if (tarefasPendDesq.length > 0) {
          await encerrarTarefasAutomaticamente(
            tarefasPendDesq,
            dados.status_lead === 'sem_interesse' ? 'sem_interesse' : 'desqualificacao'
          );
        }
      } catch (e) {
        console.warn('[ModalAtendimentoLead] erro ao encerrar tarefas do lead desqualificado:', e.message);
      }
    }

    if (dados?.resultado && finalizarLigacao) {
      const novoStatusLead = dados.status_lead === 'manter' ? null : dados.status_lead;
      const atividadeRes = await finalizarLigacao(
        dados.resultado,
        dados.spin || null,
        dados.observacao || '',
        novoStatusLead,
        dados.qualification_id || null,
      );
      const atividadeId = atividadeRes?.id || atividadeRes?.atividade_id;
      if (atividadeId) gerarResumoIA(atividadeId, dados);
    } else {
      fecharModalAtendimento?.();
    }
  };

  return (
    <ModalAtendimentoBase
      aberto={modalAtendimentoAberto}
      minimizado={minimizado}
      setMinimizado={setMinimizado}
      confirmCancelar={confirmCancelar}
      setConfirmCancelar={setConfirmCancelar}
      leadNome={callSession.lead_nome}
      leadTelefone={callSession.lead_telefone}
      tma={tmaLigacao ?? 0}
      duracaoLigacao={duracaoLigacao || 0}
      leadCallStatus={leadCallStatus}
      onClose={handleClose}
      onSave={handleSave}
      qualificacoes3C={qualificacoes3C || []}
      qualificacoesCarregando={qualificacoesCarregando}
      tarefa={{
        id: callSession.call_session_id || callSession.id,
        lead_id: callSession.lead_id,
        lead_nome: callSession.lead_nome,
        lead_telefone: callSession.lead_telefone,
        tipo: 'ligacao',
        status: 'em_andamento',
        titulo: `Ligação — ${callSession.lead_nome || callSession.lead_telefone}`,
      }}
    />
  );
}