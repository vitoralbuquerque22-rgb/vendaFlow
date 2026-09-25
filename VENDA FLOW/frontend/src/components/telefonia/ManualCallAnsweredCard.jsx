import { motion } from "framer-motion";
import { Phone, UserPlus, FileText, Minus } from "lucide-react";

export default function ManualCallAnsweredCard({
  manualCallSession,
  hangupManualCall,
  onCadastrarLead,
  onRegistrarLigacao,
  onMinimizar,
  minimizado,
}) {
  if (!manualCallSession || manualCallSession.status !== "answered") return null;

  if (minimizado) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        onClick={onMinimizar}
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          cursor: "pointer",
          background: "linear-gradient(135deg, #0f172a 0%, #0c1628 100%)",
          border: "1px solid rgba(56,189,248,0.35)",
          borderRadius: 999,
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          backdropFilter: "blur(20px)",
          minWidth: 260,
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#38bdf8",
          boxShadow: "0 0 10px #38bdf8",
          animation: "pulseGlow 1.4s ease-in-out infinite",
          flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {manualCallSession.lead_telefone || "Em ligação manual"}
          </p>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Toque para expandir</p>
        </div>
        <div style={{
          background: "rgba(56,189,248,0.12)",
          border: "1px solid rgba(56,189,248,0.25)",
          borderRadius: 999,
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 600,
          color: "#38bdf8",
        }}>
          Abrir
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        width: 340,
        background: "linear-gradient(135deg, #0f172a 0%, #0c1628 100%)",
        border: "1px solid rgba(56,189,248,0.25)",
        borderRadius: 16,
        padding: "20px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.08)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Ligação atendida</p>
            <p className="text-xs text-slate-400 mt-0.5">{manualCallSession.lead_telefone || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimizar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            title="Minimizar"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Descrição */}
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        O que deseja fazer com esta ligação?
      </p>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={onCadastrarLead}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all group"
        >
          <UserPlus className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-violet-300">Cadastrar lead</span>
        </button>

        <button
          onClick={onRegistrarLigacao}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-all group"
        >
          <FileText className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold text-sky-300">Registrar ligação</span>
        </button>
      </div>

      {/* Hang up */}
      <button
        onClick={() => hangupManualCall?.()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-all"
      >
        <Phone className="w-3.5 h-3.5 rotate-[135deg]" />
        Encerrar ligação
      </button>
    </motion.div>
  );
}