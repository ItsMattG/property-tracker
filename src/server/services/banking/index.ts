// Basiq API client
export { basiqService } from "./basiq";
export type {
  BasiqUser,
  BasiqConnection,
  BasiqAccount,
  BasiqTransaction,
} from "./basiq";

// Bank sync utilities
export {
  checkRateLimit,
  calculateRetryAfter,
  mapBasiqErrorToAlertType,
  mapAlertTypeToConnectionStatus,
  RATE_LIMIT_MINUTES,
} from "./sync";
export type { RateLimitResult, AlertType } from "./sync";

// Connection alert utilities
export {
  shouldCreateAlert,
  shouldSendEmail,
  formatAlertForEmail,
} from "./alerts";

// Anomaly detection
export {
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  detectMissedRent,
  calculateSimilarity,
  getHistoricalAverage,
  getKnownMerchants,
} from "./anomaly";

// AI categorization
export {
  batchCategorize,
  categorizeTransaction,
  categorizeWithClaude,
  getMerchantCategory,
  getRecentExamples,
  updateMerchantMemory,
  normalizeMerchantName,
  buildCategorizationPrompt,
  parseCategorizationResponse,
} from "./categorization";
export type { CategorizationResult, RuleMatchResult, Example } from "./categorization";

// Rule matcher
export { matchTransaction } from "./rule-matcher";
export type { TransactionInput } from "./rule-matcher";

// CSV import
export {
  parseCSV,
  parseRichCSV,
  parseCSVHeaders,
  splitCSVLine,
  sanitizeField,
  matchCategory,
  matchTransactionType,
  parseBooleanField,
  csvRowSchema,
} from "./csv-import";
export type { CSVRow, CSVColumnMap, ParsedCSVRow } from "./csv-import";
