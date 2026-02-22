"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, TrendingUp } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface TaxHeroCardProps {
  refundOrOwing: number;
  isRefund: boolean;
  propertySavings: number;
  forecast?: {
    refundOrOwing: number;
    isRefund: boolean;
  } | null;
  monthsElapsed?: number;
  confidence?: "high" | "medium" | "low";
}

export function TaxHeroCard({
  refundOrOwing,
  isRefund,
  propertySavings,
  forecast,
  monthsElapsed,
  confidence,
}: TaxHeroCardProps) {
  const showForecast = forecast && monthsElapsed != null && monthsElapsed < 12;

  return (
    <Card
      className={cn(
        "border-0 shadow-lg",
        isRefund
          ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30"
          : "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30"
      )}
    >
      <CardContent className="pt-8 pb-6">
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {isRefund ? "Estimated Refund" : "Estimated Owing"}
          </p>
          <p
            className={cn(
              "text-5xl font-bold tracking-tight",
              isRefund ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
            )}
          >
            {formatCurrency(Math.abs(refundOrOwing))}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {propertySavings > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Home className="h-3 w-3" />
                Properties saved you {formatCurrency(propertySavings)}
              </Badge>
            )}
            {showForecast && (
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                Full year: {formatCurrency(Math.abs(forecast.refundOrOwing))}{" "}
                {forecast.isRefund ? "refund" : "owing"}
              </Badge>
            )}
            {confidence && <ConfidenceBadge confidence={confidence} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
