import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { formatCurrency, formatPercent } from "../../lib/utils";

interface PortfolioSummaryProps {
  totalValue: number;
  totalEquity: number;
  totalDebt: number;
  portfolioLvr: number;
  propertyCount: number;
}

export function PortfolioSummaryCard({ totalValue, totalEquity, totalDebt, portfolioLvr, propertyCount }: PortfolioSummaryProps) {
  return (
    <Card>
      <CardTitle>Portfolio Summary</CardTitle>
      <Text className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</Text>
      <Text className="text-sm text-gray-500 mb-3">{propertyCount} {propertyCount === 1 ? "property" : "properties"}</Text>
      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-gray-500">Equity</Text>
          <Text className="text-base font-semibold text-success">{formatCurrency(totalEquity)}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">Debt</Text>
          <Text className="text-base font-semibold text-gray-900">{formatCurrency(totalDebt)}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">LVR</Text>
          <Text className="text-base font-semibold text-gray-900">{formatPercent(portfolioLvr)}</Text>
        </View>
      </View>
    </Card>
  );
}
