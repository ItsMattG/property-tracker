"use client";

import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense";
  source: "expected" | "loan" | "actual" | "forecast";
  status: "pending" | "matched" | "missed" | "confirmed" | "skipped";
  propertyAddress: string | null;
}

interface CashFlowSummaryProps {
  events: CalendarEvent[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CashFlowSummary({ events }: CashFlowSummaryProps) {
  const totalIncome = events
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = events
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const netCashFlow = totalIncome - totalExpenses;

  const cards = [
    {
      label: "Total Income",
      value: totalIncome,
      icon: ArrowUpRight,
      iconBg: "bg-emerald-100 dark:bg-emerald-950",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Total Expenses",
      value: totalExpenses,
      icon: ArrowDownRight,
      iconBg: "bg-red-100 dark:bg-red-950",
      iconColor: "text-red-600 dark:text-red-400",
      valueColor: "text-red-700 dark:text-red-300",
    },
    {
      label: "Net Cash Flow",
      value: netCashFlow,
      icon: netCashFlow >= 0 ? TrendingUp : TrendingDown,
      iconBg: netCashFlow >= 0
        ? "bg-emerald-100 dark:bg-emerald-950"
        : "bg-red-100 dark:bg-red-950",
      iconColor: netCashFlow >= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400",
      valueColor: netCashFlow >= 0
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-red-700 dark:text-red-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <Card
          key={card.label}
          className="animate-card-entrance"
          style={{ "--stagger-index": i } as React.CSSProperties}
        >
          <CardContent className="flex items-center gap-4 pt-6">
            <div className={cn("p-2.5 rounded-lg", card.iconBg)}>
              <card.icon className={cn("h-5 w-5", card.iconColor)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {card.label}
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", card.valueColor)}>
                {formatCurrency(card.value)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
