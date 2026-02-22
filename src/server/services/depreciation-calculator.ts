/**
 * Depreciation Calculation Engine — Pure Stateless Functions
 *
 * Implements Australian tax rules for:
 * - Div 40: Plant & Equipment (diminishing value + prime cost)
 * - Div 43: Capital Works (2.5% per year, 40-year cap)
 * - Low-Value Pool (18.75% opening + 37.5% additions)
 *
 * All functions are pure with zero database access.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface ProjectionAsset {
  id: string;
  cost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  purchaseDate: Date;
  poolType: "individual" | "low_value" | "immediate_writeoff";
}

export interface ProjectionCapitalWork {
  id: string;
  constructionCost: number;
  constructionDate: Date;
  claimStartDate: Date;
}

export interface ProjectionRow {
  financialYear: number;
  div40Total: number;
  div43Total: number;
  lowValuePoolTotal: number;
  grandTotal: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Returns the financial year integer for a given date.
 * Australian FY runs Jul 1 to Jun 30.
 * Month >= 6 (July, 0-indexed) means the date is in the FY ending next calendar year.
 *
 * Examples:
 * - Jul 1 2025 -> FY 2026
 * - Mar 1 2026 -> FY 2026
 * - Jun 30 2025 -> FY 2025
 */
export function getCurrentFinancialYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed: 0=Jan, 6=Jul
  const year = date.getFullYear();
  return month >= 6 ? year + 1 : year;
}

/**
 * Days from purchase date to June 30 of that financial year (inclusive).
 * Minimum 1 day.
 */
export function daysInFirstFY(purchaseDate: Date): number {
  const fy = getCurrentFinancialYear(purchaseDate);
  // FY ends on June 30 of the FY year
  const fyEnd = new Date(fy, 5, 30); // June 30
  const diffMs = fyEnd.getTime() - purchaseDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 inclusive
  return Math.max(days, 1);
}

// ─── Div 40: Plant & Equipment ────────────────────────────────────

interface Div40Params {
  cost: number;
  effectiveLife: number;
  yearIndex: number;
  daysFirstYear: number;
}

/**
 * Diminishing Value method.
 * Rate = 200% / effectiveLife
 * Each year: writtenDownValue * rate
 * Year 0 is pro-rated by daysFirstYear/365.
 * Returns 0 when fully depreciated.
 */
export function calculateDiminishingValue({
  cost,
  effectiveLife,
  yearIndex,
  daysFirstYear,
}: Div40Params): number {
  const rate = 2 / effectiveLife;
  let wdv = cost;

  for (let y = 0; y <= yearIndex; y++) {
    if (wdv < 1) return 0; // Treat sub-dollar residuals as fully depreciated

    const yearDeduction =
      y === 0 ? wdv * rate * (daysFirstYear / 365) : wdv * rate;

    const rounded = round2(yearDeduction);

    if (y === yearIndex) {
      return rounded;
    }

    wdv = round2(wdv - rounded);
  }

  return 0;
}

/**
 * Prime Cost method.
 * Annual = cost / effectiveLife
 * Year 0 is pro-rated by daysFirstYear/365.
 * Subsequent years: flat annual deduction.
 * Cannot deduct more than remaining value.
 * Returns 0 past effective life.
 */
export function calculatePrimeCost({
  cost,
  effectiveLife,
  yearIndex,
  daysFirstYear,
}: Div40Params): number {
  const annual = cost / effectiveLife;
  let totalDeducted = 0;

  for (let y = 0; y <= yearIndex; y++) {
    const remaining = round2(cost - totalDeducted);
    if (remaining <= 0.01) return 0;

    const yearDeduction =
      y === 0 ? annual * (daysFirstYear / 365) : Math.min(annual, remaining);

    const rounded = round2(yearDeduction);

    if (y === yearIndex) {
      return Math.min(rounded, remaining);
    }

    totalDeducted += rounded;
  }

  return 0;
}

// ─── Low-Value Pool ───────────────────────────────────────────────

interface LowValuePoolParams {
  openingBalance: number;
  additions: number;
}

/**
 * Low-value pool deduction.
 * 18.75% of opening balance + 37.5% of additions.
 */
export function calculateLowValuePoolDeduction({
  openingBalance,
  additions,
}: LowValuePoolParams): number {
  return round2(openingBalance * 0.1875 + additions * 0.375);
}

