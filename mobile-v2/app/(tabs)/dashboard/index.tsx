import { ScrollView, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import { PortfolioSummaryCard } from "../../../components/dashboard/PortfolioSummaryCard";
import { BorrowingPowerCard } from "../../../components/dashboard/BorrowingPowerCard";
import { RecentTransactions } from "../../../components/dashboard/RecentTransactions";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function DashboardScreen() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.stats.dashboard.useQuery();
  const { data: borrowing, isLoading: borrowingLoading } = trpc.portfolio.getBorrowingPower.useQuery(
    undefined,
    { staleTime: 60_000 }
  );
  const { data: txData } = trpc.transaction.list.useQuery(
    { limit: 5, offset: 0 },
    { staleTime: 30_000 }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      utils.stats.dashboard.invalidate(),
      utils.portfolio.getBorrowingPower.invalidate(),
      utils.transaction.list.invalidate(),
    ]);
    setRefreshing(false);
  }, [utils]);

  if (statsLoading || borrowingLoading) return <LoadingScreen />;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {stats && (
        <PortfolioSummaryCard
          totalValue={stats.totalValue ?? 0}
          totalEquity={stats.totalEquity ?? 0}
          totalDebt={stats.totalDebt ?? 0}
          portfolioLvr={stats.portfolioLvr ?? 0}
          propertyCount={stats.propertyCount ?? 0}
        />
      )}

      {borrowing && (
        <BorrowingPowerCard
          estimatedBorrowingPower={borrowing.estimatedBorrowingPower}
          usableEquity={borrowing.usableEquity}
          netSurplus={borrowing.netSurplus}
          hasLoans={borrowing.hasLoans}
        />
      )}

      <RecentTransactions transactions={txData?.transactions ?? []} />
    </ScrollView>
  );
}
