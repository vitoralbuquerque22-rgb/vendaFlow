import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { motion, AnimatePresence } from "framer-motion";

const OrbesFundo = () =>
<div className="fixed inset-0 overflow-hidden pointer-events-none">
    {/* Orb superior esquerdo */}
    <motion.div
    animate={{ y: [0, 30, 0], x: [0, 15, 0] }}
    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    className="absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-40"
    style={{
      background: "radial-gradient(circle, hsl(205 100% 70% / 0.35), transparent 70%)",
      marginTop: "-120px",
      marginLeft: "-80px"
    }} />
  

    {/* Orb inferior direito */}
    <motion.div
    animate={{ y: [0, -30, 0], x: [0, -15, 0] }}
    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
    className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-30"
    style={{
      background: "radial-gradient(circle, hsl(265 90% 72% / 0.30), transparent 70%)",
      marginBottom: "-140px",
      marginRight: "-60px"
    }} />
  

    {/* Gradientes de fundo */}
    <div
    className="absolute inset-0"
    style={{
      background: `
          radial-gradient(1200px 600px at 15% 10%, hsl(205 100% 88% / 0.55), transparent 60%),
          radial-gradient(900px 500px at 85% 90%, hsl(265 95% 85% / 0.45), transparent 60%),
          radial-gradient(700px 400px at 50% 50%, hsl(190 100% 92% / 0.35), transparent 70%),
          linear-gradient(180deg, #F4F7FB 0%, #EEF1F8 100%)
        `
    }} />
  
  </div>;


const InputWithIcon = ({ icon: Icon, label, type = "text", placeholder, value, onChange, error, success, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="relative group">
        {/* Glow atrás do input ao focar */}
        <motion.div
          className="absolute -inset-px rounded-[14px] bg-gradient-to-r from-sky-400/30 to-violet-500/30 blur-md -z-10 opacity-0 group-focus-within:opacity-100"
          transition={{ duration: 0.3 }} />
        

        <div className="relative flex items-center">
          <Icon className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            type={isPassword && !showPassword ? "password" : "text"}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`
              pl-11 h-12 rounded-[14px] text-base font-medium
              bg-white/55 backdrop-blur-[12px] border
              transition-all duration-300
              ${
            error ?
            "border-red-500 ring-1 ring-red-500/25" :
            success ?
            "border-emerald-500/50 ring-1 ring-emerald-500/25" :
            "border-slate-200/25 focus:border-sky-500 focus:ring-4 focus:ring-sky-400/25"}
            `
            }
            {...props} />
          

          {/* Password toggle ou success icon */}
          <div className="absolute right-3 flex items-center gap-1">
            {isPassword &&
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 rounded-md hover:bg-white/40 transition-colors text-slate-600"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
              
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {success && !error &&
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500">
                ✓
              </motion.div>
            }
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error &&
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1 mt-1.5 text-red-500 text-xs font-medium">
            
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </div>);

};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showAutosave, setShowAutosave] = useState(false);
  const autosaveTimerRef = useRef(null);

  // Autosave badge ao preencher email
  useEffect(() => {
    if (email.length > 0) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        setShowAutosave(true);
        setTimeout(() => setShowAutosave(false), 2000);
      }, 600);
    }
  }, [email]);

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? "" : "Email inválido";
  };

  const validatePassword = (value) => {
    return value.length >= 6 ? "" : "Mínimo 6 caracteres";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({ email: "", password: "" });

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setLoading(true);
    try {
      await api.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setErrors({ email: "", password: err.message || "Email ou senha incorretos" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    api.auth.loginWithProvider("google", "/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <OrbesFundo />

      {/* Conteúdo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md">
        
        {/* Card com glassmorphism */}
        <div
          className="relative rounded-3xl px-9 py-10 backdrop-blur-2xl border border-white/60 shadow-2xl overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.55)",
            boxShadow: "0 20px 60px -20px hsl(220 50% 30% / 0.25), 0 8px 24px -12px hsl(265 80% 60% / 0.15), inset 0 1px 0 rgba(255,255,255,0.8)"
          }}>
          
          {/* Inner glow gradient */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent)"
            }} />
          

          {/* Logo + Título */}
          <motion.div className="text-center mb-8 relative z-10">
            















            

            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">VendaFlow CRM</h1>
            <p className="text-sm text-slate-600 mt-1.5">Entre para continuar gerenciando suas vendas</p>
          </motion.div>

          {/* Google OAuth */}
          <Button
            onClick={handleGoogle}
            variant="outline"
            className="w-full h-12 mb-6 rounded-[14px] bg-white/70 border-slate-200/50 hover:bg-white/90 hover:-translate-y-0.5 transition-all text-sm font-medium">
            
            <GoogleIcon className="w-5 h-5 mr-2" />
            Continuar com Google
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">ou continue com email</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <InputWithIcon
              icon={Mail}
              label="Email"
              type="email"
              placeholder="voce@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              success={email.length > 0 && !errors.email}
              autoComplete="email"
              required className="bg-[hsl(var(--card))] text-[hsl(var(--background))] rounded-[28px]" />
            

            <InputWithIcon
              icon={Lock}
              label="Senha"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              success={password.length >= 6}
              autoComplete="current-password"
              required className="rounded-[28px]" />
            

            {/* Helper text + Forgot password */}
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Mínimo 6 caracteres</span>
              <Link to="/forgot-password" className="text-sky-600 hover:text-violet-600 font-semibold transition-colors">
                Esqueci minha senha
              </Link>
            </div>

            {/* CTA */}
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-[16px] text-white font-semibold text-base tracking-wide flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-70 mt-6"
              style={{
                background: "linear-gradient(135deg, #38BDF8 0%, #6366F1 55%, #8B5CF6 100%)",
                backgroundSize: "200% 200%",
                boxShadow: "0 10px 30px -8px hsl(220 90% 60% / 0.45), 0 4px 12px -4px hsl(265 80% 60% / 0.35), inset 0 1px 0 rgba(255,255,255,0.25)"
              }}
  >
              
              {loading ?
              <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </> :

              <>
                  Entrar no VendaFlow
                  <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <ArrowRight className="w-5 h-5" />
                  </motion.div>
                </>
              }
            </motion.button>
          </form>

          {/* Signup link */}
          <p className="text-center text-sm text-slate-600 mt-6">
            Ainda não tem conta?{" "}
            <Link to="/register" className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent font-semibold hover:underline underline-offset-4">
              Criar conta gratuita
            </Link>
          </p>

          {/* Autosave badge */}
          <AnimatePresence>
            {showAutosave &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-8 right-8 flex items-center gap-2 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full text-emerald-600 text-xs font-medium shadow-lg">
              
                <Check className="w-4 h-4 animate-pulse" />
                Salvo automaticamente
              </motion.div>
            }
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div className="flex items-center justify-between mt-6 pt-5 border-t border-white/40 text-xs text-slate-500 relative z-10">
          <div className="flex items-center gap-1">
            <Check className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Dados protegidos · autosave ativo</span>
          </div>
          <div className="flex gap-3 text-slate-500">
            <Link to="/privacy" className="hover:text-slate-700 transition-colors">
              Privacidade
            </Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-slate-700 transition-colors">
              Termos
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>);

}