import { randomBytes } from "crypto";

export interface PropertySnapshot {
  address?: string;
  suburb: string;
  state: string;
  currentValue?: number;
  totalLoans?: number;
  equity?: number;
  lvr?: number;
  cashFlow?: number;
  grossYield?: number;
  portfolioPercent: number;
}

export interface SummarySnapshot {
  propertyCount: number;
  states: string[];
  totalValue?: number;
  totalDebt?: number;
  totalEquity?: number;
  portfolioLVR?: number;
  cashFlow?: number;
  averageYield?: number;
  cashFlowPositive?: boolean;
}

export interface PortfolioSnapshot {
  generatedAt: string;
  summary: SummarySnapshot;
  properties?: PropertySnapshot[];
}

export type PrivacyMode = "full" | "summary" | "redacted";

export function generateShareToken(): string {
  return randomBytes(12).toString("base64url");
}

export function transformForPrivacy(
  snapshot: PortfolioSnapshot,
  mode: PrivacyMode
): PortfolioSnapshot {
  if (mode === "full") {
    return snapshot;
  }

  if (mode === "summary") {
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      // No properties array
    };
  }

  // Redacted mode
  const redactedSummary: SummarySnapshot = {
    propertyCount: snapshot.summary.propertyCount,
    states: snapshot.summary.states,
    portfolioLVR: snapshot.summary.portfolioLVR,
    averageYield: snapshot.summary.averageYield,
    cashFlowPositive: snapshot.summary.cashFlow !== undefined
      ? snapshot.summary.cashFlow >= 0
      : undefined,
  };

  const redactedProperties = snapshot.properties?.map((p) => ({
    suburb: p.suburb,
    state: p.state,
    lvr: p.lvr,
    grossYield: p.grossYield,
    portfolioPercent: p.portfolioPercent,
  }));

  return {
    generatedAt: snapshot.generatedAt,
    summary: redactedSummary,
    properties: redactedProperties,
  };
}
