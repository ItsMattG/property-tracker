import { describe, it, expect } from "vitest";
import { applyInterestRateFactor } from "../projection";
import type { InterestRateFactorConfig } from "../types";

describe("Projection Engine", () => {
  describe("applyInterestRateFactor", () => {
    it("increases loan repayment when rate rises", () => {
      const loan = {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: 500000,
        interestRate: 6.0,
        repaymentAmount: 3000,
      };
      const config: InterestRateFactorConfig = { changePercent: 2.0, applyTo: "all" };

      const result = applyInterestRateFactor(loan, config);

      // Original monthly interest: 500000 * 0.06 / 12 = 2500
      // New monthly interest: 500000 * 0.08 / 12 = 3333.33
      // Difference: 833.33
      expect(result.adjustedInterest).toBeGreaterThan(2500);
      expect(result.adjustedInterest).toBeCloseTo(3333.33, 0);
    });

    it("decreases loan repayment when rate falls", () => {
      const loan = {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: 500000,
        interestRate: 6.0,
        repaymentAmount: 3000,
      };
      const config: InterestRateFactorConfig = { changePercent: -1.0, applyTo: "all" };

      const result = applyInterestRateFactor(loan, config);

      // New monthly interest: 500000 * 0.05 / 12 = 2083.33
      expect(result.adjustedInterest).toBeCloseTo(2083.33, 0);
    });

    it("only affects specific property when applyTo is propertyId", () => {
      const loan = {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: 500000,
        interestRate: 6.0,
        repaymentAmount: 3000,
      };
      const config: InterestRateFactorConfig = { changePercent: 2.0, applyTo: "prop-2" };

      const result = applyInterestRateFactor(loan, config);

      // Should not be affected
      expect(result.adjustedInterest).toBeCloseTo(2500, 0);
    });
  });
});