// ─── Div 43: Capital Works ────────────────────────────────────────

interface CapitalWorksParams {
  constructionCost: number;
  constructionDate: Date;
  claimStartDate: Date;
  financialYear: number;
}

/**
 * Capital works deduction (Div 43).
 * 2.5% of construction cost per year.
 * First year pro-rated from claim start date to Jun 30.
 * 0 after 40 years from construction.
 * 0 before claim start FY.
 */
export function calculateCapitalWorksDeduction({
  constructionCost,
  constructionDate,
  claimStartDate,
  financialYear,
}: CapitalWorksParams): number {
  const constructionFY = getCurrentFinancialYear(constructionDate);
  const claimStartFY = getCurrentFinancialYear(claimStartDate);

  // 0 before claim start FY
  if (financialYear < claimStartFY) return 0;

  // 0 after 40 years from construction
  if (financialYear - constructionFY >= 40) return 0;

  const annual = round2(constructionCost * 0.025);

  // Pro-rate first year
  if (financialYear === claimStartFY) {
    const days = daysInFirstFY(claimStartDate);
    return round2(annual * (days / 365));
  }

  return annual;
}

// ─── Projection ───────────────────────────────────────────────────

interface ProjectScheduleParams {
  assets: ProjectionAsset[];
  capitalWorks: ProjectionCapitalWork[];
  fromFY: number;
  toFY: number;
}

/**
 * Projects a depreciation schedule across multiple financial years.
 *
 * - immediate_writeoff: full cost in purchase FY
 * - low_value: 37.5% in purchase FY, 18.75% of remaining thereafter
 * - individual: uses DV or PC based on method
 */
export function projectSchedule({
  assets,
  capitalWorks,
  fromFY,
  toFY,
}: ProjectScheduleParams): ProjectionRow[] {
  if (fromFY > toFY) return [];

  const rows: ProjectionRow[] = [];

  for (let fy = fromFY; fy <= toFY; fy++) {
    let div40Total = 0;
    let div43Total = 0;
    let lowValuePoolTotal = 0;

    // Process each asset
    for (const asset of assets) {
      const purchaseFY = getCurrentFinancialYear(asset.purchaseDate);

      // Skip if not yet purchased
      if (fy < purchaseFY) continue;

      const yearIndex = fy - purchaseFY;
      const daysFirst = daysInFirstFY(asset.purchaseDate);

      switch (asset.poolType) {
        case "immediate_writeoff": {
          // Full cost in purchase FY only
          if (fy === purchaseFY) {
            div40Total = round2(div40Total + asset.cost);
          }
          break;
        }

        case "low_value": {
          // Track pool balance for this asset across years
          let poolBalance = asset.cost;
          let deduction = 0;

          for (let y = purchaseFY; y <= fy; y++) {
            if (poolBalance <= 0.01) break;

            if (y === purchaseFY) {
              // First year: 37.5% of additions
              deduction = round2(poolBalance * 0.375);
            } else {
              // Subsequent years: 18.75% of opening balance
              deduction = round2(poolBalance * 0.1875);
            }

            if (y === fy) {
              lowValuePoolTotal = round2(lowValuePoolTotal + deduction);
            }

            poolBalance = round2(poolBalance - deduction);
          }
          break;
        }

        case "individual": {
          const deduction =
            asset.method === "diminishing_value"
              ? calculateDiminishingValue({
                  cost: asset.cost,
                  effectiveLife: asset.effectiveLife,
                  yearIndex,
                  daysFirstYear: daysFirst,
                })
              : calculatePrimeCost({
                  cost: asset.cost,
                  effectiveLife: asset.effectiveLife,
                  yearIndex,
                  daysFirstYear: daysFirst,
                });

          div40Total = round2(div40Total + deduction);
          break;
        }
      }
    }

    // Process capital works
    for (const cw of capitalWorks) {
      const deduction = calculateCapitalWorksDeduction({
        constructionCost: cw.constructionCost,
        constructionDate: cw.constructionDate,
        claimStartDate: cw.claimStartDate,
        financialYear: fy,
      });
      div43Total = round2(div43Total + deduction);
    }

    rows.push({
      financialYear: fy,
      div40Total,
      div43Total,
      lowValuePoolTotal,
      grandTotal: round2(div40Total + div43Total + lowValuePoolTotal),
    });
  }

  return rows;
}
