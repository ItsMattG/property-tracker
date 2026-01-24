"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SyncButtonProps {
  onSync: () => Promise<void>;
  lastManualSyncAt: Date | null;
  rateLimitMinutes?: number;
  className?: string;
}

export function SyncButton({
  onSync,
  lastManualSyncAt,
  rateLimitMinutes = 15,
  className,
}: SyncButtonProps) {
  const [status, setStatus] = useState<"ready" | "syncing" | "success" | "rate-limited">("ready");
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    if (!lastManualSyncAt) {
      setStatus("ready");
      return;
    }

    const checkRateLimit = () => {
      const now = Date.now();
      const syncTime = new Date(lastManualSyncAt).getTime();
      const diffMs = now - syncTime;
      const limitMs = rateLimitMinutes * 60 * 1000;

      if (diffMs >= limitMs) {
        setStatus("ready");
        setRemainingTime(0);
      } else {
        setStatus("rate-limited");
        setRemainingTime(Math.ceil((limitMs - diffMs) / 1000));
      }
    };

    checkRateLimit();
    const interval = setInterval(checkRateLimit, 1000);
    return () => clearInterval(interval);
  }, [lastManualSyncAt, rateLimitMinutes]);

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
        status === "success" && "bg-green-600 hover:bg-green-600",
        className
      )}
    >
      {getButtonContent()}
    </Button>
  );
}
