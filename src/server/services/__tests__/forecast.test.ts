import { describe, it, expect } from "vitest";
import {
  applyGrowthRate,
  calculateMonthlyLoanInterest,
  calculateMonthlyProjection,
  type ScenarioAssumptions,
} from "../forecast";

describe("forecast service", () => {
  describe("applyGrowthRate", () => {
    it("returns base amount for month 0", () => {
      const result = applyGrowthRate(1000, 0, 12);
      expect(result).toBe(1000);
    });

    it("applies monthly compounding for 12% annual rate", () => {
      // 12% annual = 1% monthly, after 1 month: 1000 * 1.01 = 1010
      const result = applyGrowthRate(1000, 1, 12);
      expect(result).toBeCloseTo(1010, 0);
    });

    it("compounds correctly over 12 months", () => {
      // 12% annual compounded monthly: 1000 * (1.01)^12 ≈ 1126.83
      const result = applyGrowthRate(1000, 12, 12);
      expect(result).toBeCloseTo(1126.83, 0);
    });
  });

  describe("calculateMonthlyLoanInterest", () => {
    it("calculates interest for standard loan", () => {
      // $500,000 at 6% = $2,500/month interest
      const result = calculateMonthlyLoanInterest(500000, 6, 0);
      expect(result).toBeCloseTo(2500, 0);
    });

    it("applies rate adjustment", () => {
      // $500,000 at 6% + 1% adjustment = 7% = $2,916.67/month
      const result = calculateMonthlyLoanInterest(500000, 6, 1);
      expect(result).toBeCloseTo(2916.67, 0);
    });
  });

  describe("calculateMonthlyProjection", () => {
    const baseAssumptions: ScenarioAssumptions = {
      rentGrowthPercent: 0,
      expenseInflationPercent: 0,
      vacancyRatePercent: 0,
      interestRateChangePercent: 0,
    };

    it("calculates net as income minus expenses", () => {
      const result = calculateMonthlyProjection({
        monthsAhead: 0,
        baseIncome: 2000,
        baseExpenses: 1500,
        loanBalance: 0,
        loanRate: 0,
        assumptions: baseAssumptions,
      });

      expect(result.projectedIncome).toBe(2000);
      expect(result.projectedExpenses).toBe(1500);
      expect(result.projectedNet).toBe(500);
    });

    it("applies vacancy rate to income", () => {
      const result = calculateMonthlyProjection({
        monthsAhead: 0,
        baseIncome: 2000,
        baseExpenses: 1000,
        loanBalance: 0,
        loanRate: 0,
        assumptions: { ...baseAssumptions, vacancyRatePercent: 10 },
      });

      expect(result.projectedIncome).toBe(1800); // 2000 * 0.9
    });

    it("includes loan interest in expenses", () => {
      const result = calculateMonthlyProjection({
        monthsAhead: 0,
        baseIncome: 3000,
        baseExpenses: 500,
        loanBalance: 500000,
        loanRate: 6,
        assumptions: baseAssumptions,
      });

      // 500 base + 2500 interest = 3000
      expect(result.projectedExpenses).toBeCloseTo(3000, 0);
    });
  });
});
