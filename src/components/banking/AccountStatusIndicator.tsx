"use client";

import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "disconnected" | "error";

interface AccountStatusIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: "bg-green-500", label: "Connected" },
  disconnected: { color: "bg-yellow-500", label: "Disconnected" },
  error: { color: "bg-red-500", label: "Error" },
};

export function AccountStatusIndicator({
  status,
  showLabel = false,
  className,
}: AccountStatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
}
