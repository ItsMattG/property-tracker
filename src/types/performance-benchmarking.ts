// src/types/performance-benchmarking.ts

export interface PercentileResult {
  value: number; // User's actual value
  median: number; // Suburb median
  percentile: number; // 0-100
  status: "excellent" | "good" | "average" | "below" | "poor";
}

export interface PerformanceInsight {
  type: "yield" | "growth" | "expense" | "vacancy";
  message: string;
  severity: "positive" | "neutral" | "warning" | "critical";
}

export interface PropertyPerformanceResult {
  propertyId: string;
  performanceScore: number; // 0-100
  scoreLabel: "Excellent" | "Good" | "Average" | "Below Average" | "Poor";

  yield: PercentileResult | null;
  growth: PercentileResult | null;
  expenses: PercentileResult | null;
  vacancy: PercentileResult | null;

  cohortDescription: string; // "3-bed houses in Richmond VIC"
  cohortSize: number;

  insights: PerformanceInsight[];
  isUnderperforming: boolean;
  calculatedAt: Date;
}

export interface PortfolioPerformanceSummary {
  totalProperties: number;
  averageScore: number;
  underperformingCount: number;
  topPerformer: { propertyId: string; address: string; score: number } | null;
  worstPerformer: { propertyId: string; address: string; score: number } | null;
}
