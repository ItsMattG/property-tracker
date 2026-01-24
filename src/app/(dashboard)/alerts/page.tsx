"use client";

import { useState } from "react";
import { AlertCard } from "@/components/alerts/AlertCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { CheckCircle } from "lucide-react";

type StatusFilter = "active" | "dismissed" | "all";

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const utils = trpc.useUtils();

  const { data: alerts, isLoading } = trpc.anomaly.list.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter as "active" | "dismissed" }
  );

  const dismissMutation = trpc.anomaly.dismiss.useMutation({
    onSuccess: () => {
      utils.anomaly.list.invalidate();
      utils.anomaly.getActiveCount.invalidate();
    },
  });

  const handleDismiss = (id: string) => {
    dismissMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Alerts</h2>
          <p className="text-muted-foreground">
            Financial anomalies detected in your portfolio
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Alerts</h2>
          <p className="text-muted-foreground">
            Financial anomalies detected in your portfolio
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("active")}
        >
          Active
        </Button>
        <Button
          variant={statusFilter === "dismissed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("dismissed")}
        >
          Dismissed
        </Button>
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
      </div>

      {alerts && alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={handleDismiss}
              isDismissing={dismissMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">No alerts</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            {statusFilter === "active"
              ? "Your portfolio looks healthy - no anomalies detected."
              : "No alerts found with this filter."}
          </p>
        </div>
      )}
    </div>
  );
}
