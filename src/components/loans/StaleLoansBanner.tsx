"use client";

import { Clock, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export function StaleLoansBanner({ className }: { className?: string }) {
  const { data: staleLoans, isLoading } = trpc.loan.stale.useQuery();

  if (isLoading || !staleLoans || staleLoans.length === 0) return null;

  // Single stale loan — direct link to its edit page
  if (staleLoans.length === 1) {
    const loan = staleLoans[0];
    const timeAgo = formatDistanceToNow(new Date(loan.updatedAt), {
      addSuffix: true,
    });

    return (
      <div className={className}>
        <Link
          href={`/loans/${loan.id}/edit`}
          className="group flex items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 transition-colors hover:bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5 dark:hover:bg-amber-500/10"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{loan.lender}</span>
              {loan.property && (
                <span className="text-muted-foreground">
                  {" "}&middot; {loan.property.address}, {loan.property.suburb}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Balance last confirmed {timeAgo}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-600/50 transition-transform group-hover:translate-x-0.5 dark:text-amber-400/50" />
        </Link>
      </div>
    );
  }

  // Multiple stale loans — compact summary, let the cards handle individual edits
  const oldestAge = formatDistanceToNow(new Date(staleLoans[0].updatedAt));

  return (
    <div className={className}>
      <div className="flex items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {staleLoans.length} loan balances haven&apos;t been updated in 3+ months
          </p>
          <p className="text-xs text-muted-foreground">
            Oldest update was {oldestAge} ago &middot; Use the edit menu on each card below
          </p>
        </div>
      </div>
    </div>
  );
}
