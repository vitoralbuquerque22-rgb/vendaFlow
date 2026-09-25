import { useRef, useState } from "react";
import { api } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Mail, Camera, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function PerfilHero({ user, papel, onDesempenho, queryClient }) {
  const [uploadando, setUploadando] = useState(false);
  const fileInputRef = useRef(null);

  const nomeExibido = user?.user_name?.trim() || user?.apelido?.trim() || user?.full_name?.trim() || user?.email?.split('@')[0] || "Usuário";
  const inicial = nomeExibido.charAt(0).toUpperCase();

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploadando(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      await api.auth.updateMe({ foto_perfil: file_url });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Foto atualizada!");
    } finally {
      setUploadando(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "hsl(222 47% 7% / 0.6)",
        border: "1px solid hsl(0 0% 100% / 0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px -12px hsl(222 47% 2% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.04)",
      }}
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-20 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(199 89% 55% / 0.18), transparent 70%)", filter: "blur(48px)" }} />
      <div className="pointer-events-none absolute -bottom-24 right-10 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(262 83% 60% / 0.18), transparent 70%)", filter: "blur(48px)" }} />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {/* Conic glow ring */}
          <div className="absolute -inset-[3px] rounded-full opacity-70 blur-md"
            style={{ background: "conic-gradient(from 180deg, hsl(199 89% 55%), hsl(262 83% 60%), hsl(330 82% 60%), hsl(199 89% 55%))" }} />
          <div className="absolute -inset-[3px] rounded-full"
            style={{ background: "conic-gradient(from 180deg, hsl(199 89% 55%), hsl(262 83% 60%), hsl(330 82% 60%), hsl(199 89% 55%))", padding: "3px" }} />

          <Avatar className="relative w-16 h-16 ring-2" style={{ ringColor: "hsl(222 47% 4%)" }}>
            <AvatarImage src={user?.foto_perfil} />
            <AvatarFallback
              className="text-white text-xl font-bold"
              style={{ background: "linear-gradient(135deg, hsl(199 89% 55% / 0.3), hsl(262 83% 60% / 0.3))" }}
            >
              {inicial}
            </AvatarFallback>
          </Avatar>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadando}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all"
            style={{
              background: "hsl(199 89% 55%)",
              borderColor: "hsl(222 47% 4%)",
              boxShadow: "0 0 10px hsl(199 89% 55% / 0.5)",
            }}
          >
            {uploadando ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
          </button>

          {/* Status dot */}
          <div className="absolute bottom-0 right-5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "hsl(222 47% 4%)", border: "3px solid hsl(222 47% 4%)" }}>
            <div className="relative w-2 h-2 rounded-full" style={{ background: "hsl(160 84% 55%)" }}>
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "hsl(160 84% 55%)", opacity: 0.75 }} />
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadFoto} />
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate"
            style={{
              background: "linear-gradient(135deg, #fff, hsl(220 20% 85%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.02em",
            }}
          >
            {nomeExibido}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Role badge */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: "hsl(199 89% 55% / 0.12)",
                border: "1px solid hsl(199 89% 55% / 0.30)",
                color: "hsl(199 89% 70%)",
              }}
            >
              {papel}
            </span>
            {/* Online badge */}
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: "hsl(160 84% 45% / 0.12)",
                border: "1px solid hsl(160 84% 45% / 0.30)",
                color: "hsl(160 84% 60%)",
              }}
            >
              <span className="relative w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(160 84% 55%)" }}>
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "hsl(160 84% 55%)", opacity: 0.75 }} />
              </span>
              Online
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(220 15% 40%)" }} />
            <span className="text-sm truncate" style={{ color: "hsl(220 15% 55%)" }}>{user?.email}</span>
          </div>
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onDesempenho}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(217 91% 60%))",
            boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
            border: "1px solid hsl(0 0% 100% / 0.15)",
          }}
        >
          <BarChart3 className="w-4 h-4" />
          Meu Desempenho
        </motion.button>
      </div>
    </motion.div>
  );
}