import { describe, it, expect } from "vitest";
import {
  getHemBenchmark,
  shadeIncome,
  getAssessmentRate,
  calculateMaxLoan,
  calculateDti,
  getDtiClassification,
  calculateBorrowingPower,
  type BorrowingPowerInputs,
} from "../borrowing-power-calc";

describe("getHemBenchmark", () => {
  it("returns correct HEM for single no dependants", () => {
    expect(getHemBenchmark("single", 0)).toBe(1400);
  });

  it("returns correct HEM for couple no dependants", () => {
    expect(getHemBenchmark("couple", 0)).toBe(2100);
  });

  it("returns correct HEM for single with 1 dependant", () => {
    expect(getHemBenchmark("single", 1)).toBe(1800);
  });

  it("returns correct HEM for single with 2 dependants", () => {
    expect(getHemBenchmark("single", 2)).toBe(2100);
  });

  it("returns correct HEM for single with 3+ dependants", () => {
    expect(getHemBenchmark("single", 3)).toBe(2400);
    expect(getHemBenchmark("single", 5)).toBe(2400);
  });

  it("returns correct HEM for couple with 1 dependant", () => {
    expect(getHemBenchmark("couple", 1)).toBe(2400);
  });

  it("returns correct HEM for couple with 2 dependants", () => {
    expect(getHemBenchmark("couple", 2)).toBe(2700);
  });

  it("returns correct HEM for couple with 3+ dependants", () => {
    expect(getHemBenchmark("couple", 3)).toBe(3000);
    expect(getHemBenchmark("couple", 6)).toBe(3000);
  });
});

describe("shadeIncome", () => {
  it("shades salary at 100%", () => {
    expect(shadeIncome(10000, "salary")).toBe(10000);
  });

  it("shades rental income at 80%", () => {
    expect(shadeIncome(5000, "rental")).toBe(4000);
  });

  it("shades other income at 80%", () => {
    expect(shadeIncome(2000, "other")).toBe(1600);
  });

  it("returns 0 for zero input", () => {
    expect(shadeIncome(0, "salary")).toBe(0);
    expect(shadeIncome(0, "rental")).toBe(0);
  });
});

describe("getAssessmentRate", () => {
  it("uses product rate + 3% buffer when above floor", () => {
    expect(getAssessmentRate(6.0, 5.5)).toBe(9.0);
  });

  it("uses floor rate when product rate + buffer is below floor", () => {
    expect(getAssessmentRate(2.0, 5.5)).toBe(5.5);
  });

  it("uses product rate + buffer when equal to floor", () => {
    expect(getAssessmentRate(2.5, 5.5)).toBe(5.5);
  });
});

describe("calculateMaxLoan", () => {
  it("returns 0 when monthly surplus is 0", () => {
    expect(calculateMaxLoan(0, 6.0, 30)).toBe(0);
  });

  it("returns 0 when monthly surplus is negative", () => {
    expect(calculateMaxLoan(-500, 6.0, 30)).toBe(0);
  });

  it("calculates correct max loan for known values", () => {
    const result = calculateMaxLoan(2000, 6.0, 30);
    expect(result).toBeGreaterThan(333000);
    expect(result).toBeLessThan(334000);
  });

  it("calculates correct max loan for shorter term", () => {
    const result = calculateMaxLoan(2000, 6.0, 15);
    expect(result).toBeGreaterThan(237000);
    expect(result).toBeLessThan(238000);
  });
});

describe("calculateDti", () => {
  it("calculates DTI ratio", () => {
    expect(calculateDti(600000, 100000)).toBeCloseTo(6.0);
  });

  it("returns 0 when no debt", () => {
    expect(calculateDti(0, 100000)).toBe(0);
  });

  it("returns Infinity when no income", () => {
    expect(calculateDti(500000, 0)).toBe(Infinity);
  });
});

describe("getDtiClassification", () => {
  it("returns green for DTI < 4", () => {
    expect(getDtiClassification(3.5)).toBe("green");
  });

  it("returns amber for DTI 4-6", () => {
    expect(getDtiClassification(4.0)).toBe("amber");
    expect(getDtiClassification(5.9)).toBe("amber");
  });

  it("returns red for DTI >= 6", () => {
    expect(getDtiClassification(6.0)).toBe("red");
    expect(getDtiClassification(8.0)).toBe("red");
  });
});

describe("calculateBorrowingPower", () => {
  const baseInputs: BorrowingPowerInputs = {
    grossSalary: 8000,
    rentalIncome: 3000,
    otherIncome: 0,
    householdType: "single",
    dependants: 0,
    livingExpenses: 2000,
    existingPropertyLoans: 1500,
    creditCardLimits: 10000,
    otherLoans: 0,
    hecsBalance: 0,
    targetRate: 6.2,
    loanTermYears: 30,
    floorRate: 5.5,
    existingDebt: 400000,
    grossAnnualIncome: 96000,
  };

  it("produces a positive borrowing power for typical inputs", () => {
    const result = calculateBorrowingPower(baseInputs);
    expect(result.maxLoan).toBeGreaterThan(0);
    expect(result.monthlySurplus).toBeGreaterThan(0);
    expect(result.assessmentRate).toBe(9.2);
  });

  it("uses HEM when declared expenses are below benchmark", () => {
    const inputs: BorrowingPowerInputs = { ...baseInputs, livingExpenses: 500 };
    const result = calculateBorrowingPower(inputs);
    expect(result.effectiveLivingExpenses).toBe(1400);
    expect(result.hemApplied).toBe(true);
  });

  it("uses declared expenses when above HEM", () => {
    const inputs: BorrowingPowerInputs = { ...baseInputs, livingExpenses: 3000 };
    const result = calculateBorrowingPower(inputs);
    expect(result.effectiveLivingExpenses).toBe(3000);
    expect(result.hemApplied).toBe(false);
  });

  it("returns 0 max loan when expenses exceed income", () => {
    const inputs: BorrowingPowerInputs = {
      ...baseInputs,
      grossSalary: 2000,
      rentalIncome: 0,
      livingExpenses: 3000,
    };
    const result = calculateBorrowingPower(inputs);
    expect(result.maxLoan).toBe(0);
    expect(result.monthlySurplus).toBeLessThanOrEqual(0);
  });

  it("includes credit card commitments at 3.8% of limit", () => {
    const withCards: BorrowingPowerInputs = { ...baseInputs, creditCardLimits: 20000 };
    const withoutCards: BorrowingPowerInputs = { ...baseInputs, creditCardLimits: 0 };
    const resultWith = calculateBorrowingPower(withCards);
    const resultWithout = calculateBorrowingPower(withoutCards);
    expect(resultWithout.maxLoan).toBeGreaterThan(resultWith.maxLoan);
  });

  it("calculates DTI correctly", () => {
    const result = calculateBorrowingPower(baseInputs);
    const expectedDti = (baseInputs.existingDebt + result.maxLoan) / baseInputs.grossAnnualIncome;
    expect(result.dtiRatio).toBeCloseTo(expectedDti, 1);
  });
});
