import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { listarLeads } from "@/lib/services/leadService";
import {
  Plus, MoreVertical, Phone, MessageCircle, Mail, Search, Calendar,
  Trash2, Edit2, Copy, Users, CheckCircle2, TrendingUp, BarChart3,
  Video, FileText, DollarSign, Award, Instagram, Activity, Sparkles,
  PlusCircle, LayoutTemplate, Workflow, Zap, BrainCircuit,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import CadenciaModal from "@/components/crm/CadenciaModal";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/perfil/GlassCard";

// ── Design tokens ──────────────────────────────────────────────
const ACCENT = {
  sky:     { c: "hsl(199 89% 55%)", light: "hsl(199 89% 70%)", bg: "hsl(199 89% 55% / 0.12)", ring: "hsl(199 89% 55% / 0.30)" },
  violet:  { c: "hsl(262 83% 60%)", light: "hsl(262 83% 75%)", bg: "hsl(262 83% 60% / 0.12)", ring: "hsl(262 83% 60% / 0.30)" },
  emerald: { c: "hsl(160 84% 45%)", light: "hsl(160 84% 60%)", bg: "hsl(160 84% 45% / 0.12)", ring: "hsl(160 84% 45% / 0.30)" },
  amber:   { c: "hsl(38 92% 55%)",  light: "hsl(38 92% 60%)",  bg: "hsl(38 92% 55% / 0.12)",  ring: "hsl(38 92% 55% / 0.30)"  },
  rose:    { c: "hsl(0 72% 55%)",   light: "hsl(0 72% 72%)",   bg: "hsl(0 72% 55% / 0.12)",   ring: "hsl(0 72% 55% / 0.30)"   },
};

const tipoConfig = {
  ligacao:          { icon: Phone,        color: ACCENT.emerald },
  whatsapp:         { icon: MessageCircle, color: ACCENT.emerald },
  email:            { icon: Mail,          color: ACCENT.sky     },
  pesquisa:         { icon: Search,        color: ACCENT.violet  },
  realizar_reuniao: { icon: Video,         color: ACCENT.sky     },
  enviar_contrato:  { icon: FileText,      color: ACCENT.amber   },
  recebimento:      { icon: DollarSign,    color: ACCENT.emerald },
  case_sucesso:     { icon: Award,         color: ACCENT.amber   },
  instagram:        { icon: Instagram,     color: ACCENT.rose    },
};

function AccentBadge({ label, accent = "sky", pulse = false }) {
  const a = ACCENT[accent];
  return (
    <span className="relative inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: a.bg, border: `1px solid ${a.ring}`, color: a.light }}>
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: a.c, boxShadow: `0 0 6px ${a.c}`, animation: "pulse 2s infinite" }} />
      )}
      {label}
    </span>
  );
}

// ── Hero Stat Card ─────────────────────────────────────────────
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

// ── Tab Bar ────────────────────────────────────────────────────
const TABS = ["Cadências", "Execuções", "Templates", "Automação"];
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
            }}>
            {tab}
          </button>
        );
      })}
    </div>
  );
}

// ── Left Rail ──────────────────────────────────────────────────
function CadenciaStatusCard({ totalAtivas }) {
  const items = [
    { label: "Motor",     status: "Online",      accent: "emerald" },
    { label: "WhatsApp",  status: "Conectado",   accent: "sky"     },
    { label: "Execuções", status: `${totalAtivas} ativas`, accent: "violet" },
  ];
  return (
    <GlassCard glow="emerald">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: ACCENT.emerald.bg, border: `1px solid ${ACCENT.emerald.ring}` }}>
            <Activity className="w-4 h-4" style={{ color: ACCENT.emerald.light }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: "#fff" }}>Status da Automação</span>
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
  { label: "Nova Cadência", icon: PlusCircle,    gradient: "linear-gradient(135deg, hsl(199 89% 55% / 0.18), hsl(217 91% 60% / 0.10))", ring: "hsl(199 89% 55% / 0.35)", glow: "hsl(199 89% 55% / 0.5)", iconColor: "hsl(199 89% 70%)" },
  { label: "Templates",     icon: LayoutTemplate, gradient: "linear-gradient(135deg, hsl(262 83% 60% / 0.18), hsl(282 83% 60% / 0.10))", ring: "hsl(262 83% 60% / 0.35)", glow: "hsl(262 83% 60% / 0.5)", iconColor: "hsl(262 83% 75%)" },
  { label: "Automação",     icon: Workflow,       gradient: "linear-gradient(135deg, hsl(160 84% 45% / 0.18), hsl(174 72% 50% / 0.10))", ring: "hsl(160 84% 45% / 0.35)", glow: "hsl(160 84% 45% / 0.5)", iconColor: "hsl(160 84% 60%)" },
  { label: "Relatórios",    icon: BarChart3,      gradient: "linear-gradient(135deg, hsl(38 92% 55% / 0.18), hsl(20 90% 55% / 0.10))",  ring: "hsl(38 92% 55% / 0.35)",  glow: "hsl(38 92% 55% / 0.5)",  iconColor: "hsl(38 92% 60%)"  },
];

