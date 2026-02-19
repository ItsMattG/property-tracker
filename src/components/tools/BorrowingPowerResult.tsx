"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  BorrowingPowerResult,
  DtiClassification,
} from "@/lib/borrowing-power-calc";

function getDtiColor(classification: DtiClassification): string {
  switch (classification) {
    case "green":
      return "text-success";
    case "amber":
      return "text-warning";
    case "red":
      return "text-destructive";
  }
}

function getDtiBadgeVariant(
  classification: DtiClassification
): "default" | "warning" | "destructive" {
  switch (classification) {
    case "green":
      return "default";
    case "amber":
      return "warning";
    case "red":
      return "destructive";
  }
}

function getDtiBadgeLabel(classification: DtiClassification): string {
  switch (classification) {
    case "green":
      return "Healthy";
    case "amber":
      return "Elevated";
    case "red":
      return "High";
  }
}

interface BorrowingPowerResultPanelProps {
  result: BorrowingPowerResult;
}

export function BorrowingPowerResultPanel({
  result,
}: BorrowingPowerResultPanelProps) {
  const {
    maxLoan,
    assessmentRate,
    monthlyRepayment,
    monthlySurplus,
    dtiRatio,
    dtiClassification,
    totalMonthlyIncome,
    effectiveLivingExpenses,
    hemApplied,
    totalMonthlyCommitments,
    shadedSalary,
    shadedRental,
    shadedOther,
  } = result;

  // Income allocation bar percentages
  const incomeTotal = totalMonthlyIncome > 0 ? totalMonthlyIncome : 1;
  const expensesPct = Math.min(
    (effectiveLivingExpenses / incomeTotal) * 100,
    100
  );
  const repaymentPct = Math.min((monthlyRepayment / incomeTotal) * 100, 100);
  const surplusPct = Math.max(
    100 - expensesPct - repaymentPct,
    0
  );

  return (
    <div className="space-y-6">
      {/* Headline */}
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            Estimated Borrowing Power
          </p>
          <p
            className={cn(
              "text-4xl font-bold tabular-nums",
              maxLoan > 0 ? "text-success" : "text-destructive"
            )}
          >
            {formatCurrency(maxLoan)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Assessed at {assessmentRate.toFixed(2)}% (incl. APRA 3% buffer)
          </p>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Monthly Repayment
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(monthlyRepayment)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Monthly Surplus
            </p>
            <p
              className={cn(
                "text-xl font-semibold tabular-nums",
                monthlySurplus >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatCurrency(monthlySurplus)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DTI Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Debt-to-Income Ratio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                getDtiColor(dtiClassification)
              )}
            >
              {dtiRatio === Infinity ? "N/A" : dtiRatio.toFixed(1)}x
            </span>
            <Badge variant={getDtiBadgeVariant(dtiClassification)}>
              {getDtiBadgeLabel(dtiClassification)}
            </Badge>
          </div>
          {dtiClassification === "red" && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Your DTI ratio is at or above 6x, which exceeds APRA's
                serviceability guidance. Most lenders will decline applications
                at this level.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income Allocation Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Income Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-6 w-full overflow-hidden rounded-full">
            {expensesPct > 0 && (
              <div
                className="bg-destructive/70 transition-all"
                style={{ width: `${expensesPct}%` }}
              />
            )}
            {repaymentPct > 0 && (
              <div
                className="bg-warning/70 transition-all"
                style={{ width: `${repaymentPct}%` }}
              />
            )}
            {surplusPct > 0 && (
              <div
                className="bg-success/70 transition-all"
                style={{ width: `${surplusPct}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span>
                Expenses ({expensesPct.toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span>
                Repayment ({repaymentPct.toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span>
                Surplus ({surplusPct.toFixed(0)}%)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Calculation Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shaded salary income</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(shadedSalary)}/mo
              </dd>
            </div>
            {shadedRental > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Shaded rental income (80%)
                </dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(shadedRental)}/mo
                </dd>
              </div>
            )}
            {shadedOther > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Shaded other income (80%)
                </dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(shadedOther)}/mo
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <dt className="text-muted-foreground">Total shaded income</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(totalMonthlyIncome)}/mo
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Living expenses
                {hemApplied && (
                  <span className="ml-1 text-xs text-warning">(HEM applied)</span>
                )}
              </dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(effectiveLivingExpenses)}/mo
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Existing commitments</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(totalMonthlyCommitments)}/mo
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <dt>Monthly surplus</dt>
              <dd
                className={cn(
                  "tabular-nums",
                  monthlySurplus >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatCurrency(monthlySurplus)}/mo
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-[11px] leading-relaxed text-muted-foreground px-1">
        This estimate is for illustrative purposes only and does not constitute
        financial advice. Actual borrowing capacity will vary based on individual
        lender policies, credit history, property type, and other factors not
        captured here. Consult a licensed mortgage broker or lender for an
        accurate assessment.
      </p>
    </div>
  );
}
