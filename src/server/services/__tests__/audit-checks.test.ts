import { describe, expect, it } from "vitest";
import {
  computeAuditScore,
  checkMissingKeyExpenses,
  checkUncategorizedTransactions,
  checkLoanInterestMissing,
  checkMissedDeductions,
  checkUnassignedTransactions,
  checkLargeUnverified,
  checkNoRentalIncome,
  type AuditCheckResult,
} from "../audit-checks";

describe("computeAuditScore", () => {
  it("returns 100 when no checks fail", () => {
    expect(computeAuditScore([])).toBe(100);
  });

  it("deducts 5 per info check", () => {
    const checks: AuditCheckResult[] = [
      { checkType: "unassigned_transactions", severity: "info", title: "t", message: "m", propertyId: null, affectedCount: 3 },
    ];
    expect(computeAuditScore(checks)).toBe(95);
  });

  it("deducts 10 per warning check", () => {
    const checks: AuditCheckResult[] = [
      { checkType: "missing_key_expense", severity: "warning", title: "t", message: "m", propertyId: "p1", affectedCount: 1 },
      { checkType: "no_rental_income", severity: "warning", title: "t", message: "m", propertyId: "p1", affectedCount: 1 },
    ];
    expect(computeAuditScore(checks)).toBe(80);
  });

  it("deducts 20 per critical check", () => {
    const checks: AuditCheckResult[] = [
      { checkType: "test", severity: "critical", title: "t", message: "m", propertyId: null, affectedCount: 1 },
    ];
    expect(computeAuditScore(checks)).toBe(80);
  });

  it("floors at zero", () => {
    const checks: AuditCheckResult[] = Array.from({ length: 20 }, (_, i) => ({
      checkType: `warn_${i}`,
      severity: "warning" as const,
      title: "t",
      message: "m",
      propertyId: null,
      affectedCount: 1,
    }));
    expect(computeAuditScore(checks)).toBe(0);
  });
});

describe("checkMissingKeyExpenses", () => {
  it("flags key expenses present last year but missing this year", () => {
    const currentTotals = new Map([["insurance", 1200]]);
    const priorTotals = new Map([["insurance", 1100], ["council_rates", 2000]]);

    const results = checkMissingKeyExpenses("p1", "10 Main St", currentTotals, priorTotals);
    expect(results).toHaveLength(1);
    expect(results[0].checkType).toBe("missing_key_expense");
    expect(results[0].severity).toBe("warning");
    expect(results[0].message).toContain("Council Rates");
    expect(results[0].propertyId).toBe("p1");
  });

  it("returns empty when all prior-year key expenses are present", () => {
    const currentTotals = new Map([["insurance", 1200], ["council_rates", 2100]]);
    const priorTotals = new Map([["insurance", 1100], ["council_rates", 2000]]);

    const results = checkMissingKeyExpenses("p1", "10 Main St", currentTotals, priorTotals);
    expect(results).toHaveLength(0);
  });

  it("ignores key expenses not present in prior year either", () => {
    const currentTotals = new Map<string, number>();
    const priorTotals = new Map<string, number>();

    const results = checkMissingKeyExpenses("p1", "10 Main St", currentTotals, priorTotals);
    expect(results).toHaveLength(0);
  });
});

describe("checkUncategorizedTransactions", () => {
  it("flags uncategorized transactions assigned to a property", () => {
    const txns = [
      { category: "uncategorized", propertyId: "p1", amount: "100", isVerified: false },
      { category: "insurance", propertyId: "p1", amount: "200", isVerified: true },
      { category: "uncategorized", propertyId: "p1", amount: "300", isVerified: false },
    ];

    const results = checkUncategorizedTransactions("p1", "10 Main St", txns);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
    expect(results[0].affectedCount).toBe(2);
  });

  it("returns empty when no uncategorized transactions", () => {
    const txns = [
      { category: "insurance", propertyId: "p1", amount: "200", isVerified: true },
    ];

    const results = checkUncategorizedTransactions("p1", "10 Main St", txns);
    expect(results).toHaveLength(0);
  });
});

