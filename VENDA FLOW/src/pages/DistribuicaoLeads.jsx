import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Settings2, GitBranch, ArrowRightLeft, Users, Clock3,
  Activity, Sparkles, Brain, PlusCircle, RefreshCcw, Megaphone,
  Flag, Workflow, Edit, Trash2, ToggleLeft, ToggleRight,
  AlertTriangle, Phone, CheckCircle2, UserCheck, Timer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/perfil/GlassCard";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import moment from "moment";
import { resolveDisplayNameFromUser } from '@/lib/resolveDisplayName';
import { carregarMapaNomes } from "@/lib/services/equipeService";

// ── Design tokens ─────────────────────────────────────────────
const ACCENT = {
  sky:     { h: "199 89%", c: "hsl(199 89% 55%)", light: "hsl(199 89% 70%)", bg: "hsl(199 89% 55% / 0.12)", ring: "hsl(199 89% 55% / 0.30)" },
  violet:  { h: "262 83%", c: "hsl(262 83% 60%)", light: "hsl(262 83% 75%)", bg: "hsl(262 83% 60% / 0.12)", ring: "hsl(262 83% 60% / 0.30)" },
  emerald: { h: "160 84%", c: "hsl(160 84% 45%)", light: "hsl(160 84% 60%)", bg: "hsl(160 84% 45% / 0.12)", ring: "hsl(160 84% 45% / 0.30)" },
  amber:   { h: "38 92%",  c: "hsl(38 92% 55%)",  light: "hsl(38 92% 60%)",  bg: "hsl(38 92% 55% / 0.12)",  ring: "hsl(38 92% 55% / 0.30)"  },
  rose:    { h: "0 72%",   c: "hsl(0 72% 55%)",   light: "hsl(0 72% 72%)",   bg: "hsl(0 72% 55% / 0.12)",   ring: "hsl(0 72% 55% / 0.30)"   },
};

function Badge({ label, accent = "sky" }) {
  const a = ACCENT[accent];
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: a.bg, border: `1px solid ${a.ring}`, color: a.light }}>
      {label}
    </span>
  );
}

// ── Stat Card (hero) ──────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent, index }) {
  const a = ACCENT[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: "hsl(222 47% 7% / 0.6)",
        border: "1px solid hsl(0 0% 100% / 0.06)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px -12px hsl(222 47% 2% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.04)",
      }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: a.bg, border: `1px solid ${a.ring}` }}>
        <Icon className="w-5 h-5" style={{ color: a.light }} />
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: "hsl(220 15% 55%)" }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: "#fff" }}>{value}</p>
      </div>
    </motion.div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────
const TABS = ["Regras", "Distribuição em Tempo Real", "Consultores", "Logs"];

