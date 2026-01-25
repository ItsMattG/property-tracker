"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, TrendingDown, Clock, DollarSign } from "lucide-react";
import Link from "next/link";

export default function LoanComparePage() {
  const params = useParams();
  const loanId = params.id as string;

  const [newRate, setNewRate] = useState("");
  const [switchingCosts, setSwitchingCosts] = useState("3000");

  const { data: loan, isLoading: loanLoading } = trpc.loan.get.useQuery({ id: loanId });

  const { data: marketRate } = trpc.loanComparison.getMarketRate.useQuery(
    {
      purpose: "investor",
      repaymentType: loan?.loanType || "principal_and_interest",
      lvr: 80,
    },
    { enabled: !!loan }
  );

  const { data: comparison } = trpc.loanComparison.calculate.useQuery(
    {
      principal: parseFloat(loan?.currentBalance || "0"),
      currentRate: parseFloat(loan?.interestRate || "0"),
      newRate: parseFloat(newRate || "0"),
      remainingMonths: 300,
      switchingCosts: parseFloat(switchingCosts || "0"),
    },
    { enabled: !!loan && !!newRate && parseFloat(newRate) > 0 }
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  if (loanLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!loan) {
    return <div>Loan not found</div>;
  }

  const currentRate = parseFloat(loan.interestRate);
  const rateGap = marketRate?.estimatedRate
    ? currentRate - marketRate.estimatedRate
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/loans">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Loans
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Compare Loan Options</h1>
          <p className="text-muted-foreground">{loan.property?.address}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Loan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lender</span>
              <span className="font-medium">{loan.lender}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(loan.currentBalance))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{currentRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">
                {loan.loanType.replace(/_/g, " ")}
              </span>
            </div>

            {rateGap !== null && rateGap > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Your rate is <strong>{rateGap.toFixed(2)}%</strong> above the
                  estimated market rate of{" "}
                  <strong>{marketRate?.estimatedRate?.toFixed(2)}%</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compare With</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newRate">New Interest Rate (%)</Label>
              <Input
                id="newRate"
                type="number"
                step="0.01"
                placeholder={marketRate?.estimatedRate?.toFixed(2) || "5.50"}
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
              />
              {marketRate?.estimatedRate && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={() => setNewRate(marketRate.estimatedRate!.toFixed(2))}
                >
                  Use market rate ({marketRate.estimatedRate.toFixed(2)}%)
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="switchingCosts">Switching Costs ($)</Label>
              <Input
                id="switchingCosts"
                type="number"
                step="100"
                placeholder="3000"
                value={switchingCosts}
                onChange={(e) => setSwitchingCosts(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include discharge fees, application fees, legal costs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {comparison && parseFloat(newRate) > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Savings</p>
                  <p className="text-2xl font-bold">
                    {comparison.monthlySavings > 0 ? (
                      <span className="text-green-600">
                        {formatCurrency(comparison.monthlySavings)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        -{formatCurrency(Math.abs(comparison.monthlySavings))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Interest Saved</p>
                  <p className="text-2xl font-bold">
                    {comparison.totalInterestSaved > 0 ? (
                      <span className="text-green-600">
                        {formatCurrency(comparison.totalInterestSaved)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        -{formatCurrency(Math.abs(comparison.totalInterestSaved))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Break-even</p>
                  <p className="text-2xl font-bold">
                    {comparison.breakEvenMonths === Infinity ? (
                      <span className="text-muted-foreground">N/A</span>
                    ) : (
                      <span>{comparison.breakEvenMonths} months</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {comparison && comparison.monthlySavings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Refinancing could save you{" "}
              <strong>{formatCurrency(comparison.monthlySavings)}/month</strong> and{" "}
              <strong>{formatCurrency(comparison.totalInterestSaved)}</strong> in total
              interest over the remaining loan term.
            </p>
            {comparison.breakEvenMonths < 36 && (
              <p className="mt-2 text-green-600">
                You&apos;ll recover your switching costs in just{" "}
                <strong>{comparison.breakEvenMonths} months</strong>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
