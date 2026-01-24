import { db } from "@/server/db";
import {
  taxSuggestions,
  transactions,
  properties,
  loans,
  depreciationSchedules,
} from "@/server/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getFinancialYearRange } from "./reports";

const MARGINAL_TAX_RATE = 0.37; // Assume 37% marginal rate
const COMMON_DEDUCTIBLE_CATEGORIES = [
  "insurance",
  "council_rates",
  "water_charges",
  "property_agent_fees",
  "land_tax",
  "repairs_and_maintenance",
];

interface SuggestionInput {
  userId: string;
  propertyId?: string;
  financialYear: number;
}

/**
 * Get current financial year (July-June)
 */
export function getCurrentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * Check if we're in EOFY season (May-June)
 */
export function isEofySeason(): boolean {
  const month = new Date().getMonth();
  return month === 4 || month === 5; // May or June
}

/**
 * Days until end of financial year
 */
export function daysUntilEofy(): number {
  const now = new Date();
  const fy = getCurrentFinancialYear();
  const eofy = new Date(fy, 5, 30); // June 30
  const diff = eofy.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Generate prepay interest suggestion
 */
export async function generatePrepayInterestSuggestion(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;
  const daysLeft = daysUntilEofy();

  if (daysLeft > 60 || daysLeft === 0) return; // Only suggest within 60 days of EOFY

  // Get user's loans
  const userLoans = await db.query.loans.findMany({
    where: eq(loans.userId, userId),
  });

  if (userLoans.length === 0) return;

  // Calculate total monthly interest
  const totalMonthlyInterest = userLoans.reduce((sum, loan) => {
    const balance = parseFloat(loan.currentBalance);
    const rate = parseFloat(loan.interestRate) / 100;
    return sum + (balance * rate) / 12;
  }, 0);

  if (totalMonthlyInterest < 100) return; // Not worth suggesting for small amounts

  const estimatedSavings = totalMonthlyInterest * MARGINAL_TAX_RATE;

  // Check if suggestion already exists
  const existing = await db.query.taxSuggestions.findFirst({
    where: and(
      eq(taxSuggestions.userId, userId),
      eq(taxSuggestions.type, "prepay_interest"),
      eq(taxSuggestions.financialYear, financialYear.toString()),
      eq(taxSuggestions.status, "active")
    ),
  });

  if (existing) return;

  await db.insert(taxSuggestions).values({
    userId,
    type: "prepay_interest",
    title: "Prepay loan interest before EOFY",
    description: `Prepaying ${formatCurrency(totalMonthlyInterest)} of interest before June 30 could save you ${formatCurrency(estimatedSavings)} in tax this financial year.`,
    estimatedSavings: estimatedSavings.toFixed(2),
    actionUrl: "/loans",
    financialYear: financialYear.toString(),
    expiresAt: new Date(financialYear, 5, 30), // June 30
  });
}

/**
 * Generate schedule repairs suggestion
 */
export async function generateScheduleRepairsSuggestion(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;
  const daysLeft = daysUntilEofy();

  if (daysLeft > 60 || daysLeft === 0) return;

  const { startDate, endDate } = getFinancialYearRange(financialYear);

  // Check if user has had repairs this FY
  const repairs = await db
    .select({ total: sql<number>`SUM(ABS(${transactions.amount}::numeric))` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.category, "repairs_and_maintenance"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  const repairsThisFy = repairs[0]?.total || 0;

  // Get historical average
  const prevYear = getFinancialYearRange(financialYear - 1);
  const prevRepairs = await db
    .select({ total: sql<number>`SUM(ABS(${transactions.amount}::numeric))` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.category, "repairs_and_maintenance"),
        gte(transactions.date, prevYear.startDate),
        lte(transactions.date, prevYear.endDate)
      )
    );

  const prevYearRepairs = prevRepairs[0]?.total || 0;

  // Suggest if significantly less than previous year
  if (repairsThisFy < prevYearRepairs * 0.5 && prevYearRepairs > 500) {
    const potentialDeduction = prevYearRepairs - repairsThisFy;
    const estimatedSavings = potentialDeduction * MARGINAL_TAX_RATE;

    const existing = await db.query.taxSuggestions.findFirst({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.type, "schedule_repairs"),
        eq(taxSuggestions.financialYear, financialYear.toString()),
        eq(taxSuggestions.status, "active")
      ),
    });

    if (existing) return;

    await db.insert(taxSuggestions).values({
      userId,
      type: "schedule_repairs",
      title: "Schedule repairs before EOFY",
      description: `You've claimed ${formatCurrency(repairsThisFy)} in repairs this FY vs ${formatCurrency(prevYearRepairs)} last year. Scheduling ${formatCurrency(potentialDeduction)} in repairs before June 30 could save ${formatCurrency(estimatedSavings)}.`,
      estimatedSavings: estimatedSavings.toFixed(2),
      actionUrl: "/transactions",
      financialYear: financialYear.toString(),
      expiresAt: new Date(financialYear, 5, 30),
    });
  }
}

