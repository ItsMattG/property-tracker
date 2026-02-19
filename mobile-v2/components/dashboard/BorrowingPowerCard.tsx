import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { formatCurrency, cn } from "../../lib/utils";

interface BorrowingPowerProps {
  estimatedBorrowingPower: number;
  usableEquity: number;
  netSurplus: number;
  hasLoans: boolean;
}

export function BorrowingPowerCard({ estimatedBorrowingPower, usableEquity, netSurplus, hasLoans }: BorrowingPowerProps) {
  if (!hasLoans) {
    return (
      <Card>
        <CardTitle>Borrowing Power</CardTitle>
        <Text className="text-sm text-gray-500 text-center py-4">Add loans to see borrowing power</Text>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Borrowing Power</CardTitle>
      <Text className={cn(
        "text-2xl font-bold",
        estimatedBorrowingPower > 50000 ? "text-success" : estimatedBorrowingPower > 0 ? "text-warning" : "text-destructive"
      )}>
        {formatCurrency(estimatedBorrowingPower)}
      </Text>
      <View className="flex-row justify-between mt-3">
        <View>
          <Text className="text-xs text-gray-500">Usable Equity</Text>
          <Text className="text-sm font-semibold">{formatCurrency(usableEquity)}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">Net Surplus</Text>
          <Text className={cn("text-sm font-semibold", netSurplus > 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(netSurplus)}/yr
          </Text>
        </View>
      </View>
    </Card>
  );
}
