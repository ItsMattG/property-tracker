"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { trpc } from "@/lib/trpc/client";
import { Wallet } from "lucide-react";
import { TimeRangeToggle } from "./TimeRangeToggle";
import { formatCurrency } from "@/lib/utils";

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${monthNames[Number(m) - 1]} ${year.slice(-2)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const income = payload.find((p) => p.dataKey === "totalIncome")?.value ?? 0;
  const expenses =
    payload.find((p) => p.dataKey === "totalExpenses")?.value ?? 0;
  const net = payload.find((p) => p.dataKey === "netIncome")?.value ?? 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[180px]">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-emerald-500">Income</span>
          <span className="font-medium">{formatCurrency(income)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-red-500">Expenses</span>
          <span className="font-medium">{formatCurrency(expenses)}</span>
        </div>
        <div className="border-t border-border pt-1 flex justify-between text-sm">
          <span className="text-blue-500">Net</span>
          <span className="font-semibold">{formatCurrency(net)}</span>
        </div>
      </div>
    </div>
  );
}

export function CashFlowWidget() {
  const [months, setMonths] = useState(6);
  const { data, isLoading } = trpc.reports.portfolioSummary.useQuery(
    { months },
    { staleTime: 5 * 60_000, placeholderData: keepPreviousData }
  );

  const hasData = data && data.monthlyData.length > 0;

  if (isLoading) {
    return (
      <Card
        className="animate-card-entrance"
        style={{ "--stagger-index": 5 } as React.CSSProperties}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Cash Flow</CardTitle>
              <CardDescription>Monthly income vs expenses</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card
        className="animate-card-entrance"
        style={{ "--stagger-index": 5 } as React.CSSProperties}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Cash Flow</CardTitle>
                <CardDescription>Monthly income vs expenses</CardDescription>
              </div>
            </div>
            <TimeRangeToggle value={months} onChange={setMonths} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Add transactions to see your cash flow trends
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.monthlyData.map((d) => ({
    ...d,
    month: formatMonth(d.month),
  }));

  const netTotal = data.totals.netIncome;

  return (
    <Card
      className="animate-card-entrance"
      style={{ "--stagger-index": 5 } as React.CSSProperties}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Cash Flow</CardTitle>
              <CardDescription>Monthly income vs expenses</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div
                className={`text-2xl font-bold ${netTotal >= 0 ? "text-emerald-500" : "text-red-500"}`}
              >
                {formatCurrency(netTotal)}
              </div>
              <p className="text-xs text-muted-foreground">
                Net — last {months} months
              </p>
            </div>
            <TimeRangeToggle value={months} onChange={setMonths} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-muted"
            />
            <XAxis
              dataKey="month"
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
            <ReferenceLine
              y={0}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
            />
            <Bar
              dataKey="totalIncome"
              name="Income"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="totalExpenses"
              name="Expenses"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Line
              type="monotone"
              dataKey="netIncome"
              name="Net"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "#3b82f6", r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>Net</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
