// src/server/services/vector-generation.ts
import type { PropertyVectorInput } from "@/types/similar-properties";

// State encoding: ordered by typical property prices
const STATE_ORDER = ["TAS", "SA", "NT", "WA", "QLD", "VIC", "ACT", "NSW"];

// Price tier thresholds
const PRICE_TIERS = {
  budget: 500000,
  mid: 1000000,
  premium: 2000000,
};

export function normalizePropertyType(type: string): number {
  switch (type.toLowerCase()) {
    case "house":
      return 0.0;
    case "townhouse":
      return 0.5;
    case "unit":
    case "apartment":
      return 1.0;
    default:
      return 0.5;
  }
}

export function normalizeLocationCluster(
  state: string,
  medianPrice: number
): number {
  // State component (0-0.5)
  const stateIndex = STATE_ORDER.indexOf(state.toUpperCase());
  const stateComponent = stateIndex >= 0 ? (stateIndex / (STATE_ORDER.length - 1)) * 0.5 : 0.25;

  // Price tier component (0-0.5)
  let tierComponent: number;
  if (medianPrice < PRICE_TIERS.budget) {
    tierComponent = 0.0;
  } else if (medianPrice < PRICE_TIERS.mid) {
    tierComponent = 0.15;
  } else if (medianPrice < PRICE_TIERS.premium) {
    tierComponent = 0.35;
  } else {
    tierComponent = 0.5;
  }

  return Math.min(1, stateComponent + tierComponent);
}

export function normalizePriceBracket(price: number): number {
  // Log scale normalization for price (handles wide range)
  // $100k -> 0, $5M -> 1
  const minLog = Math.log10(100000);
  const maxLog = Math.log10(5000000);
  const priceLog = Math.log10(Math.max(100000, Math.min(5000000, price)));

  return (priceLog - minLog) / (maxLog - minLog);
}

export function normalizeYield(yieldPercent: number): number {
  // Yields typically range 0-10%, normalize to 0-1
  return Math.min(1, Math.max(0, yieldPercent / 10));
}

export function normalizeGrowth(growthPercent: number): number {
  // Growth typically ranges -10% to +10%, normalize to 0-1
  // 0% growth = 0.5
  return Math.min(1, Math.max(0, (growthPercent + 10) / 20));
}

export function generatePropertyVector(input: PropertyVectorInput): number[] {
  return [
    normalizeLocationCluster(input.state, input.currentValue),
    normalizePropertyType(input.propertyType),
    normalizePriceBracket(input.currentValue),
    normalizeYield(input.grossYield),
    normalizeGrowth(input.capitalGrowthRate),
  ];
}

export function calculateSimilarityScore(distance: number): number {
  // Convert L2 distance to similarity percentage
  // Distance 0 = 100% similar, Distance 2 (max for normalized vectors) = 0%
  const maxDistance = Math.sqrt(5); // Max possible distance for 5D unit vectors
  const similarity = Math.max(0, 1 - distance / maxDistance);
  return Math.round(similarity * 100);
}

export function getPriceBracketLabel(price: number): string {
  if (price < 400000) return "Under $400k";
  if (price < 700000) return "$400k-$700k";
  if (price < 1000000) return "$700k-$1M";
  if (price < 1500000) return "$1M-$1.5M";
  if (price < 2000000) return "$1.5M-$2M";
  return "Over $2M";
}
