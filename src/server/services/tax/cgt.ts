export const CAPITAL_CATEGORIES = [
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
];

export interface CapitalTransaction {
  category: string;
  amount: string;
}

export interface SellingCosts {
  agentCommission: number;
  legalFees: number;
  marketingCosts: number;
  otherSellingCosts: number;
}

export interface CapitalGainInput {
  costBase: number;
  salePrice: number;
  sellingCosts: SellingCosts;
  purchaseDate: string;
  settlementDate: string;
}

export interface CapitalGainResult {
  costBase: number;
  salePrice: number;
  totalSellingCosts: number;
  netProceeds: number;
  capitalGain: number;
  discountedGain: number;
  heldOverTwelveMonths: boolean;
}

/**
 * Calculate months between two dates
 */
export function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  return years * 12 + months;
}

/**
 * Calculate cost base from purchase price and capital transactions
 * Cost base = Purchase Price + Acquisition Costs
 */
export function calculateCostBase(
  purchasePrice: string,
  capitalTransactions: CapitalTransaction[]
): number {
  const baseCost = Number(purchasePrice);

  const acquisitionCosts = capitalTransactions
    .filter((t) => CAPITAL_CATEGORIES.includes(t.category))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return baseCost + acquisitionCosts;
}

/**
 * Calculate capital gain/loss from property sale
 * - 50% CGT discount applies if held >= 12 months AND gain is positive
 * - Capital losses are NOT discounted
 */
export function calculateCapitalGain(input: CapitalGainInput): CapitalGainResult {
  const { costBase, salePrice, sellingCosts, purchaseDate, settlementDate } = input;

  const totalSellingCosts =
    sellingCosts.agentCommission +
    sellingCosts.legalFees +
    sellingCosts.marketingCosts +
    sellingCosts.otherSellingCosts;

  const netProceeds = salePrice - totalSellingCosts;
  const capitalGain = netProceeds - costBase;

  const heldMonths = monthsBetween(purchaseDate, settlementDate);
  const heldOverTwelveMonths = heldMonths >= 12;

  // 50% discount only if held >= 12 months AND gain is positive
  const discountedGain =
    heldOverTwelveMonths && capitalGain > 0
      ? capitalGain * 0.5
      : capitalGain;

  return {
    costBase,
    salePrice,
    totalSellingCosts,
    netProceeds,
    capitalGain,
    discountedGain,
    heldOverTwelveMonths,
  };
}
