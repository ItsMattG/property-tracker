import type { InterestRateFactorConfig } from "./types";

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
