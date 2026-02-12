"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { featureFlags } from "@/config/feature-flags";

export function AlertBadge() {
  const { data: counts } = trpc.anomaly.getActiveCount.useQuery(undefined, {
    refetchInterval: 60000,
    enabled: featureFlags.alerts,
  });

  if (!featureFlags.alerts) return null;

  const total = counts?.total ?? 0;
  const hasCritical = (counts?.critical ?? 0) > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" asChild className="relative cursor-pointer" aria-label="Alerts">
          <Link href="/alerts">
            <Bell className="h-5 w-5" />
            {total > 0 && (
              <span
                className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white ${
                  hasCritical ? "bg-red-500" : "bg-yellow-500"
                }`}
              >
                {total > 9 ? "9+" : total}
              </span>
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Alerts</TooltipContent>
    </Tooltip>
  );
}
