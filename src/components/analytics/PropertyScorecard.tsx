"use client";

import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreIndicator } from "./ScoreIndicator";
import { cn, formatCurrency } from "@/lib/utils";
import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";

interface PropertyScorecardProps {
  entry: PropertyScorecardEntry;
  highlight?: boolean;
}

function getScoreBadgeVariant(
  scoreLabel: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (scoreLabel) {
    case "Excellent":
    case "Good":
      return "default";
    case "Average":
      return "secondary";
    case "Below Average":
    case "Poor":
      return "destructive";
    default:
      return "outline";
  }
}

export function PropertyScorecard({ entry, highlight }: PropertyScorecardProps) {
  return (
    <Card
      className={cn(
        "transition-shadow",
        highlight && "ring-2 ring-primary shadow-lg"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">{entry.address}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {entry.suburb}, {entry.state}
              </p>
            </div>
          </div>
          <Badge variant={getScoreBadgeVariant(entry.scoreLabel)}>
            {entry.performanceScore} - {entry.scoreLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-sm font-semibold">{formatCurrency(entry.currentValue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Purchase Price</p>
            <p className="text-sm font-semibold">{formatCurrency(entry.purchasePrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cap Rate</p>
            <p className="text-sm font-semibold">{entry.capRate}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Capital Growth</p>
            <p className={cn("text-sm font-semibold", entry.capitalGrowthPercent >= 0 ? "text-success" : "text-destructive")}>
              {entry.capitalGrowthPercent > 0 ? "+" : ""}{entry.capitalGrowthPercent}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Equity</p>
            <p className="text-sm font-semibold">{formatCurrency(entry.equity)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tax Deductions</p>
            <p className="text-sm font-semibold">{formatCurrency(entry.annualTaxDeductions)}</p>
          </div>
          {entry.cashOnCash !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Cash-on-Cash</p>
              <p className="text-sm font-semibold">{entry.cashOnCash}%</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Annual Rent</p>
            <p className="text-sm font-semibold">{formatCurrency(entry.annualRent)}</p>
          </div>
        </div>

        {/* Cash flow summary */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Annual Cash Flow</span>
            <span
              className={cn(
                "text-sm font-bold",
                entry.annualCashFlow >= 0
                  ? "text-success"
                  : "text-destructive"
              )}
            >
              {formatCurrency(entry.annualCashFlow)}
            </span>
          </div>
        </div>

        {/* Performance indicators */}
        <div className="space-y-3 pt-2 border-t">
          <ScoreIndicator
            label="Gross Yield"
            value={`${entry.grossYield}%`}
            percentile={entry.yieldPercentile}
          />
          <ScoreIndicator
            label="Net Yield"
            value={`${entry.netYield}%`}
            percentile={null}
          />
          <ScoreIndicator
            label="Expense Efficiency"
            value={
              entry.annualRent > 0
                ? `${Math.round((entry.annualExpenses / entry.annualRent) * 100)}%`
                : "--"
            }
            percentile={entry.expensePercentile}
          />
        </div>

        {entry.isUnderperforming && (
          <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs">
            This property is underperforming relative to similar properties in the area.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
