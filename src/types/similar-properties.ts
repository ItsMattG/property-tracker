// src/types/similar-properties.ts

export interface PropertyVectorInput {
  state: string;
  suburb: string;
  propertyType: "house" | "townhouse" | "unit";
  currentValue: number;
  grossYield: number;
  capitalGrowthRate: number;
}

export interface SimilarProperty {
  id: string;
  type: "portfolio" | "external" | "community";
  suburb: string;
  state: string;
  propertyType: "house" | "townhouse" | "unit";
  priceBracket: string;
  yield: number | null;
  growth: number | null;
  distance: number;
  similarityScore: number; // 0-100
  isEstimated: boolean;
  // Only for portfolio properties
  propertyId?: string;
  address?: string;
  // Only for external listings
  externalListingId?: string;
  sourceUrl?: string;
}

export interface ExtractedListingData {
  address?: string;
  suburb: string;
  state: string;
  postcode: string;
  price?: number;
  propertyType: "house" | "townhouse" | "unit";
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  landSize?: number;
  estimatedRent?: number;
  features?: string[];
}

export type ShareLevel = "none" | "anonymous" | "pseudonymous" | "controlled";

export interface SharingPreferences {
  defaultShareLevel: ShareLevel;
  defaultSharedAttributes: string[];
}

export const SHAREABLE_ATTRIBUTES = [
  "suburb",
  "state",
  "propertyType",
  "priceBracket",
  "yield",
  "growth",
  "address",
  "purchasePrice",
  "username",
] as const;

export type ShareableAttribute = (typeof SHAREABLE_ATTRIBUTES)[number];
