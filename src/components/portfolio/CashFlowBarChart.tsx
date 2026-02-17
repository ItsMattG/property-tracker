"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useChartColors } from "@/hooks/useChartColors";

interface CashFlowData {
  name: string;
  cashFlow: number;
}

interface CashFlowBarChartProps {
  data: CashFlowData[];
}

export function CashFlowBarChart({ data }: CashFlowBarChartProps) {
  const colors = useChartColors();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No cash flow data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: colors.textMuted }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value) => formatCurrency(value)}
          tick={{ fontSize: 12, fill: colors.textMuted }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            backgroundColor: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: "8px",
          }}
          labelStyle={{ fontWeight: "bold" }}
        />
        <ReferenceLine y={0} stroke={colors.textMuted} />
        <Bar dataKey="cashFlow" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.cashFlow >= 0 ? colors.success : colors.danger}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
