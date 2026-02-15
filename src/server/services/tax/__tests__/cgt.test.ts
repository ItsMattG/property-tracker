import { describe, it, expect } from "vitest";
import { calculateCostBase, calculateCapitalGain, monthsBetween } from "../cgt";

describe("cgt service", () => {
  describe("calculateCostBase", () => {
    it("returns purchase price when no capital transactions", () => {
      const result = calculateCostBase("850000", []);
      expect(result).toBe(850000);
    });

    it("adds capital transaction amounts to purchase price", () => {
      const transactions = [
        { category: "stamp_duty", amount: "-35200" },
        { category: "conveyancing", amount: "-1800" },
        { category: "buyers_agent_fees", amount: "-8500" },
      ];
      const result = calculateCostBase("850000", transactions);
      expect(result).toBe(850000 + 35200 + 1800 + 8500);
    });

    it("ignores non-capital transaction categories", () => {
      const transactions = [
        { category: "stamp_duty", amount: "-35200" },
        { category: "rental_income", amount: "2400" },
        { category: "insurance", amount: "-500" },
      ];
      const result = calculateCostBase("850000", transactions);
      expect(result).toBe(850000 + 35200);
    });
  });

  describe("monthsBetween", () => {
    it("calculates months between two dates", () => {
      expect(monthsBetween("2024-01-15", "2025-01-15")).toBe(12);
    });

    it("handles partial months", () => {
      expect(monthsBetween("2024-01-15", "2024-07-14")).toBe(6);
    });

    it("returns 0 for same date", () => {
      expect(monthsBetween("2024-01-15", "2024-01-15")).toBe(0);
    });
  });

  describe("calculateCapitalGain", () => {
    it("calculates gain with 50% discount when held over 12 months", () => {
      const result = calculateCapitalGain({
        costBase: 900000,
        salePrice: 1100000,
        sellingCosts: {
          agentCommission: 22000,
          legalFees: 1500,
          marketingCosts: 3000,
          otherSellingCosts: 0,
        },
        purchaseDate: "2022-01-15",
        settlementDate: "2025-06-15",
      });

      expect(result.heldOverTwelveMonths).toBe(true);
      // Net proceeds: 1100000 - 26500 = 1073500
      // Capital gain: 1073500 - 900000 = 173500
      expect(result.capitalGain).toBe(173500);
      // Discounted: 173500 * 0.5 = 86750
      expect(result.discountedGain).toBe(86750);
    });

    it("does not apply discount when held under 12 months", () => {
      const result = calculateCapitalGain({
        costBase: 900000,
        salePrice: 1100000,
        sellingCosts: {
          agentCommission: 22000,
          legalFees: 1500,
          marketingCosts: 3000,
          otherSellingCosts: 0,
        },
        purchaseDate: "2025-01-15",
        settlementDate: "2025-06-15",
      });

      expect(result.heldOverTwelveMonths).toBe(false);
      expect(result.capitalGain).toBe(173500);
      expect(result.discountedGain).toBe(173500); // No discount
    });

    it("does not apply discount on capital loss", () => {
      const result = calculateCapitalGain({
        costBase: 900000,
        salePrice: 800000,
        sellingCosts: {
          agentCommission: 16000,
          legalFees: 1500,
          marketingCosts: 0,
          otherSellingCosts: 0,
        },
        purchaseDate: "2022-01-15",
        settlementDate: "2025-06-15",
      });

      expect(result.heldOverTwelveMonths).toBe(true);
      // Net proceeds: 800000 - 17500 = 782500
      // Capital loss: 782500 - 900000 = -117500
      expect(result.capitalGain).toBe(-117500);
      // No discount on loss
      expect(result.discountedGain).toBe(-117500);
    });

    it("handles exactly 12 months as eligible for discount", () => {
      const result = calculateCapitalGain({
        costBase: 500000,
        salePrice: 600000,
        sellingCosts: {
          agentCommission: 12000,
          legalFees: 1000,
          marketingCosts: 0,
          otherSellingCosts: 0,
        },
        purchaseDate: "2024-01-15",
        settlementDate: "2025-01-15",
      });

      expect(result.heldOverTwelveMonths).toBe(true);
    });
  });
});
