"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const color = percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className={cn("h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function BudgetWidget() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const { data: budgets, isLoading } = trpc.budget.list.useQuery(
    { month: currentMonth },
    { staleTime: 60_000 }
  );

  const monthLabel = currentMonth.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  // Find overall budget and category budgets
  const overallBudget = budgets?.find((b) => !b.personalCategoryId);
  const categoryBudgets = budgets
    ?.filter((b) => b.personalCategoryId)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const totalSpent = overallBudget?.spent ?? 0;
  const totalBudget = overallBudget ? Number(overallBudget.monthlyAmount) : 0;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalSpent;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Budget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-2 w-full bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 w-full bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state -- no budgets set up
  if (!budgets || budgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Budget</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Target className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Track your personal spending with monthly budgets
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/budget">Set up your budget</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Budget &mdash; {monthLabel}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span>{formatCurrency(totalSpent)} of {formatCurrency(totalBudget)}</span>
            <span className="text-muted-foreground">{Math.round(overallPercent)}%</span>
          </div>
          <ProgressBar percent={overallPercent} />
        </div>

        {/* Top categories */}
        {categoryBudgets && categoryBudgets.length > 0 && (
          <div className="space-y-2">
            {categoryBudgets.map((b) => {
              const budgetAmt = Number(b.monthlyAmount);
              const pct = budgetAmt > 0 ? (b.spent / budgetAmt) * 100 : 0;
              return (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <span className="w-24 truncate font-medium">{b.categoryName}</span>
                  <div className="flex-1">
                    <ProgressBar percent={pct} className="h-1.5" />
                  </div>
                  <span className="text-muted-foreground w-16 text-right">
                    {formatCurrency(b.spent)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Remaining */}
        <div className="flex items-center justify-between text-sm">
          <span className={cn(remaining >= 0 ? "text-green-600" : "text-red-600")}>
            {remaining >= 0
              ? `+${formatCurrency(remaining)} remaining`
              : `${formatCurrency(Math.abs(remaining))} over budget`}
          </span>
        </div>

        <Link
          href="/budget"
          className="text-xs text-primary hover:underline inline-block"
        >
          View full budget &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}
