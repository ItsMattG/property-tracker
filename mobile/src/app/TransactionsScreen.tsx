import React from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { trpc } from "../lib/trpc";
import { SwipeableTransaction } from "../components/SwipeableTransaction";

export function TransactionsScreen() {
  const utils = trpc.useUtils();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.categorization.getPendingReview.useQuery({
    confidenceFilter: "all",
    limit: 50,
    offset: 0,
  });

  const acceptMutation = trpc.categorization.acceptSuggestion.useMutation({
    onSuccess: () => {
      utils.categorization.getPendingReview.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  const rejectMutation = trpc.categorization.rejectSuggestion.useMutation({
    onSuccess: () => {
      utils.categorization.getPendingReview.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  function handleAccept(transactionId: string) {
    acceptMutation.mutate({ transactionId });
  }

  function handleReject(transactionId: string) {
    rejectMutation.mutate({
      transactionId,
      newCategory: "personal",
    });
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const transactions = data?.transactions ?? [];

  return (
    <View className="flex-1 bg-gray-50">
      {transactions.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500 text-center text-lg">
            All caught up!
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            No transactions need review
          </Text>
        </View>
      ) : (
        <>
          <View className="bg-blue-50 p-3">
            <Text className="text-blue-800 text-sm text-center">
              Swipe right to accept • Swipe left to mark personal
            </Text>
          </View>
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SwipeableTransaction
                transaction={item}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          />
        </>
      )}
    </View>
  );
}
