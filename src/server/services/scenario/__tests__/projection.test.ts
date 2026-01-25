import { describe, it, expect } from "vitest";
import {
  applyInterestRateFactor,
  applyVacancyFactor,
  applyRentChangeFactor,
  applyExpenseChangeFactor,
  projectMonth,
  runProjection,
  type PortfolioState,
  type ScenarioFactorInput,
  type ProjectionResult,
} from "../projection";
import type { InterestRateFactorConfig, VacancyFactorConfig } from "../types";

describe("Projection Engine", () => {
  describe("applyInterestRateFactor", () => {
    it("increases loan repayment when rate rises", () => {
      const loan = {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: 500000,
        interestRate: 6.0,
        repaymentAmount: 3000,
      };
      const config: InterestRateFactorConfig = { changePercent: 2.0, applyTo: "all" };

      const result = applyInterestRateFactor(loan, config);

      // Original monthly interest: 500000 * 0.06 / 12 = 2500
      // New monthly interest: 500000 * 0.08 / 12 = 3333.33
      // Difference: 833.33
      expect(result.adjustedInterest).toBeGreaterThan(2500);
      expect(result.adjustedInterest).toBeCloseTo(3333.33, 0);
    });

    it("decreases loan repayment when rate falls", () => {
      const loan = {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: 500000,
        interestRate: 6.0,
        repaymentAmount: 3000,
      };
      const config: InterestRateFactorConfig = { changePercent: -1.0, applyTo: "all" };

      const result = applyInterestRateFactor(loan, config);

      // New monthly interest: 500000 * 0.05 / 12 = 2083.33
      expect(result.adjustedInterest).toBeCloseTo(2083.33, 0);
    });

    it("only affects specific property when applyTo is propertyId", () => {
      const loan = {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: 500000,
        interestRate: 6.0,
        repaymentAmount: 3000,
      };
      const config: InterestRateFactorConfig = { changePercent: 2.0, applyTo: "prop-2" };

      const result = applyInterestRateFactor(loan, config);

      // Should not be affected
      expect(result.adjustedInterest).toBeCloseTo(2500, 0);
    });
  });

  describe("applyVacancyFactor", () => {
    it("returns zero income during vacancy months", () => {
      const property = {
        id: "prop-1",
        monthlyRent: 2000,
      };
      const config: VacancyFactorConfig = { propertyId: "prop-1", months: 3 };

      const result = applyVacancyFactor(property, config, 0); // month 0
      expect(result.adjustedRent).toBe(0);
      expect(result.isVacant).toBe(true);
    });

    it("returns normal income after vacancy period ends", () => {
      const property = {
        id: "prop-1",
        monthlyRent: 2000,
      };
      const config: VacancyFactorConfig = { propertyId: "prop-1", months: 3 };

      const result = applyVacancyFactor(property, config, 4); // month 4 (after vacancy)
      expect(result.adjustedRent).toBe(2000);
      expect(result.isVacant).toBe(false);
    });

    it("does not affect other properties", () => {
      const property = {
        id: "prop-2",
        monthlyRent: 2000,
      };
      const config: VacancyFactorConfig = { propertyId: "prop-1", months: 3 };

      const result = applyVacancyFactor(property, config, 0);
      expect(result.adjustedRent).toBe(2000);
      expect(result.isVacant).toBe(false);
    });
  });

  describe("applyRentChangeFactor", () => {
    it("increases rent by percentage", () => {
      const property = { id: "prop-1", monthlyRent: 2000 };
      const config = { changePercent: 10 }; // +10%

      const result = applyRentChangeFactor(property, config);
      expect(result.adjustedRent).toBe(2200);
    });

    it("decreases rent by percentage", () => {
      const property = { id: "prop-1", monthlyRent: 2000 };
      const config = { changePercent: -5 }; // -5%

      const result = applyRentChangeFactor(property, config);
      expect(result.adjustedRent).toBe(1900);
    });

    it("only affects specified property", () => {
      const property = { id: "prop-1", monthlyRent: 2000 };
      const config = { changePercent: 10, propertyId: "prop-2" };

      const result = applyRentChangeFactor(property, config);
      expect(result.adjustedRent).toBe(2000); // unchanged
    });
  });

  describe("applyExpenseChangeFactor", () => {
    it("increases expenses by percentage", () => {
      const expenses = { total: 1000, byCategory: { insurance: 200, repairs: 300 } };
      const config = { changePercent: 20 };

      const result = applyExpenseChangeFactor(expenses, config);
      expect(result.adjustedTotal).toBe(600); // only byCategory items: 200*1.2 + 300*1.2 = 600
    });

    it("only affects specified category", () => {
      const expenses = { total: 1000, byCategory: { insurance: 200, repairs: 300, other: 500 } };
      const config = { changePercent: 50, category: "repairs" };

      const result = applyExpenseChangeFactor(expenses, config);
      // Only repairs (+50%): 300 * 1.5 = 450, others unchanged: 200 + 450 + 500 = 1150
      expect(result.adjustedTotal).toBe(1150);
    });
  });

  describe("projectMonth", () => {
    const basePortfolio: PortfolioState = {
      properties: [
        { id: "prop-1", monthlyRent: 2000, monthlyExpenses: 500 },
      ],
      loans: [
        { id: "loan-1", propertyId: "prop-1", currentBalance: 400000, interestRate: 6.0, repaymentAmount: 2500 },
      ],
    };

    it("projects base case with no factors", () => {
      const result = projectMonth(basePortfolio, [], 0);

      expect(result.totalIncome).toBe(2000);
      expect(result.totalExpenses).toBeGreaterThan(500); // includes interest
      expect(result.netCashFlow).toBeDefined();
    });

    it("applies interest rate factor", () => {
      const factors: ScenarioFactorInput[] = [
        { factorType: "interest_rate", config: { changePercent: 2.0, applyTo: "all" }, startMonth: 0 },
      ];

      const result = projectMonth(basePortfolio, factors, 0);

      // Higher interest = higher expenses
      const baseResult = projectMonth(basePortfolio, [], 0);
      expect(result.totalExpenses).toBeGreaterThan(baseResult.totalExpenses);
    });

    it("applies vacancy factor", () => {
      const factors: ScenarioFactorInput[] = [
        { factorType: "vacancy", config: { propertyId: "prop-1", months: 3 }, startMonth: 0 },
      ];

      const result = projectMonth(basePortfolio, factors, 1); // month 1 is within vacancy

      expect(result.totalIncome).toBe(0);
    });

    it("combines multiple factors", () => {
      const factors: ScenarioFactorInput[] = [
        { factorType: "interest_rate", config: { changePercent: 2.0, applyTo: "all" }, startMonth: 0 },
        { factorType: "rent_change", config: { changePercent: -10 }, startMonth: 0 },
      ];

      const result = projectMonth(basePortfolio, factors, 0);

      expect(result.totalIncome).toBe(1800); // 2000 * 0.9
    });
  });

  describe("runProjection", () => {
    const basePortfolio: PortfolioState = {
      properties: [
        { id: "prop-1", monthlyRent: 2000, monthlyExpenses: 500 },
      ],
      loans: [
        { id: "loan-1", propertyId: "prop-1", currentBalance: 400000, interestRate: 6.0, repaymentAmount: 2500 },
      ],
    };

    it("generates projections for specified time horizon", () => {
      const result = runProjection(basePortfolio, [], 12);

      expect(result.monthlyResults).toHaveLength(12);
      expect(result.summaryMetrics).toBeDefined();
    });

    it("calculates summary metrics correctly", () => {
      const result = runProjection(basePortfolio, [], 12);

      expect(result.summaryMetrics.totalIncome).toBeGreaterThan(0);
      expect(result.summaryMetrics.totalExpenses).toBeGreaterThan(0);
      expect(result.summaryMetrics.averageMonthlyNet).toBeDefined();
    });

    it("identifies months with negative cash flow", () => {
      // Create scenario where expenses > income
      const expensivePortfolio: PortfolioState = {
        properties: [{ id: "prop-1", monthlyRent: 1000, monthlyExpenses: 500 }],
        loans: [{ id: "loan-1", propertyId: "prop-1", currentBalance: 500000, interestRate: 8.0, repaymentAmount: 3500 }],
      };

      const result = runProjection(expensivePortfolio, [], 12);

      expect(result.summaryMetrics.monthsWithNegativeCashFlow).toBeGreaterThan(0);
    });
  });
});
