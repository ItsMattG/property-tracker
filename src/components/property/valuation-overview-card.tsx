"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  currentValue: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  monthlyChange: number | null;
  monthlyChangePercent: number | null;
  lastUpdated: string;
  source: string;
}

interface ValuationOverviewCardProps {
  stats: Stats | null | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));

const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    manual: "Manual",
    mock: "Estimated",
    corelogic: "CoreLogic",
    proptrack: "PropTrack",
  };
  return labels[source] || source;
};

export function ValuationOverviewCard({ stats, isLoading }: ValuationOverviewCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Estimated Value</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Estimated Value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No valuation data available. Click &quot;Generate History&quot; to create mock valuations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const changePositive = stats.monthlyChange !== null && stats.monthlyChange > 0;
  const changeNegative = stats.monthlyChange !== null && stats.monthlyChange < 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle>Current Estimated Value</CardTitle>
          <Badge variant="outline">{getSourceLabel(stats.source)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrency(stats.currentValue)}
          </p>
          {stats.monthlyChange !== null && stats.monthlyChangePercent !== null && (
            <div className={`flex items-center gap-1 pb-1 ${
              changePositive ? "text-green-600" : changeNegative ? "text-red-600" : "text-muted-foreground"
            }`}>
              {changePositive ? <TrendingUp className="h-4 w-4" /> :
               changeNegative ? <TrendingDown className="h-4 w-4" /> :
               <Minus className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {changePositive ? "+" : ""}{formatCurrency(stats.monthlyChange)}
                {" "}({changePositive ? "+" : ""}{stats.monthlyChangePercent.toFixed(1)}%)
              </span>
              <span className="text-xs text-muted-foreground">this month</span>
            </div>
          )}
        </div>

        {stats.confidenceLow !== null && stats.confidenceHigh !== null && (
          <p className="text-sm text-muted-foreground">
            Confidence range: {formatCurrency(stats.confidenceLow)} &mdash; {formatCurrency(stats.confidenceHigh)}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Last updated: {formatDate(stats.lastUpdated)}
        </p>
      </CardContent>
    </Card>
  );
}
