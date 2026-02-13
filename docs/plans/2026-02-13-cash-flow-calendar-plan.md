# Cash Flow Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cash flow calendar showing upcoming/recurring loan repayments, rental income, and projected account balances — as a full page (`/cash-flow`) and a compact dashboard widget.

**Architecture:** New `cashFlowCalendar` tRPC router aggregates data from existing `expectedTransactions`, `loans`, `transactions`, and `cashFlowForecasts` tables into a unified calendar events API. Custom-built calendar grid component (no library), Recharts area chart for balance projection, Sheet for day detail panel. Dashboard widget shows next 14 days with sparkline.

**Tech Stack:** Next.js App Router, tRPC, Drizzle ORM, Recharts, Tailwind CSS, Lucide icons, shadcn/ui (Card, Sheet, Select)

---

### Task 1: Feature flag + nav item + empty page shell

**Files:**
- Modify: `src/config/feature-flags.ts`
- Modify: `src/components/layout/Sidebar.tsx`
- Create: `src/app/(dashboard)/cash-flow/page.tsx`

**Step 1: Add feature flag**

In `src/config/feature-flags.ts`, add `cashFlow: true` to the main navigation section:

```typescript
// ── Main navigation ───────────────────────────────────────────────
discover: false,
alerts: false,
portfolio: false,
forecast: false,
cashFlow: true,
```

Also add the route-to-flag mapping:

```typescript
"/cash-flow": "cashFlow",
```

**Step 2: Add sidebar nav item**

In `src/components/layout/Sidebar.tsx`, add `CalendarDays` to the lucide-react import, then add to the "Reports & Tax" nav group:

```typescript
import { ..., CalendarDays } from "lucide-react";

// In navGroups, "Reports & Tax" items array:
{ href: "/cash-flow", label: "Cash Flow", icon: CalendarDays, featureFlag: "cashFlow" },
```

**Step 3: Create empty page shell**

Create `src/app/(dashboard)/cash-flow/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cash Flow | BrickTrack",
  description: "Track upcoming payments, income, and projected balances",
};

export default function CashFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cash Flow</h2>
        <p className="text-muted-foreground">
          Track upcoming payments, income, and projected balances
        </p>
      </div>
    </div>
  );
}
```

**Step 4: Verify page loads**

Run: `npm run dev`
Navigate to `http://localhost:3000/cash-flow` — should show header text. Sidebar should show "Cash Flow" under Reports & Tax.

**Step 5: Commit**

```bash
git add src/config/feature-flags.ts src/components/layout/Sidebar.tsx src/app/\(dashboard\)/cash-flow/page.tsx
git commit -m "feat: add cash flow page shell with feature flag and nav item"
```

---

### Task 2: tRPC router — `cashFlowCalendar.getEvents`

**Files:**
- Create: `src/server/routers/cashFlowCalendar.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the router**

Create `src/server/routers/cashFlowCalendar.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  expectedTransactions,
  recurringTransactions,
  transactions,
  loans,
  properties,
  bankAccounts,
  cashFlowForecasts,
  forecastScenarios,
} from "../db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { calculateNextDates } from "../services/recurring";

interface CalendarEvent {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense";
  source: "expected" | "loan" | "actual" | "forecast";
  status: "pending" | "matched" | "missed" | "confirmed" | "skipped";
  propertyId: string | null;
  propertyAddress: string | null;
}

interface DailyBalance {
  date: string;
  balance: number;
  isForecasted: boolean;
}

