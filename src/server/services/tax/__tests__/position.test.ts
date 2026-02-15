// src/server/services/__tests__/tax-position.test.ts

import { describe, expect, it } from "vitest";
import {
  calculateTaxPosition,
  estimatePropertySavings,
  type TaxPositionInput,
} from "../position";

describe("calculateTaxPosition", () => {
  const baseInput: TaxPositionInput = {
    financialYear: 2026,
    grossSalary: 95000,
    paygWithheld: 22000,
    rentalNetResult: -12400, // loss
    otherDeductions: 2500,
    hasHecsDebt: false,
    hasPrivateHealth: true,
    familyStatus: "single",
    dependentChildren: 0,
    partnerIncome: 0,
  };

  it("calculates basic tax position with rental loss", () => {
    const result = calculateTaxPosition(baseInput);

    expect(result.financialYear).toBe(2026);
    expect(result.grossSalary).toBe(95000);
    expect(result.rentalNetResult).toBe(-12400);
    expect(result.taxableIncome).toBe(80100); // 95000 - 12400 - 2500
    expect(result.isRefund).toBe(true);
    expect(result.propertySavings).toBeGreaterThan(0);
  });

  it("calculates zero tax for low income", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 18000,
      paygWithheld: 0,
      rentalNetResult: 0,
      otherDeductions: 0,
    });

    expect(result.baseTax).toBe(0);
    expect(result.taxableIncome).toBe(18000);
  });

  it("handles rental profit (increases tax)", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      rentalNetResult: 5000, // profit
    });

    expect(result.taxableIncome).toBe(97500); // 95000 + 5000 - 2500
    expect(result.propertySavings).toBe(0); // no savings on profit
  });

  it("applies Medicare Levy Surcharge when no private health", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      hasPrivateHealth: false,
    });

    expect(result.mlsApplies).toBe(false); // taxable income 80100 < 93000 threshold
  });

  it("applies MLS for high income without private health", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 150000,
      paygWithheld: 45000,
      rentalNetResult: 0,
      otherDeductions: 0,
      hasPrivateHealth: false,
    });

    expect(result.mlsApplies).toBe(true);
    expect(result.medicareLevySurcharge).toBeGreaterThan(0);
  });

  it("calculates HECS repayment when debt exists", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      hasHecsDebt: true,
    });

    expect(result.hecsRepayment).toBeGreaterThan(0);
  });

  it("calculates no HECS below threshold", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 50000,
      paygWithheld: 8000,
      rentalNetResult: 0,
      hasHecsDebt: true,
    });

    expect(result.hecsRepayment).toBe(0);
  });

  it("uses family MLS threshold for couples", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 100000,
      hasPrivateHealth: false,
      familyStatus: "couple",
      partnerIncome: 50000,
    });

    // Combined income 150000 < 186000 family threshold
    expect(result.mlsApplies).toBe(false);
  });

  it("handles negative taxable income as zero", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 20000,
      rentalNetResult: -30000,
      otherDeductions: 5000,
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.baseTax).toBe(0);
  });

  it("throws error for unsupported financial year", () => {
    expect(() =>
      calculateTaxPosition({
        ...baseInput,
        financialYear: 2020,
      })
    ).toThrow("Tax tables not available");
  });
});

describe("estimatePropertySavings", () => {
  it("estimates savings from rental loss", () => {
    const savings = estimatePropertySavings(-12400, 0.37);
    expect(savings).toBe(4588);
  });

  it("returns zero for rental profit", () => {
    const savings = estimatePropertySavings(5000, 0.37);
    expect(savings).toBe(0);
  });

  it("uses default marginal rate", () => {
    const savings = estimatePropertySavings(-10000);
    expect(savings).toBe(3700); // 10000 * 0.37
  });
});
