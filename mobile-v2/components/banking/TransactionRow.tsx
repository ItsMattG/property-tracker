import { View, Text, TouchableOpacity } from "react-native";
import { formatCurrency, formatDate, cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";

interface TransactionRowProps {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  transactionType: string;
  onPress?: () => void;
}

export function TransactionRow({ description, amount, date, category, transactionType, onPress }: TransactionRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row justify-between items-center py-3 px-4 bg-white border-b border-gray-100"
    >
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{description}</Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          <Text className="text-xs text-gray-500">{formatDate(date)}</Text>
          {category && <Badge variant="outline">{category}</Badge>}
        </View>
      </View>
      <Text className={cn(
        "text-sm font-semibold",
        transactionType === "income" ? "text-success" : "text-gray-900"
      )}>
        {transactionType === "income" ? "+" : "-"}{formatCurrency(Math.abs(amount))}
      </Text>
    </TouchableOpacity>
  );
}
