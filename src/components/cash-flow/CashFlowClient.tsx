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
import { CashFlowSummary } from "./CashFlowSummary";
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
          <h2 className="text-xl sm:text-2xl font-bold">Cash Flow</h2>
          <p className="text-muted-foreground">
            Track upcoming payments, income, and projected balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Property filter */}
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger size="sm" className="w-full sm:w-[180px]">
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

      {/* KPI Summary Cards */}
      {!isLoading && events.length > 0 && (
        <CashFlowSummary events={events} />
      )}

      {/* Balance projection chart */}
      <Card className="animate-card-entrance" style={{ "--stagger-index": 1 } as React.CSSProperties}>
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
      <Card className="animate-card-entrance" style={{ "--stagger-index": 2 } as React.CSSProperties}>
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
