import type { RecurringTransaction, Transaction, ExpectedTransaction } from "@/server/db/schema";
import { formatDateISO } from "@/lib/utils";

export type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";
export type ExpectedStatus = "pending" | "matched" | "missed" | "skipped";

export interface GeneratedExpectedTransaction {
  recurringTransactionId: string;
  userId: string;
  propertyId: string;
  expectedDate: string;
  expectedAmount: string;
}

export interface MatchResult {
  expectedTransactionId: string;
  matchedTransactionId: string;
  confidence: "high" | "medium" | "low";
}

export interface MatchCandidate {
  transaction: Transaction;
  amountDiff: number;
  dateDiff: number;
  confidence: "high" | "medium" | "low";
}

/**
 * Calculate the next occurrence dates for a recurring transaction
 */
export function calculateNextDates(
  template: Pick<RecurringTransaction, "frequency" | "dayOfMonth" | "dayOfWeek" | "startDate" | "endDate">,
  fromDate: Date,
  daysAhead: number
): Date[] {
  const dates: Date[] = [];
  const endDate = new Date(fromDate);
  endDate.setDate(endDate.getDate() + daysAhead);

  const templateEndDate = template.endDate ? new Date(template.endDate) : null;
  const startDate = new Date(template.startDate);

  // Start from the template start date if it's after fromDate
  let current = fromDate > startDate ? new Date(fromDate) : new Date(startDate);

  // Align to the next occurrence based on frequency
  current = alignToNextOccurrence(current, template);

  while (current <= endDate) {
    // Respect template end date
    if (templateEndDate && current > templateEndDate) {
      break;
    }

    // Only include dates on or after start date
    if (current >= startDate) {
      dates.push(new Date(current));
    }

    // Move to next occurrence
    const targetDay = template.dayOfMonth ? Number(template.dayOfMonth) : undefined;
    current = getNextOccurrence(current, template.frequency as Frequency, targetDay);
  }

  return dates;
}

/**
 * Align a date to the next occurrence based on frequency settings
 */
function alignToNextOccurrence(
  date: Date,
  template: Pick<RecurringTransaction, "frequency" | "dayOfMonth" | "dayOfWeek">
): Date {
  const result = new Date(date);
  const frequency = template.frequency as Frequency;

  if (frequency === "weekly" || frequency === "fortnightly") {
    const targetDayOfWeek = Number(template.dayOfWeek ?? 0);
    const currentDayOfWeek = result.getDay();
    let daysToAdd = targetDayOfWeek - currentDayOfWeek;
    if (daysToAdd < 0) daysToAdd += 7;
    result.setDate(result.getDate() + daysToAdd);
  } else {
    // monthly, quarterly, annually
    const targetDayOfMonth = Number(template.dayOfMonth ?? 1);
    const currentDayOfMonth = result.getDate();

    if (currentDayOfMonth > targetDayOfMonth) {
      // Move to next period
      result.setMonth(result.getMonth() + 1);
    }

    // Set the day, handling month-end edge cases
    setDayOfMonth(result, targetDayOfMonth);
  }

  return result;
}

/**
 * Get the next occurrence date based on frequency
 */
function getNextOccurrence(current: Date, frequency: Frequency, targetDayOfMonth?: number): Date {
  const next = new Date(current);

  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "fortnightly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly": {
      // Remember the target day before incrementing month
      const day = targetDayOfMonth ?? current.getDate();
      next.setDate(1); // Avoid month overflow
      next.setMonth(next.getMonth() + 1);
      setDayOfMonth(next, day);
      break;
    }
    case "quarterly": {
      const day = targetDayOfMonth ?? current.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 3);
      setDayOfMonth(next, day);
      break;
    }
    case "annually": {
      const day = targetDayOfMonth ?? current.getDate();
      next.setDate(1);
      next.setFullYear(next.getFullYear() + 1);
      setDayOfMonth(next, day);
      break;
    }
  }

  return next;
}

/**
 * Set day of month, handling edge cases like Feb 30 -> Feb 28
 */
function setDayOfMonth(date: Date, targetDay: number): void {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  date.setDate(Math.min(targetDay, daysInMonth));
}

/**
 * Generate expected transactions from a recurring template
 */
export function generateExpectedTransactions(
  template: RecurringTransaction,
  fromDate: Date,
  daysAhead: number = 14,
  existingDates: string[] = []
): GeneratedExpectedTransaction[] {
  const dates = calculateNextDates(template, fromDate, daysAhead);

  // Filter out dates that already have expected transactions
  const existingSet = new Set(existingDates);

  return dates
    .filter((d) => !existingSet.has(formatDateISO(d)))
    .map((date) => ({
      recurringTransactionId: template.id,
      userId: template.userId,
      propertyId: template.propertyId,
      expectedDate: formatDateISO(date),
      expectedAmount: template.amount,
    }));
}

/**
 * Find matching transactions for an expected transaction
 */
