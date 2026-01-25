import type { TransactionCategory } from "../types";

export interface MerchantData {
  name: string;
  category: TransactionCategory;
  amountRange: { min: number; max: number };
  frequency: "monthly" | "quarterly" | "annual" | "sporadic";
}

// Realistic merchants for demo mode
export const demoMerchants: MerchantData[] = [
  // Income
  { name: "REA Group - Rental Income", category: "rental_income", amountRange: { min: 2500, max: 3500 }, frequency: "monthly" },
  // Quarterly expenses
  { name: "Sydney Water Corporation", category: "water_charges", amountRange: { min: 150, max: 300 }, frequency: "quarterly" },
  { name: "City of Sydney Council", category: "council_rates", amountRange: { min: 400, max: 600 }, frequency: "quarterly" },
  // Annual expenses
  { name: "Allianz Insurance", category: "insurance", amountRange: { min: 1200, max: 2000 }, frequency: "annual" },
  { name: "Revenue NSW - Land Tax", category: "land_tax", amountRange: { min: 800, max: 1500 }, frequency: "annual" },
  { name: "Ray White Property Management", category: "property_agent_fees", amountRange: { min: 200, max: 400 }, frequency: "monthly" },
  // Sporadic expenses
  { name: "Jim's Mowing", category: "gardening", amountRange: { min: 80, max: 150 }, frequency: "sporadic" },
  { name: "Fantastic Cleaners", category: "cleaning", amountRange: { min: 150, max: 300 }, frequency: "sporadic" },
  { name: "Local Plumber Co", category: "repairs_and_maintenance", amountRange: { min: 200, max: 800 }, frequency: "sporadic" },
  { name: "Bunnings Warehouse", category: "repairs_and_maintenance", amountRange: { min: 50, max: 200 }, frequency: "sporadic" },
  { name: "Strata Plan 12345", category: "body_corporate", amountRange: { min: 800, max: 1500 }, frequency: "quarterly" },
];

// Fake merchants for dev mode
export const devMerchants: MerchantData[] = [
  { name: "Test Rental Income", category: "rental_income", amountRange: { min: 2000, max: 2000 }, frequency: "monthly" },
  { name: "Test Water", category: "water_charges", amountRange: { min: 200, max: 200 }, frequency: "quarterly" },
  { name: "Test Council", category: "council_rates", amountRange: { min: 500, max: 500 }, frequency: "quarterly" },
  { name: "Test Insurance", category: "insurance", amountRange: { min: 1500, max: 1500 }, frequency: "annual" },
  { name: "Test Repairs", category: "repairs_and_maintenance", amountRange: { min: 300, max: 300 }, frequency: "sporadic" },
];
