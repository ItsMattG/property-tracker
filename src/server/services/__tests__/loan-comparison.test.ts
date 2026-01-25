import { describe, it, expect } from "vitest";
import {
  calculateMonthlyPayment,
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
  generateAmortizationSchedule,
  AmortizationEntry,
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

  describe("calculateBreakEvenMonths", () => {
    it("calculates months to recover switching costs", () => {
      // $159/month savings, $3000 switching costs = ~19 months
      const months = calculateBreakEvenMonths(159, 3000);
      expect(months).toBeCloseTo(19, 0);
    });

    it("returns Infinity when savings are zero", () => {
      const months = calculateBreakEvenMonths(0, 3000);
      expect(months).toBe(Infinity);
    });

    it("returns Infinity when savings are negative", () => {
      const months = calculateBreakEvenMonths(-100, 3000);
      expect(months).toBe(Infinity);
    });

    it("returns 0 when switching costs are zero", () => {
      const months = calculateBreakEvenMonths(159, 0);
      expect(months).toBe(0);
    });
  });

  describe("generateAmortizationSchedule", () => {
    it("generates correct number of entries", () => {
      const schedule = generateAmortizationSchedule(100000, 5, 12);
      expect(schedule).toHaveLength(12);
    });

    it("has correct structure for each entry", () => {
      const schedule = generateAmortizationSchedule(100000, 5, 12);
      const first = schedule[0];

      expect(first).toHaveProperty("month");
      expect(first).toHaveProperty("payment");
      expect(first).toHaveProperty("principal");
      expect(first).toHaveProperty("interest");
      expect(first).toHaveProperty("balance");
    });

    it("ends with zero balance", () => {
      const schedule = generateAmortizationSchedule(100000, 5, 60);
      const last = schedule[schedule.length - 1];

      expect(last.balance).toBeCloseTo(0, 0);
    });

    it("first payment interest is correct", () => {
      // $100,000 at 5% = $416.67 first month interest
      const schedule = generateAmortizationSchedule(100000, 5, 60);
      expect(schedule[0].interest).toBeCloseTo(416.67, 0);
    });

    it("monthly payment stays constant", () => {
      const schedule = generateAmortizationSchedule(100000, 5, 60);
      const payments = schedule.map(e => e.payment);
      const firstPayment = payments[0];

      payments.forEach(p => {
        expect(p).toBeCloseTo(firstPayment, 0);
      });
    });
  });
});
