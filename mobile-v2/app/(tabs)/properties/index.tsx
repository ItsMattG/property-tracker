import { FlatList, View, Text, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { trpc } from "../../../lib/trpc";
import { PropertyCard } from "../../../components/properties/PropertyCard";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function PropertiesScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: properties, isLoading } = trpc.property.list.useQuery();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.property.list.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={properties ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PropertyCard
            id={item.id}
            address={item.address}
            suburb={item.suburb}
            state={item.state}
            currentValue={item.currentValue ?? null}
            purchasePrice={Number(item.purchasePrice)}
            grossYield={item.grossYield ?? null}
          />
        )}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500 text-base mb-4">No properties yet</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/properties/add")}
              className="bg-primary rounded-lg px-4 py-2"
            >
              <Text className="text-white font-semibold">Add Property</Text>
            </TouchableOpacity>
          </View>
        }
      />
      {(properties?.length ?? 0) > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/properties/add")}
          className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
