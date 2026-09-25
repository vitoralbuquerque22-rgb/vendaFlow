import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/hooks/usePermissions";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import {
  LayoutDashboard, ListTodo, Users, Calendar, FileText,
  Settings, BarChart3, Menu, X, ChevronDown, LogOut,
  Bell, MessageSquare, UserCircle, UsersRound, Bot,
  Shield, FileCheck, AlertCircle, Mail, Building2, Target,
  Phone, Activity, Zap, Mic,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "sonner";
import AlertasNotificacao from "@/components/alertas/AlertasNotificacao";
import { resolveDisplayName, resolveAvatarInitial } from '@/lib/resolveDisplayName';
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { TelefoniaProvider, useTelefonia } from "@/contexts/TelefoniaContext";
import Softphone3CPlus from "@/components/telefonia/Softphone3CPlus";
import RamalWebRTC from "@/components/telefonia/RamalWebRTC";
import ModalAtendimentoLead from "@/components/telefonia/ModalAtendimentoLead";
import ModalAtendimentoManual from "@/components/telefonia/ModalAtendimentoManual";
import { motion, AnimatePresence } from "framer-motion";

const COLLAPSED_W = 78;
const EXPANDED_W = 278;

const adminGlobalMenuItems = [
  { name: "Dashboard Admin", icon: LayoutDashboard, path: "DashboardAdmin" },
  { name: "Gerenciamento de Empresas", icon: Building2, path: "GerenciamentoEmpresas" },
];

const configuracoesMenuItems = [
  { name: "Dados da Empresa", icon: Building2, path: "DadosEmpresa" },
  { name: "Metas por Vendedor", icon: Users, path: "MetasPorVendedor" },
  { name: "Metas da Empresa", icon: Target, path: "MetasEmpresa" },
  { name: "Equipes", icon: UsersRound, path: "Equipes" },
  { name: "Gestão de Usuários", icon: Users, path: "GestaoUsuariosEmpresa", gestorOuAdminOnly: true },
  { name: "Gravações", icon: Mic, path: "Gravacoes" },
  { name: "Integrações & APIs", icon: Settings, path: "Integracoes" },
  { name: "Automações", icon: Settings, path: "Automacoes" },
  { name: "Empresas Vendedoras", icon: MessageSquare, path: "EmpresasVendedoras" },
  { name: "Cadências", icon: Calendar, path: "Cadencias" },
  { name: "Distribuição de Leads", icon: Settings, path: "DistribuicaoLeads" },
  { name: "Gestão RBAC", icon: Shield, path: "GestaoRBAC", adminEmpresaOnly: true },
  { name: "Solicitar Permissões", icon: FileCheck, path: "SolicitarPermissoes" },
  { name: "Monitoramento ao Vivo", icon: Activity, path: "MonitoramentoAoVivo", gestorOuAdminOnly: true },
  { name: "System Health", icon: Activity, path: "SystemHealth", adminEmpresaOnly: true },
  { name: "Power Dialer", icon: Zap, path: "PowerDialerControle", gestorOuAdminOnly: true },
  { name: "Extensão Chrome", icon: Phone, path: "ExtensaoVendaFlow" },
];

const empresaMenuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "Dashboard" },
  { name: "Tarefas", icon: ListTodo, path: "Tarefas" },
  { name: "Leads", icon: Users, path: "Leads" },
  { name: "Scripts", icon: FileText, path: "Scripts" },
  { name: "Produtos", icon: MessageSquare, path: "Produtos" },
  { name: "Formulários", icon: FileCheck, path: "Formularios" },
  { name: "E-mail Marketing", icon: Mail, path: "EmailMarketing" },
  { name: "Landing Pages", icon: FileText, path: "LandingPages" },
  { name: "Assistente IA", icon: Bot, path: "AssistenteVendas" },
  { name: "Inteligência Comercial", icon: BarChart3, path: "InteligenciaComercial" },
  { name: "Alertas", icon: Bell, path: "ConfiguracaoAlertas" },
  { name: "Relatórios", icon: BarChart3, path: "Relatorios" },
  {
    name: "Configurações",
    icon: Settings,
    path: "Configuracoes",
    submenu: configuracoesMenuItems,
  },
];

