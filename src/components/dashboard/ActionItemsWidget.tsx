"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { AlertCircle, Clock, Wifi, ChevronRight, type LucideIcon } from "lucide-react";

interface ActionItem {
  icon: LucideIcon;
  label: string;
  count: number;
  href: string;
  color: string;
}

export function ActionItemsWidget() {
  const { data: stats } = trpc.stats.dashboard.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: staleLoans } = trpc.loan.stale.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: alerts } = trpc.banking.listAlerts.useQuery(undefined, {
    staleTime: 10_000,
  });

  const actionItems: ActionItem[] = [
    {
      icon: AlertCircle,
      label: "Uncategorised transactions",
      count: stats?.uncategorizedCount ?? 0,
      href: "/transactions/review",
      color: "text-amber-500",
    },
    {
      icon: Clock,
      label: "Stale loan balances",
      count: staleLoans?.length ?? 0,
      href: "/loans",
      color: "text-orange-500",
    },
    {
      icon: Wifi,
      label: "Bank connection issues",
      count: alerts?.length ?? 0,
      href: "/banking",
      color: "text-red-500",
    },
  ].filter((item) => item.count > 0);

  if (actionItems.length === 0) return null;

  return (
    <Card className="animate-card-entrance border-amber-200 dark:border-amber-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {actionItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="flex items-center gap-3 py-2.5 hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors group"
            >
              <item.icon className={`h-4 w-4 flex-shrink-0 ${item.color}`} />
              <span className="text-sm flex-1">{item.label}</span>
              <span className="text-sm font-medium tabular-nums">{item.count}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
