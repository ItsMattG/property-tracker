export interface BankData {
  institution: string;
  accountTypes: ("transaction" | "savings" | "mortgage" | "offset")[];
}

// Real Australian banks for demo mode
export const demoBanks: BankData[] = [
  { institution: "Commonwealth Bank", accountTypes: ["transaction", "savings", "offset"] },
  { institution: "ANZ", accountTypes: ["transaction", "savings"] },
  { institution: "Westpac", accountTypes: ["transaction", "mortgage"] },
  { institution: "NAB", accountTypes: ["transaction", "savings"] },
];

// Fake bank for dev mode
export const devBanks: BankData[] = [
  { institution: "Dev Bank Australia", accountTypes: ["transaction", "savings", "offset"] },
];

export interface LenderData {
  name: string;
  rateRange: { min: number; max: number };
}

export const demoLenders: LenderData[] = [
  { name: "Commonwealth Bank", rateRange: { min: 6.0, max: 6.5 } },
  { name: "ANZ", rateRange: { min: 6.1, max: 6.6 } },
  { name: "Westpac", rateRange: { min: 5.9, max: 6.4 } },
];

export const devLenders: LenderData[] = [
  { name: "Test Lender", rateRange: { min: 6.0, max: 6.0 } },
];
