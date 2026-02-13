"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface DailyBalance {
  date: string;
  balance: number;
  isForecasted: boolean;
}

interface BalanceChartProps {
  data: DailyBalance[];
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[160px]">
      <p className="text-sm font-medium text-foreground mb-1">
        {formatDateShort(label)}
      </p>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Balance</span>
        <span className="font-medium">{formatCompact(payload[0].value)}</span>
      </div>
    </div>
  );
}

export function BalanceChart({ data }: BalanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No balance data available
      </div>
    );
  }

  const minBalance = Math.min(...data.map((d) => d.balance));
  const hasNegative = minBalance < 0;

  // Split into concrete and forecasted segments
  const chartData = data.map((d) => ({
    date: d.date,
    concrete: d.isForecasted ? undefined : d.balance,
    forecasted: d.isForecasted ? d.balance : undefined,
    balance: d.balance,
  }));

  // Find boundary between concrete and forecasted
  const lastConcreteIdx = chartData.findLastIndex((d) => d.concrete !== undefined);
  if (lastConcreteIdx >= 0 && lastConcreteIdx < chartData.length - 1) {
    chartData[lastConcreteIdx + 1].forecasted = chartData[lastConcreteIdx].concrete;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          className="stroke-muted"
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={60}
          className="fill-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Zero line if balance goes negative */}
        {hasNegative && (
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
        )}

        {/* Concrete balance area */}
        <Area
          dataKey="concrete"
          type="monotone"
          stroke="#22c55e"
          strokeWidth={2}
          fill="#22c55e"
          fillOpacity={0.1}
          connectNulls={false}
          dot={false}
        />

        {/* Forecasted balance area (dashed) */}
        <Area
          dataKey="forecasted"
          type="monotone"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="#3b82f6"
          fillOpacity={0.05}
          connectNulls={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
