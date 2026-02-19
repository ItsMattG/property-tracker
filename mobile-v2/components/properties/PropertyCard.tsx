import { TouchableOpacity, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Building2 } from "lucide-react-native";
import { formatCurrency } from "../../lib/utils";

interface PropertyCardProps {
  id: string;
  address: string;
  suburb: string;
  state: string;
  currentValue: number | null;
  purchasePrice: number;
  grossYield: number | null;
}

export function PropertyCard({ id, address, suburb, state, currentValue, purchasePrice, grossYield }: PropertyCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/properties/${id}`)}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-3"
    >
      <View className="flex-row items-start">
        <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center mr-3">
          <Building2 size={20} color="#2563eb" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>{address}</Text>
          <Text className="text-sm text-gray-500">{suburb}, {state}</Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-semibold text-gray-900">
            {formatCurrency(currentValue ?? purchasePrice)}
          </Text>
          {grossYield !== null && grossYield > 0 && (
            <Text className="text-xs text-success">{grossYield.toFixed(1)}% yield</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
