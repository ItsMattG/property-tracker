import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { trpc } from "../lib/trpc";
import { SwipeableTransaction } from "../components/SwipeableTransaction";

interface Transaction {
  id: string;
  description: string;
  amount: string;
  date: string;
  suggestedCategory: string | null;
  suggestionConfidence: string | null;
}

export function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await trpc.categorization.getPendingReview.query({
        confidenceFilter: "all",
        limit: 50,
        offset: 0,
      });
      setTransactions(data.transactions);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  async function handleAccept(transactionId: string) {
    try {
      await trpc.categorization.acceptSuggestion.mutate({ transactionId });
      // Remove from local state for instant feedback
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    } catch (error) {
      console.error("Failed to accept:", error);
    }
  }

  async function handleReject(transactionId: string) {
    try {
      await trpc.categorization.rejectSuggestion.mutate({
        transactionId,
        newCategory: "personal",
      });
      // Remove from local state for instant feedback
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  }

  if (isLoading) {
    return (
      <View testID="transactions-loading" className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View testID="transactions-screen" className="flex-1 bg-gray-50">
      {transactions.length === 0 ? (
        <View testID="transactions-empty" className="flex-1 items-center justify-center p-4">
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
            testID="transactions-list"
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <SwipeableTransaction
                testID={`transaction-card-${index}`}
                transaction={item}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
          />
        </>
      )}
    </View>
  );
}
