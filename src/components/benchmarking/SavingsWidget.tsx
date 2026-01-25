"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SavingsWidget() {
  const { data: summary, isLoading } =
    trpc.benchmarking.getPortfolioSummary.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Don't show widget if no savings or less than $100
  if (!summary || summary.totalPotentialSavings < 100) {
    return null;
  }

  const savingsBreakdown = [
    summary.insuranceSavings > 0 &&
      `Insurance: ${formatCurrency(summary.insuranceSavings)}`,
    summary.councilRatesSavings > 0 &&
      `Rates: ${formatCurrency(summary.councilRatesSavings)}`,
    summary.managementFeesSavings > 0 &&
      `Mgmt: ${formatCurrency(summary.managementFeesSavings)}`,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PiggyBank className="w-4 h-4 text-emerald-500" />
          </div>
          <CardTitle className="text-base">Potential Savings</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-emerald-600">
          {formatCurrency(summary.totalPotentialSavings)}/year
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          across {summary.propertiesWithSavings} of {summary.totalProperties}{" "}
          properties
        </p>
        {savingsBreakdown.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {savingsBreakdown.join(" · ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
