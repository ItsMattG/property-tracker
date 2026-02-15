"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

type Confidence = "high" | "medium" | "low";

interface ForecastSummaryProps {
  forecastRefund: number;
  forecastIsRefund: boolean;
  monthsElapsed: number;
  confidence: Confidence;
}

export function ForecastSummary({
  forecastRefund,
  forecastIsRefund,
  monthsElapsed,
  confidence,
}: ForecastSummaryProps) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Full Year Projection
              </p>
              <p className="text-xs text-blue-700">
                {forecastIsRefund ? "Projected Refund" : "Projected Owing"}:{" "}
                <span className="font-semibold">
                  {formatCurrency(Math.abs(forecastRefund))}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-sm ${
                        i < monthsElapsed ? "bg-blue-500" : "bg-blue-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="ml-1">{monthsElapsed}/12</span>
              </div>
            </div>
            <ConfidenceBadge confidence={confidence} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
