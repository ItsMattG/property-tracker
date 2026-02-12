import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { transactions } from "@/server/db/schema";
import { categoryMap } from "@/lib/categories";
import { getFinancialYearRange, getPropertiesWithLoans } from "./reports";

// --- Constants ---

const KEY_EXPENSES = [
  "land_tax",
  "council_rates",
  "water_charges",
  "repairs_and_maintenance",
  "insurance",
  "body_corporate",
] as const;

const COMMONLY_MISSED = [
  "pest_control",
  "gardening",
  "stationery_and_postage",
] as const;

const INCOME_CATEGORIES = new Set(["rental_income", "other_rental_income"]);

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 20,
  warning: 10,
  info: 5,
};

// --- Types ---

export interface AuditCheckResult {
  checkType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  propertyId: string | null;
  affectedCount: number;
}

export interface AuditPropertyScore {
  propertyId: string;
  address: string;
  score: number;
  checks: AuditCheckResult[];
  passedCount: number;
  totalChecks: number;
}

export interface AuditReport {
  year: number;
  yearLabel: string;
  portfolioScore: number;
  properties: AuditPropertyScore[];
  portfolioChecks: AuditCheckResult[];
  summary: { info: number; warning: number; critical: number };
}

// --- Pure functions (exported for testing) ---

export function computeAuditScore(checks: AuditCheckResult[]): number {
  let score = 100;
  for (const check of checks) {
    score -= SEVERITY_WEIGHTS[check.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function checkMissingKeyExpenses(
  propertyId: string,
  address: string,
  currentTotals: Map<string, number>,
  priorTotals: Map<string, number>,
): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];

  for (const key of KEY_EXPENSES) {
    const priorAmount = priorTotals.get(key) ?? 0;
    const currentAmount = currentTotals.get(key) ?? 0;

    if (priorAmount > 0 && currentAmount === 0) {
      const label = categoryMap.get(key)?.label ?? key;
      results.push({
        checkType: "missing_key_expense",
        severity: "warning",
        title: `Missing ${label}`,
        message: `${address}: ${label} was claimed last year but has no entries this year.`,
        propertyId,
        affectedCount: 1,
      });
    }
  }

  return results;
}

export function checkUncategorizedTransactions(
  propertyId: string,
  address: string,
  txns: Array<{ category: string; propertyId: string | null }>,
): AuditCheckResult[] {
  const uncategorized = txns.filter(
    (t) => t.category === "uncategorized" && t.propertyId === propertyId,
  );

  if (uncategorized.length === 0) return [];

  return [{
    checkType: "uncategorized_transactions",
    severity: "warning",
    title: "Uncategorised Transactions",
    message: `${address}: ${uncategorized.length} transaction(s) still uncategorised.`,
    propertyId,
    affectedCount: uncategorized.length,
  }];
}

export function checkLoanInterestMissing(
  propertyId: string,
  address: string,
  hasLoan: boolean,
  categoryTotals: Map<string, number>,
): AuditCheckResult[] {
  if (!hasLoan) return [];

  const interest = categoryTotals.get("interest_on_loans") ?? 0;
  if (interest > 0) return [];

  return [{
    checkType: "loan_interest_missing",
    severity: "warning",
    title: "Loan Interest Not Recorded",
    message: `${address}: Property has a loan but no interest expense recorded this year.`,
    propertyId,
    affectedCount: 1,
  }];
}

export function checkMissedDeductions(
  claimedCategories: Set<string>,
): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];

  for (const cat of COMMONLY_MISSED) {
    if (!claimedCategories.has(cat)) {
      const label = categoryMap.get(cat)?.label ?? cat;
      results.push({
        checkType: "missed_deduction",
        severity: "info",
        title: `Consider ${label}`,
        message: `You haven't claimed ${label}. Many property investors claim this deduction.`,
        propertyId: null,
        affectedCount: 1,
      });
    }
  }

  return results;
}

export function checkUnassignedTransactions(
  txns: Array<{ propertyId: string | null; transactionType: string }>,
): AuditCheckResult[] {
  const unassigned = txns.filter(
    (t) => !t.propertyId && t.transactionType === "expense",
  );

  if (unassigned.length === 0) return [];

  return [{
    checkType: "unassigned_transactions",
    severity: "info",
    title: "Unassigned Expense Transactions",
    message: `${unassigned.length} expense transaction(s) not assigned to any property.`,
    propertyId: null,
    affectedCount: unassigned.length,
  }];
}

