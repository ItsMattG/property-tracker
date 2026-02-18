"use client";

import { useState, useMemo } from "react";
import { Landmark, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import Link from "next/link";

function getHeadlineColor(equity: number): string {
  if (equity > 50000) return "text-success";
  if (equity > 0) return "text-warning";
  return "text-destructive";
}

function getSurplusColor(surplus: number): string {
  return surplus > 0 ? "text-success" : "text-destructive";
}

function getDsrColor(dsr: number | null): string {
  if (dsr === null) return "text-muted-foreground";
  if (dsr < 40) return "text-success";
  if (dsr <= 60) return "text-warning";
  return "text-destructive";
}

export function BorrowingPowerCard() {
  const { data, isLoading } = trpc.portfolio.getBorrowingPower.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");

  const scenario = useMemo(() => {
    const price = parseFloat(targetPrice.replace(/[^0-9.]/g, ""));
    if (!data || !price || price <= 0) return null;

    const newLoan = price * 0.8;
    const depositNeeded = price * 0.2;
    // weightedAvgRate is a percentage (e.g. 5.79), convert to fraction and add 3% APRA buffer
    const assessmentRate = (data.weightedAvgRate + 3) / 100;
    const newAnnualRepayment = newLoan * assessmentRate;
    const newMonthlyRepayment = newAnnualRepayment / 12;
    const surplusAfter = data.netSurplus - newAnnualRepayment;
    const equityShortfall = Math.max(0, depositNeeded - data.usableEquity);
    const equityOk = depositNeeded <= data.usableEquity;
    const serviceabilityOk = surplusAfter > 0;

    return {
      depositNeeded,
      newMonthlyRepayment,
      surplusAfter: Math.round(surplusAfter),
      equityShortfall: Math.round(equityShortfall),
      equityOk,
      serviceabilityOk,
      feasible: equityOk && serviceabilityOk,
    };
  }, [data, targetPrice]);

  if (isLoading) {
    return (
      <Card data-testid="borrowing-power-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Borrowing Power</CardTitle>
          <Landmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.hasLoans) {
    return (
      <Card data-testid="borrowing-power-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Borrowing Power</CardTitle>
          <Landmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <Landmark className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Add your loans to see borrowing power</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/properties">Manage Properties</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="borrowing-power-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Borrowing Power</CardTitle>
        <Landmark className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Headline estimate */}
        <div>
          <p className="text-xs text-muted-foreground">Estimated Additional Borrowing</p>
          <p className={cn("text-2xl font-bold tabular-nums", getHeadlineColor(data.estimatedBorrowingPower))}>
            {formatCurrency(data.estimatedBorrowingPower)}
          </p>
        </div>

        {/* Supporting metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usable Equity</p>
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(data.usableEquity)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Surplus</p>
            <p className={cn("text-sm font-semibold tabular-nums", getSurplusColor(data.netSurplus))}>
              {formatCurrency(data.netSurplus)}/yr
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Debt Service</p>
            <p className={cn("text-sm font-semibold tabular-nums", getDsrColor(data.debtServiceRatio))}>
              {data.debtServiceRatio !== null ? `${data.debtServiceRatio}%` : "--"}
            </p>
          </div>
        </div>

        {/* Scenario calculator toggle */}
        <button
          type="button"
          onClick={() => setScenarioOpen(!scenarioOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full"
        >
          {scenarioOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          Explore a scenario
        </button>

        {/* Scenario calculator */}
        {scenarioOpen && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
            <div>
              <label htmlFor="target-price" className="text-xs text-muted-foreground block mb-1">
                Target property price
              </label>
              <Input
                id="target-price"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 850000"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="tabular-nums"
              />
            </div>

            {scenario && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit needed (20%)</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {formatCurrency(scenario.depositNeeded)}
                    {scenario.equityOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New repayment</span>
                  <span className="tabular-nums">{formatCurrency(scenario.newMonthlyRepayment)}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surplus after</span>
                  <span className={cn("flex items-center gap-1 tabular-nums", getSurplusColor(scenario.surplusAfter))}>
                    {formatCurrency(scenario.surplusAfter)}/yr
                    {scenario.serviceabilityOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </span>
                </div>

                {/* Result summary */}
                {scenario.feasible ? (
                  <div className="p-2 rounded-md bg-success/10 text-success text-xs flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    Looks feasible based on portfolio data
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {!scenario.equityOk && (
                      <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Equity short by {formatCurrency(scenario.equityShortfall)}
                      </div>
                    )}
                    {!scenario.serviceabilityOk && (
                      <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Serviceability short by {formatCurrency(Math.abs(scenario.surplusAfter))}/yr
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground leading-tight">
          Estimate only — does not include personal income, living expenses, or lender-specific criteria. Consult your mortgage broker.
        </p>
      </CardContent>
    </Card>
  );
}
