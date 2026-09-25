import { useEffect } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listarAlertasNaoResolvidos } from "@/lib/services/alertaService";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Bell } from "lucide-react";

const tipoConfig = {
  meta_atingida: {
    icon: CheckCircle2,
    color: "#10b981",
  },
  meta_em_risco: {
    icon: AlertTriangle,
    color: "#f59e0b",
  },
  anomalia: {
    icon: AlertTriangle,
    color: "#ef4444",
  },
  baixa_performance: {
    icon: TrendingDown,
    color: "#ef4444",
  },
  alta_performance: {
    icon: TrendingUp,
    color: "#3b82f6",
  },
  tarefa_concluida: {
    icon: CheckCircle2,
    color: "#10b981",
  },
};

export default function AlertasNotificacao() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: alertasNaoVisualizados = [] } = useQuery({
    queryKey: ["alertas-nao-visualizados"],
    queryFn: async () => {
      const alertas = await listarAlertasNaoResolvidos();
      return alertas.filter(
        (a) =>
          a.destinatarios?.includes(user.email) &&
          !a.visualizado_por?.includes(user.email)
      );
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (alertasNaoVisualizados.length > 0) {
      alertasNaoVisualizados.forEach((alerta) => {
        const config = tipoConfig[alerta.tipo] || tipoConfig.anomalia;
        const Icon = config.icon;

        // Verificar se já mostramos esse alerta (usando localStorage para evitar duplicatas)
        const alertasExibidos = JSON.parse(localStorage.getItem("alertasExibidos") || "[]");
        if (!alertasExibidos.includes(alerta.id)) {
          // Mostrar notificação
          if (alerta.prioridade === "critica" || alerta.prioridade === "alta") {
            toast.error(alerta.titulo, {
              description: alerta.mensagem,
              icon: <Icon style={{ color: config.color }} />,
              duration: 10000,
              action: {
                label: "Ver",
                onClick: () => {
                  window.location.href = "/ConfiguracaoAlertas";
                },
              },
            });
          } else {
            toast(alerta.titulo, {
              description: alerta.mensagem,
              icon: <Icon style={{ color: config.color }} />,
              duration: 7000,
              action: {
                label: "Ver",
                onClick: () => {
                  window.location.href = "/ConfiguracaoAlertas";
                },
              },
            });
          }

          // Marcar como exibido
          alertasExibidos.push(alerta.id);
          localStorage.setItem("alertasExibidos", JSON.stringify(alertasExibidos));

          // Limpar localStorage após 24h para não acumular infinitamente
          setTimeout(() => {
            const stored = JSON.parse(localStorage.getItem("alertasExibidos") || "[]");
            const filtered = stored.filter((id) => id !== alerta.id);
            localStorage.setItem("alertasExibidos", JSON.stringify(filtered));
          }, 24 * 60 * 60 * 1000);
        }
      });
    }
  }, [alertasNaoVisualizados]);

  return null; // Componente invisível, só para lógica
}