function TabBar({ tabAtiva, onTab }) {
  return (
    <div className="flex items-center gap-1 p-1.5 rounded-full w-fit overflow-x-auto"
      style={{ background: "hsl(222 47% 7% / 0.6)", border: "1px solid hsl(0 0% 100% / 0.06)", backdropFilter: "blur(20px)" }}>
      {TABS.map((tab) => {
        const active = tabAtiva === tab;
        return (
          <button key={tab} onClick={() => onTab(tab)}
            className="whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
            style={{
              color: active ? "#fff" : "hsl(220 15% 55%)",
              background: active ? "linear-gradient(135deg, hsl(199 89% 55% / 0.18), hsl(262 83% 60% / 0.18))" : "transparent",
              border: active ? "1px solid hsl(199 89% 55% / 0.4)" : "1px solid transparent",
              boxShadow: active ? "0 4px 18px -6px hsl(199 89% 55% / 0.5)" : "none",
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

// ── Left Rail Components ──────────────────────────────────────
function DistribuicaoStatus({ regrasAtivas }) {
  const items = [
    { label: "Sistema", status: "Online", accent: "emerald" },
    { label: "Fallback", status: "Inativo", accent: "amber" },
    { label: "Round Robin", status: `${regrasAtivas} regras`, accent: "sky" },
  ];
  return (
    <GlassCard glow="emerald">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: ACCENT.emerald.bg, border: `1px solid ${ACCENT.emerald.ring}` }}>
            <Activity className="w-4 h-4" style={{ color: ACCENT.emerald.light }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: "#fff" }}>Status da Distribuição</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => {
            const a = ACCENT[item.accent];
            return (
              <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "hsl(0 0% 100% / 0.03)", border: "1px solid hsl(0 0% 100% / 0.06)" }}>
                <span className="text-xs font-medium" style={{ color: "hsl(220 15% 75%)" }}>{item.label}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: a.bg, border: `1px solid ${a.ring}`, color: a.light }}>
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

const QUICK_ACTIONS = [
  { label: "Nova Regra", icon: PlusCircle, gradient: "linear-gradient(135deg, hsl(199 89% 55% / 0.18), hsl(217 91% 60% / 0.10))", ring: "hsl(199 89% 55% / 0.35)", glow: "hsl(199 89% 55% / 0.5)", iconColor: "hsl(199 89% 70%)" },
  { label: "Round Robin", icon: RefreshCcw, gradient: "linear-gradient(135deg, hsl(262 83% 60% / 0.18), hsl(282 83% 60% / 0.10))", ring: "hsl(262 83% 60% / 0.35)", glow: "hsl(262 83% 60% / 0.5)", iconColor: "hsl(262 83% 75%)" },
  { label: "Campanhas", icon: Megaphone, gradient: "linear-gradient(135deg, hsl(160 84% 45% / 0.18), hsl(174 72% 50% / 0.10))", ring: "hsl(160 84% 45% / 0.35)", glow: "hsl(160 84% 45% / 0.5)", iconColor: "hsl(160 84% 60%)" },
  { label: "Prioridades", icon: Flag, gradient: "linear-gradient(135deg, hsl(38 92% 55% / 0.18), hsl(20 90% 55% / 0.10))", ring: "hsl(38 92% 55% / 0.35)", glow: "hsl(38 92% 55% / 0.5)", iconColor: "hsl(38 92% 60%)" },
];

function QuickActionsCard({ onNovaRegra }) {
  return (
    <GlassCard glow="sky">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "hsl(199 89% 70%)" }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(220 15% 55%)" }}>Ações Rápidas</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                whileHover={{ y: -2, boxShadow: `0 10px 30px -10px ${action.glow}` }}
                whileTap={{ scale: 0.96 }}
                onClick={action.label === "Nova Regra" ? onNovaRegra : undefined}
                className="relative flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-semibold overflow-hidden outline-none transition-all duration-300"
                style={{ background: action.gradient, border: `1px solid ${action.ring}` }}
              >
                <div className="pointer-events-none absolute inset-x-0 -top-px h-px"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.30), transparent)" }} />
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "hsl(0 0% 100% / 0.06)", border: "1px solid hsl(0 0% 100% / 0.10)" }}>
                  <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
                </div>
                <span style={{ color: "#fff", fontSize: "11px" }}>{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

function InsightsCard() {
  return (
    <GlassCard glow="violet">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: ACCENT.violet.bg, border: `1px solid ${ACCENT.violet.ring}` }}>
              <Brain className="w-4 h-4" style={{ color: ACCENT.violet.light }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#fff" }}>Insights Inteligentes</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: ACCENT.violet.bg, border: `1px solid ${ACCENT.violet.ring}`, color: ACCENT.violet.light }}>IA</span>
        </div>
        <div className="flex flex-col items-center text-center py-5">
          <div className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ background: "linear-gradient(135deg, hsl(199 89% 55% / 0.2), hsl(262 83% 60% / 0.2))", border: "1px solid hsl(0 0% 100% / 0.10)", boxShadow: "0 0 24px hsl(199 89% 55% / 0.3)" }}>
            <div className="absolute inset-0 rounded-xl blur-xl opacity-60" style={{ background: "hsl(199 89% 55% / 0.3)" }} />
            <Sparkles className="relative w-5 h-5" style={{ color: "hsl(199 89% 70%)" }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "#fff" }}>Nenhum insight disponível</p>
          <p className="text-xs leading-relaxed" style={{ color: "hsl(220 15% 55%)" }}>
            Ative regras para começar a receber recomendações automáticas.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

// ── Rules Table ───────────────────────────────────────────────
function RuleRow({ regra, onEdit, onDelete, onToggle, index }) {
  const tipoMap = { origem: { label: "Origem", accent: "sky" }, campanha: { label: "Campanha", accent: "violet" } };
  const modoMap = { fila: { label: "Round Robin", accent: "emerald" }, especifico: { label: "Específico", accent: "amber" } };
  const modo = modoMap[regra.modo_distribuicao] || { label: regra.modo_distribuicao, accent: "sky" };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group transition-all duration-200"
      style={{ borderBottom: "1px solid hsl(0 0% 100% / 0.05)" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "hsl(0 0% 100% / 0.03)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <td className="px-4 py-3">
        <span className="text-sm font-semibold" style={{ color: "#fff" }}>{regra.nome}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium capitalize" style={{ color: "hsl(220 15% 75%)" }}>
          {regra.tipo === "origem" ? (regra.origem || "—").replace("_", " ") : (regra.campanha || "—")}
        </span>
      </td>
      <td className="px-4 py-3"><Badge label={modo.label} accent={modo.accent} /></td>
      <td className="px-4 py-3">
        <span className="text-sm" style={{ color: "hsl(220 15% 65%)" }}>{regra.sdrs_atribuidos?.length || 0} SDR(s)</span>
      </td>
      <td className="px-4 py-3">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold"
          style={{ background: "hsl(0 0% 100% / 0.05)", color: "hsl(220 15% 65%)", display: "inline-flex" }}>
          {regra.prioridade || 1}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(regra)}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
          style={{
            background: regra.ativa ? ACCENT.emerald.bg : "hsl(0 0% 100% / 0.05)",
            border: `1px solid ${regra.ativa ? ACCENT.emerald.ring : "hsl(0 0% 100% / 0.08)"}`,
            color: regra.ativa ? ACCENT.emerald.light : "hsl(220 15% 45%)",
          }}
        >
          {regra.ativa ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
          {regra.ativa ? "Ativa" : "Inativa"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => onEdit(regra)}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: ACCENT.sky.bg, border: `1px solid ${ACCENT.sky.ring}` }}
          >
            <Edit className="w-3.5 h-3.5" style={{ color: ACCENT.sky.light }} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => onDelete(regra)}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: ACCENT.rose.bg, border: `1px solid ${ACCENT.rose.ring}` }}
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: ACCENT.rose.light }} />
          </motion.button>
        </div>
      </td>
    </motion.tr>
  );
}

