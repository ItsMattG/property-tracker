type DepreciationMethod = "diminishing_value" | "prime_cost";
type DepreciationCategory = "plant_equipment" | "capital_works";

export interface YearEntry {
  year: number;
  openingValue: number;
  deduction: number;
  closingValue: number;
}

export interface ExtractedAssetInput {
  assetName: string;
  category: DepreciationCategory;
  originalCost: number;
  effectiveLife: number;
  method: DepreciationMethod;
  yearlyDeduction: number;
}

export interface ValidatedAsset extends ExtractedAssetInput {
  discrepancy: boolean;
}

/**
 * Calculate yearly depreciation deduction using ATO formulas.
 *
 * Prime cost: cost / effective life
 * Diminishing value: (cost * 2) / effective life
 *
 * @param proRataFactor - Fraction of the year the asset was held (0-1), defaults to 1
 */
export function calculateYearlyDeduction(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  proRataFactor: number = 1
): number {
  if (originalCost <= 0 || effectiveLife <= 0) return 0;

  let deduction: number;
  if (method === "prime_cost") {
    deduction = originalCost / effectiveLife;
  } else {
    deduction = (originalCost * 2) / effectiveLife;
  }

  return Math.round(deduction * proRataFactor * 100) / 100;
}

/**
 * Calculate remaining book value after a number of years of depreciation.
 *
 * Prime cost: linear reduction each year.
 * Diminishing value: compound reduction using rate = 2 / effectiveLife.
 */
export function calculateRemainingValue(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  yearsElapsed: number
): number {
  if (originalCost <= 0 || effectiveLife <= 0) return 0;
  if (yearsElapsed <= 0) return originalCost;

  if (method === "prime_cost") {
    const annualDeduction = originalCost / effectiveLife;
    return Math.max(
      0,
      Math.round((originalCost - annualDeduction * yearsElapsed) * 100) / 100
    );
  }

  const rate = 2 / effectiveLife;
  let value = originalCost;
  for (let i = 0; i < yearsElapsed; i++) {
    value = value * (1 - rate);
    if (value < 0.01) return 0;
  }

  return Math.round(value * 100) / 100;
}

/**
 * Generate a multi-year depreciation schedule showing opening value,
 * deduction, and closing value for each year.
 *
 * @param maxYears - Cap the number of years generated (defaults to effectiveLife, max 40)
 */
export function generateMultiYearSchedule(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  maxYears?: number
): YearEntry[] {
  if (originalCost <= 0 || effectiveLife <= 0) return [];

  const years = Math.min(maxYears ?? effectiveLife, 40);
  const entries: YearEntry[] = [];
  let openingValue = originalCost;

  for (let year = 1; year <= years; year++) {
    if (openingValue <= 0) break;

    let deduction: number;
    if (method === "prime_cost") {
      deduction = originalCost / effectiveLife;
    } else {
      deduction = openingValue * (2 / effectiveLife);
    }

    deduction = Math.min(deduction, openingValue);
    deduction = Math.round(deduction * 100) / 100;

    const closingValue = Math.max(
      0,
      Math.round((openingValue - deduction) * 100) / 100
    );

    entries.push({
      year,
      openingValue: Math.round(openingValue * 100) / 100,
      deduction,
      closingValue,
    });

    openingValue = closingValue;
  }

  return entries;
}

/**
 * Validate AI-extracted asset data against ATO depreciation formulas.
 *
 * Recalculates yearly deduction from first principles and flags discrepancies
 * where the AI-extracted value differs by more than 10% from the calculated value.
 *
 * Capital works assets are forced to prime cost method with 40-year effective life
 * per ATO Division 43 rules.
 */
export function validateAndRecalculate(
  assets: ExtractedAssetInput[]
): ValidatedAsset[] {
  return assets.map((asset) => {
    let { method, effectiveLife } = asset;

    // Capital works (Division 43) must use prime cost at 2.5% (40 years)
    if (asset.category === "capital_works") {
      method = "prime_cost";
      effectiveLife = 40;
    }

    const calculated = calculateYearlyDeduction(
      asset.originalCost,
      effectiveLife,
      method
    );
    const aiDeduction = asset.yearlyDeduction;
    const diff = Math.abs(calculated - aiDeduction);
    const threshold = calculated * 0.1;
    const discrepancy = diff > threshold;

    return {
      ...asset,
      method,
      effectiveLife,
      yearlyDeduction: calculated,
      discrepancy,
    };
  });
}
