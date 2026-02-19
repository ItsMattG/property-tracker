import { View, Text } from "react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDate, cn } from "../../lib/utils";

interface PropertyOverviewProps {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  purchasePrice: number;
  purchaseDate: string | null;
  currentValue: number | null;
  status: string;
  purpose: string;
}

export function PropertyOverview(props: PropertyOverviewProps) {
  const growth = props.currentValue && props.purchasePrice > 0
    ? ((props.currentValue - props.purchasePrice) / props.purchasePrice) * 100
    : null;

  return (
    <Card>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{props.address}</Text>
          <Text className="text-sm text-gray-500">{props.suburb}, {props.state} {props.postcode}</Text>
        </View>
        <Badge variant={props.status === "active" ? "success" : "outline"}>
          {props.status}
        </Badge>
      </View>

      <View className="flex-row justify-between mt-2">
        <View>
          <Text className="text-xs text-gray-500">Purchase Price</Text>
          <Text className="text-base font-semibold">{formatCurrency(props.purchasePrice)}</Text>
          {props.purchaseDate && (
            <Text className="text-xs text-gray-400">{formatDate(props.purchaseDate)}</Text>
          )}
        </View>
        {props.currentValue && (
          <View className="items-end">
            <Text className="text-xs text-gray-500">Current Value</Text>
            <Text className="text-base font-semibold">{formatCurrency(props.currentValue)}</Text>
            {growth !== null && (
              <Text className={cn(
                "text-xs",
                growth >= 0 ? "text-success" : "text-destructive"
              )}>
                {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}
