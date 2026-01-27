"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ValuationRecord {
  id: string;
  estimatedValue: string;
  confidenceLow: string | null;
  confidenceHigh: string | null;
  valueDate: string;
  source: string;
}

interface ValuationChartProps {
  history: ValuationRecord[];
  purchasePrice: number;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

const formatMonth = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "2-digit",
  }).format(date);
};

export function ValuationChart({ history, purchasePrice, isLoading }: ValuationChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Value History</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Value History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            No valuation history available. Generate history to see the chart.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map((v) => ({
    date: v.valueDate,
    label: formatMonth(v.valueDate),
    value: Number(v.estimatedValue),
    low: v.confidenceLow ? Number(v.confidenceLow) : undefined,
    high: v.confidenceHigh ? Number(v.confidenceHigh) : undefined,
    // For the area chart confidence band, we need the range as [low, high]
    range: v.confidenceLow && v.confidenceHigh
      ? [Number(v.confidenceLow), Number(v.confidenceHigh)]
      : undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Value History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-card border rounded-lg p-3 shadow-md">
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-lg font-bold">{formatCurrency(data.value)}</p>
                      {data.low && data.high && (
                        <p className="text-xs text-muted-foreground">
                          Range: {formatCurrency(data.low)} &mdash; {formatCurrency(data.high)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {/* Confidence band */}
              <Area
                type="monotone"
                dataKey="high"
                stroke="none"
                fill="hsl(217, 91%, 60%)"
                fillOpacity={0.1}
                name="Confidence Range"
              />
              <Area
                type="monotone"
                dataKey="low"
                stroke="none"
                fill="hsl(var(--card))"
                fillOpacity={1}
                name="Confidence Range Low"
              />
              {/* Main value line */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fill="none"
                name="Estimated Value"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(217, 91%, 60%)" }}
              />
              {/* Purchase price reference line */}
              <ReferenceLine
                y={purchasePrice}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: `Purchase: ${formatCurrency(purchasePrice)}`,
                  position: "insideBottomRight",
                  style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
