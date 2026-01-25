import type { RiskLevel, ClimateRisk } from "@/types/climate-risk";
import { climateRiskData } from "../data/climate-risk-data";

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "extreme"];

export function calculateOverallRisk(
  floodRisk: RiskLevel,
  bushfireRisk: RiskLevel
): RiskLevel {
  const floodIndex = RISK_LEVELS.indexOf(floodRisk);
  const bushfireIndex = RISK_LEVELS.indexOf(bushfireRisk);
  return RISK_LEVELS[Math.max(floodIndex, bushfireIndex)];
}

export function getClimateRisk(postcode: string): ClimateRisk {
  // Validate postcode format (4 digits for Australia)
  if (!/^\d{4}$/.test(postcode)) {
    return {
      floodRisk: "low",
      bushfireRisk: "low",
      overallRisk: "low",
      fetchedAt: new Date().toISOString(),
    };
  }

  const riskData = climateRiskData[postcode];

  if (!riskData) {
    return {
      floodRisk: "low",
      bushfireRisk: "low",
      overallRisk: "low",
      fetchedAt: new Date().toISOString(),
    };
  }

  const floodRisk = riskData.flood;
  const bushfireRisk = riskData.bushfire;
  const overallRisk = calculateOverallRisk(floodRisk, bushfireRisk);

  return {
    floodRisk,
    bushfireRisk,
    overallRisk,
    fetchedAt: new Date().toISOString(),
  };
}
