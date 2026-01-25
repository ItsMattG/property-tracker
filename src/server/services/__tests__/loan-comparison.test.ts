import { describe, it, expect } from "vitest";
import {
  calculateMonthlyPayment,
  calculateMonthlySavings,
  calculateTotalInterestSaved,
} from "../loan-comparison";

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

  describe("calculateMonthlySavings", () => {
    it("calculates positive savings when new rate is lower", () => {
      // $500,000, 360 months remaining
      // Current: 6% = $2,997.75
      // New: 5.5% = $2,838.95
      // Savings = $158.80
      const savings = calculateMonthlySavings(500000, 6, 5.5, 360);
      expect(savings).toBeCloseTo(158.80, 0);
    });

    it("returns negative when new rate is higher", () => {
      const savings = calculateMonthlySavings(500000, 5, 6, 360);
      expect(savings).toBeLessThan(0);
    });

    it("returns 0 when rates are equal", () => {
      const savings = calculateMonthlySavings(500000, 5.5, 5.5, 360);
      expect(savings).toBe(0);
    });
  });

  describe("calculateTotalInterestSaved", () => {
    it("calculates total interest saved over remaining term", () => {
      // Monthly savings of ~$158.80 over 360 months = ~$57,168
      const saved = calculateTotalInterestSaved(500000, 6, 5.5, 360);
      expect(saved).toBeCloseTo(57168, -2); // Within 100
    });

    it("returns 0 when rates are equal", () => {
      const saved = calculateTotalInterestSaved(500000, 5.5, 5.5, 360);
      expect(saved).toBe(0);
    });
  });
});
