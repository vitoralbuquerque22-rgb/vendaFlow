import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { createPageUrl } from "../utils";
import { Loader2, Mail, Lock, Eye, EyeOff, Shield, ArrowRight, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// Estrelas flutuantes geradas estaticamente
const STARS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  top: `${Math.floor((i * 17 + 7) % 95)}%`,
  left: `${Math.floor((i * 23 + 11) % 95)}%`,
  size: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1.5,
  delay: (i * 0.4) % 4,
  duration: 3 + (i % 3),
}));

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function InputField({ icon: Icon, type, value, onChange, placeholder, label, rightElement, focusColor = "sky" }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      {label && <label style={{ fontSize: 15, fontWeight: 600, color: "#D8E1F3" }}>{label}</label>}
      <div
        className="flex items-center gap-3.5 px-5 transition-all duration-300"
        style={{
          height: 64,
          background: focused ? "rgba(66,165,255,0.05)" : "rgba(255,255,255,0.03)",
          border: focused ? "1px solid rgba(66,165,255,0.28)" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          backdropFilter: "blur(12px)",
          boxShadow: focused ? "0 0 28px rgba(66,165,255,0.14)" : "none",
        }}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: "#7F8BA7" }} />
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-white"
          style={{ fontSize: 16, fontWeight: 500 }}
        />
        {rightElement}
      </div>
    </div>
  );
}

