// src/components/tax-position/TaxPositionCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { Calculator, Home, ArrowRight, Loader2 } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

export function TaxPositionCard() {
  const { data: summary, isLoading } = trpc.taxPosition.getSummary.useQuery({});

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

  if (!summary) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load</p>
        </CardContent>
      </Card>
    );
  }

  const fyLabel = `FY${summary.financialYear - 1}-${String(summary.financialYear).slice(-2)}`;

  // Not set up state
  if (!summary.isComplete) {
    return (
      <Link href="/reports/tax-position">
        <Card className="cursor-pointer transition-colors hover:bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
            <span className="text-xs text-muted-foreground">{fyLabel}</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                See your estimated refund
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

  // Complete state
  const isRefund = summary.isRefund ?? true;
  const amount = summary.refundOrOwing ?? 0;
  const propertySavings = summary.propertySavings ?? 0;

  return (
    <Link href="/reports/tax-position">
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
              {formatCurrency(amount)}
            </p>
            {propertySavings > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Home className="h-3 w-3" />
                Properties {isRefund ? "saved" : "reduced by"} you{" "}
                {formatCurrency(propertySavings)}
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
