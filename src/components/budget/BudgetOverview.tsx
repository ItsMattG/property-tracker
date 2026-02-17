"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { CategoryBudgetRow } from "./CategoryBudgetRow";

interface BudgetWithSpend {
  id: string;
  userId: string;
  personalCategoryId: string | null;
  monthlyAmount: string;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  createdAt: string | Date;
  spent: number;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryGroup: string | null;
}

interface BudgetOverviewProps {
  budgets: BudgetWithSpend[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  currentMonth: Date;
}

export function BudgetOverview({
  budgets,
  selectedCategoryId,
  onSelectCategory,
  currentMonth,
}: BudgetOverviewProps) {
  const [editingOverall, setEditingOverall] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const utils = trpc.useUtils();

  const updateBudget = trpc.budget.update.useMutation({
    onSuccess: () => {
      toast.success("Budget updated");
      utils.budget.list.invalidate();
      setEditingOverall(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const overallBudget = budgets.find((b) => !b.personalCategoryId);
  const categoryBudgets = budgets
    .filter((b) => b.personalCategoryId)
    .sort((a, b) => {
      const pctA = Number(a.monthlyAmount) > 0 ? a.spent / Number(a.monthlyAmount) : 0;
      const pctB = Number(b.monthlyAmount) > 0 ? b.spent / Number(b.monthlyAmount) : 0;
      return pctB - pctA;
    });

  const totalSpent = overallBudget?.spent ?? 0;
  const totalBudget = overallBudget ? Number(overallBudget.monthlyAmount) : 0;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overallColor = overallPercent >= 100 ? "text-red-600" : overallPercent >= 80 ? "text-amber-600" : "text-green-600";

  const handleSaveOverall = () => {
    if (!overallBudget || !editAmount || Number(editAmount) <= 0) return;
    updateBudget.mutate({
      id: overallBudget.id,
      monthlyAmount: String(Number(editAmount)),
    });
  };

  const monthLabel = currentMonth.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Budget Overview &mdash; {monthLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall budget summary */}
        {overallBudget && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Monthly Target</span>
              {!editingOverall ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{formatCurrency(totalBudget)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditAmount(String(totalBudget));
                      setEditingOverall(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-24 h-7 text-sm"
                    min={0}
                    step={100}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleSaveOverall}
                    disabled={updateBudget.isPending}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setEditingOverall(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(totalSpent)} spent
              </span>
              <span className={cn("font-medium", overallColor)}>
                {Math.round(overallPercent)}%
              </span>
            </div>
            {/* Overall progress bar */}
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  overallPercent >= 100
                    ? "bg-red-500"
                    : overallPercent >= 80
                      ? "bg-amber-500"
                      : "bg-green-500"
                )}
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Category budget rows */}
        {categoryBudgets.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              By Category
            </h3>
            {categoryBudgets.map((b) => (
              <CategoryBudgetRow
                key={b.id}
                id={b.id}
                categoryName={b.categoryName}
                categoryIcon={b.categoryIcon}
                spent={b.spent}
                monthlyAmount={b.monthlyAmount}
                isSelected={selectedCategoryId === b.personalCategoryId}
                onSelect={() => onSelectCategory(
                  selectedCategoryId === b.personalCategoryId ? null : b.personalCategoryId
                )}
              />
            ))}
          </div>
        )}

        {categoryBudgets.length === 0 && overallBudget && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No category budgets set. Use the setup to add per-category limits.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
