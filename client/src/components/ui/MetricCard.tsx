import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  unit,
  change,
  icon: Icon,
  iconColor = "text-primary",
  className,
  loading,
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div
      className={cn(
        "card-premium p-5 flex flex-col gap-3 hover:border-border/80 transition-all duration-200",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground font-medium tracking-wide">{label}</span>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-primary/10", iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="metric-value">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      )}

      {change !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isPositive && "text-emerald-400",
            isNegative && "text-red-400",
            isNeutral && "text-muted-foreground"
          )}
        >
          {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
          {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
          {isNeutral && <Minus className="w-3.5 h-3.5" />}
          <span>
            {isPositive && "+"}
            {change !== 0 ? `${change.toFixed(1)}%` : "Sem variação"} vs. período anterior
          </span>
        </div>
      )}
    </div>
  );
}
