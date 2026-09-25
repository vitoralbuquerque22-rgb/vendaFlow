import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { atualizarLead } from "@/lib/services/leadService";
import { api } from "@/api/client";
import { listarTarefas, criarTarefa, criarTarefasDaCadencia, atualizarTarefa, buscarTarefasPendentesDoLead, encerrarTarefasAutomaticamente } from "@/lib/services/tarefaService";
import { listarAtividades } from "@/lib/services/atividadeService";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { listarProdutos } from "@/lib/services/produtoService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, Trophy, XCircle, FileText,
  TrendingUp, ExternalLink, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatarTelefone } from "@/lib/formatarTelefone";

const ESTAGIOS = [
  {
    key: "reuniao_agendada",
    label: "🟤 Reunião Confirmada",
    cor: "stone",
    bordaClass: "border-stone-500/30 bg-stone-500/5",
    headerClass: "text-stone-300",
    badgeClass: "bg-stone-500/20 border-stone-500/40 text-stone-300",
    descricao: "Reunião agendada, aguardando realização",
  },
  {
    key: "reuniao_realizada",
    label: "🟠 Reunião Realizada",
    cor: "orange",
    bordaClass: "border-orange-500/30 bg-orange-500/5",
    headerClass: "text-orange-300",
    badgeClass: "bg-orange-500/20 border-orange-500/40 text-orange-300",
    descricao: "Diagnóstico feito, aguardando proposta",
  },
  {
    key: "proposta_enviada",
    label: "🟧 Proposta Enviada",
    cor: "amber",
    bordaClass: "border-amber-500/30 bg-amber-500/5",
    headerClass: "text-amber-300",
    badgeClass: "bg-amber-500/20 border-amber-500/40 text-amber-300",
    descricao: "Proposta enviada, aguardando decisão",
  },
  {
    key: "em_negociacao",
    label: "🟨 Em Negociação",
    cor: "yellow",
    bordaClass: "border-yellow-500/30 bg-yellow-500/5",
    headerClass: "text-yellow-300",
    badgeClass: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
    descricao: "Objeções em tratamento",
  },
];

const MOTIVOS_PERDA = [
  { value: "preco", label: "Preço" },
  { value: "sem_momento", label: "Sem momento" },
  { value: "sem_orcamento", label: "Sem orçamento" },
  { value: "sem_prioridade", label: "Sem prioridade" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "sem_fit", label: "Sem fit" },
  { value: "nao_respondeu", label: "Não respondeu" },
  { value: "outro", label: "Outro" },
];

const FORMAS_PAGAMENTO = [
  { value: "avista", label: "À vista" },
  { value: "boleto", label: "Boleto parcelado" },
  { value: "cartao_parcelado", label: "Cartão parcelado" },
  { value: "cartao_avista", label: "Cartão à vista" },
  { value: "pix", label: "PIX" },
  { value: "recorrente", label: "Recorrente / Assinatura" },
  { value: "transferencia", label: "Transferência" },
];

const NURTURING_DIAS = {
  preco: 30,
  sem_momento: 90,
  sem_orcamento: 60,
  concorrencia: 90,
  sem_prioridade: 60,
};

// ─── Input moeda BRL ──────────────────────────────────────────────────────────
function InputMoeda({ value, onChange, placeholder = "0,00", className = "" }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) / 100 : 0;
    onChange(num);
  };
  const display = value ? Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn("w-full pl-9 pr-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500", className)}
      />
    </div>
  );
}

