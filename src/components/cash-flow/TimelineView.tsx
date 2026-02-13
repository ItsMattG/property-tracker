"use client";

import { cn } from "@/lib/utils";
import { Check, Clock, AlertTriangle, SkipForward } from "lucide-react";

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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  confirmed: <Check className="h-3.5 w-3.5 text-emerald-500" />,
  matched: <Check className="h-3.5 w-3.5 text-emerald-500" />,
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  missed: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  skipped: <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />,
};

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
    <div className="space-y-1">
      {sortedDates.map((date) => {
        const dayEvents = grouped.get(date)!;
        const net = dayEvents.reduce((sum, e) => sum + e.amount, 0);
        const isSelected = date === selectedDate;

        return (
          <button
            key={date}
            onClick={() => onSelectDate(date)}
            className={cn(
              "w-full text-left rounded-lg p-3 transition-colors hover:bg-muted/50",
              isSelected && "bg-muted ring-1 ring-primary"
            )}
          >
            {/* Date header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">
                {formatDateLabel(date)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {net >= 0 ? "+" : "-"}${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Events */}
            <div className="space-y-1.5">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 text-sm"
                >
                  {/* Status icon */}
                  {STATUS_ICONS[event.status] ?? STATUS_ICONS.pending}

                  {/* Dot */}
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      event.source === "forecast"
                        ? "border border-blue-400 bg-transparent"
                        : event.type === "income"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                    )}
                  />

                  {/* Description */}
                  <span className="truncate flex-1 text-foreground">
                    {event.description}
                  </span>

                  {/* Property */}
                  {event.propertyAddress && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:block">
                      {event.propertyAddress.split(",")[0]}
                    </span>
                  )}

                  {/* Amount */}
                  <span
                    className={cn(
                      "font-medium tabular-nums shrink-0",
                      event.type === "income"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {event.amount >= 0 ? "+" : "-"}
                    ${Math.abs(event.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
