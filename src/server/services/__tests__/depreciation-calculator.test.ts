import { describe, it, expect } from "vitest";

import {
  getCurrentFinancialYear,
  daysInFirstFY,
  calculateDiminishingValue,
  calculatePrimeCost,
  calculateLowValuePoolDeduction,
  calculateCapitalWorksDeduction,
  projectSchedule,
} from "../depreciation-calculator";

// ─── Helper: getCurrentFinancialYear ──────────────────────────────

describe("getCurrentFinancialYear", () => {
  it("returns FY 2026 for a date after Jul 1 2025", () => {
    // Aug 15 2025 is in FY 2025-26 → 2026
    expect(getCurrentFinancialYear(new Date(2025, 7, 15))).toBe(2026);
  });

  it("returns FY 2026 for a date before Jul 1 2026", () => {
    // Mar 1 2026 is still in FY 2025-26 → 2026
    expect(getCurrentFinancialYear(new Date(2026, 2, 1))).toBe(2026);
  });

  it("returns FY 2026 for exactly Jul 1 2025", () => {
    // Jul 1 2025 is the start of FY 2025-26 → 2026
    expect(getCurrentFinancialYear(new Date(2025, 6, 1))).toBe(2026);
  });

  it("returns FY 2025 for Jun 30 2025", () => {
    // Jun 30 2025 is the last day of FY 2024-25 → 2025
    expect(getCurrentFinancialYear(new Date(2025, 5, 30))).toBe(2025);
  });

  it("returns FY 2027 for Jul 1 2026", () => {
    expect(getCurrentFinancialYear(new Date(2026, 6, 1))).toBe(2027);
  });

  it("returns FY for January (second half of FY)", () => {
    // Jan 15 2026 → FY 2025-26 → 2026
    expect(getCurrentFinancialYear(new Date(2026, 0, 15))).toBe(2026);
  });
});

// ─── Helper: daysInFirstFY ────────────────────────────────────────

describe("daysInFirstFY", () => {
  it("returns 181 days for Jan 1 purchase (Jan 1 to Jun 30 inclusive)", () => {
    // Jan 1 2026 to Jun 30 2026 = 181 days
    expect(daysInFirstFY(new Date(2026, 0, 1))).toBe(181);
  });

  it("returns 365 days for Jul 1 purchase (full FY)", () => {
    // Jul 1 2025 to Jun 30 2026 = 365 days
    expect(daysInFirstFY(new Date(2025, 6, 1))).toBe(365);
  });

  it("returns 1 day for Jun 30 purchase (minimum)", () => {
    // Jun 30 to Jun 30 = 1 day (min)
    expect(daysInFirstFY(new Date(2026, 5, 30))).toBe(1);
  });

  it("returns correct days for mid-year Oct 15 purchase", () => {
    // Oct 15 2025 to Jun 30 2026
    // Oct: 16 remaining days (15 to 31, inclusive of 15th: 31-15+1=17, but Oct 15 to Oct 31 = 17 days)
    // Actually let's count properly: Oct 15 to Jun 30
    // Days from Oct 15 to Jun 30: use Date diff
    const purchase = new Date(2025, 9, 15);
    const fyEnd = new Date(2026, 5, 30);
    const expected =
      Math.floor(
        (fyEnd.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    expect(daysInFirstFY(purchase)).toBe(expected);
  });
});

// ─── Div 40: calculateDiminishingValue ────────────────────────────

describe("calculateDiminishingValue", () => {
  it("calculates full first year correctly ($10k, 10yr)", () => {
    // Rate = 200% / 10 = 20%
    // Year 0 full year: $10,000 * 0.20 = $2,000
    expect(
      calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 365,
      })
    ).toBe(2000);
  });

  it("pro-rates first year for half year", () => {
    // Rate = 20%, base = $10,000
    // Half year: $10,000 * 0.20 * (183/365) = $1,002.74
    expect(
      calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 183,
      })
    ).toBeCloseTo(1002.74, 2);
  });

  it("calculates second year from written-down value", () => {
    // Year 0: $10,000 * 0.20 = $2,000 → WDV = $8,000
    // Year 1: $8,000 * 0.20 = $1,600
    expect(
      calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 1,
        daysFirstYear: 365,
      })
    ).toBe(1600);
  });

  it("calculates third year correctly", () => {
    // Year 0: $10,000 * 0.20 = $2,000 → WDV = $8,000
    // Year 1: $8,000 * 0.20 = $1,600 → WDV = $6,400
    // Year 2: $6,400 * 0.20 = $1,280
    expect(
      calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 2,
        daysFirstYear: 365,
      })
    ).toBe(1280);
  });

  it("returns 0 when fully depreciated (year 50)", () => {
    expect(
      calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 50,
        daysFirstYear: 365,
      })
    ).toBe(0);
  });

  it("handles pro-rata first year then subsequent year", () => {
    // Year 0 pro-rata (183 days): $10,000 * 0.20 * 183/365 = $1,002.74
    // WDV after year 0: $10,000 - $1,002.74 = $8,997.26
    // Year 1: $8,997.26 * 0.20 = $1,799.45
    expect(
      calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 1,
        daysFirstYear: 183,
      })
    ).toBeCloseTo(1799.45, 2);
  });

  it("rounds to 2 decimal places", () => {
    const result = calculateDiminishingValue({
      cost: 10000,
      effectiveLife: 7,
      yearIndex: 0,
      daysFirstYear: 200,
    });
    // Should have at most 2 decimal places
    expect(result).toBe(Math.round(result * 100) / 100);
  });
});

