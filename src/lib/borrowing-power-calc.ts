export type HouseholdType = "single" | "couple";
export type IncomeSource = "salary" | "rental" | "other";

/**
 * Monthly HEM benchmarks by household type and dependant count.
 * Source: Melbourne Institute HEM (approximate, updated annually).
 */
const HEM_TABLE: Record<HouseholdType, number[]> = {
  //                  0 deps, 1 dep, 2 deps, 3+ deps
  single: [1400, 1800, 2100, 2400],
  couple: [2100, 2400, 2700, 3000],
};

/** Returns monthly HEM benchmark for household type and dependant count. */
export function getHemBenchmark(
  householdType: HouseholdType,
  dependants: number
): number {
  const row = HEM_TABLE[householdType];
  const index = Math.min(dependants, 3);
  return row[index];
}

const INCOME_SHADING: Record<IncomeSource, number> = {
  salary: 1.0,
  rental: 0.8,
  other: 0.8,
};

/** Applies bank-standard income shading. */
export function shadeIncome(
  monthlyAmount: number,
  source: IncomeSource
): number {
  return monthlyAmount * INCOME_SHADING[source];
}

export type DtiClassification = "green" | "amber" | "red";

const APRA_BUFFER = 3.0;
const CREDIT_CARD_COMMITMENT_RATE = 0.038;

export function getAssessmentRate(
  productRate: number,
  floorRate: number
): number {
  return Math.max(floorRate, productRate + APRA_BUFFER);
}

export function calculateMaxLoan(
  monthlySurplus: number,
  assessmentRatePercent: number,
  loanTermYears: number
): number {
  if (monthlySurplus <= 0) return 0;
  const r = assessmentRatePercent / 100 / 12;
  const n = loanTermYears * 12;
  const pv = monthlySurplus * ((1 - Math.pow(1 + r, -n)) / r);
  return Math.round(pv);
}

export function calculateDti(
  totalDebt: number,
  grossAnnualIncome: number
): number {
  if (grossAnnualIncome === 0) return Infinity;
  return totalDebt / grossAnnualIncome;
}

export function getDtiClassification(dti: number): DtiClassification {
  if (dti < 4) return "green";
  if (dti < 6) return "amber";
  return "red";
}

export interface BorrowingPowerInputs {
  grossSalary: number;
  rentalIncome: number;
  otherIncome: number;
  householdType: HouseholdType;
  dependants: number;
  livingExpenses: number;
  existingPropertyLoans: number;
  creditCardLimits: number;
  otherLoans: number;
  hecsBalance: number;
  targetRate: number;
  loanTermYears: number;
  floorRate: number;
  existingDebt: number;
  grossAnnualIncome: number;
}

export interface BorrowingPowerResult {
  shadedSalary: number;
  shadedRental: number;
  shadedOther: number;
  totalMonthlyIncome: number;
  hemBenchmark: number;
  effectiveLivingExpenses: number;
  hemApplied: boolean;
  creditCardCommitment: number;
  totalMonthlyCommitments: number;
  monthlySurplus: number;
  assessmentRate: number;
  maxLoan: number;
  monthlyRepayment: number;
  dtiRatio: number;
  dtiClassification: DtiClassification;
}

export function calculateBorrowingPower(
  inputs: BorrowingPowerInputs
): BorrowingPowerResult {
  const shadedSalary = shadeIncome(inputs.grossSalary, "salary");
  const shadedRental = shadeIncome(inputs.rentalIncome, "rental");
  const shadedOther = shadeIncome(inputs.otherIncome, "other");
  const totalMonthlyIncome = shadedSalary + shadedRental + shadedOther;

  const hemBenchmark = getHemBenchmark(inputs.householdType, inputs.dependants);
  const effectiveLivingExpenses = Math.max(inputs.livingExpenses, hemBenchmark);
  const hemApplied = inputs.livingExpenses < hemBenchmark;

  const creditCardCommitment = inputs.creditCardLimits * CREDIT_CARD_COMMITMENT_RATE;
  const totalMonthlyCommitments =
    inputs.existingPropertyLoans +
    creditCardCommitment +
    inputs.otherLoans;

  const monthlySurplus =
    totalMonthlyIncome - effectiveLivingExpenses - totalMonthlyCommitments;

  const assessmentRate = getAssessmentRate(inputs.targetRate, inputs.floorRate);
  const maxLoan = calculateMaxLoan(monthlySurplus, assessmentRate, inputs.loanTermYears);

  const r = assessmentRate / 100 / 12;
  const n = inputs.loanTermYears * 12;
  const monthlyRepayment =
    maxLoan > 0 ? maxLoan * (r / (1 - Math.pow(1 + r, -n))) : 0;

  const totalDebt = inputs.existingDebt + maxLoan;
  const dtiRatio = calculateDti(totalDebt, inputs.grossAnnualIncome);
  const dtiClassification = getDtiClassification(dtiRatio);

  return {
    shadedSalary,
    shadedRental,
    shadedOther,
    totalMonthlyIncome,
    hemBenchmark,
    effectiveLivingExpenses,
    hemApplied,
    creditCardCommitment,
    totalMonthlyCommitments,
    monthlySurplus,
    assessmentRate,
    maxLoan,
    monthlyRepayment: Math.round(monthlyRepayment),
    dtiRatio,
    dtiClassification,
  };
}
