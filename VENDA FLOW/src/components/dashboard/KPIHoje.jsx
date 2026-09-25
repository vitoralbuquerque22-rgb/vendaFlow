import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { listarAtividades } from "@/lib/services/atividadeService";
import { listarTarefas } from "@/lib/services/tarefaService";
import { Phone, CalendarClock, Zap, TrendingUp, Flame, RefreshCw, CheckCircle2 } from "lucide-react";
import { startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";

/**
 * Painel "SDR — Hoje" no Dashboard.
 * Lê Atividades e Tarefas do dia corrente do usuário logado.
 */
export default function KPIHoje({ userEmail }) {
  const { empresaId } = useEmpresaAtual();
  const hoje = new Date();
  const intervalo = { start: startOfDay(hoje), end: endOfDay(hoje) };

  const { data: atividadesHoje = [], isLoading } = useQuery({
    queryKey: ["kpi-atividades-hoje", empresaId, userEmail],
    queryFn: async () => {
      const lista = await listarAtividades(empresaId, { limit: 200 });
      const filtrado = userEmail ? lista.filter(a => a.sdr_email === userEmail) : lista;
      return filtrado.filter((a) => {
        const d = a.created_date ? parseISO(a.created_date) : null;
        return d && isWithinInterval(d, intervalo);
      });
    },
    enabled: !!empresaId && !!userEmail,
    refetchInterval: 60000,
  });

  const { data: tarefasHoje = [] } = useQuery({
    queryKey: ["kpi-tarefas-hoje", empresaId, userEmail],
    queryFn: async () => {
      const lista = await listarTarefas(empresaId, { apenasDoSDR: !!userEmail, sdrEmail: userEmail });
      return lista.filter((t) => t.data_prevista === hoje.toISOString().split("T")[0]);
    },
    enabled: !!empresaId && !!userEmail,
    refetchInterval: 60000,
  });

  const kpis = useMemo(() => {
    const atendimentos = atividadesHoje.filter((a) => a.tipo === "ligacao").length;

    const duracoes = atividadesHoje
      .filter((a) => a.tipo === "ligacao" && a.duracao_segundos > 0)
      .map((a) => a.duracao_segundos);
    const tempoMedioSeg = duracoes.length
      ? Math.round(duracoes.reduce((s, v) => s + v, 0) / duracoes.length)
      : 0;
    const mm = String(Math.floor(tempoMedioSeg / 60)).padStart(2, "0");
    const ss = String(tempoMedioSeg % 60).padStart(2, "0");

    const followupsCriados = tarefasHoje.filter((t) => t.status === "pendente").length;

    const leadsQuentes = atividadesHoje.filter((a) => a.temperatura === "quente").length;

    const conversoes = atividadesHoje.filter((a) =>
      ["reuniao_agendada", "qualificado", "venda_realizada"].includes(a.resultado)
    ).length;

    const totalTarefas = tarefasHoje.length;
    const concluidas = tarefasHoje.filter((t) => t.status === "concluida").length;
    const taxaConclusao = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

    return { atendimentos, tempoMedio: `${mm}:${ss}`, followupsCriados, leadsQuentes, conversoes, taxaConclusao };
  }, [atividadesHoje, tarefasHoje]);

  const cards = [
    { label: "Atendimentos", value: kpis.atendimentos, icon: Phone, color: "#60a5fa" },
    { label: "Tempo médio", value: kpis.tempoMedio, icon: CalendarClock, color: "#a78bfa" },
    { label: "Follow-ups", value: kpis.followupsCriados, icon: RefreshCw, color: "#34d399" },
    { label: "Leads quentes", value: kpis.leadsQuentes, icon: Flame, color: "#f97316" },
    { label: "Conversões", value: kpis.conversoes, icon: Zap, color: "#22c55e" },
    { label: "Taxa conclusão", value: `${kpis.taxaConclusao}%`, icon: CheckCircle2, color: "#fb923c" },
  ];

  if (isLoading) return null;

  return (
    <div
      className="rounded-2xl border p-5 mb-6"
      style={{
        background: "rgba(10,14,26,0.9)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-bold text-white">SDR — Hoje</h2>
        <span className="text-xs text-slate-500 ml-auto">
          {hoje.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl p-3 flex flex-col gap-1"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <Icon className="w-4 h-4 mb-1" style={{ color: c.color }} />
              <p className="text-xl font-bold text-white leading-none">{c.value}</p>
              <p className="text-[11px] text-slate-500 leading-tight">{c.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}