// ─── Div 40: calculatePrimeCost ───────────────────────────────────

describe("calculatePrimeCost", () => {
  it("calculates full year correctly ($10k, 10yr = $1,000)", () => {
    expect(
      calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 365,
      })
    ).toBe(1000);
  });

  it("pro-rates first year for half year", () => {
    // $10,000 / 10 = $1,000/yr * 183/365 = $501.37
    expect(
      calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 183,
      })
    ).toBeCloseTo(501.37, 2);
  });

  it("returns consistent flat amount for subsequent years", () => {
    // Year 1, 2, 3 should all be $1,000
    expect(
      calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 1,
        daysFirstYear: 365,
      })
    ).toBe(1000);
    expect(
      calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 5,
        daysFirstYear: 365,
      })
    ).toBe(1000);
  });

  it("returns 0 past effective life", () => {
    // Effective life 10 years. Year index 10 means 11th year → beyond life
    expect(
      calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 10,
        daysFirstYear: 365,
      })
    ).toBe(0);
  });

  it("does not deduct more than remaining value", () => {
    // Pro-rata first year: $1,000 * 183/365 = ~$501.37
    // Years 1-9: $1,000 each = $9,000
    // Total so far: $9,501.37
    // Year 10 (index 10): remaining = $498.63
    // But effective life is 10, so with pro-rata first year,
    // the last partial year should return what's left
    // Actually with 10yr effective life and pro-rata first year,
    // the schedule extends one more year to recover the pro-rata shortfall.
    // Year 0: $501.37, Years 1-9: $1000 each = $9000, total = $9501.37
    // Year 10 (index 10): remaining = $498.63, should return $498.63
    const result = calculatePrimeCost({
      cost: 10000,
      effectiveLife: 10,
      yearIndex: 10,
      daysFirstYear: 183,
    });
    expect(result).toBeCloseTo(498.63, 2);
  });

  it("returns 0 well past effective life", () => {
    expect(
      calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 20,
        daysFirstYear: 183,
      })
    ).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const result = calculatePrimeCost({
      cost: 10000,
      effectiveLife: 7,
      yearIndex: 0,
      daysFirstYear: 200,
    });
    expect(result).toBe(Math.round(result * 100) / 100);
  });
});

// ─── Low-Value Pool ───────────────────────────────────────────────

describe("calculateLowValuePoolDeduction", () => {
  it("calculates deduction for opening balance only", () => {
    // 18.75% of $5,000 = $937.50
    expect(
      calculateLowValuePoolDeduction({ openingBalance: 5000, additions: 0 })
    ).toBe(937.5);
  });

  it("calculates deduction for additions only", () => {
    // 37.5% of $2,000 = $750
    expect(
      calculateLowValuePoolDeduction({ openingBalance: 0, additions: 2000 })
    ).toBe(750);
  });

  it("calculates combined deduction", () => {
    // 18.75% of $5,000 + 37.5% of $2,000 = $937.50 + $750 = $1,687.50
    expect(
      calculateLowValuePoolDeduction({ openingBalance: 5000, additions: 2000 })
    ).toBe(1687.5);
  });

  it("returns 0 when both are 0", () => {
    expect(
      calculateLowValuePoolDeduction({ openingBalance: 0, additions: 0 })
    ).toBe(0);
  });
});

