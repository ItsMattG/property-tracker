"use client";

import { useState, useMemo } from "react";
import { BarChart3, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";

interface ScorecardComparisonProps {
  properties: PropertyScorecardEntry[];
  averageGrossYield: number;
  averageNetYield: number;
  averageScore: number;
}

interface MetricRow {
  label: string;
  getValue: (entry: PropertyScorecardEntry) => string;
  getNumericValue: (entry: PropertyScorecardEntry) => number;
  higherIsBetter: boolean;
  averageValue: string;
  getAverageNumeric: () => number;
}

/** Color-code a value relative to the portfolio average */
function getMetricColor(
  value: number,
  average: number,
  higherIsBetter: boolean
): string {
  if (average === 0) return "";
  const threshold = Math.abs(average) * 0.2;
  if (higherIsBetter) {
    if (value >= average + threshold) return "text-success";
    if (value <= average - threshold) return "text-destructive";
    return "";
  }
  // Lower is better (expenses)
  if (value <= average - threshold) return "text-success";
  if (value >= average + threshold) return "text-destructive";
  return "";
}

export function ScorecardComparison({
  properties,
  averageGrossYield,
  averageNetYield,
  averageScore,
}: ScorecardComparisonProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    properties.slice(0, 4).map((p) => p.propertyId)
  );

  const selectedProperties = useMemo(
    () => properties.filter((p) => selectedIds.includes(p.propertyId)),
    [properties, selectedIds]
  );

  const handleToggleProperty = (propertyId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(propertyId)) {
        return prev.filter((id) => id !== propertyId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, propertyId];
    });
  };

  const metrics: MetricRow[] = [
    {
      label: "Performance Score",
      getValue: (e) => `${e.performanceScore}`,
      getNumericValue: (e) => e.performanceScore,
      higherIsBetter: true,
      averageValue: `${averageScore}`,
      getAverageNumeric: () => averageScore,
    },
    {
      label: "Gross Yield",
      getValue: (e) => `${e.grossYield}%`,
      getNumericValue: (e) => e.grossYield,
      higherIsBetter: true,
      averageValue: `${averageGrossYield}%`,
      getAverageNumeric: () => averageGrossYield,
    },
    {
      label: "Net Yield",
      getValue: (e) => `${e.netYield}%`,
      getNumericValue: (e) => e.netYield,
      higherIsBetter: true,
      averageValue: `${averageNetYield}%`,
      getAverageNumeric: () => averageNetYield,
    },
    {
      label: "Annual Rent",
      getValue: (e) => formatCurrency(e.annualRent),
      getNumericValue: (e) => e.annualRent,
      higherIsBetter: true,
      averageValue: formatCurrency(
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualRent, 0) / selectedProperties.length
          : 0
      ),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualRent, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Annual Expenses",
      getValue: (e) => formatCurrency(e.annualExpenses),
      getNumericValue: (e) => e.annualExpenses,
      higherIsBetter: false,
      averageValue: formatCurrency(
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualExpenses, 0) / selectedProperties.length
          : 0
      ),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualExpenses, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Cash Flow",
      getValue: (e) => formatCurrency(e.annualCashFlow),
      getNumericValue: (e) => e.annualCashFlow,
      higherIsBetter: true,
      averageValue: formatCurrency(
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualCashFlow, 0) / selectedProperties.length
          : 0
      ),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualCashFlow, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Current Value",
      getValue: (e) => formatCurrency(e.currentValue),
      getNumericValue: (e) => e.currentValue,
      higherIsBetter: true,
      averageValue: formatCurrency(
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.currentValue, 0) / selectedProperties.length
          : 0
      ),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.currentValue, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Cap Rate",
      getValue: (e) => `${e.capRate}%`,
      getNumericValue: (e) => e.capRate,
      higherIsBetter: true,
      averageValue: (() => {
        const avg = selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.capRate, 0) / selectedProperties.length
          : 0;
        return `${avg.toFixed(1)}%`;
      })(),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.capRate, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Cash-on-Cash",
      getValue: (e) => e.cashOnCash !== null ? `${e.cashOnCash}%` : "N/A",
      getNumericValue: (e) => e.cashOnCash ?? 0,
      higherIsBetter: true,
      averageValue: (() => {
        const withCoc = selectedProperties.filter((p) => p.cashOnCash !== null);
        if (withCoc.length === 0) return "N/A";
        const avg = withCoc.reduce((s, p) => s + (p.cashOnCash ?? 0), 0) / withCoc.length;
        return `${avg.toFixed(1)}%`;
      })(),
      getAverageNumeric: () => {
        const withCoc = selectedProperties.filter((p) => p.cashOnCash !== null);
        if (withCoc.length === 0) return 0;
        return withCoc.reduce((s, p) => s + (p.cashOnCash ?? 0), 0) / withCoc.length;
      },
    },
    {
      label: "Capital Growth",
      getValue: (e) => `${e.capitalGrowthPercent > 0 ? "+" : ""}${e.capitalGrowthPercent}%`,
      getNumericValue: (e) => e.capitalGrowthPercent,
      higherIsBetter: true,
      averageValue: (() => {
        const avg = selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.capitalGrowthPercent, 0) / selectedProperties.length
          : 0;
        return `${avg > 0 ? "+" : ""}${avg.toFixed(1)}%`;
      })(),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.capitalGrowthPercent, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Equity",
      getValue: (e) => formatCurrency(e.equity),
      getNumericValue: (e) => e.equity,
      higherIsBetter: true,
      averageValue: formatCurrency(
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.equity, 0) / selectedProperties.length
          : 0
      ),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.equity, 0) / selectedProperties.length
          : 0,
    },
    {
      label: "Tax Deductions",
      getValue: (e) => formatCurrency(e.annualTaxDeductions),
      getNumericValue: (e) => e.annualTaxDeductions,
      higherIsBetter: true,
      averageValue: formatCurrency(
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualTaxDeductions, 0) / selectedProperties.length
          : 0
      ),
      getAverageNumeric: () =>
        selectedProperties.length > 0
          ? selectedProperties.reduce((s, p) => s + p.annualTaxDeductions, 0) / selectedProperties.length
          : 0,
    },
  ];

  function getBestValue(metric: MetricRow): number {
    if (selectedProperties.length === 0) return 0;
    const values = selectedProperties.map((p) => metric.getNumericValue(p));
    return metric.higherIsBetter ? Math.max(...values) : Math.min(...values);
  }

  if (properties.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Add at least 2 properties to compare performance.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <CardTitle>Side-by-Side Comparison</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Property selector */}
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => {
            const isSelected = selectedIds.includes(p.propertyId);
            return (
              <button
                key={p.propertyId}
                type="button"
                aria-label={p.address}
                onClick={() => handleToggleProperty(p.propertyId)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                  !isSelected && selectedIds.length >= 4 && "opacity-50 cursor-not-allowed"
                )}
                disabled={!isSelected && selectedIds.length >= 4}
              >
                {p.address.length > 25 ? `${p.address.slice(0, 25)}...` : p.address}
              </button>
            );
          })}
        </div>
        {selectedIds.length >= 4 && (
          <p className="text-xs text-muted-foreground">
            Maximum of 4 properties can be compared at once.
          </p>
        )}

        {/* Comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  Metric
                </th>
                {selectedProperties.map((p) => (
                  <th
                    key={p.propertyId}
                    className="text-right py-2 px-2 font-medium min-w-[120px]"
                  >
                    <div className="truncate max-w-[120px]" title={p.address}>
                      {p.address.length > 15
                        ? `${p.address.slice(0, 15)}...`
                        : p.address}
                    </div>
                  </th>
                ))}
                <th className="text-right py-2 pl-2 font-medium text-muted-foreground min-w-[100px]">
                  Avg
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const best = getBestValue(metric);
                return (
                  <tr key={metric.label} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {metric.label}
                    </td>
                    {selectedProperties.map((p) => {
                      const numVal = metric.getNumericValue(p);
                      const isBest =
                        selectedProperties.length > 1 && numVal === best;
                      return (
                        <td
                          key={p.propertyId}
                          className={cn(
                            "text-right py-2.5 px-2 tabular-nums",
                            isBest
                              ? "font-bold text-success"
                              : getMetricColor(numVal, metric.getAverageNumeric(), metric.higherIsBetter)
                          )}
                        >
                          <span className="flex items-center justify-end gap-1">
                            {metric.getValue(p)}
                            {isBest && (
                              <Trophy className="w-3 h-3 text-success" />
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-right py-2.5 pl-2 text-muted-foreground tabular-nums">
                      {metric.averageValue}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Score badges row */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {selectedProperties.map((p) => (
            <Badge
              key={p.propertyId}
              variant={p.isUnderperforming ? "destructive" : "secondary"}
              className="text-xs"
            >
              {p.address.length > 20 ? `${p.address.slice(0, 20)}...` : p.address}:{" "}
              {p.scoreLabel}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
