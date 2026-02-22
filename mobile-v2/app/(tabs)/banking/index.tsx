import { FlatList, View, Text, TextInput, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Search, Camera, CreditCard, CheckCircle } from "lucide-react-native";
import { trpc } from "../../../lib/trpc";
import { TransactionRow } from "../../../components/banking/TransactionRow";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function TransactionsScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = trpc.transaction.list.useQuery(
    { limit, offset: 0, search: search || undefined },
    { staleTime: 30_000 }
  );
  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(
    undefined,
    { staleTime: 30_000 }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.transaction.list.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2 text-sm text-gray-900"
          />
        </View>
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/banking/review")}
            className="flex-row items-center bg-primary/10 rounded-lg px-3 py-2"
          >
            <CheckCircle size={16} color="#2563eb" />
            <Text className="text-primary text-sm font-medium ml-1">
              Review{pendingCount ? ` (${pendingCount})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/banking/feeds")}
            className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2"
          >
            <CreditCard size={16} color="#6b7280" />
            <Text className="text-gray-700 text-sm font-medium ml-1">Bank Feeds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/banking/camera")}
            className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2"
          >
            <Camera size={16} color="#6b7280" />
            <Text className="text-gray-700 text-sm font-medium ml-1">Receipt</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={data?.transactions ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionRow
            id={item.id}
            description={item.description}
            amount={item.amount}
            date={item.date}
            category={item.category}
            transactionType={item.transactionType}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500 text-base">No transactions found</Text>
          </View>
        }
      />
    </View>
  );
}
