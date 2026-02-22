import { View, Text, FlatList, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { CreditCard } from "lucide-react-native";
import { trpc } from "../../../lib/trpc";
import { Card, CardTitle } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { formatCurrency } from "../../../lib/utils";

export default function BankFeedsScreen() {
  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.bankConnection.list.useQuery();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.bankConnection.list.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={connections ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <Card>
          <View className="flex-row items-center mb-2">
            <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
              <CreditCard size={20} color="#6b7280" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-900">{item.institutionName}</Text>
              <Text className="text-xs text-gray-500">{item.accountName}</Text>
            </View>
            <Badge variant={item.status === "active" ? "success" : "warning"}>
              {item.status}
            </Badge>
          </View>
          {item.balance !== null && (
            <Text className="text-lg font-bold text-gray-900">{formatCurrency(item.balance)}</Text>
          )}
        </Card>
      )}
      ListEmptyComponent={
        <View className="items-center py-12">
          <CreditCard size={48} color="#9ca3af" />
          <Text className="text-gray-500 text-base mt-4">No bank accounts connected</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">
            Connect your bank accounts from the web app to see them here
          </Text>
        </View>
      }
      ListFooterComponent={
        <View className="mt-4">
          <Button variant="outline" onPress={() => {}}>
            Connect Bank Account
          </Button>
          <Text className="text-xs text-gray-400 text-center mt-2">
            Bank connections are managed via the web app
          </Text>
        </View>
      }
    />
  );
}
