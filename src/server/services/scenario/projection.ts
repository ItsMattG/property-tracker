import type {
  InterestRateFactorConfig,
  VacancyFactorConfig,
  RentChangeFactorConfig,
  ExpenseChangeFactorConfig,
  SellPropertyFactorConfig,
  FactorConfig,
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

export interface PropertyState {
  id: string;
  monthlyRent: number;
  monthlyExpenses: number;
}

// CGT Calculation Types
export interface PropertyForSale {
  id: string;
  purchasePrice: number;
  improvements: number;
  depreciationClaimed: number;
  purchaseDate: Date;
}

export interface CGTResult {
  costBase: number;
  grossGain: number;
  taxableGain: number;
  cgtPayable: number;
  discountApplied: boolean;
  capitalLoss: number;
}

export function calculateCGT(
  property: PropertyForSale,
  salePrice: number,
  sellingCosts: number,
  marginalTaxRate: number
): CGTResult {
  // Cost base = purchase price + improvements - depreciation claimed
  const costBase = property.purchasePrice + property.improvements - property.depreciationClaimed;

  // Gross gain = sale price - selling costs - cost base
  const grossGain = salePrice - sellingCosts - costBase;

  // Check if held > 12 months for 50% CGT discount
  const purchaseDate = new Date(property.purchaseDate);
  const now = new Date();
  const monthsHeld = (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
    (now.getMonth() - purchaseDate.getMonth());
  const discountApplied = monthsHeld >= 12 && grossGain > 0;

  // Capital loss (no tax, but track for offsetting future gains)
  const capitalLoss = grossGain < 0 ? Math.abs(grossGain) : 0;

  // Taxable gain (apply 50% discount if eligible)
  const taxableGain = grossGain > 0
    ? (discountApplied ? grossGain * 0.5 : grossGain)
    : 0;

  // CGT payable
  const cgtPayable = taxableGain * marginalTaxRate;

  return {
    costBase,
    grossGain,
    taxableGain,
    cgtPayable,
    discountApplied,
    capitalLoss,
  };
}

export interface SellPropertyResult {
  adjustedPortfolio: PortfolioState;
  cgtResult: CGTResult;
  netProceeds: number;
  loanPayoff: number;
}

export function applySellPropertyFactor(
  portfolio: PortfolioState,
  config: SellPropertyFactorConfig,
  propertyData: PropertyForSale,
  marginalTaxRate: number
): SellPropertyResult {
  // Calculate CGT
  const cgtResult = calculateCGT(
    propertyData,
    config.salePrice,
    config.sellingCosts,
    marginalTaxRate
  );

  // Find loan for property (if any)
  const propertyLoan = portfolio.loans.find((l) => l.propertyId === config.propertyId);
  const loanPayoff = propertyLoan?.currentBalance || 0;

  // Net proceeds = sale price - selling costs - loan payoff - CGT
  const netProceeds = config.salePrice - config.sellingCosts - loanPayoff - cgtResult.cgtPayable;

  // Remove property and associated loan from portfolio
  const adjustedPortfolio: PortfolioState = {
    properties: portfolio.properties.filter((p) => p.id !== config.propertyId),
    loans: portfolio.loans.filter((l) => l.propertyId !== config.propertyId),
  };

  return {
    adjustedPortfolio,
    cgtResult,
    netProceeds,
    loanPayoff,
  };
}

export interface LoanState {
  id: string;
  propertyId: string;
  currentBalance: number;
  interestRate: number;
  repaymentAmount: number;
}

export interface PortfolioState {
  properties: PropertyState[];
  loans: LoanState[];
}

export interface ScenarioFactorInput {
  factorType: string;
  config: FactorConfig;
  startMonth: number;
  durationMonths?: number;
  // For sell_property factor
  propertyData?: PropertyForSale;
  marginalTaxRate?: number;
}

export interface MonthProjection {
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  incomeByProperty: Record<string, number>;
  expensesByProperty: Record<string, number>;
}

export function projectMonth(
  portfolio: PortfolioState,
  factors: ScenarioFactorInput[],
  month: number
): MonthProjection {
  let totalIncome = 0;
  let totalExpenses = 0;
  const incomeByProperty: Record<string, number> = {};
  const expensesByProperty: Record<string, number> = {};

  // Process each property
  for (const property of portfolio.properties) {
    let rent = property.monthlyRent;
    let expenses = property.monthlyExpenses;

    // Apply rent-affecting factors
    for (const factor of factors) {
      if (factor.factorType === "vacancy") {
        const config = factor.config as VacancyFactorConfig;
        if (config.propertyId === property.id) {
          const endMonth = factor.startMonth + config.months;
          if (month >= factor.startMonth && month < endMonth) {
            rent = 0;
          }
        }
      }

      if (factor.factorType === "rent_change") {
        const config = factor.config as RentChangeFactorConfig;
        if (!config.propertyId || config.propertyId === property.id) {
          if (month >= factor.startMonth) {
            rent = rent * (1 + config.changePercent / 100);
          }
        }
      }

      if (factor.factorType === "expense_change") {
        const config = factor.config as ExpenseChangeFactorConfig;
        if (month >= factor.startMonth) {
          expenses = expenses * (1 + config.changePercent / 100);
        }
      }
    }

    incomeByProperty[property.id] = rent;
    expensesByProperty[property.id] = expenses;
    totalIncome += rent;
    totalExpenses += expenses;
  }

  // Process loans
  for (const loan of portfolio.loans) {
    let interestRate = loan.interestRate;

    for (const factor of factors) {
      if (factor.factorType === "interest_rate" && month >= factor.startMonth) {
        const config = factor.config as InterestRateFactorConfig;
        if (config.applyTo === "all" || config.applyTo === loan.propertyId) {
          interestRate += config.changePercent;
        }
      }
    }

    const monthlyInterest = (loan.currentBalance * interestRate) / 100 / 12;
    totalExpenses += monthlyInterest;

    if (expensesByProperty[loan.propertyId]) {
      expensesByProperty[loan.propertyId] += monthlyInterest;
    }
  }

  return {
    month,
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    incomeByProperty,
    expensesByProperty,
  };
}

export interface SummaryMetrics {
  totalIncome: number;
  totalExpenses: number;
  totalNet: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  averageMonthlyNet: number;
  monthsWithNegativeCashFlow: number;
  lowestMonthNet: number;
  highestMonthNet: number;
}

export interface ProjectionResult {
  monthlyResults: MonthProjection[];
  summaryMetrics: SummaryMetrics;
}

export function runProjection(
  portfolio: PortfolioState,
  factors: ScenarioFactorInput[],
  timeHorizonMonths: number
): ProjectionResult {
  const monthlyResults: MonthProjection[] = [];

  // Track portfolio state that can change mid-projection (e.g., property sold)
  let currentPortfolio = { ...portfolio, properties: [...portfolio.properties], loans: [...portfolio.loans] };

  for (let month = 0; month < timeHorizonMonths; month++) {
    // Check for sell_property factors that settle this month
    for (const factor of factors) {
      if (factor.factorType === "sell_property") {
        const config = factor.config as SellPropertyFactorConfig;
        if (config.settlementMonth === month && factor.propertyData && factor.marginalTaxRate !== undefined) {
          const sellResult = applySellPropertyFactor(
            currentPortfolio,
            config,
            factor.propertyData,
            factor.marginalTaxRate
          );
          currentPortfolio = sellResult.adjustedPortfolio;
        }
      }
    }

    monthlyResults.push(projectMonth(currentPortfolio, factors, month));
  }

  const totalIncome = monthlyResults.reduce((sum, m) => sum + m.totalIncome, 0);
  const totalExpenses = monthlyResults.reduce((sum, m) => sum + m.totalExpenses, 0);
  const totalNet = totalIncome - totalExpenses;
  const monthsWithNegativeCashFlow = monthlyResults.filter((m) => m.netCashFlow < 0).length;
  const netCashFlows = monthlyResults.map((m) => m.netCashFlow);

  const summaryMetrics: SummaryMetrics = {
    totalIncome,
    totalExpenses,
    totalNet,
    averageMonthlyIncome: totalIncome / timeHorizonMonths,
    averageMonthlyExpenses: totalExpenses / timeHorizonMonths,
    averageMonthlyNet: totalNet / timeHorizonMonths,
    monthsWithNegativeCashFlow,
    lowestMonthNet: Math.min(...netCashFlows),
    highestMonthNet: Math.max(...netCashFlows),
  };

  return { monthlyResults, summaryMetrics };
}
