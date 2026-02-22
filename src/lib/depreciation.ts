type DepreciationMethod = "diminishing_value" | "prime_cost";

/**
 * Client-side depreciation preview calculation.
 * Used for instant UI feedback when editing asset fields.
 * Server recalculates authoritatively on save.
 */
export function calculateYearlyDeduction(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod
): number {
  if (originalCost <= 0 || effectiveLife <= 0) return 0;

  if (method === "prime_cost") {
    return Math.round((originalCost / effectiveLife) * 100) / 100;
  }

  // Diminishing value: 200% rate
  return Math.round(((originalCost * 2) / effectiveLife) * 100) / 100;
}