export function findMatchingTransactions(
  expected: Pick<ExpectedTransaction, "expectedDate" | "expectedAmount" | "propertyId">,
  candidates: Transaction[],
  amountTolerance: number,
  dateTolerance: number
): MatchCandidate[] {
  const expectedAmount = Number(expected.expectedAmount);
  const expectedDate = new Date(expected.expectedDate);

  const matches: MatchCandidate[] = [];

  for (const tx of candidates) {
    // Skip if different property
    if (tx.propertyId !== expected.propertyId) {
      continue;
    }

    const txAmount = Math.abs(Number(tx.amount));
    const amountDiff = Math.abs((txAmount - expectedAmount) / expectedAmount) * 100;

    const txDate = new Date(tx.date);
    const dateDiff = Math.abs(
      Math.round((txDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Check if within tolerance
    if (amountDiff <= amountTolerance && dateDiff <= dateTolerance) {
      const confidence = calculateConfidence(amountDiff, dateDiff);
      matches.push({
        transaction: tx,
        amountDiff,
        dateDiff,
        confidence,
      });
    }
  }

  // Sort by confidence (high first), then by date difference
  return matches.sort((a, b) => {
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return a.dateDiff - b.dateDiff;
  });
}

/**
 * Calculate match confidence based on amount and date difference
 */
function calculateConfidence(amountDiff: number, dateDiff: number): "high" | "medium" | "low" {
  // High: Amount within 1%, date within 2 days
  if (amountDiff <= 1 && dateDiff <= 2) {
    return "high";
  }
  // Medium: Amount within 5%, date within 5 days
  if (amountDiff <= 5 && dateDiff <= 5) {
    return "medium";
  }
  // Low: Everything else within tolerance
  return "low";
}

/**
 * Determine which expected transactions should be marked as missed
 */
export function findMissedTransactions(
  expectedTransactions: ExpectedTransaction[],
  today: Date
): string[] {
  const missedIds: string[] = [];

  for (const expected of expectedTransactions) {
    if (expected.status !== "pending") {
      continue;
    }

    // This should come from the recurring transaction, but we'll use 3 as default
    const alertDelayDays = 3;
    const expectedDate = new Date(expected.expectedDate);
    const missedDate = new Date(expectedDate);
    missedDate.setDate(missedDate.getDate() + alertDelayDays);

    if (today > missedDate) {
      missedIds.push(expected.id);
    }
  }

  return missedIds;
}

/**
 * Detect potential recurring patterns in a set of transactions
 */
export interface PatternSuggestion {
  description: string;
  category: string;
  propertyId: string;
  averageAmount: number;
  frequency: Frequency;
  transactionIds: string[];
  confidence: number;
}

export function detectPatterns(transactions: Transaction[]): PatternSuggestion[] {
  // Group by category + property + amount bucket (±10%)
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!tx.propertyId) continue;

    const amount = Math.abs(Number(tx.amount));
    const bucket = Math.round(amount / 100) * 100; // Round to nearest 100
    const key = `${tx.category}:${tx.propertyId}:${bucket}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const suggestions: PatternSuggestion[] = [];

  for (const txs of groups.values()) {
    // Need at least 3 transactions
    if (txs.length < 3) continue;

    // Sort by date
    const sorted = txs.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const days = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(days);
    }

    // Check for consistent frequency
    const detected = detectFrequency(intervals);
    if (!detected) continue;

    const averageAmount =
      sorted.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) / sorted.length;

    suggestions.push({
      description: sorted[0].description,
      category: sorted[0].category,
      propertyId: sorted[0].propertyId!,
      averageAmount,
      frequency: detected.frequency,
      transactionIds: sorted.map((t) => t.id),
      confidence: detected.confidence,
    });
  }

  // Filter to high-confidence suggestions and sort by confidence
  return suggestions
    .filter((s) => s.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence);
}

interface FrequencyDetection {
  frequency: Frequency;
  confidence: number;
}

const FREQUENCY_RANGES: Array<{ frequency: Frequency; min: number; max: number }> = [
  { frequency: "weekly", min: 5, max: 9 },
  { frequency: "fortnightly", min: 12, max: 16 },
  { frequency: "monthly", min: 26, max: 34 },
  { frequency: "quarterly", min: 85, max: 97 },
  { frequency: "annually", min: 358, max: 372 },
];

function detectFrequency(intervals: number[]): FrequencyDetection | null {
  if (intervals.length < 2) return null;

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avg, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  for (const range of FREQUENCY_RANGES) {
    const midpoint = (range.min + range.max) / 2;
    if (avg >= range.min && avg <= range.max) {
      // Confidence based on how consistent the intervals are
      // Lower stdDev = higher confidence
      const maxAcceptableStdDev = (range.max - range.min) / 2;
      const confidence = Math.max(0, 1 - stdDev / maxAcceptableStdDev);
      return { frequency: range.frequency, confidence };
    }
  }

  return null;
}
