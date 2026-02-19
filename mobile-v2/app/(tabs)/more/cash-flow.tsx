import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import { Card, CardTitle } from "../../../components/ui/Card";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { formatCurrency, cn } from "../../../lib/utils";

export default function CashFlowScreen() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 30_000 }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.transaction.list.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  const txList = transactions?.transactions ?? [];
  const monthTx = txList.filter((tx) => {
    const d = new Date(tx.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const income = monthTx.filter((tx) => tx.transactionType === "income").reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const expenses = monthTx.filter((tx) => tx.transactionType !== "income").reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const net = income - expenses;

  const monthName = new Date(year, month - 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text className="text-lg font-bold text-gray-900">{monthName}</Text>

      <View className="flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-xs text-gray-500">Income</Text>
          <Text className="text-lg font-bold text-success">{formatCurrency(income)}</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs text-gray-500">Expenses</Text>
          <Text className="text-lg font-bold text-gray-900">{formatCurrency(expenses)}</Text>
        </Card>
      </View>

      <Card>
        <Text className="text-xs text-gray-500">Net Cash Flow</Text>
        <Text className={cn("text-2xl font-bold", net >= 0 ? "text-success" : "text-destructive")}>
          {formatCurrency(net)}
        </Text>
      </Card>

      <CardTitle>Transactions This Month</CardTitle>
      {monthTx.length === 0 ? (
        <Text className="text-gray-500 text-sm text-center py-4">No transactions this month</Text>
      ) : (
        monthTx.slice(0, 20).map((tx) => (
          <View key={tx.id} className="flex-row justify-between py-2 border-b border-gray-100">
            <View className="flex-1 mr-3">
              <Text className="text-sm text-gray-900" numberOfLines={1}>{tx.description}</Text>
              <Text className="text-xs text-gray-500">{tx.category ?? "Uncategorized"}</Text>
            </View>
            <Text className={cn(
              "text-sm font-medium",
              tx.transactionType === "income" ? "text-success" : "text-gray-900"
            )}>
              {tx.transactionType === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