export const cashFlowCalendarRouter = router({
  getEvents: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string(),
        propertyId: z.string().uuid().optional(),
        scenarioId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.portfolio.ownerId;
      const { startDate, endDate, propertyId, scenarioId } = input;

      // Fetch active properties for address lookup
      const userProperties = await ctx.db.query.properties.findMany({
        where: and(
          eq(properties.userId, userId),
          eq(properties.status, "active")
        ),
        columns: { id: true, address: true },
      });
      const propertyMap = new Map(userProperties.map((p) => [p.id, p.address]));
      const propertyIds = propertyId
        ? [propertyId]
        : userProperties.map((p) => p.id);

      if (propertyIds.length === 0) {
        return { events: [] as CalendarEvent[], projectedBalances: [] as DailyBalance[] };
      }

      // 1. Expected transactions (recurring)
      const expectedFilter = and(
        eq(expectedTransactions.userId, userId),
        gte(expectedTransactions.expectedDate, startDate),
        lte(expectedTransactions.expectedDate, endDate),
        ...(propertyId
          ? [eq(expectedTransactions.propertyId, propertyId)]
          : [])
      );
      const expectedRows = await ctx.db.query.expectedTransactions.findMany({
        where: expectedFilter,
        with: { recurringTransaction: { columns: { description: true, category: true, transactionType: true } } },
      });
      const matchedTransactionIds = expectedRows
        .filter((e) => e.matchedTransactionId)
        .map((e) => e.matchedTransactionId!);

      const expectedEvents: CalendarEvent[] = expectedRows.map((e) => ({
        id: `expected-${e.id}`,
        date: e.expectedDate,
        amount: Number(e.expectedAmount),
        description: e.recurringTransaction?.description ?? "Recurring",
        category: e.recurringTransaction?.category ?? "uncategorized",
        type: e.recurringTransaction?.transactionType === "income" ? "income" : "expense",
        source: "expected" as const,
        status: e.status as CalendarEvent["status"],
        propertyId: e.propertyId,
        propertyAddress: propertyMap.get(e.propertyId) ?? null,
      }));

      // 2. Loan repayments (generated on-the-fly)
      const userLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, userId),
          ...(propertyId ? [eq(loans.propertyId, propertyId)] : [])
        ),
      });

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const loanEvents: CalendarEvent[] = [];

      for (const loan of userLoans) {
        const freqMap: Record<string, string> = {
          weekly: "weekly",
          fortnightly: "fortnightly",
          monthly: "monthly",
          quarterly: "quarterly",
          annually: "annually",
        };
        const frequency = freqMap[loan.repaymentFrequency] ?? "monthly";
        const dates = calculateNextDates(
          {
            frequency,
            dayOfMonth: null,
            dayOfWeek: null,
            startDate: startDate < todayStr ? todayStr : startDate,
            endDate: endDate,
          },
          new Date(startDate),
          Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
        );

        for (const d of dates) {
          const dateStr = d.toISOString().split("T")[0];
          if (dateStr >= startDate && dateStr <= endDate) {
            loanEvents.push({
              id: `loan-${loan.id}-${dateStr}`,
              date: dateStr,
              amount: -Math.abs(Number(loan.repaymentAmount)),
              description: `${loan.lender} repayment`,
              category: "interest_on_loans",
              type: "expense",
              source: "loan",
              status: dateStr < todayStr ? "confirmed" : "pending",
              propertyId: loan.propertyId,
              propertyAddress: propertyMap.get(loan.propertyId) ?? null,
            });
          }
        }
      }

      // 3. Actual transactions (historical portion)
      const actualFilter = and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        ...(propertyId ? [eq(transactions.propertyId, propertyId)] : []),
        // Exclude transactions that are already matched to expected transactions
        ...(matchedTransactionIds.length > 0
          ? [sql`${transactions.id} NOT IN (${sql.join(matchedTransactionIds.map((id) => sql`${id}`), sql`, `)})`]
          : [])
      );
      const actualRows = await ctx.db.query.transactions.findMany({
        where: actualFilter,
        columns: {
          id: true,
          date: true,
          amount: true,
          description: true,
          category: true,
          transactionType: true,
          propertyId: true,
        },
      });

      const actualEvents: CalendarEvent[] = actualRows.map((t) => ({
        id: `actual-${t.id}`,
        date: t.date,
        amount: Number(t.amount),
        description: t.description,
        category: t.category,
        type: t.transactionType === "income" ? "income" : "expense",
        source: "actual" as const,
        status: "confirmed" as const,
        propertyId: t.propertyId,
        propertyAddress: t.propertyId ? (propertyMap.get(t.propertyId) ?? null) : null,
      }));

      // 4. Forecast scenario (optional)
      let forecastEvents: CalendarEvent[] = [];
      const activeScenarioId = scenarioId ?? null;
      let effectiveScenarioId = activeScenarioId;

      if (!effectiveScenarioId) {
        const defaultScenario = await ctx.db.query.forecastScenarios.findFirst({
          where: and(
            eq(forecastScenarios.userId, userId),
            eq(forecastScenarios.isDefault, true)
          ),
        });
        effectiveScenarioId = defaultScenario?.id ?? null;
      }

      if (effectiveScenarioId) {
        const forecasts = await ctx.db.query.cashFlowForecasts.findMany({
          where: and(
            eq(cashFlowForecasts.userId, userId),
            eq(cashFlowForecasts.scenarioId, effectiveScenarioId),
            ...(propertyId
              ? [eq(cashFlowForecasts.propertyId, propertyId)]
              : [])
          ),
        });

        for (const f of forecasts) {
          // forecastMonth is "YYYY-MM", map to first of month
          const monthDate = `${f.forecastMonth}-01`;
          if (monthDate >= startDate && monthDate <= endDate) {
            if (Number(f.projectedIncome) > 0) {
              forecastEvents.push({
                id: `forecast-income-${f.id}`,
                date: monthDate,
                amount: Number(f.projectedIncome),
                description: "Projected income",
                category: "rental_income",
                type: "income",
                source: "forecast",
                status: "pending",
                propertyId: f.propertyId,
                propertyAddress: propertyMap.get(f.propertyId) ?? null,
              });
            }
            if (Number(f.projectedExpenses) > 0) {
              forecastEvents.push({
                id: `forecast-expense-${f.id}`,
                date: monthDate,
                amount: -Math.abs(Number(f.projectedExpenses)),
                description: "Projected expenses",
                category: "uncategorized",
                type: "expense",
                source: "forecast",
                status: "pending",
                propertyId: f.propertyId,
                propertyAddress: propertyMap.get(f.propertyId) ?? null,
              });
            }
          }
        }
      }

      // Combine all events
      const events = [
        ...expectedEvents,
        ...loanEvents,
        ...actualEvents,
        ...forecastEvents,
      ].sort((a, b) => a.date.localeCompare(b.date));

      // 5. Projected balances
      // Get current bank account balances
      const accounts = await ctx.db.query.bankAccounts.findMany({
        where: eq(bankAccounts.userId, userId),
        columns: { balance: true },
      });
      let runningBalance = accounts.reduce(
        (sum, a) => sum + Number(a.balance ?? 0),
        0
      );

      const balanceMap = new Map<string, number>();
      for (const event of events) {
        const existing = balanceMap.get(event.date) ?? 0;
        balanceMap.set(event.date, existing + event.amount);
      }

      const projectedBalances: DailyBalance[] = [];
      const sortedDates = [...balanceMap.keys()].sort();
      for (const date of sortedDates) {
        runningBalance += balanceMap.get(date)!;
        projectedBalances.push({
          date,
          balance: Math.round(runningBalance * 100) / 100,
          isForecasted: date > todayStr,
        });
      }

      return { events, projectedBalances };
    }),

  getProperties: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.properties.findMany({
      where: and(
        eq(properties.userId, ctx.portfolio.ownerId),
        eq(properties.status, "active")
      ),
      columns: { id: true, address: true },
      orderBy: (t, { asc }) => [asc(t.address)],
    });
  }),
});
```

**Step 2: Register the router**

In `src/server/routers/_app.ts`, add:

```typescript
import { cashFlowCalendarRouter } from "./cashFlowCalendar";