// ── Neon Underline SVG ───────────────────────────────────────
function NeonUnderline() {
  const PATH = "M1 5.5 C15 3 28 8 42 5 C56 2 70 7.5 84 4.5 C98 1.5 110 6.5 124 5";
  const LEN = 160;

  return (
    <svg width="125" height="12" viewBox="0 0 125 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="ul-grad" x1="0" y1="0" x2="125" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#42D7FF" />
          <stop offset="50%" stopColor="#A259FF" />
          <stop offset="100%" stopColor="#FF6B9D" />
        </linearGradient>
        <filter id="ul-glow" x="-10%" y="-300%" width="120%" height="700%">
          <feGaussianBlur stdDeviation="3" result="blur1" />
          <feGaussianBlur stdDeviation="6" result="blur2" />
          <feMerge><feMergeNode in="blur2" /><feMergeNode in="blur1" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={PATH} stroke="url(#ul-grad)" strokeWidth="5" strokeLinecap="round" fill="none" filter="url(#ul-glow)" opacity="0.4"
        style={{ strokeDasharray: LEN, strokeDashoffset: LEN, animation: "vf-draw 1.4s cubic-bezier(0.22,1,0.36,1) forwards, vf-loop 5s 1.8s ease-in-out infinite" }} />
      <path d={PATH} stroke="url(#ul-grad)" strokeWidth="2" strokeLinecap="round" fill="none"
        style={{ strokeDasharray: LEN, strokeDashoffset: LEN, animation: "vf-draw 1.4s cubic-bezier(0.22,1,0.36,1) forwards, vf-loop 5s 1.8s ease-in-out infinite" }} />
      <circle r="2.5" fill="#fff" opacity="0.95" style={{ filter: "drop-shadow(0 0 5px #42D7FF) drop-shadow(0 0 10px #A259FF) drop-shadow(0 0 18px #FF6B9D)" }}>
        <animateMotion dur="1.4s" begin="0s" fill="freeze" path={PATH} calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" />
      </circle>
      <circle r="2.5" fill="#fff" opacity="0" style={{ filter: "drop-shadow(0 0 5px #42D7FF) drop-shadow(0 0 10px #A259FF) drop-shadow(0 0 18px #FF6B9D)", animation: "vf-particle-fade 5s 1.8s ease-in-out infinite" }}>
        <animateMotion dur="5s" begin="1.8s" repeatCount="indefinite" path={PATH} calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" />
      </circle>
    </svg>
  );
}

