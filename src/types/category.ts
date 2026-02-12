// Shared category type that matches the schema enum
export const categoryValues = [
  "rental_income",
  "other_rental_income",
  "advertising",
  "body_corporate",
  "borrowing_expenses",
  "cleaning",
  "council_rates",
  "gardening",
  "insurance",
  "interest_on_loans",
  "land_tax",
  "legal_expenses",
  "pest_control",
  "property_agent_fees",
  "repairs_and_maintenance",
  "capital_works_deductions",
  "stationery_and_postage",
  "travel_expenses",
  "water_charges",
  "sundry_rental_expenses",
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
  "transfer",
  "personal",
  "uncategorized",
] as const;

export type Category = (typeof categoryValues)[number];

// Type guard for category validation
export function isValidCategory(value: string): value is Category {
  return categoryValues.includes(value as Category);
}

// Filter input type that accepts category or undefined
export interface TransactionFilterInput {
  propertyId?: string;
  category?: Category;
  startDate?: string;
  endDate?: string;
  isVerified?: boolean;
  bankAccountId?: string;
  limit?: number;
  offset?: number;
}
