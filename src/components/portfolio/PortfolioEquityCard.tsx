"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Wallet, PiggyBank, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioEquityCardProps {
  totalValue: number;
  totalLoans: number;
  propertyCount: number;
}

export function PortfolioEquityCard({
  totalValue,
  totalLoans,
  propertyCount,
}: PortfolioEquityCardProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  // Calculate derived values
  const totalEquity = totalValue - totalLoans;
  const equityPercentage = totalValue > 0 ? (totalEquity / totalValue) * 100 : 0;
  const avgLvr = totalValue > 0 ? (totalLoans / totalValue) * 100 : 0;

  // Determine risk level based on LVR
  const getRiskLevel = (lvr: number) => {
    if (lvr < 60) return { label: "Low risk", color: "text-green-600" };
    if (lvr < 80) return { label: "Moderate risk", color: "text-yellow-600" };
    return { label: "High risk", color: "text-red-600" };
  };

  const riskLevel = getRiskLevel(avgLvr);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Equity Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Value */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center dark:bg-blue-900/30">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-lg font-semibold">{formatCurrency(totalValue)}</p>
            </div>
          </div>

          {/* Total Loans */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center dark:bg-orange-900/30">
              <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Loans</p>
              <p className="text-lg font-semibold">{formatCurrency(totalLoans)}</p>
            </div>
          </div>

          {/* Net Equity */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center dark:bg-green-900/30">
              <PiggyBank className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Equity</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(totalEquity)}
              </p>
            </div>
          </div>

          {/* Property Count */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center dark:bg-purple-900/30">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Properties</p>
              <p className="text-lg font-semibold">{propertyCount}</p>
            </div>
          </div>
        </div>

        {/* Equity Position Visualization */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Equity Position</span>
            <span className="font-medium">{equityPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={equityPercentage} className="h-3" />
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">Avg LVR: </span>
              <span className="font-medium">{avgLvr.toFixed(1)}%</span>
            </div>
            <span className={cn("font-medium", riskLevel.color)}>
              {riskLevel.label}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