// ─── Div 43: calculateCapitalWorksDeduction ───────────────────────

describe("calculateCapitalWorksDeduction", () => {
  it("calculates full year at 2.5% ($400k = $10,000)", () => {
    expect(
      calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date(2020, 0, 1),
        claimStartDate: new Date(2020, 6, 1), // Jul 1 2020
        financialYear: 2022, // Full year well within 40yr window
      })
    ).toBe(10000);
  });

  it("pro-rates first year from claim start date to Jun 30", () => {
    // Claim start: Jan 1 2026
    // Days from Jan 1 to Jun 30 = 181 days
    // Annual deduction: $400,000 * 0.025 = $10,000
    // Pro-rata: $10,000 * 181/365 = $4,958.90
    const result = calculateCapitalWorksDeduction({
      constructionCost: 400000,
      constructionDate: new Date(2020, 0, 1),
      claimStartDate: new Date(2026, 0, 1), // Jan 1 2026
      financialYear: 2026, // FY ending Jun 30 2026
    });
    expect(result).toBeCloseTo(4958.9, 0);
  });

  it("returns 0 after 40 years from construction", () => {
    // Construction 1980, claim 1980
    // FY 2021 is 41 years later → 0
    expect(
      calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date(1980, 0, 1),
        claimStartDate: new Date(1980, 6, 1),
        financialYear: 2021,
      })
    ).toBe(0);
  });

  it("returns 0 before claim start FY", () => {
    // Claim starts FY 2025, asking for FY 2024
    expect(
      calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date(2020, 0, 1),
        claimStartDate: new Date(2024, 6, 1), // Jul 1 2024 → FY 2025
        financialYear: 2024,
      })
    ).toBe(0);
  });

  it("returns full year for second year of claim", () => {
    // Claim start: Jan 1 2025 (FY 2025)
    // FY 2026 is a full year
    expect(
      calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date(2020, 0, 1),
        claimStartDate: new Date(2025, 0, 1),
        financialYear: 2026,
      })
    ).toBe(10000);
  });

  it("handles claim start on Jul 1 (full first year)", () => {
    expect(
      calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date(2020, 0, 1),
        claimStartDate: new Date(2025, 6, 1), // Jul 1 2025 → FY 2026
        financialYear: 2026,
      })
    ).toBe(10000);
  });
});

// ─── Projection: projectSchedule ─────────────────────────────────

