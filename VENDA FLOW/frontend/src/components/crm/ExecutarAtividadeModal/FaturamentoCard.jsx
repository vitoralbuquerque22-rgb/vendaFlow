import { useState } from "react";
import { DollarSign, TrendingUp, Clock, User, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FaturamentoSection from "../FaturamentoSection";

export default function FaturamentoCard({ leadId, currentUserEmail }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-6 backdrop-blur-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">Faturamento Mensal</p>
            <p className="text-xs text-slate-500">Estratégia de receita</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-white hover:bg-slate-800/60 h-8 w-8 p-0"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", expanded ? "rotate-180" : "rotate-0")} />
        </Button>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <FaturamentoSection leadId={leadId} currentUserEmail={currentUserEmail} />
        </motion.div>
      )}
    </motion.div>
  );
}