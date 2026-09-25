import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className }) {
  return (
    <Card className={cn(
      "relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 p-6",
      className
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-8 translate-x-8" />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {subtitle && (
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-3 text-sm font-medium",
              trendUp ? "text-emerald-400" : "text-rose-400"
            )}>
              <span>{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-blue-500/20">
            <Icon className="w-6 h-6 text-blue-400" />
          </div>
        )}
      </div>
    </Card>
  );
}