function RulesCard({ regras, onNovaRegra, onEdit, onDelete, onToggle }) {
  return (
    <GlassCard glow="sky" hover={false}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: ACCENT.sky.bg, border: `1px solid ${ACCENT.sky.ring}` }}>
              <Settings2 className="w-4 h-4" style={{ color: ACCENT.sky.light }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fff" }}>Regras de Distribuição</p>
              <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>Gerencie regras inteligentes de atribuição de leads</p>
            </div>
          </div>
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onNovaRegra}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))",
              boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
              border: "1px solid hsl(0 0% 100% / 0.15)",
            }}
          >
            <Plus className="w-4 h-4" />
            Nova Regra
          </motion.button>
        </div>

        {regras.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6" style={{ minHeight: "420px" }}>
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center mb-6"
              style={{
                background: "linear-gradient(135deg, hsl(199 89% 55% / 0.20), hsl(262 83% 60% / 0.20))",
                border: "1px solid hsl(199 89% 55% / 0.25)",
                boxShadow: "0 0 40px hsl(199 89% 55% / 0.35)",
              }}>
              <div className="absolute inset-0 rounded-full blur-2xl opacity-50"
                style={{ background: "hsl(199 89% 55% / 0.3)" }} />
              <Workflow className="relative w-12 h-12" style={{ color: "hsl(220 15% 70%)" }} />
            </div>
            <h3 className="font-bold mb-3"
              style={{
                fontSize: "28px",
                background: "linear-gradient(135deg, #fff, hsl(220 20% 85%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              Nenhuma regra configurada
            </h3>
            <p className="text-sm mb-6 leading-relaxed"
              style={{ color: "hsl(220 15% 75%)", maxWidth: "520px" }}>
              Crie regras automáticas para distribuir leads entre SDRs, campanhas e equipes em tempo real.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {[
                { label: "Round Robin", accent: "sky" },
                { label: "Por Campanha", accent: "violet" },
                { label: "Prioridade", accent: "amber" },
                { label: "IA Routing", accent: "emerald" },
              ].map((b) => <Badge key={b.label} label={b.label} accent={b.accent} />)}
            </div>
            <motion.button
              whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={onNovaRegra}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))",
                boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
              }}
            >
              <Plus className="w-4 h-4" />
              Criar Primeira Regra
            </motion.button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 100% / 0.06)" }}>
                  {["Nome", "Origem", "Estratégia", "Consultores", "Prioridade", "Status", "Ações"].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ color: "hsl(220 15% 45%)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regras.map((regra, i) => (
                  <RuleRow key={regra.id} regra={regra} index={i}
                    onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ── Painel Visibilidade SDR ───────────────────────────────────
function PainelVisibilidadeSDR({ empresaId, vinculos, leads, atividades }) {
  const agora = new Date();

  // Alertas globais
  const semSdr = leads.filter((l) => !l.sdr_responsavel);
  const redistribuidos3x = leads.filter((l) => (l.redistribuicoes_count || 0) >= 3);

  // Montar cards por operador
  const operadores = vinculos.filter((v) =>
    ["sdr", "closer", "social_seller", "cs", "supervisor"].includes(v.papel) && v.status === "ativo"
  );

  const operadorCards = operadores.map((v) => {
    const leadsAtivos = leads.filter((l) => l.sdr_responsavel === v.userEmail && !["desqualificado", "sem_interesse"].includes(l.status));
    const semContato = leadsAtivos.filter((l) => !l.ultima_ligacao_em);
    const ligacoesHoje = atividades.filter((a) => {
      if (a.sdr_email !== v.userEmail) return false;
      const d = new Date(a.created_date);
      return d.toDateString() === agora.toDateString();
    });
    const ultimaAtiv = atividades
      .filter((a) => a.sdr_email === v.userEmail)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    const ultimoLead = leadsAtivos
      .sort((a, b) => new Date(b.data_atribuicao || b.created_date) - new Date(a.data_atribuicao || a.created_date))[0];

    const horasSemAtividade = ultimaAtiv
      ? (agora - new Date(ultimaAtiv.created_date)) / 3600000
      : null;
    const alertaSemAtividade = horasSemAtividade !== null && horasSemAtividade > 1;

    return { ...v, leadsAtivos, semContato, ligacoesHoje, ultimaAtiv, ultimoLead, horasSemAtividade, alertaSemAtividade };
  });

  return (
    <div className="space-y-5">
      {/* Alertas globais */}
      {(semSdr.length > 0 || redistribuidos3x.length > 0) && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/6 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">Alertas de Distribuição</span>
          </div>
          {semSdr.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Leads sem SDR na fila</span>
              <span className="font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">{semSdr.length}</span>
            </div>
          )}
          {redistribuidos3x.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Redistribuídos 3+ vezes</span>
              <span className="font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full">{redistribuidos3x.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Cards de operadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {operadorCards.map((op) => (
          <div key={op.userEmail}
            className="rounded-2xl border p-4 space-y-3 transition-all"
            style={{
              background: "hsl(222 47% 7% / 0.7)",
              border: op.alertaSemAtividade ? "1px solid hsl(38 92% 55% / 0.4)" : "1px solid hsl(0 0% 100% / 0.07)",
              boxShadow: op.alertaSemAtividade ? "0 0 20px hsl(38 92% 55% / 0.1)" : "none",
            }}>
            {/* Header do card */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {op.userName?.charAt(0)?.toUpperCase() || op.userEmail?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-[120px]">{op.userName?.trim() || op.userEmail?.split("@")[0]}</p>
                  <p className="text-xs text-slate-500 capitalize">{op.papel}</p>
                </div>
              </div>
              {op.alertaSemAtividade && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/12 border border-amber-500/25 px-2 py-0.5 rounded-full">
                  <Timer className="w-3 h-3" />
                  {Math.round(op.horasSemAtividade)}h sem ativ.
                </span>
              )}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/3 border border-white/5 p-2 text-center">
                <p className="text-lg font-bold text-white">{op.leadsAtivos.length}</p>
                <p className="text-[10px] text-slate-500">leads ativos</p>
              </div>
              <div className="rounded-lg bg-white/3 border border-white/5 p-2 text-center">
                <p className="text-lg font-bold text-amber-400">{op.semContato.length}</p>
                <p className="text-[10px] text-slate-500">sem contato</p>
              </div>
              <div className="rounded-lg bg-white/3 border border-white/5 p-2 text-center">
                <p className="text-lg font-bold text-sky-400">{op.ligacoesHoje.length}</p>
                <p className="text-[10px] text-slate-500">lig. hoje</p>
              </div>
            </div>

            {/* Última atividade + último lead */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span>Última ativ.: {op.ultimaAtiv ? moment(op.ultimaAtiv.created_date).fromNow() : "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserCheck className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Último lead: {op.ultimoLead ? op.ultimoLead.nome : "—"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fila de espera (leads sem SDR) */}
      {semSdr.length > 0 && (
        <div className="rounded-2xl border border-white/7 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
            <Clock3 className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Fila de Espera — Sem SDR</h3>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{semSdr.length}</span>
          </div>
          <div className="p-4 space-y-1.5 max-h-64 overflow-y-auto">
            {semSdr.slice(0, 15).map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/3 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-sm text-white flex-1 truncate">{lead.nome}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{lead.origem?.replace(/_/g, " ")}</span>
                <span className="text-xs text-slate-600 flex-shrink-0">{moment(lead.created_date).fromNow()}</span>
              </div>
            ))}
            {semSdr.length > 15 && (
              <p className="text-xs text-slate-600 text-center py-2">+{semSdr.length - 15} outros leads na fila</p>
            )}
          </div>
        </div>
      )}

      {operadorCards.length === 0 && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 py-16 flex flex-col items-center gap-3">
          <Users className="w-8 h-8 text-slate-600" />
          <p className="text-slate-500 text-sm">Nenhum operador ativo encontrado.</p>
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
const BORDER = "hsl(0 0% 100% / 0.08)";
const INPUT_STYLE = {
  height: 40,
  padding: "0 12px",
  borderRadius: "12px",
  background: "hsl(222 47% 5% / 0.8)",
  border: `1px solid ${BORDER}`,
  color: "#fff",
  fontSize: "13px",
  width: "100%",
  outline: "none",
};

function RegraModal({ open, onClose, regraEditando, formData, setFormData, onSalvar, sdrs, cadencias, loading }) {
  const toggleSDR = (email) => {
    const list = formData.sdrs_atribuidos || [];
    setFormData({
      ...formData,
      sdrs_atribuidos: list.includes(email) ? list.filter((s) => s !== email) : [...list, email],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{
        background: "hsl(222 47% 5%)",
        border: "1px solid hsl(0 0% 100% / 0.08)",
        borderRadius: "20px",
        maxWidth: "680px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#fff", fontSize: "16px", fontWeight: 600 }}>
            {regraEditando ? "Editar Regra" : "Nova Regra de Distribuição"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSalvar} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Nome da Regra *</label>
            <input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Tráfego Pago - Distribuição Geral"
              required
              style={INPUT_STYLE}
              onFocus={(e) => { e.target.style.border = "2px solid hsl(199 89% 55% / 0.5)"; e.target.style.boxShadow = "0 0 0 4px hsl(199 89% 55% / 0.08)"; }}
              onBlur={(e) => { e.target.style.border = `1px solid ${BORDER}`; e.target.style.boxShadow = "none"; }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Tipo *</label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger style={{ ...INPUT_STYLE, display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0A1023", border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
                  <SelectItem value="origem">Por Origem</SelectItem>
                  <SelectItem value="campanha">Por Campanha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tipo === "origem" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Origem *</label>
                <Select value={formData.origem} onValueChange={(v) => setFormData({ ...formData, origem: v })}>
                  <SelectTrigger style={{ ...INPUT_STYLE, display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0A1023", border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
                    {["trafego_pago","meta_ads","google_ads","typeform","wordpress","indicacao","organico","evento","lista_fria"].map(o => (
                      <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Campanha *</label>
                <input
                  value={formData.campanha}
                  onChange={(e) => setFormData({ ...formData, campanha: e.target.value })}
                  placeholder="Ex: Black Friday 2024"
                  style={INPUT_STYLE}
                  onFocus={(e) => { e.target.style.border = "2px solid hsl(199 89% 55% / 0.5)"; e.target.style.boxShadow = "0 0 0 4px hsl(199 89% 55% / 0.08)"; }}
                  onBlur={(e) => { e.target.style.border = `1px solid ${BORDER}`; e.target.style.boxShadow = "none"; }}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Modo de Distribuição *</label>
            <Select value={formData.modo_distribuicao} onValueChange={(v) => setFormData({ ...formData, modo_distribuicao: v })}>
              <SelectTrigger style={{ ...INPUT_STYLE, display: "flex", alignItems: "center", cursor: "pointer" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: "#0A1023", border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
                <SelectItem value="fila">Fila (Round-robin) — distribui igualmente</SelectItem>
                <SelectItem value="especifico">Específico — vai para SDR(s) selecionado(s)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>
              SDRs Atribuídos * ({formData.sdrs_atribuidos?.length || 0} selecionado(s))
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-3 rounded-xl"
              style={{ background: "hsl(222 47% 5% / 0.8)", border: `1px solid ${BORDER}` }}>
              {sdrs.map((sdr) => {
                const checked = formData.sdrs_atribuidos?.includes(sdr.email);
                return (
                  <label key={sdr.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150"
                    style={{ background: checked ? ACCENT.sky.bg : "transparent", border: `1px solid ${checked ? ACCENT.sky.ring : "transparent"}` }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSDR(sdr.email)}
                      className="rounded" style={{ accentColor: "hsl(199 89% 55%)" }} />
                    <span className="text-xs font-medium truncate" style={{ color: checked ? ACCENT.sky.light : "hsl(220 15% 70%)" }}>
                      {resolveDisplayNameFromUser(sdr)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Cadência Automática</label>
              <Select value={formData.cadencia_id || "nenhuma"} onValueChange={(v) => setFormData({ ...formData, cadencia_id: v === "nenhuma" ? "" : v })}>
                <SelectTrigger style={{ ...INPUT_STYLE, display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent style={{ background: "#0A1023", border: `1px solid ${BORDER}`, borderRadius: "12px" }}>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  {cadencias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(220 15% 55%)" }}>Prioridade</label>
              <input
                type="number" min="1"
                value={formData.prioridade}
                onChange={(e) => setFormData({ ...formData, prioridade: parseInt(e.target.value) || 1 })}
                style={INPUT_STYLE}
                onFocus={(e) => { e.target.style.border = "2px solid hsl(199 89% 55% / 0.5)"; }}
                onBlur={(e) => { e.target.style.border = `1px solid ${BORDER}`; }}
              />
              <p className="text-xs" style={{ color: "hsl(220 15% 40%)" }}>Menor número = maior prioridade</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "hsl(0 0% 100% / 0.05)", border: `1px solid ${BORDER}`, color: "hsl(220 15% 55%)" }}>
              Cancelar
            </button>
            <motion.button
              type="submit"
              whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              disabled={!formData.nome || !formData.sdrs_atribuidos?.length || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(262 83% 60%))", boxShadow: "0 4px 14px -4px hsl(217 91% 60% / 0.6)" }}
            >
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {regraEditando ? "Atualizar" : "Criar"} Regra
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const ROLES_OPERACIONAIS = ["sdr", "closer", "social_seller", "cs", "supervisor", "gestor", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial"];

export default function DistribuicaoLeads() {
  const [modalAberto, setModalAberto] = useState(false);
  const [regraEditando, setRegraEditando] = useState(null);
  const [tabAtiva, setTabAtiva] = useState("Regras");
  const [formData, setFormData] = useState({
    nome: "", tipo: "origem", origem: "trafego_pago", campanha: "",
    modo_distribuicao: "fila", sdrs_atribuidos: [], closer_padrao: "",
    cadencia_id: "", prioridade: 1,
  });

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();
  const isTempoReal = tabAtiva === "Distribuição em Tempo Real";

  const { data: regras = [] } = useQuery({
    queryKey: ["regras-distribuicao", empresaId],
    queryFn: () => base44.entities.RegraDistribuicao.filter({ empresaId }, "-prioridade"),
    enabled: !!empresaId,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => base44.entities.Cadencia.filter({ empresaId, ativa: true }),
    enabled: !!empresaId,
  });

  // Queries para aba Tempo Real
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: leadsHoje = [] } = useQuery({
    queryKey: ["leads-hoje", empresaId, hoje],
    queryFn: () => base44.entities.Lead.filter({ empresaId }, "-created_date", 500),
    enabled: !!empresaId && isTempoReal,
  });

  const { data: atividadesHoje = [] } = useQuery({
    queryKey: ["atividades-hoje", empresaId, hoje],
    queryFn: async () => {
      const todas = await base44.entities.Atividade.filter({ empresaId }, "-created_date", 200);
      return todas.filter((a) => new Date(a.created_date).toISOString().slice(0, 10) >= hoje);
    },
    enabled: !!empresaId && isTempoReal,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos-ativos", empresaId],
    queryFn: () => base44.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }),
    enabled: !!empresaId && isTempoReal,
  });

  const sdrs = usuarios.filter((u) => ROLES_OPERACIONAIS.includes(u.role));

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.RegraDistribuicao.create({ ...data, empresaId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["regras-distribuicao", empresaId] }); toast.success("Regra criada!"); fecharModal(); },
  });
  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RegraDistribuicao.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["regras-distribuicao", empresaId] }); toast.success("Regra atualizada!"); fecharModal(); },
  });
  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.RegraDistribuicao.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["regras-distribuicao", empresaId] }); toast.success("Regra excluída!"); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, ativa }) => base44.entities.RegraDistribuicao.update(id, { ativa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["regras-distribuicao", empresaId] }),
  });

  const abrirModal = (regra = null) => {
    setRegraEditando(regra);
    setFormData(regra ? {
      nome: regra.nome, tipo: regra.tipo, origem: regra.origem || "trafego_pago",
      campanha: regra.campanha || "", modo_distribuicao: regra.modo_distribuicao,
      sdrs_atribuidos: regra.sdrs_atribuidos || [], closer_padrao: regra.closer_padrao || "",
      cadencia_id: regra.cadencia_id || "", prioridade: regra.prioridade || 1,
    } : { nome: "", tipo: "origem", origem: "trafego_pago", campanha: "", modo_distribuicao: "fila", sdrs_atribuidos: [], closer_padrao: "", cadencia_id: "", prioridade: 1 });
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setRegraEditando(null); };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (regraEditando) await atualizarMutation.mutateAsync({ id: regraEditando.id, data: formData });
    else await criarMutation.mutateAsync(formData);
  };

  const handleDelete = (regra) => {
    if (confirm("Deseja excluir esta regra?")) deletarMutation.mutate(regra.id);
  };

  const regrasAtivas = regras.filter((r) => r.ativa).length;
  const loading = criarMutation.isPending || atualizarMutation.isPending;
  const semSdrCount = leadsHoje.filter((l) => !l.sdr_responsavel).length;
  const operadoresAtivos = vinculos.filter((v) => ["sdr", "closer", "social_seller", "cs"].includes(v.papel) && v.status === "ativo").length;

  const HERO_STATS = [
    { label: "Regras Ativas", value: regrasAtivas, icon: GitBranch, accent: "sky" },
    { label: "Leads Hoje", value: leadsHoje.length || 0, icon: ArrowRightLeft, accent: "violet" },
    { label: "Operadores Ativos", value: operadoresAtivos || sdrs.length, icon: Users, accent: "emerald" },
    { label: "Sem SDR", value: semSdrCount, icon: Clock3, accent: "amber" },
  ];

  return (
    <div className="min-h-screen relative" style={{
      background: "hsl(222 47% 4%)",
      backgroundImage: "radial-gradient(circle at 50% 0%, hsl(199 89% 55% / 0.08), transparent 55%), radial-gradient(circle at 80% 60%, hsl(262 83% 60% / 0.06), transparent 50%)",
    }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-5">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold"
              style={{ background: "linear-gradient(135deg, #fff, hsl(220 20% 85%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.02em" }}>
              Distribuição Automática de Leads
            </h1>
            <p className="text-sm mt-1" style={{ color: "hsl(220 15% 55%)" }}>
              Configure regras inteligentes de distribuição por origem, campanha, equipe ou prioridade.
            </p>
          </div>
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => abrirModal()}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))", boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)", border: "1px solid hsl(0 0% 100% / 0.15)" }}>
            <Plus className="w-4 h-4" />
            Nova Regra
          </motion.button>
        </motion.div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {HERO_STATS.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
        </div>

        {/* Tabs */}
        <TabBar tabAtiva={tabAtiva} onTab={setTabAtiva} />

        {/* Content */}
        {isTempoReal ? (
          <PainelVisibilidadeSDR
            empresaId={empresaId}
            vinculos={vinculos}
            leads={leadsHoje}
            atividades={atividadesHoje}
          />
        ) : (
          <div className="grid grid-cols-12 gap-5">
            {/* Left Rail */}
            <div className="col-span-12 xl:col-span-3 flex flex-col gap-5">
              <DistribuicaoStatus regrasAtivas={regrasAtivas} />
              <QuickActionsCard onNovaRegra={() => abrirModal()} />
              <InsightsCard />
            </div>

            {/* Main Column */}
            <div className="col-span-12 xl:col-span-9">
              <RulesCard
                regras={regras}
                onNovaRegra={() => abrirModal()}
                onEdit={abrirModal}
                onDelete={handleDelete}
                onToggle={(r) => toggleMutation.mutate({ id: r.id, ativa: !r.ativa })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <RegraModal
        open={modalAberto}
        onClose={fecharModal}
        regraEditando={regraEditando}
        formData={formData}
        setFormData={setFormData}
        onSalvar={handleSalvar}
        sdrs={sdrs}
        cadencias={cadencias}
        loading={loading}
      />
    </div>
  );
}