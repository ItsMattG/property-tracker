import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { transactions, properties, taxProfiles } from "@/server/db/schema";
import { categories } from "@/lib/categories";
import { getFinancialYearRange } from "./reports";
import { calculateTaxPosition, type TaxPositionResult } from "./tax-position";

// --- Types ---

/** Monthly totals keyed by month number (1=Jan, 12=Dec) */
export type MonthlyTotals = Record<number, number>;

export type Confidence = "high" | "medium" | "low";

export interface CategoryForecast {
  category: string;
  label: string;
  atoCode: string;
  actual: number;
  forecast: number;
  confidence: Confidence;
}

export interface PropertyForecast {
  propertyId: string;
  address: string;
  categories: CategoryForecast[];
  totalIncome: { actual: number; forecast: number };
  totalDeductions: { actual: number; forecast: number };
  netResult: { actual: number; forecast: number };
}

export interface TaxForecastResult {
  financialYear: number;
  monthsElapsed: number;
  properties: PropertyForecast[];
  totalIncome: { actual: number; forecast: number };
  totalDeductions: { actual: number; forecast: number };
  netRentalResult: { actual: number; forecast: number };
  taxPosition: {
    actual: TaxPositionResult | null;
    forecast: TaxPositionResult | null;
  };
  confidence: Confidence;
}

// --- Pure functions (exported for testing) ---

export function computeCategoryForecast(
  currentMonths: MonthlyTotals,
  priorMonths: MonthlyTotals,
  monthsElapsed: number,
): { actual: number; forecast: number } {
  const actual = Object.values(currentMonths).reduce((sum, v) => sum + v, 0);

  if (monthsElapsed === 0 && Object.keys(currentMonths).length === 0) {
    return { actual: 0, forecast: 0 };
  }

  // Determine which months are remaining in the FY
  // AU FY runs Jul(7)-Jun(6). Elapsed months start from July.
  const remainingMonthNumbers: number[] = [];
  for (let i = 0; i < 12; i++) {
    // FY month order: 7,8,9,10,11,12,1,2,3,4,5,6
    const month = ((i + 6) % 12) + 1;
    if (i >= monthsElapsed) {
      remainingMonthNumbers.push(month);
    }
  }

  if (remainingMonthNumbers.length === 0) {
    // Full year of actuals
    return { actual, forecast: actual };
  }

  const hasPriorData = Object.keys(priorMonths).length > 0;

  if (hasPriorData) {
    // Hybrid: actuals + prior year fill-in for remaining months
    const fillIn = remainingMonthNumbers.reduce(
      (sum, m) => sum + (priorMonths[m] ?? 0),
      0
    );
    return { actual, forecast: actual + fillIn };
  }

  // No prior year: annualize
  if (monthsElapsed === 0) {
    return { actual: 0, forecast: 0 };
  }
  return { actual, forecast: Math.round((actual / monthsElapsed) * 12) };
}

export function computeConfidence(
  monthsElapsed: number,
  hasPriorYear: boolean,
): Confidence {
  if (monthsElapsed >= 9) return "high";
  if (hasPriorYear) return "high";
  if (monthsElapsed >= 4) return "medium";
  return "low";
}

// --- Helpers ---

function getMonthsElapsed(financialYear: number): number {
  const now = new Date();
  const fyStart = new Date(`${financialYear - 1}-07-01`);
  const fyEnd = new Date(`${financialYear}-06-30`);

  if (now < fyStart) return 0;
  if (now > fyEnd) return 12;

  const diffMs = now.getTime() - fyStart.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  return Math.min(12, Math.max(0, Math.floor(diffMonths)));
}

function groupTransactionsByMonth(
  txns: Array<{ date: string; amount: string; category: string; transactionType: string; propertyId: string | null }>,
  propertyId: string,
  category: string,
): MonthlyTotals {
  const totals: MonthlyTotals = {};
  for (const t of txns) {
    if (t.propertyId !== propertyId || t.category !== category) continue;
    const month = new Date(t.date).getMonth() + 1; // 1-indexed
    const amount = Math.abs(Number(t.amount));
    totals[month] = (totals[month] ?? 0) + amount;
  }
  return totals;
}

// --- Main service function ---

