import { describe, it, expect } from "vitest";

import {
  interestRateConfigSchema,
  vacancyConfigSchema,
  rentChangeConfigSchema,
  expenseChangeConfigSchema,
  sellPropertyConfigSchema,
  buyPropertyConfigSchema,
  factorFormSchema,
} from "../factor-schemas";

describe("factor-schemas", () => {
  describe("interestRateConfigSchema", () => {
    it("accepts valid config", () => {
      const result = interestRateConfigSchema.safeParse({
        changePercent: 1.5,
        applyTo: "all",
      });
      expect(result.success).toBe(true);
    });

    it("accepts property-specific config", () => {
      const result = interestRateConfigSchema.safeParse({
        changePercent: -0.5,
        applyTo: "some-uuid",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing changePercent", () => {
      const result = interestRateConfigSchema.safeParse({ applyTo: "all" });
      expect(result.success).toBe(false);
    });

    it("rejects changePercent outside range", () => {
      expect(
        interestRateConfigSchema.safeParse({
          changePercent: 10,
          applyTo: "all",
        }).success
      ).toBe(false);
      expect(
        interestRateConfigSchema.safeParse({
          changePercent: -5,
          applyTo: "all",
        }).success
      ).toBe(false);
    });
  });

  describe("vacancyConfigSchema", () => {
    it("accepts valid config", () => {
      const result = vacancyConfigSchema.safeParse({
        propertyId: "abc-123",
        months: 3,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero months", () => {
      const result = vacancyConfigSchema.safeParse({
        propertyId: "abc-123",
        months: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("rentChangeConfigSchema", () => {
    it("accepts valid config with optional propertyId", () => {
      expect(
        rentChangeConfigSchema.safeParse({ changePercent: -10 }).success
      ).toBe(true);
      expect(
        rentChangeConfigSchema.safeParse({
          changePercent: 5,
          propertyId: "abc",
        }).success
      ).toBe(true);
    });

    it("rejects out-of-range", () => {
      expect(
        rentChangeConfigSchema.safeParse({ changePercent: 30 }).success
      ).toBe(false);
    });
  });

  describe("expenseChangeConfigSchema", () => {
    it("accepts valid config with optional category", () => {
      expect(
        expenseChangeConfigSchema.safeParse({ changePercent: 15 }).success
      ).toBe(true);
      expect(
        expenseChangeConfigSchema.safeParse({
          changePercent: -5,
          category: "insurance",
        }).success
      ).toBe(true);
    });
  });

  describe("sellPropertyConfigSchema", () => {
    it("accepts valid config", () => {
      const result = sellPropertyConfigSchema.safeParse({
        propertyId: "abc",
        salePrice: 850000,
        sellingCosts: 25000,
        settlementMonth: 12,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative sale price", () => {
      const result = sellPropertyConfigSchema.safeParse({
        propertyId: "abc",
        salePrice: -100,
        sellingCosts: 0,
        settlementMonth: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("buyPropertyConfigSchema", () => {
    it("accepts valid config", () => {
      const result = buyPropertyConfigSchema.safeParse({
        purchasePrice: 600000,
        deposit: 120000,
        loanAmount: 480000,
        interestRate: 6.5,
        expectedRent: 2500,
        expectedExpenses: 600,
        purchaseMonth: 6,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("factorFormSchema", () => {
    it("accepts a complete factor with startMonth and duration", () => {
      const result = factorFormSchema.safeParse({
        factorType: "interest_rate",
        config: { changePercent: 1.5, applyTo: "all" },
        startMonth: 6,
        durationMonths: 12,
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown factor type", () => {
      const result = factorFormSchema.safeParse({
        factorType: "unknown",
        config: {},
        startMonth: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
