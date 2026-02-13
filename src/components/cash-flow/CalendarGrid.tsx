"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarEvent {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  source: "expected" | "loan" | "actual" | "forecast";
  status: "pending" | "matched" | "missed" | "confirmed" | "skipped";
}

interface CalendarGridProps {
  events: CalendarEvent[];
  month: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-first: Mon=0, Tue=1, ..., Sun=6
  return day === 0 ? 6 : day - 1;
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DOT_COLORS: Record<string, string> = {
  "income-confirmed": "bg-emerald-500",
  "income-matched": "bg-emerald-500",
  "income-pending": "bg-emerald-400",
  "income-missed": "bg-amber-500",
  "expense-confirmed": "bg-red-500",
  "expense-matched": "bg-red-500",
  "expense-pending": "bg-red-400",
  "expense-missed": "bg-amber-500",
  "expense-skipped": "bg-muted-foreground/40",
  "income-skipped": "bg-muted-foreground/40",
};

export function CalendarGrid({
  events,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = getDaysInMonth(year, m);
  const firstDay = getFirstDayOfMonth(year, m);
  const todayStr = new Date().toISOString().split("T")[0];

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const existing = eventsByDate.get(event.date) ?? [];
    existing.push(event);
    eventsByDate.set(event.date, existing);
  }

  const prevMonth = () => {
    const d = new Date(year, m - 1, 1);
    onMonthChange(d);
  };
  const nextMonth = () => {
    const d = new Date(year, m + 1, 1);
    onMonthChange(d);
  };

  const monthLabel = month.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">{monthLabel}</h3>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`empty-${i}`} className="bg-card p-2 min-h-[80px]" />
            );
          }

          const dateStr = formatDate(year, m, day);
          const dayEvents = eventsByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasMissed = dayEvents.some((e) => e.status === "missed");

          // Limit dots to 5 max
          const dots = dayEvents.slice(0, 5);
          const overflow = dayEvents.length - 5;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                "bg-card p-2 min-h-[80px] text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                isSelected && "bg-muted ring-2 ring-primary ring-inset",
                isToday && !isSelected && "ring-1 ring-primary/50 ring-inset"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  isToday && "text-primary font-bold",
                  hasMissed && "text-amber-600 dark:text-amber-400"
                )}
              >
                {day}
              </span>

              {/* Event dots */}
              {dots.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {dots.map((event) => {
                    const colorKey = `${event.type}-${event.status}`;
                    const isForecast = event.source === "forecast";
                    return (
                      <span
                        key={event.id}
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isForecast
                            ? "border border-blue-400 bg-transparent"
                            : DOT_COLORS[colorKey] ?? "bg-muted-foreground"
                        )}
                        title={`${event.type === "income" ? "+" : ""}$${Math.abs(event.amount).toLocaleString()}`}
                      />
                    );
                  })}
                  {overflow > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
