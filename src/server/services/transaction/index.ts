// Transaction services barrel
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

export {
  buildAuditReport,
  computeAuditScore,
  checkMissingKeyExpenses,
  checkUncategorizedTransactions,
  checkLoanInterestMissing,
  checkMissedDeductions,
  checkUnassignedTransactions,
  checkLargeUnverified,
  checkNoRentalIncome,
  type AuditCheckResult,
  type AuditPropertyScore,
  type AuditReport,
} from "./audit-checks";

export {
  buildMyTaxReport,
  type MyTaxLineItem,
  type MyTaxPropertyReport,
  type MyTaxPersonalSummary,
  type MyTaxReport,
} from "./mytax";

export {
  calculateEquity,
  calculateLVR,
  calculateCashFlow,
  calculateGrossYield,
  calculateNetYield,
  findBestWorst,
  getDateRangeForPeriod,
} from "./portfolio";

export {
  formatTransactionsCSV,
  generateTransactionsCSV,
  generateAnnualSummaryCSV,
} from "./csv-export";

export { importCSVRows, importRichCSVRows } from "./import";
