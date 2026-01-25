/**
 * Generate a random amount within a range.
 */
export function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Generate dates for a recurring pattern.
 */
export function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  frequency: "monthly" | "quarterly" | "annual",
  dayOfMonth: number = 15
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setDate(dayOfMonth);

  const monthIncrement = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setMonth(current.getMonth() + monthIncrement);
  }

  return dates;
}

/**
 * Generate sporadic dates (random occurrences).
 */
export function generateSporadicDates(
  startDate: Date,
  endDate: Date,
  averagePerYear: number
): Date[] {
  const dates: Date[] = [];
  const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());
  const expectedCount = Math.round((totalMonths / 12) * averagePerYear);

  for (let i = 0; i < expectedCount; i++) {
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    dates.push(new Date(randomTime));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Format date as YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Add months to a date.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Check if a date falls within a vacancy period.
 */
export function isInVacancyPeriod(
  date: Date,
  vacancyPeriods: { start: Date; end: Date }[]
): boolean {
  return vacancyPeriods.some(
    (period) => date >= period.start && date <= period.end
  );
}
