export type BenchmarkStatus = "below" | "average" | "above";

export interface CategoryBenchmark {
  userAmount: number;
  averageAmount: number;
  status: BenchmarkStatus;
  potentialSavings: number;
  percentDiff: number; // positive = above average, negative = below
}

export interface ManagementFeeBenchmark extends CategoryBenchmark {
  userPercent: number;
  averagePercent: number;
}

export interface PropertyBenchmark {
  propertyId: string;
  insurance: CategoryBenchmark | null;
  councilRates: CategoryBenchmark | null;
  managementFees: ManagementFeeBenchmark | null;
  totalPotentialSavings: number;
}

export interface PortfolioBenchmarkSummary {
  totalPotentialSavings: number;
  insuranceSavings: number;
  councilRatesSavings: number;
  managementFeesSavings: number;
  propertiesWithSavings: number;
  totalProperties: number;
}
