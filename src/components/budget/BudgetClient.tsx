"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { BudgetOverview } from "./BudgetOverview";
import { SpendingActivity } from "./SpendingActivity";
import { BudgetSetupSheet } from "./BudgetSetupSheet";

export function BudgetClient() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

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
    // Reset category selection when changing months
    setSelectedCategoryId(null);
  };

  const hasBudgets = budgets && budgets.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  // Empty state -- no budgets yet
  if (!hasBudgets) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground">
            Track your personal spending with monthly budgets.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Target className="h-12 w-12 text-muted-foreground" />
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold">No budget set up yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Set a monthly spending target and optionally break it down by
              category to track where your money goes.
            </p>
          </div>
          <Button onClick={() => setSetupOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Set Up Budget
          </Button>
        </div>

        <BudgetSetupSheet open={setupOpen} onOpenChange={setSetupOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Budget</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track your personal spending against monthly targets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] sm:min-w-[140px] text-center">
            {monthLabel}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetOverview
          budgets={budgets}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          currentMonth={currentMonth}
        />
        <SpendingActivity
          selectedCategoryId={selectedCategoryId}
          currentMonth={currentMonth}
        />
      </div>

      <BudgetSetupSheet open={setupOpen} onOpenChange={setSetupOpen} />
    </div>
  );
}
