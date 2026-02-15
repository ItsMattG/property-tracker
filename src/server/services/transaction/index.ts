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
