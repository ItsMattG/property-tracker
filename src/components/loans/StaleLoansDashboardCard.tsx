"use client";

import { Clock, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { featureFlags } from "@/config/feature-flags";
import { cn } from "@/lib/utils";

export function StaleLoansDashboardCard({ className }: { className?: string }) {
  const { data: staleLoans } = trpc.loan.stale.useQuery(undefined, {
    enabled: featureFlags.loans,
    staleTime: 5 * 60_000,
  });

  if (!featureFlags.loans || !staleLoans || staleLoans.length === 0) return null;

  const oldestMonths = Math.max(
    3,
    Math.floor(
      (Date.now() - new Date(staleLoans[0].updatedAt).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    )
  );

  return (
    <Link
      href="/loans"
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 transition-colors hover:bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5 dark:hover:bg-amber-500/10",
        className
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {staleLoans.length === 1
            ? "1 loan balance needs a refresh"
            : `${staleLoans.length} loan balances need a refresh`}
        </p>
        <p className="text-xs text-muted-foreground">
          Last updated {oldestMonths}+ months ago
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-amber-600/50 transition-transform group-hover:translate-x-0.5 dark:text-amber-400/50" />
    </Link>
  );
}
