import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const MEDALS = [
  { bg: "from-amber-400 to-yellow-500", glow: "shadow-amber-500/40", text: "text-amber-400", ring: "ring-amber-400/50", icon: <Crown className="w-3 h-3" /> },
  { bg: "from-slate-300 to-slate-400", glow: "shadow-slate-400/30", text: "text-slate-300", ring: "ring-slate-400/40", icon: <Medal className="w-3 h-3" /> },
  { bg: "from-amber-600 to-orange-700", glow: "shadow-orange-700/30", text: "text-orange-400", ring: "ring-orange-600/40", icon: <Medal className="w-3 h-3" /> },
];

function RankingItem({ vendedor, index, isMe }) {
  const medal = MEDALS[index];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ x: 3 }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-200",
        isMe
          ? "bg-sky-500/10 border-sky-500/30 shadow shadow-sky-500/10"
          : "bg-white/[0.02] border-white/[0.05] hover:border-white/10"
      )}
    >
      {/* Position badge */}
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0",
        medal
          ? cn("bg-gradient-to-br shadow-md text-slate-900", medal.bg, medal.glow)
          : "bg-white/5 border border-white/10 text-slate-500"
      )}>
        {medal ? medal.icon : <span className="text-[11px]">{index + 1}</span>}
      </div>

      {/* Avatar */}
      <div className={cn(
        "relative flex-shrink-0",
        index < 3 && cn("ring-2 ring-offset-[2px] ring-offset-[#070b12] rounded-full", medal?.ring)
      )}>
        <Avatar className="w-8 h-8">
          <AvatarImage src={vendedor.foto} />
          <AvatarFallback className="bg-gradient-to-br from-sky-500/30 to-violet-500/30 text-white text-xs font-bold">
            {vendedor.nome?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {isMe && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#070b12]" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold truncate leading-tight",
          isMe ? "text-sky-300" : index === 0 ? "text-amber-300" : "text-white"
        )}>
          {vendedor.nome}
          {isMe && <span className="text-sky-500/60 ml-1 text-[10px]">(você)</span>}
        </p>
        <p className="text-[10px] text-slate-600 truncate">{vendedor.cargo}</p>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p className={cn(
          "text-sm font-bold font-mono",
          index === 0 ? "text-amber-400" : isMe ? "text-sky-300" : "text-slate-200"
        )}>
          {vendedor.pontuacao}
        </p>
        <p className="text-[9px] text-slate-600">pts</p>
      </div>
    </motion.div>
  );
}

export default function LeaderboardCard({ dadosRanking, userEmail }) {
  if (!dadosRanking) return null;

  return (
    <div className="rounded-2xl border border-white/[0.07] backdrop-blur-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex flex-col h-full"
      style={{ boxShadow: "0 0 0 1px rgba(139,92,246,0.08), 0 8px 32px rgba(0,0,0,0.3)" }}>
      <div className="p-5 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <Award className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Leaderboard</p>
              <p className="text-[11px] text-slate-500">Top vendedores do mês</p>
            </div>
          </div>
          {dadosRanking.minhaColocacao > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-violet-500/25 bg-violet-500/10">
              <Crown className="w-3 h-3 text-violet-400" />
              <span className="text-xs font-bold text-violet-300">{dadosRanking.minhaColocacao}º</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-1.5">
        {dadosRanking.ranking.map((v, i) => (
          <RankingItem key={v.email} vendedor={v} index={i} isMe={v.email === userEmail} />
        ))}
      </div>
    </div>
  );
}