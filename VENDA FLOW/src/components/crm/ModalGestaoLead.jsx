import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { atualizarLead } from "@/lib/services/leadService";
import { listarTarefas, buscarTarefasPendentesDoLead, encerrarTarefasAutomaticamente } from "@/lib/services/tarefaService";
import { listarAtividadesDoLead, criarAtividade } from "@/lib/services/atividadeService";
import { listarVinculos, vinculosParaUsuarios, carregarMapaNomes } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { base44 } from "@/api/base44Client";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  User, Phone, Mail, Building2, ArrowRightLeft, Clock,
  CheckCircle2, AlertTriangle, MessageCircle, Calendar,
  FileText, X, ChevronDown, ChevronUp, Save, History, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TIPO_ICON = {
  ligacao:   <Phone className="w-3.5 h-3.5" />,
  whatsapp:  <MessageCircle className="w-3.5 h-3.5" />,
  email:     <Mail className="w-3.5 h-3.5" />,
  reuniao:   <Calendar className="w-3.5 h-3.5" />,
  default:   <FileText className="w-3.5 h-3.5" />,
};

const RESULTADO_COR = {
  conectado:         "text-emerald-400",
  nao_atendeu:       "text-slate-400",
  mensagem_enviada:  "text-sky-400",
  agendado:          "text-violet-400",
  recusou:           "text-rose-400",
  sem_interesse:     "text-rose-400",
};

const STATUS_OPCOES = [
  { value: "novo",              label: "Novo" },
  { value: "em_contato",       label: "Em contato" },
  { value: "qualificado",      label: "Qualificado" },
  { value: "reuniao_agendada", label: "Reunião agendada" },
  { value: "reuniao_realizada",label: "Reunião realizada" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "em_negociacao",    label: "Em negociação" },
  { value: "perdido",          label: "Perdido" },
];

const ABAS = [
  { id: "info",      label: "Informações" },
  { id: "historico", label: "Histórico" },
  { id: "tarefas",   label: "Tarefas" },
  { id: "transferir",label: "Transferir" },
];

