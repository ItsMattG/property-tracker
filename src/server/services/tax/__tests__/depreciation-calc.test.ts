import { describe, it, expect } from "vitest";

import {
  calculateYearlyDeduction,
  calculateRemainingValue,
  generateMultiYearSchedule,
  validateAndRecalculate,
} from "../depreciation-calc";

describe("calculateYearlyDeduction", () => {
  it("calculates prime cost correctly", () => {
    expect(calculateYearlyDeduction(10000, 10, "prime_cost")).toBe(1000);
  });

  it("calculates diminishing value correctly", () => {
    expect(calculateYearlyDeduction(10000, 10, "diminishing_value")).toBe(2000);
  });

  it("handles capital works 40-year at 2.5%", () => {
    expect(calculateYearlyDeduction(400000, 40, "prime_cost")).toBe(10000);
  });

  it("returns 0 for zero cost", () => {
    expect(calculateYearlyDeduction(0, 10, "prime_cost")).toBe(0);
  });

  it("returns 0 for zero effective life", () => {
    expect(calculateYearlyDeduction(10000, 0, "prime_cost")).toBe(0);
  });

  it("prorates first year by days held", () => {
    expect(
      calculateYearlyDeduction(10000, 10, "prime_cost", 182.5 / 365)
    ).toBe(500);
  });
});

describe("calculateRemainingValue", () => {
  it("calculates prime cost remaining after 3 years", () => {
    expect(calculateRemainingValue(10000, 10, "prime_cost", 3)).toBe(7000);
  });

  it("calculates diminishing value remaining after 3 years", () => {
    expect(calculateRemainingValue(10000, 10, "diminishing_value", 3)).toBe(
      5120
    );
  });

  it("never goes below zero", () => {
    expect(calculateRemainingValue(10000, 10, "prime_cost", 15)).toBe(0);
  });

  it("returns original cost for 0 years elapsed", () => {
    expect(calculateRemainingValue(10000, 10, "prime_cost", 0)).toBe(10000);
  });
});

describe("generateMultiYearSchedule", () => {
  it("generates prime cost schedule", () => {
    const schedule = generateMultiYearSchedule(10000, 5, "prime_cost");
    expect(schedule).toHaveLength(5);
    expect(schedule[0]).toEqual({
      year: 1,
      openingValue: 10000,
      deduction: 2000,
      closingValue: 8000,
    });
    expect(schedule[4]).toEqual({
      year: 5,
      openingValue: 2000,
      deduction: 2000,
      closingValue: 0,
    });
  });

  it("generates diminishing value schedule", () => {
    const schedule = generateMultiYearSchedule(
      10000,
      10,
      "diminishing_value"
    );
    expect(schedule[0]).toEqual({
      year: 1,
      openingValue: 10000,
      deduction: 2000,
      closingValue: 8000,
    });
    expect(schedule[1]).toEqual({
      year: 2,
      openingValue: 8000,
      deduction: 1600,
      closingValue: 6400,
    });
  });

  it("caps years parameter", () => {
    const schedule = generateMultiYearSchedule(10000, 50, "prime_cost", 5);
    expect(schedule).toHaveLength(5);
  });

  it("stops when value reaches zero", () => {
    const schedule = generateMultiYearSchedule(10000, 5, "prime_cost");
    expect(schedule).toHaveLength(5);
    expect(schedule[schedule.length - 1].closingValue).toBe(0);
  });
});

describe("validateAndRecalculate", () => {
  it("recalculates yearly deduction from ATO formula", () => {
    const assets = [
      {
        assetName: "Carpet",
        category: "plant_equipment" as const,
        originalCost: 5000,
        effectiveLife: 10,
        method: "diminishing_value" as const,
        yearlyDeduction: 800,
      },
    ];
    const result = validateAndRecalculate(assets);
    expect(result[0].yearlyDeduction).toBe(1000);
    expect(result[0].discrepancy).toBe(true);
  });

  it("flags no discrepancy when AI is close enough", () => {
    const assets = [
      {
        assetName: "Blinds",
        category: "plant_equipment" as const,
        originalCost: 3000,
        effectiveLife: 10,
        method: "prime_cost" as const,
        yearlyDeduction: 295,
      },
    ];
    const result = validateAndRecalculate(assets);
    expect(result[0].yearlyDeduction).toBe(300);
    expect(result[0].discrepancy).toBe(false);
  });

  it("defaults capital_works to prime_cost 40yr if method is diminishing_value", () => {
    const assets = [
      {
        assetName: "Building Structure",
        category: "capital_works" as const,
        originalCost: 400000,
        effectiveLife: 20,
        method: "diminishing_value" as const,
        yearlyDeduction: 40000,
      },
    ];
    const result = validateAndRecalculate(assets);
    expect(result[0].method).toBe("prime_cost");
    expect(result[0].effectiveLife).toBe(40);
    expect(result[0].yearlyDeduction).toBe(10000);
    expect(result[0].discrepancy).toBe(true);
  });
});
