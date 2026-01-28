import { describe, expect, it } from "vitest";
import {
  computeChange,
  buildCategoryComparison,
  sortCategories,
  KEY_EXPENSES,
} from "../yoy-comparison";

describe("computeChange", () => {
  it("computes dollar and percent change", () => {
    const result = computeChange(1100, 1000);
    expect(result.change).toBe(100);
    expect(result.changePercent).toBe(10);
    expect(result.isSignificant).toBe(false); // exactly 10 is not > 10
  });

  it("flags significant changes over 10%", () => {
    const result = computeChange(1200, 1000);
    expect(result.change).toBe(200);
    expect(result.changePercent).toBe(20);
    expect(result.isSignificant).toBe(true);
  });

  it("returns null percent when comparison year is zero", () => {
    const result = computeChange(500, 0);
    expect(result.change).toBe(500);
    expect(result.changePercent).toBeNull();
    expect(result.isSignificant).toBe(false);
  });

  it("handles decreases", () => {
    const result = computeChange(800, 1000);
    expect(result.change).toBe(-200);
    expect(result.changePercent).toBe(-20);
    expect(result.isSignificant).toBe(true);
  });

  it("handles both years zero", () => {
    const result = computeChange(0, 0);
    expect(result.change).toBe(0);
    expect(result.changePercent).toBeNull();
    expect(result.isSignificant).toBe(false);
  });
});

describe("buildCategoryComparison", () => {
  it("builds comparison from two category total maps", () => {
    const current = new Map([["land_tax", 3000], ["insurance", 1500]]);
    const comparison = new Map([["land_tax", 2500], ["insurance", 1400]]);

    const result = buildCategoryComparison(current, comparison);
    expect(result).toHaveLength(2);

    const landTax = result.find((c) => c.category === "land_tax")!;
    expect(landTax.label).toBe("Land Tax");
    expect(landTax.atoCode).toBe("D9");
    expect(landTax.isKeyExpense).toBe(true);
    expect(landTax.currentYear).toBe(3000);
    expect(landTax.comparisonYear).toBe(2500);
    expect(landTax.change).toBe(500);
    expect(landTax.changePercent).toBe(20);
    expect(landTax.isSignificant).toBe(true);
  });

  it("includes categories only in one year", () => {
    const current = new Map([["cleaning", 200]]);
    const comparison = new Map([["gardening", 300]]);

    const result = buildCategoryComparison(current, comparison);
    expect(result).toHaveLength(2);

    const cleaning = result.find((c) => c.category === "cleaning")!;
    expect(cleaning.currentYear).toBe(200);
    expect(cleaning.comparisonYear).toBe(0);

    const gardening = result.find((c) => c.category === "gardening")!;
    expect(gardening.currentYear).toBe(0);
    expect(gardening.comparisonYear).toBe(300);
  });

  it("excludes categories with zero in both years", () => {
    const current = new Map<string, number>();
    const comparison = new Map<string, number>();

    const result = buildCategoryComparison(current, comparison);
    expect(result).toHaveLength(0);
  });
});

describe("sortCategories", () => {
  it("sorts key expenses first in defined order, then others alphabetically", () => {
    const items = [
      { category: "cleaning", isKeyExpense: false },
      { category: "insurance", isKeyExpense: true },
      { category: "advertising", isKeyExpense: false },
      { category: "land_tax", isKeyExpense: true },
      { category: "council_rates", isKeyExpense: true },
    ];

    const sorted = sortCategories(items);
    expect(sorted.map((s) => s.category)).toEqual([
      "council_rates",  // key expense D5
      "insurance",      // key expense D7
      "land_tax",       // key expense D9
      "advertising",    // other, alphabetical
      "cleaning",       // other, alphabetical
    ]);
  });
});

describe("KEY_EXPENSES", () => {
  it("contains the 6 expected categories", () => {
    expect(KEY_EXPENSES).toEqual([
      "land_tax",
      "council_rates",
      "water_charges",
      "repairs_and_maintenance",
      "insurance",
      "body_corporate",
    ]);
  });
});
