// property-analysis services barrel

// document-extraction
export {
  extractDocument,
  buildExtractionPrompt,
  getDocumentContent,
  getMediaType,
  parseExtractionResponse,
  EXTRACTION_PROMPT_BASE,
} from "./document-extraction";
export type {
  LineItem,
  ExtractedData,
  ExtractionResult,
} from "./document-extraction";

// depreciation-extract
export {
  extractDepreciationSchedule,
} from "./depreciation-extract";
export type { ExtractedAsset } from "./depreciation-extract";
// Note: ExtractionResult type in depreciation-extract conflicts with document-extraction.
// Import directly from ./depreciation-extract if the depreciation-specific version is needed.

// listing-extraction
export {
  extractListingData,
  detectInputType,
} from "./listing-extraction";
// Note: buildExtractionPrompt and ExtractionResult names conflict with document-extraction.
// Import directly from ./listing-extraction if the listing-specific versions are needed.

// settlement-extract
export {
  extractSettlement,
  parseSettlementResponse,
  SETTLEMENT_EXTRACTION_PROMPT,
} from "./settlement-extract";
export type {
  SettlementAdjustment,
  SettlementExtractedData,
} from "./settlement-extract";

// valuation
export {
  MockValuationProvider,
  getValuationProvider,
} from "./valuation";
export type {
  ValuationResult,
  ValuationInput,
  ValuationProvider,
} from "./valuation";

// property-matcher
export {
  normalizeAddress,
  matchPropertyByAddress,
} from "./property-matcher";

// suburb-data
export { getMockSuburbBenchmark } from "./suburb-data";

// climate-risk
export {
  calculateOverallRisk,
  getClimateRisk,
} from "./climate-risk";

// duplicate-detection
export { findPotentialDuplicate } from "./duplicate-detection";

// vector-generation
export {
  normalizePropertyType,
  normalizeLocationCluster,
  normalizePriceBracket,
  normalizeYield,
  normalizeGrowth,
  generatePropertyVector,
  calculateSimilarityScore,
  getPriceBracketLabel,
} from "./vector-generation";
