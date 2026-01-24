export interface ValuationResult {
  estimatedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
  source: string;
}

export interface ValuationProvider {
  getValuation(
    address: string,
    propertyType: string
  ): Promise<ValuationResult | null>;
  getName(): string;
}

// Simple hash function for deterministic values
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Detect capital city from address
function isCapitalCity(address: string): boolean {
  const capitalCities = [
    "sydney",
    "melbourne",
    "brisbane",
    "perth",
    "adelaide",
    "hobart",
    "darwin",
    "canberra",
  ];
  const lowerAddress = address.toLowerCase();
  return capitalCities.some((city) => lowerAddress.includes(city));
}

export class MockValuationProvider implements ValuationProvider {
  getName(): string {
    return "mock";
  }

  async getValuation(
    address: string,
    propertyType: string
  ): Promise<ValuationResult | null> {
    // Simulate occasional failures
    if (address.includes("FAIL")) {
      return null;
    }

    // Base value depends on location
    const baseValue = isCapitalCity(address) ? 900000 : 450000;

    // Use hash for deterministic variation (±20%)
    const hash = hashString(address + propertyType);
    const variation = (hash % 40) - 20; // -20 to +19
    const estimatedValue = Math.round(baseValue * (1 + variation / 100));

    // Confidence range ±7.5%
    const confidenceLow = Math.round(estimatedValue * 0.925);
    const confidenceHigh = Math.round(estimatedValue * 1.075);

    return {
      estimatedValue,
      confidenceLow,
      confidenceHigh,
      source: "mock",
    };
  }
}

export function getValuationProvider(): ValuationProvider {
  const provider = process.env.VALUATION_PROVIDER;

  if (provider === "corelogic") {
    throw new Error("CoreLogic provider not implemented");
  }

  if (provider === "proptrack") {
    throw new Error("PropTrack provider not implemented");
  }

  return new MockValuationProvider();
}