export function checkLargeUnverified(
  propertyId: string,
  address: string,
  txns: Array<{ propertyId: string | null; amount: string; isVerified: boolean }>,
): AuditCheckResult[] {
  const large = txns.filter(
    (t) =>
      t.propertyId === propertyId &&
      !t.isVerified &&
      Math.abs(Number(t.amount)) > 1000,
  );

  if (large.length === 0) return [];

  return [{
    checkType: "large_unverified",
    severity: "info",
    title: "Large Unverified Transactions",
    message: `${address}: ${large.length} transaction(s) over $1,000 not yet verified.`,
    propertyId,
    affectedCount: large.length,
  }];
}

export function checkNoRentalIncome(
  propertyId: string,
  address: string,
  incomeTotals: Map<string, number>,
): AuditCheckResult[] {
  let totalIncome = 0;
  for (const [cat, amount] of incomeTotals) {
    if (INCOME_CATEGORIES.has(cat)) {
      totalIncome += amount;
    }
  }

  if (totalIncome > 0) return [];

  return [{
    checkType: "no_rental_income",
    severity: "warning",
    title: "No Rental Income",
    message: `${address}: No rental income recorded this financial year.`,
    propertyId,
    affectedCount: 1,
  }];
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

function groupIncomeByProperty(
  txns: Array<{ propertyId: string | null; category: string; amount: string }>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const t of txns) {
    if (!t.propertyId) continue;
    const amount = Number(t.amount);

    let propMap = result.get(t.propertyId);
    if (!propMap) {
      propMap = new Map();
      result.set(t.propertyId, propMap);
    }

    propMap.set(t.category, (propMap.get(t.category) ?? 0) + amount);
  }

  return result;
}

// --- Main service function ---

export async function buildAuditReport(
  userId: string,
  year: number,
): Promise<AuditReport> {
  const currentRange = getFinancialYearRange(year);
  const priorRange = getFinancialYearRange(year - 1);

  const [userProperties, currentTxns, priorTxns] = await Promise.all([
    getPropertiesWithLoans(userId),
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
        gte(transactions.date, priorRange.startDate),
        lte(transactions.date, priorRange.endDate),
      ),
    }),
  ]);

  const txnArray = currentTxns as Array<{
    propertyId: string | null;
    category: string;
    amount: string;
    transactionType: string;
    isVerified: boolean;
    description: string;
  }>;
  const priorArray = priorTxns as Array<{
    propertyId: string | null;
    category: string;
    amount: string;
  }>;

  // Group by property
  const currentGrouped = groupByPropertyAndCategory(txnArray);
  const priorGrouped = groupByPropertyAndCategory(priorArray);
  const currentIncomeGrouped = groupIncomeByProperty(txnArray);

  // Portfolio-wide claimed categories
  const claimedCategories = new Set<string>();
  for (const propMap of currentGrouped.values()) {
    for (const cat of propMap.keys()) {
      claimedCategories.add(cat);
    }
  }

  // Portfolio-level checks
  const portfolioChecks: AuditCheckResult[] = [
    ...checkMissedDeductions(claimedCategories),
    ...checkUnassignedTransactions(txnArray),
  ];

  // Per-property checks
  const propertyScores: AuditPropertyScore[] = [];

  for (const prop of userProperties) {
    const propCurrentTotals = currentGrouped.get(prop.id) ?? new Map();
    const propPriorTotals = priorGrouped.get(prop.id) ?? new Map();
    const propIncomeTotals = currentIncomeGrouped.get(prop.id) ?? new Map();
    const hasLoan = (prop as { loans?: unknown[] }).loans?.length ? true : false;

    const checks: AuditCheckResult[] = [
      ...checkMissingKeyExpenses(prop.id, prop.address, propCurrentTotals, propPriorTotals),
      ...checkUncategorizedTransactions(prop.id, prop.address, txnArray),
      ...checkLoanInterestMissing(prop.id, prop.address, hasLoan, propCurrentTotals),
      ...checkLargeUnverified(prop.id, prop.address, txnArray),
      ...checkNoRentalIncome(prop.id, prop.address, propIncomeTotals),
    ];

    const totalChecks = 5; // 5 property-level check types
    const passedCount = totalChecks - checks.length;

    propertyScores.push({
      propertyId: prop.id,
      address: prop.address,
      score: computeAuditScore(checks),
      checks,
      passedCount: Math.max(0, passedCount),
      totalChecks,
    });
  }

  // Summary
  const allChecks = [...portfolioChecks, ...propertyScores.flatMap((p) => p.checks)];
  const summary = { info: 0, warning: 0, critical: 0 };
  for (const check of allChecks) {
    summary[check.severity]++;
  }

  // Portfolio score = average of property scores (or 100 if no properties)
  const portfolioScore =
    propertyScores.length > 0
      ? Math.round(
          propertyScores.reduce((sum, p) => sum + p.score, 0) / propertyScores.length,
        )
      : 100;

  return {
    year,
    yearLabel: currentRange.label,
    portfolioScore,
    properties: propertyScores,
    portfolioChecks,
    summary,
  };
}
