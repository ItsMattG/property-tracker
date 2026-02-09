/**
 * Client-safe financial year utilities.
 * Australian financial year runs July 1 to June 30.
 */

export interface FinancialYear {
  year: number; // ending year (e.g., 2026 for FY 2025-26)
  label: string; // "FY 2025-26"
  startDate: string; // "2025-07-01"
  endDate: string; // "2026-06-30"
}

/**
 * Get financial year range for a given ending year.
 * @param year The ending year (e.g., 2026 for FY 2025-26)
 */
export function getFinancialYear(year: number): FinancialYear {
  return {
    year,
    label: `FY ${year - 1}-${String(year).slice(-2)}`,
    startDate: `${year - 1}-07-01`,
    endDate: `${year}-06-30`,
  };
}

/**
 * Get the current financial year based on today's date.
 * If we're in Jan-Jun, the FY ending year is the current calendar year.
 * If we're in Jul-Dec, the FY ending year is the next calendar year.
 */
export function getCurrentFinancialYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0=Jan, 6=Jul)
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

/**
 * Get available financial years (current + N previous).
 */
export function getAvailableFinancialYears(count: number = 3): FinancialYear[] {
  const currentFY = getCurrentFinancialYear();
  return Array.from({ length: count }, (_, i) =>
    getFinancialYear(currentFY - i)
  );
}
