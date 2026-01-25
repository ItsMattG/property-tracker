export interface InterestRateFactorConfig {
  changePercent: number; // e.g., 2.0 means +2%
  applyTo: "all" | string; // "all" or specific propertyId
}

export interface VacancyFactorConfig {
  propertyId: string;
  months: number;
}

export interface RentChangeFactorConfig {
  changePercent: number; // e.g., -10 means -10%
  propertyId?: string; // null = all properties
}

export interface ExpenseChangeFactorConfig {
  changePercent: number;
  category?: string; // null = all categories
}

export interface SellPropertyFactorConfig {
  propertyId: string;
  salePrice: number;
  sellingCosts: number;
  settlementMonth: number;
}

export interface BuyPropertyFactorConfig {
  purchasePrice: number;
  deposit: number;
  loanAmount: number;
  interestRate: number;
  expectedRent: number;
  expectedExpenses: number;
  purchaseMonth: number;
}

export type FactorConfig =
  | InterestRateFactorConfig
  | VacancyFactorConfig
  | RentChangeFactorConfig
  | ExpenseChangeFactorConfig
  | SellPropertyFactorConfig
  | BuyPropertyFactorConfig;

export type FactorType =
  | "interest_rate"
  | "vacancy"
  | "sell_property"
  | "buy_property"
  | "rent_change"
  | "expense_change";

export function parseFactorConfig(factorType: FactorType, json: string): FactorConfig | null {
  try {
    return JSON.parse(json) as FactorConfig;
  } catch {
    return null;
  }
}

export function isValidFactorConfig(factorType: FactorType, config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;

  switch (factorType) {
    case "interest_rate":
      return typeof c.changePercent === "number" && (c.applyTo === "all" || typeof c.applyTo === "string");
    case "vacancy":
      return typeof c.propertyId === "string" && typeof c.months === "number" && c.months > 0;
    case "rent_change":
      return typeof c.changePercent === "number";
    case "expense_change":
      return typeof c.changePercent === "number";
    case "sell_property":
      return (
        typeof c.propertyId === "string" &&
        typeof c.salePrice === "number" &&
        typeof c.sellingCosts === "number" &&
        typeof c.settlementMonth === "number"
      );
    case "buy_property":
      return (
        typeof c.purchasePrice === "number" &&
        typeof c.loanAmount === "number" &&
        typeof c.interestRate === "number"
      );
    default:
      return false;
  }
}