describe("checkLoanInterestMissing", () => {
  it("flags property with loan but no interest recorded", () => {
    const hasLoan = true;
    const categoryTotals = new Map([["insurance", 1200]]);

    const results = checkLoanInterestMissing("p1", "10 Main St", hasLoan, categoryTotals);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
    expect(results[0].checkType).toBe("loan_interest_missing");
  });

  it("returns empty when loan interest is recorded", () => {
    const hasLoan = true;
    const categoryTotals = new Map([["interest_on_loans", 5000]]);

    const results = checkLoanInterestMissing("p1", "10 Main St", hasLoan, categoryTotals);
    expect(results).toHaveLength(0);
  });

  it("returns empty when property has no loan", () => {
    const hasLoan = false;
    const categoryTotals = new Map<string, number>();

    const results = checkLoanInterestMissing("p1", "10 Main St", hasLoan, categoryTotals);
    expect(results).toHaveLength(0);
  });
});

describe("checkMissedDeductions", () => {
  it("suggests commonly missed deductions not claimed", () => {
    const portfolioCats = new Set(["insurance", "council_rates"]);

    const results = checkMissedDeductions(portfolioCats);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe("info");
    expect(results[0].checkType).toBe("missed_deduction");
  });

  it("returns empty when all common deductions are claimed", () => {
    const portfolioCats = new Set([
      "insurance", "council_rates", "pest_control", "gardening",
      "stationery_and_postage", "water_charges", "land_tax",
      "body_corporate", "repairs_and_maintenance",
    ]);

    const results = checkMissedDeductions(portfolioCats);
    expect(results).toHaveLength(0);
  });
});

describe("checkUnassignedTransactions", () => {
  it("flags expense transactions with no property", () => {
    const txns = [
      { category: "insurance", propertyId: null, amount: "-200", transactionType: "expense", isVerified: true },
      { category: "insurance", propertyId: "p1", amount: "-200", transactionType: "expense", isVerified: true },
      { category: "rental_income", propertyId: null, amount: "500", transactionType: "income", isVerified: true },
    ];

    const result = checkUnassignedTransactions(txns);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("info");
    expect(result[0].affectedCount).toBe(1);
  });

  it("returns empty when all expenses are assigned", () => {
    const txns = [
      { category: "insurance", propertyId: "p1", amount: "-200", transactionType: "expense", isVerified: true },
    ];

    const result = checkUnassignedTransactions(txns);
    expect(result).toHaveLength(0);
  });
});

describe("checkLargeUnverified", () => {
  it("flags unverified transactions over $1000", () => {
    const txns = [
      { category: "repairs_and_maintenance", propertyId: "p1", amount: "-1500", isVerified: false, description: "Plumbing" },
      { category: "insurance", propertyId: "p1", amount: "-500", isVerified: false, description: "Insurance" },
      { category: "land_tax", propertyId: "p1", amount: "-2000", isVerified: true, description: "Land tax" },
    ];

    const results = checkLargeUnverified("p1", "10 Main St", txns);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].affectedCount).toBe(1);
  });

  it("returns empty when all large transactions are verified", () => {
    const txns = [
      { category: "land_tax", propertyId: "p1", amount: "-2000", isVerified: true, description: "Land tax" },
    ];

    const results = checkLargeUnverified("p1", "10 Main St", txns);
    expect(results).toHaveLength(0);
  });
});

describe("checkNoRentalIncome", () => {
  it("flags properties with no rental income", () => {
    const incomeTotals = new Map<string, number>();

    const results = checkNoRentalIncome("p1", "10 Main St", incomeTotals);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
  });

  it("returns empty when rental income exists", () => {
    const incomeTotals = new Map([["rental_income", 25000]]);

    const results = checkNoRentalIncome("p1", "10 Main St", incomeTotals);
    expect(results).toHaveLength(0);
  });
});
