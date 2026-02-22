"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ChartDataPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface FactorMarker {
  month: number;
  label: string;
  type: "rate_change" | "vacancy" | "sale" | "purchase";
}

interface ScenarioCashFlowChartProps {
  data: ChartDataPoint[];
  markers?: FactorMarker[];
}

const MARKER_STYLES: Record<FactorMarker["type"], { stroke: string; strokeDasharray: string }> = {
  rate_change: { stroke: "var(--color-chart-4)", strokeDasharray: "5 5" },
  vacancy: { stroke: "var(--color-chart-5)", strokeDasharray: "3 3" },
  sale: { stroke: "var(--color-destructive)", strokeDasharray: "0" },
  purchase: { stroke: "var(--color-chart-3)", strokeDasharray: "0" },
};

export function ScenarioCashFlowChart({ data, markers = [] }: ScenarioCashFlowChartProps) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Projection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
              {markers.map((m, i) => (
                <ReferenceLine
                  key={i}
                  x={data[m.month]?.month}
                  stroke={MARKER_STYLES[m.type].stroke}
                  strokeDasharray={MARKER_STYLES[m.type].strokeDasharray}
                  label={{ value: m.label, position: "top", fontSize: 10 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="income"
                stroke="var(--color-chart-1)"
                name="Income"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="var(--color-chart-2)"
                name="Expenses"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="var(--color-chart-3)"
                name="Net"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
