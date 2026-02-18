import { describe, it, expect } from "vitest";
import { groupTransactionsByProperty } from "../taxPosition";

describe("groupTransactionsByProperty", () => {
  it("groups transactions by property with category breakdown", () => {
    const transactions = [
      { propertyId: "p1", category: "rental_income", amount: "2000", transactionType: "income" },
      { propertyId: "p1", category: "interest_on_loans", amount: "-500", transactionType: "expense" },
      { propertyId: "p1", category: "council_rates", amount: "-300", transactionType: "expense" },
      { propertyId: "p2", category: "rental_income", amount: "1500", transactionType: "income" },
      { propertyId: "p2", category: "insurance", amount: "-200", transactionType: "expense" },
    ];
    const properties = [
      { id: "p1", address: "1 Test St", suburb: "Testville" },
      { id: "p2", address: "2 Demo Ave", suburb: "Demoton" },
    ];

    const result = groupTransactionsByProperty(transactions, properties);

    expect(result.properties).toHaveLength(2);

    const p1 = result.properties.find((p) => p.propertyId === "p1")!;
    expect(p1.address).toBe("1 Test St");
    expect(p1.income).toBe(2000);
    expect(p1.expenses).toBe(800);
    expect(p1.netResult).toBe(1200);
    expect(p1.categories).toHaveLength(3);
    expect(p1.categories.find((c) => c.category === "interest_on_loans")?.amount).toBe(500);
    expect(p1.categories.find((c) => c.category === "interest_on_loans")?.atoReference).toBe("D8");

    expect(result.totals.income).toBe(3500);
    expect(result.totals.expenses).toBe(1000);
    expect(result.totals.netResult).toBe(2500);
  });

  it("puts transactions without propertyId into unallocated", () => {
    const transactions = [
      { propertyId: null, category: "rental_income", amount: "1000", transactionType: "income" },
      { propertyId: null, category: "insurance", amount: "-200", transactionType: "expense" },
    ];

    const result = groupTransactionsByProperty(transactions, []);

    expect(result.properties).toHaveLength(0);
    expect(result.unallocated.income).toBe(1000);
    expect(result.unallocated.expenses).toBe(200);
    expect(result.unallocated.categories).toHaveLength(2);
  });

  it("returns empty results for no transactions", () => {
    const result = groupTransactionsByProperty([], []);

    expect(result.properties).toHaveLength(0);
    expect(result.totals.income).toBe(0);
    expect(result.totals.expenses).toBe(0);
    expect(result.totals.netResult).toBe(0);
  });

  it("excludes capital and other category types from breakdown", () => {
    const transactions = [
      { propertyId: "p1", category: "stamp_duty", amount: "-50000", transactionType: "expense" },
      { propertyId: "p1", category: "transfer", amount: "100", transactionType: "income" },
      { propertyId: "p1", category: "rental_income", amount: "2000", transactionType: "income" },
    ];
    const properties = [{ id: "p1", address: "1 Test St", suburb: "Testville" }];

    const result = groupTransactionsByProperty(transactions, properties);
    const p1 = result.properties[0];
    // Only rental_income should appear (income/expense types)
    // stamp_duty is capital type, transfer is other type — excluded
    expect(p1.categories).toHaveLength(1);
    expect(p1.categories[0].category).toBe("rental_income");
  });
});
