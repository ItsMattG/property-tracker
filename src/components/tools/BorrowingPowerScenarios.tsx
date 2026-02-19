"use client";

import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  BorrowingPowerInputs,
  BorrowingPowerResult,
} from "@/lib/borrowing-power-calc";

export interface Scenario {
  id: string;
  label: string;
  inputs: BorrowingPowerInputs;
  result: BorrowingPowerResult;
}

interface BorrowingPowerScenariosProps {
  baseInputs: BorrowingPowerInputs;
  baseResult: BorrowingPowerResult;
  scenarios: Scenario[];
  onAddScenario: () => void;
  onRemoveScenario: (id: string) => void;
  onUpdateScenarioLabel: (id: string, label: string) => void;
}

const MAX_SCENARIOS = 3;

function formatDiff(current: number, base: number) {
  const diff = current - base;
  if (Math.abs(diff) < 1) return null;

  const formatted = formatCurrency(Math.abs(diff));
  if (diff > 0) {
    return <span className="text-green-600 dark:text-green-400">+{formatted}</span>;
  }
  return <span className="text-red-600 dark:text-red-400">-{formatted}</span>;
}

function getDtiBadgeVariant(classification: "green" | "amber" | "red") {
  switch (classification) {
    case "green":
      return "default" as const;
    case "amber":
      return "warning" as const;
    case "red":
      return "destructive" as const;
  }
}

export function BorrowingPowerScenarios({
  baseResult,
  scenarios,
  onAddScenario,
  onRemoveScenario,
  onUpdateScenarioLabel,
}: BorrowingPowerScenariosProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Compare Scenarios</CardTitle>
          {scenarios.length < MAX_SCENARIOS && (
            <Button variant="outline" size="sm" onClick={onAddScenario}>
              <Plus className="w-4 h-4" />
              Add Scenario
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {scenarios.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Add a scenario to compare different interest rates, income levels, or
            loan terms side by side.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                    Metric
                  </th>
                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">
                    Current
                  </th>
                  {scenarios.map((scenario) => (
                    <th key={scenario.id} className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={scenario.label}
                          onChange={(e) =>
                            onUpdateScenarioLabel(scenario.id, e.target.value)
                          }
                          className="w-24 bg-transparent text-right text-sm font-medium outline-none border-b border-transparent focus:border-border"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6"
                          onClick={() => onRemoveScenario(scenario.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Borrowing Power */}
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium">Borrowing Power</td>
                  <td className="py-3 px-4 text-right font-bold">
                    {formatCurrency(baseResult.maxLoan)}
                  </td>
                  {scenarios.map((scenario) => (
                    <td key={scenario.id} className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{formatCurrency(scenario.result.maxLoan)}</span>
                        {formatDiff(scenario.result.maxLoan, baseResult.maxLoan)}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Monthly Repayment */}
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium">Monthly Repayment</td>
                  <td className="py-3 px-4 text-right font-bold">
                    {formatCurrency(baseResult.monthlyRepayment)}
                  </td>
                  {scenarios.map((scenario) => (
                    <td key={scenario.id} className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>
                          {formatCurrency(scenario.result.monthlyRepayment)}
                        </span>
                        {formatDiff(
                          scenario.result.monthlyRepayment,
                          baseResult.monthlyRepayment
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Monthly Surplus */}
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium">Monthly Surplus</td>
                  <td className="py-3 px-4 text-right font-bold">
                    {formatCurrency(baseResult.monthlySurplus)}
                  </td>
                  {scenarios.map((scenario) => (
                    <td key={scenario.id} className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>
                          {formatCurrency(scenario.result.monthlySurplus)}
                        </span>
                        {formatDiff(
                          scenario.result.monthlySurplus,
                          baseResult.monthlySurplus
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* DTI Ratio */}
                <tr>
                  <td className="py-3 pr-4 font-medium">DTI Ratio</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end">
                      <Badge
                        variant={getDtiBadgeVariant(
                          baseResult.dtiClassification
                        )}
                      >
                        {baseResult.dtiRatio.toFixed(1)}x
                      </Badge>
                    </div>
                  </td>
                  {scenarios.map((scenario) => (
                    <td key={scenario.id} className="py-3 px-4 text-right">
                      <div className="flex justify-end">
                        <Badge
                          variant={getDtiBadgeVariant(
                            scenario.result.dtiClassification
                          )}
                        >
                          {scenario.result.dtiRatio.toFixed(1)}x
                        </Badge>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
