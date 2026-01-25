import { describe, it, expect } from "vitest";
import { generateTransactions, generateBankAccount } from "../../generators/transactions";

describe("generateBankAccount", () => {
  it("creates a bank account with required fields", () => {
    const account = generateBankAccount({
      userId: "user-123",
      institution: "Commonwealth Bank",
      accountName: "Property Expenses",
      accountType: "transaction",
    });

    expect(account.id).toBeDefined();
    expect(account.userId).toBe("user-123");
    expect(account.institution).toBe("Commonwealth Bank");
    expect(account.accountType).toBe("transaction");
    expect(account.isConnected).toBe(true);
  });
});

describe("generateTransactions", () => {
  it("generates monthly rent transactions", () => {
    const transactions = generateTransactions({
      userId: "user-123",
      bankAccountId: "account-123",
      propertyId: "prop-123",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-06-30"),
      patterns: [
        {
          merchantName: "Rental Income",
          category: "rental_income",
          transactionType: "income",
          frequency: "monthly",
          amountRange: { min: 2500, max: 2500 },
          dayOfMonth: 1,
        },
      ],
    });

    expect(transactions.length).toBe(6);
    expect(transactions.every((t) => t.category === "rental_income")).toBe(true);
    expect(transactions.every((t) => parseFloat(t.amount) > 0)).toBe(true);
  });

  it("generates quarterly transactions", () => {
    const transactions = generateTransactions({
      userId: "user-123",
      bankAccountId: "account-123",
      propertyId: "prop-123",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      patterns: [
        {
          merchantName: "Water Bill",
          category: "water_charges",
          transactionType: "expense",
          frequency: "quarterly",
          amountRange: { min: 200, max: 200 },
        },
      ],
    });

    expect(transactions.length).toBe(4);
    expect(transactions.every((t) => parseFloat(t.amount) < 0)).toBe(true);
  });

  it("skips rent during vacancy periods", () => {
    const transactions = generateTransactions({
      userId: "user-123",
      bankAccountId: "account-123",
      propertyId: "prop-123",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-06-30"),
      patterns: [
        {
          merchantName: "Rental Income",
          category: "rental_income",
          transactionType: "income",
          frequency: "monthly",
          amountRange: { min: 2500, max: 2500 },
        },
      ],
      vacancyPeriods: [
        { start: new Date("2024-03-01"), end: new Date("2024-04-30") },
      ],
    });

    expect(transactions.length).toBe(4);
  });
});
