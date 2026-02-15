// src/server/services/suburb-data.ts

import type { NewSuburbBenchmark } from "@/server/db/schema";

/**
 * Mock suburb benchmark data for development
 * In production, this would be fetched from Domain API
 */
const MOCK_SUBURB_DATA: Record<string, Partial<NewSuburbBenchmark>> = {
  // VIC suburbs
  "richmond-vic-house": {
    suburb: "Richmond",
    state: "VIC",
    postcode: "3121",
    propertyType: "house",
    medianRent: "650",
    rentalYield: "2.8",
    vacancyRate: "2.1",
    medianPrice: "1450000",
    priceGrowth1yr: "4.5",
    priceGrowth5yr: "32.0",
    sampleSize: 245,
    dataSource: "mock",
  },
  "richmond-vic-unit": {
    suburb: "Richmond",
    state: "VIC",
    postcode: "3121",
    propertyType: "unit",
    medianRent: "480",
    rentalYield: "3.8",
    vacancyRate: "2.5",
    medianPrice: "580000",
    priceGrowth1yr: "2.1",
    priceGrowth5yr: "18.0",
    sampleSize: 312,
    dataSource: "mock",
  },
  "fitzroy-vic-house": {
    suburb: "Fitzroy",
    state: "VIC",
    postcode: "3065",
    propertyType: "house",
    medianRent: "720",
    rentalYield: "2.5",
    vacancyRate: "1.8",
    medianPrice: "1680000",
    priceGrowth1yr: "5.2",
    priceGrowth5yr: "38.0",
    sampleSize: 89,
    dataSource: "mock",
  },
  // NSW suburbs
  "surry-hills-nsw-unit": {
    suburb: "Surry Hills",
    state: "NSW",
    postcode: "2010",
    propertyType: "unit",
    medianRent: "650",
    rentalYield: "3.2",
    vacancyRate: "2.0",
    medianPrice: "950000",
    priceGrowth1yr: "3.8",
    priceGrowth5yr: "25.0",
    sampleSize: 428,
    dataSource: "mock",
  },
  "parramatta-nsw-unit": {
    suburb: "Parramatta",
    state: "NSW",
    postcode: "2150",
    propertyType: "unit",
    medianRent: "520",
    rentalYield: "4.2",
    vacancyRate: "3.1",
    medianPrice: "620000",
    priceGrowth1yr: "1.5",
    priceGrowth5yr: "12.0",
    sampleSize: 567,
    dataSource: "mock",
  },
  // QLD suburbs
  "west-end-qld-unit": {
    suburb: "West End",
    state: "QLD",
    postcode: "4101",
    propertyType: "unit",
    medianRent: "550",
    rentalYield: "4.5",
    vacancyRate: "2.8",
    medianPrice: "580000",
    priceGrowth1yr: "6.2",
    priceGrowth5yr: "35.0",
    sampleSize: 234,
    dataSource: "mock",
  },
};

// Default benchmarks by state for fallback
const DEFAULT_BENCHMARKS: Record<string, Partial<NewSuburbBenchmark>> = {
  VIC: {
    medianRent: "550",
    rentalYield: "3.2",
    vacancyRate: "2.5",
    medianPrice: "850000",
    priceGrowth1yr: "3.5",
    priceGrowth5yr: "25.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
  NSW: {
    medianRent: "600",
    rentalYield: "2.8",
    vacancyRate: "2.2",
    medianPrice: "1100000",
    priceGrowth1yr: "4.0",
    priceGrowth5yr: "30.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
  QLD: {
    medianRent: "520",
    rentalYield: "4.0",
    vacancyRate: "2.8",
    medianPrice: "680000",
    priceGrowth1yr: "5.5",
    priceGrowth5yr: "40.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
  SA: {
    medianRent: "450",
    rentalYield: "4.5",
    vacancyRate: "1.8",
    medianPrice: "550000",
    priceGrowth1yr: "7.0",
    priceGrowth5yr: "45.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
  WA: {
    medianRent: "500",
    rentalYield: "4.2",
    vacancyRate: "2.0",
    medianPrice: "600000",
    priceGrowth1yr: "6.0",
    priceGrowth5yr: "35.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
};

export function getMockSuburbBenchmark(
  suburb: string,
  state: string,
  propertyType: string
): Partial<NewSuburbBenchmark> | null {
  const key = `${suburb.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}-${propertyType.toLowerCase()}`;

  if (MOCK_SUBURB_DATA[key]) {
    return MOCK_SUBURB_DATA[key];
  }

  // Fallback to state defaults
  const stateDefault = DEFAULT_BENCHMARKS[state];
  if (stateDefault) {
    return {
      ...stateDefault,
      suburb,
      state,
      postcode: "0000",
      propertyType,
    };
  }

  return null;
}
