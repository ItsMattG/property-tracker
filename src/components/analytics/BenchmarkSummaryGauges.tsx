"use client";

import { Trophy, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { PortfolioScorecardSummary } from "@/types/performance-benchmarking";

type ScoreLabel = "Excellent" | "Good" | "Average" | "Below Average" | "Poor";

type BadgeVariant = "default" | "secondary" | "destructive" | "warning" | "outline";

interface BenchmarkSummaryGaugesProps {
  data: PortfolioScorecardSummary;
}

function getScoreLabel(score: number): ScoreLabel {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  if (score >= 20) return "Below Average";
  return "Poor";
}

function getScoreBadgeVariant(label: ScoreLabel): BadgeVariant {
  switch (label) {
    case "Excellent":
      return "default";
    case "Good":
    case "Average":
      return "secondary";
    case "Below Average":
      return "warning";
    case "Poor":
      return "destructive";
  }
}

export function BenchmarkSummaryGauges({ data }: BenchmarkSummaryGaugesProps) {
  const scoreLabel = getScoreLabel(data.averageScore);
  const badgeVariant = getScoreBadgeVariant(scoreLabel);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Portfolio Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Portfolio Score</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p
              className={cn(
                "text-2xl font-bold",
                data.averageScore >= 70
                  ? "text-success"
                  : data.averageScore >= 40
                    ? "text-warning"
                    : "text-destructive",
              )}
            >
              {Math.round(data.averageScore)}
            </p>
            <Badge variant={badgeVariant}>{scoreLabel}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Avg Gross Yield */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Avg Gross Yield</p>
          <p className="text-2xl font-bold mt-1">
            {formatPercent(data.averageGrossYield)}
          </p>
        </CardContent>
      </Card>

      {/* Annual Cash Flow */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Annual Cash Flow</p>
          </div>
          <p
            className={cn(
              "text-2xl font-bold mt-1",
              data.totalAnnualCashFlow >= 0
                ? "text-success"
                : "text-destructive",
            )}
          >
            {formatCurrency(data.totalAnnualCashFlow)}
          </p>
        </CardContent>
      </Card>

      {/* Top Performer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-success" />
            <p className="text-sm text-muted-foreground">Top Performer</p>
          </div>
          {data.bestPerformer ? (
            <>
              <p className="text-sm font-bold truncate mt-1">
                {data.bestPerformer.address}
              </p>
              <p className="text-xs text-muted-foreground">
                Score: {data.bestPerformer.score}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">--</p>
          )}
          {data.worstPerformer && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <AlertTriangle className="w-3 h-3 text-warning" />
              <span className="truncate">
                Weakest: {data.worstPerformer.address} ({data.worstPerformer.score})
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
