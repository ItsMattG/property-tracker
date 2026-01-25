import { describe, it, expect } from "vitest";
import {
  type InterestRateFactorConfig,
  type VacancyFactorConfig,
  type RentChangeFactorConfig,
  type ExpenseChangeFactorConfig,
  type SellPropertyFactorConfig,
  type BuyPropertyFactorConfig,
  type FactorConfig,
  parseFactorConfig,
  isValidFactorConfig,
} from "../types";

describe("Factor types", () => {
  describe("parseFactorConfig", () => {
    it("parses interest_rate factor", () => {
      const json = JSON.stringify({ changePercent: 2.0, applyTo: "all" });
      const config = parseFactorConfig("interest_rate", json);
      expect(config).toEqual({ changePercent: 2.0, applyTo: "all" });
    });

    it("parses vacancy factor", () => {
      const json = JSON.stringify({ propertyId: "abc", months: 3 });
      const config = parseFactorConfig("vacancy", json);
      expect(config).toEqual({ propertyId: "abc", months: 3 });
    });

    it("parses sell_property factor", () => {
      const json = JSON.stringify({
        propertyId: "abc",
        salePrice: 850000,
        sellingCosts: 25000,
        settlementMonth: 12,
      });
      const config = parseFactorConfig("sell_property", json) as SellPropertyFactorConfig;
      expect(config.salePrice).toBe(850000);
    });

    it("returns null for invalid JSON", () => {
      const config = parseFactorConfig("interest_rate", "invalid");
      expect(config).toBeNull();
    });
  });

  describe("isValidFactorConfig", () => {
    it("validates interest_rate config", () => {
      expect(isValidFactorConfig("interest_rate", { changePercent: 2.0, applyTo: "all" })).toBe(true);
      expect(isValidFactorConfig("interest_rate", { changePercent: "invalid" })).toBe(false);
    });

    it("validates vacancy config", () => {
      expect(isValidFactorConfig("vacancy", { propertyId: "abc", months: 3 })).toBe(true);
      expect(isValidFactorConfig("vacancy", { months: -1 })).toBe(false);
    });
  });
});
