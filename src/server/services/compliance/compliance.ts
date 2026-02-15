import { addMonths, differenceInDays } from "date-fns";

export type ComplianceStatus = "compliant" | "upcoming" | "due_soon" | "overdue";

/**
 * Calculate the next due date based on completion date and frequency
 */
export function calculateNextDueDate(completedAt: Date, frequencyMonths: number): Date {
  return addMonths(completedAt, frequencyMonths);
}

/**
 * Calculate compliance status based on next due date
 * - compliant: > 30 days until due
 * - upcoming: <= 30 days until due
 * - due_soon: <= 7 days until due
 * - overdue: past due date
 */
export function calculateComplianceStatus(
  nextDueAt: Date,
  today: Date = new Date()
): ComplianceStatus {
  const daysUntilDue = differenceInDays(nextDueAt, today);

  if (daysUntilDue < 0) {
    return "overdue";
  }
  if (daysUntilDue <= 7) {
    return "due_soon";
  }
  if (daysUntilDue <= 30) {
    return "upcoming";
  }
  return "compliant";
}
