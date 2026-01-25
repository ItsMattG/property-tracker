export type SeedMode = "demo" | "dev" | "test";

export interface SeedOptions {
  clerkId: string;
  mode: SeedMode;
  clean?: boolean;
  force?: boolean;
}

export interface SeedSummary {
  users: number;
  properties: number;
  bankAccounts: number;
  transactions: number;
  loans: number;
  alerts: number;
  complianceRecords: number;
}

export interface SeedContext {
  userId: string;
  mode: SeedMode;
  startDate: Date;
  endDate: Date;
}

export interface PropertySeedConfig {
  address: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  postcode: string;
  purchasePrice: number;
  purchaseDate: Date;
  entityName?: string;
  status?: "active" | "sold";
  soldAt?: Date;
}

export interface LoanSeedConfig {
  propertyId: string;
  lender: string;
  loanType: "principal_and_interest" | "interest_only";
  rateType: "variable" | "fixed";
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  fixedRateExpiry?: Date;
  repaymentAmount: number;
  repaymentFrequency: string;
}

export interface TransactionPattern {
  merchantName: string;
  category: string;
  transactionType: "income" | "expense";
  frequency: "monthly" | "quarterly" | "annual" | "sporadic";
  amountRange: { min: number; max: number };
  dayOfMonth?: number;
}