// In the appRouter object:
cashFlowCalendar: cashFlowCalendarRouter,
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/server/routers/cashFlowCalendar.ts src/server/routers/_app.ts
git commit -m "feat: add cashFlowCalendar tRPC router with getEvents and getProperties"
```

---

### Task 3: Calendar grid component

**Files:**
- Create: `src/components/cash-flow/CalendarGrid.tsx`

**Step 1: Build the calendar grid**

Create `src/components/cash-flow/CalendarGrid.tsx`:

```tsx
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
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/cash-flow/CalendarGrid.tsx
git commit -m "feat: add custom CalendarGrid component with event dots"
```

---

### Task 4: Timeline list view component

**Files:**
- Create: `src/components/cash-flow/TimelineView.tsx`

**Step 1: Build the timeline list**

Create `src/components/cash-flow/TimelineView.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Check, Clock, AlertTriangle, SkipForward, TrendingUp } from "lucide-react";

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
                {net >= 0 ? "+" : ""}${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
                    {event.amount >= 0 ? "+" : ""}
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
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/cash-flow/TimelineView.tsx
git commit -m "feat: add TimelineView component for cash flow list view"
```

---

### Task 5: Balance projection chart

**Files:**
- Create: `src/components/cash-flow/BalanceChart.tsx`

**Step 1: Build the balance chart**

Create `src/components/cash-flow/BalanceChart.tsx`. Follow the exact Recharts patterns from `CashFlowWidget.tsx`:

```tsx
"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface DailyBalance {
  date: string;
  balance: number;
  isForecasted: boolean;
}

interface BalanceChartProps {
  data: DailyBalance[];
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[160px]">
      <p className="text-sm font-medium text-foreground mb-1">
        {formatDateShort(label)}
      </p>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Balance</span>
        <span className="font-medium">{formatCompact(payload[0].value)}</span>
      </div>
    </div>
  );
}

