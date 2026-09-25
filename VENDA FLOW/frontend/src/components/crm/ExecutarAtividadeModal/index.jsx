import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarProdutos, listarClosers, listarFormularios } from "@/lib/services/equipeService";
import { buscarLeadPorIdDireto } from "@/lib/services/leadService";
import { buscarTarefasPendentesDoLead } from "@/lib/services/tarefaService";
import ConfirmarLeadOrfaoDialog from "./ConfirmarLeadOrfaoDialog";
import CriarLeadRapidoModal from "./CriarLeadRapidoModal";
import { atualizarCallSession } from "@/lib/services/telefoniaService";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Minus, UserPlus } from "lucide-react";



import CockpitHeader from "./CockpitHeader";
import CockpitLeadPanel from "./CockpitLeadPanel";
import CockpitHistoricoPanel from "./CockpitHistoricoPanel";
import WizardEtapas from "./WizardEtapas";
import ScoreDuplo from "./ScoreDuplo";
import { useScoreQualidade } from "./useScoreQualidade";
import { useCrmTracker, CRM_EVENTS } from "@/components/crm/events/useCrmTracker";
import { useCockpitPerformance } from "@/components/crm/events/useCockpitPerformance";
import { useFeatureFlag, FLAGS } from "@/lib/featureFlags";

const resultadoOptions = {
  ligacao: [
    { value: "atendeu", label: "Atendeu" },
    { value: "nao_atendeu", label: "Não atendeu" },
    { value: "ocupado", label: "Ocupado" },
    { value: "caixa_postal", label: "Caixa postal" },
    { value: "numero_invalido", label: "Número inválido" },
    { value: "outro", label: "Outro" },
  ],
  whatsapp: [
    { value: "respondeu", label: "Respondeu" },
    { value: "visualizou", label: "Visualizou" },
    { value: "nao_respondeu", label: "Não respondeu" },
    { value: "outro", label: "Outro" },
  ],
  email: [
    { value: "respondeu", label: "Respondeu" },
    { value: "nao_respondeu", label: "Não respondeu" },
    { value: "outro", label: "Outro" },
  ],
  pesquisa: [
    { value: "outro", label: "Concluída" },
  ],
  realizar_reuniao: [
    { value: "reuniao_realizada", label: "Reunião Realizada" },
    { value: "nao_compareceu", label: "Cliente não compareceu" },
    { value: "reagendada", label: "Reagendada" },
  ],
  enviar_contrato: [
    { value: "contrato_enviado", label: "Contrato Enviado" },
    { value: "cliente_desistiu", label: "Cliente Desistiu" },
    { value: "outro", label: "Outro" },
  ],
  recebimento: [
    { value: "venda_realizada", label: "Venda Realizada" },
    { value: "cliente_desistiu", label: "Cliente Desistiu" },
    { value: "nao_comprou", label: "Não Comprou" },
  ],
  case_sucesso: [
    { value: "case_criado", label: "Case Criado" },
    { value: "depoimento_coletado", label: "Depoimento Coletado" },
    { value: "cliente_recusou", label: "Cliente Recusou" },
  ],
  instagram: [
    { value: "respondeu", label: "Respondeu" },
    { value: "visualizou", label: "Visualizou" },
    { value: "nao_respondeu", label: "Não Respondeu" },
  ],
};

const statusLeadOptions = [
  { value: "manter", label: "Manter em cadência", descricao3c: null },
  { value: "sem_interesse", label: "Sem interesse", descricao3c: "Não discar novamente para o cliente" },
  { value: "desqualificado", label: "Desqualificado", descricao3c: "Não discar novamente para o telefone" },
];

