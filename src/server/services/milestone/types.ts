export type MilestoneCategory = "portfolio" | "engagement" | "tax";

export interface MilestoneDefinition {
  id: string;
  category: MilestoneCategory;
  label: string;
  description: string;
  check: (context: MilestoneContext) => boolean;
}

export interface MilestoneContext {
  propertyCount: number;
  totalEquity: number;
  monthsPositiveCashFlow: number;
  categorizedTransactionPercent: number;
  bankAccountsConnected: number;
  taxReportsGenerated: number;
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    id: "first-property",
    category: "portfolio",
    label: "First Property Added",
    description: "You've added your first investment property",
    check: (ctx) => ctx.propertyCount >= 1,
  },
  {
    id: "portfolio-3",
    category: "portfolio",
    label: "3 Properties",
    description: "Your portfolio has grown to 3 properties",
    check: (ctx) => ctx.propertyCount >= 3,
  },
  {
    id: "equity-100k",
    category: "portfolio",
    label: "Portfolio reached $100K equity",
    description: "Your total portfolio equity has crossed $100,000",
    check: (ctx) => ctx.totalEquity >= 100_000,
  },
  {
    id: "equity-500k",
    category: "portfolio",
    label: "Portfolio reached $500K equity",
    description: "Your total portfolio equity has crossed $500,000",
    check: (ctx) => ctx.totalEquity >= 500_000,
  },
  {
    id: "equity-1m",
    category: "portfolio",
    label: "Portfolio reached $1M equity",
    description: "Congratulations! Your portfolio equity has crossed $1,000,000",
    check: (ctx) => ctx.totalEquity >= 1_000_000,
  },
  {
    id: "positive-cashflow-12m",
    category: "portfolio",
    label: "12 months positive cash flow",
    description: "Congratulations on a full year of positive cash flow",
    check: (ctx) => ctx.monthsPositiveCashFlow >= 12,
  },
  {
    id: "all-categorized",
    category: "engagement",
    label: "All transactions categorised",
    description: "Every transaction is categorised for the current FY",
    check: (ctx) => ctx.categorizedTransactionPercent >= 100,
  },
  {
    id: "bank-connected",
    category: "engagement",
    label: "Bank feeds connected",
    description: "Your bank accounts are syncing automatically",
    check: (ctx) => ctx.bankAccountsConnected >= 1,
  },
  {
    id: "first-tax-report",
    category: "tax",
    label: "First tax report generated",
    description: "You've generated your first tax report",
    check: (ctx) => ctx.taxReportsGenerated >= 1,
  },
];
