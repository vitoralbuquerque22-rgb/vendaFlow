import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { User, Star, Phone, Calendar, Edit3, Save, X, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "./GlassCard";

export default function PerfilDadosPessoais({ user, queryClient }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ full_name: "", apelido: "", telefone: "", data_nascimento: "" });

  // Buscar UserProfile para pegar ramal (gerenciado pelo admin) e nome salvo lá
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.email],
    queryFn: async () => {
      const profiles = await api.entities.UserProfile.filter({ user_email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });

  useEffect(() => {
    // Não sobrescreve enquanto o usuário está editando
    if (user && !editando) {
      setForm({
        full_name: userProfile?.user_name || user.full_name || "",
        apelido: user.apelido || "",
        telefone: user.telefone || "",
        data_nascimento: user.data_nascimento || "",
      });
    }
  }, [user, userProfile]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Salva no auth (full_name, apelido, etc.)
      await api.auth.updateMe(data);
      // Salva user_name e apelido no UserProfile como fonte de verdade do nome
      if (userProfile?.id) {
        const profileUpdate = {};
        if (data.full_name) profileUpdate.user_name = data.full_name;
        if (data.apelido !== undefined) profileUpdate.apelido = data.apelido;
        if (Object.keys(profileUpdate).length > 0) {
          await api.entities.UserProfile.update(userProfile.id, profileUpdate);
        }
      }
      // Propagar nome para todos os VinculoEmpresa do usuário
      if (data.full_name?.trim()) {
        try {
          const vinculos = await api.entities.VinculoEmpresa.filter({ userEmail: user.email });
          await Promise.all(
            vinculos.map(v => api.entities.VinculoEmpresa.update(v.id, { userName: data.full_name.trim() }))
          );
        } catch (e) {
          console.warn('[PerfilDadosPessoais] erro ao propagar nome para VinculoEmpresa:', e.message);
        }
      }
    },
    onSuccess: (_, variables) => {
      // Atualiza o form com os valores salvos para evitar regressão pelo useEffect
      setForm(prev => ({ ...prev, ...variables }));
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile", user?.email] });
      queryClient.invalidateQueries({ queryKey: ["vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["equipe"] });
      toast.success("Perfil atualizado!");
      setEditando(false);
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {};
    if (form.full_name?.trim()) payload.full_name = form.full_name.trim();
    if (form.apelido?.trim()) payload.apelido = form.apelido.trim();
    if (form.telefone?.trim()) payload.telefone = form.telefone.trim();
    if (form.data_nascimento) payload.data_nascimento = form.data_nascimento;
    mutation.mutate(payload);
  };

  // Ramal vem do UserProfile (gerenciado pelo admin/gestor via GestaoRBAC)
  const ramal3cplus = userProfile?.ramal_3cplus || "";

  return (
    <GlassCard glow="sky">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(199 89% 55% / 0.12)", border: "1px solid hsl(199 89% 55% / 0.30)" }}>
              <User className="w-4 h-4" style={{ color: "hsl(199 89% 70%)" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#fff" }}>Dados Pessoais</span>
          </div>

          {!editando ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setEditando(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                background: "hsl(199 89% 55% / 0.12)",
                border: "1px solid hsl(199 89% 55% / 0.30)",
                color: "hsl(199 89% 70%)",
              }}
            >
              <Edit3 className="w-3 h-3" />
              Editar
            </motion.button>
          ) : (
            <button
              onClick={() => setEditando(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ background: "hsl(0 0% 100% / 0.05)", color: "hsl(220 15% 55%)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome Completo */}
            {[
              { key: "full_name", label: "Nome Completo", icon: User, placeholder: "Seu nome completo", type: "text" },
              { key: "apelido", label: "Apelido", icon: Star, placeholder: "Como gosta de ser chamado", type: "text" },
            ].map((field) => {
              const Icon = field.icon;
              return (
                <div key={field.key} className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"
                    style={{ color: "hsl(220 15% 55%)" }}>
                    <Icon className="w-3 h-3" style={{ color: "hsl(199 89% 70%)" }} />
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    disabled={!editando}
                    placeholder={field.placeholder}
                    className="w-full text-sm outline-none transition-all duration-150"
                    style={{
                      height: 40, padding: "0 12px", borderRadius: "12px",
                      background: "hsl(222 47% 5% / 0.8)",
                      border: "1px solid hsl(0 0% 100% / 0.08)",
                      color: editando ? "#fff" : "hsl(220 15% 75%)",
                      opacity: editando ? 1 : 0.7,
                    }}
                    onFocus={(e) => { if (editando) { e.target.style.border = "2px solid hsl(199 89% 55% / 0.5)"; e.target.style.boxShadow = "0 0 0 4px hsl(199 89% 55% / 0.08)"; } }}
                    onBlur={(e) => { e.target.style.border = "1px solid hsl(0 0% 100% / 0.08)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              );
            })}

            {/* Ramal 3C Plus — somente leitura, vem do UserProfile */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"
                style={{ color: "hsl(220 15% 55%)" }}>
                <Phone className="w-3 h-3" style={{ color: "hsl(199 89% 70%)" }} />
                Ramal 3C Plus
                <Lock className="w-3 h-3 ml-1" style={{ color: "hsl(220 15% 40%)" }} />
              </label>
              <input
                type="tel"
                value={ramal3cplus}
                disabled
                placeholder={ramal3cplus ? "" : "Definido pelo administrador"}
                className="w-full text-sm outline-none"
                style={{
                  height: 40, padding: "0 12px", borderRadius: "12px",
                  background: "hsl(222 47% 5% / 0.5)",
                  border: "1px solid hsl(0 0% 100% / 0.05)",
                  color: "hsl(220 15% 55%)",
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
              />
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"
                style={{ color: "hsl(220 15% 55%)" }}>
                <Phone className="w-3 h-3" style={{ color: "hsl(199 89% 70%)" }} />
                Telefone
              </label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                disabled={!editando}
                placeholder="(00) 00000-0000"
                className="w-full text-sm outline-none transition-all duration-150"
                style={{
                  height: 40, padding: "0 12px", borderRadius: "12px",
                  background: "hsl(222 47% 5% / 0.8)",
                  border: "1px solid hsl(0 0% 100% / 0.08)",
                  color: editando ? "#fff" : "hsl(220 15% 75%)",
                  opacity: editando ? 1 : 0.7,
                }}
                onFocus={(e) => { if (editando) { e.target.style.border = "2px solid hsl(199 89% 55% / 0.5)"; e.target.style.boxShadow = "0 0 0 4px hsl(199 89% 55% / 0.08)"; } }}
                onBlur={(e) => { e.target.style.border = "1px solid hsl(0 0% 100% / 0.08)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Nascimento */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest"
                style={{ color: "hsl(220 15% 55%)" }}>
                <Calendar className="w-3 h-3" style={{ color: "hsl(199 89% 70%)" }} />
                Nascimento
              </label>
              <input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                disabled={!editando}
                className="w-full text-sm outline-none transition-all duration-150"
                style={{
                  height: 40, padding: "0 12px", borderRadius: "12px",
                  background: "hsl(222 47% 5% / 0.8)",
                  border: "1px solid hsl(0 0% 100% / 0.08)",
                  color: editando ? "#fff" : "hsl(220 15% 75%)",
                  opacity: editando ? 1 : 0.7,
                }}
                onFocus={(e) => { if (editando) { e.target.style.border = "2px solid hsl(199 89% 55% / 0.5)"; e.target.style.boxShadow = "0 0 0 4px hsl(199 89% 55% / 0.08)"; } }}
                onBlur={(e) => { e.target.style.border = "1px solid hsl(0 0% 100% / 0.08)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          <AnimatePresence>
            {editando && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex justify-end gap-2 mt-4"
              >
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "hsl(0 0% 100% / 0.05)",
                    border: "1px solid hsl(0 0% 100% / 0.08)",
                    color: "hsl(220 15% 55%)",
                  }}
                >
                  Cancelar
                </button>
                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={mutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(262 83% 60%))",
                    boxShadow: "0 4px 14px -4px hsl(217 91% 60% / 0.6)",
                  }}
                >
                  {mutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Salvar
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </GlassCard>
  );
}