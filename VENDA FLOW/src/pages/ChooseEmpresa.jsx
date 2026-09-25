import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Loader2, ChevronRight, Crown, Users,
  Sparkles, TrendingUp, ArrowRight, LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

const PAPEL_LABEL = { admin: "Admin", gestor: "Gestor", sdr: "SDR", closer: "Closer" };
const PLANO_LABEL = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

const PLANO_STYLE = {
  starter: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  pro: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  enterprise: "bg-violet-500/10 text-violet-300 border-violet-500/20",
};

export default function ChooseEmpresa() {
  const navigate = useNavigate();
  const [selecionando, setSelecionando] = useState(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: resultado = null, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["empresas-do-usuario", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const res = await base44.functions.invoke('buscarEmpresasDoUsuario', {});
      return res.data;
    },
    enabled: !!user?.email,
  });

  const empresas = resultado?.empresas || [];
  // vinculos sintéticos para compatibilidade com o render (papel já vem na empresa)
  const vinculos = empresas.map(e => ({ empresaId: e.id, papel: e.papel }));

  const isLoading = !user || loadingEmpresas;

  const handleSelectEmpresa = async (empresaId) => {
    setSelecionando(empresaId);
    try {
      await base44.auth.updateMe({ empresaAtualId: empresaId });
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao selecionar empresa:", error);
    } finally {
      setSelecionando(null);
    }
  };

  const handleChangeAccount = () => {
    base44.auth.logout(createPageUrl("Acesso"));
  };

  return (
    <div
      className="min-h-screen text-white overflow-hidden font-sans"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(66,165,255,0.16) 0%, transparent 30%), radial-gradient(circle at top right, rgba(139,92,246,0.14) 0%, transparent 35%), linear-gradient(180deg, #040816 0%, #060B1A 100%)",
      }}
    >
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div
        className="relative z-10 mx-auto min-h-screen flex items-center"
        style={{ maxWidth: "1280px", padding: "48px" }}
      >
        <div
          className="w-full grid gap-20 items-center"
          style={{ gridTemplateColumns: "1fr 520px" }}
        >
          {/* ── LEFT: Branding ── */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="flex flex-col"
          >
            {/* Icon badge */}
            <div
              className="w-[72px] h-[72px] rounded-3xl flex items-center justify-center mb-8"
              style={{
                background: "linear-gradient(135deg, rgba(66,165,255,0.18), rgba(139,92,246,0.18))",
                border: "1px solid rgba(66,165,255,0.22)",
                backdropFilter: "blur(18px)",
                boxShadow: "0 0 35px rgba(66,165,255,0.18)",
              }}
            >
              <Sparkles className="w-8 h-8 text-sky-300" />
            </div>

            {/* Headline */}
            <h1
              className="font-extrabold leading-none mb-6"
              style={{
                fontSize: "clamp(42px, 5vw, 64px)",
                letterSpacing: "-0.04em",
                background: "linear-gradient(90deg, #FFFFFF 0%, #A5B4FC 45%, #60A5FA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Bem-vindo ao<br />Venda Flow
            </h1>

            {/* Subtitle */}
            <p
              className="leading-relaxed mb-10"
              style={{ fontSize: "18px", color: "#8A97B8", maxWidth: "480px", lineHeight: "1.7" }}
            >
              Gerencie empresas, leads, vendas e equipes em uma plataforma premium com performance e inteligência.
            </p>

            {/* Stats row */}
            <div className="flex gap-4 flex-wrap">
              {[
                { label: "Empresas", value: "12+", icon: Building2, color: "rgba(56,189,248,0.15)", border: "rgba(56,189,248,0.2)", text: "#7DD3FC" },
                { label: "Leads", value: "25k", icon: Users, color: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.2)", text: "#C4B5FD" },
                { label: "Conversão", value: "82%", icon: TrendingUp, color: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.2)", text: "#6EE7B7" },
              ].map(({ label, value, icon: Icon, color, border, text }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                  style={{ background: color, border: `1px solid ${border}`, backdropFilter: "blur(12px)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: text }} />
                  <div>
                    <p className="text-white font-bold text-lg leading-none">{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: text }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── RIGHT: Access Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
            className="relative rounded-[32px] overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(12,18,38,0.88) 0%, rgba(7,11,25,0.96) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              padding: "36px",
            }}
          >
            {/* Background glow orb */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: "-40%", right: "-20%",
                width: "320px", height: "320px",
                background: "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)",
                filter: "blur(14px)",
              }}
            />

            <div className="relative z-10">
              {/* Card Header */}
              <div className="mb-8">
                <h2
                  className="font-extrabold text-white"
                  style={{ fontSize: "32px", letterSpacing: "-0.03em" }}
                >
                  Escolha sua Empresa
                </h2>
                <p className="mt-2 text-sm" style={{ color: "#8E9AB8" }}>
                  Selecione a empresa para acessar o CRM
                </p>
              </div>

              {/* Company List */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
                  <p className="text-sm text-slate-500">Carregando empresas...</p>
                </div>
              ) : empresas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Building2 className="w-8 h-8 text-slate-600" />
                  <p className="text-sm text-slate-500">Nenhuma empresa disponível.<br />Contate o administrador.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {empresas.map((empresa, i) => {
                    const papel = empresa.papel || "sdr";
                    const plano = empresa.plano || "starter";
                    const loading = selecionando === empresa.id;

                    return (
                      <motion.button
                        key={empresa.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.08 }}
                        onClick={() => handleSelectEmpresa(empresa.id)}
                        disabled={!!selecionando}
                        className="group relative text-left rounded-3xl overflow-hidden transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background: "linear-gradient(180deg, rgba(8,14,32,0.95), rgba(6,10,24,0.92))",
                          border: "1px solid rgba(255,255,255,0.06)",
                          backdropFilter: "blur(18px)",
                          padding: "22px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-3px) scale(1.01)";
                          e.currentTarget.style.border = "1px solid rgba(66,165,255,0.22)";
                          e.currentTarget.style.boxShadow = "0 0 35px rgba(66,165,255,0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "";
                          e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
                          e.currentTarget.style.boxShadow = "";
                        }}
                      >
                        {/* Card glow orb */}
                        <div
                          className="absolute pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                          style={{
                            top: "-20%", right: "-10%",
                            width: "180px", height: "180px",
                            background: "radial-gradient(circle, rgba(66,165,255,0.12), transparent 70%)",
                            filter: "blur(10px)",
                          }}
                        />

                        <div className="relative z-10">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                              style={{
                                background: "linear-gradient(135deg, rgba(66,165,255,0.16), rgba(139,92,246,0.14))",
                                border: "1px solid rgba(66,165,255,0.22)",
                                boxShadow: "0 0 20px rgba(66,165,255,0.12)",
                              }}
                            >
                              <Building2 className="w-6 h-6 text-sky-400" />
                            </div>
                            <span
                              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold"
                              style={{
                                background: "rgba(139,92,246,0.14)",
                                border: "1px solid rgba(139,92,246,0.22)",
                                color: "#C4B5FD",
                                boxShadow: "0 0 16px rgba(139,92,246,0.12)",
                              }}
                            >
                              {PAPEL_LABEL[papel] || papel}
                            </span>
                          </div>

                          {/* Name */}
                          <h3 className="text-xl font-bold text-white truncate">{empresa.nome}</h3>
                          {empresa.nomeProprietario && (
                            <p className="text-sm mt-0.5 truncate" style={{ color: "#7F8AA8" }}>{empresa.nomeProprietario}</p>
                          )}

                          {/* Meta badges */}
                          <div className="flex gap-2 mt-3 flex-wrap">
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#B7C1D9" }}
                            >
                              <Crown className="w-3 h-3" /> {PLANO_LABEL[plano] || plano}
                            </span>
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#B7C1D9" }}
                            >
                              <Users className="w-3 h-3" /> {empresa.limiteUsuarios} usuários
                            </span>
                          </div>

                          {/* CTA Button */}
                          <div
                            className="w-full mt-5 h-[52px] rounded-2xl flex items-center justify-center gap-2.5 text-base font-bold text-white transition-all duration-300"
                            style={
                              loading
                                ? { background: "rgba(255,255,255,0.06)" }
                                : {
                                    background: "linear-gradient(90deg, #42A5FF 0%, #8B5CF6 100%)",
                                    boxShadow: "0 12px 30px rgba(66,165,255,0.28)",
                                  }
                            }
                          >
                            {loading ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Acessando...</>
                            ) : (
                              <><span>Acessar</span><ArrowRight className="w-4 h-4" /></>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Footer user */}
              {user && (
                <div className="mt-7 text-center space-y-3">
                  <p className="text-sm" style={{ color: "#66738F" }}>
                    Logado como <span className="text-slate-400">{user.email}</span>
                  </p>
                  <button
                    onClick={handleChangeAccount}
                    className="w-full px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#8E9AB8",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.12)";
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.22)";
                      e.currentTarget.style.color = "#FECACA";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.color = "#8E9AB8";
                    }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Trocar conta
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Responsive: stack on smaller screens */}
      <style>{`
        @media (max-width: 900px) {
          .choose-grid { grid-template-columns: 1fr !important; gap: 40px !important; align-items: start !important; }
          .choose-wrap { padding: 32px 24px !important; align-items: flex-start !important; }
        }
      `}</style>
    </div>
  );
}