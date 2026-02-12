"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc/client";
import { TrendingUp } from "lucide-react";
import { TimeRangeToggle } from "./TimeRangeToggle";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

function generateMonthLabels(count: number): string[] {
  const now = new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    labels.push(`${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`);
  }
  return labels;
}

export function PortfolioValueChart() {
  const [months, setMonths] = useState(6);
  const { data: properties } = trpc.property.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const hasProperties = properties && properties.length > 0;

  if (!hasProperties) {
    return (
      <Card className="animate-card-entrance" style={{ '--stagger-index': 4 } as React.CSSProperties}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Portfolio Value</CardTitle>
              <CardDescription>Track your portfolio value over time</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Add properties to see your portfolio value chart
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate trailing N-month placeholder data based on current property values
  const totalValue = properties.reduce((sum, p) => sum + (Number(p.purchasePrice) || 0), 0);
  const monthLabels = generateMonthLabels(months);
  const growthPerMonth = 0.06 / 12; // ~6% annual growth simulated
  const data = monthLabels.map((month, i) => ({
    month,
    value: Math.round(totalValue * (1 - growthPerMonth * (months - 1 - i))),
  }));

  return (
    <Card className="animate-card-entrance" style={{ '--stagger-index': 4 } as React.CSSProperties}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Portfolio Value</CardTitle>
              <CardDescription>Estimated total value over time</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground">{properties.length} {properties.length === 1 ? "property" : "properties"}</p>
            </div>
            <TimeRangeToggle value={months} onChange={setMonths} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#portfolioGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
