import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronRight, ChevronLeft, Phone, MessageCircle, FileText, CalendarClock, Users, User, Calendar, RefreshCw, ExternalLink, Video } from "lucide-react";
import { useState, useMemo } from "react";
import { api } from "@/api/client";
import { isConnected, isConfigured, startOAuthFlow, criarEventoComMeet } from "@/lib/services/googleCalendarService";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { listarVinculos } from "@/lib/services/equipeService";
import { listarCadenciasCloser } from "@/lib/services/cadenciaService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import ResultadoCards from "./ResultadoCards";
import FaturamentoCard from "./FaturamentoCard";
import PerfilAccordion from "./PerfilAccordion";

/* ── Config das etapas ──────────────────────────────── */
const ETAPAS = [
  { id: 1, label: "Resultado",   icon: Phone },
  { id: 2, label: "Qualificação", icon: MessageCircle },
  { id: 3, label: "Detalhes",    icon: FileText },
  { id: 4, label: "Próximo Passo", icon: CalendarClock },
];

/* ── Stepper no topo ─────────────────────────────────── */
function Stepper({ etapaAtual, etapasCompletas }) {
  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      {ETAPAS.map((e, idx) => {
        const isActive   = etapaAtual === e.id;
        const isDone     = etapasCompletas.includes(e.id);
        const isLast     = idx === ETAPAS.length - 1;
        const Icon       = e.icon;

        return (
          <div key={e.id} className="flex items-center flex-1 min-w-0">
            {/* Step pill */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0"
                style={{
                  background: isDone
                    ? "rgba(34,197,94,0.18)"
                    : isActive
                    ? "rgba(96,165,250,0.18)"
                    : "rgba(255,255,255,0.05)",
                  border: isDone
                    ? "1px solid rgba(34,197,94,0.4)"
                    : isActive
                    ? "1px solid rgba(96,165,250,0.4)"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} />
                ) : (
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: isActive ? "#60a5fa" : "#475569" }}
                  />
                )}
              </div>
              <span
                className="text-xs font-semibold hidden sm:block whitespace-nowrap"
                style={{ color: isDone ? "#22c55e" : isActive ? "#60a5fa" : "#475569" }}
              >
                {e.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 h-px mx-2" style={{ background: isDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Etapa 1 — Resultado ─────────────────────────────── */
function Etapa1({ formData, setFormData, options }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white mb-1">Como foi a ligação?</h3>
        <p className="text-xs text-slate-500">Selecione o resultado desta tentativa de contato</p>
      </div>
      <ResultadoCards
        options={options}
        value={formData.resultado}
        onChange={(value) => setFormData(prev => ({ ...prev, resultado: value }))}
      />

      {/* Temperatura */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-300">Temperatura do Lead</Label>
        <div className="flex gap-2">
          {[
            { v: "frio",   emoji: "❄️", label: "Frio",   color: "#60a5fa", border: "rgba(96,165,250,0.4)",  bg: "rgba(96,165,250,0.12)" },
            { v: "morno",  emoji: "🟡", label: "Morno",  color: "#fbbf24", border: "rgba(245,158,11,0.4)",  bg: "rgba(245,158,11,0.12)" },
            { v: "quente", emoji: "🔥", label: "Quente", color: "#22c55e", border: "rgba(34,197,94,0.4)",   bg: "rgba(34,197,94,0.12)" },
          ].map(t => (
            <button
              key={t.v}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, temperatura: prev.temperatura === t.v ? "" : t.v }))}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: formData.temperatura === t.v ? t.bg : "rgba(30,41,59,0.6)",
                border: `1px solid ${formData.temperatura === t.v ? t.border : "rgba(255,255,255,0.08)"}`,
                color: formData.temperatura === t.v ? t.color : "#64748b",
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Aliases e match para qualificações da campanha ─── */
const ALIASES_CRM_3C = {
  nao_atendeu: ['sem contato', 'ligacao caiu', 'nao atendeu', 'not answered', 'caixa postal'],
  ocupado: ['ocupado', 'busy', 'sem contato'],
  caixa_postal: ['caixa postal', 'voicemail', 'mailbox'],
  numero_invalido: ['numero invalido', 'telefone incorreto', 'engano', 'wrong number', 'numero errado'],
  atendeu: ['interessado', 'em negociacao', 'contato efetivo', 'cpc'],
  sem_interesse: ['sem interesse', 'nao tenho interesse', 'lead frio', 'nao quer', 'not interested'],
  desqualificado: ['desqualificado', 'nao ligar', 'blacklist', 'not qualified'],
  reuniao_agendada: ['agendamento', 'reuniao', 'retorno', 'ligar depois', 'callback', 'cliente pediu retorno'],
  qualificado: ['venda', 'conversao', 'fechou', 'qualified', 'venda feita'],
  respondeu: ['respondeu', 'whatsapp', 'em negociacao'],
};

function normalizeText(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findBestMatch(statusCrm, qualificacoes3c) {
  if (!qualificacoes3c || qualificacoes3c.length === 0) return null;
  const aliases = ALIASES_CRM_3C[statusCrm] || [];
  for (const qualif of qualificacoes3c) {
    const nome = normalizeText(qualif.name || qualif.nome || '');
    for (const alias of aliases) {
      if (nome.includes(normalizeText(alias)) || normalizeText(alias).includes(nome)) {
        return qualif;
      }
    }
  }
  return null;
}

/* ── Etapa 2 — Qualificação ──────────────────────────── */
function Etapa2({ formData, setFormData, statusLeadOptions, is3cCall, qualificacoesCampanha = [], qualificacoesCarregando = false }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white mb-1">Qualificação do Lead</h3>
        <p className="text-xs text-slate-500">Atualize o status e registre a situação do prospect</p>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-300">Status do Lead *</Label>
        <div className="grid grid-cols-1 gap-2">
          {statusLeadOptions.map((opt) => {
            const isSelected = formData.status_lead === opt.value;
            const colorMap = {
              manter: { color: "#60a5fa", border: "rgba(96,165,250,0.4)",  bg: "rgba(96,165,250,0.10)" },
              sem_interesse: { color: "#f87171", border: "rgba(248,113,113,0.4)", bg: "rgba(248,113,113,0.10)" },
              desqualificado: { color: "#fb923c", border: "rgba(251,146,60,0.4)", bg: "rgba(251,146,60,0.10)" },
            };
            const cfg = colorMap[opt.value] || colorMap.manter;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const autoMatch = findBestMatch(opt.value, qualificacoesCampanha);
                  setFormData(prev => ({
                    ...prev,
                    status_lead: opt.value,
                    qualification_id: autoMatch ? (autoMatch.id ?? autoMatch.name) : prev.qualification_id,
                    _qualification_sugerida: autoMatch ? (autoMatch.id ?? autoMatch.name) : null,
                  }));
                }}
                className="w-full px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: isSelected ? cfg.bg : "rgba(30,41,59,0.5)",
                  border: `1px solid ${isSelected ? cfg.border : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <span className="text-sm font-semibold" style={{ color: isSelected ? cfg.color : "#64748b" }}>
                  {opt.label}
                </span>
                {opt.descricao3c && (
                  <span className="block text-[10px] mt-0.5" style={{ color: isSelected ? `${cfg.color}99` : "#475569" }}>
                    3C Plus: {opt.descricao3c}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Qualificação da Campanha — só exibe quando for ligação do 3C */}
      {is3cCall && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-300">
            Qualificação da Campanha
            <span className="ml-2 text-[10px] font-normal text-sky-400 bg-sky-400/10 border border-sky-400/20 rounded px-1.5 py-0.5">3C Plus</span>
          </Label>
          {qualificacoesCarregando ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <span className="w-3.5 h-3.5 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Carregando qualificações da campanha…</span>
            </div>
          ) : qualificacoesCampanha.length === 0 ? (
            <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <span className="text-sky-400 mt-0.5 flex-shrink-0">ℹ</span>
              <span className="text-xs text-slate-400">Nenhuma qualificação configurada nesta campanha. A qualificação será determinada automaticamente pelo resultado.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {qualificacoesCampanha.map((q) => {
                const qId = q.id ?? q.name;
                const isSelected = formData.qualification_id === qId;
                const isSugerida = formData._qualification_sugerida === qId;
                return (
                  <button
                    key={qId}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, qualification_id: isSelected ? null : qId }))}
                    className="w-full px-4 py-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2"
                    style={{
                      background: isSelected ? "rgba(56,189,248,0.12)" : "rgba(30,41,59,0.5)",
                      border: `1px solid ${isSelected ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <span className="text-sm font-semibold" style={{ color: isSelected ? "#38bdf8" : "#64748b" }}>
                      {q.name || q.nome}
                    </span>
                    {isSugerida && (
                      <span className="text-[10px] text-sky-400 bg-sky-400/10 border border-sky-400/20 rounded px-1.5 py-0.5 flex-shrink-0">sugerido</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Motivo se desqualificado */}
      <AnimatePresence>
        {(formData.status_lead === "sem_interesse" || formData.status_lead === "desqualificado") && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
            <Label className="text-sm font-semibold text-slate-300">Motivo *</Label>
            <Input
              value={formData.motivo_desqualificacao}
              onChange={(e) => setFormData(prev => ({ ...prev, motivo_desqualificacao: e.target.value }))}
              className="bg-slate-800/60 border-slate-700/60 text-white placeholder-slate-500"
              placeholder="Explique o motivo..."
              required
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Motivo de desistência */}
      <AnimatePresence>
        {(formData.resultado === "cliente_desistiu" || formData.resultado === "nao_comprou") && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="space-y-2 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <Label className="text-sm font-semibold text-rose-300">Motivo da Desistência/Perda *</Label>
            <Textarea
              value={formData.motivo_desistencia}
              onChange={(e) => setFormData(prev => ({ ...prev, motivo_desistencia: e.target.value }))}
              className="bg-slate-800/60 border-slate-700/60 text-white placeholder-slate-500 min-h-[80px]"
              placeholder="Descreva o motivo..."
              required
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Etapa 3 — Detalhes ──────────────────────────────── */
function Etapa3({ formData, setFormData, produtos, formularios, formularioSelecionado, formularioExpanded, setFormularioExpanded, handleRespostaFormulario, perfilData, setPerfilData, tarefa }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white mb-1">Detalhes da Conversa</h3>
        <p className="text-xs text-slate-500">Registre observações, produto e informações relevantes</p>
      </div>

      {/* Produto */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-300">Produto Relacionado</Label>
        <Select value={formData.produto_id} onValueChange={(v) => setFormData(prev => ({ ...prev, produto_id: v }))}>
          <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-white">
            <SelectValue placeholder="Selecione um produto" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value={null}>Nenhum produto</SelectItem>
            {produtos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-300">Observações</Label>
        <Textarea
          value={formData.observacao}
          onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
          className="bg-slate-800/60 border-slate-700/60 text-white placeholder-slate-500 min-h-[90px]"
          placeholder="Anote detalhes importantes da conversa..."
        />
      </div>

      {/* Faturamento */}
      {tarefa?.lead_id && (
        <FaturamentoCard leadId={tarefa.lead_id} currentUserEmail={tarefa.sdr_email} />
      )}

      {/* Formulário de Qualificação */}
      {formularios.length > 0 && (
        <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 space-y-3">
          <button
            type="button"
            onClick={() => setFormularioExpanded(!formularioExpanded)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Formulário de Qualificação</span>
            </div>
            <motion.div animate={{ rotate: formularioExpanded ? 180 : 0 }}>
              <ChevronRight className="w-4 h-4 text-slate-500 rotate-90" />
            </motion.div>
          </button>

          <AnimatePresence>
            {formularioExpanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                <Select
                  value={formData.formulario_selecionado}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, formulario_selecionado: v, respostas_formulario: {} }))}
                >
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-white">
                    <SelectValue placeholder="Selecione um formulário" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value={null}>Nenhum formulário</SelectItem>
                    {formularios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {formularioSelecionado && (
                  <div className="bg-slate-800/30 rounded-lg p-3 grid grid-cols-1 gap-3">
                    {formularioSelecionado.perguntas?.map((pergunta, index) => (
                      <div key={index} className="space-y-1.5">
                        <Label className="text-xs text-slate-300">
                          {index + 1}. {pergunta.pergunta}
                          {pergunta.obrigatoria && <span className="text-rose-400 ml-1">*</span>}
                        </Label>
                        {pergunta.tipo_resposta === "texto_curto" && (
                          <Input value={formData.respostas_formulario[index] || ""} onChange={(e) => handleRespostaFormulario(index, e.target.value)} className="bg-slate-700/60 border-slate-600/60 text-white" required={pergunta.obrigatoria} />
                        )}
                        {pergunta.tipo_resposta === "texto_longo" && (
                          <Textarea value={formData.respostas_formulario[index] || ""} onChange={(e) => handleRespostaFormulario(index, e.target.value)} className="bg-slate-700/60 border-slate-600/60 text-white min-h-[60px]" required={pergunta.obrigatoria} />
                        )}
                        {pergunta.tipo_resposta === "multipla_escolha" && (
                          <Select value={formData.respostas_formulario[index] || ""} onValueChange={(v) => handleRespostaFormulario(index, v)}>
                            <SelectTrigger className="bg-slate-700/60 border-slate-600/60 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {pergunta.opcoes?.map((o, i) => <SelectItem key={i} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Perfil da Empresa */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-400">Perfil da Empresa (opcional)</p>
        <PerfilAccordion formData={perfilData} setFormData={setPerfilData} />
      </div>
    </div>
  );
}

/* ── Google Meet Section ─────────────────────────────── */
function GoogleMeetSection({ formData, setFormData, tarefa }) {
  const [gcalConectado, setGcalConectado] = useState(isConnected());
  const [gcalConectando, setGcalConectando] = useState(false);
  const [criandoEvento, setCriandoEvento] = useState(false);

  const handleConectar = async () => {
    setGcalConectando(true);
    try {
      await startOAuthFlow();
      setGcalConectado(true);
      toast.success("Conta Google conectada!");
    } catch (err) {
      toast.error(err.message || "Erro ao conectar com Google");
    } finally {
      setGcalConectando(false);
    }
  };

  const handleCriarEvento = async () => {
    if (!formData.data_reuniao) {
      toast.error("Defina a data/hora da reunião primeiro");
      return;
    }
    setCriandoEvento(true);
    try {
      const participantes = formData.closer_email ? [{ email: formData.closer_email }] : [];
      const resultado = await criarEventoComMeet({
        titulo: `Reunião VendaFLOW — ${tarefa?.lead_nome || "Lead"}`,
        descricao: `Reunião agendada pelo VendaFLOW`,
        dataHoraInicio: formData.data_reuniao,
        participantes,
      });
      setFormData(prev => ({
        ...prev,
        meet_link: resultado.meetLink || resultado.hangoutLink,
        calendar_event_id: resultado.eventId,
        calendar_event_link: resultado.htmlLink,
      }));
      toast.success("Evento criado com link Meet!");
    } catch (err) {
      toast.error(err.message || "Erro ao criar evento");
    } finally {
      setCriandoEvento(false);
    }
  };

  // Já tem link Meet criado
  if (formData.meet_link) {
    return (
      <div className="p-3 rounded-xl border space-y-2" style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" }}>
        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5" /> Link Meet criado
        </p>
        <div className="flex gap-2 flex-wrap">
          <a href={formData.meet_link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg font-medium">
            <Video className="w-3 h-3" /> Abrir Meet
          </a>
          {formData.calendar_event_link && (
            <a href={formData.calendar_event_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg font-medium">
              <ExternalLink className="w-3 h-3" /> Ver no Calendar
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!isConfigured()) {
    return (
      <div className="p-3 rounded-xl border text-xs text-slate-400" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
        <Calendar className="w-4 h-4 mb-1 text-slate-500" />
        Integração com Google Calendar não configurada — solicite ao administrador.
      </div>
    );
  }

  if (!gcalConectado) {
    return (
      <button type="button" onClick={handleConectar} disabled={gcalConectando}
        className="w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all hover:border-red-500/40"
        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
        {gcalConectando
          ? <RefreshCw className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
          : <Calendar className="w-4 h-4 text-red-400 flex-shrink-0" />}
        <div>
          <p className="text-sm font-medium text-white">Conectar minha conta Google</p>
          <p className="text-xs text-slate-400">Para gerar link do Google Meet automaticamente</p>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={handleCriarEvento} disabled={criandoEvento}
      className="w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all hover:border-red-500/40"
      style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)" }}>
      {criandoEvento
        ? <RefreshCw className="w-4 h-4 text-red-400 animate-spin flex-shrink-0" />
        : <Video className="w-4 h-4 text-red-400 flex-shrink-0" />}
      <div>
        <p className="text-sm font-medium text-white">Criar evento + gerar link Meet</p>
        <p className="text-xs text-slate-400">Cria no Google Calendar e gera link automático</p>
      </div>
    </button>
  );
}

/* ── Sugestões por resultado ─────────────────────────── */
const SUGESTOES = {
  atendeu:           { tipo: "ligacao",  dias: 3, label: "Nova ligação em 3 dias" },
  reuniao_agendada:  { tipo: "ligacao",  dias: 1, label: "Follow-up em 1 dia" },
  contrato_enviado:  { tipo: "whatsapp", dias: 2, label: "Cobrança em 2 dias" },
};

function addDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 16);
}

/* ── Etapa 4 — Próximo Passo ─────────────────────────── */
function Etapa4({ formData, setFormData, closers, cadenciasCloser, currentUser, onSugestaoAceita, tarefa, perfilPorEmailWizard }) {
  const sugestao = SUGESTOES[formData.resultado] || null;
  const sugestaoAceita = sugestao && formData._sugestao_aceita === formData.resultado;

  const aceitarSugestao = () => {
    setFormData(prev => ({
      ...prev,
      agendar_proximo_contato: true,
      agendar_reuniao: false,
      tipo_proximo_contato: sugestao.tipo,
      data_proximo_contato: addDias(sugestao.dias),
      _sugestao_aceita: formData.resultado,
    }));
    onSugestaoAceita?.();
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-white mb-1">Próximo Passo</h3>
        <p className="text-xs text-slate-500">Defina o follow-up ou agende uma reunião</p>
      </div>

      {/* Sugestão automática */}
      {sugestao && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl border flex items-center justify-between gap-3"
          style={{
            background: sugestaoAceita ? "rgba(34,197,94,0.08)" : "rgba(96,165,250,0.08)",
            borderColor: sugestaoAceita ? "rgba(34,197,94,0.30)" : "rgba(96,165,250,0.25)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: sugestaoAceita ? "rgba(34,197,94,0.15)" : "rgba(96,165,250,0.12)" }}>
              <CalendarClock className="w-4 h-4" style={{ color: sugestaoAceita ? "#22c55e" : "#60a5fa" }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color: sugestaoAceita ? "#22c55e" : "#60a5fa" }}>
                Sugestão automática
              </p>
              <p className="text-sm font-bold text-white truncate">{sugestao.label}</p>
            </div>
          </div>
          {sugestaoAceita ? (
            <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">✓ Aceita</span>
          ) : (
            <button
              type="button"
              onClick={aceitarSugestao}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all hover:opacity-80"
              style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.28)" }}
            >
              Aceitar
            </button>
          )}
        </motion.div>
      )}

      {/* Cards de ação */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setFormData(prev => ({
            ...prev,
            agendar_proximo_contato: !prev.agendar_proximo_contato,
            agendar_reuniao: false,
          }))}
          className="p-4 rounded-xl border text-left transition-all"
          style={{
            background: formData.agendar_proximo_contato ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.5)",
            border: `1px solid ${formData.agendar_proximo_contato ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          <CalendarClock className="w-5 h-5 mb-2" style={{ color: formData.agendar_proximo_contato ? "#f59e0b" : "#475569" }} />
          <p className="text-sm font-semibold" style={{ color: formData.agendar_proximo_contato ? "#fbbf24" : "#64748b" }}>
            Agendar Contato
          </p>
          <p className="text-xs mt-0.5" style={{ color: formData.agendar_proximo_contato ? "#d97706" : "#334155" }}>
            Ligação, WhatsApp ou e-mail
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFormData(prev => ({
            ...prev,
            agendar_reuniao: !prev.agendar_reuniao,
            agendar_proximo_contato: false,
          }))}
          className="p-4 rounded-xl border text-left transition-all"
          style={{
            background: formData.agendar_reuniao ? "rgba(139,92,246,0.12)" : "rgba(30,41,59,0.5)",
            border: `1px solid ${formData.agendar_reuniao ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          <Users className="w-5 h-5 mb-2" style={{ color: formData.agendar_reuniao ? "#a78bfa" : "#475569" }} />
          <p className="text-sm font-semibold" style={{ color: formData.agendar_reuniao ? "#a78bfa" : "#64748b" }}>
            Agendar Reunião
          </p>
          <p className="text-xs mt-0.5" style={{ color: formData.agendar_reuniao ? "#7c3aed" : "#334155" }}>
            Transferir para Closer
          </p>
        </button>
      </div>

      {/* Painel próximo contato */}
      <AnimatePresence>
        {formData.agendar_proximo_contato && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Agendar Próximo Contato
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-emerald-300 text-sm mb-2">Data e horário *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_proximo_contato}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_proximo_contato: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white"
                  required={formData.agendar_proximo_contato}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: "2d", dias: 2 },
                    { label: "7d", dias: 7 },
                    { label: "15d", dias: 15 },
                    { label: "30d", dias: 30 },
                    { label: "60d", dias: 60 },
                    { label: "90d", dias: 90 },
                  ].map(({ label, dias }) => {
                    const d = new Date();
                    d.setDate(d.getDate() + dias);
                    d.setHours(9, 0, 0, 0);
                    return (
                      <button
                        key={dias}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, data_proximo_contato: d.toISOString().slice(0, 16) }))}
                        className="px-2.5 py-1 text-xs rounded-lg border border-emerald-600/50 text-emerald-300 hover:bg-emerald-500/15 transition-colors"
                      >
                        +{label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Tipo de contato</Label>
                <Select value={formData.tipo_proximo_contato} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo_proximo_contato: v }))}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-white text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Painel reunião */}
      <AnimatePresence>
        {formData.agendar_reuniao && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-3">
            <p className="text-sm font-semibold text-violet-300 flex items-center gap-2">
              <Users className="w-4 h-4" /> Agendar Reunião + Transferir para Closer
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Data e hora da reunião *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_reuniao}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_reuniao: e.target.value }))}
                  className="bg-slate-800/60 border-slate-700/60 text-white text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Responsável pela Reunião *</Label>
                <Select value={formData.closer_email} onValueChange={(v) => setFormData(prev => ({ ...prev, closer_email: v, cadencia_closer_id: "" }))}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-white text-sm">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {currentUser && (
                      <SelectItem value={currentUser.email}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-sky-400" />
                          <span className="text-sky-300">Eu mesmo ({perfilPorEmailWizard[currentUser.email?.toLowerCase()]?.user_name || currentUser.full_name || currentUser.email})</span>
                        </div>
                      </SelectItem>
                    )}
                    {closers.map((c) => (
                      <SelectItem key={c.email} value={c.email}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {c.full_name} <span className="text-slate-500 text-xs capitalize">({c.papel})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <GoogleMeetSection formData={formData} setFormData={setFormData} tarefa={tarefa} />

            {formData.closer_email && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Cadência do Closer</Label>
                <Select value={formData.cadencia_closer_id} onValueChange={(v) => setFormData(prev => ({ ...prev, cadencia_closer_id: v }))}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/60 text-white text-sm">
                    <SelectValue placeholder="Selecionar cadência (opcional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value={null}>Nenhuma (definir depois)</SelectItem>
                    {cadenciasCloser.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}{c.dias_total ? ` · ${c.dias_total} dias` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cadenciasCloser.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">Nenhuma cadência do tipo "closer" cadastrada.</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sem próximo passo */}
      {!formData.agendar_proximo_contato && !formData.agendar_reuniao && (
        <div className="p-4 rounded-xl border border-dashed text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs text-slate-500">Nenhum próximo passo agendado — o lead ficará sem tarefa futura.</p>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal exportado ─────────────────── */
export default function WizardEtapas({
  formData, setFormData,
  options, statusLeadOptions,
  produtos, closers: closersProp,
  formularios, formularioSelecionado, formularioExpanded, setFormularioExpanded,
  handleRespostaFormulario,
  perfilData, setPerfilData,
  tarefa,
  onSubmit, saving,
  onClose,
  onEtapaChange,
  onSugestaoAceita,
  currentUser,
  etapaAtual, setEtapaAtual,
  etapasCompletas, setEtapasCompletas,
  is3cCall,
  qualificacoes3C = [],
  qualificacoesCarregando = false,
}) {
  const { empresaId } = useEmpresaAtual();

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
  });

  const { data: userProfilesWizard = [] } = useQuery({
    queryKey: ["user-profiles-wizard", empresaId],
    queryFn: () => api.entities.UserProfile.filter({ empresaId }),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });
  const perfilPorEmailWizard = useMemo(() => {
    const mapa = {};
    userProfilesWizard.forEach(p => { if (p.user_email) mapa[p.user_email.toLowerCase()] = p; });
    return mapa;
  }, [userProfilesWizard]);

  const closers = vinculos.filter(v =>
    ["closer", "cs", "gestor", "gestor_empresa", "gerente_empresa", "gerente_filial", "supervisor", "admin", "super_admin"].includes(v.papel)
    && v.userEmail !== currentUser?.email
  ).map(v => ({
    email: v.userEmail,
    full_name: perfilPorEmailWizard[v.userEmail?.toLowerCase()]?.user_name || v.userName?.trim() || v.userEmail.split("@")[0],
    papel: v.papel,
  }));

  const { data: cadenciasCloser = [] } = useQuery({
    queryKey: ["cadencias-closer"],
    queryFn: () => listarCadenciasCloser(),
    enabled: !!empresaId && formData.agendar_reuniao,
  });


  const canAdvance = () => {
    if (etapaAtual === 1) return !!formData.resultado;
    if (etapaAtual === 2) {
      if (formData.status_lead === "sem_interesse" || formData.status_lead === "desqualificado") {
        return !!formData.motivo_desqualificacao;
      }
      return true;
    }
    return true;
  };

  const avancar = () => {
    if (!canAdvance()) return;
    setEtapasCompletas(prev => prev.includes(etapaAtual) ? prev : [...prev, etapaAtual]);
    onEtapaChange?.(etapaAtual);
    setEtapaAtual(prev => Math.min(prev + 1, 4));
  };

  const voltar = () => {
    setEtapaAtual(prev => Math.max(prev - 1, 1));
  };

  const isUltimaEtapa = etapaAtual === 4;

  const canSubmit = () => {
    if (formData.agendar_reuniao) {
      return !!formData.data_reuniao && !!formData.closer_email;
    }
    if (formData.agendar_proximo_contato) {
      return !!formData.data_proximo_contato;
    }
    return true;
  };

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };
  const [dir, setDir] = useState(1);

  const handleAvancar = () => { setDir(1); avancar(); };
  const handleVoltar  = () => { setDir(-1); voltar(); };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Stepper etapaAtual={etapaAtual} etapasCompletas={etapasCompletas} />

      {/* Conteúdo da etapa */}
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[320px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={etapaAtual}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {etapaAtual === 1 && (
              <Etapa1 formData={formData} setFormData={setFormData} options={options} />
            )}
            {etapaAtual === 2 && (
              <Etapa2 formData={formData} setFormData={setFormData} statusLeadOptions={statusLeadOptions} is3cCall={is3cCall} qualificacoesCampanha={qualificacoes3C} qualificacoesCarregando={qualificacoesCarregando} />
            )}
            {etapaAtual === 3 && (
              <Etapa3
                formData={formData} setFormData={setFormData}
                produtos={produtos} formularios={formularios}
                formularioSelecionado={formularioSelecionado}
                formularioExpanded={formularioExpanded}
                setFormularioExpanded={setFormularioExpanded}
                handleRespostaFormulario={handleRespostaFormulario}
                perfilData={perfilData} setPerfilData={setPerfilData}
                tarefa={tarefa}
              />
            )}
            {etapaAtual === 4 && (
              <Etapa4 formData={formData} setFormData={setFormData} closers={closers} cadenciasCloser={cadenciasCloser} currentUser={currentUser} onSugestaoAceita={onSugestaoAceita} tarefa={tarefa} perfilPorEmailWizard={perfilPorEmailWizard} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rodapé de navegação */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-6 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(8,12,24,0.8)" }}>
        <Button
          type="button"
          variant="ghost"
          onClick={etapaAtual === 1 ? onClose : handleVoltar}
          className="text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {etapaAtual === 1 ? "Cancelar" : "Voltar"}
        </Button>

        <div className="flex items-center gap-2">
          {/* Dots de progresso */}
          <div className="flex items-center gap-1.5 mr-2">
            {ETAPAS.map(e => {
              const visitada = etapasCompletas.includes(e.id) || e.id < etapaAtual;
              const clicavel = visitada && e.id !== etapaAtual;
              return (
                <button
                  key={e.id}
                  type="button"
                  title={clicavel ? `Ir para etapa ${e.id}` : undefined}
                  disabled={!clicavel}
                  onClick={clicavel ? () => { setDir(e.id < etapaAtual ? -1 : 1); setEtapaAtual(e.id); } : undefined}
                  className="rounded-full transition-all duration-300 focus:outline-none"
                  style={{
                    width: etapaAtual === e.id ? 16 : 6,
                    height: 6,
                    cursor: clicavel ? "pointer" : "default",
                    background: etapasCompletas.includes(e.id) ? "#22c55e" : etapaAtual === e.id ? "#60a5fa" : "rgba(255,255,255,0.12)",
                  }}
                />
              );
            })}
          </div>

          {isUltimaEtapa ? (
            <Button
              type="button"
              disabled={saving || !canSubmit()}
              onClick={onSubmit}
              className="px-8 font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-blue-600/30 gap-2"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Registrar Ligação
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canAdvance()}
              onClick={handleAvancar}
              className={cn(
                "font-semibold gap-2 transition-all",
                canAdvance()
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}