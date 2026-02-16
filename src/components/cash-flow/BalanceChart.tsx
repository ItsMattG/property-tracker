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

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/**
 * Fill date gaps in the balance series so Recharts draws continuous lines.
 * For each pair of consecutive points more than 1 day apart, insert:
 *   - one carry-forward entry the day after the first point
 *   - one carry-forward entry the day before the second point
 * This keeps the data sparse but ensures no visual gaps.
 */
function fillDateGaps(series: DailyBalance[]): DailyBalance[] {
  if (series.length < 2) return series;

  const result: DailyBalance[] = [];

  for (let i = 0; i < series.length; i++) {
    result.push(series[i]);

    if (i < series.length - 1) {
      const currentDate = new Date(series[i].date + "T00:00:00");
      const nextDate = new Date(series[i + 1].date + "T00:00:00");
      const diffDays = Math.round(
        (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays > 1) {
        // Insert carry-forward one day after current
        const dayAfter = new Date(currentDate);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const dayAfterStr = toLocalDateStr(dayAfter);

        result.push({
          date: dayAfterStr,
          balance: series[i].balance,
          isForecasted: series[i].isForecasted,
        });

        // Insert carry-forward one day before next (only if it's a different day)
        if (diffDays > 2) {
          const dayBefore = new Date(nextDate);
          dayBefore.setDate(dayBefore.getDate() - 1);
          const dayBeforeStr = toLocalDateStr(dayBefore);

          result.push({
            date: dayBeforeStr,
            balance: series[i].balance,
            isForecasted: series[i + 1].isForecasted,
          });
        }
      }
    }
  }

  return result;
}

export function BalanceChart({ data }: BalanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No balance data available
      </div>
    );
  }

  const filled = fillDateGaps(data);
  const today = toLocalDateStr(new Date());

  const minBalance = Math.min(...filled.map((d) => d.balance));
  const hasNegative = minBalance < 0;

  // Split into concrete and forecasted segments
  const chartData = filled.map((d) => ({
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

        {/* Today marker — where actuals end and projections begin */}
        <ReferenceLine
          x={today}
          stroke="var(--color-muted-foreground)"
          strokeDasharray="4 4"
          strokeWidth={1}
          label={{ value: "Today", position: "top", fontSize: 11, fill: "var(--color-muted-foreground)" }}
        />

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
