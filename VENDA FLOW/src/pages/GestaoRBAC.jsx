import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Shield, Users, FileCheck, Clock, Search,
  CheckCircle2, XCircle, AlertCircle, Edit, Trash2,
  UserPlus, Activity, ShieldCheck, MoreVertical,
  Lock, Unlock,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import ConviteUsuarioModal from "@/components/empresa/ConviteUsuarioModal";
import { ptBR } from "date-fns/locale";
import { SYSTEM_ROLES } from "@/components/lib/systemRoles";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Design tokens ────────────────────────────────────────────
const BG = "#050816";
const GLASS = "rgba(15,23,42,0.62)";
const BORDER = "rgba(255,255,255,0.08)";

function GlassCard({ children, className = "", hover = false, style = {} }) {
  return (
    <motion.div
      whileHover={hover ? { y: -3 } : {}}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn("rounded-3xl border backdrop-blur-2xl", className)}
      style={{
        background: GLASS,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 10px 40px rgba(0,0,0,0.45)",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

const ROLE_BADGE = {
  super_admin: { bg: "rgba(244,63,94,0.14)", border: "rgba(244,63,94,0.24)", text: "#FDA4AF", label: "Super Admin" },
  admin: { bg: "rgba(244,63,94,0.14)", border: "rgba(244,63,94,0.24)", text: "#FDA4AF", label: "Admin" },
  gestor_empresa: { bg: "rgba(244,63,94,0.14)", border: "rgba(244,63,94,0.24)", text: "#FDA4AF", label: "Gestor Empresa" },
  gerente_empresa: { bg: "rgba(96,165,250,0.14)", border: "rgba(96,165,250,0.24)", text: "#93C5FD", label: "Gerente" },
  gerente_filial: { bg: "rgba(99,102,241,0.14)", border: "rgba(99,102,241,0.24)", text: "#A5B4FC", label: "Ger. Filial" },
  supervisor: { bg: "rgba(249,115,22,0.14)", border: "rgba(249,115,22,0.24)", text: "#FDBA74", label: "Supervisor" },
  marketing: { bg: "rgba(234,179,8,0.14)", border: "rgba(234,179,8,0.24)", text: "#FDE047", label: "Marketing" },
  gestor: { bg: "rgba(96,165,250,0.14)", border: "rgba(96,165,250,0.24)", text: "#93C5FD", label: "Gestor" },
  sdr: { bg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.24)", text: "#6EE7B7", label: "SDR" },
  closer: { bg: "rgba(168,85,247,0.14)", border: "rgba(168,85,247,0.24)", text: "#D8B4FE", label: "Closer" },
  cs: { bg: "rgba(20,184,166,0.14)", border: "rgba(20,184,166,0.24)", text: "#5EEAD4", label: "CS" },
  social_seller: { bg: "rgba(236,72,153,0.14)", border: "rgba(236,72,153,0.24)", text: "#F9A8D4", label: "Social Seller" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_BADGE[role] || { bg: "rgba(100,116,139,0.14)", border: "rgba(100,116,139,0.24)", text: "#94A3B8", label: role };
  return (
    <span
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

const TABS = [
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "solicitacoes", label: "Solicitações", icon: Clock },
  { key: "logs", label: "Logs", icon: FileCheck },
];

export default function GestaoRBAC() {
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState("todos");
  const [perfilEditando, setPerfilEditando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [conviteModalOpen, setConviteModalOpen] = useState(false);
  const [modalBloquearAberto, setModalBloquearAberto] = useState(false);
  const [perfilParaBloquear, setPerfilParaBloquear] = useState(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [perfilParaExcluir, setPerfilParaExcluir] = useState(null);
  const [tabAtiva, setTabAtiva] = useState("usuarios");
  const [sincronizando, setSincronizando] = useState(false);

  const queryClient = useQueryClient();
  const { empresaId: empresaIdAtual } = useEmpresaAtual();
  const empresaId = empresaIdAtual;

  const { data: perfis = [] } = useQuery({
    queryKey: ["userProfiles", empresaId],
    queryFn: () => base44.entities.UserProfile.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => base44.entities.VinculoEmpresa.filter({ empresaId }),
    enabled: !!empresaId,
  });



  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["permissionRequests", empresaId],
    queryFn: () => base44.entities.PermissionChangeRequest.filter({ empresaId }, "-created_date"),
    enabled: !!empresaId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["rbacLogs", empresaId],
    queryFn: () => base44.entities.RBACLog.filter({ empresaId }, "-created_date", 100),
    enabled: !!empresaId,
  });

  const atualizarPerfilMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserProfile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfiles", empresaId] });
      toast.success("Perfil atualizado!");
      setModalAberto(false);
    },
  });

  const processarSolicitacaoMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('processPermissionRequest', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissionRequests", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["userProfiles", empresaId] });
      toast.success("Solicitação processada!");
    },
  });

  const excluirPerfilMutation = useMutation({
    mutationFn: async ({ user_email, empresaId: empId }) => {
      await base44.functions.invoke('excluirUsuarioCompleto', { user_email });
      const vincs = await base44.entities.VinculoEmpresa.filter({ userEmail: user_email, empresaId: empId });
      await Promise.all(vincs.map(v => base44.entities.VinculoEmpresa.delete(v.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfiles", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["vinculos", empresaId] });
      toast.success("Usuário excluído com sucesso!");
      setModalExcluirAberto(false);
      setPerfilParaExcluir(null);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const bloquearUsuarioMutation = useMutation({
    mutationFn: ({ id, bloqueado }) => base44.entities.UserProfile.update(id, { bloqueado }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["userProfiles", empresaId] });
      toast.success(vars.bloqueado ? "Usuário bloqueado com sucesso!" : "Usuário desbloqueado!");
      setModalBloquearAberto(false);
      setPerfilParaBloquear(null);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const perfisFiltrados = perfis.filter(p => {
    const matchBusca = !busca ||
      p.user_name?.toLowerCase().includes(busca.toLowerCase()) ||
      p.user_email?.toLowerCase().includes(busca.toLowerCase());
    const matchRole = filtroRole === "todos" || p.role === filtroRole;
    return matchBusca && matchRole;
  });

  const solicitacoesPendentes = solicitacoes.filter(s => s.status === "pending");
  const logsHoje = logs.filter(l => new Date(l.created_date).toDateString() === new Date().toDateString());

  const handleEditarPerfil = (perfil) => { setPerfilEditando(perfil); setModalAberto(true); };

  const handleSalvarPerfil = () => {
    if (!perfilEditando) return;
    atualizarPerfilMutation.mutate({ id: perfilEditando.id, data: { role: perfilEditando.role, permissions: perfilEditando.permissions } });
  };

  const handleAprovar = (s) => processarSolicitacaoMutation.mutate({ request_id: s.id, action: "approved" });

  const handleRejeitar = (s) => {
    const motivo = prompt("Motivo da rejeição:");
    if (!motivo) return;
    processarSolicitacaoMutation.mutate({ request_id: s.id, action: "rejected", rejection_reason: motivo });
  };

  const handleExcluirUsuario = (perfil) => {
    if (perfil.role === "admin") { toast.error("Não é possível excluir um administrador"); return; }
    setPerfilParaExcluir(perfil);
    setModalExcluirAberto(true);
  };

  const handleConfirmarExcluir = () => {
    if (!perfilParaExcluir) return;
    excluirPerfilMutation.mutate({ user_email: perfilParaExcluir.user_email, empresaId });
  };

  const handleAbrirBloquear = (perfil) => {
    setPerfilParaBloquear(perfil);
    setModalBloquearAberto(true);
  };

  const handleConfirmarBloquear = () => {
    if (!perfilParaBloquear) return;
    const jaBloqueado = perfilParaBloquear.bloqueado;
    bloquearUsuarioMutation.mutate({ id: perfilParaBloquear.id, bloqueado: !jaBloqueado });
  };

  const STATS = [
    { label: "Total de Usuários", value: perfis.length, icon: Users, gradient: "linear-gradient(135deg,#38BDF8,#2563EB)", glow: "rgba(56,189,248,0.22)" },
    { label: "Solicitações Pendentes", value: solicitacoesPendentes.length, icon: Clock, gradient: "linear-gradient(135deg,#F59E0B,#FBBF24)", glow: "rgba(245,158,11,0.22)" },
    { label: "Administradores", value: perfis.filter(p => p.role === "admin").length, icon: Shield, gradient: "linear-gradient(135deg,#FB7185,#A855F7)", glow: "rgba(168,85,247,0.22)" },
    { label: "Logs Hoje", value: logsHoje.length, icon: FileCheck, gradient: "linear-gradient(135deg,#10B981,#34D399)", glow: "rgba(16,185,129,0.22)" },
  ];

  if (!empresaId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <GlassCard className="p-8 max-w-md w-full mx-4 text-center">
          <Shield className="w-10 h-10 mx-auto mb-4 text-sky-400" />
          <p className="text-white font-semibold text-lg mb-2">Empresa não selecionada</p>
          <p className="text-slate-400 text-sm">Selecione uma empresa no menu lateral para gerenciar permissões.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: BG }}>
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)" }} />
        <div className="absolute -top-20 -right-40 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#38BDF8,#A855F7)", boxShadow: "0 0 28px rgba(99,102,241,0.4)" }}
            >
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#F8FAFC" }}>Gestão de Permissões (RBAC)</h1>
              <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>Controle de acessos e solicitações de permissões</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              disabled={sincronizando}
              onClick={async () => {
                setSincronizando(true);
                try {
                  const res = await base44.functions.invoke('sincronizarNomesVinculos', { empresaId });
                  const data = res?.data;
                  toast.success(data?.mensagem || 'Nomes sincronizados!');
                  queryClient.invalidateQueries({ queryKey: ["vinculos", empresaId] });
                } catch (e) {
                  toast.error('Erro ao sincronizar: ' + e.message);
                } finally {
                  setSincronizando(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold flex-shrink-0 disabled:opacity-60"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)", color: "#6EE7B7" }}
            >
              {sincronizando
                ? <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                : <Activity className="w-4 h-4" />
              }
              Sincronizar Nomes
            </motion.button>

            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setConviteModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)", boxShadow: "0 0 24px rgba(99,102,241,0.45)" }}
            >
              <UserPlus className="w-4 h-4" />
              Convidar Usuário
            </motion.button>
          </div>
        </motion.div>

        {/* ── STATS ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.22 }}
                className="rounded-[22px] p-5 flex items-center gap-4 border backdrop-blur-2xl"
                style={{
                  background: GLASS,
                  border: `1px solid ${BORDER}`,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)`,
                  minHeight: 100,
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.gradient, boxShadow: `0 0 20px ${s.glow}` }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "#64748B" }}>{s.label}</p>
                  <p className="text-3xl font-bold mt-0.5" style={{ color: "#F8FAFC" }}>{s.value}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── TABS ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.14 }}
        >
          {/* Tab nav */}
          <div
            className="flex gap-1 p-1.5 rounded-2xl mb-5 w-fit"
            style={{ background: "rgba(15,23,42,0.55)", border: `1px solid ${BORDER}` }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tabAtiva === tab.key;
              const badge = tab.key === "solicitacoes" ? solicitacoesPendentes.length : tab.key === "logs" ? logsHoje.length : 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setTabAtiva(tab.key)}
                  className="flex items-center gap-2 px-4 text-sm font-semibold transition-all duration-200 rounded-xl"
                  style={{
                    height: 44,
                    color: active ? "#FFFFFF" : "#94A3B8",
                    background: active ? "linear-gradient(135deg,rgba(37,99,235,0.28),rgba(124,58,237,0.28))" : "transparent",
                    border: active ? "1px solid rgba(96,165,250,0.35)" : "1px solid transparent",
                    boxShadow: active ? "0 0 18px rgba(59,130,246,0.35)" : "none",
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {badge > 0 && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.12)", color: "#E2E8F0" }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── TAB: USUÁRIOS ─────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {tabAtiva === "usuarios" && (
              <motion.div
                key="usuarios"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                {/* Search + filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#60A5FA" }} />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar usuário por nome ou email..."
                      className="w-full pl-11 pr-4 text-sm outline-none transition-all duration-200"
                      style={{
                        height: 52,
                        background: "rgba(15,23,42,0.72)",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 18,
                        color: "#E2E8F0",
                      }}
                      onFocus={e => {
                        e.target.style.border = "1px solid rgba(96,165,250,0.55)";
                        e.target.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.12), 0 0 24px rgba(59,130,246,0.2)";
                      }}
                      onBlur={e => {
                        e.target.style.border = `1px solid ${BORDER}`;
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                  <select
                    value={filtroRole}
                    onChange={(e) => setFiltroRole(e.target.value)}
                    className="px-4 text-sm font-medium outline-none cursor-pointer"
                    style={{
                      height: 52,
                      background: "rgba(15,23,42,0.68)",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 16,
                      color: "#E2E8F0",
                      minWidth: 160,
                    }}
                  >
                    <option value="todos">Todas as Roles</option>
                    <option value="admin">Administrador</option>
                    <option value="gestor_empresa">Gestor da Empresa</option>
                    <option value="gerente_empresa">Gerente</option>
                    <option value="gerente_filial">Gerente de Filial</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="marketing">Marketing</option>
                    <option value="gestor">Gestor (legado)</option>
                    <option value="sdr">SDR</option>
                    <option value="closer">Closer</option>
                    <option value="cs">Customer Success</option>
                    <option value="social_seller">Social Seller</option>
                  </select>
                </div>

                {/* User cards */}
                <div className="space-y-3">
                  {perfisFiltrados.length === 0 ? (
                    <GlassCard className="py-16 text-center">
                      <Users className="w-14 h-14 mx-auto mb-4" style={{ color: "#60A5FA", filter: "drop-shadow(0 0 24px rgba(59,130,246,0.4))" }} />
                      <p className="text-lg font-semibold" style={{ color: "#F8FAFC" }}>Nenhum usuário encontrado</p>
                      <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>Tente ajustar os filtros de busca</p>
                    </GlassCard>
                  ) : perfisFiltrados.map((perfil, i) => {
                    return (
                      <motion.div
                        key={perfil.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -3 }}
                        className="rounded-3xl border backdrop-blur-2xl transition-all duration-200 cursor-default"
                        style={{
                          background: perfil.bloqueado
                            ? "linear-gradient(180deg,rgba(30,10,10,0.92),rgba(20,5,5,0.95))"
                            : "linear-gradient(180deg,rgba(15,23,42,0.88),rgba(10,15,30,0.92))",
                          border: perfil.bloqueado
                            ? "1px solid rgba(244,63,94,0.35)"
                            : "1px solid rgba(255,255,255,0.06)",
                          boxShadow: perfil.bloqueado
                            ? "inset 0 0 32px rgba(244,63,94,0.12), 0 0 24px rgba(244,63,94,0.10)"
                            : "none",
                          padding: 20,
                          minHeight: 96,
                        }}
                        onMouseEnter={e => {
                          if (!perfil.bloqueado) {
                            e.currentTarget.style.border = "1px solid rgba(96,165,250,0.22)";
                            e.currentTarget.style.boxShadow = "0 0 32px rgba(37,99,235,0.14), 0 0 12px rgba(168,85,247,0.08)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!perfil.bloqueado) {
                            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
                            e.currentTarget.style.boxShadow = "none";
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div
                              className="w-[54px] h-[54px] rounded-2xl flex items-center justify-center flex-shrink-0"
                              style={{
                                background: "linear-gradient(135deg,#0F172A,#1E293B)",
                                border: "1px solid rgba(96,165,250,0.25)",
                              }}
                            >
                              <Users className="w-5 h-5" style={{ color: "#60A5FA" }} />
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-[18px] leading-tight truncate" style={{ color: "#F8FAFC" }}>
                                {perfil.user_name || perfil.user_email}
                              </p>
                              <p className="text-sm mt-0.5 truncate" style={{ color: "#94A3B8" }}>{perfil.user_email}</p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <RoleBadge role={perfil.role} />
                                {perfil.bloqueado && (
                                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                                    style={{ background: "rgba(244,63,94,0.18)", border: "1px solid rgba(244,63,94,0.35)", color: "#FB7185" }}>
                                    <Lock className="w-3 h-3" /> Bloqueado
                                  </span>
                                )}
                                {!perfil.is_active && (
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(100,116,139,0.15)", border: "1px solid rgba(100,116,139,0.25)", color: "#64748B" }}>
                                    Inativo
                                  </span>
                                )}

                              </div>
                            </div>
                          </div>

                          {/* 3-dot dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.94 }}
                                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: "#94A3B8" }}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </motion.button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl" style={{ background: "#0A1023", border: `1px solid ${BORDER}`, minWidth: 160 }}>
                              <DropdownMenuItem
                                onClick={() => handleEditarPerfil(perfil)}
                                className="gap-2 cursor-pointer rounded-xl mx-1 my-0.5"
                                style={{ color: "#93C5FD" }}
                              >
                                <Edit className="w-3.5 h-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAbrirBloquear(perfil)}
                                className="gap-2 cursor-pointer rounded-xl mx-1 my-0.5"
                                style={{ color: perfil.bloqueado ? "#6EE7B7" : "#FCA5A5" }}
                              >
                                {perfil.bloqueado ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                {perfil.bloqueado ? "Desbloquear" : "Bloquear"}
                              </DropdownMenuItem>
                              {perfil.role !== "admin" && (
                                <>
                                  <DropdownMenuSeparator style={{ background: BORDER }} />
                                  <DropdownMenuItem
                                    onClick={() => handleExcluirUsuario(perfil)}
                                    className="gap-2 cursor-pointer rounded-xl mx-1 my-0.5"
                                    style={{ color: "#FDA4AF" }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── TAB: SOLICITAÇÕES ─────────────────────────── */}
            {tabAtiva === "solicitacoes" && (
              <motion.div
                key="solicitacoes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-3"
              >
                {solicitacoes.length === 0 ? (
                  <GlassCard className="py-16 text-center">
                    <FileCheck className="w-14 h-14 mx-auto mb-4" style={{ color: "#60A5FA", filter: "drop-shadow(0 0 24px rgba(59,130,246,0.4))" }} />
                    <p className="text-lg font-semibold" style={{ color: "#F8FAFC" }}>Nenhuma solicitação</p>
                    <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>Todas as solicitações foram processadas.</p>
                  </GlassCard>
                ) : solicitacoes.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-3xl border backdrop-blur-2xl p-5"
                    style={{ background: GLASS, border: `1px solid ${BORDER}` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold" style={{ color: "#F8FAFC" }}>{s.requester_name}</p>
                          <span className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-semibold",
                            s.status === "pending" ? "bg-amber-500/15 text-amber-300 border border-amber-500/25" :
                            s.status === "approved" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" :
                            "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                          )}>
                            {s.status === "pending" ? "Pendente" : s.status === "approved" ? "Aprovado" : "Rejeitado"}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#94A3B8", border: `1px solid ${BORDER}` }}>
                            {s.request_type}
                          </span>
                        </div>
                        <p className="text-sm mb-1" style={{ color: "#64748B" }}>{s.requester_email}</p>
                        <p className="text-sm" style={{ color: "#CBD5E1" }}>
                          <span style={{ color: "#64748B" }}>Solicitação: </span>
                          {s.requested_page || s.requested_feature || s.requested_role}
                        </p>
                        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
                          <span style={{ color: "#64748B" }}>Justificativa: </span>{s.justification}
                        </p>
                        {s.reviewed_by && (
                          <p className="text-xs mt-2" style={{ color: "#475569" }}>
                            Revisado por {s.reviewed_by} em {format(new Date(s.reviewed_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                      {s.status === "pending" && (
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleAprovar(s)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-white"
                            style={{ background: "linear-gradient(135deg,#059669,#10B981)", boxShadow: "0 0 16px rgba(16,185,129,0.3)" }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aprovar
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleRejeitar(s)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold"
                            style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.24)", color: "#FDA4AF" }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rejeitar
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* ── TAB: LOGS ─────────────────────────────────── */}
            {tabAtiva === "logs" && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-2"
              >
                {logs.length === 0 ? (
                  <GlassCard className="py-16 text-center">
                    <Activity className="w-14 h-14 mx-auto mb-4" style={{ color: "#60A5FA", filter: "drop-shadow(0 0 24px rgba(59,130,246,0.4))" }} />
                    <p className="text-lg font-semibold" style={{ color: "#F8FAFC" }}>Sem logs registrados</p>
                  </GlassCard>
                ) : logs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-start justify-between gap-4 rounded-2xl px-4 py-3 border backdrop-blur-xl"
                    style={{ background: "rgba(15,23,42,0.5)", border: `1px solid ${BORDER}` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.18)" }}>
                        <AlertCircle className="w-3.5 h-3.5" style={{ color: "#60A5FA" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{log.action_type}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                          Por <span style={{ color: "#94A3B8" }}>{log.performed_by}</span>
                          {log.user_email && <> → <span style={{ color: "#93C5FD" }}>{log.user_email}</span></>}
                        </p>
                        {log.page && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: "rgba(255,255,255,0.05)", color: "#64748B", border: `1px solid ${BORDER}` }}>
                            {log.page}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] flex-shrink-0" style={{ color: "#475569" }}>
                      {format(new Date(log.created_date), "dd/MM HH:mm")}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── MODAL EDITAR ────────────────────────────────────── */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent style={{ background: "#0A1023", border: `1px solid ${BORDER}`, borderRadius: 24 }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#F8FAFC" }}>Editar Perfil</DialogTitle>
          </DialogHeader>
          {perfilEditando && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-2xl" style={{ background: "rgba(15,23,42,0.8)", border: `1px solid ${BORDER}` }}>
                <p className="font-semibold" style={{ color: "#F8FAFC" }}>{perfilEditando.user_name}</p>
                <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>{perfilEditando.user_email}</p>
              </div>
              <div className="space-y-2">
                <Label style={{ color: "#94A3B8", fontSize: 12 }}>Role</Label>
                <Select value={perfilEditando.role} onValueChange={(v) => setPerfilEditando({ ...perfilEditando, role: v })}>
                  <SelectTrigger style={{ background: "rgba(15,23,42,0.8)", border: `1px solid ${BORDER}`, color: "#E2E8F0", borderRadius: 12 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0A1023", border: `1px solid ${BORDER}` }}>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gestor_empresa">Gestor da Empresa</SelectItem>
                    <SelectItem value="gerente_empresa">Gerente</SelectItem>
                    <SelectItem value="gerente_filial">Gerente de Filial</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="gestor">Gestor (legado)</SelectItem>
                    <SelectItem value="sdr">SDR</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="cs">Customer Success</SelectItem>
                    <SelectItem value="social_seller">Social Seller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setModalAberto(false)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8", border: `1px solid ${BORDER}` }}>
                  Cancelar
                </button>
                <button onClick={handleSalvarPerfil} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>
                  Salvar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL BLOQUEAR ───────────────────────────────────── */}
      <Dialog open={modalBloquearAberto} onOpenChange={setModalBloquearAberto}>
        <DialogContent style={{ background: "#0A1023", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 24 }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#F8FAFC" }}>
              {perfilParaBloquear?.bloqueado ? "Desbloquear Usuário" : "Bloquear Usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="p-4 rounded-2xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)" }}>
              <p className="text-sm font-medium" style={{ color: "#FDA4AF" }}>
                {perfilParaBloquear?.bloqueado
                  ? `Você deseja realmente desbloquear o acesso de ${perfilParaBloquear?.user_name || perfilParaBloquear?.user_email}?`
                  : `Você deseja realmente bloquear este usuário?`}
              </p>
              {!perfilParaBloquear?.bloqueado && (
                <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
                  <strong style={{ color: "#F8FAFC" }}>{perfilParaBloquear?.user_name || perfilParaBloquear?.user_email}</strong> não conseguirá fazer login no CRM enquanto estiver bloqueado.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setModalBloquearAberto(false); setPerfilParaBloquear(null); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8", border: `1px solid ${BORDER}` }}
              >
                Não
              </button>
              <button
                onClick={handleConfirmarBloquear}
                disabled={bloquearUsuarioMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{
                  background: perfilParaBloquear?.bloqueado
                    ? "linear-gradient(135deg,#059669,#10B981)"
                    : "linear-gradient(135deg,#DC2626,#F43F5E)",
                  boxShadow: perfilParaBloquear?.bloqueado
                    ? "0 0 20px rgba(16,185,129,0.35)"
                    : "0 0 20px rgba(244,63,94,0.35)",
                }}
              >
                {bloquearUsuarioMutation.isPending ? "Aguarde..." : "Sim"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL EXCLUIR ────────────────────────────────────── */}
      <Dialog open={modalExcluirAberto} onOpenChange={(open) => { setModalExcluirAberto(open); if (!open) setPerfilParaExcluir(null); }}>
        <DialogContent style={{ background: "#0A1023", border: "1px solid rgba(244,63,94,0.30)", borderRadius: 24 }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#F8FAFC" }}>Excluir Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="p-4 rounded-2xl" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.22)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)" }}>
                  <Trash2 className="w-4 h-4" style={{ color: "#FB7185" }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: "#F8FAFC" }}>{perfilParaExcluir?.user_name || perfilParaExcluir?.user_email}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{perfilParaExcluir?.user_email}</p>
                </div>
              </div>
              <p className="text-sm" style={{ color: "#FDA4AF" }}>
                Tem certeza que deseja excluir este usuário? Esta ação irá remover o perfil e todos os vínculos com a empresa. <strong style={{ color: "#F8FAFC" }}>Esta ação não pode ser desfeita.</strong>
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setModalExcluirAberto(false); setPerfilParaExcluir(null); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8", border: `1px solid ${BORDER}` }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarExcluir}
                disabled={excluirPerfilMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#DC2626,#F43F5E)", boxShadow: "0 0 20px rgba(244,63,94,0.35)" }}
              >
                {excluirPerfilMutation.isPending ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConviteUsuarioModal
        open={conviteModalOpen}
        onOpenChange={setConviteModalOpen}
        empresaId={empresaId}
        onConviteSuccess={() => queryClient.invalidateQueries({ queryKey: ["userProfiles", empresaId] })}
      />
    </div>
  );
}