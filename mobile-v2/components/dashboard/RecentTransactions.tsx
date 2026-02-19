import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Card, CardTitle } from "../ui/Card";
import { formatCurrency, formatDate, cn } from "../../lib/utils";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  transactionType: string;
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();

  if (transactions.length === 0) {
    return (
      <Card>
        <CardTitle>Recent Transactions</CardTitle>
        <Text className="text-sm text-gray-500 text-center py-4">No recent transactions</Text>
      </Card>
    );
  }

  return (
    <Card>
      <View className="flex-row justify-between items-center mb-2">
        <CardTitle>Recent Transactions</CardTitle>
        <TouchableOpacity onPress={() => router.push("/(tabs)/banking")}>
          <Text className="text-sm text-primary font-medium">See all</Text>
        </TouchableOpacity>
      </View>
      {transactions.slice(0, 5).map((tx) => (
        <View key={tx.id} className="flex-row justify-between py-2.5 border-b border-gray-100">
          <View className="flex-1 mr-3">
            <Text className="text-sm text-gray-900" numberOfLines={1}>{tx.description}</Text>
            <Text className="text-xs text-gray-500">{formatDate(tx.date)}</Text>
          </View>
          <Text className={cn(
            "text-sm font-medium",
            tx.transactionType === "income" ? "text-success" : "text-gray-900"
          )}>
            {tx.transactionType === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
          </Text>
        </View>
      ))}
    </Card>
  );
}
