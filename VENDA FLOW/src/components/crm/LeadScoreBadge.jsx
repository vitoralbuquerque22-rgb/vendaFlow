import { Badge } from "@/components/ui/badge";
import { Flame, Zap, Snowflake, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LeadScoreBadge({ score, temperatura, size = "default", showLabel = true }) {
  const config = {
    quente: {
      icon: Flame,
      label: "Quente",
      gradient: "from-orange-500 to-red-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      text: "text-orange-400"
    },
    morno: {
      icon: Zap,
      label: "Morno",
      gradient: "from-yellow-500 to-orange-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-400"
    },
    frio: {
      icon: Snowflake,
      label: "Frio",
      gradient: "from-blue-500 to-cyan-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400"
    }
  };

  const temp = temperatura || 'frio';
  const Icon = config[temp].icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    default: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    default: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <Badge
      className={cn(
        "flex items-center gap-1.5 font-semibold border",
        config[temp].bg,
        config[temp].border,
        config[temp].text,
        sizeClasses[size]
      )}
    >
      <Icon className={cn(iconSizes[size], "animate-pulse")} />
      <span className="font-bold">{score}</span>
      {showLabel && (
        <>
          <span className="opacity-50">•</span>
          <span>{config[temp].label}</span>
        </>
      )}
    </Badge>
  );
}