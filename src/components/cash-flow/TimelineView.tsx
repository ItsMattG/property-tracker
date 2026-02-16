"use client";

import {
  Home,
  Shield,
  Wrench,
  Building2,
  Landmark,
  Users,
  FileText,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface TimelineViewProps {
  events: CalendarEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

interface CategoryStyle {
  icon: LucideIcon;
  bg: string;
  text: string;
}

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; style: CategoryStyle }> = [
  {
    pattern: /rent|rental income/i,
    style: {
      icon: Home,
      bg: "bg-emerald-100 dark:bg-emerald-950",
      text: "text-emerald-600 dark:text-emerald-400",
    },
  },
  {
    pattern: /insurance|allianz/i,
    style: {
      icon: Shield,
      bg: "bg-blue-100 dark:bg-blue-950",
      text: "text-blue-600 dark:text-blue-400",
    },
  },
  {
    pattern: /plumb|maintenance|repair|bunnings|electrician|handyman/i,
    style: {
      icon: Wrench,
      bg: "bg-amber-100 dark:bg-amber-950",
      text: "text-amber-600 dark:text-amber-400",
    },
  },
  {
    pattern: /mortgage|loan|repayment/i,
    style: {
      icon: Building2,
      bg: "bg-purple-100 dark:bg-purple-950",
      text: "text-purple-600 dark:text-purple-400",
    },
  },
  {
    pattern: /council|water|strata|body corp/i,
    style: {
      icon: Landmark,
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-600 dark:text-slate-400",
    },
  },
  {
    pattern: /management|agent|ray white|property manag/i,
    style: {
      icon: Users,
      bg: "bg-indigo-100 dark:bg-indigo-950",
      text: "text-indigo-600 dark:text-indigo-400",
    },
  },
  {
    pattern: /tax|revenue|land tax/i,
    style: {
      icon: FileText,
      bg: "bg-orange-100 dark:bg-orange-950",
      text: "text-orange-600 dark:text-orange-400",
    },
  },
];

const DEFAULT_STYLE: CategoryStyle = {
  icon: Receipt,
  bg: "bg-gray-100 dark:bg-gray-800",
  text: "text-gray-600 dark:text-gray-400",
};

function getCategoryStyle(
  description: string,
  category: string,
): CategoryStyle {
  const searchStr = `${description} ${category}`;
  for (const { pattern, style } of CATEGORY_PATTERNS) {
    if (pattern.test(searchStr)) return style;
  }
  return DEFAULT_STYLE;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function TimelineView({
  events,
  selectedDate,
  onSelectDate,
}: TimelineViewProps) {
  // Group events by date
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const existing = grouped.get(event.date) ?? [];
    existing.push(event);
    grouped.set(event.date, existing);
  }

  const sortedDates = [...grouped.keys()].sort();

  if (sortedDates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No upcoming events in this period
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const dayEvents = grouped.get(date)!;
        const net = dayEvents.reduce((sum, e) => sum + e.amount, 0);

        return (
          <div key={date}>
            {/* Date section header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                {formatDateLabel(date)}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {net >= 0 ? "+" : "-"}$
                {Math.abs(net).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            {/* Transaction rows */}
            <div className="space-y-0.5">
              {dayEvents.map((event) => {
                const style = getCategoryStyle(
                  event.description,
                  event.category,
                );
                const Icon = style.icon;
                const isForecast = event.source === "forecast";

                return (
                  <button
                    key={event.id}
                    onClick={() => onSelectDate(date)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 text-left",
                      date === selectedDate && "bg-muted ring-1 ring-primary",
                    )}
                  >
                    {/* Category icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isForecast
                          ? "border-2 border-dashed border-blue-400 bg-transparent"
                          : style.bg,
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isForecast ? "text-blue-500" : style.text,
                        )}
                      />
                    </div>

                    {/* Description + category */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {event.category}
                        </span>
                        {event.status !== "confirmed" &&
                          event.status !== "matched" && (
                            <Badge
                              variant={
                                event.status === "missed"
                                  ? "warning"
                                  : "secondary"
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {event.status}
                            </Badge>
                          )}
                      </div>
                    </div>

                    {/* Property + amount */}
                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isForecast
                            ? "text-blue-600 dark:text-blue-400"
                            : event.type === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {event.amount >= 0 ? "+" : "-"}$
                        {Math.abs(event.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      {event.propertyAddress && (
                        <p className="text-xs text-muted-foreground truncate max-w-[140px] hidden sm:block">
                          {event.propertyAddress.split(",")[0]}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
