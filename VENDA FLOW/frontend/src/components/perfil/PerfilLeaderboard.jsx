import { Crown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GlassCard from "./GlassCard";

const RANK_ACCENTS = [
  "38 92% 55%",   // 1st — amber
  "220 15% 70%",  // 2nd — silver
  "20 90% 55%",   // 3rd — bronze
  "199 89% 55%",  // 4th — sky
  "262 83% 60%",  // 5th — violet
];

function RankEntry({ entry, index, isMe }) {
  const accent = RANK_ACCENTS[index] || "220 15% 55%";
  const accentCss = `hsl(${accent})`;
  const accentFaint = `hsl(${accent} / 0.18)`;
  const accentRing = `hsl(${accent} / 0.35)`;
  const nameColor = `hsl(${accent.split(" ")[0]} ${accent.split(" ")[1]} 75%)`;
  const nome = entry.nome || entry.email || "—";
  const inicial = nome.charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 2, background: "hsl(0 0% 100% / 0.06)" }}
      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-default"
      style={{
        background: isMe ? "hsl(199 89% 55% / 0.08)" : "hsl(0 0% 100% / 0.03)",
        border: isMe ? "1px solid hsl(199 89% 55% / 0.25)" : "1px solid hsl(0 0% 100% / 0.05)",
      }}
    >
      {/* Rank badge */}
      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{ background: accentFaint, boxShadow: `inset 0 0 0 1px ${accentRing}`, color: nameColor }}>
        {index + 1}
      </div>

      {/* Avatar */}
      <Avatar className="w-7 h-7 flex-shrink-0">
        <AvatarImage src={entry.foto} />
        <AvatarFallback className="text-xs font-bold"
          style={{ background: "linear-gradient(135deg, hsl(199 89% 55% / 0.3), hsl(262 83% 60% / 0.3))", color: "#fff" }}>
          {inicial}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: nameColor }}>
          {nome}
          {isMe && <span className="ml-1 opacity-60" style={{ color: "hsl(199 89% 55%)", fontSize: "10px" }}>(você)</span>}
        </p>
        <p className="text-xs truncate" style={{ color: "hsl(220 15% 50%)" }}>{entry.cargo}</p>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0 mr-1">
        <p className="text-sm font-bold font-mono" style={{ color: index === 0 ? accentCss : "hsl(220 15% 75%)" }}>
          {entry.pontuacao}
        </p>
        <p className="text-xs" style={{ color: "hsl(220 15% 40%)", fontSize: "9px" }}>pts</p>
      </div>

      {/* Chevron on hover */}
      <ChevronRight
        className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ color: "hsl(220 15% 45%)" }}
      />
    </motion.div>
  );
}

export default function PerfilLeaderboard({ dadosRanking, userEmail }) {
  return (
    <GlassCard glow="violet">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(262 83% 60% / 0.12)", border: "1px solid hsl(262 83% 60% / 0.30)" }}>
              <Crown className="w-4 h-4" style={{ color: "hsl(262 83% 75%)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fff" }}>Leaderboard</p>
              <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>Top vendedores do mês</p>
            </div>
          </div>
          {dadosRanking?.minhaColocacao > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                background: "hsl(262 83% 60% / 0.12)",
                border: "1px solid hsl(262 83% 60% / 0.30)",
                color: "hsl(262 83% 75%)",
              }}
            >
              <Crown className="w-3 h-3" />
              {dadosRanking.minhaColocacao}º
            </span>
          )}
        </div>

        {/* Entries */}
        <div className="space-y-1.5">
          {!dadosRanking || dadosRanking.ranking.length === 0 ? (
            <div className="py-8 text-center">
              <Crown className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "hsl(262 83% 60%)" }} />
              <p className="text-xs font-medium" style={{ color: "hsl(220 15% 55%)" }}>Sem dados de ranking</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 15% 40%)" }}>Disponível para administradores</p>
            </div>
          ) : (
            dadosRanking.ranking.map((entry, i) => (
              <RankEntry
                key={entry.email}
                entry={entry}
                index={i}
                isMe={entry.email === userEmail}
              />
            ))
          )}
        </div>
      </div>
    </GlassCard>
  );
}