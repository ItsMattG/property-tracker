"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ConnectionAlertBannerProps {
  alertCount: number;
  hasAuthError: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function ConnectionAlertBanner({
  alertCount,
  hasAuthError,
  onDismiss,
  className,
}: ConnectionAlertBannerProps) {
  const pathname = usePathname();
  const isOnBankingPage = pathname === "/banking";

  if (alertCount === 0) {
    return null;
  }

  const message =
    alertCount === 1
      ? "1 bank connection needs attention"
      : `${alertCount} bank connections need attention`;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg px-4 py-3",
        hasAuthError
          ? "bg-destructive/10 border border-destructive/20"
          : "bg-yellow-500/10 border border-yellow-500/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle
          className={cn(
            "w-5 h-5",
            hasAuthError ? "text-destructive" : "text-yellow-600"
          )}
        />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-2">
        {!isOnBankingPage && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/banking">View Details</Link>
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
