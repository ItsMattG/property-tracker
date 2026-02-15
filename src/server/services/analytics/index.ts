// analytics services barrel

// benchmarking
export {
  getBenchmarkStatus,
  calculateInsuranceBenchmark,
  calculateCouncilRatesBenchmark,
  calculateManagementFeesBenchmark,
} from "./benchmarking";

// performance-benchmarking
export {
  calculatePercentile,
  calculateInvertedPercentile,
  getPercentileStatus,
  getScoreLabel,
  calculatePerformanceScore,
  generateInsights,
  isUnderperforming,
  buildCohortDescription,
} from "./performance-benchmarking";

// rental-yield
export {
  calculateGrossYield,
  calculateNetYield,
} from "./rental-yield";
