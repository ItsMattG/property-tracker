"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";

interface SpendingActivityProps {
  selectedCategoryId: string | null;
  currentMonth: Date;
}

export function SpendingActivity({
  selectedCategoryId,
  currentMonth,
}: SpendingActivityProps) {
  // Monthly summary for trend chart (when no category selected)
  const { data: monthlySummary, isLoading: summaryLoading } =
    trpc.budget.monthlySummary.useQuery(
      { months: 6 },
      { staleTime: 60_000, enabled: !selectedCategoryId }
    );

  // Surplus insight
  const { data: surplus } = trpc.budget.surplus.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Transaction list when category is selected
  const startDate = useMemo(() => {
    const d = new Date(currentMonth);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentMonth]);

  const endDate = useMemo(() => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [currentMonth]);

  const { data: transactions, isLoading: txLoading } =
    trpc.budget.transactionList.useQuery(
      {
        categoryId: selectedCategoryId ?? undefined,
        startDate,
        endDate,
        limit: 50,
        offset: 0,
      },
      { staleTime: 30_000, enabled: !!selectedCategoryId }
    );

  // Transform monthly summary for the chart
  const chartData = useMemo(() => {
    if (!monthlySummary) return [];
    return monthlySummary.map((m) => ({
      name: new Date(m.month + "-01").toLocaleDateString("en-AU", {
        month: "short",
      }),
      expenses: m.expenses,
      income: m.income,
    }));
  }, [monthlySummary]);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {selectedCategoryId ? "Category Transactions" : "Spending Trends"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trend chart (no category selected) */}
        {!selectedCategoryId && (
          <>
            {summaryLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="h-full w-full bg-muted animate-pulse rounded" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatCurrencyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelStyle={{ fontWeight: "bold" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-card)",
                      }}
                    />
                    <Bar
                      dataKey="expenses"
                      fill="var(--color-destructive)"
                      radius={[4, 4, 0, 0]}
                      name="Expenses"
                    />
                    <Bar
                      dataKey="income"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      name="Income"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No spending data yet. Add transactions to see trends.
              </div>
            )}
          </>
        )}

        {/* Transaction list (category selected) */}
        {selectedCategoryId && (
          <>
            {txLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : transactions && transactions.transactions.length > 0 ? (
              <div className="space-y-1">
                {transactions.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        Number(tx.amount) < 0 ? "text-red-600" : "text-green-600"
                      )}
                    >
                      {formatCurrency(Math.abs(Number(tx.amount)))}
                    </span>
                  </div>
                ))}
                {transactions.total > transactions.transactions.length && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Showing {transactions.transactions.length} of{" "}
                    {transactions.total} transactions
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                No transactions in this category for the selected month.
              </div>
            )}
          </>
        )}

        {/* Surplus insight */}
        {surplus && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monthly Surplus Insight
            </h4>
            <div className="flex items-center justify-between text-sm">
              <span>Avg. Income</span>
              <span className="font-medium">
                {formatCurrency(surplus.avgMonthlyIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Avg. Expenses</span>
              <span className="font-medium">
                {formatCurrency(surplus.avgMonthlyExpenses)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
              <span className="font-medium">Monthly Surplus</span>
              <span
                className={cn(
                  "font-bold",
                  surplus.monthlySurplus >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(surplus.monthlySurplus)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
