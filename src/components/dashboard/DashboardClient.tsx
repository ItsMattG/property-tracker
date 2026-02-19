"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeftRight, AlertCircle, DollarSign, PiggyBank } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { cn, formatCurrency } from "@/lib/utils";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";
import { EnhancedWizard } from "@/components/onboarding/EnhancedWizard";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { PushPermissionBanner } from "@/components/notifications/PushPermissionBanner";
import { ClimateRiskSummary } from "@/components/climate-risk";
import { SavingsWidget } from "@/components/benchmarking";
import { TaxPositionCard } from "@/components/tax-position/TaxPositionCard";
import { TopPerformerMatchesWidget } from "@/components/similar-properties";
import { useTour } from "@/hooks/useTour";
import { useReferralTracking } from "@/hooks/useReferralTracking";
import { RentalYieldCard } from "@/components/rental-yield";
import { PortfolioValueChart } from "./PortfolioValueChart";
import { BudgetWidget } from "./BudgetWidget";
import { CashFlowWidget } from "./CashFlowWidget";
import { UpcomingCashFlowWidget } from "./UpcomingCashFlowWidget";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/errors";
import { TrialPropertyLimitBanner } from "@/components/banners/TrialPropertyLimitBanner";
import { StaleLoansDashboardCard } from "@/components/loans/StaleLoansDashboardCard";
import { ActionItemsWidget } from "./ActionItemsWidget";
import { PortfolioSummaryTable } from "./PortfolioSummaryTable";
import { PropertyMapWidget } from "./PropertyMapWidget";
import { LvrGaugeCard } from "./LvrGaugeCard";
import { EquityProjectionCard } from "./EquityProjectionCard";
import { BorrowingPowerCard } from "./BorrowingPowerCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { AIInsightsCard } from "./AIInsightsCard";
import { UpcomingRemindersCard } from "./UpcomingRemindersCard";
import { DEMO_STATS, DEMO_TRENDS } from "@/lib/demo-data";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Plus } from "lucide-react";
import { MilestoneModal } from "@/components/celebrations/MilestoneModal";
import { AchievementProgress } from "@/components/celebrations/AchievementProgress";
import { useMilestoneCelebration } from "@/components/celebrations/useMilestoneCelebration";
import type { MilestoneContext } from "@/server/services/milestone/types";

// Server-side data structure from dashboard.getInitialData
// Note: Dates are Date objects on server but get serialized to strings when passed to client
interface DashboardInitialData {
  stats: {
    propertyCount: number;
    transactionCount: number;
    uncategorizedCount: number;
  };
  trends: {
    propertyCount: { current: number; previous: number };
    transactionCount: { current: number; previous: number };
    uncategorizedCount: { current: number; previous: number };
    portfolioValue: { current: number; previous: number | null };
    totalEquity: { current: number; previous: number | null };
  };
  alerts: unknown[];
  onboarding: unknown | null;
  properties: unknown[];
}

interface DashboardClientProps {
  initialData: DashboardInitialData | null;
}

