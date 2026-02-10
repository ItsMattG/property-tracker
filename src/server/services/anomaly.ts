import type { NewAnomalyAlert } from "../db/schema";

const UNUSUAL_AMOUNT_THRESHOLD = 0.3; // 30%
const UNEXPECTED_EXPENSE_MIN = 500;
const MIN_HISTORICAL_COUNT = 3;
const DUPLICATE_DATE_TOLERANCE_DAYS = 1;
const DUPLICATE_AMOUNT_TOLERANCE = 0.01;

type TransactionInput = {
  id?: string;
  amount: string;
  description: string;
  date?: string;
};

type HistoricalAverage = {
  avg: number;
  count: number;
};

type DetectionResult = Pick<
  NewAnomalyAlert,
  "alertType" | "severity" | "description" | "suggestedAction" | "metadata"
> | null;

export function detectUnusualAmount(
  transaction: TransactionInput,
  historical: HistoricalAverage
): DetectionResult {
  if (historical.count < MIN_HISTORICAL_COUNT) {
    return null;
  }

  const amount = Math.abs(parseFloat(transaction.amount));
  const deviation = Math.abs(amount - historical.avg) / historical.avg;

  if (deviation <= UNUSUAL_AMOUNT_THRESHOLD) {
    return null;
  }

  const percentDiff = Math.round(deviation * 100);
  const direction = amount > historical.avg ? "higher" : "lower";

  return {
    alertType: "unusual_amount",
    severity: "warning",
    description: `${transaction.description} of $${amount.toFixed(2)} is ${percentDiff}% ${direction} than usual ($${historical.avg.toFixed(2)} avg)`,
    suggestedAction: "Review transaction or mark as expected",
    metadata: JSON.stringify({
      amount,
      average: historical.avg,
      deviation: percentDiff,
      historicalCount: historical.count,
    }),
  };
}

export function detectDuplicates(
  transaction: TransactionInput,
  recentTransactions: TransactionInput[]
): DetectionResult {
  const txAmount = parseFloat(transaction.amount);
  const txDate = transaction.date ? new Date(transaction.date) : new Date();

  for (const recent of recentTransactions) {
    if (recent.id === transaction.id) continue;

    const recentAmount = parseFloat(recent.amount);
    const amountDiff = Math.abs(txAmount - recentAmount);

    if (amountDiff > DUPLICATE_AMOUNT_TOLERANCE) continue;

    const recentDate = recent.date ? new Date(recent.date) : new Date();
    const daysDiff = Math.abs(
      (txDate.getTime() - recentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > DUPLICATE_DATE_TOLERANCE_DAYS) continue;

    const similarity = calculateSimilarity(
      transaction.description,
      recent.description
    );

    if (similarity > 0.5) {
      return {
        alertType: "duplicate_transaction",
        severity: "warning",
        description: `Possible duplicate: Two $${Math.abs(txAmount).toFixed(2)} transactions from "${transaction.description}" on similar dates`,
        suggestedAction: "Review both transactions - dismiss if intentional",
        metadata: JSON.stringify({
          transactionId: transaction.id,
          duplicateId: recent.id,
          amount: txAmount,
          similarity,
        }),
      };
    }
  }

  return null;
}

export function detectUnexpectedExpense(
  transaction: TransactionInput,
  knownMerchants: Set<string>
): DetectionResult {
  const amount = parseFloat(transaction.amount);

  // Only check expenses (negative amounts)
  if (amount >= 0) {
    return null;
  }

  const absAmount = Math.abs(amount);
  if (absAmount < UNEXPECTED_EXPENSE_MIN) {
    return null;
  }

  // Check if merchant is known
  const merchant = extractMerchant(transaction.description);
  if (knownMerchants.has(merchant)) {
    return null;
  }

  return {
    alertType: "unexpected_expense",
    severity: "info",
    description: `New expense of $${absAmount.toFixed(2)} from "${transaction.description}"`,
    suggestedAction: "Categorise and verify this transaction",
    metadata: JSON.stringify({
      amount: absAmount,
      merchant,
    }),
  };
}

export function detectMissedRent(
  expectedTransaction: {
    id: string;
    expectedDate: string;
    expectedAmount: string;
    recurringTransaction: {
      description: string;
      property?: { address: string } | null;
    };
  },
  alertDelayDays: number
): DetectionResult {
  const expectedDate = new Date(expectedTransaction.expectedDate);
  const now = new Date();
  const daysPastDue = Math.floor(
    (now.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastDue < alertDelayDays) {
    return null;
  }

  const amount = parseFloat(expectedTransaction.expectedAmount);
  const propertyName =
    expectedTransaction.recurringTransaction.property?.address || "Unknown property";

  return {
    alertType: "missed_rent",
    severity: "critical",
    description: `${expectedTransaction.recurringTransaction.description} of $${amount.toFixed(2)} expected on ${expectedTransaction.expectedDate} from ${propertyName} has not been received`,
    suggestedAction: "Check with tenant or mark as skipped",
    metadata: JSON.stringify({
      expectedAmount: amount,
      expectedDate: expectedTransaction.expectedDate,
      daysPastDue,
    }),
  };
}

export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Simple Jaccard similarity on words
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));

  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union;
}

function extractMerchant(description: string): string {
  // Simple extraction: take first 3 words, remove numbers
  return description
    .split(/\s+/)
    .slice(0, 3)
    .join(" ")
    .replace(/[0-9]/g, "")
    .trim();
}

export async function getHistoricalAverage(
  db: any,
  userId: string,
  merchantPattern: string,
  months: number = 6
): Promise<HistoricalAverage> {
  const { transactions } = await import("../db/schema");
  const { eq, and, gte, like, sql } = await import("drizzle-orm");

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await db
    .select({
      avg: sql<number>`AVG(ABS(CAST(${transactions.amount} AS DECIMAL)))`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        like(transactions.description, `%${merchantPattern}%`),
        gte(transactions.date, startDate.toISOString().split("T")[0])
      )
    );

  return {
    avg: result[0]?.avg ?? 0,
    count: result[0]?.count ?? 0,
  };
}

export async function getKnownMerchants(
  db: any,
  userId: string,
  propertyId?: string
): Promise<Set<string>> {
  const { transactions } = await import("../db/schema");
  const { eq, and } = await import("drizzle-orm");

  const conditions = [eq(transactions.userId, userId)];
  if (propertyId) {
    conditions.push(eq(transactions.propertyId, propertyId));
  }

  const result = await db
    .selectDistinct({ description: transactions.description })
    .from(transactions)
    .where(and(...conditions));

  const merchants = new Set<string>();
  for (const row of result) {
    merchants.add(extractMerchant(row.description));
  }

  return merchants;
}
