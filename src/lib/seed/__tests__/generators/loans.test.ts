import { describe, it, expect } from "vitest";
import { generateLoan, generateRefinanceAlert } from "../../generators/loans";

describe("generateLoan", () => {
  it("creates a P&I loan", () => {
    const loan = generateLoan({
      userId: "user-123",
      propertyId: "prop-123",
      lender: "Commonwealth Bank",
      loanType: "principal_and_interest",
      rateType: "variable",
      originalAmount: 680000,
      currentBalance: 620000,
      interestRate: 6.29,
      repaymentAmount: 4200,
      repaymentFrequency: "monthly",
    });

    expect(loan.id).toBeDefined();
    expect(loan.loanType).toBe("principal_and_interest");
    expect(loan.rateType).toBe("variable");
    expect(loan.interestRate).toBe("6.29");
  });

  it("creates a fixed rate loan with expiry", () => {
    const loan = generateLoan({
      userId: "user-123",
      propertyId: "prop-123",
      lender: "ANZ",
      loanType: "interest_only",
      rateType: "fixed",
      originalAmount: 576000,
      currentBalance: 576000,
      interestRate: 6.45,
      fixedRateExpiry: new Date("2026-02-28"),
      repaymentAmount: 3100,
      repaymentFrequency: "monthly",
    });

    expect(loan.rateType).toBe("fixed");
    expect(loan.fixedRateExpiry).toBe("2026-02-28");
  });
});

describe("generateRefinanceAlert", () => {
  it("creates a refinance alert for a loan", () => {
    const alert = generateRefinanceAlert({
      loanId: "loan-123",
      enabled: true,
      rateGapThreshold: 0.5,
    });

    expect(alert.loanId).toBe("loan-123");
    expect(alert.enabled).toBe(true);
    expect(alert.rateGapThreshold).toBe("0.50");
  });
});