// ─── Seção de seletor de cadência reutilizável ───────────────────────────────
function SecaoCadencia({ cadencias, cadenciaSelecionada, setCadenciaSelecionada, modoPerda = false, sdrDestino, setSdrDestino, colaboradores = [], currentUser }) {
  // Filtra cadências de acordo com o tipo de responsável selecionado
  // Se o destinatário for o closer atual (eu mesmo), mostra todas; se for SDR, mostra só tipo "sdr"
  const isEuMesmo = sdrDestino && sdrDestino === currentUser?.email;
  const cadenciasFiltradas = cadencias.filter(c => {
    if (!setSdrDestino) return true; // sem filtro quando não há selector de destino
    if (isEuMesmo) return true; // closer pode usar qualquer cadência
    return c.tipo_cadencia !== "closer"; // SDR só vê cadências SDR
  });

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
        🔄 Próximos passos com esse lead
      </p>

      {/* Primeiro: quem vai receber as tarefas */}
      {setSdrDestino && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Atribuir tarefas para:</p>
          <select
            value={sdrDestino || ""}
            onChange={e => { setSdrDestino(e.target.value); setCadenciaSelecionada(""); }}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Selecionar responsável</option>
            {currentUser && (
              <option value={currentUser.email}>👤 Eu mesmo ({colaboradores.find(c => c.email === currentUser?.email)?.nome || currentUser?.full_name || currentUser?.email})</option>
            )}
            {colaboradores.filter(c => c.email !== currentUser?.email).map(c => (
              <option key={c.email} value={c.email}>{c.nome || c.email}</option>
            ))}
          </select>
        </div>
      )}

      {/* Segundo: qual cadência */}
      {(!setSdrDestino || sdrDestino) && (
        <select
          value={cadenciaSelecionada || ""}
          onChange={e => setCadenciaSelecionada(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="">Selecionar cadência (opcional)</option>
          {modoPerda && <option value="__desqualificar__">🚫 Desqualificar lead (sem próximo contato)</option>}
          <option value="__nenhuma__">Sem cadência — apenas arquivar</option>
          {cadenciasFiltradas.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      )}

      {cadenciaSelecionada === "__desqualificar__" && (
        <p className="text-xs text-rose-400">Lead será desqualificado sem agendamento de retorno.</p>
      )}
      {cadenciaSelecionada && !["__nenhuma__", "__desqualificar__", ""].includes(cadenciaSelecionada) && (
        <p className="text-xs text-slate-400">As tarefas da cadência serão criadas automaticamente ao confirmar.</p>
      )}
    </div>
  );
}

// ─── Diagnóstico da Reunião (sub-componente para evitar hook-in-callback) ─────
function DiagnosticoReuniao({ dados, set }) {
  const [diagAvancado, setDiagAvancado] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider">Diagnóstico da Reunião</p>
      <div>
        <Label className="text-slate-300 text-sm mb-1">Problema identificado *</Label>
        <Textarea value={dados.problema} onChange={e => set("problema", e.target.value)}
          className="bg-slate-800 border-slate-700 text-white min-h-[70px] text-sm"
          placeholder="Qual a dor principal do lead?" />
      </div>
      <div>
        <Label className="text-slate-300 text-sm mb-1">Impacto</Label>
        <Textarea value={dados.impacto} onChange={e => set("impacto", e.target.value)}
          className="bg-slate-800 border-slate-700 text-white min-h-[60px] text-sm"
          placeholder="Qual o impacto do problema no negócio dele?" />
      </div>
      <div>
        <Label className="text-slate-300 text-sm mb-1">Solução apresentada</Label>
        <Textarea value={dados.solucao} onChange={e => set("solucao", e.target.value)}
          className="bg-slate-800 border-slate-700 text-white min-h-[60px] text-sm"
          placeholder="O que você apresentou como solução?" />
      </div>
      <div>
        <Label className="text-slate-300 text-sm mb-1">O que ficou combinado?</Label>
        <Textarea value={dados.combinado} onChange={e => set("combinado", e.target.value)}
          className="bg-slate-800 border-slate-700 text-white min-h-[60px] text-sm"
          placeholder="Data de retorno prometida, decisor envolvido, o que foi acordado..." />
      </div>
      <button type="button" onClick={() => setDiagAvancado(v => !v)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
        <span>{diagAvancado ? "▼" : "▶"}</span>
        <span>Diagnóstico Avançado</span>
      </button>
      {diagAvancado && (
        <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3 space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-2">Temperatura do lead</p>
            <div className="flex gap-2">
              {[
                { value: "quente", label: "🔥 Quente", active: "bg-red-500/20 border-red-500/50 text-red-300" },
                { value: "morno",  label: "🌡️ Morno",  active: "bg-amber-500/20 border-amber-500/50 text-amber-300" },
                { value: "frio",   label: "❄️ Frio",   active: "bg-sky-500/20 border-sky-500/50 text-sky-300" },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => set("temperatura_lead", opt.value)}
                  className={cn("flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    dados.temperatura_lead === opt.value ? opt.active : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400">Probabilidade de fechamento</p>
              <span className={cn("text-sm font-bold",
                dados.probabilidade >= 70 ? "text-emerald-400" : dados.probabilidade >= 40 ? "text-amber-400" : "text-rose-400"
              )}>{dados.probabilidade}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={dados.probabilidade}
              onChange={e => set("probabilidade", Number(e.target.value))} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de ação enriquecido ────────────────────────────────────────────────
function ModalAcao({ lead, acao, onClose, onConfirmar, cadencias, currentUser }) {
  const [algoMudou, setAlgoMudou] = useState(false);
  const [dados, setDados] = useState({
    check_perfil_oficina: lead.check_perfil_oficina || false,
    check_marketing: lead.check_marketing || false,
    check_financeiro: lead.check_financeiro || false,
    check_equipe: lead.check_equipe || false,
    check_principal_dor: lead.check_principal_dor || false,
    check_historico: lead.check_historico || false,
    notas_preparacao: lead.notas_preparacao || "",
    problema: lead.problema_identificado || "",
    impacto: lead.impacto_identificado || "",
    solucao: lead.solucao_apresentada || "",
    plano: lead.plano_acao || "",
    produto: lead.produto_nome || "",
    produto_id: lead.produto_id || "",
    tipo_promessa: lead.tipo_promessa || "",
    data_promessa_pagamento: lead.data_promessa_pagamento || "",
    valor_proposta: lead.valor_proposta || "",
    forma_pagamento: lead.forma_pagamento || "",
    prazo_proposta: lead.prazo_proposta || "",
    objecoes: lead.objecoes || "",
    proximo_contato: lead.proximo_contato || "",
    probabilidade: lead.probabilidade_fechamento || 50,
    motivo_perda: "",
    observacao: "",
    valor_original: "",
    desconto_pct: "",
    teve_desconto: false,
    parcelas: "",
    valor_entrada: "",
    valor_kify: "",
    cadencia_id: "",
    combinado: "",
    temperatura_lead: "",
  });


  const titulo = {
    preparar_reuniao: "🟤 Preparar Reunião — Checklist",
    marcar_realizada: "🟠 Reunião Realizada — Diagnóstico",
    enviar_proposta: "🟧 Registrar Proposta Enviada",
    em_negociacao: "🟨 Mover para Negociação",
    venda_ganha: "🏆 Registrar Venda Ganha",
    venda_perdida: "🔴 Registrar Venda Perdida",
  }[acao] || acao;

  const set = (key, val) => setDados(d => ({ ...d, [key]: val }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Pré-seleciona SDR do lead; se não tiver, não pré-seleciona (closer deve escolher)
  const [sdrDestino, setSdrDestino] = useState(lead.sdr_responsavel || "");
  const { empresaId: empresaIdModal } = useEmpresaAtual();
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-modal", empresaIdModal],
    queryFn: () => listarProdutos(empresaIdModal),
    enabled: !!empresaIdModal,
  });
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-modal", empresaIdModal],
    queryFn: async () => {
      if (!empresaIdModal) return [];
      const res = await api.functions.invoke('buscarColaboradoresEmpresa', { empresaId: empresaIdModal });
      return res?.data?.colaboradores || [];
    },
    enabled: !!empresaIdModal && acao === "venda_perdida",
  });

  const validar = () => {
    if (acao === "venda_perdida") {
      if (!dados.motivo_perda) { toast.error("Selecione o motivo da perda"); return false; }
      if (!dados.observacao.trim()) { toast.error("Observações é obrigatório"); return false; }
    }
    if (acao === "venda_ganha") {
      if (!dados.observacao.trim()) { toast.error("Observações é obrigatório"); return false; }
    }
    if (acao === "enviar_proposta") {
      if (!dados.valor_proposta) { toast.error("Informe o valor da proposta"); return false; }
      if (!dados.tipo_promessa) { toast.error("Selecione a intenção do lead"); return false; }
      if (!dados.data_promessa_pagamento) { toast.error("Informe a data de promessa de pagamento — sem ela a proposta não entra no funil"); return false; }
    }
    return true;
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "linear-gradient(135deg, #0a0e1a, #0c1628)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{titulo}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="rounded-xl bg-slate-800/60 px-4 py-3">
          <p className="text-xs text-slate-500 mb-0.5">Lead</p>
          <p className="text-sm font-semibold text-white">{lead.nome || "—"}</p>
          {lead.empresa && <p className="text-xs text-slate-400">{lead.empresa}</p>}
        </div>

        {/* ── PREPARAR REUNIÃO ── */}
        {acao === "preparar_reuniao" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-stone-300 uppercase tracking-wider">Checklist de Preparação</p>
            <p className="text-xs text-slate-400">Revise os dados antes da reunião e marque o que já foi analisado.</p>
            {[
              { key: "check_perfil_oficina", label: "Perfil da Oficina", desc: "Porte, localização, especialidade" },
              { key: "check_marketing", label: "Marketing", desc: "Presença digital, redes sociais, tráfego" },
              { key: "check_financeiro", label: "Financeiro", desc: "Faturamento estimado, ticket médio" },
              { key: "check_equipe", label: "Equipe", desc: "Qtd técnicos, vendedores, administrativo" },
              { key: "check_principal_dor", label: "Principal Dor", desc: "Problema/necessidade mais urgente" },
              { key: "check_historico", label: "Histórico", desc: "Interações anteriores, tentativas" },
            ].map(item => (
              <label key={item.key} className={cn(
                "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all",
                dados[item.key] ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600"
              )}>
                <input type="checkbox" checked={dados[item.key]} onChange={e => set(item.key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30" />
                <div>
                  <p className={cn("text-sm font-medium", dados[item.key] ? "text-emerald-300" : "text-white")}>{item.label}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
                {dados[item.key] && <span className="ml-auto text-emerald-400 text-sm">✓</span>}
              </label>
            ))}
            <div>
              <Label className="text-slate-300 text-sm mb-1">Notas de preparação</Label>
              <Textarea value={dados.notas_preparacao} onChange={e => set("notas_preparacao", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[70px] text-sm"
                placeholder="Anotações, pontos-chave para abordar na reunião..." />
            </div>
          </div>
        )}

        {/* ── REUNIÃO REALIZADA ── */}
        {acao === "marcar_realizada" && (
          <DiagnosticoReuniao dados={dados} set={set} />
        )}

        {/* ── PROPOSTA ENVIADA ── */}
        {acao === "enviar_proposta" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Detalhes da Proposta</p>

            <div>
              <Label className="text-slate-300 text-sm mb-1">Produto / Serviço *</Label>
              {produtos.length > 0 ? (
                <select
                  value={dados.produto_id || ""}
                  onChange={e => {
                    const prod = produtos.find(p => p.id === e.target.value);
                    set("produto_id", e.target.value);
                    set("produto", prod?.nome || "");
                    if (prod?.valor) set("valor_proposta", prod.valor);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Selecionar produto</option>
                  {produtos.filter(p => p.ativo !== false).map(p => (
                    <option key={p.id} value={p.id}>{p.nome}{p.valor ? ` — R$ ${Number(p.valor).toLocaleString("pt-BR")}` : ""}</option>
                  ))}
                </select>
              ) : (
                <Input value={dados.produto} onChange={e => set("produto", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-sm"
                  placeholder="Nome do produto ou serviço" />
              )}
            </div>

            <div>
              <Label className="text-slate-300 text-sm mb-1">Valor da proposta (R$) *</Label>
              <InputMoeda value={dados.valor_proposta} onChange={v => set("valor_proposta", v)} />
            </div>

            <div>
              <Label className="text-slate-300 text-sm mb-1">Forma de pagamento</Label>
              <select
                value={dados.forma_pagamento}
                onChange={e => set("forma_pagamento", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Selecionar</option>
                {FORMAS_PAGAMENTO.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Campos condicionais por forma de pagamento */}
            {(dados.forma_pagamento === "boleto" || dados.forma_pagamento === "cartao_parcelado") && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-sky-300">Detalhes do parcelamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400 text-xs mb-1">Valor de entrada (R$)</Label>
                    <InputMoeda value={dados.valor_entrada} onChange={v => set("valor_entrada", v)} />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1">Nº de parcelas</Label>
                    <input
                      type="number" min={1} max={60}
                      value={dados.parcelas || ""}
                      onChange={e => set("parcelas", e.target.value)}
                      placeholder="12"
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
                {dados.parcelas && dados.valor_proposta && (
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800/60">
                    <span className="text-xs text-slate-400">Valor por parcela:</span>
                    <span className="text-sm font-bold text-sky-300">
                      R$ {((Number(dados.valor_proposta) - (Number(dados.valor_entrada) || 0)) / Number(dados.parcelas)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {dados.forma_pagamento === "avista" && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-emerald-300">Pagamento à vista</p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dados.teve_desconto || false}
                      onChange={e => {
                        set("teve_desconto", e.target.checked);
                        if (!e.target.checked) {
                          set("desconto_pct", "");
                          set("valor_original", "");
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-300">Teve desconto?</span>
                  </label>
                </div>
                {dados.teve_desconto && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-400 text-xs mb-1">Desconto (%)</Label>
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={dados.desconto_pct || ""}
                        onChange={e => set("desconto_pct", e.target.value)}
                        placeholder="10"
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs mb-1">Valor original (R$)</Label>
                      <InputMoeda value={dados.valor_original} onChange={v => set("valor_original", v)} />
                    </div>
                  </div>
                )}
                {dados.teve_desconto && dados.desconto_pct && dados.valor_original && (
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800/60">
                    <span className="text-xs text-slate-400">Valor com desconto:</span>
                    <span className="text-sm font-bold text-emerald-300">
                      R$ {(Number(dados.valor_original) * (1 - Number(dados.desconto_pct) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(dados.forma_pagamento === "pix" || dados.forma_pagamento === "cartao_avista" || dados.forma_pagamento === "transferencia") && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
                <p className="text-xs text-slate-500">Pagamento integral — sem parcelamento</p>
              </div>
            )}

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-300">Intenção do lead *</p>
              <p className="text-xs text-slate-400">Obrigatório — define em qual funil de valores a proposta entra.</p>
              <select
                value={dados.tipo_promessa || ""}
                onChange={e => set("tipo_promessa", e.target.value)}
                className={cn(
                  "w-full bg-slate-800 border text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500",
                  !dados.tipo_promessa ? "border-rose-500/40" : "border-slate-700"
                )}
              >
                <option value="">Selecionar intenção</option>
                <option value="confirmado">✅ Pagamento confirmado para o dia</option>
                <option value="pensando">🤔 Ficou de pensar até o dia</option>
              </select>
              {dados.tipo_promessa && (
                <div>
                  <Label className="text-slate-400 text-xs mb-1">
                    {dados.tipo_promessa === "confirmado" ? "Data de pagamento confirmada *" : "Data limite para decisão *"}
                  </Label>
                  <Input type="date" value={dados.data_promessa_pagamento || ""}
                    onChange={e => set("data_promessa_pagamento", e.target.value)}
                    className={cn("bg-slate-800 text-white text-sm", !dados.data_promessa_pagamento ? "border-rose-500/40" : "border-slate-700")} />
                </div>
              )}
            </div>

            <SecaoCadencia
              cadencias={cadencias}
              cadenciaSelecionada={dados.cadencia_id}
              setCadenciaSelecionada={v => set("cadencia_id", v)}
            />

            {/* Resumo da proposta */}
            {dados.produto && dados.valor_proposta && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Resumo da Proposta</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-500">Produto:</span>
                  <span className="text-white font-medium">{dados.produto}</span>
                  <span className="text-slate-500">Valor:</span>
                  <span className="text-emerald-300 font-bold">R$ {Number(dados.valor_proposta).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  {dados.forma_pagamento && (
                    <>
                      <span className="text-slate-500">Pagamento:</span>
                      <span className="text-white">{dados.forma_pagamento === "avista" ? "À vista" : dados.forma_pagamento === "boleto" ? "Boleto parcelado" : dados.forma_pagamento === "cartao_parcelado" ? "Cartão parcelado" : dados.forma_pagamento === "pix" ? "PIX" : dados.forma_pagamento === "recorrente" ? "Recorrente" : dados.forma_pagamento}</span>
                    </>
                  )}
                  {dados.parcelas && (
                    <>
                      <span className="text-slate-500">Parcelas:</span>
                      <span className="text-white">{dados.parcelas}x de R$ {((Number(dados.valor_proposta) - (Number(dados.valor_entrada) || 0)) / Number(dados.parcelas)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </>
                  )}
                  {dados.valor_entrada > 0 && (
                    <>
                      <span className="text-slate-500">Entrada:</span>
                      <span className="text-white">R$ {Number(dados.valor_entrada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </>
                  )}
                  {dados.desconto_pct > 0 && (
                    <>
                      <span className="text-slate-500">Desconto:</span>
                      <span className="text-white">{dados.desconto_pct}%</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label className="text-slate-300 text-sm mb-1">Observações</Label>
              <Textarea value={dados.observacao} onChange={e => set("observacao", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[60px] text-sm"
                placeholder="Condições especiais, descontos..." />
            </div>
          </div>
        )}

        {/* ── NEGOCIAÇÃO ── */}
        {acao === "em_negociacao" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-yellow-300 uppercase tracking-wider">Registrar Negociação</p>
            <div>
              <Label className="text-slate-300 text-sm mb-1">Objeções levantadas</Label>
              <Textarea value={dados.objecoes} onChange={e => set("objecoes", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[80px] text-sm"
                placeholder="Quais objeções o lead apresentou?" />
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1">Próximo contato</Label>
              <Input type="datetime-local" value={dados.proximo_contato} onChange={e => set("proximo_contato", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm" />
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1">Probabilidade de Fechamento ({dados.probabilidade}%)</Label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} step={5} value={dados.probabilidade}
                  onChange={e => set("probabilidade", Number(e.target.value))} className="flex-1" />
                <span className={cn("text-sm font-bold w-10 text-right",
                  dados.probabilidade >= 70 ? "text-emerald-400" : dados.probabilidade >= 40 ? "text-amber-400" : "text-rose-400"
                )}>{dados.probabilidade}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── VENDA GANHA ── */}
        {acao === "venda_ganha" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">🏆 Confirmar Venda</p>

            {/* Resumo da proposta existente (somente leitura) */}
            {lead.produto_nome && (
              <div className="rounded-xl bg-slate-800/60 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-300">Produto contratado</p>
                <p className="text-sm font-bold text-white uppercase">{lead.produto_nome}</p>
              </div>
            )}
            <div className="rounded-xl bg-slate-800/60 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-300">Proposta atual</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Valor:</span> <span className="text-white font-semibold">R$ {Number(lead.valor_proposta || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-slate-500">Pagamento:</span> <span className="text-white">{FORMAS_PAGAMENTO.find(f => f.value === lead.forma_pagamento)?.label || "—"}</span></div>
                {lead.parcelas && <div><span className="text-slate-500">Parcelas:</span> <span className="text-white">{lead.parcelas}x</span></div>}
                {lead.valor_entrada && <div><span className="text-slate-500">Entrada:</span> <span className="text-white">R$ {Number(lead.valor_entrada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>}
                {lead.valor_kify && <div><span className="text-slate-500">Valor Kify:</span> <span className="text-white">R$ {Number(lead.valor_kify).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>}
                {lead.desconto_pct && <div><span className="text-slate-500">Desconto:</span> <span className="text-white">{lead.desconto_pct}%</span></div>}
                {lead.valor_original && <div><span className="text-slate-500">Valor original:</span> <span className="text-white">R$ {Number(lead.valor_original).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>}
                {lead.tipo_promessa && <div><span className="text-slate-500">Intenção:</span> <span className="text-white">{lead.tipo_promessa === "confirmado" ? "✅ Confirmado" : "🤔 Pensando"}</span></div>}
                {lead.data_promessa_pagamento && <div><span className="text-slate-500">Data pag.:</span> <span className="text-white">{lead.data_promessa_pagamento}</span></div>}
              </div>
            </div>

            {/* Checkbox algo mudou */}
            <label className="flex items-center gap-2 cursor-pointer py-1">
              <input type="checkbox" checked={algoMudou} onChange={e => setAlgoMudou(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30" />
              <span className="text-sm text-amber-300 font-medium">Algo mudou na proposta?</span>
            </label>

            {/* Campos editáveis — só se algo mudou */}
            {algoMudou && (
              <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div>
                  <Label className="text-slate-300 text-sm mb-1">Valor fechado (R$)</Label>
                  <InputMoeda value={dados.valor_proposta} onChange={v => set("valor_proposta", v)} />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm mb-1">Forma de pagamento</Label>
                  <select value={dados.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="">Selecionar</option>
                    {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                {dados.forma_pagamento === "avista" && (
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-sky-300">Detalhes — Pagamento à vista</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-slate-400 text-xs mb-1">Valor original (R$)</Label>
                        <InputMoeda value={dados.valor_original} onChange={v => set("valor_original", v)} />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-1">Desconto aplicado (%)</Label>
                        <input type="number" min={0} max={100} step={0.5} value={dados.desconto_pct || ""} onChange={e => set("desconto_pct", e.target.value)} placeholder="0"
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      </div>
                    </div>
                  </div>
                )}
                {dados.forma_pagamento === "boleto" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-amber-300">Detalhes — Boleto parcelado</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-slate-400 text-xs mb-1">Valor de entrada (R$)</Label>
                        <InputMoeda value={dados.valor_entrada} onChange={v => set("valor_entrada", v)} />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-1">Nº de parcelas</Label>
                        <input type="number" min={1} max={60} value={dados.parcelas || ""} onChange={e => set("parcelas", e.target.value)} placeholder="12"
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      </div>
                    </div>
                    {dados.parcelas && dados.valor_proposta && (
                      <p className="text-xs text-amber-300">Parcela: R$ {((dados.valor_proposta - (dados.valor_entrada || 0)) / dados.parcelas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                )}
                {dados.forma_pagamento === "cartao_parcelado" && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-violet-300">Detalhes — Cartão parcelado (Kify)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-slate-400 text-xs mb-1">Valor simulado no Kify (R$)</Label>
                        <InputMoeda value={dados.valor_kify} onChange={v => set("valor_kify", v)} />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-1">Nº de parcelas</Label>
                        <input type="number" min={1} max={60} value={dados.parcelas || ""} onChange={e => set("parcelas", e.target.value)} placeholder="12"
                          className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-slate-300 text-sm mb-1">Observações *</Label>
              <Textarea value={dados.observacao} onChange={e => set("observacao", e.target.value)}
                className={cn("bg-slate-800 border-slate-700 text-white min-h-[70px] text-sm", !dados.observacao.trim() && "border-rose-500/40")}
                placeholder="Detalhes do fechamento, condições especiais..." />
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-emerald-300">Ações automáticas ao confirmar:</p>
              <p className="text-xs text-slate-400">✅ Lead movido para "Cliente"</p>
              <p className="text-xs text-slate-400">✅ Status atualizado para Fechado</p>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-blue-300">📋 Próximos passos com esse lead</p>
              <p className="text-xs text-slate-400">Ao confirmar, será criada automaticamente uma tarefa de <strong className="text-white">Primeiro Acesso</strong> para agendar reunião de onboarding no sistema SPO com o cliente.</p>
            </div>

            <SecaoCadencia cadencias={cadencias} cadenciaSelecionada={dados.cadencia_id} setCadenciaSelecionada={v => set("cadencia_id", v)} />
          </div>
        )}

        {/* ── VENDA PERDIDA ── */}
        {acao === "venda_perdida" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Registrar Perda</p>

            <div>
              <Label className="text-slate-300 text-sm mb-1.5">Motivo da Perda *</Label>
              <select
                value={dados.motivo_perda}
                onChange={e => set("motivo_perda", e.target.value)}
                className={cn(
                  "w-full bg-slate-800 border text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-500",
                  !dados.motivo_perda ? "border-rose-500/40" : "border-slate-700"
                )}
              >
                <option value="">Selecione o motivo</option>
                {MOTIVOS_PERDA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {dados.motivo_perda && NURTURING_DIAS[dados.motivo_perda] && !dados.cadencia_id && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚡ Retorno automático em {NURTURING_DIAS[dados.motivo_perda]} dias será agendado
                </p>
              )}
            </div>

            <div>
              <Label className="text-slate-300 text-sm mb-1">Observações *</Label>
              <Textarea value={dados.observacao} onChange={e => set("observacao", e.target.value)}
                className={cn("bg-slate-800 border-slate-700 text-white min-h-[80px] text-sm", !dados.observacao.trim() && "border-rose-500/40")}
                placeholder="O que impediu o fechamento? Descreva a situação do lead..." />
            </div>

            <SecaoCadencia cadencias={cadencias} cadenciaSelecionada={dados.cadencia_id} setCadenciaSelecionada={v => set("cadencia_id", v)} modoPerda
              sdrDestino={sdrDestino} setSdrDestino={setSdrDestino} colaboradores={colaboradores} currentUser={currentUser} />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">
            Cancelar
          </button>
          <button
            disabled={isSubmitting}
            onClick={async () => {
              if (!validar() || isSubmitting) return;
              if (acao === "venda_perdida" && dados.cadencia_id && !["__nenhuma__","__desqualificar__",""].includes(dados.cadencia_id) && !sdrDestino) {
                toast.error("Selecione o SDR que receberá as tarefas"); return;
              }
              setIsSubmitting(true);
              try { await onConfirmar({ ...dados, sdr_destino: sdrDestino, algoMudou }); } finally { setIsSubmitting(false); }
            }}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              acao === "venda_ganha"      && "bg-emerald-600 hover:bg-emerald-500 text-white",
              acao === "venda_perdida"    && "bg-rose-600 hover:bg-rose-500 text-white",
              acao === "marcar_realizada" && "bg-orange-600 hover:bg-orange-500 text-white",
              acao === "preparar_reuniao" && "bg-stone-600 hover:bg-stone-500 text-white",
              !["venda_ganha","venda_perdida","marcar_realizada","preparar_reuniao"].includes(acao) && "bg-violet-600 hover:bg-violet-500 text-white",
            )}
          >{isSubmitting ? "Confirmando..." : acao === "preparar_reuniao" ? "Salvar Preparação" : "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Não Compareceu ─────────────────────────────────────────────────────
function ModalNaoCompareceu({ lead, onClose, onConfirmar, cadencias, currentUser }) {
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [acao, setAcao] = useState("reabrir_cadencia");
  const [cadenciaId, setCadenciaId] = useState("");
  const [sdrSelecionado, setSdrSelecionado] = useState(lead.sdr_responsavel || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { empresaId: empresaIdModal } = useEmpresaAtual();
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-nonshow", empresaIdModal],
    queryFn: async () => {
      if (!empresaIdModal) return [];
      const res = await api.functions.invoke('buscarColaboradoresEmpresa', { empresaId: empresaIdModal });
      return res?.data?.colaboradores || [];
    },
    enabled: !!empresaIdModal && acao === "devolver_sdr" && !lead.sdr_responsavel,
  });

  const cadenciasSdr = cadencias.filter(c => c.tipo_cadencia !== "closer");
  const leadTemSdr = !!lead.sdr_responsavel;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "linear-gradient(135deg, #0a0e1a, #0c1628)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">⚠️ Não Compareceu</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="rounded-xl bg-slate-800/60 px-4 py-3">
          <p className="text-xs text-slate-500 mb-0.5">Lead</p>
          <p className="text-sm font-semibold text-white">{lead.nome || "—"}</p>
          {lead.empresa && <p className="text-xs text-slate-400">{lead.empresa}</p>}
        </div>

        <div>
          <Label className="text-slate-300 text-sm mb-1">Motivo</Label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Selecionar motivo</option>
            <option value="esqueceu">Esqueceu / não lembrava</option>
            <option value="remarcou">Remarcou</option>
            <option value="sem_resposta">Sem resposta</option>
            <option value="desistiu">Desistiu</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <Label className="text-slate-300 text-sm mb-1">Observação (opcional)</Label>
          <Textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white min-h-[60px] text-sm"
            placeholder="Detalhes adicionais..."
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-300">Ação</p>
          {[
            { value: "reabrir_cadencia", label: "🔄 Reabrir cadência de follow-up" },
            { value: "devolver_sdr",     label: "↩️ Devolver ao SDR" },
            { value: "desqualificar",    label: "🚫 Desqualificar lead" },
          ].map(opt => (
            <label key={opt.value} className={cn(
              "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all",
              acao === opt.value ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600"
            )}>
              <input type="radio" name="acao_nao_comp" value={opt.value} checked={acao === opt.value} onChange={() => setAcao(opt.value)}
                className="w-4 h-4 text-amber-500" />
              <span className={cn("text-sm font-medium", acao === opt.value ? "text-amber-300" : "text-slate-300")}>{opt.label}</span>
            </label>
          ))}
        </div>

        {acao === "reabrir_cadencia" && (
          <div>
            <Label className="text-slate-300 text-sm mb-1">Cadência de follow-up</Label>
            <select
              value={cadenciaId}
              onChange={e => setCadenciaId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Selecionar cadência (opcional)</option>
              {cadenciasSdr.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        {acao === "devolver_sdr" && !leadTemSdr && (
          <div>
            <Label className="text-slate-300 text-sm mb-1">Selecionar SDR destino *</Label>
            <select
              value={sdrSelecionado}
              onChange={e => setSdrSelecionado(e.target.value)}
              className={cn(
                "w-full bg-slate-800 border text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500",
                !sdrSelecionado ? "border-rose-500/40" : "border-slate-700"
              )}
            >
              <option value="">Selecionar SDR</option>
              {colaboradores.map(c => (
                <option key={c.email} value={c.email}>{c.nome || c.email}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Este lead não tem SDR atribuído. Selecione quem deve recebê-lo.</p>
          </div>
        )}

        {acao === "devolver_sdr" && leadTemSdr && (
          <div className="rounded-xl bg-slate-800/60 px-3 py-2">
            <p className="text-xs text-slate-500">SDR que receberá o lead</p>
            <p className="text-sm text-white font-medium">{lead.sdr_responsavel}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">
            Cancelar
          </button>
          <button
            disabled={isSubmitting}
            onClick={async () => {
              if (!motivo) { toast.error("Selecione o motivo"); return; }
              if (acao === "devolver_sdr" && !sdrSelecionado) {
                toast.error("Selecione um SDR para devolver o lead"); return;
              }
              setIsSubmitting(true);
              try { await onConfirmar({ motivo, observacao, acao, cadencia_id: cadenciaId, sdr_destino: sdrSelecionado }); }
              finally { setIsSubmitting(false); }
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card do lead ─────────────────────────────────────────────────────────────
function LeadCard({ lead, tarefa, atividades, onAcao }) {
  const [verProposta, setVerProposta] = useState(false);
  const briefing = tarefa?.observacao || "";
  const linkMeet = briefing.match(/https:\/\/meet\.google\.com\/[^\s]+/)?.[0];
  const agendadoPor = tarefa?.agendado_por_nome || tarefa?.agendado_por_email?.split("@")[0];
  const atvsLead = atividades.filter(a => a.lead_id === lead.id)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const ultimaAtv = atvsLead[0];

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{lead.nome || "—"}</p>
            {lead.empresa && <p className="text-xs text-slate-400 truncate">{lead.empresa}</p>}
            {lead.telefone && <p className="text-xs text-slate-500 truncate">📞 {formatarTelefone(lead.telefone)}</p>}
          </div>
          {lead.probabilidade_fechamento != null && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 flex-shrink-0">
              {lead.probabilidade_fechamento}%
            </span>
          )}
        </div>

        {(agendadoPor || linkMeet || tarefa?.data_prevista) && (
          <div className="rounded-lg bg-slate-700/40 border border-slate-600/40 px-3 py-2 mb-2 space-y-1">
            {agendadoPor && <p className="text-xs text-slate-400"><span className="text-slate-500">Via:</span> {agendadoPor}</p>}
            {tarefa?.data_prevista && (
              <p className="text-xs text-sky-300">
                📅 {format(new Date(tarefa.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}
                {tarefa?.created_date && (
                  <span className="text-slate-400"> às {format(new Date(tarefa.created_date), "HH:mm", { locale: ptBR })}</span>
                )}
                {isToday(new Date(tarefa.data_prevista + "T12:00:00")) && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300">Hoje</span>
                )}
              </p>
            )}
            {linkMeet && (
              <a href={linkMeet} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                <ExternalLink className="w-3 h-3" /> Abrir Meet
              </a>
            )}
          </div>
        )}

        {lead.status === "reuniao_agendada" && (() => {
          const checks = ["check_perfil_oficina","check_marketing","check_financeiro","check_equipe","check_principal_dor","check_historico"];
          const feitos = checks.filter(c => lead[c]).length;
          if (feitos === 0) return null;
          return (
            <div className="rounded-lg bg-stone-500/10 border border-stone-500/20 px-3 py-2 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-300 font-medium">Preparação</p>
                <span className={cn("text-xs font-semibold", feitos === checks.length ? "text-emerald-400" : "text-stone-400")}>{feitos}/{checks.length}</span>
              </div>
              <div className="flex gap-1 mt-1">
                {checks.map(c => <div key={c} className={cn("h-1.5 flex-1 rounded-full", lead[c] ? "bg-emerald-500" : "bg-slate-700")} />)}
              </div>
            </div>
          );
        })()}

        {lead.problema_identificado && (
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 mb-2">
            <p className="text-xs text-orange-300 font-medium mb-0.5">Problema:</p>
            <p className="text-xs text-slate-300 line-clamp-2">{lead.problema_identificado}</p>
          </div>
        )}

        {lead.valor_proposta && (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Proposta:</span>
              <span className="text-xs font-semibold text-amber-300">
                R$ {Number(lead.valor_proposta).toLocaleString("pt-BR")}
              </span>
              {lead.forma_pagamento && (
                <span className="text-xs text-slate-500">· {FORMAS_PAGAMENTO.find(f => f.value === lead.forma_pagamento)?.label}</span>
              )}
              <button onClick={() => setVerProposta(!verProposta)}
                className="ml-auto text-xs text-violet-400 hover:text-violet-300">
                {verProposta ? "Ocultar" : "👁 Ver"}
              </button>
            </div>
            {verProposta && (
              <div className="mt-1.5 rounded-lg bg-slate-700/40 border border-slate-600/30 p-2.5 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Produto:</span> <span className="text-white">{lead.produto_nome || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valor:</span> <span className="text-amber-300 font-semibold">R$ {Number(lead.valor_proposta).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Pagamento:</span> <span className="text-white">{FORMAS_PAGAMENTO.find(f => f.value === lead.forma_pagamento)?.label || "—"}</span></div>
                {lead.parcelas && <div className="flex justify-between"><span className="text-slate-500">Parcelas:</span> <span className="text-white">{lead.parcelas}x</span></div>}
                {lead.valor_entrada && <div className="flex justify-between"><span className="text-slate-500">Entrada:</span> <span className="text-white">R$ {Number(lead.valor_entrada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>}
                {lead.tipo_promessa && <div className="flex justify-between"><span className="text-slate-500">Intenção:</span> <span className="text-white">{lead.tipo_promessa === "confirmado" ? "✅ Confirmado" : "🤔 Pensando"}</span></div>}
                {lead.data_promessa_pagamento && <div className="flex justify-between"><span className="text-slate-500">Data pag.:</span> <span className="text-white">{lead.data_promessa_pagamento}</span></div>}
                {lead.objecoes && <div><span className="text-slate-500">Objeções:</span> <p className="text-slate-300 mt-0.5">{lead.objecoes}</p></div>}
              </div>
            )}
          </div>
        )}

        {lead.tipo_promessa === "confirmado" && lead.data_promessa_pagamento && (
          <p className="text-xs text-emerald-400 mb-1">
            ✅ Pag. confirmado: {lead.data_promessa_pagamento}
          </p>
        )}

        {ultimaAtv && (
          <p className="text-xs text-slate-500 mb-2 truncate">
            Última atv: {ultimaAtv.resultado?.replace(/_/g, " ")} · {format(new Date(ultimaAtv.created_date), "dd/MM", { locale: ptBR })}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {lead.status === "reuniao_agendada" && (
            <>
              {(() => {
                const checks = ["check_perfil_oficina","check_marketing","check_financeiro","check_equipe","check_principal_dor","check_historico"];
                const jaPreparou = checks.some(c => lead[c]) || !!lead.notas_preparacao;
                return (
                  <button onClick={() => onAcao(lead, "preparar_reuniao")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-lg border transition-colors",
                      jaPreparou
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                        : "bg-stone-500/20 border-stone-500/40 text-stone-300 hover:bg-stone-500/30"
                    )}>
                    {jaPreparou ? "👁 Ver Preparação" : "📋 Preparar"}
                  </button>
                );
              })()}
              <button onClick={() => onAcao(lead, "marcar_realizada")}
                className="px-2.5 py-1 text-xs rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30 transition-colors">
                ✓ Realizada
              </button>
              <button onClick={() => onAcao(lead, "nao_compareceu")}
                className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors">
                ⚠️ Non-Show
              </button>
            </>
          )}
          {["reuniao_realizada", "em_contato"].includes(lead.status) && (
            <button onClick={() => onAcao(lead, "enviar_proposta")}
              className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors">
              📄 Proposta
            </button>
          )}
          {lead.status === "proposta_enviada" && (
            <button onClick={() => onAcao(lead, "em_negociacao")}
              className="px-2.5 py-1 text-xs rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30 transition-colors">
              🤝 Negociação
            </button>
          )}
          {lead.status === "em_negociacao" && (
            <button onClick={() => onAcao(lead, "venda_ganha")}
              className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
              🏆 Ganhar
            </button>
          )}
          <button onClick={() => onAcao(lead, "venda_perdida")}
            className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 transition-colors">
            ✕ Perder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rodapé Minhas Vendas ─────────────────────────────────────────────────────
function RodapeVendas({ leads }) {
  const [filtro, setFiltro] = useState("30d");
  const agora = new Date();

  const FORMAS_LABEL = {
    avista: "À vista",
    boleto: "Boleto",
    cartao_parcelado: "Cartão Parcelado",
    cartao_avista: "Cartão à vista",
    pix: "PIX",
    recorrente: "Recorrente",
    transferencia: "Transferência",
  };

  const vendasFechadas = leads
    .filter(l => l.status === "venda_sucesso")
    .filter(l => {
      const dataVenda = new Date(l.updated_date || l.created_date);
      const diffDias = (agora - dataVenda) / (1000 * 60 * 60 * 24);
      if (filtro === "24h") return diffDias <= 1;
      if (filtro === "7d") return diffDias <= 7;
      return diffDias <= 30;
    })
    .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));

  const totalValor = vendasFechadas.reduce((acc, l) => acc + (Number(l.valor_proposta) || 0), 0);

  if (vendasFechadas.length === 0 && filtro === "30d") return null;

  return (
    <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-lg">🏆</span>
          <h3 className="text-base font-bold text-emerald-300">Minhas Vendas</h3>
          <span className="text-xs text-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {vendasFechadas.length} venda{vendasFechadas.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {["24h", "7d", "30d"].map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filtro === f
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {vendasFechadas.length > 0 ? (
        <>
          <div className="space-y-1.5">
            {vendasFechadas.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lead.nome || lead.lead_nome}</p>
                  <p className="text-xs text-slate-500">{lead.empresa || lead.lead_empresa || ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-300">
                    R$ {Number(lead.valor_proposta || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500">{FORMAS_LABEL[lead.forma_pagamento] || lead.forma_pagamento || '—'}</p>
                </div>
                <div className="text-right flex-shrink-0 w-16">
                  <p className="text-xs text-slate-400">
                    {new Date(lead.updated_date || lead.created_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-500/15 flex justify-between items-center">
            <span className="text-xs text-slate-500">Total no período</span>
            <span className="text-lg font-bold text-emerald-300">
              R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500 text-center py-4">Nenhuma venda no período selecionado</p>
      )}
    </div>
  );
}

// ─── Dashboard indicadores ────────────────────────────────────────────────────
function DashboardIndicadores({ leads, tarefas }) {
  const hoje = new Date().toISOString().split("T")[0];
  const reunioesHoje = tarefas.filter(t => t.tipo === "reuniao" && t.data_prevista === hoje).length;
  const reunioesRealizadas = leads.filter(l => l.status === "reuniao_realizada").length;
  const propostasEnviadas = leads.filter(l => l.status === "proposta_enviada").length;
  const negociacoes = leads.filter(l => l.status === "em_negociacao").length;
  const vendasGanhas = leads.filter(l => l.status === "venda_sucesso").length;
  const totalFechados = leads.filter(l => ["venda_sucesso", "perdido"].includes(l.status)).length;
  const conversao = totalFechados > 0 ? Math.round((vendasGanhas / totalFechados) * 100) : 0;

  const cards = [
    { label: "Reuniões Hoje", valor: reunioesHoje, cor: "text-sky-300", bg: "bg-sky-500/10 border-sky-500/20" },
    { label: "Reuniões Realizadas", valor: reunioesRealizadas, cor: "text-orange-300", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Propostas Enviadas", valor: propostasEnviadas, cor: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Em Negociação", valor: negociacoes, cor: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { label: "Vendas Fechadas", valor: vendasGanhas, cor: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Conversão", valor: `${conversao}%`, cor: conversao >= 50 ? "text-emerald-300" : "text-rose-300", bg: "bg-slate-800/60 border-slate-700/40" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {cards.map(c => (
        <div key={c.label} className={cn("rounded-xl border p-3 flex flex-col gap-1", c.bg)}>
          <span className="text-[10px] text-slate-500 leading-tight">{c.label}</span>
          <span className={cn("text-xl font-bold", c.cor)}>{c.valor}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PipelineCloser({ user }) {
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState(null);
  const [secaoColapsada, setSecaoColapsada] = useState({});

  const { data: leadsRaw = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["leads", "closer", empresaId, user?.email],
    queryFn: async () => {
      if (!empresaId || !user?.email) return [];
      // Busca leads onde o usuário é closer OU SDR — sem limite artificial
      const [comoCloser, comoSdr] = await Promise.all([
        api.entities.Lead.filter({ empresaId, closer_responsavel: user.email }, "-created_date", 200),
        api.entities.Lead.filter({ empresaId, sdr_responsavel: user.email }, "-created_date", 200),
      ]);
      // Merge sem duplicatas
      const mapaIds = new Map();
      [...comoCloser, ...comoSdr].forEach(l => mapaIds.set(l.id, l));
      return [...mapaIds.values()];
    },
    enabled: !!empresaId && !!user?.email,
    refetchInterval: 90_000,
  });

  const leads = useMemo(() => {
    const statusPipeline = ["reuniao_agendada", "reuniao_realizada", "proposta_enviada", "em_negociacao"];
    const trintaDias = new Date();
    trintaDias.setDate(trintaDias.getDate() - 30);
    return leadsRaw.filter(l => {
      const isRelevante = l.closer_responsavel === user?.email || l.sdr_responsavel === user?.email;
      if (!isRelevante) return false;
      if (statusPipeline.includes(l.status)) return true;
      if (["venda_sucesso", "perdido"].includes(l.status)) {
        return new Date(l.updated_date || l.created_date) >= trintaDias;
      }
      return false;
    });
  }, [leadsRaw, user?.email]);

  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas", "closer-pipeline", empresaId],
    queryFn: () => listarTarefas(empresaId, { apenasDoSDR: true, sdrEmail: user?.email }),
    enabled: !!empresaId && !!user?.email,
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades", empresaId],
    queryFn: () => listarAtividades(empresaId),
    enabled: !!empresaId,
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId),
    enabled: !!empresaId,
  });

  const atualizarLeadMutation = useMutation({
    mutationFn: ({ id, data }) => atualizarLead(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const criarTarefaMutation = useMutation({
    mutationFn: (dados) => criarTarefa(dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  const tarefaPorLead = useMemo(() => {
    const idx = {};
    tarefas
      .filter(t => t.tipo === "reuniao")
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .forEach(t => { if (!idx[t.lead_id]) idx[t.lead_id] = t; });
    return idx;
  }, [tarefas]);

  // Apenas leads ativos no pipeline (exclui fechado/perdido da visualização em colunas)
  const leadsPipeline = useMemo(() =>
    leads.filter(l => ESTAGIOS.map(e => e.key).includes(l.status)),
    [leads]
  );

  const funnelCounts = useMemo(() => {
    const counts = {};
    ESTAGIOS.forEach(e => { counts[e.key] = 0; });
    leadsPipeline.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return counts;
  }, [leadsPipeline]);

  const leadsPorEstagio = useMemo(() => {
    const idx = {};
    ESTAGIOS.forEach(e => { idx[e.key] = []; });
    leadsPipeline.forEach(l => { if (idx[l.status]) idx[l.status].push(l); });
    return idx;
  }, [leadsPipeline]);

  const handleNaoCompareceu = async (lead, dados) => {
    const hoje = new Date().toISOString().split("T")[0];
    const obsTexto = [
      `⚠️ Lead não compareceu à reunião`,
      dados.motivo && `Motivo: ${dados.motivo}`,
      dados.observacao && `Obs: ${dados.observacao}`,
    ].filter(Boolean).join("\n");

    await api.entities.Atividade.create({
      empresaId,
      tipo: "anotacao",
      resultado: "outro",
      observacao: obsTexto,
      sdr_email: user?.email,
      lead_id: lead.id,
      lead_nome: lead.nome,
      lead_telefone: lead.telefone,
      origem_sincronizacao: "manual",
    });

    // Non-show: encerrar tarefas pendentes do lead (inclui a tarefa de reunião)
    const pendentesNonShow = await buscarTarefasPendentesDoLead(empresaId, lead.id);
    if (pendentesNonShow.length > 0) {
      await encerrarTarefasAutomaticamente(
        pendentesNonShow,
        dados.acao === "desqualificar" ? "desqualificacao" : "nao_compareceu"
      );
    }

    if (dados.acao === "desqualificar") {
      // Desqualifica e mantém responsáveis como estão
      await atualizarLeadMutation.mutateAsync({ id: lead.id, data: { status: "desqualificado" } });
      toast.success("Lead desqualificado.");
    } else if (dados.acao === "devolver_sdr") {
      const sdrDestino = dados.sdr_destino || lead.sdr_responsavel;
      await atualizarLeadMutation.mutateAsync({
        id: lead.id,
        data: {
          status: "em_contato",
          sdr_responsavel: sdrDestino,
          closer_responsavel: null,
        },
      });
      await criarTarefaMutation.mutateAsync({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        lead_empresa: lead.empresa,
        sdr_email: sdrDestino,
        tipo: "ligacao",
        data_prevista: hoje,
        periodo: "manha",
        status: "pendente",
        observacao: `⚠️ Lead devolvido — não compareceu à reunião. Dar tratativa em até 1h.`,
      });
      toast.success("Lead devolvido ao SDR. Tarefa criada com urgência de 1h.");
    } else {
      // reabrir_cadencia — garante que closer_responsavel está preenchido
      const closerAtual = lead.closer_responsavel || user?.email;
      if (!lead.closer_responsavel) {
        await atualizarLeadMutation.mutateAsync({ id: lead.id, data: { closer_responsavel: closerAtual } });
      }
      if (dados.cadencia_id) {
        const cadenciaObj = cadencias.find(c => c.id === dados.cadencia_id);
        if (cadenciaObj) {
          await criarTarefasDaCadencia(empresaId, lead, lead.sdr_responsavel || closerAtual, cadenciaObj, new Date());
          toast.success(`Cadência "${cadenciaObj.nome}" reaberta.`);
        }
      } else {
        toast.success("Atividade registrada.");
      }
    }

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["atividades"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    setModalState(null);
  };

  const handleAcao = async (lead, acao, dados) => {
    if (acao === "preparar_reuniao") {
      const updateData = {};
      const checkLabels = {
        check_perfil_oficina: "Perfil da Oficina",
        check_marketing: "Marketing",
        check_financeiro: "Financeiro",
        check_equipe: "Equipe",
        check_principal_dor: "Principal Dor",
        check_historico: "Histórico",
      };
      ["check_perfil_oficina","check_marketing","check_financeiro","check_equipe","check_principal_dor","check_historico"].forEach(k => {
        updateData[k] = !!dados[k];
      });
      if (dados.notas_preparacao) updateData.notas_preparacao = dados.notas_preparacao;
      await atualizarLeadMutation.mutateAsync({ id: lead.id, data: updateData });

      // Registrar no histórico
      const checksMarcados = Object.entries(checkLabels)
        .filter(([k]) => dados[k])
        .map(([, label]) => `✓ ${label}`)
        .join("\n");
      const obsPrep = [
        "📋 Preparação de reunião registrada",
        checksMarcados && `\nChecklist:\n${checksMarcados}`,
        dados.notas_preparacao && `\nNotas: ${dados.notas_preparacao}`,
      ].filter(Boolean).join("");

      await api.entities.Atividade.create({
        empresaId,
        tipo: "anotacao",
        resultado: "outro",
        observacao: obsPrep,
        sdr_email: user?.email,
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        origem_sincronizacao: "manual",
      });

      queryClient.invalidateQueries({ queryKey: ["atividades"] });
      toast.success("Preparação da reunião salva");
      setModalState(null);
      return;
    }

    const novoStatus = {
      marcar_realizada: "reuniao_realizada",
      enviar_proposta: "proposta_enviada",
      em_negociacao: "em_negociacao",
      venda_ganha: "venda_sucesso",
      // Se desqualificar, status é "desqualificado"; senão "perdido"
      venda_perdida: dados.cadencia_id === "__desqualificar__" ? "desqualificado" : "perdido",
    }[acao];

    const updateData = { status: novoStatus };

    if (acao === "marcar_realizada") {
      if (dados.problema)  updateData.problema_identificado = dados.problema;
      if (dados.impacto)   updateData.impacto_identificado  = dados.impacto;
      if (dados.solucao)   updateData.solucao_apresentada   = dados.solucao;
      if (dados.combinado) updateData.plano_acao            = dados.combinado;
      if (dados.temperatura_lead) updateData.temperatura_lead = dados.temperatura_lead;
      if (dados.probabilidade != null) updateData.probabilidade_fechamento = dados.probabilidade;
    }
    if (acao === "enviar_proposta") {
      if (dados.valor_proposta) updateData.valor_proposta = Number(dados.valor_proposta);
      if (dados.forma_pagamento) updateData.forma_pagamento = dados.forma_pagamento;
      if (dados.prazo_proposta)  updateData.prazo_proposta = dados.prazo_proposta;
      if (dados.produto)         updateData.produto_nome   = dados.produto;
      if (dados.produto_id)      updateData.produto_id     = dados.produto_id;
    }
    if (acao === "venda_ganha" && dados.algoMudou) {
      if (dados.valor_proposta) updateData.valor_proposta = Number(dados.valor_proposta);
      if (dados.forma_pagamento) updateData.forma_pagamento = dados.forma_pagamento;
      if (dados.produto)         updateData.produto_nome   = dados.produto;
      if (dados.produto_id)      updateData.produto_id     = dados.produto_id;
    }
    if (acao === "enviar_proposta") {
      if (dados.tipo_promessa)           updateData.tipo_promessa            = dados.tipo_promessa;
      if (dados.data_promessa_pagamento) updateData.data_promessa_pagamento  = dados.data_promessa_pagamento;
    }
    if (acao === "venda_ganha" && dados.algoMudou) {
      if (dados.valor_original) updateData.valor_original = Number(dados.valor_original);
      if (dados.desconto_pct)   updateData.desconto_pct   = Number(dados.desconto_pct);
      if (dados.parcelas)       updateData.parcelas        = Number(dados.parcelas);
      if (dados.valor_entrada)  updateData.valor_entrada   = Number(dados.valor_entrada);
      if (dados.valor_kify)     updateData.valor_kify      = Number(dados.valor_kify);
    }
    if (acao === "em_negociacao") {
      if (dados.objecoes)        updateData.objecoes                = dados.objecoes;
      if (dados.proximo_contato) updateData.proximo_contato         = dados.proximo_contato;
      if (dados.probabilidade != null) updateData.probabilidade_fechamento = dados.probabilidade;
    }

    // Negociação com próximo contato definido → agenda tarefa de retorno para o closer
    if (acao === "em_negociacao" && dados.proximo_contato) {
      const dataProx = new Date(dados.proximo_contato);
      await criarTarefaMutation.mutateAsync({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        lead_empresa: lead.empresa,
        sdr_email: user?.email,
        tipo: "ligacao",
        data_prevista: dados.proximo_contato.split("T")[0],
        periodo: dataProx.getHours() < 13 ? "manha" : "tarde",
        status: "pendente",
        origem: "proximo_contato",
        observacao: "🔄 Retorno de negociação agendado",
      });
    }
    if (acao === "venda_perdida" && dados.motivo_perda) {
      updateData.motivo_perda = dados.motivo_perda;
    }
    if (dados.observacao) updateData.observacoes = dados.observacao;

    await atualizarLeadMutation.mutateAsync({ id: lead.id, data: updateData });

    // Reunião realizada → concluir a tarefa de reunião pendente
    if (acao === "marcar_realizada") {
      const pendentes = await buscarTarefasPendentesDoLead(empresaId, lead.id);
      const reunioes = pendentes.filter(t => t.tipo === "reuniao");
      if (reunioes.length > 0) {
        await Promise.all(reunioes.map(t => atualizarTarefa(t.id, { status: "concluida" })));
      }
    }

    // Objetivo final atingido → encerrar TODAS as tarefas pendentes do lead
    // (antes de criar Primeiro Acesso / nurturing, para não encerrar as novas)
    if (acao === "venda_ganha" || acao === "venda_perdida") {
      const pendentes = await buscarTarefasPendentesDoLead(empresaId, lead.id);
      if (pendentes.length > 0) {
        const motivo = acao === "venda_ganha"
          ? "venda"
          : dados.cadencia_id === "__desqualificar__" ? "desqualificacao" : "perda";
        await encerrarTarefasAutomaticamente(pendentes, motivo);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });

    // Registrar atividade de venda fechada
    if (acao === "venda_ganha") {
      const valorFinal = dados.algoMudou ? (dados.valor_proposta || lead.valor_proposta) : lead.valor_proposta;
      const pagFinal = dados.algoMudou ? (dados.forma_pagamento || lead.forma_pagamento) : lead.forma_pagamento;
      const parcelasFinal = dados.algoMudou ? dados.parcelas : lead.parcelas;
      const entradaFinal = dados.algoMudou ? dados.valor_entrada : lead.valor_entrada;
      const resumo = [
        `🏆 VENDA FECHADA`,
        `Produto: ${dados.produto || lead.produto_nome || "—"}`,
        `Valor: R$ ${Number(valorFinal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `Pagamento: ${FORMAS_PAGAMENTO.find(f => f.value === pagFinal)?.label || "—"}`,
        parcelasFinal ? `Parcelas: ${parcelasFinal}x` : null,
        entradaFinal ? `Entrada: R$ ${Number(entradaFinal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null,
        dados.observacao ? `Obs: ${dados.observacao}` : null,
      ].filter(Boolean).join("\n");
      await api.entities.Atividade.create({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        tipo: "anotacao",
        resultado: "venda_realizada",
        observacao: resumo,
        sdr_email: user?.email,
        origem_sincronizacao: "manual",
      });
    }

    // Tarefa automática de Primeiro Acesso ao ganhar venda
    if (acao === "venda_ganha") {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      await criarTarefaMutation.mutateAsync({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome || lead.lead_nome,
        lead_telefone: lead.telefone || lead.lead_telefone || '',
        lead_empresa: lead.empresa || lead.lead_empresa || '',
        sdr_email: user?.email,
        tipo: "realizar_reuniao",
        data_prevista: amanha.toISOString().split('T')[0],
        periodo: "manha",
        status: "pendente",
        observacao: "📋 Primeiro Acesso — Agendar reunião de onboarding no sistema SPO com o cliente.",
      });
      toast.success("Tarefa de Primeiro Acesso criada automaticamente!");
    }

    // Nurturing automático
    if (acao === "venda_perdida" && NURTURING_DIAS[dados.motivo_perda] &&
        (!dados.cadencia_id || dados.cadencia_id === "__nenhuma__") && dados.cadencia_id !== "__desqualificar__") {
      const dataRetorno = new Date();
      dataRetorno.setDate(dataRetorno.getDate() + NURTURING_DIAS[dados.motivo_perda]);
      await criarTarefaMutation.mutateAsync({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        lead_empresa: lead.empresa,
        // Usa o SDR original do lead; se não tiver, usa o closer atual
        sdr_email: lead.sdr_responsavel || user?.email,
        tipo: "ligacao",
        data_prevista: dataRetorno.toISOString().split("T")[0],
        periodo: "manha",
        status: "pendente",
        observacao: `🔄 Retorno nurturing — ${MOTIVOS_PERDA.find(m => m.value === dados.motivo_perda)?.label}`,
        origem: "proximo_contato",
      });
      toast.info(`Retorno automático agendado em ${NURTURING_DIAS[dados.motivo_perda]} dias`);
    }

    // Desqualificar — status já foi salvo como "desqualificado" acima
    if (dados.cadencia_id === "__desqualificar__") {
      toast.success("Lead desqualificado e arquivado");
      setModalState(null);
      return;
    }

    // Cadência selecionada
    if (dados.cadencia_id && !["__nenhuma__", "__desqualificar__"].includes(dados.cadencia_id)) {
      const cadenciaObj = cadencias.find(c => c.id === dados.cadencia_id);
      if (cadenciaObj) {
        // Tarefas atribuídas ao SDR selecionado no modal, depois SDR do lead, por último o closer
        const sdrDestino = dados.sdr_destino || lead.sdr_responsavel || user?.email;
        await criarTarefasDaCadencia(empresaId, lead, sdrDestino, cadenciaObj, new Date());
        toast.info(`Cadência "${cadenciaObj.nome}" iniciada — tarefas atribuídas ao SDR`);
      }
    }

    const mensagens = {
      marcar_realizada: "Reunião marcada como realizada — diagnóstico salvo",
      enviar_proposta: "Proposta registrada",
      em_negociacao: "Lead movido para negociação",
      venda_ganha: "🏆 Venda ganha! Parabéns!",
      venda_perdida: "Lead arquivado como perda",
    };
    toast.success(mensagens[acao] || "Atualizado");
    setModalState(null);
  };

  const totalPipeline = leadsPipeline.length;

  return (
    <div className="space-y-5">
      <DashboardIndicadores leads={leads} tarefas={tarefas} />

      {totalPipeline > 0 && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Funil de conversão</span>
            <span className="text-xs text-slate-500">({totalPipeline} leads ativos)</span>
          </div>
          <div className="flex gap-1 h-6">
            {ESTAGIOS.map((e, i) => {
              const pct = totalPipeline > 0 ? (funnelCounts[e.key] / totalPipeline) * 100 : 0;
              const colors = ["bg-stone-500","bg-orange-500","bg-amber-500","bg-yellow-500"];
              return pct > 0 ? (
                <div key={e.key} className={cn("rounded flex items-center justify-center text-xs text-white font-semibold", colors[i])}
                  style={{ width: `${Math.max(pct, 8)}%` }} title={`${e.label}: ${funnelCounts[e.key]}`}>
                  {funnelCounts[e.key]}
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      {loadingLeads ? (
        <div className="text-center py-12">
          <RefreshCw className="w-7 h-7 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Carregando pipeline...</p>
        </div>
      ) : totalPipeline === 0 ? (
        <div className="text-center py-12 rounded-xl border border-slate-800/60 bg-slate-900/40">
          <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">Pipeline vazio</h3>
          <p className="text-slate-500 text-xs">Leads com reunião agendada aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ESTAGIOS.map(estagio => {
            const lista = leadsPorEstagio[estagio.key] || [];
            if (lista.length === 0) return null;
            const colapsado = secaoColapsada[estagio.key];
            return (
              <div key={estagio.key} className={cn("rounded-xl border overflow-hidden", estagio.bordaClass)}>
                <button
                  onClick={() => setSecaoColapsada(prev => ({ ...prev, [estagio.key]: !prev[estagio.key] }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("text-sm font-bold", estagio.headerClass)}>{estagio.label}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold", estagio.badgeClass)}>
                      {lista.length}
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:inline">{estagio.descricao}</span>
                  </div>
                  {colapsado ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                </button>
                {!colapsado && (
                  <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {lista.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        tarefa={tarefaPorLead[lead.id]}
                        atividades={atividades}
                        onAcao={(lead, acao) => setModalState({ lead, acao })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <RodapeVendas leads={leads} />

      {modalState && modalState.acao === "nao_compareceu" ? (
        <ModalNaoCompareceu
          lead={modalState.lead}
          onClose={() => setModalState(null)}
          onConfirmar={(dados) => handleNaoCompareceu(modalState.lead, dados)}
          cadencias={cadencias}
          currentUser={user}
        />
      ) : modalState ? (
        <ModalAcao
          lead={modalState.lead}
          acao={modalState.acao}
          onClose={() => setModalState(null)}
          onConfirmar={(dados) => handleAcao(modalState.lead, modalState.acao, dados)}
          cadencias={cadencias}
          currentUser={user}
        />
      ) : null}
    </div>
  );
}