function QuickActionsCard({ onNovaCadencia }) {
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
                onClick={action.label === "Nova Cadência" ? onNovaCadencia : undefined}
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

function PerformanceInsightsCard() {
  return (
    <GlassCard glow="violet">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: ACCENT.violet.bg, border: `1px solid ${ACCENT.violet.ring}` }}>
              <BrainCircuit className="w-4 h-4" style={{ color: ACCENT.violet.light }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#fff" }}>Insights de Performance</span>
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
          <p className="text-sm font-semibold mb-1" style={{ color: "#fff" }}>Aguardando dados</p>
          <p className="text-xs leading-relaxed" style={{ color: "hsl(220 15% 55%)" }}>
            As recomendações inteligentes aparecerão conforme as cadências forem executadas.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

// ── Main Table ─────────────────────────────────────────────────
function EtapaIcons({ etapas }) {
  const visible = etapas?.slice(0, 6) || [];
  const extra = (etapas?.length || 0) - 6;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((etapa, i) => {
        const config = tipoConfig[etapa.tipo] || tipoConfig.ligacao;
        const Icon = config.icon;
        const a = config.color;
        return (
          <div key={i} className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            title={`Dia ${etapa.dia}`}
            style={{ background: a.bg, border: `1px solid ${a.ring}` }}>
            <Icon className="w-3 h-3" style={{ color: a.light }} />
          </div>
        );
      })}
      {extra > 0 && (
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: "hsl(0 0% 100% / 0.06)", color: "hsl(220 15% 55%)", border: "1px solid hsl(0 0% 100% / 0.08)" }}>
          +{extra}
        </span>
      )}
    </div>
  );
}

function CadenciaRow({ cadencia, index, stats, onEdit, onDelete, onDuplicar, onEstatisticas }) {
  const tipo = cadencia.tipo_cadencia === "sdr" ? { label: "SDR", accent: "sky" } : { label: "Closer", accent: "violet" };
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
      {/* Nome */}
      <td className="px-4 py-3.5" style={{ width: "40%" }}>
        <p className="text-sm font-semibold" style={{ color: "#fff" }}>{cadencia.nome}</p>
        {cadencia.descricao && (
          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "hsl(220 15% 55%)" }}>{cadencia.descricao}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: "hsl(220 15% 50%)" }}>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{stats.totalLeads}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{stats.reunioesRealizadas}</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{stats.vendasConcluidas}</span>
        </div>
      </td>
      {/* Tipo */}
      <td className="px-4 py-3.5" style={{ width: "10%" }}>
        <AccentBadge label={tipo.label} accent={tipo.accent} />
      </td>
      {/* Duração */}
      <td className="px-4 py-3.5 text-sm font-medium" style={{ color: "hsl(220 15% 75%)", width: "10%" }}>
        {cadencia.duracao_dias}d
      </td>
      {/* Etapas */}
      <td className="px-4 py-3.5" style={{ width: "20%" }}>
        <EtapaIcons etapas={cadencia.etapas} />
      </td>
      {/* Status */}
      <td className="px-4 py-3.5" style={{ width: "10%" }}>
        <AccentBadge label={cadencia.ativa ? "Ativa" : "Inativa"} accent={cadencia.ativa ? "emerald" : "rose"} pulse={cadencia.ativa} />
      </td>
      {/* Ações */}
      <td className="px-4 py-3.5" style={{ width: "10%" }}>
        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
            onClick={() => onEstatisticas(cadencia)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            style={{ background: ACCENT.sky.bg, border: `1px solid ${ACCENT.sky.ring}`, color: ACCENT.sky.light }}>
            <BarChart3 className="w-3.5 h-3.5" />
          </motion.button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
                className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: "hsl(0 0% 100% / 0.06)", border: "1px solid hsl(0 0% 100% / 0.10)", color: "hsl(220 15% 60%)" }}>
                <MoreVertical className="w-3.5 h-3.5" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end"
              style={{ background: "#0A1023", border: "1px solid hsl(0 0% 100% / 0.08)", borderRadius: "14px", minWidth: 150 }}>
              <DropdownMenuItem onClick={() => onEdit(cadencia)}
                className="gap-2 cursor-pointer rounded-xl mx-1 my-0.5 text-xs"
                style={{ color: ACCENT.sky.light }}>
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicar(cadencia)}
                className="gap-2 cursor-pointer rounded-xl mx-1 my-0.5 text-xs"
                style={{ color: ACCENT.violet.light }}>
                <Copy className="w-3.5 h-3.5" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(cadencia)}
                className="gap-2 cursor-pointer rounded-xl mx-1 my-0.5 text-xs"
                style={{ color: ACCENT.rose.light }}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </motion.tr>
  );
}

