"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeftRight, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();
  const { data: alerts } = trpc.banking.listAlerts.useQuery();
  const utils = trpc.useUtils();

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onSuccess: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError = alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

  return (
    <div className="space-y-6">
      {alerts && alerts.length > 0 && (
        <ConnectionAlertBanner
          alertCount={alerts.length}
          hasAuthError={hasAuthError}
          onDismiss={handleDismissAllAlerts}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold">Welcome to PropertyTracker</h2>
        <p className="text-muted-foreground">
          Track your investment properties, automate bank feeds, and generate tax reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/properties">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Properties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  stats?.propertyCount ?? 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.propertyCount === 0
                  ? "Add your first property to get started"
                  : "Investment properties tracked"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/transactions">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  stats?.transactionCount ?? 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.transactionCount === 0
                  ? "Connect your bank to import transactions"
                  : "Total transactions imported"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/transactions?category=uncategorized">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Uncategorized
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  stats?.uncategorizedCount ?? 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.uncategorizedCount === 0
                  ? "All transactions categorized!"
                  : "Transactions needing review"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
