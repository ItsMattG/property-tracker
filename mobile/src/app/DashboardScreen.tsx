import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { trpc } from "../lib/trpc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardScreen() {
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.stats.dashboard.useQuery();

  const { data: properties } = trpc.property.list.useQuery();

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View className="p-4 space-y-4">
        {/* Stats Cards */}
        <View className="flex-row space-x-3">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">Properties</Text>
            <Text className="text-2xl font-bold">
              {isLoading ? "-" : stats?.propertyCount ?? 0}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">To Review</Text>
            <Text className="text-2xl font-bold text-orange-600">
              {isLoading ? "-" : stats?.uncategorizedCount ?? 0}
            </Text>
          </View>
        </View>

        {/* Properties List */}
        <View className="bg-white rounded-xl shadow-sm">
          <View className="p-4 border-b border-gray-100">
            <Text className="font-semibold text-lg">Properties</Text>
          </View>
          {properties?.length === 0 ? (
            <View className="p-4">
              <Text className="text-gray-500 text-center">
                No properties yet
              </Text>
            </View>
          ) : (
            properties?.map((property, index) => (
              <TouchableOpacity
                key={property.id}
                className={`p-4 ${
                  index < (properties?.length ?? 0) - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <Text className="font-medium">{property.address}</Text>
                <Text className="text-gray-500 text-sm">
                  {property.suburb}, {property.state} {property.postcode}
                </Text>
                <Text className="text-blue-600 font-medium mt-1">
                  {formatCurrency(Number(property.purchasePrice))}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
