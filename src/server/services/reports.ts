import { db } from "@/server/db";
import { transactions, properties } from "@/server/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface TransactionInput {
  category: string;
  amount: string;
  transactionType: string;
}

export interface FinancialYearRange {
  startDate: string;
  endDate: string;
  label: string;
}

export interface PropertyMetrics {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  totalDeductible: number;
}

export interface CategoryTotal {
  category: string;
  label: string;
  amount: number;
  isDeductible: boolean;
  atoReference?: string;
}

/**
 * Get Australian financial year date range (July 1 - June 30)
 * @param year The ending year of the financial year (e.g., 2026 for FY 2025-26)
 */
export function getFinancialYearRange(year: number): FinancialYearRange {
  return {
    startDate: `${year - 1}-07-01`,
    endDate: `${year}-06-30`,
    label: `FY ${year - 1}-${String(year).slice(-2)}`,
  };
}

/**
 * Calculate totals by category from transactions
 */
export function calculateCategoryTotals(
  txns: TransactionInput[]
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const t of txns) {
    const current = totals.get(t.category) || 0;
    totals.set(t.category, current + Number(t.amount));
  }

  return totals;
}

/**
 * Calculate property-level financial metrics
 */
export function calculatePropertyMetrics(
  txns: TransactionInput[]
): PropertyMetrics {
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalDeductible = 0;

  for (const t of txns) {
    const amount = Number(t.amount);
    if (t.transactionType === "income") {
      totalIncome += amount;
    } else if (t.transactionType === "expense") {
      totalExpenses += Math.abs(amount);
      totalDeductible += Math.abs(amount);
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    totalDeductible,
  };
}

/**
 * Get transactions for a financial year grouped by property
 */
export async function getFinancialYearTransactions(
  userId: string,
  year: number,
  propertyId?: string
) {
  const { startDate, endDate } = getFinancialYearRange(year);

  const conditions = [
    eq(transactions.userId, userId),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
  ];

  if (propertyId) {
    conditions.push(eq(transactions.propertyId, propertyId));
  }

  return db.query.transactions.findMany({
    where: and(...conditions),
    orderBy: [desc(transactions.date)],
    with: {
      property: true,
    },
  });
}

/**
 * Get all properties for a user with their loans
 */
export async function getPropertiesWithLoans(userId: string) {
  return db.query.properties.findMany({
    where: eq(properties.userId, userId),
    with: {
      loans: true,
    },
  });
}
