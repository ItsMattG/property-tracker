"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { PercentileResult, PerformanceInsight } from "@/types/performance-benchmarking";

interface PerformanceCardProps {
  propertyId: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-emerald-600";
  if (score >= 40) return "text-yellow-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

function getScoreBadgeVariant(
  label: string
): "default" | "secondary" | "destructive" | "outline" {
  if (label === "Excellent" || label === "Good") return "default";
  if (label === "Average") return "secondary";
  return "destructive";
}

function PercentileBar({
  label,
  result,
  inverted = false,
}: {
  label: string;
  result: PercentileResult | null;
  inverted?: boolean;
}) {
  if (!result) return null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {result.percentile}th percentile
        </span>
      </div>
      <Progress value={result.percentile} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Your: {result.value}
          {label === "Rental Yield" || label === "Expenses" ? "%" : ""}
        </span>
        <span>
          Median: {result.median}
          {label === "Rental Yield" || label === "Expenses" ? "%" : ""}
        </span>
      </div>
      {inverted && (
        <p className="text-xs text-muted-foreground italic">(lower is better)</p>
      )}
    </div>
  );
}

function InsightItem({ insight }: { insight: PerformanceInsight }) {
  const severityStyles = {
    positive: "bg-green-50 border-green-200 text-green-800",
    neutral: "bg-gray-50 border-gray-200 text-gray-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    critical: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded border text-sm",
        severityStyles[insight.severity]
      )}
    >
      <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{insight.message}</span>
    </div>
  );
}

export function PerformanceCard({ propertyId }: PerformanceCardProps) {
  const { data: performance, isLoading } =
    trpc.performanceBenchmarking.getPropertyPerformance.useQuery({
      propertyId,
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!performance) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <CardTitle>Market Performance</CardTitle>
          </div>
          <Badge variant={getScoreBadgeVariant(performance.scoreLabel)}>
            {performance.scoreLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score */}
        <div className="text-center">
          <div
            className={cn(
              "text-4xl font-bold",
              getScoreColor(performance.performanceScore)
            )}
          >
            {performance.performanceScore}
          </div>
          <p className="text-sm text-muted-foreground">Performance Score</p>
          <p className="text-xs text-muted-foreground mt-1">
            Compared to {performance.cohortSize} {performance.cohortDescription}
          </p>
        </div>

        {/* Underperforming warning */}
        {performance.isUnderperforming && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              This property is underperforming compared to similar properties
            </span>
          </div>
        )}

        {/* Percentile bars */}
        <div className="space-y-4">
          <PercentileBar label="Rental Yield" result={performance.yield} />
          <PercentileBar label="Capital Growth" result={performance.growth} />
          <PercentileBar label="Expenses" result={performance.expenses} inverted />
        </div>

        {/* Insights */}
        {performance.insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Insights</h4>
            {performance.insights.map((insight, i) => (
              <InsightItem key={i} insight={insight} />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Based on suburb market data. Updated{" "}
          {new Date(performance.calculatedAt).toLocaleDateString()}.
        </p>
      </CardContent>
    </Card>
  );
}
