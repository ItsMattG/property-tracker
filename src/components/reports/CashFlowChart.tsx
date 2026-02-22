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
} from "recharts";
import { useChartColors } from "@/hooks/useChartColors";
import { formatCurrency } from "@/lib/utils";

interface MonthlyData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

interface CashFlowChartProps {
  data: MonthlyData[];
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${monthNames[Number(m) - 1]} ${year.slice(-2)}`;
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const colors = useChartColors();

  const chartData = data.map((d) => ({
    ...d,
    month: formatMonth(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: colors.textMuted }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: colors.textMuted }}
          tickFormatter={(v) => formatCurrency(v)}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          labelStyle={{ fontWeight: "bold" }}
          contentStyle={{
            backgroundColor: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="totalIncome"
          name="Income"
          stroke={colors.success}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="totalExpenses"
          name="Expenses"
          stroke={colors.danger}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="netIncome"
          name="Net"
          stroke={colors.info}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
