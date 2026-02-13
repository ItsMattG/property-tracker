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
              <span className="text-muted-foreground">&rarr;</span>
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
                  {event.amount >= 0 ? "+" : "-"}
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