function BrandButton({ isExpanded, onNavigate }) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    if (clicked) return;
    setClicked(true);
    setTimeout(() => { setClicked(false); onNavigate(); }, 500);
  };

  return (
    <>
      <style>{`
        @keyframes vf-draw { from { stroke-dashoffset: 120; } to { stroke-dashoffset: 0; } }
        @keyframes vf-loop { 0% { stroke-dashoffset: 0; opacity: 1; } 20% { stroke-dashoffset: 0; opacity: 1; } 40% { stroke-dashoffset: 160; opacity: 0; } 41% { stroke-dashoffset: 160; opacity: 0; } 60% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
        @keyframes vf-particle-fade { 0% { opacity: 0; } 8% { opacity: 0.95; } 80% { opacity: 0.95; } 100% { opacity: 0; } }
        @keyframes vf-brand-pulse { 0%, 100% { text-shadow: 0 0 8px rgba(66,215,255,0.25), 0 0 20px rgba(162,89,255,0.15); } 50% { text-shadow: 0 0 16px rgba(66,215,255,0.45), 0 0 32px rgba(162,89,255,0.28); } }
        @keyframes vf-shimmer { 0% { background-position: -250% center; } 100% { background-position: 250% center; } }
      `}</style>
      <div style={{ width: "100%", height: 86, padding: "14px 10px", display: "flex", alignItems: "center", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "linear-gradient(180deg, rgba(8,13,28,0.98) 0%, rgba(5,9,20,0.99) 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", width: 160, height: 60, background: "radial-gradient(ellipse, rgba(66,215,255,0.07) 0%, rgba(122,92,255,0.05) 50%, transparent 100%)", pointerEvents: "none", filter: "blur(12px)" }} />
        <motion.button onClick={handleClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.975 }} transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ width: "100%", height: 58, borderRadius: 20, display: "flex", alignItems: "center", gap: 11, padding: "0 14px", justifyContent: "flex-start", position: "relative", overflow: "hidden", cursor: "pointer", border: hovered ? "1px solid rgba(66,215,255,0.22)" : "1px solid rgba(66,215,255,0.07)", background: hovered ? "linear-gradient(135deg, rgba(12,22,44,1) 0%, rgba(8,14,30,1) 100%)" : "linear-gradient(135deg, rgba(10,18,38,0.95) 0%, rgba(6,11,24,0.98) 100%)", boxShadow: hovered ? "0 0 40px rgba(66,215,255,0.10), 0 0 60px rgba(122,92,255,0.07), 0 8px 24px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.4)", backdropFilter: "blur(20px)", transition: "border 0.25s ease, background 0.25s ease, box-shadow 0.25s ease" }}>
          <AnimatePresence>
            {clicked && (
              <motion.div initial={{ opacity: 0.7, scale: 0.2 }} animate={{ opacity: 0, scale: 3.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ position: "absolute", inset: 0, borderRadius: 20, background: "radial-gradient(circle, rgba(66,215,255,0.18) 0%, rgba(122,92,255,0.10) 50%, transparent 100%)", pointerEvents: "none" }} />
            )}
          </AnimatePresence>
          <div style={{ width: 36, height: 36, minWidth: 36, borderRadius: 13, background: "linear-gradient(145deg, rgba(14,22,46,1) 0%, rgba(6,10,22,1) 100%)", border: hovered ? "1px solid rgba(66,215,255,0.28)" : "1px solid rgba(66,215,255,0.12)", boxShadow: hovered ? "0 0 22px rgba(66,215,255,0.22), 0 0 40px rgba(122,92,255,0.14), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 0 14px rgba(66,215,255,0.12), 0 0 24px rgba(122,92,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.25s ease" }}>
            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Inter', sans-serif", background: "linear-gradient(145deg, #42D7FF 0%, #7A5CFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 5px rgba(66,215,255,0.6)) drop-shadow(0 0 10px rgba(122,92,255,0.4))", lineHeight: 1, userSelect: "none" }}>$</span>
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                <div style={{ position: "relative", display: "inline-block", lineHeight: 1, overflow: "hidden" }}>
                  <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.04em", color: "#FFFFFF", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", animation: "vf-brand-pulse 4s ease-in-out infinite" }}>Venda</span>
                  <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.04em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", background: "linear-gradient(90deg, #42D7FF 0%, #A259FF 55%, #7A5CFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 8px rgba(66,215,255,0.35))" }}>FLOW</span>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.55) 50%, transparent 80%)", backgroundSize: "250% 100%", backgroundPosition: "-250% center", animation: "vf-shimmer 3.5s ease-in-out infinite", pointerEvents: "none", mixBlendMode: "overlay", borderRadius: 2 }} />
                </div>
                <NeonUnderline />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}

