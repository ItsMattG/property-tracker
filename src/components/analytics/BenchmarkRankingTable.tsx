"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown, TableProperties } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatPercent } from "@/lib/utils";
import {
  sortProperties,
  getExpenseRatio,
  type SortColumn,
  type SortDirection,
} from "@/lib/benchmark-sort";
import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";

interface BenchmarkRankingTableProps {
  properties: PropertyScorecardEntry[];
  averageScore: number;
  averageGrossYield: number;
  averageNetYield: number;
}

type ScoreLabel = PropertyScorecardEntry["scoreLabel"];

const scoreBadgeVariant: Record<
  ScoreLabel,
  "default" | "secondary" | "warning" | "destructive"
> = {
  Excellent: "default",
  Good: "secondary",
  Average: "secondary",
  "Below Average": "warning",
  Poor: "destructive",
};

/**
 * Determine color class for a cell value relative to the portfolio average.
 * Green if above average (or below for expense ratio), red if below, neutral within ~5%.
 */
function getCellColor(
  value: number,
  average: number,
  higherIsBetter: boolean
): string {
  if (average === 0) return "";
  const threshold = Math.abs(average) * 0.05;
  if (higherIsBetter) {
    if (value > average + threshold) return "text-success";
    if (value < average - threshold) return "text-destructive";
    return "";
  }
  // Lower is better (expense ratio)
  if (value < average - threshold) return "text-success";
  if (value > average + threshold) return "text-destructive";
  return "";
}

function SortIcon({
  column,
  activeColumn,
  direction,
}: {
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
}) {
  if (column !== activeColumn) {
    return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />;
  }
  return direction === "asc" ? (
    <ArrowUp className="w-3.5 h-3.5" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5" />
  );
}

export function BenchmarkRankingTable({
  properties,
  averageScore,
  averageGrossYield,
  averageNetYield,
}: BenchmarkRankingTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const averageExpenseRatio = useMemo(() => {
    if (properties.length === 0) return 0;
    const total = properties.reduce((sum, p) => sum + getExpenseRatio(p), 0);
    return total / properties.length;
  }, [properties]);

  const sorted = useMemo(
    () => sortProperties(properties, sortColumn, sortDirection),
    [properties, sortColumn, sortDirection]
  );

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      // Default to descending for most columns, ascending for expense ratio
      setSortDirection(column === "expenseRatio" ? "asc" : "desc");
    }
  };

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <TableProperties className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No properties to rank.</p>
        </CardContent>
      </Card>
    );
  }

  const columns: { key: SortColumn; label: string }[] = [
    { key: "score", label: "Score" },
    { key: "grossYield", label: "Gross Yield" },
    { key: "netYield", label: "Net Yield" },
    { key: "expenseRatio", label: "Expense Ratio" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TableProperties className="w-5 h-5 text-primary" />
          <CardTitle>Property Rankings</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground w-10">
                  #
                </th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  Property
                </th>
                {columns.map((col) => (
                  <th key={col.key} className="text-right py-2 px-2">
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 font-medium transition-colors cursor-pointer",
                        sortColumn === col.key
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {col.label}
                      <SortIcon
                        column={col.key}
                        activeColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((property, index) => {
                const rank = index + 1;
                const expenseRatio = getExpenseRatio(property);

                return (
                  <tr
                    key={property.propertyId}
                    className="border-b last:border-0 group"
                  >
                    <td className="py-2.5 pr-2 text-muted-foreground tabular-nums">
                      {rank}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/properties/${property.propertyId}`}
                        prefetch={false}
                        className="group-hover:text-primary transition-colors"
                      >
                        <div className="font-medium truncate max-w-[200px]" title={property.address}>
                          {property.address}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {property.suburb}, {property.state}
                        </div>
                      </Link>
                    </td>
                    <td
                      className={cn(
                        "text-right py-2.5 px-2 tabular-nums",
                        getCellColor(property.performanceScore, averageScore, true)
                      )}
                    >
                      <span className="flex items-center justify-end gap-1.5">
                        {property.performanceScore}
                        <Badge
                          variant={scoreBadgeVariant[property.scoreLabel]}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {property.scoreLabel}
                        </Badge>
                      </span>
                    </td>
                    <td
                      className={cn(
                        "text-right py-2.5 px-2 tabular-nums",
                        getCellColor(property.grossYield, averageGrossYield, true)
                      )}
                    >
                      {formatPercent(property.grossYield)}
                    </td>
                    <td
                      className={cn(
                        "text-right py-2.5 px-2 tabular-nums",
                        getCellColor(property.netYield, averageNetYield, true)
                      )}
                    >
                      {formatPercent(property.netYield)}
                    </td>
                    <td
                      className={cn(
                        "text-right py-2.5 px-2 tabular-nums",
                        getCellColor(expenseRatio, averageExpenseRatio, false)
                      )}
                    >
                      {formatPercent(expenseRatio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
