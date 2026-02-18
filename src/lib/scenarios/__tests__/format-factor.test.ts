import { describe, it, expect } from "vitest";

import { formatFactorDescription } from "../format-factor";

const properties = [
  { id: "prop-1", address: "123 Main St, Sydney" },
  { id: "prop-2", address: "456 Oak Ave, Melbourne" },
];

describe("formatFactorDescription", () => {
  it("formats interest rate change for all properties", () => {
    const result = formatFactorDescription(
      "interest_rate",
      { changePercent: 1.5, applyTo: "all" },
      properties
    );
    expect(result).toBe("Interest rate +1.5% on all properties");
  });

  it("formats interest rate change for specific property", () => {
    const result = formatFactorDescription(
      "interest_rate",
      { changePercent: -0.25, applyTo: "prop-1" },
      properties
    );
    expect(result).toBe("Interest rate -0.25% on 123 Main St, Sydney");
  });

  it("formats vacancy", () => {
    const result = formatFactorDescription(
      "vacancy",
      { propertyId: "prop-2", months: 3 },
      properties
    );
    expect(result).toBe("3 months vacancy on 456 Oak Ave, Melbourne");
  });

  it("formats rent change for all properties", () => {
    const result = formatFactorDescription(
      "rent_change",
      { changePercent: -10 },
      properties
    );
    expect(result).toBe("Rent -10% on all properties");
  });

  it("formats rent change for specific property", () => {
    const result = formatFactorDescription(
      "rent_change",
      { changePercent: 5, propertyId: "prop-1" },
      properties
    );
    expect(result).toBe("Rent +5% on 123 Main St, Sydney");
  });

  it("formats expense change", () => {
    const result = formatFactorDescription(
      "expense_change",
      { changePercent: 20 },
      properties
    );
    expect(result).toBe("Expenses +20% on all categories");
  });

  it("formats expense change with category", () => {
    const result = formatFactorDescription(
      "expense_change",
      { changePercent: -5, category: "insurance" },
      properties
    );
    expect(result).toBe("Expenses -5% on insurance");
  });

  it("formats sell property", () => {
    const result = formatFactorDescription(
      "sell_property",
      {
        propertyId: "prop-1",
        salePrice: 850000,
        sellingCosts: 25000,
        settlementMonth: 12,
      },
      properties
    );
    expect(result).toBe("Sell 123 Main St, Sydney for $850,000");
  });

  it("formats buy property", () => {
    const result = formatFactorDescription(
      "buy_property",
      {
        purchasePrice: 600000,
        deposit: 120000,
        loanAmount: 480000,
        interestRate: 6.5,
        expectedRent: 2500,
        expectedExpenses: 600,
        purchaseMonth: 6,
      },
      properties
    );
    expect(result).toBe("Buy property for $600,000 (loan $480,000 @ 6.5%)");
  });

  it("handles unknown property gracefully", () => {
    const result = formatFactorDescription(
      "vacancy",
      { propertyId: "nonexistent", months: 2 },
      properties
    );
    expect(result).toBe("2 months vacancy on Unknown property");
  });
});
