"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { trpc } from "@/lib/trpc/client";
import { Shield } from "lucide-react";

function getLvrColor(lvr: number): string {
  if (lvr > 90) return "#ef4444"; // red — high risk
  if (lvr > 80) return "#f59e0b"; // amber — leveraged
  return "#22c55e"; // green — safe
}

function getLvrLabel(lvr: number): string {
  if (lvr > 90) return "High Risk";
  if (lvr > 80) return "Leveraged";
  if (lvr > 60) return "Moderate";
  return "Low Risk";
}

export function LvrGaugeCard() {
  const { data: metrics, isLoading } = trpc.portfolio.getPropertyMetrics.useQuery(
    { period: "annual", sortBy: "alphabetical", sortOrder: "asc" },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <Card data-testid="lvr-gauge-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Portfolio LVR</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card data-testid="lvr-gauge-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Portfolio LVR</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Add properties and loans to see your LVR
          </div>
        </CardContent>
      </Card>
    );
  }

  const totals = metrics.reduce(
    (acc, m) => ({
      value: acc.value + m.currentValue,
      loans: acc.loans + m.totalLoans,
    }),
    { value: 0, loans: 0 }
  );

  const lvr = totals.value > 0 ? (totals.loans / totals.value) * 100 : 0;
  const clampedLvr = Math.min(lvr, 100);
  const color = getLvrColor(lvr);
  const label = getLvrLabel(lvr);

  // Gauge data: filled portion + remaining
  const gaugeData = [
    { name: "LVR", value: clampedLvr },
    { name: "Remaining", value: 100 - clampedLvr },
  ];

  return (
    <Card data-testid="lvr-gauge-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Portfolio LVR</CardTitle>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="85%"
                startAngle={180}
                endAngle={0}
                innerRadius={70}
                outerRadius={95}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="var(--color-muted)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-8">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {lvr.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
          </div>
        </div>
        {/* Risk band legend */}
        <div className="flex justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>&lt;80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>80-90%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>&gt;90%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
