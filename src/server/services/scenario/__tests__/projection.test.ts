import { describe, it, expect } from "vitest";
import {
  applyInterestRateFactor,
  applyVacancyFactor,
  applyRentChangeFactor,
  applyExpenseChangeFactor,
  calculateCGT,
  applySellPropertyFactor,
  applyBuyPropertyFactor,
  projectMonth,
  runProjection,
  type PortfolioState,
  type ScenarioFactorInput,
  type ProjectionResult,
  type PropertyForSale,
} from "../projection";
import type { InterestRateFactorConfig, VacancyFactorConfig, SellPropertyFactorConfig, BuyPropertyFactorConfig } from "../types";

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

  describe("calculateCGT", () => {
    it("calculates capital gain correctly", () => {
      const property: PropertyForSale = {
        id: "prop-1",
        purchasePrice: 500000,
        improvements: 50000,
        depreciationClaimed: 10000,
        purchaseDate: new Date("2020-01-01"),
      };
      const salePrice = 700000;
      const sellingCosts = 20000;
      const marginalRate = 0.37;

      const result = calculateCGT(property, salePrice, sellingCosts, marginalRate);

      // Cost base = 500000 + 50000 - 10000 = 540000
      // Gross gain = 700000 - 20000 - 540000 = 140000
      // Held >12mo, so 50% discount = 70000 taxable
      // CGT payable = 70000 * 0.37 = 25900
      expect(result.costBase).toBe(540000);
      expect(result.grossGain).toBe(140000);
      expect(result.taxableGain).toBe(70000);
      expect(result.cgtPayable).toBeCloseTo(25900, 0);
      expect(result.discountApplied).toBe(true);
    });

    it("does not apply 50% discount if held less than 12 months", () => {
      const property: PropertyForSale = {
        id: "prop-1",
        purchasePrice: 500000,
        improvements: 0,
        depreciationClaimed: 0,
        purchaseDate: new Date(), // purchased today
      };
      const salePrice = 600000;
      const sellingCosts = 10000;
      const marginalRate = 0.37;

      const result = calculateCGT(property, salePrice, sellingCosts, marginalRate);

      // No discount - taxable gain = gross gain
      expect(result.grossGain).toBe(90000); // 600000 - 10000 - 500000
      expect(result.taxableGain).toBe(90000);
      expect(result.discountApplied).toBe(false);
    });

    it("returns zero CGT for capital loss", () => {
      const property: PropertyForSale = {
        id: "prop-1",
        purchasePrice: 500000,
        improvements: 0,
        depreciationClaimed: 0,
        purchaseDate: new Date("2020-01-01"),
      };
      const salePrice = 450000;
      const sellingCosts = 20000;
      const marginalRate = 0.37;

      const result = calculateCGT(property, salePrice, sellingCosts, marginalRate);

      expect(result.grossGain).toBe(-70000); // loss
      expect(result.taxableGain).toBe(0);
      expect(result.cgtPayable).toBe(0);
      expect(result.capitalLoss).toBe(70000);
    });
  });

  describe("applySellPropertyFactor", () => {
    it("removes property from portfolio at settlement month", () => {
      const portfolio: PortfolioState = {
        properties: [
          { id: "prop-1", monthlyRent: 2000, monthlyExpenses: 500 },
          { id: "prop-2", monthlyRent: 2500, monthlyExpenses: 600 },
        ],
        loans: [
          { id: "loan-1", propertyId: "prop-1", currentBalance: 400000, interestRate: 6.0, repaymentAmount: 2500 },
        ],
      };
      const config: SellPropertyFactorConfig = {
        propertyId: "prop-1",
        salePrice: 700000,
        sellingCosts: 20000,
        settlementMonth: 6,
      };
      const propertyData: PropertyForSale = {
        id: "prop-1",
        purchasePrice: 500000,
        improvements: 0,
        depreciationClaimed: 0,
        purchaseDate: new Date("2020-01-01"),
      };

      const result = applySellPropertyFactor(portfolio, config, propertyData, 0.37);

      expect(result.adjustedPortfolio.properties).toHaveLength(1);
      expect(result.adjustedPortfolio.properties[0].id).toBe("prop-2");
      expect(result.adjustedPortfolio.loans).toHaveLength(0); // loan removed
      expect(result.netProceeds).toBeGreaterThan(0);
      expect(result.cgtResult.cgtPayable).toBeGreaterThan(0);
    });

    it("calculates net proceeds correctly", () => {
      const portfolio: PortfolioState = {
        properties: [{ id: "prop-1", monthlyRent: 2000, monthlyExpenses: 500 }],
        loans: [{ id: "loan-1", propertyId: "prop-1", currentBalance: 300000, interestRate: 6.0, repaymentAmount: 2500 }],
      };
      const config: SellPropertyFactorConfig = {
        propertyId: "prop-1",
        salePrice: 700000,
        sellingCosts: 20000,
        settlementMonth: 12,
      };
      const propertyData: PropertyForSale = {
        id: "prop-1",
        purchasePrice: 500000,
        improvements: 0,
        depreciationClaimed: 0,
        purchaseDate: new Date("2020-01-01"),
      };

      const result = applySellPropertyFactor(portfolio, config, propertyData, 0.37);

      // Sale: 700000 - selling costs: 20000 - loan payoff: 300000 - CGT
      // Gross gain: 700000 - 20000 - 500000 = 180000, taxable: 90000, CGT: 33300
      // Net = 700000 - 20000 - 300000 - 33300 = 346700
      expect(result.netProceeds).toBeCloseTo(346700, -2);
    });
  });

  describe("runProjection with sell_property", () => {
    it("removes property income after settlement month", () => {
      const portfolio: PortfolioState = {
        properties: [{ id: "prop-1", monthlyRent: 2000, monthlyExpenses: 500 }],
        loans: [{ id: "loan-1", propertyId: "prop-1", currentBalance: 300000, interestRate: 6.0, repaymentAmount: 2500 }],
      };
      const propertyData: PropertyForSale = {
        id: "prop-1",
        purchasePrice: 500000,
        improvements: 0,
        depreciationClaimed: 0,
        purchaseDate: new Date("2020-01-01"),
      };
      const factors: ScenarioFactorInput[] = [
        {
          factorType: "sell_property",
          config: { propertyId: "prop-1", salePrice: 700000, sellingCosts: 20000, settlementMonth: 6 },
          startMonth: 0,
          propertyData,
          marginalTaxRate: 0.37,
        },
      ];

      const result = runProjection(portfolio, factors, 12);

      // Before month 6: rental income
      expect(result.monthlyResults[0].totalIncome).toBe(2000);
      expect(result.monthlyResults[5].totalIncome).toBe(2000);
      // After month 6: no rental income (property sold)
      expect(result.monthlyResults[6].totalIncome).toBe(0);
      expect(result.monthlyResults[11].totalIncome).toBe(0);
    });
  });

  describe("applyBuyPropertyFactor", () => {
    it("adds new property and loan to portfolio", () => {
      const portfolio: PortfolioState = {
        properties: [{ id: "prop-1", monthlyRent: 2000, monthlyExpenses: 500 }],
        loans: [],
      };
      const config: BuyPropertyFactorConfig = {
        purchasePrice: 600000,
        deposit: 120000,
        loanAmount: 480000,
        interestRate: 6.5,
        expectedRent: 2500,
        expectedExpenses: 600,
        purchaseMonth: 3,
      };

      const result = applyBuyPropertyFactor(portfolio, config);

      expect(result.adjustedPortfolio.properties).toHaveLength(2);
      expect(result.adjustedPortfolio.loans).toHaveLength(1);
      expect(result.newProperty.monthlyRent).toBe(2500);
      expect(result.newProperty.monthlyExpenses).toBe(600);
      expect(result.newLoan.currentBalance).toBe(480000);
      expect(result.newLoan.interestRate).toBe(6.5);
    });

    it("generates unique IDs for new property and loan", () => {
      const portfolio: PortfolioState = {
        properties: [],
        loans: [],
      };
      const config: BuyPropertyFactorConfig = {
        purchasePrice: 500000,
        deposit: 100000,
        loanAmount: 400000,
        interestRate: 6.0,
        expectedRent: 2000,
        expectedExpenses: 500,
        purchaseMonth: 0,
      };

      const result = applyBuyPropertyFactor(portfolio, config);

      expect(result.newProperty.id).toBeDefined();
      expect(result.newProperty.id.length).toBeGreaterThan(0);
      expect(result.newLoan.propertyId).toBe(result.newProperty.id);
    });
  });

  describe("runProjection with buy_property", () => {
    it("adds property income after purchase month", () => {
      const portfolio: PortfolioState = {
        properties: [],
        loans: [],
      };
      const factors: ScenarioFactorInput[] = [
        {
          factorType: "buy_property",
          config: {
            purchasePrice: 500000,
            deposit: 100000,
            loanAmount: 400000,
            interestRate: 6.0,
            expectedRent: 2000,
            expectedExpenses: 500,
            purchaseMonth: 3,
          },
          startMonth: 0,
        },
      ];

      const result = runProjection(portfolio, factors, 12);

      // Before month 3: no income
      expect(result.monthlyResults[0].totalIncome).toBe(0);
      expect(result.monthlyResults[2].totalIncome).toBe(0);
      // After month 3: rental income from new property
      expect(result.monthlyResults[3].totalIncome).toBe(2000);
      expect(result.monthlyResults[11].totalIncome).toBe(2000);
    });

    it("adds loan expenses after purchase month", () => {
      const portfolio: PortfolioState = {
        properties: [],
        loans: [],
      };
      const factors: ScenarioFactorInput[] = [
        {
          factorType: "buy_property",
          config: {
            purchasePrice: 500000,
            deposit: 100000,
            loanAmount: 400000,
            interestRate: 6.0,
            expectedRent: 2000,
            expectedExpenses: 500,
            purchaseMonth: 3,
          },
          startMonth: 0,
        },
      ];

      const result = runProjection(portfolio, factors, 12);

      // Before month 3: no expenses
      expect(result.monthlyResults[0].totalExpenses).toBe(0);
      // After month 3: expenses include property expenses + interest
      // Monthly interest: 400000 * 6.0% / 12 = 2000
      expect(result.monthlyResults[3].totalExpenses).toBe(500 + 2000); // expenses + interest
    });
  });
});
