import { describe, it, expect } from "vitest";
import {
  calculateNextDates,
  generateExpectedTransactions,
  findMatchingTransactions,
  findMissedTransactions,
  detectPatterns,
  type Frequency,
} from "../recurring";
import type { RecurringTransaction, Transaction, ExpectedTransaction } from "../../db/schema";

describe("recurring service", () => {
  describe("calculateNextDates", () => {
    it("generates weekly dates", () => {
      const template = {
        frequency: "weekly" as Frequency,
        dayOfWeek: "1", // Monday
        dayOfMonth: null,
        startDate: "2024-01-01",
        endDate: null,
      };

      const fromDate = new Date("2024-01-01"); // Monday
      const dates = calculateNextDates(template, fromDate, 20);

      expect(dates).toHaveLength(3);
      expect(dates.map((d) => d.toISOString().split("T")[0])).toEqual([
        "2024-01-01",
        "2024-01-08",
        "2024-01-15",
      ]);
    });

    it("generates fortnightly dates", () => {
      const template = {
        frequency: "fortnightly" as Frequency,
        dayOfWeek: "5", // Friday
        dayOfMonth: null,
        startDate: "2024-01-05",
        endDate: null,
      };

      const fromDate = new Date("2024-01-01");
      const dates = calculateNextDates(template, fromDate, 30);

      expect(dates).toHaveLength(2);
      expect(dates.map((d) => d.toISOString().split("T")[0])).toEqual([
        "2024-01-05",
        "2024-01-19",
      ]);
    });

    it("generates monthly dates", () => {
      const template = {
        frequency: "monthly" as Frequency,
        dayOfMonth: "15",
        dayOfWeek: null,
        startDate: "2024-01-01",
        endDate: null,
      };

      const fromDate = new Date("2024-01-01");
      const dates = calculateNextDates(template, fromDate, 60);

      expect(dates).toHaveLength(2);
      expect(dates.map((d) => d.toISOString().split("T")[0])).toEqual([
        "2024-01-15",
        "2024-02-15",
      ]);
    });

    it("handles month-end edge cases (31st in February)", () => {
      const template = {
        frequency: "monthly" as Frequency,
        dayOfMonth: "31",
        dayOfWeek: null,
        startDate: "2024-01-01",
        endDate: null,
      };

      const fromDate = new Date("2024-01-01");
      const dates = calculateNextDates(template, fromDate, 90);

      expect(dates.length).toBeGreaterThanOrEqual(2);
      // January 31st
      expect(dates[0].toISOString().split("T")[0]).toBe("2024-01-31");
      // February should fall back to 29th (2024 is leap year)
      expect(dates[1].toISOString().split("T")[0]).toBe("2024-02-29");
    });

    it("generates quarterly dates", () => {
      const template = {
        frequency: "quarterly" as Frequency,
        dayOfMonth: "1",
        dayOfWeek: null,
        startDate: "2024-01-01",
        endDate: null,
      };

      const fromDate = new Date("2024-01-01");
      const dates = calculateNextDates(template, fromDate, 180);

      expect(dates).toHaveLength(2);
      expect(dates.map((d) => d.toISOString().split("T")[0])).toEqual([
        "2024-01-01",
        "2024-04-01",
      ]);
    });

    it("generates annually dates", () => {
      const template = {
        frequency: "annually" as Frequency,
        dayOfMonth: "15",
        dayOfWeek: null,
        startDate: "2024-03-15",
        endDate: null,
      };

      const fromDate = new Date("2024-03-01");
      const dates = calculateNextDates(template, fromDate, 400);

      expect(dates).toHaveLength(2);
      expect(dates.map((d) => d.toISOString().split("T")[0])).toEqual([
        "2024-03-15",
        "2025-03-15",
      ]);
    });

    it("respects end date", () => {
      const template = {
        frequency: "weekly" as Frequency,
        dayOfWeek: "1",
        dayOfMonth: null,
        startDate: "2024-01-01",
        endDate: "2024-01-10",
      };

      const fromDate = new Date("2024-01-01");
      const dates = calculateNextDates(template, fromDate, 30);

      expect(dates).toHaveLength(2);
      expect(dates.map((d) => d.toISOString().split("T")[0])).toEqual([
        "2024-01-01",
        "2024-01-08",
      ]);
    });

    it("respects start date when fromDate is earlier", () => {
      const template = {
        frequency: "weekly" as Frequency,
        dayOfWeek: "1",
        dayOfMonth: null,
        startDate: "2024-01-15",
        endDate: null,
      };

      const fromDate = new Date("2024-01-01");
      const dates = calculateNextDates(template, fromDate, 30);

      // Should only return dates on or after start date
      expect(dates.every((d) => d >= new Date("2024-01-15"))).toBe(true);
    });
  });

  describe("generateExpectedTransactions", () => {
    it("generates expected transactions from template", () => {
      const template = {
        id: "recurring-1",
        userId: "user-1",
        propertyId: "property-1",
        description: "Body Corporate",
        amount: "1500.00",
        category: "body_corporate",
        transactionType: "expense",
        frequency: "quarterly" as Frequency,
        dayOfMonth: "1",
        dayOfWeek: null,
        startDate: "2024-01-01",
        endDate: null,
        linkedBankAccountId: null,
        amountTolerance: "5.00",
        dateTolerance: "3",
        alertDelayDays: "3",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RecurringTransaction;

      const result = generateExpectedTransactions(
        template,
        new Date("2024-01-01"),
        100
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        recurringTransactionId: "recurring-1",
        userId: "user-1",
        propertyId: "property-1",
        expectedDate: "2024-01-01",
        expectedAmount: "1500.00",
      });
    });

    it("excludes dates that already have expected transactions", () => {
      const template = {
        id: "recurring-1",
        userId: "user-1",
        propertyId: "property-1",
        description: "Rent",
        amount: "2400.00",
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly" as Frequency,
        dayOfMonth: "1",
        dayOfWeek: null,
        startDate: "2024-01-01",
        endDate: null,
        linkedBankAccountId: null,
        amountTolerance: "5.00",
        dateTolerance: "3",
        alertDelayDays: "3",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RecurringTransaction;

      const existingDates = ["2024-01-01"];
      const result = generateExpectedTransactions(
        template,
        new Date("2024-01-01"),
        45,
        existingDates
      );

      expect(result).toHaveLength(1);
      expect(result[0].expectedDate).toBe("2024-02-01");
    });
  });

  describe("findMatchingTransactions", () => {
    const baseTransaction = {
      id: "tx-1",
      userId: "user-1",
      propertyId: "property-1",
      bankAccountId: null,
      basiqTransactionId: null,
      date: "2024-01-15",
      description: "Payment",
      amount: "-1500.00",
      category: "body_corporate",
      transactionType: "expense",
      isDeductible: true,
      isVerified: false,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Transaction;

    it("finds high confidence match (exact amount, within 2 days)", () => {
      const expected = {
        expectedDate: "2024-01-15",
        expectedAmount: "1500.00",
        propertyId: "property-1",
      };

      const candidates = [baseTransaction];
      const matches = findMatchingTransactions(expected, candidates, 5, 3);

      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBe("high");
      expect(matches[0].transaction.id).toBe("tx-1");
    });

    it("finds medium confidence match (within 5%, within 5 days)", () => {
      const expected = {
        expectedDate: "2024-01-15",
        expectedAmount: "1500.00",
        propertyId: "property-1",
      };

      const candidates = [
        {
          ...baseTransaction,
          amount: "-1560.00", // 4% difference
          date: "2024-01-18", // 3 days difference
        },
      ];
      const matches = findMatchingTransactions(expected, candidates, 5, 5);

      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBe("medium");
    });

    it("excludes transactions outside tolerance", () => {
      const expected = {
        expectedDate: "2024-01-15",
        expectedAmount: "1500.00",
        propertyId: "property-1",
      };

      const candidates = [
        {
          ...baseTransaction,
          amount: "-1800.00", // 20% difference
        },
      ];
      const matches = findMatchingTransactions(expected, candidates, 5, 3);

      expect(matches).toHaveLength(0);
    });

    it("excludes transactions from different property", () => {
      const expected = {
        expectedDate: "2024-01-15",
        expectedAmount: "1500.00",
        propertyId: "property-1",
      };

      const candidates = [
        {
          ...baseTransaction,
          propertyId: "property-2",
        },
      ];
      const matches = findMatchingTransactions(expected, candidates, 5, 3);

      expect(matches).toHaveLength(0);
    });

    it("sorts matches by confidence then date difference", () => {
      const expected = {
        expectedDate: "2024-01-15",
        expectedAmount: "1500.00",
        propertyId: "property-1",
      };

      const candidates = [
        { ...baseTransaction, id: "tx-1", date: "2024-01-18", amount: "-1530.00" }, // medium
        { ...baseTransaction, id: "tx-2", date: "2024-01-15", amount: "-1500.00" }, // high
        { ...baseTransaction, id: "tx-3", date: "2024-01-16", amount: "-1505.00" }, // high
      ];
      const matches = findMatchingTransactions(expected, candidates, 5, 5);

      expect(matches).toHaveLength(3);
      expect(matches[0].transaction.id).toBe("tx-2"); // high, 0 days
      expect(matches[1].transaction.id).toBe("tx-3"); // high, 1 day
      expect(matches[2].transaction.id).toBe("tx-1"); // medium
    });
  });

  describe("findMissedTransactions", () => {
    it("identifies missed transactions past alert delay", () => {
      const expected: ExpectedTransaction[] = [
        {
          id: "exp-1",
          recurringTransactionId: "rec-1",
          userId: "user-1",
          propertyId: "property-1",
          expectedDate: "2024-01-01",
          expectedAmount: "1500.00",
          status: "pending",
          matchedTransactionId: null,
          createdAt: new Date(),
        },
        {
          id: "exp-2",
          recurringTransactionId: "rec-1",
          userId: "user-1",
          propertyId: "property-1",
          expectedDate: "2024-01-15",
          expectedAmount: "1500.00",
          status: "pending",
          matchedTransactionId: null,
          createdAt: new Date(),
        },
      ];

      // Today is Jan 10 - first expected (Jan 1) is 9 days old, past 3-day delay
      const today = new Date("2024-01-10");
      const missed = findMissedTransactions(expected, today);

      expect(missed).toEqual(["exp-1"]);
    });

    it("skips already matched or skipped transactions", () => {
      const expected: ExpectedTransaction[] = [
        {
          id: "exp-1",
          recurringTransactionId: "rec-1",
          userId: "user-1",
          propertyId: "property-1",
          expectedDate: "2024-01-01",
          expectedAmount: "1500.00",
          status: "matched",
          matchedTransactionId: "tx-1",
          createdAt: new Date(),
        },
        {
          id: "exp-2",
          recurringTransactionId: "rec-1",
          userId: "user-1",
          propertyId: "property-1",
          expectedDate: "2024-01-01",
          expectedAmount: "1500.00",
          status: "skipped",
          matchedTransactionId: null,
          createdAt: new Date(),
        },
      ];

      const today = new Date("2024-01-10");
      const missed = findMissedTransactions(expected, today);

      expect(missed).toEqual([]);
    });
  });

  describe("detectPatterns", () => {
    it("detects monthly pattern from 3+ transactions", () => {
      const transactions: Transaction[] = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: "property-1",
          bankAccountId: null,
          basiqTransactionId: null,
          date: "2024-01-15",
          description: "Body Corporate",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
          isDeductible: true,
          isVerified: false,
          notes: null,
          suggestedCategory: null,
          suggestionConfidence: null,
          suggestionStatus: null,
          status: "confirmed",
          providerTransactionId: null,
          provider: null,
          claimPercent: null,
          invoiceUrl: null,
          invoicePresent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tx-2",
          userId: "user-1",
          propertyId: "property-1",
          bankAccountId: null,
          basiqTransactionId: null,
          date: "2024-02-15",
          description: "Body Corporate",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
          isDeductible: true,
          isVerified: false,
          notes: null,
          suggestedCategory: null,
          suggestionConfidence: null,
          suggestionStatus: null,
          status: "confirmed",
          providerTransactionId: null,
          provider: null,
          claimPercent: null,
          invoiceUrl: null,
          invoicePresent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tx-3",
          userId: "user-1",
          propertyId: "property-1",
          bankAccountId: null,
          basiqTransactionId: null,
          date: "2024-03-15",
          description: "Body Corporate",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
          isDeductible: true,
          isVerified: false,
          notes: null,
          suggestedCategory: null,
          suggestionConfidence: null,
          suggestionStatus: null,
          status: "confirmed",
          providerTransactionId: null,
          provider: null,
          claimPercent: null,
          invoiceUrl: null,
          invoicePresent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const patterns = detectPatterns(transactions);

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns[0].frequency).toBe("monthly");
      expect(patterns[0].category).toBe("body_corporate");
      expect(patterns[0].confidence).toBeGreaterThan(0.7);
    });

    it("requires minimum 3 transactions for pattern", () => {
      const transactions: Transaction[] = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: "property-1",
          bankAccountId: null,
          basiqTransactionId: null,
          date: "2024-01-15",
          description: "Body Corporate",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
          isDeductible: true,
          isVerified: false,
          notes: null,
          suggestedCategory: null,
          suggestionConfidence: null,
          suggestionStatus: null,
          status: "confirmed",
          providerTransactionId: null,
          provider: null,
          claimPercent: null,
          invoiceUrl: null,
          invoicePresent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tx-2",
          userId: "user-1",
          propertyId: "property-1",
          bankAccountId: null,
          basiqTransactionId: null,
          date: "2024-02-15",
          description: "Body Corporate",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
          isDeductible: true,
          isVerified: false,
          notes: null,
          suggestedCategory: null,
          suggestionConfidence: null,
          suggestionStatus: null,
          status: "confirmed",
          providerTransactionId: null,
          provider: null,
          claimPercent: null,
          invoiceUrl: null,
          invoicePresent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const patterns = detectPatterns(transactions);

      expect(patterns).toHaveLength(0);
    });

    it("excludes transactions without propertyId", () => {
      const transactions: Transaction[] = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: null, // No property
          bankAccountId: null,
          basiqTransactionId: null,
          date: "2024-01-15",
          description: "Personal",
          amount: "-500.00",
          category: "personal",
          transactionType: "personal",
          isDeductible: false,
          isVerified: false,
          notes: null,
          suggestedCategory: null,
          suggestionConfidence: null,
          suggestionStatus: null,
          status: "confirmed",
          providerTransactionId: null,
          provider: null,
          claimPercent: null,
          invoiceUrl: null,
          invoicePresent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const patterns = detectPatterns(transactions);

      expect(patterns).toHaveLength(0);
    });
  });
});
