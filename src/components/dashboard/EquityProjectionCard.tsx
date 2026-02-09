"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc/client";
import { TrendingUp } from "lucide-react";

const GROWTH_RATE = 0.05; // 5% annual property growth (Australian long-term average)
const PROJECTION_YEARS = 25;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

interface ProjectionPoint {
  year: number;
  label: string;
  equity: number;
  propertyValue: number;
  loanBalance: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.dataKey === "equity" ? "Equity" : entry.dataKey === "propertyValue" ? "Value" : "Loans"}:{" "}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function EquityProjectionCard() {
  const { data: metrics, isLoading } = trpc.portfolio.getPropertyMetrics.useQuery(
    { period: "annual", sortBy: "alphabetical", sortOrder: "asc" },
    { staleTime: 60_000 }
  );

  const projectionData = useMemo<ProjectionPoint[]>(() => {
    if (!metrics || metrics.length === 0) return [];

    const totalValue = metrics.reduce((sum, m) => sum + m.currentValue, 0);
    const totalLoans = metrics.reduce((sum, m) => sum + m.totalLoans, 0);

    if (totalValue === 0) return [];

    const currentYear = new Date().getFullYear();
    const points: ProjectionPoint[] = [];

    for (let i = 0; i <= PROJECTION_YEARS; i += 5) {
      const growthMultiplier = Math.pow(1 + GROWTH_RATE, i);
      const projectedValue = totalValue * growthMultiplier;
      // Simple linear loan reduction over 30 years (rough P&I approximation)
      const loanReductionFraction = Math.min(i / 30, 1);
      const projectedLoan = totalLoans * (1 - loanReductionFraction);

      points.push({
        year: currentYear + i,
        label: i === 0 ? "Now" : `${currentYear + i}`,
        equity: Math.round(projectedValue - projectedLoan),
        propertyValue: Math.round(projectedValue),
        loanBalance: Math.round(projectedLoan),
      });
    }

    return points;
  }, [metrics]);

  if (isLoading) {
    return (
      <Card data-testid="equity-projection-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Equity Projection</CardTitle>
              <CardDescription>25-year equity growth forecast</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (projectionData.length === 0) {
    return (
      <Card data-testid="equity-projection-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Equity Projection</CardTitle>
              <CardDescription>25-year equity growth forecast</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Add properties to see your equity projection
          </div>
        </CardContent>
      </Card>
    );
  }

  const finalEquity = projectionData[projectionData.length - 1].equity;

  return (
    <Card data-testid="equity-projection-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Equity Projection</CardTitle>
              <CardDescription>25-year equity growth forecast</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(finalEquity)}</div>
            <p className="text-xs text-muted-foreground">
              projected in {PROJECTION_YEARS} years
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-muted"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={55}
              className="fill-muted-foreground"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#22c55e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Based on {(GROWTH_RATE * 100).toFixed(0)}% annual growth assumption.
          Actual results may vary.
        </p>
      </CardContent>
    </Card>
  );
}