function getTrendBorderClass(current: number, previous: number | null, invert = false): string {
  if (previous === null || current === previous) return "";
  const isUp = current > previous;
  const isGood = invert ? !isUp : isUp;
  return isGood ? "border-l-2 border-l-green-500" : "border-l-2 border-l-red-500";
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [wizardClosed, setWizardClosed] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);
  const utils = trpc.useUtils();
  useReferralTracking();

  // Background prefetch common navigation targets after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      utils.property.list.prefetch();
      utils.transaction.list.prefetch({ limit: 50, offset: 0 });
    }, 1000);
    return () => clearTimeout(timer);
  }, [utils]);

  // Stats only contains numbers, so initialData works directly
  const { data: stats, isLoading, isError, error, refetch } = trpc.stats.dashboard.useQuery(undefined, {
    initialData: initialData?.stats,
    staleTime: 60_000,
  });

  // For queries with Date fields, we fetch fresh data on client
  // The server still fetches in parallel for SSR hydration benefits
  const { data: alerts } = trpc.banking.listAlerts.useQuery(undefined, {
    staleTime: 10_000,
  });

  const { data: onboarding } = trpc.onboarding.getProgress.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const { data: properties } = trpc.property.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery(undefined, {
    staleTime: 60_000,
  });

  const { data: dashboardData } = trpc.dashboard.getInitialData.useQuery(undefined, {
    staleTime: 60_000,
  });
  const realTrends = dashboardData?.trends ?? initialData?.trends ?? null;

  // Demo mode: overlay sample data when user has no properties
  const hasNoProperties = stats?.propertyCount === 0 && !isLoading;
  const isDemo = showDemoData && hasNoProperties;
  const displayStats = isDemo ? DEMO_STATS : stats;
  const trends = isDemo ? DEMO_TRENDS : realTrends;

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

  // Auto-start dashboard tour after wizard is dismissed
  useTour({
    tourId: "dashboard",
    autoStart: !showWizard,
  });

  // Build milestone context from available dashboard data
  const milestoneContext: MilestoneContext | null =
    stats && trends
      ? {
          propertyCount: stats.propertyCount,
          totalEquity: trends.totalEquity.current,
          monthsPositiveCashFlow: 0, // TODO: populate when cash flow history is available
          categorizedTransactionPercent:
            stats.transactionCount > 0
              ? Math.round(
                  ((stats.transactionCount - stats.uncategorizedCount) /
                    stats.transactionCount) *
                    100,
                )
              : 0,
          bankAccountsConnected: 0, // TODO: populate from banking query
          taxReportsGenerated: 0, // TODO: populate from tax query
        }
      : null;

  const {
    currentMilestone,
    handleDismiss: handleMilestoneDismiss,
    totalMilestones,
    achievedCount,
  } = useMilestoneCelebration(milestoneContext);

  return (
    <div className="space-y-6">
      <MilestoneModal
        milestone={currentMilestone}
        onDismiss={handleMilestoneDismiss}
      />

      {showWizard && (
        <EnhancedWizard onClose={() => setWizardClosed(true)} />
      )}

      {alerts && alerts.length > 0 && (
        <ConnectionAlertBanner
          alertCount={alerts.length}
          hasAuthError={hasAuthError}
          onDismiss={handleDismissAllAlerts}
        />
      )}

      {trialStatus?.isOnTrial && trialStatus.propertyCount >= 2 && trialStatus.trialEndsAt && (
        <TrialPropertyLimitBanner
          propertyCount={trialStatus.propertyCount}
          trialEndsAt={new Date(trialStatus.trialEndsAt)}
          firstPropertyAddress={properties?.[0]?.address}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold">Welcome to BrickTrack</h2>
        <p className="text-muted-foreground">
          Track your investment properties, automate bank feeds, and generate
          tax reports.
        </p>
      </div>

      {hasNoProperties && !showDemoData && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">Curious what BrickTrack looks like with data?</p>
              <p className="text-xs text-muted-foreground">Preview the dashboard with sample properties and transactions.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDemoData(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </CardContent>
        </Card>
      )}

      {isDemo && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="flex items-center justify-between py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Viewing sample data. This is what BrickTrack looks like with real properties.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" asChild>
                <Link href="/properties/new">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Your Property
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDemoData(false)}>
                <EyeOff className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PushPermissionBanner />

      {showChecklist && onboarding?.progress && (
        <div data-tour="setup-checklist">
          <SetupChecklist progress={onboarding.progress} />
        </div>
      )}

      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
      <div data-tour="portfolio-summary" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Row 1: Properties, Portfolio Value, Total Equity */}
        <div className="animate-card-entrance" style={{ '--stagger-index': 0 } as React.CSSProperties}>
          <Link href="/properties" prefetch={false}>
            <Card className={cn(
              "interactive-card hover:border-primary transition-colors cursor-pointer",
              getTrendBorderClass(trends?.propertyCount.current ?? 0, trends?.propertyCount.previous ?? null)
            )}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Properties</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  ) : (
                    displayStats?.propertyCount ?? 0
                  )}
                </div>
                {trends && (
                  <TrendIndicator
                    current={trends.propertyCount.current}
                    previous={trends.propertyCount.previous}
                    format="number"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {displayStats?.propertyCount === 0
                    ? "Add your first property to get started"
                    : "Investment properties tracked"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="animate-card-entrance" style={{ '--stagger-index': 1 } as React.CSSProperties}>
          <Link href="/properties" prefetch={false}>
            <Card className={cn(
              "interactive-card hover:border-primary transition-colors cursor-pointer",
              getTrendBorderClass(trends?.portfolioValue.current ?? 0, trends?.portfolioValue.previous ?? null)
            )}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {!trends ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    formatCurrency(trends.portfolioValue.current)
                  )}
                </div>
                {trends && (
                  <TrendIndicator
                    current={trends.portfolioValue.current}
                    previous={trends.portfolioValue.previous}
                    format="currency"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Total estimated market value
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="animate-card-entrance" style={{ '--stagger-index': 2 } as React.CSSProperties}>
          <Link href="/properties" prefetch={false}>
            <Card className={cn(
              "interactive-card hover:border-primary transition-colors cursor-pointer",
              getTrendBorderClass(trends?.totalEquity.current ?? 0, trends?.totalEquity.previous ?? null)
            )}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {!trends ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : (
                    formatCurrency(trends.totalEquity.current)
                  )}
                </div>
                {trends && (
                  <TrendIndicator
                    current={trends.totalEquity.current}
                    previous={trends.totalEquity.previous}
                    format="currency"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Value minus current loan balances
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Row 2: Transactions, Uncategorized, Tax Position */}
        <div className="animate-card-entrance" style={{ '--stagger-index': 3 } as React.CSSProperties}>
          <Link href="/transactions" prefetch={false}>
            <Card className={cn(
              "interactive-card hover:border-primary transition-colors cursor-pointer",
              getTrendBorderClass(trends?.transactionCount.current ?? 0, trends?.transactionCount.previous ?? null)
            )}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  ) : (
                    displayStats?.transactionCount ?? 0
                  )}
                </div>
                {trends && (
                  <TrendIndicator
                    current={trends.transactionCount.current}
                    previous={trends.transactionCount.previous}
                    format="number"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {displayStats?.transactionCount === 0
                    ? "Connect your bank to import transactions"
                    : "Total transactions imported"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="animate-card-entrance" style={{ '--stagger-index': 4 } as React.CSSProperties}>
          <Link href="/transactions?category=uncategorized" prefetch={false}>
            <Card className={cn(
              "interactive-card hover:border-primary transition-colors cursor-pointer",
              getTrendBorderClass(trends?.uncategorizedCount.current ?? 0, trends?.uncategorizedCount.previous ?? null, true)
            )}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Uncategorised</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  ) : (
                    displayStats?.uncategorizedCount ?? 0
                  )}
                </div>
                {trends && (
                  <TrendIndicator
                    current={trends.uncategorizedCount.current}
                    previous={trends.uncategorizedCount.previous}
                    format="number"
                    invertColor
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {displayStats?.uncategorizedCount === 0
                    ? "All transactions categorised!"
                    : "Transactions needing review"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="animate-card-entrance" style={{ '--stagger-index': 5 } as React.CSSProperties}>
          <TaxPositionCard />
        </div>
      </div>
      )}

      {achievedCount > 0 && (
        <AchievementProgress achieved={achievedCount} total={totalMilestones} />
      )}

      <ActionItemsWidget />

      <StaleLoansDashboardCard />

      <PortfolioSummaryTable />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="animate-card-entrance" style={{ '--stagger-index': 0 } as React.CSSProperties}>
          <LvrGaugeCard />
        </div>
        <div className="animate-card-entrance" style={{ '--stagger-index': 1 } as React.CSSProperties}>
          <BorrowingPowerCard />
        </div>
        <div className="animate-card-entrance" style={{ '--stagger-index': 2 } as React.CSSProperties}>
          <EquityProjectionCard />
        </div>
      </div>

      <PortfolioValueChart />

      <CashFlowWidget />

      <UpcomingCashFlowWidget />

      <BudgetWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {properties && properties.length > 0 && (
          <PropertyMapWidget properties={properties} />
        )}
        <RentalYieldCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {properties && properties.length > 0 && (
          <ClimateRiskSummary properties={properties} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AIInsightsCard />
        <RecentActivityCard />
        <SavingsWidget />
        <UpcomingRemindersCard />
      </div>

      <TopPerformerMatchesWidget />
    </div>
  );
}
