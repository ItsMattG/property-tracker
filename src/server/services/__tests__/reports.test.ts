import { describe, it, expect } from "vitest";
import {
  getFinancialYearRange,
  calculateCategoryTotals,
  calculatePropertyMetrics,
} from "../reports";

describe("reports service", () => {
  describe("getFinancialYearRange", () => {
    it("returns correct range for FY 2025-26 (July 2025 - June 2026)", () => {
      const { startDate, endDate } = getFinancialYearRange(2026);

      expect(startDate).toBe("2025-07-01");
      expect(endDate).toBe("2026-06-30");
    });

    it("returns correct range for FY 2024-25", () => {
      const { startDate, endDate } = getFinancialYearRange(2025);

      expect(startDate).toBe("2024-07-01");
      expect(endDate).toBe("2025-06-30");
    });
  });

  describe("calculateCategoryTotals", () => {
    it("aggregates transactions by category", () => {
      const transactions: Array<{ category: string; amount: string; transactionType: string }> = [
        { category: "rental_income", amount: "2400.00", transactionType: "income" },
        { category: "rental_income", amount: "2400.00", transactionType: "income" },
        { category: "repairs_and_maintenance", amount: "-150.00", transactionType: "expense" },
        { category: "council_rates", amount: "-500.00", transactionType: "expense" },
      ];

      const result = calculateCategoryTotals(transactions);

      expect(result.get("rental_income")).toBe(4800);
      expect(result.get("repairs_and_maintenance")).toBe(-150);
      expect(result.get("council_rates")).toBe(-500);
    });

    it("returns empty map for no transactions", () => {
      const result = calculateCategoryTotals([]);

      expect(result.size).toBe(0);
    });
  });

  describe("calculatePropertyMetrics", () => {
    it("calculates income, expenses, and net for a property", () => {
      const transactions: Array<{ category: string; amount: string; transactionType: string }> = [
        { category: "rental_income", amount: "2400.00", transactionType: "income" },
        { category: "repairs_and_maintenance", amount: "-150.00", transactionType: "expense" },
        { category: "council_rates", amount: "-500.00", transactionType: "expense" },
      ];

      const result = calculatePropertyMetrics(transactions);

      expect(result.totalIncome).toBe(2400);
      expect(result.totalExpenses).toBe(650);
      expect(result.netIncome).toBe(1750);
      expect(result.totalDeductible).toBe(650);
    });
  });
});