function Tooltip({ label, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.18 }}
          className="pointer-events-none absolute left-full ml-3 z-[999] whitespace-nowrap"
          style={{ background: "rgba(10,16,34,0.96)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)", color: "#fff", padding: "8px 13px", borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavItem({ item, isActive, isExpanded, hasBadge, badgeCount, onClick, currentPageName, canAccessPage, isAdminEmpresa, isAdminGlobal, expandedSubmenu, onToggleSubmenu }) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  const hasSubmenu = item.submenu?.length > 0;

  if (hasSubmenu) {
    const isSubOpen = expandedSubmenu === item.path;
    const anySubActive = item.submenu?.some(s => s.path === currentPageName);

    return (
      <div>
        <button onClick={() => isExpanded && onToggleSubmenu(isSubOpen ? null : item.path)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          className="w-full relative flex items-center transition-all duration-[260ms]"
          style={{ height: 54, paddingLeft: 19, paddingRight: 16, justifyContent: "flex-start", borderRadius: 18, gap: 14, color: anySubActive ? "#FF9B63" : hovered ? "#fff" : "#7183A6", background: anySubActive ? "linear-gradient(90deg, rgba(255,122,69,0.20), rgba(255,90,122,0.08))" : hovered ? "linear-gradient(90deg, rgba(66,165,255,0.10), rgba(139,92,246,0.08))" : "transparent", border: anySubActive ? "1px solid rgba(255,122,69,0.12)" : hovered ? "1px solid rgba(66,165,255,0.12)" : "1px solid transparent", transform: hovered && isExpanded ? "translateX(4px)" : "none", cursor: "pointer" }}>
          <Icon style={{ width: 20, height: 20, minWidth: 20, flexShrink: 0, transition: "transform 0.25s ease", transform: hovered ? "scale(1.08) rotate(3deg)" : "none" }} />
          {isExpanded && (
            <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24 }} className="flex-1 text-left" style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>
              {item.name}
            </motion.span>
          )}
          <AnimatePresence>
            {isExpanded && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ChevronDown style={{ width: 14, height: 14, transition: "transform 0.22s ease", transform: isSubOpen ? "rotate(180deg)" : "rotate(0deg)", color: "#627395" }} />
              </motion.div>
            )}
          </AnimatePresence>
          {!isExpanded && <Tooltip label={item.name} visible={hovered} />}
        </button>

        <AnimatePresence>
          {isSubOpen && isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0, y: -8 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: "easeOut" }} style={{ overflow: "hidden" }}>
              <div style={{ marginLeft: 18, marginTop: 4, paddingLeft: 16, borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 2, paddingBottom: 4 }}>
                {item.submenu.map((sub) => {
                  if (!canAccessPage(sub.path)) return null;
                  if (sub.gestorOuAdminOnly && !isAdminEmpresa && !isAdminGlobal) return null;
                  const isSubActive = currentPageName === sub.path;
                  return <SubItem key={sub.path} sub={sub} isSubActive={isSubActive} onClick={onClick} />;
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link to={createPageUrl(item.path)} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="relative flex items-center transition-all duration-[260ms]"
      style={{ height: 54, paddingLeft: 19, paddingRight: 16, justifyContent: "flex-start", borderRadius: 18, gap: 14, textDecoration: "none", color: isActive ? "#FF9B63" : hovered ? "#fff" : "#7183A6", background: isActive ? "linear-gradient(90deg, rgba(255,122,69,0.20), rgba(255,90,122,0.08))" : hovered ? "linear-gradient(90deg, rgba(66,165,255,0.10), rgba(139,92,246,0.08))" : "transparent", border: isActive ? "1px solid rgba(255,122,69,0.12)" : hovered ? "1px solid rgba(66,165,255,0.12)" : "1px solid transparent", boxShadow: isActive ? "0 0 30px rgba(255,122,69,0.14)" : hovered ? "0 0 24px rgba(66,165,255,0.10)" : "none", transform: hovered && isExpanded ? "translateX(4px)" : "none" }}>
      <Icon style={{ width: 20, height: 20, minWidth: 20, flexShrink: 0, transition: "transform 0.25s ease", transform: hovered ? "scale(1.08) rotate(3deg)" : "none" }} />
      {isExpanded && (
        <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24 }} className="flex-1" style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>
          {item.name}
        </motion.span>
      )}
      {hasBadge && isExpanded && (
        <AnimatePresence>
          <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} style={{ position: "absolute", right: 14, background: "linear-gradient(90deg, #FF7A45, #FF5A7A)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, boxShadow: "0 0 16px rgba(255,90,122,0.28)" }}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </motion.span>
        </AnimatePresence>
      )}
      {hasBadge && !isExpanded && (
        <span style={{ position: "absolute", top: 6, right: 6, width: 14, height: 14, background: "linear-gradient(90deg, #FF7A45, #FF5A7A)", borderRadius: "50%", fontSize: 9, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(255,90,122,0.35)" }}>
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
      {!isExpanded && <Tooltip label={item.name} visible={hovered} />}
    </Link>
  );
}

function SubItem({ sub, isSubActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link to={createPageUrl(sub.path)} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ height: 42, padding: "0 14px", borderRadius: 14, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 500, textDecoration: "none", color: isSubActive ? "#DCE7FF" : hovered ? "#DCE7FF" : "#627395", background: isSubActive ? "rgba(66,165,255,0.10)" : hovered ? "rgba(66,165,255,0.06)" : "transparent", transform: hovered ? "translateX(3px)" : "none", transition: "all 0.24s ease" }}>
      {sub.name}
    </Link>
  );
}

function SoftphoneGlobal() {
  const telefonia = useTelefonia();
  const { callSession, manualCallSession, manualCallStatus, emLigacao, aguardandoAtendimento, cronometroFormatado, modalAtendimentoAberto } = telefonia || {};

  if (!telefonia) return null;

  // Ligação de campanha/lead ativa
  const ligacaoCampanhaAtiva = emLigacao || aguardandoAtendimento;
  const mostrarBarraCampanha = ligacaoCampanhaAtiva && !modalAtendimentoAberto;

  // Ligação manual ativa (não encerrada e modal manual fechado)
  const ligacaoManualAtiva = manualCallSession && manualCallStatus !== 'encerrado';
  const mostrarBarraManual = ligacaoManualAtiva && !modalAtendimentoAberto;

  const nomeManual = manualCallSession?.lead_nome || manualCallSession?.lead_telefone || 'Ligação manual';
  const statusManualLabel = manualCallStatus === 'em_ligacao' ? 'Em ligação' : 'Discando...';

  return (
    <>
      <RamalWebRTC />
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 50, width: "320px" }} className="pointer-events-none">
        <Softphone3CPlus telefonia={telefonia} onCampanhaAtiva={(ativa) => telefonia.setAgenteCampanhaAtiva?.(ativa)} />
      </div>

      {/* Barra minimizada — ligação de campanha/lead */}
      <AnimatePresence>
        {mostrarBarraCampanha && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => telefonia.setModalAtendimentoAberto?.(true)}
            style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 60, cursor: "pointer", background: "linear-gradient(135deg, #0f172a 0%, #0c1628 100%)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 999, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.1)", backdropFilter: "blur(20px)", minWidth: 260 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: emLigacao ? "#38bdf8" : "#f59e0b", boxShadow: emLigacao ? "0 0 10px #38bdf8" : "0 0 10px #f59e0b", animation: "pulseGlow 1.4s ease-in-out infinite", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{callSession?.lead_nome || callSession?.lead_telefone || "Em ligação"}</p>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{emLigacao ? cronometroFormatado : "Discando..."}</p>
            </div>
            <div style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: "#38bdf8", whiteSpace: "nowrap" }}>Abrir</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra minimizada — ligação manual */}
      <AnimatePresence>
        {mostrarBarraManual && !mostrarBarraCampanha && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 60, background: "linear-gradient(135deg, #0f172a 0%, #0c1628 100%)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 999, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(20px)", minWidth: 260 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: manualCallStatus === 'em_ligacao' ? "#38bdf8" : "#f59e0b", boxShadow: manualCallStatus === 'em_ligacao' ? "0 0 10px #38bdf8" : "0 0 10px #f59e0b", animation: "pulseGlow 1.4s ease-in-out infinite", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeManual}</p>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{statusManualLabel}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalAtendimentoLead telefonia={telefonia} />
      <ModalAtendimentoManual telefonia={telefonia} />
    </>
  );
}

