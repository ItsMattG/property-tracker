import { describe, it, expect } from "vitest";
import {
  refinanceOpportunityTemplate,
  refinanceOpportunitySubject,
} from "../refinance-opportunity";
import {
  cashRateChangedTemplate,
  cashRateChangedSubject,
} from "../cash-rate-changed";

describe("refinance email templates", () => {
  describe("refinanceOpportunityTemplate", () => {
    it("includes the rate gap", () => {
      const html = refinanceOpportunityTemplate({
        propertyAddress: "123 Main St",
        currentRate: 6.5,
        marketRate: 5.8,
        monthlySavings: 159,
        loanId: "abc123",
      });

      expect(html).toContain("0.70%");
    });

    it("includes the monthly savings", () => {
      const html = refinanceOpportunityTemplate({
        propertyAddress: "123 Main St",
        currentRate: 6.5,
        marketRate: 5.8,
        monthlySavings: 159,
        loanId: "abc123",
      });

      expect(html).toContain("$159");
    });
  });

  describe("refinanceOpportunitySubject", () => {
    it("returns appropriate subject", () => {
      const subject = refinanceOpportunitySubject({ monthlySavings: 159 });
      expect(subject).toContain("$159");
    });
  });

  describe("cashRateChangedTemplate", () => {
    it("includes old and new rates", () => {
      const html = cashRateChangedTemplate({
        oldRate: 4.35,
        newRate: 4.10,
        changeDirection: "decreased",
      });

      expect(html).toContain("4.35%");
      expect(html).toContain("4.10%");
    });
  });

  describe("cashRateChangedSubject", () => {
    it("indicates decrease", () => {
      const subject = cashRateChangedSubject({
        changeDirection: "decreased",
        newRate: 4.1,
      });

      expect(subject.toLowerCase()).toContain("decrease");
    });

    it("indicates increase", () => {
      const subject = cashRateChangedSubject({
        changeDirection: "increased",
        newRate: 4.6,
      });

      expect(subject.toLowerCase()).toContain("increase");
    });
  });
});
