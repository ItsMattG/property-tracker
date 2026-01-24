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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    month: formatMonth(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => formatCurrency(v)}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          labelStyle={{ fontWeight: "bold" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="totalIncome"
          name="Income"
          stroke="#22c55e"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="totalExpenses"
          name="Expenses"
          stroke="#ef4444"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="netIncome"
          name="Net"
          stroke="#3b82f6"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
