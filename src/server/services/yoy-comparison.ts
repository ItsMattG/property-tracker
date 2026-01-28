import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { transactions, properties } from "@/server/db/schema";
import { categoryMap, categories } from "@/lib/categories";
import { getFinancialYearRange } from "./reports";

// --- Constants ---

export const KEY_EXPENSES = [
  "land_tax",
  "council_rates",
  "water_charges",
  "repairs_and_maintenance",
  "insurance",
  "body_corporate",
] as const;

const KEY_EXPENSE_SET = new Set<string>(KEY_EXPENSES);

// Key expenses sort by their ATO reference order (D2, D5, D7, D9, D13, D17)
const KEY_EXPENSE_ORDER = new Map<string, string>(
  KEY_EXPENSES.map((k) => [k, categoryMap.get(k)?.atoReference ?? ""])
);

// --- Types ---

export interface YoYCategoryComparison {
  category: string;
  label: string;
  atoCode: string;
  isKeyExpense: boolean;
  currentYear: number;
  comparisonYear: number;
  change: number;
  changePercent: number | null;
  isSignificant: boolean;
}

export interface YoYPropertyBreakdown {
  propertyId: string;
  address: string;
  categories: YoYCategoryComparison[];
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

export interface YoYComparisonResult {
  currentYear: number;
  comparisonYear: number;
  currentYearLabel: string;
  comparisonYearLabel: string;
  portfolio: YoYCategoryComparison[];
  properties: YoYPropertyBreakdown[];
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

// --- Pure functions (exported for testing) ---

export function computeChange(
  currentYear: number,
  comparisonYear: number,
): { change: number; changePercent: number | null; isSignificant: boolean } {
  const change = currentYear - comparisonYear;
  if (comparisonYear === 0) {
    return { change, changePercent: null, isSignificant: false };
  }
  const changePercent = Math.round((change / comparisonYear) * 100);
  return {
    change,
    changePercent,
    isSignificant: Math.abs(changePercent) > 10,
  };
}

export function buildCategoryComparison(
  currentTotals: Map<string, number>,
  comparisonTotals: Map<string, number>,
): YoYCategoryComparison[] {
  const allCategories = new Set([
    ...currentTotals.keys(),
    ...comparisonTotals.keys(),
  ]);

  const result: YoYCategoryComparison[] = [];

  for (const cat of allCategories) {
    const currentYear = currentTotals.get(cat) ?? 0;
    const comparisonYear = comparisonTotals.get(cat) ?? 0;

    // Exclude categories with zero in both years
    if (currentYear === 0 && comparisonYear === 0) continue;

    const info = categoryMap.get(cat);
    const { change, changePercent, isSignificant } = computeChange(
      currentYear,
      comparisonYear,
    );

    result.push({
      category: cat,
      label: info?.label ?? cat,
      atoCode: info?.atoReference ?? "",
      isKeyExpense: KEY_EXPENSE_SET.has(cat),
      currentYear,
      comparisonYear,
      change,
      changePercent,
      isSignificant,
    });
  }

  return result;
}

export function sortCategories<T extends { category: string; isKeyExpense: boolean }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    // Key expenses first
    if (a.isKeyExpense && !b.isKeyExpense) return -1;
    if (!a.isKeyExpense && b.isKeyExpense) return 1;

    // Within key expenses, sort by ATO reference
    if (a.isKeyExpense && b.isKeyExpense) {
      const aRef = KEY_EXPENSE_ORDER.get(a.category) ?? "";
      const bRef = KEY_EXPENSE_ORDER.get(b.category) ?? "";
      return aRef.localeCompare(bRef);
    }

    // Other categories: alphabetical by label
    const aLabel = categoryMap.get(a.category)?.label ?? a.category;
    const bLabel = categoryMap.get(b.category)?.label ?? b.category;
    return aLabel.localeCompare(bLabel);
  });
}

// --- Helpers ---