export function BalanceChart({ data }: BalanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No balance data available
      </div>
    );
  }

  const minBalance = Math.min(...data.map((d) => d.balance));
  const hasNegative = minBalance < 0;

  // Split into concrete and forecasted segments
  const chartData = data.map((d) => ({
    date: d.date,
    concrete: d.isForecasted ? undefined : d.balance,
    forecasted: d.isForecasted ? d.balance : undefined,
    // Bridge: last concrete point also appears in forecasted for continuity
    balance: d.balance,
  }));

  // Find boundary between concrete and forecasted
  const lastConcreteIdx = chartData.findLastIndex((d) => d.concrete !== undefined);
  if (lastConcreteIdx >= 0 && lastConcreteIdx < chartData.length - 1) {
    chartData[lastConcreteIdx + 1].forecasted = chartData[lastConcreteIdx].concrete;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          className="stroke-muted"
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={60}
          className="fill-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Zero line if balance goes negative */}
        {hasNegative && (
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
        )}

        {/* Concrete balance area */}
        <Area
          dataKey="concrete"
          type="monotone"
          stroke="#22c55e"
          strokeWidth={2}
          fill="#22c55e"
          fillOpacity={0.1}
          connectNulls={false}
          dot={false}
        />

        {/* Forecasted balance area (dashed) */}
        <Area
          dataKey="forecasted"
          type="monotone"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="#3b82f6"
          fillOpacity={0.05}
          connectNulls={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/cash-flow/BalanceChart.tsx
git commit -m "feat: add BalanceChart component for projected balance visualization"
```

---

### Task 6: Day detail sheet

**Files:**
- Create: `src/components/cash-flow/DayDetailSheet.tsx`

**Step 1: Build the day detail sheet**

Create `src/components/cash-flow/DayDetailSheet.tsx`:

```tsx
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
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{dateLabel}</SheetTitle>
          <SheetDescription>
            {events.length} event{events.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <div className="text-xs text-muted-foreground mb-1">Income</div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              +${incomeTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
            <div className="text-xs text-muted-foreground mb-1">Expenses</div>
            <div className="text-sm font-semibold text-red-600 dark:text-red-400">
              -${expenseTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <div className="text-xs text-muted-foreground mb-1">Net</div>
            <div className={cn(
              "text-sm font-semibold",
              net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {net >= 0 ? "+" : ""}${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Balance after this day */}
        {balance !== null && (
          <div className="mt-4 p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground mb-1">
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
        <div className="mt-6 space-y-3">
          {events.map((event) => {
            const statusConfig = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.pending;
            return (
              <div
                key={event.id}
                className="p-3 rounded-lg border space-y-2"
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
                    {event.amount >= 0 ? "+" : ""}
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
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/cash-flow/DayDetailSheet.tsx
git commit -m "feat: add DayDetailSheet for viewing daily cash flow event details"
```

---

### Task 7: Assemble full cash flow page

**Files:**
- Create: `src/components/cash-flow/CashFlowClient.tsx`
- Modify: `src/app/(dashboard)/cash-flow/page.tsx`

**Step 1: Build the client component**

Create `src/components/cash-flow/CashFlowClient.tsx` that ties together all sub-components:

```tsx
"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, List, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarGrid } from "./CalendarGrid";
import { TimelineView } from "./TimelineView";
import { BalanceChart } from "./BalanceChart";
import { DayDetailSheet } from "./DayDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "calendar" | "list";

const HORIZONS = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
] as const;

function getDateRange(months: number) {
  const start = new Date();
  // Start from 1 month ago to show recent history
  start.setMonth(start.getMonth() - 1);
  start.setDate(1);
  const end = new Date();
  end.setMonth(end.getMonth() + months);

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function CashFlowClient() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [horizon, setHorizon] = useState(3);
  const [propertyId, setPropertyId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { startDate, endDate } = useMemo(() => getDateRange(horizon), [horizon]);

  const { data, isLoading } = trpc.cashFlowCalendar.getEvents.useQuery({
    startDate,
    endDate,
    propertyId: propertyId === "all" ? undefined : propertyId,
  });

  const { data: propertiesData } = trpc.cashFlowCalendar.getProperties.useQuery();

  const events = data?.events ?? [];
  const projectedBalances = data?.projectedBalances ?? [];

  const selectedDayEvents = selectedDate
    ? events.filter((e) => e.date === selectedDate)
    : [];

  const selectedDayBalance = selectedDate
    ? projectedBalances.find((b) => b.date === selectedDate)?.balance ?? null
    : null;

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow</h2>
          <p className="text-muted-foreground">
            Track upcoming payments, income, and projected balances
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Property filter */}
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="All properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {propertiesData?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address.split(",")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time horizon toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {HORIZONS.map(({ label, months }) => (
              <button
                key={months}
                onClick={() => setHorizon(months)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                  horizon === months
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "calendar"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Calendar view"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Balance projection chart */}
      <Card className="animate-card-entrance" style={{ "--stagger-index": 0 } as React.CSSProperties}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Balance Projection</CardTitle>
              <CardDescription>Projected account balance over time</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <BalanceChart data={projectedBalances} />
          )}
        </CardContent>
      </Card>

      {/* Calendar or list view */}
      <Card className="animate-card-entrance" style={{ "--stagger-index": 1 } as React.CSSProperties}>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : viewMode === "calendar" ? (
            <CalendarGrid
              events={events}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          ) : (
            <TimelineView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          )}
        </CardContent>
      </Card>

      {/* Day detail sheet */}
      <DayDetailSheet
        date={selectedDate}
        events={selectedDayEvents}
        balance={selectedDayBalance}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
```

**Step 2: Update the page to use the client component**

Update `src/app/(dashboard)/cash-flow/page.tsx`:

```tsx
import type { Metadata } from "next";
import { CashFlowClient } from "@/components/cash-flow/CashFlowClient";

export const metadata: Metadata = {
  title: "Cash Flow | BrickTrack",
  description: "Track upcoming payments, income, and projected balances",
};

export default function CashFlowPage() {
  return <CashFlowClient />;
}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/cash-flow/CashFlowClient.tsx src/app/\(dashboard\)/cash-flow/page.tsx
git commit -m "feat: assemble full cash flow page with calendar, list, chart, and day detail"
```

---

### Task 8: Dashboard widget — UpcomingCashFlowWidget

**Files:**
- Create: `src/components/dashboard/UpcomingCashFlowWidget.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Build the widget**

Create `src/components/dashboard/UpcomingCashFlowWidget.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

function getNext14Days() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 14);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function UpcomingCashFlowWidget() {
  const { startDate, endDate } = useMemo(() => getNext14Days(), []);

  const { data, isLoading } = trpc.cashFlowCalendar.getEvents.useQuery({
    startDate,
    endDate,
  });

  const events = data?.events ?? [];
  const balances = data?.projectedBalances ?? [];

  // Only show future events (not today's confirmed)
  const upcomingEvents = events.filter(
    (e) => e.date >= startDate && e.status !== "confirmed"
  );
  const displayEvents = upcomingEvents.slice(0, 4);
  const overflow = upcomingEvents.length - 4;

  const firstBalance = balances[0]?.balance;
  const lastBalance = balances[balances.length - 1]?.balance;

  if (isLoading) {
    return (
      <Card className="animate-card-entrance">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return null; // Don't show widget if no data
  }

  return (
    <Card className="animate-card-entrance">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Upcoming Cash Flow</CardTitle>
              <CardDescription>Next 14 days</CardDescription>
            </div>
          </div>
          <Link
            href="/cash-flow"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Balance sparkline */}
        {balances.length > 1 && firstBalance !== undefined && lastBalance !== undefined && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                ${firstBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-muted-foreground">→</span>
              <span
                className={cn(
                  "font-medium",
                  lastBalance >= firstBalance
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                ${lastBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={balances}>
                <Area
                  dataKey="balance"
                  type="monotone"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  fill="#22c55e"
                  fillOpacity={0.1}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Upcoming events list */}
        <div className="space-y-2">
          {displayEvents.map((event) => {
            const d = new Date(event.date + "T00:00:00");
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            let dateLabel: string;
            if (d.getTime() === today.getTime()) dateLabel = "Today";
            else if (d.getTime() === tomorrow.getTime()) dateLabel = "Tomorrow";
            else dateLabel = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });

            return (
              <div key={event.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    event.type === "income" ? "bg-emerald-500" : "bg-red-500"
                  )}
                />
                <span className="text-muted-foreground text-xs w-16 shrink-0">
                  {dateLabel}
                </span>
                <span className="truncate flex-1">{event.description}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums shrink-0",
                    event.type === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {event.amount >= 0 ? "+" : ""}
                  ${Math.abs(event.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}

          {overflow > 0 && (
            <Link
              href="/cash-flow"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1"
            >
              {overflow} more event{overflow !== 1 ? "s" : ""}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to dashboard**

In `src/components/dashboard/DashboardClient.tsx`, add the import and render the widget. Place it after `CashFlowWidget`:

```typescript
import { UpcomingCashFlowWidget } from "./UpcomingCashFlowWidget";
```

Find where `<CashFlowWidget />` is rendered and add `<UpcomingCashFlowWidget />` after it.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/dashboard/UpcomingCashFlowWidget.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add UpcomingCashFlowWidget to dashboard showing next 14 days"
```

---

### Task 9: E2E test

**Files:**
- Create: `e2e/authenticated/cash-flow.spec.ts`

**Step 1: Write the E2E test**

Create `e2e/authenticated/cash-flow.spec.ts`:

```typescript
import { test, expect } from "../fixtures/auth";

test.describe("Cash Flow Calendar", () => {
  test("page loads with header, controls, and chart", async ({
    authenticatedPage: page,
  }) => {
    // Track page errors
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      // Ignore known benign errors
      const benign = [
        "Minified React error #418",
        "Minified React error #423",
        "hydrat",
      ];
      if (!benign.some((b) => error.message.includes(b))) {
        pageErrors.push(error);
      }
    });

    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Page header
    await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();

    // Controls should be visible
    await expect(page.getByText("All properties")).toBeVisible();
    await expect(page.getByText("3M")).toBeVisible();
    await expect(page.getByText("6M")).toBeVisible();
    await expect(page.getByText("12M")).toBeVisible();

    // Balance projection card should be visible
    await expect(page.getByText("Balance Projection")).toBeVisible();

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test("can toggle between calendar and list views", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Default is calendar view - check for day headers
    await expect(page.getByText("Mon")).toBeVisible();
    await expect(page.getByText("Tue")).toBeVisible();

    // Switch to list view
    await page.getByTitle("List view").click();

    // Calendar day headers should not be visible
    await expect(page.getByText("Mon")).not.toBeVisible();
  });

  test("can change time horizon", async ({ authenticatedPage: page }) => {
    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Click 12M
    await page.getByText("12M").click();

    // Page should still be functional (no crash)
    await expect(page.getByText("Balance Projection")).toBeVisible();
  });

  test("sidebar shows Cash Flow nav item", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Cash Flow should be in sidebar
    const navLink = page.getByRole("link", { name: "Cash Flow" });
    await expect(navLink).toBeVisible();

    // Click it and verify navigation
    await navLink.click();
    await page.waitForURL("**/cash-flow");
    await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();
  });
});
```

**Step 2: Run E2E tests to verify they pass**

Run: `npm run test:e2e -- --grep "Cash Flow"`

**Step 3: Commit**

```bash
git add e2e/authenticated/cash-flow.spec.ts
git commit -m "test: add E2E tests for cash flow calendar page"
```

---

### Task 10: Lint, build, type-check, final verification

**Step 1: Run type checking**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors.

**Step 3: Run build**

Run: `npm run build`
Expected: Builds successfully.

**Step 4: Run full E2E suite**

Run: `npm run test:e2e`
Expected: All tests pass.

**Step 5: Commit any fixes**

If any lint/type fixes needed, commit them:

```bash
git add -A && git commit -m "fix: lint and type fixes for cash flow calendar"
```

---

### Task 11: Create PR

**Step 1: Push branch and create PR**

```bash
git push -u origin feature/cash-flow-calendar
gh pr create --base develop --title "feat: cash flow calendar with projected balances" --body "$(cat <<'EOF'
## Summary
- New `/cash-flow` page with calendar grid and timeline/list views (toggleable)
- Balance projection chart showing projected account balance over time
- Day detail slide-out panel with event breakdown
- Dashboard widget showing next 14 days of upcoming events with sparkline
- Data from: recurring expected transactions, loan repayments, actual transactions, forecast scenarios
- Property filter dropdown and 3/6/12 month horizon selector

## Test plan
- [ ] Navigate to /cash-flow — page loads with header, controls, and chart
- [ ] Toggle between calendar and list views
- [ ] Click a day in calendar — detail sheet opens
- [ ] Change time horizon (3M/6M/12M)
- [ ] Filter by property
- [ ] Dashboard widget shows upcoming events with sparkline
- [ ] Sidebar nav item links to /cash-flow
- [ ] Works in dark mode
- [ ] E2E tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 2: Run code review**

Run: `/code-review`

**Step 3: Wait for CI**

Run: `gh pr checks --watch`
