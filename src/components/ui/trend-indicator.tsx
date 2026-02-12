"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  current: number;
  previous: number | null;
  format?: "currency" | "number" | "percent";
  invertColor?: boolean; // true = decrease is green (e.g., uncategorized)
  className?: string;
}

function formatChange(value: number, format: "currency" | "number" | "percent"): string {
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  switch (format) {
    case "currency":
      return `${sign}$${abs.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case "percent":
      return `${sign}${abs.toFixed(1)}%`;
    case "number":
    default:
      return `${sign}${abs}`;
  }
}

export function TrendIndicator({
  current,
  previous,
  format = "number",
  invertColor = false,
  className,
}: TrendIndicatorProps) {
  if (previous === null || previous === undefined) {
    return null;
  }

  const change = current - previous;
  const percentChange = previous !== 0 ? ((change / previous) * 100) : null;

  if (change === 0) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Minus className="h-3.5 w-3.5" />
        <span className="text-xs">No change</span>
      </div>
    );
  }

  const isPositiveChange = change > 0;
  const isGood = invertColor ? !isPositiveChange : isPositiveChange;

  const colorClass = isGood
    ? "text-green-700 dark:text-green-300"
    : "text-red-700 dark:text-red-300";

  const Icon = isPositiveChange ? TrendingUp : TrendingDown;

  return (
    <div className={cn("flex items-center gap-1", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">
        {formatChange(change, format)}
        {percentChange !== null && format === "currency" && (
          <span className="text-muted-foreground ml-0.5">
            ({percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%)
          </span>
        )}
      </span>
    </div>
  );
}
