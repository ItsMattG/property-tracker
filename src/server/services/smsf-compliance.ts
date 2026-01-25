// SMSF Compliance Constants and Calculations

export const CONTRIBUTION_CAPS = {
  concessional: 30000,
  nonConcessional: 120000,
  bringForward3Year: 360000,
} as const;

export const PENSION_MINIMUM_FACTORS: Record<string, number> = {
  "under65": 0.04,
  "65-74": 0.05,
  "75-79": 0.06,
  "80-84": 0.07,
  "85-89": 0.09,
  "90-94": 0.11,
  "95+": 0.14,
};

export function getAgeGroup(dateOfBirth: Date, asOfDate: Date = new Date()): string {
  const age = Math.floor(
    (asOfDate.getTime() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  if (age < 65) return "under65";
  if (age < 75) return "65-74";
  if (age < 80) return "75-79";
  if (age < 85) return "80-84";
  if (age < 90) return "85-89";
  if (age < 95) return "90-94";
  return "95+";
}

export function calculateMinimumPension(openingBalance: number, dateOfBirth: Date): number {
  const ageGroup = getAgeGroup(dateOfBirth);
  const factor = PENSION_MINIMUM_FACTORS[ageGroup];
  return Math.round(openingBalance * factor * 100) / 100;
}

export function getContributionCapStatus(
  concessional: number,
  nonConcessional: number
): { concessional: "ok" | "warning" | "breach"; nonConcessional: "ok" | "warning" | "breach" } {
  return {
    concessional:
      concessional > CONTRIBUTION_CAPS.concessional
        ? "breach"
        : concessional > CONTRIBUTION_CAPS.concessional * 0.9
        ? "warning"
        : "ok",
    nonConcessional:
      nonConcessional > CONTRIBUTION_CAPS.nonConcessional
        ? "breach"
        : nonConcessional > CONTRIBUTION_CAPS.nonConcessional * 0.9
        ? "warning"
        : "ok",
  };
}

export function getPensionDrawdownStatus(
  amountDrawn: number,
  minimumRequired: number,
  monthsElapsed: number
): "ok" | "warning" | "behind" {
  const proRataMinimum = (minimumRequired / 12) * monthsElapsed;
  if (amountDrawn >= proRataMinimum) return "ok";
  if (amountDrawn >= proRataMinimum * 0.8) return "warning";
  return "behind";
}

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // FY starts July 1
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

export function getMonthsElapsedInFY(): number {
  const now = new Date();
  const month = now.getMonth();
  // FY starts July (month 6)
  if (month >= 6) {
    return month - 6 + 1;
  }
  return month + 7;
}

export const DEFAULT_AUDIT_ITEMS = [
  "Investment strategy reviewed and documented",
  "Minutes of trustee meetings recorded",
  "Member statements issued",
  "Financial statements prepared",
  "Independent audit completed",
  "Annual return lodged with ATO",
  "Contribution caps verified for all members",
  "Pension minimum payments verified",
  "In-house asset test performed",
  "Related party transactions documented",
];