export async function buildTaxForecast(
  userId: string,
  financialYear: number,
): Promise<TaxForecastResult> {
  const monthsElapsed = getMonthsElapsed(financialYear);
  const priorYear = financialYear - 1;

  const { startDate, endDate } = getFinancialYearRange(financialYear);
  const { startDate: priorStart, endDate: priorEnd } = getFinancialYearRange(priorYear);

  // Fetch all data in parallel
  const [userProperties, currentTxns, priorTxns, taxProfile] = await Promise.all([
    db.query.properties.findMany({
      where: eq(properties.userId, userId),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, priorStart),
        lte(transactions.date, priorEnd),
      ),
    }),
    db.query.taxProfiles.findFirst({
      where: and(
        eq(taxProfiles.userId, userId),
        eq(taxProfiles.financialYear, financialYear),
      ),
    }),
  ]);

  const hasPriorYear = priorTxns.length > 0;
  const incomeCategories = categories.filter((c) => c.type === "income");
  const deductibleCategories = categories.filter((c) => c.isDeductible);
  const allRelevantCategories = [...incomeCategories, ...deductibleCategories];

  // Build per-property forecasts
  const propertyForecasts: PropertyForecast[] = userProperties.map((prop) => {
    const catForecasts: CategoryForecast[] = [];

    for (const cat of allRelevantCategories) {
      const currentMonths = groupTransactionsByMonth(
        currentTxns as any, prop.id, cat.value
      );
      const priorMonths = groupTransactionsByMonth(
        priorTxns as any, prop.id, cat.value
      );

      const { actual, forecast } = computeCategoryForecast(
        currentMonths, priorMonths, monthsElapsed
      );

      // Only include categories with data
      if (actual === 0 && forecast === 0) continue;

      catForecasts.push({
        category: cat.value,
        label: cat.label,
        atoCode: cat.atoReference ?? "",
        actual,
        forecast,
        confidence: computeConfidence(monthsElapsed, Object.keys(priorMonths).length > 0),
      });
    }

    const incomeActual = catForecasts
      .filter((c) => incomeCategories.some((ic) => ic.value === c.category))
      .reduce((s, c) => s + c.actual, 0);
    const incomeForecast = catForecasts
      .filter((c) => incomeCategories.some((ic) => ic.value === c.category))
      .reduce((s, c) => s + c.forecast, 0);
    const deductActual = catForecasts
      .filter((c) => deductibleCategories.some((dc) => dc.value === c.category))
      .reduce((s, c) => s + c.actual, 0);
    const deductForecast = catForecasts
      .filter((c) => deductibleCategories.some((dc) => dc.value === c.category))
      .reduce((s, c) => s + c.forecast, 0);

    return {
      propertyId: prop.id,
      address: prop.address,
      categories: catForecasts,
      totalIncome: { actual: incomeActual, forecast: incomeForecast },
      totalDeductions: { actual: deductActual, forecast: deductForecast },
      netResult: {
        actual: incomeActual - deductActual,
        forecast: incomeForecast - deductForecast,
      },
    };
  });

  // Portfolio totals
  const totalIncome = {
    actual: propertyForecasts.reduce((s, p) => s + p.totalIncome.actual, 0),
    forecast: propertyForecasts.reduce((s, p) => s + p.totalIncome.forecast, 0),
  };
  const totalDeductions = {
    actual: propertyForecasts.reduce((s, p) => s + p.totalDeductions.actual, 0),
    forecast: propertyForecasts.reduce((s, p) => s + p.totalDeductions.forecast, 0),
  };
  const netRentalResult = {
    actual: totalIncome.actual - totalDeductions.actual,
    forecast: totalIncome.forecast - totalDeductions.forecast,
  };

  // Calculate tax positions (actual and forecast) if profile exists
  let actualTaxPosition: TaxPositionResult | null = null;
  let forecastTaxPosition: TaxPositionResult | null = null;

  if (taxProfile?.isComplete) {
    const baseInput = {
      financialYear,
      grossSalary: Number(taxProfile.grossSalary ?? 0),
      paygWithheld: Number(taxProfile.paygWithheld ?? 0),
      otherDeductions: Number(taxProfile.otherDeductions ?? 0),
      hasHecsDebt: taxProfile.hasHecsDebt,
      hasPrivateHealth: taxProfile.hasPrivateHealth,
      familyStatus: taxProfile.familyStatus as "single" | "couple" | "family",
      dependentChildren: taxProfile.dependentChildren,
      partnerIncome: Number(taxProfile.partnerIncome ?? 0),
    };

    try {
      actualTaxPosition = calculateTaxPosition({
        ...baseInput,
        rentalNetResult: netRentalResult.actual,
      });
      forecastTaxPosition = calculateTaxPosition({
        ...baseInput,
        rentalNetResult: netRentalResult.forecast,
      });
    } catch {
      // Tax tables may not be available
    }
  }

  return {
    financialYear,
    monthsElapsed,
    properties: propertyForecasts,
    totalIncome,
    totalDeductions,
    netRentalResult,
    taxPosition: {
      actual: actualTaxPosition,
      forecast: forecastTaxPosition,
    },
    confidence: computeConfidence(monthsElapsed, hasPriorYear),
  };
}
