import { FlatList, View, Text, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { Check, X } from "lucide-react-native";
import { trpc } from "../../../lib/trpc";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { formatCurrency, formatDate } from "../../../lib/utils";

export default function TransactionReviewScreen() {
  const utils = trpc.useUtils();
  const { data: pending, isLoading } = trpc.categorization.getPending.useQuery();
  const approveMutation = trpc.categorization.approve.useMutation({
    onSuccess: () => {
      utils.categorization.getPending.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
  });
  const rejectMutation = trpc.categorization.reject.useMutation({
    onSuccess: () => {
      utils.categorization.getPending.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.categorization.getPending.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={pending ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <Card>
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>{item.description}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{formatDate(item.date)}</Text>
            </View>
            <Text className="text-base font-semibold">{formatCurrency(Math.abs(item.amount))}</Text>
          </View>
          {item.suggestedCategory && (
            <View className="flex-row items-center mb-3">
              <Text className="text-xs text-gray-500 mr-1">Suggested:</Text>
              <Badge>{item.suggestedCategory}</Badge>
            </View>
          )}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => approveMutation.mutate({ id: item.id })}
              className="flex-1 flex-row items-center justify-center bg-success/10 rounded-lg py-2.5"
            >
              <Check size={16} color="#16a34a" />
              <Text className="text-success font-medium ml-1">Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => rejectMutation.mutate({ id: item.id })}
              className="flex-1 flex-row items-center justify-center bg-destructive/10 rounded-lg py-2.5"
            >
              <X size={16} color="#dc2626" />
              <Text className="text-destructive font-medium ml-1">Reject</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <View className="items-center py-12">
          <Check size={48} color="#16a34a" />
          <Text className="text-gray-500 text-base mt-4">All caught up!</Text>
          <Text className="text-gray-400 text-sm">No transactions to review</Text>
        </View>
      }
    />
  );
}