export default function ModalGestaoLead({ lead, onClose }) {
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60_000,
  });
  const [aba, setAba] = useState("info");

  const [nome, setNome] = useState(lead.nome || "");
  const [empresa, setEmpresa] = useState(lead.empresa || "");
  const [telefone, setTelefone] = useState(lead.telefone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [status, setStatus] = useState(lead.status || "novo");
  const [observacoes, setObservacoes] = useState(lead.observacoes || "");
  const [sdrDestino, setSdrDestino] = useState("");
  const [closerDestino, setCloserDestino] = useState("");
  const [devolvendoBase, setDevolvendoBase] = useState(false);

  const { data: atividades = [], isLoading: loadingAtv } = useQuery({
    queryKey: ["atividades-lead", lead.id],
    queryFn: () => listarAtividadesDoLead(lead.id),
    enabled: !!lead.id,
  });

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas-lead", lead.id, empresaId],
    queryFn: async () => {
      const todas = await listarTarefas(empresaId, {});
      return todas.filter(t => t.lead_id === lead.id).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!lead.id && !!empresaId,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
  });

  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });

  const usuarios = vinculosParaUsuarios(vinculos, mapaNomes);
  const sdrs    = usuarios.filter(u => ["sdr", "closer", "cs", "social_seller", "admin", "gestor", "supervisor"].includes(u.papel));
  const closers = usuarios.filter(u => ["closer", "cs", "admin", "gestor", "supervisor"].includes(u.papel));

  const resolverNome = (email) => {
    if (!email) return '';
    const u = usuarios.find(x => x.email === email);
    return u?.full_name || mapaNomes.get(email.toLowerCase()) || email.split("@")[0];
  };

  const salvarMutation = useMutation({
    mutationFn: (data) => atualizarLead(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead atualizado!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const transferirMutation = useMutation({
    mutationFn: (data) => atualizarLead(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Lead transferido com sucesso!");
      onClose();
    },
    onError: () => toast.error("Erro ao transferir"),
  });

  const handleSalvar = () => {
    salvarMutation.mutate({ nome, empresa, telefone, email, status, observacoes });
  };

  const handleTransferir = async () => {
    if (!sdrDestino && !closerDestino) {
      toast.error("Selecione ao menos um responsável"); return;
    }
    const update = {};
    if (sdrDestino) update.sdr_responsavel = sdrDestino;
    if (closerDestino) update.closer_responsavel = closerDestino;

    // Monta descrição da transferência para o histórico
    const partes = [];
    if (sdrDestino) {
      const nomeNovo = sdrs.find(u => u.email === sdrDestino)?.full_name || mapaNomes.get(sdrDestino?.toLowerCase()) || sdrDestino.split("@")[0];
      const nomeAnterior = lead.sdr_responsavel ? (sdrs.find(u => u.email === lead.sdr_responsavel)?.full_name || mapaNomes.get(lead.sdr_responsavel?.toLowerCase()) || lead.sdr_responsavel.split("@")[0]) : "sem SDR";
      partes.push(`SDR: ${nomeAnterior} → ${nomeNovo}`);
    }
    if (closerDestino) {
      const nomeNovo = closers.find(u => u.email === closerDestino)?.full_name || mapaNomes.get(closerDestino?.toLowerCase()) || closerDestino.split("@")[0];
      const nomeAnterior = lead.closer_responsavel ? (closers.find(u => u.email === lead.closer_responsavel)?.full_name || mapaNomes.get(lead.closer_responsavel?.toLowerCase()) || lead.closer_responsavel.split("@")[0]) : "sem closer";
      partes.push(`Closer: ${nomeAnterior} → ${nomeNovo}`);
    }

    try {
      await criarAtividade({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        sdr_email: currentUser?.email,
        tipo: "anotacao",
        resultado: "outro",
        observacao: `🔄 Transferência de responsável — ${partes.join(" | ")}`,
        origem_sincronizacao: "manual",
      });
      queryClient.invalidateQueries({ queryKey: ["atividades-lead", lead.id] });
    } catch (e) {
      console.warn("[ModalGestaoLead] Falha ao registrar atividade de transferência:", e.message);
    }

    // Transferência de responsável → encerrar TODAS as tarefas pendentes do lead.
    // A jornada anterior morre; o novo responsável começa limpo.
    try {
      const pendentes = await buscarTarefasPendentesDoLead(empresaId, lead.id);
      if (pendentes.length > 0) {
        await encerrarTarefasAutomaticamente(pendentes, "transferencia");
      }
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-lead", lead.id] });
    } catch (e) {
      console.warn("[ModalGestaoLead] Falha ao encerrar tarefas pendentes:", e.message);
    }

    transferirMutation.mutate(update);
  };

  const handleDevolverBase = async () => {
    if (!lead?.id) return;
    setDevolvendoBase(true);
    try {
      const resp = await base44.functions.invoke("removerLeadDaCadencia", { lead_id: lead.id });
      if (resp?.data?.error) throw new Error(resp.data.error);

      toast.success(`${lead.nome} removido da cadência e devolvido à base`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["atividades-lead", lead.id] });
      onClose();
    } catch (err) {
      toast.error("Erro ao devolver lead: " + err.message);
    } finally {
      setDevolvendoBase(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "linear-gradient(135deg, #0a0e1a, #0c1628)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800/60 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">{lead.nome || "Lead"}</h2>
            {lead.empresa && <p className="text-xs text-slate-400">{lead.empresa}</p>}
            <div className="flex items-center gap-2 mt-1">
              {lead.sdr_responsavel && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/20 text-sky-300">
                  SDR: {resolverNome(lead.sdr_responsavel)}
                </span>
              )}
              {lead.closer_responsavel && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-300">
                  Closer: {resolverNome(lead.closer_responsavel)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800/60 px-5 flex-shrink-0">
          {ABAS.map(a => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                aba === a.id
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              {a.label}
              {a.id === "historico" && atividades.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">{atividades.length}</span>
              )}
              {a.id === "tarefas" && tarefas.filter(t => t.status === "pendente").length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                  {tarefas.filter(t => t.status === "pendente").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ABA INFORMAÇÕES */}
          {aba === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400 mb-1">Nome</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1">Empresa</Label>
                  <Input value={empresa} onChange={e => setEmpresa(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1">Telefone</Label>
                  <Input value={telefone} onChange={e => setTelefone(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1">E-mail</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1">Status do pipeline</Label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500">
                  {STATUS_OPCOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1">Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-sm min-h-[80px]"
                  placeholder="Notas sobre o lead..." />
              </div>
              {(lead.problema_identificado || lead.valor_proposta || lead.motivo_perda) && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dados do pipeline</p>
                  {lead.problema_identificado && (
                    <div>
                      <p className="text-[10px] text-slate-500">Problema identificado</p>
                      <p className="text-xs text-slate-300">{lead.problema_identificado}</p>
                    </div>
                  )}
                  {lead.valor_proposta && (
                    <div>
                      <p className="text-[10px] text-slate-500">Proposta</p>
                      <p className="text-xs text-slate-300">R$ {Number(lead.valor_proposta).toLocaleString("pt-BR")}
                        {lead.forma_pagamento && ` · ${lead.forma_pagamento.replace(/_/g, " ")}`}
                      </p>
                    </div>
                  )}
                  {lead.motivo_perda && (
                    <div>
                      <p className="text-[10px] text-slate-500">Motivo da perda</p>
                      <p className="text-xs text-rose-300">{lead.motivo_perda.replace(/_/g, " ")}</p>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={handleSalvar}
                disabled={salvarMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Save className="w-4 h-4" />
                {salvarMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          )}

          {/* ABA HISTÓRICO */}
          {aba === "historico" && (
            <div className="space-y-2">
              {loadingAtv ? (
                <div className="text-center py-8 text-slate-500 text-sm">Carregando histórico...</div>
              ) : atividades.length === 0 ? (
                <div className="text-center py-10">
                  <History className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Sem atividades registradas</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/60" />
                  <div className="space-y-3 ml-10">
                    {atividades.map(atv => {
                      const Icon = TIPO_ICON[atv.tipo] || TIPO_ICON.default;
                      return (
                        <div key={atv.id} className="relative">
                          <div className="absolute -left-10 top-2 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                            {Icon}
                          </div>
                          <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-white capitalize">{atv.tipo?.replace(/_/g, " ")}</span>
                                {atv.resultado && (
                                  <span className={cn("text-[10px]", RESULTADO_COR[atv.resultado] || "text-slate-400")}>
                                    · {atv.resultado.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 flex-shrink-0">
                                {format(new Date(atv.created_date), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {atv.sdr_email && (
                              <p className="text-[10px] text-slate-500">por {resolverNome(atv.sdr_email)}</p>
                            )}
                            {atv.observacao && (
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{atv.observacao}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA TAREFAS */}
          {aba === "tarefas" && (
            <div className="space-y-2">
              {loadingTarefas ? (
                <div className="text-center py-8 text-slate-500 text-sm">Carregando tarefas...</div>
              ) : tarefas.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Sem tarefas para este lead</p>
                </div>
              ) : (
                tarefas.map(t => {
                  const atrasada = t.status === "pendente" && isBefore(new Date(t.data_prevista + "T12:00:00"), startOfDay(new Date()));
                  return (
                    <div key={t.id} className={cn(
                      "rounded-xl border px-3 py-2.5",
                      t.status === "concluida" ? "bg-slate-800/20 border-slate-700/20 opacity-60"
                        : atrasada ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-slate-800/40 border-slate-700/40"
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-white capitalize">{t.tipo?.replace(/_/g, " ")}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full border",
                              t.status === "concluida" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : atrasada ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                : "bg-slate-700/40 border-slate-700/40 text-slate-400"
                            )}>
                              {t.status === "concluida" ? "Concluída" : atrasada ? "Atrasada" : "Pendente"}
                            </span>
                          </div>
                          {t.sdr_email && <p className="text-[10px] text-slate-500">{resolverNome(t.sdr_email)}</p>}
                          {t.observacao && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.observacao}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-slate-500">
                            {format(new Date(t.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}
                          </p>
                          <p className="text-[10px] text-slate-600 capitalize">{t.periodo}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ABA TRANSFERIR */}
          {aba === "transferir" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-300 font-medium mb-1">Transferência de responsável</p>
                <p className="text-xs text-slate-400">
                  Ao transferir, o novo responsável assumirá as próximas tarefas deste lead. As atividades anteriores são mantidas no histórico.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-300">Responsável atual</p>
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-14">SDR:</span>
                    <span className="text-xs text-white">{lead.sdr_responsavel || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-14">Closer:</span>
                    <span className="text-xs text-white">{lead.closer_responsavel || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300">Novo responsável</p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> SDR responsável
                  </Label>
                  <select
                    value={sdrDestino}
                    onChange={e => setSdrDestino(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">Manter atual ({resolverNome(lead.sdr_responsavel) || "sem SDR"})</option>
                    {sdrs.map(u => (
                      <option key={u.email} value={u.email}>
                        {u.full_name || mapaNomes.get(u.email?.toLowerCase()) || u.email.split("@")[0]} ({u.papel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3 h-3" /> Closer responsável
                  </Label>
                  <select
                    value={closerDestino}
                    onChange={e => setCloserDestino(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">Manter atual ({resolverNome(lead.closer_responsavel) || "sem closer"})</option>
                    {closers.map(u => (
                      <option key={u.email} value={u.email}>
                        {u.full_name || mapaNomes.get(u.email?.toLowerCase()) || u.email.split("@")[0]} ({u.papel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleTransferir}
                disabled={transferirMutation.isPending || (!sdrDestino && !closerDestino)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {transferirMutation.isPending ? "Transferindo..." : "Confirmar transferência"}
              </button>

              {/* Separador */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-slate-700/50" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-slate-700/50" />
              </div>

              {/* Devolver à base */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                <p className="text-xs text-rose-300 font-medium mb-1">Devolver à base</p>
                <p className="text-xs text-slate-400 mb-3">
                  Remove SDR e Closer do lead, exclui todas as tarefas pendentes da cadência e devolve o lead à base com status "novo".
                </p>
                <button
                  onClick={handleDevolverBase}
                  disabled={devolvendoBase}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600/80 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {devolvendoBase ? "Removendo..." : "Remover do SDR/Closer e devolver à base"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}