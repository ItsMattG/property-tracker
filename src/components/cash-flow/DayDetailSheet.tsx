"use client";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Check, Clock, AlertTriangle, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

interface DayDetailSheetProps {
  date: string | null;
  events: CalendarEvent[];
  balance: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  confirmed: { icon: <Check className="h-3 w-3" />, label: "Confirmed", variant: "default" },
  matched: { icon: <Check className="h-3 w-3" />, label: "Matched", variant: "default" },
  pending: { icon: <Clock className="h-3 w-3" />, label: "Pending", variant: "secondary" },
  missed: { icon: <AlertTriangle className="h-3 w-3" />, label: "Missed", variant: "destructive" },
  skipped: { icon: <SkipForward className="h-3 w-3" />, label: "Skipped", variant: "outline" },
};

const SOURCE_LABELS: Record<string, string> = {
  expected: "Recurring",
  loan: "Loan repayment",
  actual: "Transaction",
  forecast: "Forecast",
};

function formatCategoryLabel(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DayDetailSheet({
  date,
  events,
  balance,
  open,
  onOpenChange,
}: DayDetailSheetProps) {
  if (!date) return null;

  const dateObj = new Date(date + "T00:00:00");
  const dateLabel = dateObj.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const net = events.reduce((sum, e) => sum + e.amount, 0);
  const incomeTotal = events
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0);
  const expenseTotal = events
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto gap-2">
        <SheetHeader className="pb-0">
          <SheetTitle>{dateLabel}</SheetTitle>
          <SheetDescription>
            {events.length} event{events.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <div className="text-xs text-muted-foreground mb-0.5">Income</div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                +${incomeTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="text-xs text-muted-foreground mb-0.5">Expenses</div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                -${expenseTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground mb-0.5">Net</div>
              <div className={cn(
                "text-sm font-semibold",
                net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {net >= 0 ? "+" : "-"}${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Balance after this day */}
          {balance !== null && (
            <div className="p-2.5 rounded-lg border">
              <div className="text-xs text-muted-foreground mb-0.5">
                Projected balance after this day
              </div>
              <div className={cn(
                "text-lg font-bold",
                balance >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400"
              )}>
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}

          {/* Event list */}
          <div className="space-y-2">
            {events.map((event) => {
              const statusConfig = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.pending;
              return (
                <div
                  key={event.id}
                  className="p-2.5 rounded-lg border space-y-1.5 cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {event.description}
                      </div>
                      {event.propertyAddress && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {event.propertyAddress}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums shrink-0",
                        event.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {event.amount >= 0 ? "+" : "-"}
                      ${Math.abs(event.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusConfig.variant} className="text-[10px] gap-1 h-5">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {SOURCE_LABELS[event.source] ?? event.source}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatCategoryLabel(event.category)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
