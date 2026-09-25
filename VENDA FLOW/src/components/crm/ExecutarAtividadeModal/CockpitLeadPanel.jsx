import { useQuery } from "@tanstack/react-query";
import { buscarLeadPorIdDireto, listarLeadScoreDoLead } from "@/lib/services/leadService";
import { motion } from "framer-motion";
import {
  Phone, MapPin, Building2, Star, Calendar, Clock,
  Wrench, Users, TrendingUp, Target,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

function ScoreBadge({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#f87171";
  const bg    = score >= 80 ? "rgba(34,197,94,0.12)" : score >= 50 ? "rgba(245,158,11,0.12)" : "rgba(248,113,113,0.12)";
  const bar   = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Lead Score</span>
        <span className="text-sm font-bold" style={{ color }}>{score ?? "—"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score ?? 0, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: bar }}
        />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, color = "#94a3b8" }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-200 font-medium leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function CockpitLeadPanel({ tarefa }) {
  const { data: lead } = useQuery({
    queryKey: ["cockpit-lead", tarefa?.lead_id],
    queryFn: () => buscarLeadPorIdDireto(tarefa?.lead_id),
    enabled: !!tarefa?.lead_id,
  });

  const { data: score } = useQuery({
    queryKey: ["lead-score", tarefa?.lead_id],
    queryFn: () => listarLeadScoreDoLead(tarefa?.lead_id),
    enabled: !!tarefa?.lead_id,
  });

  const diasNoCadencia = lead?.data_inicio_cadencia
    ? differenceInDays(new Date(), new Date(lead.data_inicio_cadencia))
    : null;

  const ultimoContato = lead?.ultima_ligacao_em
    ? formatDistanceToNow(new Date(lead.ultima_ligacao_em), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <div
      className="flex flex-col gap-4 overflow-y-auto h-full"
      style={{ padding: "16px 14px" }}
    >
      {/* Avatar + nome */}
      <div className="space-y-2">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold"
          style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd" }}
        >
          {(lead?.nome || tarefa?.lead_nome || "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-base font-bold text-white leading-tight">{lead?.nome || tarefa?.lead_nome}</p>
          {lead?.empresa && <p className="text-xs text-slate-500 mt-0.5">{lead.empresa}</p>}
        </div>
      </div>

      {/* Score */}
      {score?.score_total !== undefined && <ScoreBadge score={score.score_total} />}

      <div className="h-px bg-slate-800" />

      {/* Dados principais */}
      <div className="space-y-3">
        <InfoRow icon={Phone}    label="Telefone"         value={lead?.telefone || tarefa?.lead_telefone} color="#34d399" />
        <InfoRow icon={MapPin}   label="Localização"      value={[lead?.cidade, lead?.estado].filter(Boolean).join(" — ")} color="#60a5fa" />
        <InfoRow icon={Building2} label="Empresa"         value={lead?.empresa} color="#a78bfa" />
        <InfoRow icon={Target}   label="Produto interesse" value={lead?.produto_interesse_nome} color="#f472b6" />
      </div>

      <div className="h-px bg-slate-800" />

      {/* Métricas rápidas */}
      <div className="space-y-3">
        {diasNoCadencia !== null && (
          <InfoRow icon={Calendar} label="Tempo no funil" value={`${diasNoCadencia} dias`} color="#fbbf24" />
        )}
        {ultimoContato && (
          <InfoRow icon={Clock} label="Último contato" value={ultimoContato} color="#94a3b8" />
        )}
        {lead?.total_ligacoes > 0 && (
          <InfoRow icon={Phone} label="Total ligações" value={`${lead.total_ligacoes}`} color="#38bdf8" />
        )}
      </div>

      {/* Perfil da oficina */}
      {(lead?.qtd_tecnicos || lead?.qtd_vendedores || lead?.qtd_unidades) && (
        <>
          <div className="h-px bg-slate-800" />
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Perfil da Oficina</p>
            <div className="grid grid-cols-2 gap-2">
              {lead?.qtd_tecnicos > 0 && (
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-lg font-bold text-white">{lead.qtd_tecnicos}</p>
                  <p className="text-[10px] text-slate-500">Técnicos</p>
                </div>
              )}
              {lead?.qtd_vendedores > 0 && (
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-lg font-bold text-white">{lead.qtd_vendedores}</p>
                  <p className="text-[10px] text-slate-500">Vendedores</p>
                </div>
              )}
              {lead?.qtd_unidades > 0 && (
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-lg font-bold text-white">{lead.qtd_unidades}</p>
                  <p className="text-[10px] text-slate-500">Unidades</p>
                </div>
              )}
              {lead?.valor_potencial > 0 && (
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs font-bold text-emerald-400">R$ {(lead.valor_potencial / 1000).toFixed(0)}k</p>
                  <p className="text-[10px] text-slate-500">Potencial</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}