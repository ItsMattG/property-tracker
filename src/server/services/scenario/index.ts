export {
  runProjection,
  projectMonth,
  applyInterestRateFactor,
  applyVacancyFactor,
  applyRentChangeFactor,
  applyExpenseChangeFactor,
  type PortfolioState,
  type PropertyState,
  type LoanState,
  type ScenarioFactorInput,
  type MonthProjection,
  type ProjectionResult,
  type SummaryMetrics,
} from "./projection";

export {
  parseFactorConfig,
  isValidFactorConfig,
  type FactorType,
  type FactorConfig,
  type InterestRateFactorConfig,
  type VacancyFactorConfig,
  type RentChangeFactorConfig,
  type ExpenseChangeFactorConfig,
  type SellPropertyFactorConfig,
  type BuyPropertyFactorConfig,
} from "./types";
