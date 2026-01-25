import { describe, it, expect } from "vitest";
import { calculateMonthlyPayment } from "../loan-comparison";

describe("loan-comparison service", () => {
  describe("calculateMonthlyPayment", () => {
    it("calculates monthly payment for P&I loan", () => {
      // $500,000 at 6% over 30 years = $2,997.75/month
      const payment = calculateMonthlyPayment(500000, 6, 360);
      expect(payment).toBeCloseTo(2997.75, 0);
    });

    it("calculates monthly payment for smaller loan", () => {
      // $300,000 at 5% over 25 years = $1,753.77/month
      const payment = calculateMonthlyPayment(300000, 5, 300);
      expect(payment).toBeCloseTo(1753.77, 0);
    });

    it("returns 0 for zero principal", () => {
      const payment = calculateMonthlyPayment(0, 6, 360);
      expect(payment).toBe(0);
    });

    it("returns principal/months for zero rate", () => {
      const payment = calculateMonthlyPayment(120000, 0, 120);
      expect(payment).toBe(1000);
    });
  });
});