function CadenciasTableCard({ cadencias, leads, onNovaCadencia, onEdit, onDelete, onDuplicar, onEstatisticas }) {
  const calcularEstatisticas = (cadenciaId) => {
    const leadsNaCadencia = leads.filter(l => l.cadencia_id === cadenciaId);
    return {
      totalLeads: leadsNaCadencia.length,
      reunioesRealizadas: leadsNaCadencia.filter(l => l.status === "reuniao_realizada").length,
      vendasConcluidas: leadsNaCadencia.filter(l => l.status === "qualificado").length,
      leads: leadsNaCadencia,
    };
  };

  return (
    <GlassCard glow="sky" hover={false}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: ACCENT.sky.bg, border: `1px solid ${ACCENT.sky.ring}` }}>
              <Workflow className="w-4 h-4" style={{ color: ACCENT.sky.light }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fff" }}>Cadências Automatizadas</p>
              <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>Sequências de contato inteligentes para SDRs e Closers</p>
            </div>
          </div>
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onNovaCadencia}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))",
              boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
              border: "1px solid hsl(0 0% 100% / 0.15)",
            }}>
            <Plus className="w-4 h-4" />
            Nova Cadência
          </motion.button>
        </div>

        {cadencias.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center py-20 px-6" style={{ minHeight: "380px" }}>
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
                fontSize: "26px",
                background: "linear-gradient(135deg, #fff, hsl(220 20% 85%))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
              Nenhuma cadência criada
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "hsl(220 15% 75%)", maxWidth: "480px" }}>
              Crie sequências automáticas de contato para maximizar a conversão dos seus leads.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {[{ label: "SDR", accent: "sky" }, { label: "Closer", accent: "violet" }, { label: "WhatsApp", accent: "emerald" }, { label: "E-mail", accent: "amber" }]
                .map(b => <AccentBadge key={b.label} label={b.label} accent={b.accent} />)}
            </div>
            <motion.button
              whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={onNovaCadencia}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))",
                boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
              }}>
              <Plus className="w-4 h-4" />
              Criar Primeira Cadência
            </motion.button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 100% / 0.06)" }}>
                  {["Nome", "Tipo", "Duração", "Etapas", "Status", "Ações"].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ color: "hsl(220 15% 45%)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cadencias.map((cadencia, i) => (
                  <CadenciaRow
                    key={cadencia.id}
                    cadencia={cadencia}
                    index={i}
                    stats={calcularEstatisticas(cadencia.id)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicar={onDuplicar}
                    onEstatisticas={onEstatisticas}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ── Stats Modal ────────────────────────────────────────────────
function EstatisticasModal({ cadencia, leads, open, onClose }) {
  if (!cadencia) return null;
  const leadsNaCadencia = leads.filter(l => l.cadencia_id === cadencia.id);
  const reunioesRealizadas = leadsNaCadencia.filter(l => l.status === "reuniao_realizada").length;
  const vendasConcluidas = leadsNaCadencia.filter(l => l.status === "qualificado").length;

  const statsCards = [
    { label: "Leads na Cadência", value: leadsNaCadencia.length, icon: Users, accent: "sky" },
    { label: "Reuniões Realizadas", value: reunioesRealizadas, icon: Calendar, accent: "violet" },
    { label: "Vendas Concluídas", value: vendasConcluidas, icon: TrendingUp, accent: "emerald" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{
        background: "hsl(222 47% 5%)",
        border: "1px solid hsl(0 0% 100% / 0.08)",
        borderRadius: "20px",
        maxWidth: "760px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#fff", fontSize: "16px" }}>
            <BarChart3 className="w-5 h-5" style={{ color: ACCENT.sky.light }} />
            Estatísticas: {cadencia.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-3 gap-3">
            {statsCards.map((s) => {
              const a = ACCENT[s.accent];
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-2xl p-4"
                  style={{ background: "hsl(222 47% 7% / 0.6)", border: "1px solid hsl(0 0% 100% / 0.06)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>{s.label}</p>
                      <p className="text-3xl font-bold mt-1" style={{ color: "#fff" }}>{s.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: a.bg, border: `1px solid ${a.ring}` }}>
                      <Icon className="w-5 h-5" style={{ color: a.light }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "#fff" }}>Leads nesta cadência</h3>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(0 0% 100% / 0.06)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "hsl(222 47% 8% / 0.85)", borderBottom: "1px solid hsl(0 0% 100% / 0.06)" }}>
                    {["Nome", "Empresa", "Status", "Dia"].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                        style={{ color: "hsl(220 15% 45%)" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leadsNaCadencia.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-sm" style={{ color: "hsl(220 15% 55%)" }}>Nenhum lead nesta cadência ainda</td></tr>
                  ) : leadsNaCadencia.map((lead, i) => (
                    <tr key={lead.id} style={{ borderBottom: "1px solid hsl(0 0% 100% / 0.04)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "hsl(0 0% 100% / 0.03)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#fff" }}>{lead.nome}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "hsl(220 15% 65%)" }}>{lead.empresa || "—"}</td>
                      <td className="px-4 py-3"><AccentBadge label={lead.status} accent="sky" /></td>
                      <td className="px-4 py-3 text-sm" style={{ color: "hsl(220 15% 65%)" }}>Dia {lead.dia_cadencia || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function Cadencias() {
  const [modalAberto, setModalAberto] = useState(false);
  const [cadenciaEditando, setCadenciaEditando] = useState(null);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [estatisticasModal, setEstatisticasModal] = useState(null);
  const [tabAtiva, setTabAtiva] = useState("Cadências");

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: cadencias = [], isLoading } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId, { apenasAtivas: false }),
    enabled: !!empresaId,
  });
  const { data: scripts = [] } = useQuery({
    queryKey: ["scripts", empresaId],
    queryFn: () => empresaId ? api.entities.Script.filter({ empresaId }) : [],
    enabled: !!empresaId,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads", empresaId],
    queryFn: () => listarLeads(empresaId),
    enabled: !!empresaId,
  });

  const criarMutation = useMutation({
    mutationFn: (data) => api.entities.Cadencia.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cadencias"] }); toast.success("Cadência criada!"); },
  });
  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Cadencia.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cadencias"] }); toast.success("Cadência atualizada!"); },
  });
  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.Cadencia.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cadencias"] }); toast.success("Cadência excluída!"); },
  });

  const handleSalvar = async (dados) => {
    if (cadenciaEditando) await atualizarMutation.mutateAsync({ id: cadenciaEditando.id, data: dados });
    else await criarMutation.mutateAsync({ ...dados, empresaId });
  };

  const handleDuplicar = async (cadencia) => {
    await criarMutation.mutateAsync({
      empresaId, nome: `${cadencia.nome} (cópia)`, descricao: cadencia.descricao,
      tipo_cadencia: cadencia.tipo_cadencia || "sdr", duracao_dias: cadencia.duracao_dias,
      etapas: cadencia.etapas, ativa: true,
    });
  };

  const handleEdit = (cadencia) => { setCadenciaEditando(cadencia); setModalAberto(true); };
  const handleDelete = (cadencia) => {
    if (confirm("Deseja excluir esta cadência?")) deletarMutation.mutate(cadencia.id);
  };

  const cadenciasFiltradas = cadencias.filter(c => {
    const s = statusFiltro === "todos" || (statusFiltro === "ativas" && c.ativa) || (statusFiltro === "inativas" && !c.ativa);
    const t = tipoFiltro === "todos" || c.tipo_cadencia === tipoFiltro;
    return s && t;
  });

  const totalAtivas = cadencias.filter(c => c.ativa).length;
  const totalLeadsAtivos = leads.filter(l => l.cadencia_id && cadencias.some(c => c.id === l.cadencia_id && c.ativa)).length;

  const HERO_STATS = [
    { label: "Cadências Ativas",     value: totalAtivas,       icon: Activity,   accent: "emerald" },
    { label: "Contatos em Execução", value: totalLeadsAtivos,  icon: Users,      accent: "sky"     },
    { label: "Taxa de Conversão",    value: "0%",              icon: TrendingUp, accent: "violet"  },
    { label: "Execuções Hoje",       value: 0,                 icon: Zap,        accent: "amber"   },
  ];

  const FILTER_SELECT_STYLE = {
    height: 38,
    padding: "0 12px",
    fontSize: "13px",
    borderRadius: "12px",
    background: "hsl(222 47% 7% / 0.7)",
    border: "1px solid hsl(0 0% 100% / 0.08)",
    color: "#fff",
    backdropFilter: "blur(16px)",
    cursor: "pointer",
  };

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
              Cadências
            </h1>
            <p className="text-sm mt-1" style={{ color: "hsl(220 15% 55%)" }}>
              Configure sequências inteligentes de contato automatizadas.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            {/* Tipo filter */}
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger style={{ ...FILTER_SELECT_STYLE, width: 160 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: "#0A1023", border: "1px solid hsl(0 0% 100% / 0.08)", borderRadius: "12px" }}>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="sdr">SDR</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger style={{ ...FILTER_SELECT_STYLE, width: 160 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: "#0A1023", border: "1px solid hsl(0 0% 100% / 0.08)", borderRadius: "12px" }}>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativas">Ativas</SelectItem>
                <SelectItem value="inativas">Inativas</SelectItem>
              </SelectContent>
            </Select>

            <motion.button
              whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setCadenciaEditando(null); setModalAberto(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))",
                boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
                border: "1px solid hsl(0 0% 100% / 0.15)",
              }}>
              <Plus className="w-4 h-4" />
              Nova Cadência
            </motion.button>
          </div>
        </motion.div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {HERO_STATS.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
        </div>

        {/* Tabs */}
        <TabBar tabAtiva={tabAtiva} onTab={setTabAtiva} />

        {/* Grid */}
        <div className="grid grid-cols-12 gap-5">
          {/* Left Rail */}
          <div className="col-span-12 xl:col-span-3 flex flex-col gap-5">
            <CadenciaStatusCard totalAtivas={totalAtivas} />
            <QuickActionsCard onNovaCadencia={() => { setCadenciaEditando(null); setModalAberto(true); }} />
            <PerformanceInsightsCard />
          </div>

          {/* Main Column */}
          <div className="col-span-12 xl:col-span-9">
            <CadenciasTableCard
              cadencias={cadenciasFiltradas}
              leads={leads}
              onNovaCadencia={() => { setCadenciaEditando(null); setModalAberto(true); }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicar={handleDuplicar}
              onEstatisticas={setEstatisticasModal}
            />
          </div>
        </div>
      </div>

      {/* Modal Edição */}
      <CadenciaModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setCadenciaEditando(null); }}
        cadencia={cadenciaEditando}
        onSave={handleSalvar}
        scripts={scripts}
      />

      {/* Modal Estatísticas */}
      <EstatisticasModal
        open={!!estatisticasModal}
        onClose={() => setEstatisticasModal(null)}
        cadencia={estatisticasModal}
        leads={leads}
      />
    </div>
  );
}