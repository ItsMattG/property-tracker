export interface RentIncreaseRule {
  noticeDays: number;
  maxFrequency: string;
  fixedTermRule: string;
}

export const RENT_INCREASE_RULES: Record<string, RentIncreaseRule> = {
  NSW: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  VIC: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  QLD: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  SA: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "As per agreement",
  },
  WA: {
    noticeDays: 60,
    maxFrequency: "6 months",
    fixedTermRule: "Only if agreement allows",
  },
  TAS: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  NT: {
    noticeDays: 30,
    maxFrequency: "6 months",
    fixedTermRule: "Only at end of fixed term",
  },
  ACT: {
    noticeDays: 56,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
};

export type AustralianState = keyof typeof RENT_INCREASE_RULES;

export function getRentIncreaseRule(
  state: string
): RentIncreaseRule | undefined {
  return RENT_INCREASE_RULES[state];
}
