import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  X,
  Eye,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoConfig = {
  meta_atingida: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  meta_em_risco: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  anomalia: {
    icon: AlertTriangle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  baixa_performance: {
    icon: TrendingDown,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  alta_performance: {
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
};

const prioridadeConfig = {
  critica: { label: "Crítica", color: "bg-rose-500 text-white" },
  alta: { label: "Alta", color: "bg-orange-500 text-white" },
  media: { label: "Média", color: "bg-yellow-500 text-white" },
  baixa: { label: "Baixa", color: "bg-blue-500 text-white" },
};

export default function AlertasCard({ limitarAlertas = 5, mostrarTodos = false }) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState("todos");

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas", filtro],
    queryFn: async () => {
      let alertasData = await base44.entities.Alerta.filter({ resolvido: false });
      
      // Filtrar por destinatário
      alertasData = alertasData.filter(a => a.destinatarios?.includes(user.email));

      // Aplicar filtros
      if (filtro === "nao_visualizados") {
        alertasData = alertasData.filter(a => !a.visualizado_por?.includes(user.email));
      } else if (filtro === "criticos") {
        alertasData = alertasData.filter(a => a.prioridade === "critica" || a.prioridade === "alta");
      }

      // Ordenar por prioridade e data
      const ordemPrioridade = { critica: 0, alta: 1, media: 2, baixa: 3 };
      return alertasData.sort((a, b) => {
        const prioA = ordemPrioridade[a.prioridade] ?? 999;
        const prioB = ordemPrioridade[b.prioridade] ?? 999;
        if (prioA !== prioB) return prioA - prioB;
        return new Date(b.created_date) - new Date(a.created_date);
      });
    },
    enabled: !!user,
    refetchInterval: 30000, // Atualizar a cada 30s
  });

  const marcarVisualizadoMutation = useMutation({
    mutationFn: ({ id, visualizado_por }) =>
      base44.entities.Alerta.update(id, { visualizado_por }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
    },
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: ({ id }) =>
      base44.entities.Alerta.update(id, {
        resolvido: true,
        resolvido_por: user.email,
        resolvido_em: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      toast.success("Alerta arquivado!");
    },
  });

  const handleVisualizarAlerta = (alerta) => {
    if (!alerta.visualizado_por?.includes(user.email)) {
      const novosVisualizados = [...(alerta.visualizado_por || []), user.email];
      marcarVisualizadoMutation.mutate({
        id: alerta.id,
        visualizado_por: novosVisualizados,
      });
    }
  };

  const handleResolverAlerta = (alertaId) => {
    resolverAlertaMutation.mutate({ id: alertaId });
  };

  const alertasExibir = mostrarTodos ? alertas : alertas.slice(0, limitarAlertas);
  const alertasNaoVisualizados = alertas.filter(a => !a.visualizado_por?.includes(user.email)).length;

  if (alertas.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-8 text-center">
          <BellOff className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nenhum alerta ativo</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#ff6b35]" />
            Alertas
            {alertasNaoVisualizados > 0 && (
              <Badge className="bg-rose-500 text-white ml-2">
                {alertasNaoVisualizados}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {[
              { key: "todos", label: "Todos" },
              { key: "nao_visualizados", label: "Não Lidos" },
              { key: "criticos", label: "Críticos" },
            ].map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                onClick={() => setFiltro(key)}
                className={cn(
                  filtro === key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700/60 text-slate-300 hover:bg-slate-600 hover:text-white border border-slate-600/50"
                )}
              >
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              onClick={async () => {
                if (!window.confirm("Tem certeza que deseja limpar todos os alertas?")) return;
                await Promise.all(
                  alertas.map((a) =>
                    base44.entities.Alerta.update(a.id, {
                      resolvido: true,
                      resolvido_por: user?.email,
                      resolvido_em: new Date().toISOString(),
                    })
                  )
                );
                queryClient.invalidateQueries({ queryKey: ["alertas"] });
                toast.success("Todos os alertas foram limpos!");
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Limpar Todos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className={cn(mostrarTodos ? "h-[600px]" : "h-[400px]")}>
          <div className="space-y-3">
            {alertasExibir.map((alerta) => {
              const config = tipoConfig[alerta.tipo] || tipoConfig.anomalia;
              const Icon = config.icon;
              const prioInfo = prioridadeConfig[alerta.prioridade] || prioridadeConfig.media;
              const jaVisualizou = alerta.visualizado_por?.includes(user.email);

              return (
                <div
                  key={alerta.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    config.bg,
                    config.border,
                    !jaVisualizou && "ring-2 ring-blue-500/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.bg)}>
                      <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">{alerta.titulo}</h4>
                          <p className="text-slate-300 text-sm">{alerta.mensagem}</p>
                        </div>
                        <div className="flex gap-1">
                          {!jaVisualizou && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVisualizarAlerta(alerta)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResolverAlerta(alerta.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={prioInfo.color}>{prioInfo.label}</Badge>
                        {alerta.valor_atual !== undefined && (
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            Atual: {alerta.valor_atual} / Meta: {alerta.valor_esperado}
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(alerta.created_date), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}