function groupByPropertyAndCategory(
  txns: Array<{ propertyId: string | null; category: string; amount: string }>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const t of txns) {
    if (!t.propertyId) continue;
    const amount = Math.abs(Number(t.amount));

    let propMap = result.get(t.propertyId);
    if (!propMap) {
      propMap = new Map();
      result.set(t.propertyId, propMap);
    }

    propMap.set(t.category, (propMap.get(t.category) ?? 0) + amount);
  }

  return result;
}

function aggregatePortfolio(
  propertyGroups: Map<string, Map<string, number>>,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const propMap of propertyGroups.values()) {
    for (const [cat, amount] of propMap) {
      totals.set(cat, (totals.get(cat) ?? 0) + amount);
    }
  }

  return totals;
}

// --- Main service function ---

export async function buildYoYComparison(
  userId: string,
  currentYear: number,
  comparisonYear: number,
): Promise<YoYComparisonResult> {
  const currentRange = getFinancialYearRange(currentYear);
  const comparisonRange = getFinancialYearRange(comparisonYear);

  // Only include deductible expense categories
  const deductibleCategories = new Set(
    categories.filter((c) => c.isDeductible).map((c) => c.value),
  );

  // Fetch data in parallel
  const [userProperties, currentTxns, comparisonTxns] = await Promise.all([
    db.query.properties.findMany({
      where: eq(properties.userId, userId),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, currentRange.startDate),
        lte(transactions.date, currentRange.endDate),
      ),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, comparisonRange.startDate),
        lte(transactions.date, comparisonRange.endDate),
      ),
    }),
  ]);

  // Filter to deductible expenses only
  const filterDeductible = (
    txns: Array<{ propertyId: string | null; category: string; amount: string }>,
  ) => txns.filter((t) => deductibleCategories.has(t.category));

  const currentGrouped = groupByPropertyAndCategory(
    filterDeductible(
      currentTxns as Array<{ propertyId: string | null; category: string; amount: string }>,
    ),
  );
  const comparisonGrouped = groupByPropertyAndCategory(
    filterDeductible(
      comparisonTxns as Array<{ propertyId: string | null; category: string; amount: string }>,
    ),
  );

  // Portfolio-level comparison
  const currentPortfolio = aggregatePortfolio(currentGrouped);
  const comparisonPortfolio = aggregatePortfolio(comparisonGrouped);
  const portfolioComparison = sortCategories(
    buildCategoryComparison(currentPortfolio, comparisonPortfolio),
  );

  const totalCurrent = portfolioComparison.reduce((s, c) => s + c.currentYear, 0);
  const totalComparison = portfolioComparison.reduce((s, c) => s + c.comparisonYear, 0);
  const totals = computeChange(totalCurrent, totalComparison);

  // Per-property breakdowns
  const allPropertyIds = new Set([
    ...currentGrouped.keys(),
    ...comparisonGrouped.keys(),
  ]);

  const propertyBreakdowns: YoYPropertyBreakdown[] = [];
  for (const propId of allPropertyIds) {
    const prop = userProperties.find((p) => p.id === propId);
    if (!prop) continue;

    const propCurrent = currentGrouped.get(propId) ?? new Map();
    const propComparison = comparisonGrouped.get(propId) ?? new Map();
    const catComparisons = sortCategories(
      buildCategoryComparison(propCurrent, propComparison),
    );

    const propTotalCurrent = catComparisons.reduce((s, c) => s + c.currentYear, 0);
    const propTotalComparison = catComparisons.reduce((s, c) => s + c.comparisonYear, 0);
    const propTotals = computeChange(propTotalCurrent, propTotalComparison);

    propertyBreakdowns.push({
      propertyId: propId,
      address: prop.address,
      categories: catComparisons,
      totalCurrent: propTotalCurrent,
      totalComparison: propTotalComparison,
      totalChange: propTotals.change,
      totalChangePercent: propTotals.changePercent,
    });
  }

  return {
    currentYear,
    comparisonYear,
    currentYearLabel: currentRange.label,
    comparisonYearLabel: comparisonRange.label,
    portfolio: portfolioComparison,
    properties: propertyBreakdowns,
    totalCurrent,
    totalComparison,
    totalChange: totals.change,
    totalChangePercent: totals.changePercent,
  };
}
