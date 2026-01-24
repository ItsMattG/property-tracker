"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

interface PropertyMetrics {
  propertyId: string;
  address: string;
  suburb: string;
  state: string;
  purchasePrice: number;
  currentValue: number;
  capitalGrowth: number;
  capitalGrowthPercent: number;
  totalLoans: number;
  equity: number;
  lvr: number | null;
  grossYield: number | null;
  netYield: number | null;
  cashFlow: number;
  annualIncome: number;
  annualExpenses: number;
  hasValue: boolean;
}

interface ComparisonTableProps {
  properties: PropertyMetrics[];
  onExport: () => void;
}

const metrics = [
  { key: "purchasePrice", label: "Purchase Price", format: "currency" },
  { key: "currentValue", label: "Current Value", format: "currency" },
  { key: "capitalGrowth", label: "Capital Growth ($)", format: "currency" },
  { key: "capitalGrowthPercent", label: "Capital Growth (%)", format: "percent" },
  { key: "totalLoans", label: "Loan Balance", format: "currency" },
  { key: "equity", label: "Equity", format: "currency" },
  { key: "lvr", label: "LVR", format: "percent" },
  { key: "grossYield", label: "Gross Yield", format: "percent" },
  { key: "netYield", label: "Net Yield", format: "percent" },
  { key: "cashFlow", label: "Cash Flow", format: "currency" },
  { key: "annualIncome", label: "Annual Income", format: "currency" },
  { key: "annualExpenses", label: "Annual Expenses", format: "currency" },
] as const;

function findBestWorst(
  properties: PropertyMetrics[],
  key: keyof PropertyMetrics
): { best: string | null; worst: string | null } {
  const validItems = properties.filter(
    (p) => p[key] !== null && p[key] !== undefined
  );

  if (validItems.length === 0) {
    return { best: null, worst: null };
  }

  const sorted = [...validItems].sort(
    (a, b) => (b[key] as number) - (a[key] as number)
  );

  return {
    best: sorted[0].propertyId,
    worst: sorted[sorted.length - 1].propertyId,
  };
}

export function ComparisonTable({ properties, onExport }: ComparisonTableProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "-";

  const formatValue = (value: any, format: string) => {
    if (value === null || value === undefined) return "-";
    if (format === "currency") return formatCurrency(value);
    if (format === "percent") return formatPercent(value);
    return String(value);
  };

  // Calculate best/worst for each metric
  const bestWorstByMetric = metrics.reduce(
    (acc, metric) => {
      acc[metric.key] = findBestWorst(properties, metric.key as keyof PropertyMetrics);
      return acc;
    },
    {} as Record<string, { best: string | null; worst: string | null }>
  );

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No properties to compare
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 bg-muted/50 p-3 text-left font-medium min-w-[150px]">
                Metric
              </th>
              {properties.map((property) => (
                <th key={property.propertyId} className="p-3 text-left font-medium min-w-[140px]">
                  <Link
                    href={`/properties/${property.propertyId}`}
                    className="hover:underline"
                  >
                    {property.suburb}
                  </Link>
                  <div className="text-xs font-normal text-muted-foreground">
                    {property.state}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.key} className="border-t">
                <td className="sticky left-0 bg-card p-3 font-medium">
                  {metric.label}
                </td>
                {properties.map((property) => {
                  const value = property[metric.key as keyof PropertyMetrics];
                  const { best, worst } = bestWorstByMetric[metric.key];
                  const isBest = best === property.propertyId && properties.length > 1;
                  const isWorst = worst === property.propertyId && best !== worst;

                  return (
                    <td
                      key={property.propertyId}
                      className={cn(
                        "p-3",
                        isBest && "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                        isWorst && "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      )}
                    >
                      {formatValue(value, metric.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground text-center md:hidden">
        Scroll horizontally to see all properties
      </p>
    </div>
  );
}
