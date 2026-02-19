"use client";

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { calculateBorrowingPower, type BorrowingPowerInputs } from "@/lib/borrowing-power-calc";
import { BorrowingPowerInputPanel } from "@/components/tools/BorrowingPowerInputs";
import { BorrowingPowerResultPanel } from "@/components/tools/BorrowingPowerResult";
import { BorrowingPowerScenarios, type Scenario } from "@/components/tools/BorrowingPowerScenarios";

const DEFAULT_INPUTS: BorrowingPowerInputs = {
  grossSalary: 0,
  rentalIncome: 0,
  otherIncome: 0,
  householdType: "single",
  dependants: 0,
  livingExpenses: 0,
  existingPropertyLoans: 0,
  creditCardLimits: 0,
  otherLoans: 0,
  hecsBalance: 0,
  targetRate: 6.2,
  loanTermYears: 30,
  floorRate: 5.5,
  existingDebt: 0,
  grossAnnualIncome: 0,
};

let scenarioCounter = 0;

export default function BorrowingPowerPage() {
  const [inputs, setInputs] = useState<BorrowingPowerInputs>(DEFAULT_INPUTS);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [preFilledFields, setPreFilledFields] = useState<Set<string>>(new Set());

  const { data: portfolioData, isLoading } = trpc.portfolio.getBorrowingPower.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Pre-fill from portfolio data when it loads
  const [hasPreFilled, setHasPreFilled] = useState(false);
  if (portfolioData && !hasPreFilled && portfolioData.hasLoans) {
    const monthlyRental = Math.round(portfolioData.annualRentalIncome / 12);
    const monthlyRepayments = Math.round(portfolioData.annualRepayments / 12);
    const rate = portfolioData.weightedAvgRate > 0 ? portfolioData.weightedAvgRate : 6.2;

    setInputs((prev) => ({
      ...prev,
      rentalIncome: monthlyRental,
      existingPropertyLoans: monthlyRepayments,
      existingDebt: portfolioData.totalDebt,
      targetRate: parseFloat(rate.toFixed(2)),
    }));

    setPreFilledFields(new Set(["rentalIncome", "existingPropertyLoans"]));
    setHasPreFilled(true);
  }

  const handleInputChange = useCallback((updates: Partial<BorrowingPowerInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...updates };
      // Keep grossAnnualIncome in sync when grossSalary changes
      if ("grossSalary" in updates) {
        next.grossAnnualIncome = next.grossSalary * 12 + next.rentalIncome * 12 + next.otherIncome * 12;
      }
      if ("rentalIncome" in updates || "otherIncome" in updates) {
        next.grossAnnualIncome = next.grossSalary * 12 + next.rentalIncome * 12 + next.otherIncome * 12;
      }
      return next;
    });
  }, []);

  const result = useMemo(() => calculateBorrowingPower(inputs), [inputs]);

  const handleAddScenario = useCallback(() => {
    if (scenarios.length >= 3) return;
    scenarioCounter += 1;
    const scenarioInputs: BorrowingPowerInputs = {
      ...inputs,
      targetRate: parseFloat((inputs.targetRate + 1).toFixed(2)),
    };
    const scenarioResult = calculateBorrowingPower(scenarioInputs);
    setScenarios((prev) => [
      ...prev,
      {
        id: `scenario-${scenarioCounter}`,
        label: `+${scenarioCounter}%`,
        inputs: scenarioInputs,
        result: scenarioResult,
      },
    ]);
  }, [inputs, scenarios.length]);

  const handleRemoveScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleUpdateScenarioLabel = useCallback((id: string, label: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label } : s))
    );
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-9 w-64 rounded bg-muted animate-pulse" />
          <div className="mt-2 h-5 w-96 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-48 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Borrowing Power Estimator
        </h1>
        <p className="text-muted-foreground mt-1">
          Estimate how much you could borrow based on your income, expenses, and
          existing commitments. Pre-filled with your portfolio data where
          available.
        </p>
      </div>

      {/* Two-column layout: inputs left, result right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        <BorrowingPowerInputPanel
          inputs={inputs}
          onChange={handleInputChange}
          preFilledFields={preFilledFields}
        />
        <BorrowingPowerResultPanel result={result} />
      </div>

      {/* Scenarios below */}
      <BorrowingPowerScenarios
        baseInputs={inputs}
        baseResult={result}
        scenarios={scenarios}
        onAddScenario={handleAddScenario}
        onRemoveScenario={handleRemoveScenario}
        onUpdateScenarioLabel={handleUpdateScenarioLabel}
      />
    </div>
  );
}
