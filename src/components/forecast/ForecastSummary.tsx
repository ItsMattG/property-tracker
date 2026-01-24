"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";

type ForecastSummaryProps = {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalNet: number;
    monthsWithNegativeCashFlow: number;
  };
};

export function ForecastSummary({ summary }: ForecastSummaryProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const isPositive = summary.totalNet >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Income</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.totalIncome)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Expenses</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.totalExpenses)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                isPositive
                  ? "bg-blue-100 dark:bg-blue-900/20"
                  : "bg-orange-100 dark:bg-orange-900/20"
              }`}
            >
              <DollarSign
                className={`h-4 w-4 ${
                  isPositive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Net</p>
              <p
                className={`text-xl font-semibold ${
                  isPositive ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {formatCurrency(summary.totalNet)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                summary.monthsWithNegativeCashFlow === 0
                  ? "bg-green-100 dark:bg-green-900/20"
                  : "bg-yellow-100 dark:bg-yellow-900/20"
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 ${
                  summary.monthsWithNegativeCashFlow === 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Negative Months</p>
              <p className="text-xl font-semibold">{summary.monthsWithNegativeCashFlow} / 12</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
