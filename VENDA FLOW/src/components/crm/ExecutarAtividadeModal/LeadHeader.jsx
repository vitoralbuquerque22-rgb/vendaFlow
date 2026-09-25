import { Phone, MapPin, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LeadHeader({ tarefa, timerAtivo }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-slate-800/80 to-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm mb-8"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Nome do Lead */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lead</p>
          <p className="text-lg font-bold text-white truncate">{tarefa?.lead_nome}</p>
        </div>

        {/* Telefone */}
        <div className="space-y-1.5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Telefone</p>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-white font-mono text-sm">{tarefa?.lead_telefone}</p>
          </div>
        </div>

        {/* Localização */}
        <div className="space-y-1.5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Localização</p>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-white text-sm">{tarefa?.lead_cidade || "-"}</p>
          </div>
        </div>

        {/* Status de Atendimento */}
        <div className="space-y-1.5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
          <motion.div
            animate={{ scale: timerAtivo ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 2, repeat: timerAtivo ? Infinity : 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-lg w-fit"
          >
            <div className={`w-2 h-2 rounded-full ${timerAtivo ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            <span className="text-xs font-semibold text-emerald-300">Em andamento</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}