/**
 * Generate claim depreciation suggestion
 */
export async function generateClaimDepreciationSuggestion(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;

  // Get properties without depreciation schedules
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
  });

  for (const property of userProperties) {
    const schedule = await db.query.depreciationSchedules.findFirst({
      where: eq(depreciationSchedules.propertyId, property.id),
    });

    if (schedule) continue; // Already has a schedule

    // Check if suggestion already exists
    const existing = await db.query.taxSuggestions.findFirst({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.propertyId, property.id),
        eq(taxSuggestions.type, "claim_depreciation"),
        eq(taxSuggestions.status, "active")
      ),
    });

    if (existing) continue;

    // Estimate typical first-year depreciation (rough estimate based on property value)
    const propertyValue = parseFloat(property.purchasePrice);
    const estimatedDepreciation = Math.min(15000, propertyValue * 0.02); // ~2% or max $15k
    const estimatedSavings = estimatedDepreciation * MARGINAL_TAX_RATE;

    await db.insert(taxSuggestions).values({
      userId,
      propertyId: property.id,
      type: "claim_depreciation",
      title: `Upload depreciation schedule for ${property.address}`,
      description: `A quantity surveyor report could identify ${formatCurrency(estimatedDepreciation)}+ in annual deductions, saving you ${formatCurrency(estimatedSavings)}+ per year.`,
      estimatedSavings: estimatedSavings.toFixed(2),
      actionUrl: `/reports/tax?property=${property.id}`,
      financialYear: financialYear.toString(),
    });
  }
}

/**
 * Generate missed deduction suggestions
 */
export async function generateMissedDeductionSuggestions(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;
  const { startDate, endDate } = getFinancialYearRange(financialYear);

  // Get user's properties owned for at least 6 months
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const eligibleProperties = userProperties.filter(
    (p) => new Date(p.purchaseDate) < sixMonthsAgo
  );

  if (eligibleProperties.length === 0) return;

  // Get categories with transactions this FY
  const claimedCategories = await db
    .selectDistinct({ category: transactions.category })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        sql`${transactions.category} != 'uncategorized'`
      )
    );

  const claimed = new Set(claimedCategories.map((c) => c.category as string));

  // Find commonly missed categories
  for (const category of COMMON_DEDUCTIBLE_CATEGORIES) {
    if (claimed.has(category)) continue;

    const existing = await db.query.taxSuggestions.findFirst({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.type, "missed_deduction"),
        eq(taxSuggestions.financialYear, financialYear.toString()),
        eq(taxSuggestions.status, "active"),
        sql`${taxSuggestions.description} LIKE ${`%${category}%`}`
      ),
    });

    if (existing) continue;

    const categoryLabel = getCategoryLabel(category);

    await db.insert(taxSuggestions).values({
      userId,
      type: "missed_deduction",
      title: `Check for ${categoryLabel} expenses`,
      description: `You haven't claimed any ${categoryLabel.toLowerCase()} this financial year. Most property investors have these expenses - make sure you're not missing deductions.`,
      actionUrl: `/transactions?category=${category}`,
      financialYear: financialYear.toString(),
    });
  }
}

/**
 * Generate all suggestions for a user
 */
export async function generateAllSuggestions(userId: string): Promise<number> {
  const financialYear = getCurrentFinancialYear();
  const input = { userId, financialYear };

  await generatePrepayInterestSuggestion(input);
  await generateScheduleRepairsSuggestion(input);
  await generateClaimDepreciationSuggestion(input);
  await generateMissedDeductionSuggestions(input);

  // Return count of active suggestions
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taxSuggestions)
    .where(
      and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.status, "active")
      )
    );

  return count;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    insurance: "Insurance",
    council_rates: "Council Rates",
    water_charges: "Water Charges",
    property_agent_fees: "Property Agent Fees",
    land_tax: "Land Tax",
    repairs_and_maintenance: "Repairs & Maintenance",
  };
  return labels[category] || category;
}
