// lending services barrel

// loan-pack
export {
  generateLoanPackToken,
  generateLoanPackSnapshot,
} from "./loan-pack";
export type { LoanPackSnapshot } from "./loan-pack";

// loan-comparison
export {
  calculateMonthlyPayment,
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
  generateAmortizationSchedule,
} from "./loan-comparison";
export type { AmortizationEntry } from "./loan-comparison";

// forecast-generation
export { generateForecastsForScenario } from "./forecast-generation";

// forecast
export {
  applyGrowthRate,
  calculateMonthlyLoanInterest,
  calculateMonthlyProjection,
  getForecastMonth,
  parseAssumptions,
  DEFAULT_ASSUMPTIONS,
} from "./forecast";
export type {
  ScenarioAssumptions,
  MonthlyProjection,
  ProjectionInput,
} from "./forecast";
