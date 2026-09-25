import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, CheckCircle2 } from "lucide-react";

export default function PerformanceIndicator({ value, type = "sdr", size = "md", showLabel = true }) {
  // Definir thresholds por tipo
  const thresholds = {
    sdr: { red: 60, yellow: 75 },
    closer: { red: 20, yellow: 30 }
  };

  const config = thresholds[type];
  const numValue = parseFloat(value) || 0;

  let status = "green";
  let color = "bg-emerald-500";
  let textColor = "text-emerald-500";
  let borderColor = "border-emerald-500";
  let label = type === "sdr" ? "Super Eficiente" : "Closer Eficiente";
  let icon = CheckCircle2;

  if (numValue < config.red) {
    status = "red";
    color = "bg-rose-500";
    textColor = "text-rose-500";
    borderColor = "border-rose-500";
    label = type === "sdr" ? "Problema de Qualificação" : "Problema de Vendas";
    icon = AlertCircle;
  } else if (numValue < config.yellow) {
    status = "yellow";
    color = "bg-yellow-500";
    textColor = "text-yellow-500";
    borderColor = "border-yellow-500";
    label = "Aceitável";
    icon = TrendingUp;
  }

  const sizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6"
  };

  const Icon = icon;

  if (!showLabel) {
    return (
      <div className={cn("rounded-full flex-shrink-0", color, sizes[size])} />
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 px-2 py-1",
        borderColor,
        "bg-opacity-10"
      )}
    >
      <div className={cn("rounded-full", color, sizes[size])} />
      <Icon className={cn("w-3 h-3", textColor)} />
      <span className={cn("text-xs font-medium", textColor)}>{label}</span>
    </Badge>
  );
}