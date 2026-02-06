"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SyncButtonProps {
  onSync: () => Promise<unknown>;
  lastManualSyncAt: Date | string | null;
  rateLimitMinutes?: number;
  className?: string;
}

// Calculate initial rate limit state
function getInitialRateLimitState(
  lastManualSyncAt: Date | string | null,
  rateLimitMinutes: number
): { status: "ready" | "rate-limited"; remainingTime: number } {
  if (!lastManualSyncAt) {
    return { status: "ready", remainingTime: 0 };
  }
  const now = Date.now();
  const syncTime = new Date(lastManualSyncAt).getTime();
  const diffMs = now - syncTime;
  const limitMs = rateLimitMinutes * 60 * 1000;
  if (diffMs >= limitMs) {
    return { status: "ready", remainingTime: 0 };
  }
  return { status: "rate-limited", remainingTime: Math.ceil((limitMs - diffMs) / 1000) };
}

export function SyncButton({
  onSync,
  lastManualSyncAt,
  rateLimitMinutes = 15,
  className,
}: SyncButtonProps) {
  // Calculate initial state to avoid setState in effect
  const initialState = useMemo(
    () => getInitialRateLimitState(lastManualSyncAt, rateLimitMinutes),
    [lastManualSyncAt, rateLimitMinutes]
  );

  const [status, setStatus] = useState<"ready" | "syncing" | "success" | "rate-limited">(initialState.status);
  const [remainingTime, setRemainingTime] = useState<number>(initialState.remainingTime);

  // Update state when props change (reset to initial)
  useEffect(() => {
    const state = getInitialRateLimitState(lastManualSyncAt, rateLimitMinutes);
    setStatus(state.status);
    setRemainingTime(state.remainingTime);
  }, [lastManualSyncAt, rateLimitMinutes]);

  // Run interval for countdown
  useEffect(() => {
    if (!lastManualSyncAt || status === "syncing" || status === "success") {
      return;
    }

    const interval = setInterval(() => {
      const state = getInitialRateLimitState(lastManualSyncAt, rateLimitMinutes);
      setStatus(state.status);
      setRemainingTime(state.remainingTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastManualSyncAt, rateLimitMinutes, status]);

  const handleClick = async () => {
    if (status !== "ready") return;

    setStatus("syncing");
    try {
      await onSync();
      setStatus("success");
      setTimeout(() => setStatus("ready"), 2000);
    } catch {
      setStatus("ready");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getButtonContent = () => {
    switch (status) {
      case "syncing":
        return (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Syncing...
          </>
        );
      case "success":
        return (
          <>
            <Check className="w-4 h-4 mr-2" />
            Synced!
          </>
        );
      case "rate-limited":
        return <>Sync in {formatTime(remainingTime)}</>;
      default:
        return (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Now
          </>
        );
    }
  };

  return (
    <Button
      variant={status === "rate-limited" ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={status !== "ready"}
      className={cn(
        "min-w-[130px] tabular-nums",
        status === "success" && "bg-green-600 hover:bg-green-600",
        className
      )}
    >
      {getButtonContent()}
    </Button>
  );
}
