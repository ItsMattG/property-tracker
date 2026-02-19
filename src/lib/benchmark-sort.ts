import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";

export type SortColumn = "score" | "grossYield" | "netYield" | "expenseRatio";
export type SortDirection = "asc" | "desc";

function getExpenseRatio(p: PropertyScorecardEntry): number {
  return p.annualRent > 0 ? (p.annualExpenses / p.annualRent) * 100 : 0;
}

function getValue(p: PropertyScorecardEntry, column: SortColumn): number {
  switch (column) {
    case "score":
      return p.performanceScore;
    case "grossYield":
      return p.grossYield;
    case "netYield":
      return p.netYield;
    case "expenseRatio":
      return getExpenseRatio(p);
  }
}

export function sortProperties(
  properties: PropertyScorecardEntry[],
  column: SortColumn,
  direction: SortDirection,
): PropertyScorecardEntry[] {
  return [...properties].sort((a, b) => {
    const aVal = getValue(a, column);
    const bVal = getValue(b, column);
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
}

export { getExpenseRatio };
