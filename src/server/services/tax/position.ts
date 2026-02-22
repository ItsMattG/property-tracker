// src/server/services/tax-position.ts

import { ValidationError } from "@/server/errors";
import { getTaxTable, type TaxTable } from "@/lib/tax-tables";

export type FamilyStatus = "single" | "couple" | "family";

export interface TaxPositionInput {
  financialYear: number;
  grossSalary: number;
  paygWithheld: number;
  rentalNetResult: number; // negative = loss, positive = profit
  otherDeductions: number;
  depreciationDeductions: number; // total yearly depreciation from uploaded schedules
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  familyStatus: FamilyStatus;
  dependentChildren: number;
  partnerIncome: number;
}

export interface TaxPositionResult {
  financialYear: number;

  // Income
  grossSalary: number;
  rentalNetResult: number;
  taxableIncome: number;

  // Deductions
  otherDeductions: number;
  depreciationDeductions: number;
  totalDeductions: number;

  // Tax calculation
  baseTax: number;
  medicareLevy: number;
  medicareLevySurcharge: number;
  hecsRepayment: number;
  totalTaxLiability: number;

  // Result
  paygWithheld: number;
  refundOrOwing: number; // positive = refund, negative = owing
  isRefund: boolean;

  // Property impact
  marginalRate: number;
  propertySavings: number; // tax benefit from rental losses

  // MLS details (for UI)
  mlsApplies: boolean;
  mlsThreshold: number;
  combinedIncome: number;
}

/**
 * Calculate base tax using marginal brackets
 */
function calculateBaseTax(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= 0) return 0;

  for (const bracket of table.brackets) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      return bracket.base + (taxableIncome - bracket.min + 1) * bracket.rate;
    }
  }

  // Should not reach here, but handle edge case
  const lastBracket = table.brackets[table.brackets.length - 1];
  return lastBracket.base + (taxableIncome - lastBracket.min + 1) * lastBracket.rate;
}

/**
 * Get marginal tax rate for a given taxable income
 */
function getMarginalRate(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= 0) return 0;

  for (const bracket of table.brackets) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      return bracket.rate;
    }
  }

  return table.brackets[table.brackets.length - 1].rate;
}

/**
 * Calculate Medicare Levy (2% of taxable income above threshold)
 */
function calculateMedicareLevy(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= table.medicareLevyLowIncomeThreshold) return 0;
  return Math.max(0, taxableIncome * table.medicareLevy);
}

/**
 * Calculate Medicare Levy Surcharge
 * Applies to high income earners without private health insurance
 */
function calculateMLS(
  taxableIncome: number,
  hasPrivateHealth: boolean,
  familyStatus: FamilyStatus,
  dependentChildren: number,
  partnerIncome: number,
  table: TaxTable
): { surcharge: number; applies: boolean; threshold: number; combinedIncome: number } {
  if (hasPrivateHealth) {
    return { surcharge: 0, applies: false, threshold: 0, combinedIncome: 0 };
  }

  // Determine threshold based on family status
  let threshold = table.mlsThresholds.single;
  let incomeForMLS = taxableIncome;

  if (familyStatus === "couple" || familyStatus === "family") {
    threshold = table.mlsThresholds.family;
    // Add $1,500 for each dependent child after the first
    if (dependentChildren > 1) {
      threshold += (dependentChildren - 1) * table.mlsThresholds.childAdd;
    }
    // Combined income for family threshold
    incomeForMLS = taxableIncome + (partnerIncome || 0);
  }

  if (incomeForMLS <= threshold) {
    return { surcharge: 0, applies: false, threshold, combinedIncome: incomeForMLS };
  }

  // Find applicable MLS tier (based on individual income, not combined)
  let rate = 0;
  for (const tier of table.mlsTiers) {
    if (taxableIncome >= tier.min && taxableIncome <= tier.max) {
      rate = tier.rate;
      break;
    }
  }

  return {
    surcharge: taxableIncome * rate,
    applies: true,
    threshold,
    combinedIncome: incomeForMLS,
  };
}

/**
 * Calculate HECS/HELP repayment
 */
function calculateHECS(
  repaymentIncome: number,
  hasHecsDebt: boolean,
  table: TaxTable
): number {
  if (!hasHecsDebt) return 0;

  for (const tier of table.hecsRates) {
    if (repaymentIncome >= tier.min && repaymentIncome <= tier.max) {
      return repaymentIncome * tier.rate;
    }
  }

  return 0;
}

/**
 * Main calculation function
 */
export function calculateTaxPosition(input: TaxPositionInput): TaxPositionResult {
  const table = getTaxTable(input.financialYear);
  if (!table) {
    throw new ValidationError(`Tax tables not available for FY${input.financialYear}`);
  }

  // Calculate taxable income
  // Rental loss reduces taxable income (negative gearing)
  // Rental profit increases taxable income
  // Depreciation reduces rental income (or increases rental loss)
  const adjustedRentalResult = input.rentalNetResult - input.depreciationDeductions;
  const taxableIncome = Math.max(
    0,
    input.grossSalary + adjustedRentalResult - input.otherDeductions
  );

  // Calculate tax components
  const baseTax = calculateBaseTax(taxableIncome, table);
  const medicareLevy = calculateMedicareLevy(taxableIncome, table);
  const mls = calculateMLS(
    taxableIncome,
    input.hasPrivateHealth,
    input.familyStatus,
    input.dependentChildren,
    input.partnerIncome,
    table
  );

  // HECS repayment income includes salary + rental + any reportable fringe benefits
  // For simplicity, we use gross salary + adjusted rental net result
  const repaymentIncome = input.grossSalary + adjustedRentalResult;
  const hecsRepayment = calculateHECS(repaymentIncome, input.hasHecsDebt, table);

  // Total tax liability
  const totalTaxLiability = baseTax + medicareLevy + mls.surcharge + hecsRepayment;

  // Refund or owing
  const refundOrOwing = input.paygWithheld - totalTaxLiability;

  // Calculate property savings (tax benefit from rental losses including depreciation)
  const marginalRate = getMarginalRate(input.grossSalary, table); // Use salary for marginal rate
  const totalPropertyLoss = adjustedRentalResult < 0 ? Math.abs(adjustedRentalResult) : 0;
  const propertySavings = totalPropertyLoss * marginalRate;

  // Total deductions for display
  const rentalDeduction = adjustedRentalResult < 0 ? Math.abs(adjustedRentalResult) : 0;
  const totalDeductions = rentalDeduction + input.otherDeductions;

  return {
    financialYear: input.financialYear,
    grossSalary: input.grossSalary,
    rentalNetResult: input.rentalNetResult,
    taxableIncome,
    otherDeductions: input.otherDeductions,
    depreciationDeductions: input.depreciationDeductions,
    totalDeductions,
    baseTax,
    medicareLevy,
    medicareLevySurcharge: mls.surcharge,
    hecsRepayment,
    totalTaxLiability,
    paygWithheld: input.paygWithheld,
    refundOrOwing,
    isRefund: refundOrOwing >= 0,
    marginalRate,
    propertySavings,
    mlsApplies: mls.applies,
    mlsThreshold: mls.threshold,
    combinedIncome: mls.combinedIncome,
  };
}

/**
 * Quick estimate based on rental loss and tax bracket
 * Used for preview teaser before profile is set up
 */
export function estimatePropertySavings(
  rentalNetResult: number,
  assumedMarginalRate: number = 0.37
): number {
  if (rentalNetResult >= 0) return 0;
  return Math.abs(rentalNetResult) * assumedMarginalRate;
}
