"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeftRight, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { PushPermissionBanner } from "@/components/notifications/PushPermissionBanner";
import { ClimateRiskSummary } from "@/components/climate-risk";
import { SavingsWidget } from "@/components/benchmarking";
import { TaxPositionCard } from "@/components/tax-position/TaxPositionCard";
import { TopPerformerMatchesWidget } from "@/components/similar-properties";

interface DashboardStats {
  propertyCount: number;
  transactionCount: number;
  uncategorizedCount: number;
}

interface DashboardClientProps {
  initialStats: DashboardStats | null;
}

export function DashboardClient({ initialStats }: DashboardClientProps) {
  const [wizardClosed, setWizardClosed] = useState(false);
  const utils = trpc.useUtils();

  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery(undefined, {
    initialData: initialStats ?? undefined,
    staleTime: 60_000, // Dashboard stats can be stale for 1 minute
  });

  const { data: alerts } = trpc.banking.listAlerts.useQuery(undefined, {
    staleTime: 10_000, // Alerts should be fresher
  });

  const { data: onboarding } = trpc.onboarding.getProgress.useQuery(undefined, {
    staleTime: 5 * 60_000, // Onboarding rarely changes
  });

  const { data: properties } = trpc.property.list.useQuery();

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onMutate: async (newData) => {
      await utils.banking.listAlerts.cancel();
      const previous = utils.banking.listAlerts.getData();

      utils.banking.listAlerts.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((alert) => alert.id !== newData.alertId);
      });

      return { previous };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.banking.listAlerts.setData(undefined, context.previous);
      }
    },
    onSettled: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError =
    alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

  const showWizard = onboarding?.showWizard && !wizardClosed;
  const showChecklist = onboarding?.showChecklist;

  return (
    <div className="space-y-6">
      {showWizard && (
        <OnboardingWizard onClose={() => setWizardClosed(true)} />
      )}

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
          Track your investment properties, automate bank feeds, and generate
          tax reports.
        </p>
      </div>

      <PushPermissionBanner />

      {showChecklist && onboarding?.progress && (
        <SetupChecklist progress={onboarding.progress} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <CardTitle className="text-sm font-medium">
                Transactions
              </CardTitle>
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

        <TaxPositionCard />
      </div>

      {properties && properties.length > 0 && (
        <ClimateRiskSummary properties={properties} />
      )}

      <SavingsWidget />

      <TopPerformerMatchesWidget />
    </div>
  );
}
