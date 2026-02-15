import type { Transaction } from "@/server/db/schema";

/**
 * Calculate equity (value - total loans)
 */
export function calculateEquity(value: number, totalLoans: number): number {
  return value - totalLoans;
}

/**
 * Calculate Loan-to-Value Ratio as percentage
 * Returns null if no value set (can't divide by zero)
 */
export function calculateLVR(totalLoans: number, value: number): number | null {
  if (value === 0) return null;
  return (totalLoans / value) * 100;
}

/**
 * Calculate cash flow from transactions (income - expenses)
 * Ignores transfer and personal transaction types
 */
export function calculateCashFlow(
  transactions: Pick<Transaction, "amount" | "transactionType">[]
): number {
  return transactions.reduce((sum, t) => {
    if (t.transactionType === "transfer" || t.transactionType === "personal") {
      return sum;
    }
    return sum + Number(t.amount);
  }, 0);
}

/**
 * Calculate gross yield (annual income / value * 100)
 * Returns null if no value set
 */
export function calculateGrossYield(
  annualIncome: number,
  value: number
): number | null {
  if (value === 0) return null;
  return (annualIncome / value) * 100;
}

/**
 * Calculate net yield ((income - expenses) / value * 100)
 * Returns null if no value set
 */
export function calculateNetYield(
  annualIncome: number,
  annualExpenses: number,
  value: number
): number | null {
  if (value === 0) return null;
  return ((annualIncome - annualExpenses) / value) * 100;
}

/**
 * Find best and worst performers from an array of objects
 */
export function findBestWorst<T extends { id: string; [key: string]: string | number | null | undefined | boolean }>(
  items: T[],
  key: keyof T
): { best: string | null; worst: string | null } {
  const validItems = items.filter(
    (item) => item[key] !== null && item[key] !== undefined
  );

  if (validItems.length === 0) {
    return { best: null, worst: null };
  }

  const sorted = [...validItems].sort(
    (a, b) => Number(b[key]) - Number(a[key])
  );

  return {
    best: sorted[0].id,
    worst: sorted[sorted.length - 1].id,
  };
}

/**
 * Get date range for period calculations
 */
export function getDateRangeForPeriod(
  period: "monthly" | "quarterly" | "annual"
): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "monthly":
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case "quarterly":
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case "annual":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  return { startDate, endDate };
}
