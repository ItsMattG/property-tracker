"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Percent, Landmark, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalGain: number;
  totalGainPercent: number;
  annualizedGrowth: number;
  equity: number;
  lvr: number;
  hasLoans: boolean;
}

interface CapitalGrowthStatsProps {
  stats: Stats | null | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

export function CapitalGrowthStats({ stats, isLoading }: CapitalGrowthStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const gainPositive = stats.totalGain >= 0;

  const items = [
    {
      label: "Total Capital Gain",
      value: `${gainPositive ? "+" : ""}${formatCurrency(stats.totalGain)}`,
      sub: `${gainPositive ? "+" : ""}${stats.totalGainPercent.toFixed(1)}%`,
      icon: TrendingUp,
      color: gainPositive ? "text-green-600" : "text-red-600",
    },
    {
      label: "Annualized Growth",
      value: `${stats.annualizedGrowth.toFixed(1)}%`,
      sub: "per year",
      icon: Percent,
      color: stats.annualizedGrowth >= 0 ? "text-green-600" : "text-red-600",
    },
    ...(stats.hasLoans ? [
      {
        label: "Equity",
        value: formatCurrency(stats.equity),
        sub: "current equity",
        icon: Landmark,
        color: stats.equity >= 0 ? "text-blue-600" : "text-red-600",
      },
      {
        label: "LVR",
        value: `${stats.lvr.toFixed(1)}%`,
        sub: stats.lvr <= 80 ? "Below 80%" : "Above 80%",
        icon: ShieldCheck,
        color: stats.lvr <= 80 ? "text-green-600" : "text-amber-600",
      },
    ] : []),
  ];

  return (
    <div className={`grid grid-cols-2 ${stats.hasLoans ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4`}>
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
