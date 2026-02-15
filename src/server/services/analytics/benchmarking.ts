import type {
  BenchmarkStatus,
  CategoryBenchmark,
  ManagementFeeBenchmark,
} from "@/types/benchmarking";
import {
  insuranceBenchmarks,
  councilRatesBenchmarks,
  managementFeeBenchmarks,
  ABOVE_AVERAGE_THRESHOLD,
} from "@/server/data/expense-benchmarks";

/**
 * Determine benchmark status based on user amount vs average
 * "below" = significantly under average (< 87% of average)
 * "average" = within normal range (87% to 115% of average)
 * "above" = significantly over average (> 115% of average)
 */
export function getBenchmarkStatus(
  userAmount: number,
  averageAmount: number
): BenchmarkStatus {
  if (userAmount > averageAmount * ABOVE_AVERAGE_THRESHOLD) {
    return "above";
  }
  if (userAmount < averageAmount / ABOVE_AVERAGE_THRESHOLD) {
    return "below";
  }
  return "average";
}

/**
 * Calculate insurance benchmark based on property value and state
 * Insurance benchmarks are per $100k of property value
 */
export function calculateInsuranceBenchmark(
  userAnnualInsurance: number,
  propertyValue: number,
  state: string
): CategoryBenchmark | null {
  if (userAnnualInsurance <= 0 || propertyValue <= 0) {
    return null;
  }

  const stateBenchmark = insuranceBenchmarks[state];
  if (!stateBenchmark) {
    return null;
  }

  const averageAmount = (propertyValue / 100000) * stateBenchmark.average;
  const status = getBenchmarkStatus(userAnnualInsurance, averageAmount);
  const potentialSavings = Math.max(0, userAnnualInsurance - averageAmount);
  const percentDiff =
    ((userAnnualInsurance - averageAmount) / averageAmount) * 100;

  return {
    userAmount: userAnnualInsurance,
    averageAmount,
    status,
    potentialSavings,
    percentDiff: Math.round(percentDiff),
  };
}

/**
 * Calculate council rates benchmark based on state
 */
export function calculateCouncilRatesBenchmark(
  userAnnualRates: number,
  state: string
): CategoryBenchmark | null {
  if (userAnnualRates <= 0) {
    return null;
  }

  const stateBenchmark = councilRatesBenchmarks[state];
  if (!stateBenchmark) {
    return null;
  }

  const averageAmount = stateBenchmark.average;
  const status = getBenchmarkStatus(userAnnualRates, averageAmount);
  const potentialSavings = Math.max(0, userAnnualRates - averageAmount);
  const percentDiff =
    ((userAnnualRates - averageAmount) / averageAmount) * 100;

  return {
    userAmount: userAnnualRates,
    averageAmount,
    status,
    potentialSavings,
    percentDiff: Math.round(percentDiff),
  };
}

/**
 * Calculate management fees benchmark as percentage of annual rent
 */
export function calculateManagementFeesBenchmark(
  userAnnualFees: number,
  annualRent: number
): ManagementFeeBenchmark | null {
  if (userAnnualFees <= 0 || annualRent <= 0) {
    return null;
  }

  const userPercent = (userAnnualFees / annualRent) * 100;
  const averagePercent = managementFeeBenchmarks.average;
  const averageAmount = annualRent * (averagePercent / 100);
  const status = getBenchmarkStatus(userAnnualFees, averageAmount);
  const potentialSavings = Math.round(
    Math.max(0, userAnnualFees - averageAmount)
  );
  const percentDiff = ((userAnnualFees - averageAmount) / averageAmount) * 100;

  return {
    userAmount: userAnnualFees,
    averageAmount: Math.round(averageAmount),
    status,
    potentialSavings,
    percentDiff: Math.round(percentDiff),
    userPercent: Math.round(userPercent),
    averagePercent,
  };
}
