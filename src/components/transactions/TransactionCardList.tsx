"use client";

import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/categories";
import Link from "next/link";

interface TransactionCardItem {
  id: string;
  description: string | null;
  amount: string;
  date: string;
  category: string | null;
  verified: boolean | null;
}

interface TransactionCardListProps {
  transactions: TransactionCardItem[];
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function TransactionCardList({ transactions }: TransactionCardListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No transactions to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((txn) => {
        const amount = parseFloat(txn.amount);
        const isIncome = amount >= 0;

        return (
          <Link
            key={txn.id}
            href={`/transactions/${txn.id}/edit`}
            className="block"
          >
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {txn.description || "No description"}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums flex-shrink-0",
                      isIncome ? "text-green-600" : "text-foreground"
                    )}
                  >
                    {formatCurrency(txn.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(txn.date)}
                  </span>
                  {txn.category && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {getCategoryLabel(txn.category)}
                    </Badge>
                  )}
                  {txn.verified && (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