function SessionTrackerWrapper({ currentPageName }) {
  useSessionTracker(currentPageName);
  return null;
}

export default function Layout({ children, currentPageName }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSubmenu, setExpandedSubmenu] = useState(null);
  const hoverTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const navRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000,
  });

  const { canAccessPage, isAdmin, isSuperAdmin: isSuperAdminGlobal, rawRole, user: permUser, userProfile, isLoadingPermissions } = usePermissions();
  const { empresaId, isImpersonating, impersonatedNome } = useEmpresaAtual();

  useEffect(() => {
    const atualizarAcesso = async () => {
      if (empresaId && user?.email) {
        try { await api.functions.invoke('atualizarUltimoAcesso', { empresaId }); } catch {}
      }
    };
    atualizarAcesso();
  }, [empresaId, user?.email]);

  const isAdminGlobal = user?.role === "admin";
  const isAdminEmpresa = !isAdminGlobal && rawRole === "admin";

  const currentMenuItems = useMemo(() => {
    if (!user) return [];
    if (isAdminGlobal) return [...adminGlobalMenuItems, ...empresaMenuItems];
    return empresaMenuItems.filter(item => {
      if (item.adminEmpresaOnly && !isAdminEmpresa) return false;
      if (item.gestorOuAdminOnly && !isAdminEmpresa && rawRole !== 'gestor') return false;
      return true;
    });
  }, [user, isAdminGlobal, isAdminEmpresa, rawRole]);

  const { data: tarefasPendentes = [] } = useQuery({
    queryKey: ["tarefas-pendentes", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      return await api.entities.Tarefa.filter({ empresaId, status: "pendente" });
    },
    enabled: !!empresaId,
  });

  const handleMouseEnter = () => {
    clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setIsExpanded(true), 120);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    setExpandedSubmenu(null); // fecha submenu imediatamente para não vazar texto ao recolher
    leaveTimerRef.current = setTimeout(() => { setIsExpanded(false); }, 240);
  };

  // Ao trocar de página, recolhe a sidebar e limpa timers/submenu — evita rótulos "presos"
  useEffect(() => {
    clearTimeout(hoverTimerRef.current);
    clearTimeout(leaveTimerRef.current);
    setIsExpanded(false);
    setExpandedSubmenu(null);
  }, [currentPageName]);

  const handleLogout = () => { api.auth.logout(createPageUrl("Acesso")); };

  const rolePaperLabel = isAdminGlobal ? "Admin Global"
    : rawRole === "admin" ? "Admin"
    : rawRole === "gestor" ? "Gestor"
    : rawRole === "closer" ? "Closer"
    : rawRole === "sdr" ? "SDR"
    : rawRole === "gestor_empresa" ? "Gestor"
    : rawRole === "supervisor" ? "Supervisor"
    : rawRole || "—";

  if (["LandingPagePublica", "Login", "Acesso", "AceitarConvite", "Onboarding", "ChooseEmpresa", "BoasVindas"].includes(currentPageName)) {
    return <>{children}</>;
  }

  const isLoadingCriticalData = isLoadingPermissions || !user || (!empresaId && !isSuperAdminGlobal);

  if (user && currentPageName && !isLoadingCriticalData && !canAccessPage(currentPageName)) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#0d1420]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-10 text-center shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-rose-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Acesso Negado</h2>
            <p className="text-slate-500 text-sm mb-8">Você não tem permissão para acessar esta página.</p>
            <div className="space-y-2.5">
              <Link to={createPageUrl("Dashboard")}>
                <Button className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl h-10 font-medium">Voltar ao Dashboard</Button>
              </Link>
              <Link to={createPageUrl("SolicitarPermissoes")}>
                <Button variant="outline" className="w-full border-white/8 bg-white/3 text-slate-400 hover:bg-white/6 hover:text-white rounded-xl h-10 font-medium">
                  <FileCheck className="w-4 h-4 mr-2" />Solicitar Acesso
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TelefoniaProvider>
      <SessionTrackerWrapper currentPageName={currentPageName} />
      {user && !user.full_name && !isImpersonating && !["Perfil", "Onboarding", "AceitarConvite"].includes(currentPageName) && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 199, background: "linear-gradient(90deg, #b45309, #92400e)", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#fef3c7" }}>
            ⚠️ Seu perfil está sem nome. Adicione seu nome para ser identificado pela equipe.
          </span>
          <Link to={createPageUrl("Perfil")} style={{ fontSize: 13, fontWeight: 700, color: "#fde68a", whiteSpace: "nowrap", textDecoration: "none" }}>
            Completar perfil →
          </Link>
        </div>
      )}
      {isImpersonating && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(90deg, #7c3aed, #6d28d9)", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            👁 Visualizando como: <strong>{impersonatedNome}</strong>
          </span>
          <button
            onClick={() => { localStorage.removeItem("impersonated_empresa_id"); localStorage.removeItem("impersonated_empresa_nome"); window.location.reload(); }}
            style={{ fontSize: 12, fontWeight: 600, color: "#ddd6fe", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}
          >
            Sair da impersonação
          </button>
        </div>
      )}
      <div className="min-h-screen bg-[#070b12] font-sans" style={isImpersonating ? { paddingTop: 37 } : {}}>
        <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: '#0d1420', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0', borderRadius: '12px', fontSize: '0.875rem' } }} />
        <AlertasNotificacao />

        {/* ── Mobile Header ─────────────────────────────── */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4"
          style={{ background: "rgba(4,8,22,0.95)", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
          <button onClick={() => setMobileOpen(true)} className="text-slate-500 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold tracking-tight" style={{ background: "linear-gradient(90deg, #5B8EFF, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VendaFLOW</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-slate-500 hover:text-white transition-colors"><UserCircle className="w-5 h-5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0d1420] border-white/8 rounded-xl">
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium text-white">{user?.full_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={handleLogout} className="text-slate-400 focus:bg-white/5 focus:text-white rounded-lg mx-1 mb-1">
                <LogOut className="w-4 h-4 mr-2" />Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Mobile Overlay ────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/45 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)} />
          )}
        </AnimatePresence>

        {/* ── Sidebar ───────────────────────────────────── */}
        <motion.aside onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
          animate={{ width: isExpanded ? EXPANDED_W : COLLAPSED_W }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className={cn("fixed top-0 left-0 h-screen z-[999] flex flex-col", "lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}
          style={{ background: "linear-gradient(180deg, rgba(5,10,24,0.96) 0%, rgba(3,7,18,0.98) 100%)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 0 60px rgba(0,0,0,0.45)", overflow: "visible", willChange: "width" }}>
          <BrandButton isExpanded={isExpanded} onNavigate={() => { window.location.href = createPageUrl("Dashboard"); }} />

          <nav ref={navRef} style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", overflowX: "hidden", paddingBottom: 12 }}>
            {currentMenuItems.map((item, idx) => {
              if (!canAccessPage(item.path)) return null;
              const isActive = currentPageName === item.path;
              const hasBadge = item.path === "Tarefas" && tarefasPendentes.length > 0;
              return (
                <motion.div key={item.path} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.028, duration: 0.25 }}>
                  <NavItem item={item} isActive={isActive} isExpanded={isExpanded} hasBadge={hasBadge} badgeCount={tarefasPendentes.length} onClick={() => setMobileOpen(false)}
                    currentPageName={currentPageName} canAccessPage={canAccessPage} isAdminEmpresa={isAdminEmpresa} isAdminGlobal={isAdminGlobal}
                    expandedSubmenu={expandedSubmenu}
                    onToggleSubmenu={(key) => {
                      setExpandedSubmenu(key);
                      if (key) setTimeout(() => { navRef.current?.scrollTo({ top: navRef.current.scrollHeight, behavior: "smooth" }); }, 320);
                    }} />
                </motion.div>
              );
            })}
          </nav>

          <div style={{ flexShrink: 0, padding: "0 10px 14px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <FooterProfile user={user} userProfile={userProfile} rolePaperLabel={rolePaperLabel} isExpanded={isExpanded} onLogout={handleLogout} />
          </div>
        </motion.aside>

        {/* ── Main content ──────────────────────────────── */}
        <main className="transition-all duration-[380ms] pt-14 lg:pt-0 min-h-screen"
          style={{ marginLeft: typeof window !== "undefined" && window.innerWidth >= 1024 ? COLLAPSED_W : 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={currentPageName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <SoftphoneGlobal />

        <style>{`
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 12px rgba(66,165,255,0.10); }
            50%       { box-shadow: 0 0 22px rgba(66,165,255,0.20); }
          }
        `}</style>
      </div>
    </TelefoniaProvider>
  );
}

function FooterProfile({ user, userProfile, rolePaperLabel, isExpanded, onLogout }) {
  // resolveDisplayName e resolveAvatarInitial importados no topo do arquivo
  const [hovered, setHovered] = useState(false);

  return (
    <Link to={createPageUrl("Perfil")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ textDecoration: "none" }}>
      <div style={{ height: 64, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: hovered ? "1px solid rgba(66,165,255,0.16)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 12, display: "flex", alignItems: "center", gap: 12, backdropFilter: "blur(14px)", boxShadow: hovered ? "0 0 28px rgba(66,165,255,0.10)" : "none", transition: "all 0.28s ease", overflow: "hidden", cursor: "default" }}>
        <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: 14, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,122,69,0.2)", boxShadow: "0 0 18px rgba(255,122,69,0.14)" }}>
          {user?.foto_perfil ? (
          <img src={user.foto_perfil} alt={resolveDisplayName(user, userProfile)} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
          ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, rgba(255,122,69,0.18), rgba(255,90,122,0.14))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#FF9B63", fontSize: 15 }}>
          {resolveAvatarInitial(user, userProfile)}
          </div>
          )}
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }} className="flex-1 min-w-0">
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{resolveDisplayName(user, userProfile)}</p>
              <p style={{ fontSize: 12, color: "#7183A6", marginTop: 1, whiteSpace: "nowrap" }}>{rolePaperLabel}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isExpanded && hovered && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.18 }}
              onClick={(e) => { e.preventDefault(); onLogout(); }}
              style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", cursor: "pointer", flexShrink: 0 }}>
              <LogOut style={{ width: 13, height: 13 }} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </Link>
  );
}