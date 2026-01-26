// src/lib/tax-tables.ts

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  base: number;
}

export interface HECSRate {
  min: number;
  max: number;
  rate: number;
}

export interface MLSTier {
  min: number;
  max: number;
  rate: number;
}

export interface TaxTable {
  brackets: TaxBracket[];
  medicareLevy: number;
  medicareLevyLowIncomeThreshold: number;
  mlsThresholds: {
    single: number;
    family: number;
    childAdd: number;
  };
  mlsTiers: MLSTier[];
  hecsRates: HECSRate[];
}

// FY2025-26 (ending June 30, 2026) - Post Stage 3 tax cuts
const FY2026: TaxTable = {
  brackets: [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.16, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4288 },
    { min: 135001, max: 190000, rate: 0.37, base: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
  ],
  medicareLevy: 0.02,
  medicareLevyLowIncomeThreshold: 26000,
  mlsThresholds: {
    single: 93000,
    family: 186000,
    childAdd: 1500,
  },
  mlsTiers: [
    { min: 0, max: 93000, rate: 0 },
    { min: 93001, max: 108000, rate: 0.01 },
    { min: 108001, max: 144000, rate: 0.0125 },
    { min: 144001, max: Infinity, rate: 0.015 },
  ],
  hecsRates: [
    { min: 0, max: 54435, rate: 0 },
    { min: 54436, max: 62850, rate: 0.01 },
    { min: 62851, max: 66620, rate: 0.02 },
    { min: 66621, max: 70618, rate: 0.025 },
    { min: 70619, max: 74855, rate: 0.03 },
    { min: 74856, max: 79346, rate: 0.035 },
    { min: 79347, max: 84107, rate: 0.04 },
    { min: 84108, max: 89154, rate: 0.045 },
    { min: 89155, max: 94503, rate: 0.05 },
    { min: 94504, max: 100174, rate: 0.055 },
    { min: 100175, max: 106185, rate: 0.06 },
    { min: 106186, max: 112556, rate: 0.065 },
    { min: 112557, max: 119309, rate: 0.07 },
    { min: 119310, max: 126467, rate: 0.075 },
    { min: 126468, max: 134056, rate: 0.08 },
    { min: 134057, max: 142100, rate: 0.085 },
    { min: 142101, max: 150626, rate: 0.09 },
    { min: 150627, max: 159663, rate: 0.095 },
    { min: 159664, max: Infinity, rate: 0.10 },
  ],
};

// FY2024-25 (ending June 30, 2025) - Post Stage 3 tax cuts
const FY2025: TaxTable = {
  brackets: [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.16, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4288 },
    { min: 135001, max: 190000, rate: 0.37, base: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
  ],
  medicareLevy: 0.02,
  medicareLevyLowIncomeThreshold: 24276,
  mlsThresholds: {
    single: 93000,
    family: 186000,
    childAdd: 1500,
  },
  mlsTiers: [
    { min: 0, max: 93000, rate: 0 },
    { min: 93001, max: 108000, rate: 0.01 },
    { min: 108001, max: 144000, rate: 0.0125 },
    { min: 144001, max: Infinity, rate: 0.015 },
  ],
  hecsRates: [
    { min: 0, max: 51550, rate: 0 },
    { min: 51551, max: 59518, rate: 0.01 },
    { min: 59519, max: 63089, rate: 0.02 },
    { min: 63090, max: 66875, rate: 0.025 },
    { min: 66876, max: 70888, rate: 0.03 },
    { min: 70889, max: 75140, rate: 0.035 },
    { min: 75141, max: 79649, rate: 0.04 },
    { min: 79650, max: 84429, rate: 0.045 },
    { min: 84430, max: 89494, rate: 0.05 },
    { min: 89495, max: 94865, rate: 0.055 },
    { min: 94866, max: 100557, rate: 0.06 },
    { min: 100558, max: 106590, rate: 0.065 },
    { min: 106591, max: 112985, rate: 0.07 },
    { min: 112986, max: 119764, rate: 0.075 },
    { min: 119765, max: 126950, rate: 0.08 },
    { min: 126951, max: 134568, rate: 0.085 },
    { min: 134569, max: 142642, rate: 0.09 },
    { min: 142643, max: 151200, rate: 0.095 },
    { min: 151201, max: Infinity, rate: 0.10 },
  ],
};

// FY2023-24 (ending June 30, 2024) - Pre Stage 3 tax cuts
const FY2024: TaxTable = {
  brackets: [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.19, base: 0 },
    { min: 45001, max: 120000, rate: 0.325, base: 5092 },
    { min: 120001, max: 180000, rate: 0.37, base: 29467 },
    { min: 180001, max: Infinity, rate: 0.45, base: 51667 },
  ],
  medicareLevy: 0.02,
  medicareLevyLowIncomeThreshold: 23365,
  mlsThresholds: {
    single: 90000,
    family: 180000,
    childAdd: 1500,
  },
  mlsTiers: [
    { min: 0, max: 90000, rate: 0 },
    { min: 90001, max: 105000, rate: 0.01 },
    { min: 105001, max: 140000, rate: 0.0125 },
    { min: 140001, max: Infinity, rate: 0.015 },
  ],
  hecsRates: [
    { min: 0, max: 51550, rate: 0 },
    { min: 51551, max: 59518, rate: 0.01 },
    { min: 59519, max: 63089, rate: 0.02 },
    { min: 63090, max: 66875, rate: 0.025 },
    { min: 66876, max: 70888, rate: 0.03 },
    { min: 70889, max: 75140, rate: 0.035 },
    { min: 75141, max: 79649, rate: 0.04 },
    { min: 79650, max: 84429, rate: 0.045 },
    { min: 84430, max: 89494, rate: 0.05 },
    { min: 89495, max: 94865, rate: 0.055 },
    { min: 94866, max: 100557, rate: 0.06 },
    { min: 100558, max: 106590, rate: 0.065 },
    { min: 106591, max: 112985, rate: 0.07 },
    { min: 112986, max: 119764, rate: 0.075 },
    { min: 119765, max: 126950, rate: 0.08 },
    { min: 126951, max: 134568, rate: 0.085 },
    { min: 134569, max: 142642, rate: 0.09 },
    { min: 142643, max: 151200, rate: 0.095 },
    { min: 151201, max: Infinity, rate: 0.10 },
  ],
};

export const TAX_TABLES: Record<number, TaxTable> = {
  2026: FY2026,
  2025: FY2025,
  2024: FY2024,
};

export function getTaxTable(financialYear: number): TaxTable | null {
  return TAX_TABLES[financialYear] ?? null;
}

export function getSupportedFinancialYears(): number[] {
  return Object.keys(TAX_TABLES).map(Number).sort((a, b) => b - a);
}

export function getCurrentFinancialYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 6 = Jul)
  const year = now.getFullYear();
  // FY ends June 30, so if we're in Jul-Dec, we're in the FY ending next year
  return month >= 6 ? year + 1 : year;
}
