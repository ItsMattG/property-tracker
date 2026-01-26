import React, { useEffect, useState, useCallback } from "react";
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

interface Stats {
  propertyCount: number;
  uncategorizedCount: number;
}

interface Property {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  purchasePrice: string;
}

export function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, propertiesData] = await Promise.all([
        trpc.stats.dashboard.query(),
        trpc.property.list.query(),
      ]);
      setStats(statsData);
      setProperties(propertiesData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
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

  return (
    <ScrollView
      testID="dashboard-screen"
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <View className="p-4 space-y-4">
        {/* Stats Cards */}
        <View className="flex-row space-x-3">
          <View testID="stats-property-count" className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">Properties</Text>
            <Text className="text-2xl font-bold">
              {isLoading ? "-" : stats?.propertyCount ?? 0}
            </Text>
          </View>
          <View testID="stats-uncategorized-count" className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">To Review</Text>
            <Text className="text-2xl font-bold text-orange-600">
              {isLoading ? "-" : stats?.uncategorizedCount ?? 0}
            </Text>
          </View>
        </View>

        {/* Properties List */}
        <View testID="property-list" className="bg-white rounded-xl shadow-sm">
          <View className="p-4 border-b border-gray-100">
            <Text className="font-semibold text-lg">Properties</Text>
          </View>
          {properties.length === 0 ? (
            <View testID="empty-state" className="p-4">
              <Text className="text-gray-500 text-center">
                No properties yet
              </Text>
            </View>
          ) : (
            properties.map((property, index) => (
              <TouchableOpacity
                key={property.id}
                testID={`property-item-${index}`}
                className={`p-4 ${
                  index < properties.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <Text testID={`property-address-${index}`} className="font-medium">{property.address}</Text>
                <Text testID={`property-location-${index}`} className="text-gray-500 text-sm">
                  {property.suburb}, {property.state} {property.postcode}
                </Text>
                <Text testID={`property-price-${index}`} className="text-blue-600 font-medium mt-1">
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
