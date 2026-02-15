/**
 * Transaction category constants, types, and derivation logic.
 *
 * This is the canonical definition of category values and the rules
 * for deriving transactionType + isDeductible from a category.
 */

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

export type TransactionCategory = (typeof categoryValues)[number];

export type TransactionType =
  | "income"
  | "expense"
  | "capital"
  | "transfer"
  | "personal";

const incomeCategories: readonly TransactionCategory[] = [
  "rental_income",
  "other_rental_income",
];

const capitalCategories: readonly TransactionCategory[] = [
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
];

const nonDeductibleCategories: readonly TransactionCategory[] = [
  ...capitalCategories,
  "transfer",
  "personal",
  "uncategorized",
];

/** Derive transaction type and deductibility from a category. */
export function deriveTransactionFields(category: TransactionCategory): {
  transactionType: TransactionType;
  isDeductible: boolean;
} {
  let transactionType: TransactionType = "expense";
  if (incomeCategories.includes(category)) {
    transactionType = "income";
  } else if (capitalCategories.includes(category)) {
    transactionType = "capital";
  } else if (category === "transfer") {
    transactionType = "transfer";
  } else if (category === "personal") {
    transactionType = "personal";
  }

  const isDeductible = !nonDeductibleCategories.includes(category);

  return { transactionType, isDeductible };
}
