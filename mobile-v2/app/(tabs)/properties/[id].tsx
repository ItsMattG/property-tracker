import { ScrollView, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import { trpc } from "../../../lib/trpc";
import { PropertyOverview } from "../../../components/properties/PropertyOverview";
import { PropertyLoanCard } from "../../../components/properties/PropertyLoanCard";
import { RecentTransactions } from "../../../components/dashboard/RecentTransactions";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: property, isLoading } = trpc.property.get.useQuery({ id: id! });
  const { data: txData } = trpc.transaction.list.useQuery(
    { propertyId: id!, limit: 10, offset: 0 },
    { enabled: !!id }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      utils.property.get.invalidate({ id: id! }),
      utils.transaction.list.invalidate(),
    ]);
    setRefreshing(false);
  }, [utils, id]);

  if (isLoading || !property) return <LoadingScreen />;

  return (
    <>
      <Stack.Screen options={{ title: property.address }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PropertyOverview
          address={property.address}
          suburb={property.suburb}
          state={property.state}
          postcode={property.postcode}
          purchasePrice={Number(property.purchasePrice)}
          purchaseDate={property.purchaseDate}
          currentValue={property.currentValue ?? null}
          status={property.status}
          purpose={property.purpose}
        />
        <PropertyLoanCard loans={property.loans ?? []} />
        <RecentTransactions transactions={txData?.transactions ?? []} />
      </ScrollView>
    </>
  );
}
