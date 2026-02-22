import { useState } from "react";
import { ScrollView, View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { Card, CardTitle } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { formatCurrency, cn } from "../../../lib/utils";

// Simplified APRA borrowing power calculation
function calculateBorrowingPower(inputs: {
  grossSalary: number;
  rentalIncome: number;
  livingExpenses: number;
  existingRepayments: number;
  creditCardLimits: number;
}) {
  const assessmentRate = 0.0925; // ~6.25% + 3% buffer
  const monthlyRate = assessmentRate / 12;
  const loanTermMonths = 30 * 12;

  const shadedSalary = inputs.grossSalary * (1 - 0.325); // after tax approx
  const shadedRental = inputs.rentalIncome * 0.8;
  const monthlyIncome = (shadedSalary + shadedRental) / 12;

  const monthlyExpenses = inputs.livingExpenses / 12;
  const monthlyRepayments = inputs.existingRepayments / 12;
  const creditCardMin = (inputs.creditCardLimits * 0.038) / 12;

  const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyRepayments - creditCardMin;
  if (monthlySurplus <= 0) return { maxLoan: 0, monthlySurplus: monthlySurplus * 12 };

  const pvFactor = (1 - Math.pow(1 + monthlyRate, -loanTermMonths)) / monthlyRate;
  const maxLoan = Math.round(monthlySurplus * pvFactor);

  return { maxLoan: Math.max(0, maxLoan), monthlySurplus: monthlySurplus * 12 };
}

export default function BorrowingPowerScreen() {
  const [salary, setSalary] = useState("");
  const [rental, setRental] = useState("");
  const [living, setLiving] = useState("");
  const [repayments, setRepayments] = useState("");
  const [creditCards, setCreditCards] = useState("");
  const [result, setResult] = useState<{ maxLoan: number; monthlySurplus: number } | null>(null);

  const handleCalculate = () => {
    const r = calculateBorrowingPower({
      grossSalary: Number(salary) || 0,
      rentalIncome: Number(rental) || 0,
      livingExpenses: Number(living) || 0,
      existingRepayments: Number(repayments) || 0,
      creditCardLimits: Number(creditCards) || 0,
    });
    setResult(r);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <CardTitle>Income (Annual)</CardTitle>
          <View className="gap-3">
            <Input label="Gross Salary" value={salary} onChangeText={setSalary} placeholder="120000" keyboardType="decimal-pad" />
            <Input label="Rental Income" value={rental} onChangeText={setRental} placeholder="25000" keyboardType="decimal-pad" />
          </View>
        </Card>

        <Card>
          <CardTitle>Expenses (Annual)</CardTitle>
          <View className="gap-3">
            <Input label="Living Expenses" value={living} onChangeText={setLiving} placeholder="30000" keyboardType="decimal-pad" />
            <Input label="Existing Loan Repayments" value={repayments} onChangeText={setRepayments} placeholder="0" keyboardType="decimal-pad" />
            <Input label="Credit Card Limits" value={creditCards} onChangeText={setCreditCards} placeholder="0" keyboardType="decimal-pad" />
          </View>
        </Card>

        <Button onPress={handleCalculate}>Calculate</Button>

        {result && (
          <Card>
            <Text className="text-xs text-gray-500 mb-1">Estimated Borrowing Power</Text>
            <Text className={cn(
              "text-3xl font-bold",
              result.maxLoan > 0 ? "text-success" : "text-destructive"
            )}>
              {formatCurrency(result.maxLoan)}
            </Text>
            <View className="flex-row items-center mt-2">
              <Text className="text-xs text-gray-500 mr-1">Annual Surplus:</Text>
              <Badge variant={result.monthlySurplus > 0 ? "success" : "destructive"}>
                {formatCurrency(result.monthlySurplus)}
              </Badge>
            </View>
            <Text className="text-xs text-gray-400 mt-3">
              Estimate only. Uses simplified APRA serviceability model with 3% buffer. Consult a mortgage broker for accurate figures.
            </Text>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
