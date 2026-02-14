import { ExternalServiceError } from "@/server/errors";

export interface ValuationResult {
  estimatedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
  source: string;
}

export interface ValuationInput {
  propertyId: string;
  purchasePrice: number;
  purchaseDate: string; // ISO date string e.g. "2020-01-15"
  address: string;
  propertyType: string;
}

export interface ValuationProvider {
  getValuation(input: ValuationInput, targetDate?: Date): Promise<ValuationResult | null>;
  getName(): string;
}

// Deterministic hash for reproducible noise
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Returns a deterministic noise value in range [-0.002, +0.002] for a given property+month
function monthlyNoise(propertyId: string, monthIndex: number): number {
  const hash = hashString(`${propertyId}-month-${monthIndex}`);
  return ((hash % 401) - 200) / 100000; // range: -0.002 to +0.002
}

export class MockValuationProvider implements ValuationProvider {
  getName(): string {
    return "mock";
  }

  async getValuation(
    input: ValuationInput,
    targetDate?: Date
  ): Promise<ValuationResult | null> {
    const { propertyId, purchasePrice, purchaseDate } = input;

    if (purchasePrice <= 0) return null;

    const start = new Date(purchaseDate);
    const end = targetDate ?? new Date();
    const monthsElapsed = (end.getFullYear() - start.getFullYear()) * 12
      + (end.getMonth() - start.getMonth());

    if (monthsElapsed < 0) return null;

    const annualGrowthRate = 0.06;
    const monthlyBase = annualGrowthRate / 12;

    // Compound monthly with deterministic noise
    let value = purchasePrice;
    for (let i = 1; i <= monthsElapsed; i++) {
      const noise = monthlyNoise(propertyId, i);
      value *= (1 + monthlyBase + noise);
    }

    const estimatedValue = Math.round(value);
    const confidenceLow = Math.round(value * 0.92);
    const confidenceHigh = Math.round(value * 1.08);

    return { estimatedValue, confidenceLow, confidenceHigh, source: "mock" };
  }

  // Generate monthly valuations from purchase date to today
  async generateHistory(
    input: ValuationInput
  ): Promise<Array<ValuationResult & { valueDate: string }>> {
    const { purchaseDate } = input;
    const start = new Date(purchaseDate);
    const now = new Date();
    const results: Array<ValuationResult & { valueDate: string }> = [];

    // Start from purchase month
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= now) {
      const result = await this.getValuation(input, current);
      if (result) {
        const valueDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
        results.push({ ...result, valueDate });
      }
      current.setMonth(current.getMonth() + 1);
    }

    return results;
  }
}

export function getValuationProvider(): ValuationProvider {
  const provider = process.env.VALUATION_PROVIDER;

  if (provider === "corelogic") {
    throw new ExternalServiceError("CoreLogic provider not implemented", "corelogic");
  }

  if (provider === "proptrack") {
    throw new ExternalServiceError("PropTrack provider not implemented", "proptrack");
  }

  return new MockValuationProvider();
}
