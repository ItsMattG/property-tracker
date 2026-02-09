"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TrialPropertyLimitBannerProps {
  propertyCount: number;
  trialEndsAt: Date;
  firstPropertyAddress?: string;
}

export function TrialPropertyLimitBanner({
  propertyCount,
  trialEndsAt,
  firstPropertyAddress,
}: TrialPropertyLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const trialEndDate = format(trialEndsAt, "MMMM d");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-800">
            You have <strong>{propertyCount} properties</strong> on your trial.
            After <strong>{trialEndDate}</strong>, only{" "}
            <strong>{firstPropertyAddress ?? "your first property"}</strong> stays
            active. Upgrade to keep them all.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" asChild>
            <Link href="/settings/billing">Upgrade to Pro</Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
