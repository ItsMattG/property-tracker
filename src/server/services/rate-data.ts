export type LoanPurpose = "owner_occupied" | "investor";
export type RepaymentType = "principal_and_interest" | "interest_only";

interface MarginTable {
  [purpose: string]: {
    [repaymentType: string]: {
      lowLvr: number;
      highLvr: number;
    };
  };
}

const MARGIN_TABLE: MarginTable = {
  owner_occupied: {
    principal_and_interest: { lowLvr: 2.0, highLvr: 2.3 },
    interest_only: { lowLvr: 2.4, highLvr: 2.7 },
  },
  investor: {
    principal_and_interest: { lowLvr: 2.3, highLvr: 2.6 },
    interest_only: { lowLvr: 2.6, highLvr: 2.9 },
  },
};

const LVR_THRESHOLD = 80;

export function getMargin(
  purpose: LoanPurpose,
  repaymentType: RepaymentType,
  lvr: number
): number {
  const rates = MARGIN_TABLE[purpose][repaymentType];
  return lvr <= LVR_THRESHOLD ? rates.lowLvr : rates.highLvr;
}
