import { describe, it, expect } from "vitest";

import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";
import { sortProperties } from "../benchmark-sort";

const makeEntry = (
  overrides: Partial<PropertyScorecardEntry>,
): PropertyScorecardEntry => ({
  propertyId: "p1",
  address: "123 Main St",
  suburb: "Richmond",
  state: "VIC",
  purchasePrice: 500000,
  currentValue: 600000,
  grossYield: 5.0,
  netYield: 3.5,
  annualCashFlow: 10000,
  annualRent: 30000,
  annualExpenses: 20000,
  performanceScore: 70,
  scoreLabel: "Good",
  yieldPercentile: 60,
  expensePercentile: 50,
  isUnderperforming: false,
  capRate: 4.5,
  cashOnCash: 8.0,
  annualTaxDeductions: 5000,
  capitalGrowthPercent: 20,
  equity: 200000,
  ...overrides,
});

describe("sortProperties", () => {
  const properties = [
    makeEntry({
      propertyId: "a",
      performanceScore: 70,
      grossYield: 5.0,
      netYield: 3.5,
      annualRent: 30000,
      annualExpenses: 20000,
    }),
    makeEntry({
      propertyId: "b",
      performanceScore: 90,
      grossYield: 3.0,
      netYield: 1.5,
      annualRent: 20000,
      annualExpenses: 10000,
    }),
    makeEntry({
      propertyId: "c",
      performanceScore: 50,
      grossYield: 7.0,
      netYield: 5.5,
      annualRent: 40000,
      annualExpenses: 30000,
    }),
  ];

  it("sorts by performanceScore descending", () => {
    const sorted = sortProperties(properties, "score", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by performanceScore ascending", () => {
    const sorted = sortProperties(properties, "score", "asc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "a", "b"]);
  });

  it("sorts by grossYield ascending", () => {
    const sorted = sortProperties(properties, "grossYield", "asc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by grossYield descending", () => {
    const sorted = sortProperties(properties, "grossYield", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "a", "b"]);
  });

  it("sorts by expenseRatio descending (higher ratio = more expenses)", () => {
    // expense ratios: a=66.7%, b=50%, c=75%
    const sorted = sortProperties(properties, "expenseRatio", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "a", "b"]);
  });

  it("sorts by expenseRatio ascending", () => {
    const sorted = sortProperties(properties, "expenseRatio", "asc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by netYield descending", () => {
    const sorted = sortProperties(properties, "netYield", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "a", "b"]);
  });

  it("sorts by netYield ascending", () => {
    const sorted = sortProperties(properties, "netYield", "asc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the original array", () => {
    const original = [...properties];
    sortProperties(properties, "score", "desc");
    expect(properties.map((p) => p.propertyId)).toEqual(
      original.map((p) => p.propertyId),
    );
  });

  it("handles empty array", () => {
    const sorted = sortProperties([], "score", "desc");
    expect(sorted).toEqual([]);
  });

  it("handles single element array", () => {
    const single = [makeEntry({ propertyId: "x" })];
    const sorted = sortProperties(single, "score", "desc");
    expect(sorted).toHaveLength(1);
    expect(sorted[0].propertyId).toBe("x");
  });

  it("handles zero annualRent for expenseRatio (returns 0)", () => {
    const zeroRent = [
      makeEntry({ propertyId: "z", annualRent: 0, annualExpenses: 5000 }),
      makeEntry({
        propertyId: "a",
        annualRent: 30000,
        annualExpenses: 20000,
      }),
    ];
    const sorted = sortProperties(zeroRent, "expenseRatio", "asc");
    // z has 0% (division guarded), a has 66.7%
    expect(sorted.map((p) => p.propertyId)).toEqual(["z", "a"]);
  });
});
