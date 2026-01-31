"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartDataPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface ScenarioCashFlowChartProps {
  data: ChartDataPoint[];
}

export function ScenarioCashFlowChart({ data }: ScenarioCashFlowChartProps) {
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
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => `$${Number(value).toLocaleString()}`}
              />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#22c55e"
                name="Income"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                name="Expenses"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#3b82f6"
                name="Net"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
