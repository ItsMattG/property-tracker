"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface BudgetSetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CATEGORIES = [
  { categoryName: "Housing", group: "needs" as const, percent: 25 },
  { categoryName: "Groceries", group: "needs" as const, percent: 10 },
  { categoryName: "Transport", group: "needs" as const, percent: 10 },
  { categoryName: "Utilities", group: "needs" as const, percent: 5 },
  { categoryName: "Dining Out", group: "wants" as const, percent: 10 },
  { categoryName: "Entertainment", group: "wants" as const, percent: 10 },
  { categoryName: "Shopping", group: "wants" as const, percent: 10 },
  { categoryName: "Savings", group: "savings" as const, percent: 20 },
];

export function BudgetSetupSheet({ open, onOpenChange }: BudgetSetupSheetProps) {
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [useCategoryBudgets, setUseCategoryBudgets] = useState(false);
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();

  const setup = trpc.budget.setup.useMutation({
    onSuccess: () => {
      toast.success("Budget created successfully");
      utils.budget.list.invalidate();
      utils.budget.categoryList.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const targetNum = Number(monthlyTarget) || 0;

  // Pre-fill category amounts based on percentages when target changes
  const getCategoryAmount = (categoryName: string, defaultPercent: number): string => {
    if (categoryAmounts[categoryName] !== undefined) {
      return categoryAmounts[categoryName];
    }
    if (targetNum > 0) {
      return String(Math.round(targetNum * (defaultPercent / 100)));
    }
    return "";
  };

  const handleSubmit = () => {
    if (!monthlyTarget || targetNum <= 0) {
      toast.error("Please enter a valid monthly target");
      return;
    }

    const categoryBudgets = useCategoryBudgets
      ? DEFAULT_CATEGORIES.map((cat) => ({
          categoryName: cat.categoryName,
          group: cat.group,
          monthlyAmount: getCategoryAmount(cat.categoryName, cat.percent) || "0",
        })).filter((cb) => Number(cb.monthlyAmount) > 0)
      : undefined;

    setup.mutate({
      monthlyTarget: String(targetNum),
      categoryBudgets,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Set Up Your Budget</SheetTitle>
          <SheetDescription>
            Set a monthly spending target and optionally break it down by category.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {/* Monthly target */}
          <div className="space-y-2">
            <Label htmlFor="monthly-target">Monthly Spending Target</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="monthly-target"
                type="number"
                placeholder="5000"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(e.target.value)}
                className="pl-7"
                min={0}
                step={100}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              How much do you want to spend per month across all categories?
            </p>
          </div>

          {/* Category toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="category-toggle">Per-category limits</Label>
              <p className="text-xs text-muted-foreground">
                Break your budget down using the 50/30/20 rule
              </p>
            </div>
            <Switch
              id="category-toggle"
              checked={useCategoryBudgets}
              onCheckedChange={setUseCategoryBudgets}
            />
          </div>

          {/* Category budgets */}
          {useCategoryBudgets && targetNum > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Pre-filled using the 50/30/20 rule. Adjust as needed.
              </p>
              {DEFAULT_CATEGORIES.map((cat) => (
                <div key={cat.categoryName} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">{cat.categoryName}</Label>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({cat.group})
                    </span>
                  </div>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                      $
                    </span>
                    <Input
                      type="number"
                      value={getCategoryAmount(cat.categoryName, cat.percent)}
                      onChange={(e) =>
                        setCategoryAmounts((prev) => ({
                          ...prev,
                          [cat.categoryName]: e.target.value,
                        }))
                      }
                      className="pl-5 h-8 text-xs"
                      min={0}
                      step={50}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={setup.isPending || !monthlyTarget || targetNum <= 0}
            className="w-full"
          >
            {setup.isPending ? "Creating..." : "Create Budget"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
