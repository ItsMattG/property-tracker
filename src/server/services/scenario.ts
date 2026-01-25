// Scenario projection engine for what-if financial modeling

// Factor config types
export interface InterestRateFactorConfig {
  changePercent: number;
  applyTo: "all" | string; // "all" or propertyId
}

export interface VacancyFactorConfig {
  propertyId: string;
  months: number;
}

export interface RentChangeFactorConfig {
  changePercent: number;
  propertyId?: string;
}

export interface ExpenseChangeFactorConfig {
  changePercent: number;
  category?: string;
}

export type FactorConfig =
  | InterestRateFactorConfig
  | VacancyFactorConfig
  | RentChangeFactorConfig
  | ExpenseChangeFactorConfig
  | Record<string, unknown>;

// Portfolio state types
export interface PropertyState {
  id: string;
  monthlyRent: number;
  monthlyExpenses: number;
}

export interface LoanState {
  id: string;
  propertyId: string | null;
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
}

export interface MonthProjection {
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  incomeByProperty: Record<string, number>;
  expensesByProperty: Record<string, number>;
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

/**
 * Project a single month's cash flow based on portfolio state and active factors
 */
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

    if (loan.propertyId && expensesByProperty[loan.propertyId]) {
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

/**
 * Run full projection over specified time horizon
 */
export function runProjection(
  portfolio: PortfolioState,
  factors: ScenarioFactorInput[],
  timeHorizonMonths: number
): ProjectionResult {
  const monthlyResults: MonthProjection[] = [];

  for (let month = 0; month < timeHorizonMonths; month++) {
    monthlyResults.push(projectMonth(portfolio, factors, month));
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
    lowestMonthNet: netCashFlows.length > 0 ? Math.min(...netCashFlows) : 0,
    highestMonthNet: netCashFlows.length > 0 ? Math.max(...netCashFlows) : 0,
  };

  return { monthlyResults, summaryMetrics };
}
