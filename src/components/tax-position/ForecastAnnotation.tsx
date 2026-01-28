"use client";

import { TrendingUp } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

interface ForecastAnnotationProps {
  actual: number;
  forecast: number;
}

export function ForecastAnnotation({ actual, forecast }: ForecastAnnotationProps) {
  // Don't show if forecast equals actual (category complete)
  if (forecast === actual) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-2">
      <TrendingUp className="h-3 w-3" />
      <span>&rarr; {formatCurrency(forecast)} projected</span>
    </span>
  );
}
