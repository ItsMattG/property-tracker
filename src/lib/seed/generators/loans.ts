import { randomUUID } from "crypto";
import type { LoanSeedConfig } from "../types";
import { formatDate } from "../utils";

export interface GeneratedLoan {
  id: string;
  userId: string;
  propertyId: string;
  lender: string;
  accountNumberMasked: string;
  loanType: "principal_and_interest" | "interest_only";
  rateType: "variable" | "fixed" | "split";
  originalAmount: string;
  currentBalance: string;
  interestRate: string;
  fixedRateExpiry: string | null;
  repaymentAmount: string;
  repaymentFrequency: string;
  offsetAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function generateLoan(
  config: LoanSeedConfig & { userId: string; offsetAccountId?: string }
): GeneratedLoan {
  return {
    id: randomUUID(),
    userId: config.userId,
    propertyId: config.propertyId,
    lender: config.lender,
    accountNumberMasked: `****${Math.floor(1000 + Math.random() * 9000)}`,
    loanType: config.loanType,
    rateType: config.rateType,
    originalAmount: config.originalAmount.toFixed(2),
    currentBalance: config.currentBalance.toFixed(2),
    interestRate: config.interestRate.toFixed(2),
    fixedRateExpiry: config.fixedRateExpiry ? formatDate(config.fixedRateExpiry) : null,
    repaymentAmount: config.repaymentAmount.toFixed(2),
    repaymentFrequency: config.repaymentFrequency,
    offsetAccountId: config.offsetAccountId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface RefinanceAlertConfig {
  loanId: string;
  enabled?: boolean;
  rateGapThreshold?: number;
  notifyOnCashRateChange?: boolean;
}

export interface GeneratedRefinanceAlert {
  id: string;
  loanId: string;
  enabled: boolean;
  rateGapThreshold: string;
  notifyOnCashRateChange: boolean;
  lastAlertedAt: Date | null;
  createdAt: Date;
}

export function generateRefinanceAlert(config: RefinanceAlertConfig): GeneratedRefinanceAlert {
  return {
    id: randomUUID(),
    loanId: config.loanId,
    enabled: config.enabled ?? true,
    rateGapThreshold: (config.rateGapThreshold ?? 0.5).toFixed(2),
    notifyOnCashRateChange: config.notifyOnCashRateChange ?? true,
    lastAlertedAt: null,
    createdAt: new Date(),
  };
}
