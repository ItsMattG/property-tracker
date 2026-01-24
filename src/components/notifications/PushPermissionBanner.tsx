"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, X } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const BANNER_DISMISSED_KEY = "push-banner-dismissed";
const VISIT_COUNT_KEY = "dashboard-visit-count";
const MIN_VISITS_BEFORE_PROMPT = 3;

export function PushPermissionBanner() {
  const [show, setShow] = useState(false);
  const { status, subscribe, isSupported } = usePushSubscription();

  useEffect(() => {
    // Don't show if not supported or already subscribed/denied
    if (!isSupported || status === "subscribed" || status === "denied" || status === "loading") {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 30) return;
    }

    // Track visit count
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    // Show after minimum visits
    if (visitCount >= MIN_VISITS_BEFORE_PROMPT) {
      setShow(true);
    }
  }, [isSupported, status]);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, new Date().toISOString());
    setShow(false);
  };

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 mb-6">
      <div className="p-4 flex items-center gap-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full">
          <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Get notified when rent arrives</p>
          <p className="text-sm text-muted-foreground">
            Enable push notifications to stay updated on your portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Not now
          </Button>
          <Button size="sm" onClick={handleEnable}>
            Enable
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDismiss} className="ml-2">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