describe("projectSchedule", () => {
  it("projects individual diminishing value asset over multiple years", () => {
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 10000,
          effectiveLife: 10,
          method: "diminishing_value",
          purchaseDate: new Date(2025, 6, 1), // Jul 1 2025 → FY 2026
          poolType: "individual",
        },
      ],
      capitalWorks: [],
      fromFY: 2026,
      toFY: 2028,
    });

    expect(result).toHaveLength(3);
    expect(result[0].financialYear).toBe(2026);
    expect(result[0].div40Total).toBe(2000); // $10k * 20% * 365/365
    expect(result[0].div43Total).toBe(0);
    expect(result[0].lowValuePoolTotal).toBe(0);
    expect(result[0].grandTotal).toBe(2000);

    expect(result[1].financialYear).toBe(2027);
    expect(result[1].div40Total).toBe(1600); // $8k * 20%

    expect(result[2].financialYear).toBe(2028);
    expect(result[2].div40Total).toBe(1280); // $6.4k * 20%
  });

  it("projects individual prime cost asset", () => {
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 10000,
          effectiveLife: 10,
          method: "prime_cost",
          purchaseDate: new Date(2025, 6, 1),
          poolType: "individual",
        },
      ],
      capitalWorks: [],
      fromFY: 2026,
      toFY: 2028,
    });

    expect(result[0].div40Total).toBe(1000);
    expect(result[1].div40Total).toBe(1000);
    expect(result[2].div40Total).toBe(1000);
  });

  it("handles immediate writeoff in purchase FY", () => {
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 500,
          effectiveLife: 5,
          method: "diminishing_value",
          purchaseDate: new Date(2025, 6, 1),
          poolType: "immediate_writeoff",
        },
      ],
      capitalWorks: [],
      fromFY: 2026,
      toFY: 2028,
    });

    expect(result[0].div40Total).toBe(500); // Full cost in purchase FY
    expect(result[1].div40Total).toBe(0); // Nothing thereafter
    expect(result[2].div40Total).toBe(0);
  });

  it("handles low-value pool assets", () => {
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 800,
          effectiveLife: 5,
          method: "diminishing_value",
          purchaseDate: new Date(2025, 6, 1), // FY 2026
          poolType: "low_value",
        },
      ],
      capitalWorks: [],
      fromFY: 2026,
      toFY: 2028,
    });

    // FY 2026: 37.5% of $800 = $300
    expect(result[0].lowValuePoolTotal).toBe(300);

    // FY 2027: 18.75% of ($800 - $300) = 18.75% of $500 = $93.75
    expect(result[1].lowValuePoolTotal).toBe(93.75);

    // FY 2028: 18.75% of ($500 - $93.75) = 18.75% of $406.25 = $76.17
    expect(result[2].lowValuePoolTotal).toBeCloseTo(76.17, 2);
  });

  it("projects capital works deductions", () => {
    const result = projectSchedule({
      assets: [],
      capitalWorks: [
        {
          id: "cw1",
          constructionCost: 400000,
          constructionDate: new Date(2020, 0, 1),
          claimStartDate: new Date(2025, 6, 1), // Jul 1 2025 → FY 2026
        },
      ],
      fromFY: 2026,
      toFY: 2028,
    });

    expect(result[0].div43Total).toBe(10000);
    expect(result[1].div43Total).toBe(10000);
    expect(result[2].div43Total).toBe(10000);
  });

  it("combines mixed asset types correctly", () => {
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 10000,
          effectiveLife: 10,
          method: "diminishing_value",
          purchaseDate: new Date(2025, 6, 1),
          poolType: "individual",
        },
        {
          id: "a2",
          cost: 500,
          effectiveLife: 5,
          method: "prime_cost",
          purchaseDate: new Date(2025, 6, 1),
          poolType: "immediate_writeoff",
        },
        {
          id: "a3",
          cost: 800,
          effectiveLife: 5,
          method: "diminishing_value",
          purchaseDate: new Date(2025, 6, 1),
          poolType: "low_value",
        },
      ],
      capitalWorks: [
        {
          id: "cw1",
          constructionCost: 400000,
          constructionDate: new Date(2020, 0, 1),
          claimStartDate: new Date(2025, 6, 1),
        },
      ],
      fromFY: 2026,
      toFY: 2026,
    });

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.financialYear).toBe(2026);
    expect(row.div40Total).toBe(2000 + 500); // DV asset + immediate writeoff
    expect(row.div43Total).toBe(10000);
    expect(row.lowValuePoolTotal).toBe(300); // 37.5% of $800
    expect(row.grandTotal).toBe(2500 + 10000 + 300);
  });

  it("excludes fully depreciated assets", () => {
    // Asset purchased long ago, project from a distant future year
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 1000,
          effectiveLife: 2,
          method: "prime_cost",
          purchaseDate: new Date(2015, 6, 1), // FY 2016
          poolType: "individual",
        },
      ],
      capitalWorks: [],
      fromFY: 2026,
      toFY: 2028,
    });

    // Fully depreciated by FY 2018, so all years should be 0
    expect(result[0].div40Total).toBe(0);
    expect(result[1].div40Total).toBe(0);
    expect(result[2].div40Total).toBe(0);
  });

  it("handles asset purchased in future FY (not yet claimable)", () => {
    const result = projectSchedule({
      assets: [
        {
          id: "a1",
          cost: 10000,
          effectiveLife: 10,
          method: "diminishing_value",
          purchaseDate: new Date(2027, 0, 1), // FY 2027
          poolType: "individual",
        },
      ],
      capitalWorks: [],
      fromFY: 2026,
      toFY: 2028,
    });

    expect(result[0].div40Total).toBe(0); // FY 2026: not yet purchased
    expect(result[1].div40Total).toBeGreaterThan(0); // FY 2027: first year
    expect(result[2].div40Total).toBeGreaterThan(0); // FY 2028: second year
  });

  it("returns empty array when fromFY > toFY", () => {
    const result = projectSchedule({
      assets: [],
      capitalWorks: [],
      fromFY: 2028,
      toFY: 2026,
    });
    expect(result).toHaveLength(0);
  });
});
