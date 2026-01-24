import { describe, it, expect } from "vitest";
import {
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  calculateSimilarity,
} from "../anomaly";

describe("anomaly service", () => {
  describe("detectUnusualAmount", () => {
    it("returns null when amount is within 30% of average", () => {
      const result = detectUnusualAmount(
        { amount: "120", description: "Water bill" },
        { avg: 100, count: 6 }
      );
      expect(result).toBeNull();
    });

    it("returns alert when amount exceeds 30% above average", () => {
      const result = detectUnusualAmount(
        { amount: "150", description: "Water bill" },
        { avg: 100, count: 6 }
      );
      expect(result).not.toBeNull();
      expect(result?.alertType).toBe("unusual_amount");
      expect(result?.severity).toBe("warning");
    });

    it("returns null when historical count is less than 3", () => {
      const result = detectUnusualAmount(
        { amount: "200", description: "Water bill" },
        { avg: 100, count: 2 }
      );
      expect(result).toBeNull();
    });
  });

  describe("detectDuplicates", () => {
    it("returns null when no duplicates found", () => {
      const transaction = {
        id: "tx1",
        amount: "100",
        date: "2026-01-15",
        description: "Insurance Co",
      };
      const recent = [
        { id: "tx2", amount: "200", date: "2026-01-15", description: "Other" },
      ];
      const result = detectDuplicates(transaction, recent);
      expect(result).toBeNull();
    });

    it("returns alert when same amount and similar date found", () => {
      const transaction = {
        id: "tx1",
        amount: "100",
        date: "2026-01-15",
        description: "Insurance Co",
      };
      const recent = [
        { id: "tx2", amount: "100", date: "2026-01-14", description: "Insurance Co" },
      ];
      const result = detectDuplicates(transaction, recent);
      expect(result).not.toBeNull();
      expect(result?.alertType).toBe("duplicate_transaction");
    });

    it("ignores transactions with different amounts", () => {
      const transaction = {
        id: "tx1",
        amount: "100",
        date: "2026-01-15",
        description: "Insurance Co",
      };
      const recent = [
        { id: "tx2", amount: "100.50", date: "2026-01-15", description: "Insurance Co" },
      ];
      const result = detectDuplicates(transaction, recent);
      expect(result).toBeNull();
    });
  });

  describe("detectUnexpectedExpense", () => {
    it("returns null for amounts under $500", () => {
      const result = detectUnexpectedExpense(
        { amount: "-400", description: "New Plumber" },
        new Set(["Old Plumber"])
      );
      expect(result).toBeNull();
    });

    it("returns null for known merchants", () => {
      const result = detectUnexpectedExpense(
        { amount: "-600", description: "Old Plumber" },
        new Set(["Old Plumber"])
      );
      expect(result).toBeNull();
    });

    it("returns alert for large expense from new merchant", () => {
      const result = detectUnexpectedExpense(
        { amount: "-600", description: "New Plumber" },
        new Set(["Old Plumber"])
      );
      expect(result).not.toBeNull();
      expect(result?.alertType).toBe("unexpected_expense");
      expect(result?.severity).toBe("info");
    });

    it("returns null for income transactions", () => {
      const result = detectUnexpectedExpense(
        { amount: "600", description: "New Tenant" },
        new Set([])
      );
      expect(result).toBeNull();
    });
  });

  describe("calculateSimilarity", () => {
    it("returns 1 for identical strings", () => {
      expect(calculateSimilarity("test", "test")).toBe(1);
    });

    it("returns 0 for completely different strings", () => {
      expect(calculateSimilarity("abc", "xyz")).toBe(0);
    });

    it("returns partial score for similar strings", () => {
      const score = calculateSimilarity("Insurance Co Payment", "Insurance Co");
      expect(score).toBeGreaterThan(0.5);
    });
  });
});
