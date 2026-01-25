// src/server/services/performance-benchmarking.ts

import type {
  PercentileResult,
  PerformanceInsight,
} from "@/types/performance-benchmarking";

/**
 * Calculate percentile based on user value vs benchmark median
 * Uses a simplified model comparing to median
 */
export function calculatePercentile(
  userValue: number,
  benchmarkMedian: number
): number {
  if (benchmarkMedian <= 0) return 50;
  const ratio = userValue / benchmarkMedian;

  if (ratio >= 1.2) return 90;  // 20%+ above median
  if (ratio >= 1.1) return 75;
  if (ratio >= 1.0) return 55;
  if (ratio >= 0.9) return 40;
  if (ratio >= 0.8) return 25;
  return 10;  // 20%+ below median
}

/**
 * Calculate inverted percentile (for metrics where lower is better)
 */
export function calculateInvertedPercentile(
  userValue: number,
  benchmarkMedian: number
): number {
  if (benchmarkMedian <= 0) return 50;
  // Invert: if user is 20% below median (good), they're in 90th percentile
  const ratio = userValue / benchmarkMedian;

  if (ratio <= 0.8) return 90;  // 20%+ below median (excellent)
  if (ratio <= 0.9) return 75;
  if (ratio <= 1.0) return 55;
  if (ratio <= 1.1) return 40;
  if (ratio <= 1.2) return 25;
  return 10;  // 20%+ above median (poor)
}

export function getPercentileStatus(
  percentile: number
): "excellent" | "good" | "average" | "below" | "poor" {
  if (percentile >= 80) return "excellent";
  if (percentile >= 60) return "good";
  if (percentile >= 40) return "average";
  if (percentile >= 20) return "below";
  return "poor";
}

export function getScoreLabel(
  score: number
): "Excellent" | "Good" | "Average" | "Below Average" | "Poor" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  if (score >= 20) return "Below Average";
  return "Poor";
}

/**
 * Calculate overall performance score from percentiles
 * Weights: Yield 40%, Growth 30%, Expenses 20% (inverted), Vacancy 10% (inverted)
 */
export function calculatePerformanceScore(
  yieldPercentile: number | null,
  growthPercentile: number | null,
  expensePercentile: number | null,
  vacancyPercentile: number | null
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  if (yieldPercentile !== null) {
    weightedSum += yieldPercentile * 0.4;
    totalWeight += 0.4;
  }
  if (growthPercentile !== null) {
    weightedSum += growthPercentile * 0.3;
    totalWeight += 0.3;
  }
  if (expensePercentile !== null) {
    weightedSum += expensePercentile * 0.2;
    totalWeight += 0.2;
  }
  if (vacancyPercentile !== null) {
    weightedSum += vacancyPercentile * 0.1;
    totalWeight += 0.1;
  }

  if (totalWeight === 0) return 50; // Default if no data
  return Math.round(weightedSum / totalWeight);
}

/**
 * Generate insights based on performance metrics
 */
export function generateInsights(
  userYield: number | null,
  medianYield: number | null,
  userExpenseRatio: number | null,
  medianExpenseRatio: number | null,
  userVacancyWeeks: number | null,
  suburbVacancyRate: number | null
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  // Yield insights
  if (userYield !== null && medianYield !== null && medianYield > 0) {
    const yieldRatio = userYield / medianYield;
    if (yieldRatio < 0.85) {
      const percentBelow = Math.round((1 - yieldRatio) * 100);
      insights.push({
        type: "yield",
        message: `Rent is ${percentBelow}% below market. Consider rent review at next lease renewal.`,
        severity: "warning",
      });
    } else if (yieldRatio > 1.1) {
      insights.push({
        type: "yield",
        message: "Strong yield performance - top quartile for similar properties.",
        severity: "positive",
      });
    }
  }

  // Expense insights
  if (userExpenseRatio !== null && medianExpenseRatio !== null && medianExpenseRatio > 0) {
    const expenseRatio = userExpenseRatio / medianExpenseRatio;
    if (expenseRatio > 1.2) {
      insights.push({
        type: "expense",
        message: "Operating expenses are high. Review insurance and management fees.",
        severity: "warning",
      });
    }
  }

  // Vacancy insights
  if (userVacancyWeeks !== null && suburbVacancyRate !== null && suburbVacancyRate > 0) {
    const expectedVacancyWeeks = suburbVacancyRate * 52 / 100;
    if (userVacancyWeeks > expectedVacancyWeeks * 2) {
      insights.push({
        type: "vacancy",
        message: "High vacancy compared to suburb average. Check property presentation or agent performance.",
        severity: "critical",
      });
    }
  }

  return insights;
}

/**
 * Determine if property is underperforming
 */
export function isUnderperforming(
  yieldPercentile: number | null,
  expensePercentile: number | null,
  vacancyPercentile: number | null
): boolean {
  // Underperforming if any critical metric is in bottom quartile
  if (yieldPercentile !== null && yieldPercentile < 25) return true;
  if (expensePercentile !== null && expensePercentile < 25) return true; // Inverted, so low = high expenses
  if (vacancyPercentile !== null && vacancyPercentile < 25) return true; // Inverted, so low = high vacancy
  return false;
}

/**
 * Build cohort description
 */
export function buildCohortDescription(
  bedrooms: number | null,
  propertyType: string,
  suburb: string,
  state: string
): string {
  const bedroomText = bedrooms ? `${bedrooms}-bed` : "";
  const typeText = propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
  const pluralType = typeText === "House" ? "houses" : typeText.toLowerCase() + "s";

  return `${bedroomText} ${pluralType} in ${suburb} ${state}`.trim().replace(/\s+/g, " ");
}
