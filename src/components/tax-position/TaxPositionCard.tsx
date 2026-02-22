// src/components/tax-position/TaxPositionCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Calculator, Home, ArrowRight, Loader2, TrendingUp, RefreshCw } from "lucide-react";

export function TaxPositionCard() {
  const { data: summary, isLoading, isError, refetch } = trpc.taxPosition.getSummary.useQuery({});
  const { data: currentYear } = trpc.taxPosition.getCurrentYear.useQuery();
  const { data: forecast } = trpc.taxForecast.getForecast.useQuery(
    { financialYear: currentYear! },
    { enabled: !!currentYear }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !summary) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load tax position</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="mt-2 h-7 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fyLabel = `FY${summary.financialYear - 1}-${String(summary.financialYear).slice(-2)}`;

  // Not set up state
  if (!summary.isComplete) {
    return (
      <Link href="/reports/tax-position" prefetch={false}>
        <Card className="cursor-pointer transition-colors hover:bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
            <span className="text-xs text-muted-foreground">{fyLabel}</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Estimate your tax refund for this financial year based on your property income and expenses.
              </p>
              <Button size="sm" variant="outline" className="w-full">
                Set up in 2 min
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Complete state - use type narrowing for optional fields
  const isRefund = "isRefund" in summary ? summary.isRefund : true;
  const amount = summary.refundOrOwing ?? 0;
  const propertySavings = summary.propertySavings ?? 0;

  return (
    <Link href="/reports/tax-position" prefetch={false}>
      <Card className="cursor-pointer transition-colors hover:bg-secondary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <span className="text-xs text-muted-foreground">{fyLabel}</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isRefund ? "Estimated Refund" : "Estimated Owing"}
            </p>
            <p
              className={`text-2xl font-bold ${
                isRefund ? "text-green-600" : "text-amber-600"
              }`}
            >
              {formatCurrency(Math.abs(amount))}
            </p>
            {propertySavings > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Home className="h-3 w-3" />
                Properties {isRefund ? "saved" : "reduced by"} you{" "}
                {formatCurrency(Math.abs(propertySavings))}
              </p>
            )}
            {forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Projected: {formatCurrency(Math.abs(forecast.taxPosition.forecast.refundOrOwing))}{" "}
                {forecast.taxPosition.forecast.isRefund ? "refund" : "owing"} full year
              </p>
            )}
            <p className="text-xs text-primary flex items-center gap-1 pt-1">
              View details
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
