import { cn } from "@/lib/utils";

interface ScoreIndicatorProps {
  label: string;
  value: string;
  percentile: number | null;
  className?: string;
}

function getPercentileCategory(percentile: number | null): {
  status: "excellent" | "average" | "below";
  label: string;
  colorClass: string;
  barColorClass: string;
} {
  if (percentile === null) {
    return {
      status: "average",
      label: "N/A",
      colorClass: "text-muted-foreground",
      barColorClass: "bg-muted-foreground/30",
    };
  }
  if (percentile > 75) {
    return {
      status: "excellent",
      label: "Excellent",
      colorClass: "text-green-600 dark:text-green-400",
      barColorClass: "bg-green-500",
    };
  }
  if (percentile >= 25) {
    return {
      status: "average",
      label: "Average",
      colorClass: "text-amber-600 dark:text-amber-400",
      barColorClass: "bg-amber-500",
    };
  }
  return {
    status: "below",
    label: "Below Average",
    colorClass: "text-red-600 dark:text-red-400",
    barColorClass: "bg-red-500",
  };
}

export function ScoreIndicator({
  label,
  value,
  percentile,
  className,
}: ScoreIndicatorProps) {
  const category = getPercentileCategory(percentile);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-medium", category.colorClass)}>
          {category.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold min-w-[60px]">{value}</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", category.barColorClass)}
            style={{ width: `${percentile ?? 0}%` }}
            role="progressbar"
            aria-valuenow={percentile ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label}: ${percentile ?? 0}th percentile`}
          />
        </div>
      </div>
    </div>
  );
}