export default function ExecutarAtividadeModal({ open, minimizado, duracaoLigacao, leadCallStatus, tmaExterno, onClose, onCancelar, onMinimizar, tarefa, scriptUsado, onSave, sdrNome, currentUser, is3cCall, qualificacoes3C = [], qualificacoesCarregando = false }) {
  // onCancelar → pedido de cancelamento (abre confirmação). onClose → fechamento real.
  // Fallback: se onCancelar não vier, usa onClose (compatibilidade com chamadas antigas).
  const solicitarCancelamento = onCancelar || onClose;
  const { empresaId } = useEmpresaAtual();
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const [formData, setFormData] = useState({
    resultado: "",
    observacao: "",
    duracao_segundos: 0,
    agendar_reuniao: false,
    data_reuniao: "",
    closer_email: "",
    cadencia_closer_id: "",
    status_lead: "manter",
    motivo_desqualificacao: "",
    produto_id: "",
    agendar_proximo_contato: false,
    data_proximo_contato: "",
    tipo_proximo_contato: "ligacao",
    motivo_desistencia: "",
    formulario_selecionado: "",
    respostas_formulario: {},
    temperatura: "",
    dor_principal: "",
    urgencia: "",
    probabilidade_fechamento: 50,
    _sugestao_aceita: "",
    qualification_id: null,
  });
  const [saving, setSaving] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [etapasCompletas, setEtapasCompletas] = useState([]);
  const [tmaSegundos, setTmaSegundos] = useState(0);
  const tmaIntervalRef = useRef(null);
  const tmaInicioRef = useRef(null);
  const tmaCongeladoRef = useRef(0);
  const [perfilData, setPerfilData] = useState({});
  const [formularioExpanded, setFormularioExpanded] = useState(false);
  const [confirmarOrfao, setConfirmarOrfao] = useState(false);
  const [criarLeadAberto, setCriarLeadAberto] = useState(false);
  const [leadVinculado, setLeadVinculado] = useState(null);

  // Reset do lead vinculado ao trocar de atendimento
  useEffect(() => { setLeadVinculado(null); }, [tarefa?.id]);

  // Tarefa efetiva: usa o lead recém-criado/vinculado se houver
  const tarefaEfetiva = leadVinculado
    ? { ...tarefa, lead_id: leadVinculado.id, lead_nome: leadVinculado.nome, lead_telefone: leadVinculado.telefone || tarefa?.lead_telefone }
    : tarefa;

  // Telefone em conversa sem lead na base → oferecer criação rápida
  const semLeadVinculado = open && !tarefaEfetiva?.lead_id && !!tarefaEfetiva?.lead_telefone;

  const handleLeadCriado = async (lead) => {
    setLeadVinculado(lead);
    // Vincular o lead à CallSession ativa (tarefa.id = call_session_id em atendimento de campanha)
    if (tarefa?.id) {
      await atualizarCallSession(tarefa.id, {
        lead_id: lead.id,
        lead_nome: lead.nome,
      }).catch(() => {});
    }
  };

  const tmaAtual = (tmaExterno !== undefined && tmaExterno > 0) ? tmaExterno : tmaSegundos;

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos", empresaId],
    queryFn: () => listarProdutos(empresaId),
    enabled: !!empresaId,
  });

  const { data: closers = [] } = useQuery({
    queryKey: ["closers", empresaId],
    queryFn: () => listarClosers(empresaId),
    enabled: !!empresaId,
  });

  const { data: formularios = [] } = useQuery({
    queryKey: ["formularios-ativos", empresaId, formData.produto_id],
    queryFn: async () => {
      const forms = await listarFormularios(empresaId);
      if (formData.produto_id) {
        return forms.filter(f =>
          !f.produtos_vinculados ||
          f.produtos_vinculados.length === 0 ||
          f.produtos_vinculados.includes(formData.produto_id)
        );
      }
      return forms;
    },
    enabled: !!empresaId && (formData.resultado === 'atendeu' || formData.resultado === 'respondeu') && formData.status_lead === 'manter',
  });

  const { data: leadAtual } = useQuery({
    queryKey: ["lead-perfil-modal", tarefa?.lead_id],
    queryFn: () => buscarLeadPorIdDireto(tarefa?.lead_id),
    enabled: !!tarefa?.lead_id && open,
  });

  const { data: tarefasPendentesLead = [] } = useQuery({
    queryKey: ["tarefas-pendentes-lead", empresaId, tarefa?.lead_id],
    queryFn: () => buscarTarefasPendentesDoLead(empresaId, tarefa?.lead_id),
    enabled: !!empresaId && !!tarefa?.lead_id && open,
  });

  // Conta tarefas pendentes do lead EXCETO a atual sendo finalizada
  const pendentesRestantes = tarefasPendentesLead.filter(t => t.id !== tarefa?.id).length;

  // Lead ficaria órfão: era a última tarefa, segue ativo, e nenhum próximo passo agendado
  const ficariaOrfao =
    pendentesRestantes === 0 &&
    formData.status_lead === "manter" &&
    !formData.agendar_proximo_contato &&
    !formData.agendar_reuniao;

  useEffect(() => {
    if (duracaoLigacao !== undefined) {
      setFormData(prev => ({ ...prev, duracao_segundos: duracaoLigacao }));
    }
  }, [duracaoLigacao]);

  useEffect(() => {
    if (tmaExterno !== undefined) return;
    if (open && !tmaIntervalRef.current && !tmaInicioRef.current) {
      tmaInicioRef.current = Date.now();
      tmaIntervalRef.current = setInterval(() => {
        const val = Math.floor((Date.now() - tmaInicioRef.current) / 1000);
        setTmaSegundos(val);
        tmaCongeladoRef.current = val;
      }, 1000);
    }
    if (!open && !minimizado) {
      if (tmaIntervalRef.current) { clearInterval(tmaIntervalRef.current); tmaIntervalRef.current = null; }
      tmaInicioRef.current = null;
      setTmaSegundos(0);
      tmaCongeladoRef.current = 0;
    }
    return () => {};
  }, [open, minimizado, tmaExterno]);

  useEffect(() => {
    if (tarefa?.produto_id) {
      setFormData(prev => ({ ...prev, produto_id: tarefa.produto_id }));
    }
  }, [tarefa?.produto_id]);

  useEffect(() => {
    const ligacaoAtiva = open && (leadCallStatus === 'em_ligacao' || leadCallStatus === 'encerrado');
    if (!ligacaoAtiva) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Você tem uma ligação em andamento. Deseja sair sem registrar?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [open, minimizado, leadCallStatus]);

  useEffect(() => {
    if (leadAtual) {
      setPerfilData({
        cidade: leadAtual.cidade || "",
        estado: leadAtual.estado || "",
        qtd_tecnicos: leadAtual.qtd_tecnicos ?? null,
        qtd_vendedores: leadAtual.qtd_vendedores ?? null,
        qtd_administrativo: leadAtual.qtd_administrativo ?? null,
        contratou_consultoria: leadAtual.contratou_consultoria ?? null,
        tempo_seguindo: leadAtual.tempo_seguindo || "",
        qtd_unidades: leadAtual.qtd_unidades ?? null,
        tipo_rede: leadAtual.tipo_rede || "",
        tem_socios: leadAtual.tem_socios || false,
        nome_socio: leadAtual.nome_socio || "",
        telefone_socio: leadAtual.telefone_socio || "",
        ja_cliente: leadAtual.ja_cliente || false,
        produtos_comprados: leadAtual.produtos_comprados || [],
      });
    }
  }, [leadAtual]);

  const formularioSelecionado = formularios.find(f => f.id === formData.formulario_selecionado);
  const options = resultadoOptions[tarefa?.tipo] || resultadoOptions.ligacao;
  const { completude, qualidade, itensCompletude, itensQualidade, avisos } = useScoreQualidade(formData);
  const trackerCtx = { empresaId, userId: user?.email, leadId: tarefa?.lead_id, atendimentoId: tarefa?.id };
  const { track, emitOnce, resetDedup } = useCrmTracker(trackerCtx);
  const { start: perfStart, end: perfEnd } = useCockpitPerformance(trackerCtx);
  const scoreEnabled = useFeatureFlag(FLAGS.COCKPIT_SCORE);
  const analyticsEnabled = useFeatureFlag(FLAGS.COCKPIT_ANALYTICS);

  // Disparar evento de início — idempotente via emitOnce
  useEffect(() => {
    if (open && analyticsEnabled) {
      perfStart("modal_open");
      emitOnce(CRM_EVENTS.ATENDIMENTO_INICIADO);
      perfEnd(CRM_EVENTS.MODAL_ABERTO_MS, "modal_open");
    }
    if (!open) resetDedup();
  }, [open]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    // Intercepta: última tarefa do lead, ainda ativo e sem próximo passo → confirmar antes de salvar
    if (ficariaOrfao) {
      setConfirmarOrfao(true);
      return;
    }
    await executarSave();
  };

  const executarSave = async () => {
    setConfirmarOrfao(false);
    setSaving(true);
    if (analyticsEnabled) {
      perfStart("save");
      track(CRM_EVENTS.ATENDIMENTO_FINALIZADO, {
        resultado: formData.resultado,
        temperatura: formData.temperatura,
        tma: tmaAtual,
        score_completude: completude,
        score_qualidade: qualidade,
      });
    }
    await onSave({
      ...formData,
      lead_id_vinculado: leadVinculado?.id || null,
      callSessionTime: formData.duracao_segundos,
      tma_segundos: tmaAtual,
      script_usado: scriptUsado,
      perfil_data: {
        ...perfilData,
        dor_principal: formData.dor_principal,
        urgencia: formData.urgencia,
        temperatura: formData.temperatura,
        probabilidade_fechamento: formData.probabilidade_fechamento,
      },
    });
    if (analyticsEnabled) perfEnd(CRM_EVENTS.SAVE_MS, "save");
    setSaving(false);
    setFormData({
      resultado: "",
      observacao: "",
      duracao_segundos: 0,
      agendar_reuniao: false,
      data_reuniao: "",
      closer_email: "",
      cadencia_closer_id: "",
      status_lead: "manter",
      motivo_desqualificacao: "",
      produto_id: "",
      agendar_proximo_contato: false,
      data_proximo_contato: "",
      tipo_proximo_contato: "ligacao",
      motivo_desistencia: "",
      formulario_selecionado: "",
      respostas_formulario: {},
      temperatura: "",
      dor_principal: "",
      urgencia: "",
      probabilidade_fechamento: 50,
      _sugestao_aceita: "",
      qualification_id: null,
    });
    setPerfilData({});
    setEtapaAtual(1);
    setEtapasCompletas([]);
    onClose();
  };

  const handleRespostaFormulario = (perguntaIndex, valor) => {
    setFormData({
      ...formData,
      respostas_formulario: {
        ...formData.respostas_formulario,
        [perguntaIndex]: valor,
      },
    });
  };

  return (
    <>
      <Dialog open={open && !minimizado} onOpenChange={() => {}}>
        <DialogContent
          className="bg-slate-900/95 border-slate-700/50 max-w-[90vw] w-[1100px] h-[85vh] flex flex-col overflow-hidden backdrop-blur-sm p-0 [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Registrar Ligação</DialogTitle>
            <DialogDescription>Formulário para registrar atividade do lead {tarefa?.lead_nome}</DialogDescription>
          </DialogHeader>

          {/* ── Barra superior de status ── */}
          <div className="flex items-center flex-shrink-0">
            <div className="flex-1 min-w-0">
              <CockpitHeader
                tarefa={tarefaEfetiva}
                duracaoLigacao={formData.duracao_segundos}
                tmaAtual={tmaAtual}
                leadCallStatus={leadCallStatus}
                temperatura={formData.temperatura}
                sdrNome={sdrNome}
              />
            </div>
            <div className="flex items-center gap-2 pr-3 flex-shrink-0">
              {semLeadVinculado && (
                <button
                  type="button"
                  onClick={() => setCriarLeadAberto(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/20 transition-all"
                  title="Telefone não encontrado na base — criar lead"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Criar lead
                </button>
              )}
              {tarefaEfetiva?.lead_id && (
                <span className="text-[10px] font-mono text-slate-600 bg-slate-800/60 border border-slate-700/40 rounded-md px-2 py-1">
                  #{String(tarefaEfetiva.lead_id).slice(-6)}
                </span>
              )}
              {onMinimizar && (
                <button
                  type="button"
                  onClick={onMinimizar}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                  title="Minimizar"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

            {/* ── Grid 3 colunas ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Coluna esquerda: perfil do lead */}
              <div
                className="flex-shrink-0 overflow-y-auto border-r"
                style={{ width: 240, borderColor: "rgba(255,255,255,0.05)", background: "rgba(8,12,24,0.6)" }}
              >
                <CockpitLeadPanel tarefa={tarefaEfetiva} />
              </div>

              {/* Coluna central: wizard */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                {/* Score duplo: completude + qualidade */}
                {scoreEnabled && (
                  <div className="px-4 pt-3 pb-0 flex-shrink-0">
                    <ScoreDuplo
                      completude={completude}
                      qualidade={qualidade}
                      itensCompletude={itensCompletude}
                      itensQualidade={itensQualidade}
                      avisos={avisos}
                    />
                  </div>
                )}
                <WizardEtapas
                  formData={formData}
                  setFormData={setFormData}
                  options={options}
                  statusLeadOptions={statusLeadOptions}
                  produtos={produtos}
                  closers={closers}
                  formularios={formularios}
                  formularioSelecionado={formularioSelecionado}
                  formularioExpanded={formularioExpanded}
                  setFormularioExpanded={setFormularioExpanded}
                  handleRespostaFormulario={handleRespostaFormulario}
                  perfilData={perfilData}
                  setPerfilData={setPerfilData}
                  tarefa={tarefaEfetiva}
                  onSubmit={handleSubmit}
                  saving={saving}
                  onClose={solicitarCancelamento}
                  currentUser={currentUser || user}
                  etapaAtual={etapaAtual}
                  setEtapaAtual={setEtapaAtual}
                  etapasCompletas={etapasCompletas}
                  setEtapasCompletas={setEtapasCompletas}
                  onEtapaChange={(etapa) => analyticsEnabled && track(CRM_EVENTS.ETAPA_CONCLUIDA, { etapa })}
                  onSugestaoAceita={() => analyticsEnabled && track(CRM_EVENTS.SUGESTAO_ACEITA, { resultado: formData.resultado })}
                  is3cCall={is3cCall ?? !!leadCallStatus}
                  qualificacoes3C={qualificacoes3C}
                  qualificacoesCarregando={qualificacoesCarregando}
                />
              </div>{/* fim coluna central wizard */}

              {/* Coluna direita: histórico */}
              <div
                className="flex-shrink-0 border-l overflow-hidden"
                style={{ width: 220, borderColor: "rgba(255,255,255,0.05)", background: "rgba(8,12,24,0.6)" }}
              >
                <CockpitHistoricoPanel tarefa={tarefaEfetiva} />
              </div>

            </div>{/* fim grid 3 colunas */}

          </form>
        </DialogContent>
      </Dialog>

      <ConfirmarLeadOrfaoDialog
        open={confirmarOrfao}
        leadNome={tarefaEfetiva?.lead_nome}
        onVoltarAgendar={() => { setConfirmarOrfao(false); setEtapaAtual(4); }}
        onConfirmarMesmoAssim={executarSave}
      />

      <CriarLeadRapidoModal
        open={criarLeadAberto}
        onClose={() => setCriarLeadAberto(false)}
        empresaId={empresaId}
        sdrEmail={user?.email}
        telefone={tarefa?.lead_telefone}
        onLeadCriado={handleLeadCriado}
      />
    </>
  );
}