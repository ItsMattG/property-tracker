import { describe, expect, it } from "vitest";
import {
  computeCategoryForecast,
  computeConfidence,
  type MonthlyTotals,
} from "../tax-forecast";

describe("computeCategoryForecast", () => {
  it("uses prior year to fill remaining months", () => {
    // 6 months elapsed (Jul-Dec), current FY has $600/mo = $3600 YTD
    // Prior year had $500/mo for Jan-Jun = $3000 fill-in
    const currentMonths: MonthlyTotals = { 7: 600, 8: 600, 9: 600, 10: 600, 11: 600, 12: 600 };
    const priorMonths: MonthlyTotals = { 1: 500, 2: 500, 3: 500, 4: 500, 5: 500, 6: 500, 7: 500, 8: 500, 9: 500, 10: 500, 11: 500, 12: 500 };

    const result = computeCategoryForecast(currentMonths, priorMonths, 6);
    // actual YTD = 3600, fill-in from prior year Jan-Jun = 3000
    expect(result.actual).toBe(3600);
    expect(result.forecast).toBe(6600);
  });

  it("annualizes when no prior year data exists", () => {
    const currentMonths: MonthlyTotals = { 7: 1000, 8: 1000, 9: 1000 };
    const priorMonths: MonthlyTotals = {};

    const result = computeCategoryForecast(currentMonths, priorMonths, 3);
    expect(result.actual).toBe(3000);
    // 3000 / 3 * 12 = 12000
    expect(result.forecast).toBe(12000);
  });

  it("handles seasonal payments via prior year pattern", () => {
    // Insurance paid in March only
    const currentMonths: MonthlyTotals = { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    const priorMonths: MonthlyTotals = { 1: 0, 2: 0, 3: 2100, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };

    const result = computeCategoryForecast(currentMonths, priorMonths, 6);
    expect(result.actual).toBe(0);
    expect(result.forecast).toBe(2100); // picks up March from prior year
  });

  it("returns zero forecast when no data at all", () => {
    const result = computeCategoryForecast({}, {}, 0);
    expect(result.actual).toBe(0);
    expect(result.forecast).toBe(0);
  });
});

describe("computeConfidence", () => {
  it("returns high when 9+ months elapsed", () => {
    expect(computeConfidence(9, true)).toBe("high");
    expect(computeConfidence(10, false)).toBe("high");
  });

  it("returns high when prior year data available", () => {
    expect(computeConfidence(4, true)).toBe("high");
  });

  it("returns medium for 4-8 months without prior year", () => {
    expect(computeConfidence(5, false)).toBe("medium");
  });

  it("returns low for <4 months without prior year", () => {
    expect(computeConfidence(2, false)).toBe("low");
    expect(computeConfidence(0, false)).toBe("low");
  });
});
