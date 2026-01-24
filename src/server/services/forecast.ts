export interface ScenarioAssumptions {
  rentGrowthPercent: number;
  expenseInflationPercent: number;
  vacancyRatePercent: number;
  interestRateChangePercent: number;
}

export const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  rentGrowthPercent: 2,
  expenseInflationPercent: 3,
  vacancyRatePercent: 0,
  interestRateChangePercent: 0,
};

export interface MonthlyProjection {
  projectedIncome: number;
  projectedExpenses: number;
  projectedNet: number;
}

export interface ProjectionInput {
  monthsAhead: number;
  baseIncome: number;
  baseExpenses: number;
  loanBalance: number;
  loanRate: number;
  assumptions: ScenarioAssumptions;
}

/**
 * Apply compound growth rate to a base amount
 */
export function applyGrowthRate(
  baseAmount: number,
  monthsAhead: number,
  annualRatePercent: number
): number {
  if (monthsAhead === 0) return baseAmount;
  const monthlyRate = annualRatePercent / 100 / 12;
  return baseAmount * Math.pow(1 + monthlyRate, monthsAhead);
}

/**
 * Calculate monthly loan interest
 */
export function calculateMonthlyLoanInterest(
  balance: number,
  currentRatePercent: number,
  rateAdjustmentPercent: number
): number {
  const adjustedRate = currentRatePercent + rateAdjustmentPercent;
  return balance * (adjustedRate / 100 / 12);
}

/**
 * Calculate projected income, expenses, and net for a single month
 */
export function calculateMonthlyProjection(input: ProjectionInput): MonthlyProjection {
  const { monthsAhead, baseIncome, baseExpenses, loanBalance, loanRate, assumptions } = input;

  // Apply growth rates
  let projectedIncome = applyGrowthRate(baseIncome, monthsAhead, assumptions.rentGrowthPercent);
  const projectedBaseExpenses = applyGrowthRate(
    baseExpenses,
    monthsAhead,
    assumptions.expenseInflationPercent
  );

  // Apply vacancy rate
  projectedIncome = projectedIncome * (1 - assumptions.vacancyRatePercent / 100);

  // Calculate loan interest
  const loanInterest = calculateMonthlyLoanInterest(
    loanBalance,
    loanRate,
    assumptions.interestRateChangePercent
  );

  const projectedExpenses = projectedBaseExpenses + loanInterest;
  const projectedNet = projectedIncome - projectedExpenses;

  return {
    projectedIncome: Math.round(projectedIncome * 100) / 100,
    projectedExpenses: Math.round(projectedExpenses * 100) / 100,
    projectedNet: Math.round(projectedNet * 100) / 100,
  };
}

/**
 * Get the first day of a month, N months ahead
 */
export function getForecastMonth(monthsAhead: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + monthsAhead);
  return date.toISOString().split("T")[0];
}

/**
 * Parse assumptions from JSON string with defaults
 */
export function parseAssumptions(json: string | null): ScenarioAssumptions {
  if (!json) return DEFAULT_ASSUMPTIONS;
  try {
    const parsed = JSON.parse(json);
    return {
      rentGrowthPercent: parsed.rentGrowthPercent ?? DEFAULT_ASSUMPTIONS.rentGrowthPercent,
      expenseInflationPercent:
        parsed.expenseInflationPercent ?? DEFAULT_ASSUMPTIONS.expenseInflationPercent,
      vacancyRatePercent: parsed.vacancyRatePercent ?? DEFAULT_ASSUMPTIONS.vacancyRatePercent,
      interestRateChangePercent:
        parsed.interestRateChangePercent ?? DEFAULT_ASSUMPTIONS.interestRateChangePercent,
    };
  } catch {
    return DEFAULT_ASSUMPTIONS;
  }
}
