"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface CategoryRow {
  category: string;
  label: string;
  atoCode: string;
  isKeyExpense: boolean;
  currentYear: number;
  comparisonYear: number;
  change: number;
  changePercent: number | null;
  isSignificant: boolean;
}

interface YoYComparisonTableProps {
  categories: CategoryRow[];
  currentYearLabel: string;
  comparisonYearLabel: string;
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

function ChangeIndicator({ change, changePercent }: { change: number; changePercent: number | null }) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </span>
    );
  }

  // For expenses: increase = bad (amber), decrease = good (green)
  const isIncrease = change > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        isIncrease ? "text-amber-600" : "text-green-600",
      )}
    >
      {isIncrease ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      <span>{changePercent !== null ? `${Math.abs(changePercent)}%` : "New"}</span>
    </span>
  );
}

export function YoYComparisonTable({
  categories,
  currentYearLabel,
  comparisonYearLabel,
  totalCurrent,
  totalComparison,
  totalChange,
  totalChangePercent,
}: YoYComparisonTableProps) {
  const keyExpenses = categories.filter((c) => c.isKeyExpense);
  const otherExpenses = categories.filter((c) => !c.isKeyExpense);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Category</TableHead>
          <TableHead className="text-right">{comparisonYearLabel}</TableHead>
          <TableHead className="text-right">{currentYearLabel}</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead className="text-right">% Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keyExpenses.map((row) => (
          <TableRow
            key={row.category}
            className={cn(
              "border-l-2 border-l-blue-400",
              row.isSignificant && "bg-amber-50",
            )}
          >
            <TableCell className="font-medium">
              {row.label}
              <span className="ml-2 text-xs text-muted-foreground">{row.atoCode}</span>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(row.comparisonYear)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.currentYear)}</TableCell>
            <TableCell className={cn("text-right", row.change > 0 ? "text-amber-600" : row.change < 0 ? "text-green-600" : "")}>
              {row.change !== 0 ? (row.change > 0 ? "+" : "") + formatCurrency(row.change) : "-"}
            </TableCell>
            <TableCell className="text-right">
              <ChangeIndicator change={row.change} changePercent={row.changePercent} />
            </TableCell>
          </TableRow>
        ))}

        {keyExpenses.length > 0 && otherExpenses.length > 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-1">
              <div className="border-t border-dashed" />
            </TableCell>
          </TableRow>
        )}

        {otherExpenses.map((row) => (
          <TableRow
            key={row.category}
            className={cn(row.isSignificant && "bg-amber-50")}
          >
            <TableCell className="font-medium">
              {row.label}
              <span className="ml-2 text-xs text-muted-foreground">{row.atoCode}</span>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(row.comparisonYear)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.currentYear)}</TableCell>
            <TableCell className={cn("text-right", row.change > 0 ? "text-amber-600" : row.change < 0 ? "text-green-600" : "")}>
              {row.change !== 0 ? (row.change > 0 ? "+" : "") + formatCurrency(row.change) : "-"}
            </TableCell>
            <TableCell className="text-right">
              <ChangeIndicator change={row.change} changePercent={row.changePercent} />
            </TableCell>
          </TableRow>
        ))}

        <TableRow className="font-bold border-t-2">
          <TableCell>Total Expenses</TableCell>
          <TableCell className="text-right">{formatCurrency(totalComparison)}</TableCell>
          <TableCell className="text-right">{formatCurrency(totalCurrent)}</TableCell>
          <TableCell className={cn("text-right", totalChange > 0 ? "text-amber-600" : totalChange < 0 ? "text-green-600" : "")}>
            {totalChange !== 0 ? (totalChange > 0 ? "+" : "") + formatCurrency(totalChange) : "-"}
          </TableCell>
          <TableCell className="text-right">
            <ChangeIndicator change={totalChange} changePercent={totalChangePercent} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
