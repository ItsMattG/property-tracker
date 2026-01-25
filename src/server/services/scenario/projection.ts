import type {
  InterestRateFactorConfig,
  VacancyFactorConfig,
  RentChangeFactorConfig,
  ExpenseChangeFactorConfig,
} from "./types";

export interface LoanForProjection {
  id: string;
  propertyId: string;
  currentBalance: number;
  interestRate: number; // annual percentage
  repaymentAmount: number;
}

export interface InterestRateResult {
  loanId: string;
  originalInterest: number;
  adjustedInterest: number;
  adjustedRate: number;
}

export function applyInterestRateFactor(
  loan: LoanForProjection,
  config: InterestRateFactorConfig
): InterestRateResult {
  const originalMonthlyInterest = (loan.currentBalance * loan.interestRate) / 100 / 12;

  let adjustedRate = loan.interestRate;
  if (config.applyTo === "all" || config.applyTo === loan.propertyId) {
    adjustedRate = loan.interestRate + config.changePercent;
  }

  const adjustedMonthlyInterest = (loan.currentBalance * adjustedRate) / 100 / 12;

  return {
    loanId: loan.id,
    originalInterest: originalMonthlyInterest,
    adjustedInterest: adjustedMonthlyInterest,
    adjustedRate,
  };
}

export interface PropertyForProjection {
  id: string;
  monthlyRent: number;
}

export interface VacancyResult {
  propertyId: string;
  originalRent: number;
  adjustedRent: number;
  isVacant: boolean;
}

export function applyVacancyFactor(
  property: PropertyForProjection,
  config: VacancyFactorConfig,
  currentMonth: number,
  startMonth: number = 0
): VacancyResult {
  const vacancyStart = startMonth;
  const vacancyEnd = startMonth + config.months;

  const isThisPropertyVacant =
    config.propertyId === property.id &&
    currentMonth >= vacancyStart &&
    currentMonth < vacancyEnd;

  return {
    propertyId: property.id,
    originalRent: property.monthlyRent,
    adjustedRent: isThisPropertyVacant ? 0 : property.monthlyRent,
    isVacant: isThisPropertyVacant,
  };
}

export interface RentChangeResult {
  propertyId: string;
  originalRent: number;
  adjustedRent: number;
}

export function applyRentChangeFactor(
  property: PropertyForProjection,
  config: RentChangeFactorConfig
): RentChangeResult {
  const applies = !config.propertyId || config.propertyId === property.id;
  const multiplier = applies ? 1 + config.changePercent / 100 : 1;

  return {
    propertyId: property.id,
    originalRent: property.monthlyRent,
    adjustedRent: property.monthlyRent * multiplier,
  };
}

export interface ExpenseData {
  total: number;
  byCategory: Record<string, number>;
}

export interface ExpenseChangeResult {
  originalTotal: number;
  adjustedTotal: number;
  adjustedByCategory: Record<string, number>;
}

export function applyExpenseChangeFactor(
  expenses: ExpenseData,
  config: ExpenseChangeFactorConfig
): ExpenseChangeResult {
  const adjustedByCategory: Record<string, number> = {};
  let adjustedTotal = 0;

  for (const [category, amount] of Object.entries(expenses.byCategory)) {
    const applies = !config.category || config.category === category;
    const multiplier = applies ? 1 + config.changePercent / 100 : 1;
    adjustedByCategory[category] = amount * multiplier;
    adjustedTotal += adjustedByCategory[category];
  }

  return {
    originalTotal: expenses.total,
    adjustedTotal,
    adjustedByCategory,
  };
}
