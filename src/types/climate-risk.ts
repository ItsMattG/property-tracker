export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface ClimateRisk {
  floodRisk: RiskLevel;
  bushfireRisk: RiskLevel;
  overallRisk: RiskLevel;
  fetchedAt: string;
}
