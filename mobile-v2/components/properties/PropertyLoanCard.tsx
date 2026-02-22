import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatPercent } from "../../lib/utils";

interface Loan {
  id: string;
  lender: string | null;
  loanType: string;
  currentBalance: number;
  interestRate: number;
  repaymentAmount: number;
  repaymentFrequency: string;
}

export function PropertyLoanCard({ loans }: { loans: Loan[] }) {
  if (loans.length === 0) {
    return (
      <Card>
        <CardTitle>Loans</CardTitle>
        <Text className="text-sm text-gray-500 text-center py-4">No loans linked to this property</Text>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Loans</CardTitle>
      {loans.map((loan) => (
        <View key={loan.id} className="py-3 border-b border-gray-100">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-sm font-semibold text-gray-900">{loan.lender ?? "Unknown Lender"}</Text>
              <Badge variant="outline">{loan.loanType.replace(/_/g, " ")}</Badge>
            </View>
            <View className="items-end">
              <Text className="text-base font-semibold">{formatCurrency(loan.currentBalance)}</Text>
              <Text className="text-xs text-gray-500">{formatPercent(loan.interestRate)}</Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            {formatCurrency(loan.repaymentAmount)} / {loan.repaymentFrequency}
          </Text>
        </View>
      ))}
    </Card>
  );
}
