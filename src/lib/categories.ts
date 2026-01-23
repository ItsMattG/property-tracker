export type CategoryType = "income" | "expense" | "capital" | "other";

export interface CategoryInfo {
  value: string;
  label: string;
  type: CategoryType;
  isDeductible: boolean;
  atoReference?: string;
}

export const categories: CategoryInfo[] = [
  // Income
  { value: "rental_income", label: "Rental Income", type: "income", isDeductible: false },
  { value: "other_rental_income", label: "Other Rental Income", type: "income", isDeductible: false },

  // Expenses (Deductible)
  { value: "advertising", label: "Advertising for Tenants", type: "expense", isDeductible: true, atoReference: "D1" },
  { value: "body_corporate", label: "Body Corporate Fees", type: "expense", isDeductible: true, atoReference: "D2" },
  { value: "borrowing_expenses", label: "Borrowing Expenses", type: "expense", isDeductible: true, atoReference: "D3" },
  { value: "cleaning", label: "Cleaning", type: "expense", isDeductible: true, atoReference: "D4" },
  { value: "council_rates", label: "Council Rates", type: "expense", isDeductible: true, atoReference: "D5" },
  { value: "gardening", label: "Gardening & Lawn Mowing", type: "expense", isDeductible: true, atoReference: "D6" },
  { value: "insurance", label: "Insurance", type: "expense", isDeductible: true, atoReference: "D7" },
  { value: "interest_on_loans", label: "Interest on Loans", type: "expense", isDeductible: true, atoReference: "D8" },
  { value: "land_tax", label: "Land Tax", type: "expense", isDeductible: true, atoReference: "D9" },
  { value: "legal_expenses", label: "Legal Expenses", type: "expense", isDeductible: true, atoReference: "D10" },
  { value: "pest_control", label: "Pest Control", type: "expense", isDeductible: true, atoReference: "D11" },
  { value: "property_agent_fees", label: "Property Agent Fees", type: "expense", isDeductible: true, atoReference: "D12" },
  { value: "repairs_and_maintenance", label: "Repairs & Maintenance", type: "expense", isDeductible: true, atoReference: "D13" },
  { value: "capital_works_deductions", label: "Capital Works Deductions", type: "expense", isDeductible: true, atoReference: "D14" },
  { value: "stationery_and_postage", label: "Stationery & Postage", type: "expense", isDeductible: true, atoReference: "D15" },
  { value: "travel_expenses", label: "Travel Expenses", type: "expense", isDeductible: true, atoReference: "D16" },
  { value: "water_charges", label: "Water Charges", type: "expense", isDeductible: true, atoReference: "D17" },
  { value: "sundry_rental_expenses", label: "Sundry Rental Expenses", type: "expense", isDeductible: true, atoReference: "D18" },

  // Capital (CGT - not deductible as expenses)
  { value: "stamp_duty", label: "Stamp Duty", type: "capital", isDeductible: false },
  { value: "conveyancing", label: "Conveyancing", type: "capital", isDeductible: false },
  { value: "buyers_agent_fees", label: "Buyer's Agent Fees", type: "capital", isDeductible: false },
  { value: "initial_repairs", label: "Initial Repairs", type: "capital", isDeductible: false },

  // Other
  { value: "transfer", label: "Transfer", type: "other", isDeductible: false },
  { value: "personal", label: "Personal (Not Property)", type: "other", isDeductible: false },
  { value: "uncategorized", label: "Uncategorized", type: "other", isDeductible: false },
];

export const categoryMap = new Map(categories.map((c) => [c.value, c]));

export function getCategoryInfo(value: string): CategoryInfo | undefined {
  return categoryMap.get(value);
}

export function getCategoryLabel(value: string): string {
  return categoryMap.get(value)?.label ?? value;
}

export function getCategoriesByType(type: CategoryType): CategoryInfo[] {
  return categories.filter((c) => c.type === type);
}

export const incomeCategories = getCategoriesByType("income");
export const expenseCategories = getCategoriesByType("expense");
export const capitalCategories = getCategoriesByType("capital");
export const otherCategories = getCategoriesByType("other");
