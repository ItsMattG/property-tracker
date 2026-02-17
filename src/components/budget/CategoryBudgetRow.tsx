"use client";

import { cn, formatCurrency } from "@/lib/utils";

interface CategoryBudgetRowProps {
  id: string;
  categoryName: string | null;
  categoryIcon: string | null;
  spent: number;
  monthlyAmount: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

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

export function CategoryBudgetRow({
  id,
  categoryName,
  spent,
  monthlyAmount,
  isSelected,
  onSelect,
}: CategoryBudgetRowProps) {
  const budgetAmt = Number(monthlyAmount);
  const percent = budgetAmt > 0 ? (spent / budgetAmt) * 100 : 0;

  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors cursor-pointer",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted border border-transparent"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">
            {categoryName ?? "Overall"}
          </span>
          <span className={cn(
            "text-xs font-medium",
            percent >= 100 ? "text-red-600" : "text-muted-foreground"
          )}>
            {Math.round(percent)}%
          </span>
        </div>
        <ProgressBar percent={percent} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(spent)} spent</span>
          <span>of {formatCurrency(budgetAmt)}</span>
        </div>
      </div>
    </button>
  );
}
