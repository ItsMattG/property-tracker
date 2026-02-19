import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import { Card, CardTitle } from "../../../components/ui/Card";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { formatCurrency } from "../../../lib/utils";

export default function TaxPositionScreen() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.taxPosition.getSummary.useQuery();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.taxPosition.getSummary.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card className="bg-primary">
        <Text className="text-white/70 text-sm">Total Deductions</Text>
        <Text className="text-white text-3xl font-bold">{formatCurrency(data?.totalDeductions ?? 0)}</Text>
        <View className="flex-row justify-between mt-4">
          <View>
            <Text className="text-white/70 text-xs">Est. Tax Saving</Text>
            <Text className="text-white text-lg font-semibold">{formatCurrency(data?.estimatedTaxSaving ?? 0)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-white/70 text-xs">Rental Income</Text>
            <Text className="text-white text-lg font-semibold">{formatCurrency(data?.totalRentalIncome ?? 0)}</Text>
          </View>
        </View>
      </Card>

      {data?.properties?.map((prop: any) => (
        <Card key={prop.id}>
          <Text className="text-sm font-semibold text-gray-900 mb-2">{prop.address}</Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-xs text-gray-500">Income</Text>
              <Text className="text-sm font-semibold text-success">{formatCurrency(prop.rentalIncome)}</Text>
            </View>
            <View>
              <Text className="text-xs text-gray-500">Expenses</Text>
              <Text className="text-sm font-semibold text-gray-900">{formatCurrency(prop.totalExpenses)}</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-gray-500">Net</Text>
              <Text className={`text-sm font-semibold ${prop.netPosition >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(prop.netPosition)}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
