// Transaction services barrel — populated as files are moved
export {
  categoryValues,
  deriveTransactionFields,
  type TransactionCategory,
  type TransactionType,
} from "./category";

export {
  calculateNextDates,
  generateExpectedTransactions,
  findMatchingTransactions,
  findMissedTransactions,
  detectPatterns,
  type Frequency,
  type ExpectedStatus,
  type GeneratedExpectedTransaction,
  type MatchResult,
  type MatchCandidate,
  type PatternSuggestion,
} from "./recurring";

export {
  getFinancialYearRange,
  calculateCategoryTotals,
  calculatePropertyMetrics,
  getFinancialYearTransactions,
  getPropertiesWithLoans,
  type TransactionInput,
  type FinancialYearRange,
  type PropertyMetrics,
  type CategoryTotal,
} from "./reports";

export {
  buildTaxForecast,
  computeCategoryForecast,
  computeConfidence,
  type MonthlyTotals,
  type Confidence,
  type CategoryForecast,
  type PropertyForecast,
  type TaxForecastResult,
} from "./tax-forecast";

export {
  generateAllSuggestions,
  generatePrepayInterestSuggestion,
  generateScheduleRepairsSuggestion,
  generateClaimDepreciationSuggestion,
  generateMissedDeductionSuggestions,
  getCurrentFinancialYear,
  isEofySeason,
  daysUntilEofy,
} from "./tax-optimization";

export {
  buildYoYComparison,
  computeChange,
  buildCategoryComparison,
  sortCategories,
  KEY_EXPENSES,
  type YoYCategoryComparison,
  type YoYPropertyBreakdown,
  type YoYComparisonResult,
} from "./yoy-comparison";
