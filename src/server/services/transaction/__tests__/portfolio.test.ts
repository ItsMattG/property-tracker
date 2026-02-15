import { describe, it, expect } from "vitest";
import {
  calculateEquity,
  calculateLVR,
  calculateCashFlow,
  calculateGrossYield,
  calculateNetYield,
  findBestWorst,
} from "../portfolio";

describe("portfolio calculations", () => {
  describe("calculateEquity", () => {
    it("returns value minus total loan balance", () => {
      const result = calculateEquity(500000, 300000);
      expect(result).toBe(200000);
    });

    it("returns full value when no loans", () => {
      const result = calculateEquity(500000, 0);
      expect(result).toBe(500000);
    });

    it("returns negative equity when underwater", () => {
      const result = calculateEquity(400000, 450000);
      expect(result).toBe(-50000);
    });

    it("returns negative when no value set but has loans", () => {
      const result = calculateEquity(0, 300000);
      expect(result).toBe(-300000);
    });
  });

  describe("calculateLVR", () => {
    it("calculates LVR as percentage", () => {
      const result = calculateLVR(300000, 500000);
      expect(result).toBe(60);
    });

    it("returns 0 when no loans", () => {
      const result = calculateLVR(0, 500000);
      expect(result).toBe(0);
    });

    it("returns null when no value set", () => {
      const result = calculateLVR(300000, 0);
      expect(result).toBeNull();
    });

    it("handles over 100% LVR", () => {
      const result = calculateLVR(550000, 500000);
      expect(result).toBeCloseTo(110);
    });
  });

  describe("calculateCashFlow", () => {
    it("calculates income minus expenses", () => {
      const transactions = [
        { amount: "2400", transactionType: "income" },
        { amount: "-500", transactionType: "expense" },
        { amount: "-300", transactionType: "expense" },
      ];
      const result = calculateCashFlow(transactions as any);
      expect(result).toBe(1600);
    });

    it("returns 0 for empty transactions", () => {
      const result = calculateCashFlow([]);
      expect(result).toBe(0);
    });

    it("ignores transfer and personal transactions", () => {
      const transactions = [
        { amount: "2400", transactionType: "income" },
        { amount: "-1000", transactionType: "transfer" },
        { amount: "-500", transactionType: "personal" },
      ];
      const result = calculateCashFlow(transactions as any);
      expect(result).toBe(2400);
    });
  });

  describe("calculateGrossYield", () => {
    it("calculates annual income / value * 100", () => {
      const result = calculateGrossYield(24000, 500000);
      expect(result).toBe(4.8);
    });

    it("returns null when no value", () => {
      const result = calculateGrossYield(24000, 0);
      expect(result).toBeNull();
    });

    it("returns 0 when no income", () => {
      const result = calculateGrossYield(0, 500000);
      expect(result).toBe(0);
    });
  });

  describe("calculateNetYield", () => {
    it("calculates (income - expenses) / value * 100", () => {
      const result = calculateNetYield(24000, 12000, 500000);
      expect(result).toBe(2.4);
    });

    it("returns null when no value", () => {
      const result = calculateNetYield(24000, 12000, 0);
      expect(result).toBeNull();
    });

    it("handles negative net yield", () => {
      const result = calculateNetYield(12000, 24000, 500000);
      expect(result).toBe(-2.4);
    });
  });

  describe("findBestWorst", () => {
    it("finds best and worst performers", () => {
      const values = [
        { id: "a", value: 100 },
        { id: "b", value: 300 },
        { id: "c", value: 200 },
      ];
      const result = findBestWorst(values, "value");
      expect(result.best).toBe("b");
      expect(result.worst).toBe("a");
    });

    it("handles single item", () => {
      const values = [{ id: "a", value: 100 }];
      const result = findBestWorst(values, "value");
      expect(result.best).toBe("a");
      expect(result.worst).toBe("a");
    });

    it("handles empty array", () => {
      const result = findBestWorst([], "value");
      expect(result.best).toBeNull();
      expect(result.worst).toBeNull();
    });

    it("handles null values", () => {
      const values = [
        { id: "a", value: null },
        { id: "b", value: 300 },
        { id: "c", value: null },
      ];
      const result = findBestWorst(values, "value");
      expect(result.best).toBe("b");
      expect(result.worst).toBe("b");
    });
  });
});