export default function Acesso() {
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [loadingRecuperacao, setLoadingRecuperacao] = useState(false);
  const [modoRedefinirSenha, setModoRedefinirSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostraNovaSenha, setMostraNovaSenha] = useState(false);
  const [loadingRedefinir, setLoadingRedefinir] = useState(false);
  const [mostrarRecuperarSenha, setMostrarRecuperarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const convite = urlParams.get("convite");
    const empresaId = urlParams.get("empresaId");
    const recuperar = urlParams.get("recuperar");
    const emailUrl = urlParams.get("email");

    if (convite && empresaId) {
      navigate(createPageUrl("Onboarding") + `?convite=${convite}&empresaId=${empresaId}`);
      return;
    }
    if (recuperar && emailUrl) {
      setModoRedefinirSenha(true);
      setEmailRecuperacao(emailUrl);
      setIsChecking(false);
      return;
    }

    api.auth.isAuthenticated().then((authed) => {
      if (authed) navigate(createPageUrl("AutoSelectEmpresa"));
    }).catch(() => {}).finally(() => setIsChecking(false));
  }, [navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    const urlParams = new URLSearchParams(window.location.search);
    const empresaId = urlParams.get("empresaId");
    if (empresaId) {
      api.auth.redirectToLogin(createPageUrl("ChooseEmpresa") + `?empresaId=${empresaId}`);
    } else {
      api.auth.redirectToLogin(createPageUrl("AutoSelectEmpresa"));
    }
  };

  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    if (!emailRecuperacao) { toast.error("Digite seu email"); return; }
    setLoadingRecuperacao(true);
    try {
      await api.auth.resetPasswordRequest(emailRecuperacao);
      toast.success("Email enviado! Verifique sua caixa de entrada");
      setMostrarRecuperarSenha(false);
      setEmailRecuperacao("");
    } catch (error) {
      toast.error("Erro ao enviar email: " + error.message);
    } finally {
      setLoadingRecuperacao(false);
    }
  };

  const handleRedefinirSenha = async (e) => {
    e.preventDefault();
    if (!novaSenha || !confirmarSenha) { toast.error("Preencha todos os campos"); return; }
    if (novaSenha.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres"); return; }
    if (novaSenha !== confirmarSenha) { toast.error("As senhas não coincidem"); return; }
    setLoadingRedefinir(true);
    try {
      toast.info("Redirecionando para redefinir senha...");
      window.location.href = "/forgot-password";
    } catch (error) {
      toast.error("Erro ao redefinir senha: " + error.message);
    } finally {
      setLoadingRedefinir(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040816" }}>
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-hidden flex items-center justify-center p-8"
      style={{
        background: "radial-gradient(circle at top left, rgba(66,165,255,0.18) 0%, transparent 28%), radial-gradient(circle at bottom right, rgba(139,92,246,0.18) 0%, transparent 32%), linear-gradient(180deg, #040816 0%, #060B1C 100%)",
      }}
    >
      {/* Background orbs */}
      <div className="fixed pointer-events-none" style={{ top: -120, left: -120, width: 520, height: 520, background: "rgba(66,165,255,0.12)", borderRadius: "50%", filter: "blur(120px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: -100, right: -80, width: 420, height: 420, background: "rgba(139,92,246,0.14)", borderRadius: "50%", filter: "blur(120px)" }} />

      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating stars */}
      {STARS.map((star) => (
        <div
          key={star.id}
          className="fixed pointer-events-none rounded-full"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            background: "rgba(255,255,255,0.6)",
            animation: `pulseStarGlow ${star.duration}s ${star.delay}s infinite ease-in-out`,
          }}
        />
      ))}

      <style>{`
        @keyframes pulseStarGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.6); }
        }
        @keyframes floatingGlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 14px rgba(66,165,255,0.12); }
          50% { box-shadow: 0 0 28px rgba(66,165,255,0.28); }
        }
        @media (max-width: 640px) {
          .login-card { padding: 28px !important; border-radius: 28px !important; }
          .login-title { font-size: 38px !important; }
          .login-subtitle { font-size: 16px !important; }
        }
      `}</style>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="login-card relative overflow-hidden w-full"
        style={{
          maxWidth: 560,
          background: "linear-gradient(180deg, rgba(10,16,34,0.92) 0%, rgba(7,11,25,0.96) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 36,
          padding: 42,
          backdropFilter: "blur(24px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        {/* Card inner orbs */}
        <div className="absolute pointer-events-none" style={{ top: "-35%", right: "-15%", width: 320, height: 320, background: "radial-gradient(circle, rgba(66,165,255,0.14), transparent 70%)", filter: "blur(18px)" }} />
        <div className="absolute pointer-events-none" style={{ bottom: "-35%", left: "-15%", width: 280, height: 280, background: "radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%)", filter: "blur(20px)" }} />

        <motion.div variants={stagger} initial="hidden" animate="show" className="relative z-10">

          {/* Logo */}
          <motion.div variants={item} className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center"
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(66,165,255,0.14), rgba(139,92,246,0.14))",
                border: "1px solid rgba(66,165,255,0.18)",
                boxShadow: "0 0 40px rgba(66,165,255,0.18)",
                backdropFilter: "blur(18px)",
                animation: "floatingGlow 6s infinite ease-in-out",
              }}
            >
              <MessageSquare className="w-11 h-11 text-sky-400" />
            </div>

            <h1
              className="login-title text-center mt-6"
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1.05,
                background: "linear-gradient(90deg, #FFFFFF 0%, #A5B4FC 45%, #60A5FA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              CRM SDR
            </h1>
            <p
              className="login-subtitle text-center mt-3"
              style={{ fontSize: 18, fontWeight: 500, color: "#7F8BA7" }}
            >
              {modoRedefinirSenha ? "Redefina sua senha" : mostrarRecuperarSenha ? "Recuperação de acesso" : "Faça login para continuar"}
            </p>
          </motion.div>

          {/* ── Modo Redefinir Senha ── */}
          {modoRedefinirSenha && (
            <motion.div variants={item} className="space-y-5">
              <div className="px-4 py-3 rounded-2xl" style={{ background: "rgba(66,165,255,0.08)", border: "1px solid rgba(66,165,255,0.18)" }}>
                <p className="text-sm text-sky-300">Redefinindo para: <strong>{emailRecuperacao}</strong></p>
              </div>
              <form onSubmit={handleRedefinirSenha} className="space-y-5">
                <InputField
                  icon={Lock}
                  type={mostraNovaSenha ? "text" : "password"}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  label="Nova Senha"
                  rightElement={
                    <button type="button" onClick={() => setMostraNovaSenha(v => !v)} className="text-slate-500 hover:text-white transition-colors">
                      {mostraNovaSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />
                <InputField
                  icon={Lock}
                  type="password"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a senha"
                  label="Confirmar Senha"
                />
                <PrimaryButton type="submit" loading={loadingRedefinir} label="Redefinir Senha" />
                <GhostButton onClick={() => { setModoRedefinirSenha(false); navigate(createPageUrl("Acesso")); }} label="← Voltar ao login" />
              </form>
            </motion.div>
          )}

          {/* ── Modo Recuperar Senha ── */}
          {!modoRedefinirSenha && mostrarRecuperarSenha && (
            <motion.div variants={item}>
              <form onSubmit={handleRecuperarSenha} className="space-y-5">
                <InputField
                  icon={Mail}
                  type="email"
                  value={emailRecuperacao}
                  onChange={e => setEmailRecuperacao(e.target.value)}
                  placeholder="seu@email.com"
                  label="Seu e-mail"
                />
                <PrimaryButton type="submit" loading={loadingRecuperacao} label="Enviar link de recuperação" />
                <GhostButton onClick={() => setMostrarRecuperarSenha(false)} label="← Voltar ao login" />
              </form>
            </motion.div>
          )}

          {/* ── Modo Login Principal ── */}
          {!modoRedefinirSenha && !mostrarRecuperarSenha && (
            <motion.div variants={item}>
              <form onSubmit={handleLogin} className="space-y-5">
                <PrimaryButton type="submit" loading={loading} label="Entrar na plataforma" icon={ArrowRight} />
              </form>

              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={() => setMostrarRecuperarSenha(true)}
                  className="transition-colors"
                  style={{ fontSize: 14, fontWeight: 600, color: "#7F8BA7" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={e => e.currentTarget.style.color = "#7F8BA7"}
                >
                  Esqueceu a senha?
                </button>
                <button
                  type="button"
                  onClick={() => api.auth.redirectToLogin(createPageUrl("CriarEmpresa"))}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    background: "linear-gradient(90deg, #42A5FF 0%, #8B5CF6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Criar empresa →
                </button>
              </div>

              <div className="flex items-center gap-3 mt-10" style={{ justifyContent: "center" }}>
                <Shield className="w-4 h-4 text-sky-400" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#66738F" }}>
                  Acesso protegido com criptografia de ponta a ponta
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function PrimaryButton({ type = "button", loading, label, icon: Icon, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type}
      disabled={loading}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center justify-center gap-3 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
      style={{
        height: 66,
        borderRadius: 22,
        background: "linear-gradient(90deg, #42A5FF 0%, #8B5CF6 100%)",
        border: "none",
        fontSize: 18,
        boxShadow: hovered ? "0 0 42px rgba(66,165,255,0.22), 0 0 60px rgba(139,92,246,0.16)" : "0 16px 40px rgba(66,165,255,0.24)",
        transform: hovered ? "translateY(-3px) scale(1.01)" : "none",
        filter: hovered ? "brightness(1.06)" : "none",
      }}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : label}
      {!loading && Icon && <Icon className="w-5 h-5" />}
    </button>
  );
}

function GhostButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center transition-all duration-200"
      style={{
        height: 48,
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        fontSize: 15,
        fontWeight: 600,
        color: "#7F8BA7",
      }}
      onMouseEnter={e => e.currentTarget.style.color = "#fff"}
      onMouseLeave={e => e.currentTarget.style.color = "#7F8BA7"}
    >
      {label}
    </button>
  );
}