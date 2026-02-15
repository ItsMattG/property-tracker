// src/server/services/__tests__/vector-generation.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizePropertyType,
  normalizeLocationCluster,
  normalizePriceBracket,
  normalizeYield,
  normalizeGrowth,
  generatePropertyVector,
} from "../vector-generation";

describe("Vector Generation Service", () => {
  describe("normalizePropertyType", () => {
    it("returns 0.0 for house", () => {
      expect(normalizePropertyType("house")).toBe(0.0);
    });

    it("returns 0.5 for townhouse", () => {
      expect(normalizePropertyType("townhouse")).toBe(0.5);
    });

    it("returns 1.0 for unit", () => {
      expect(normalizePropertyType("unit")).toBe(1.0);
    });

    it("returns 1.0 for apartment (mapped to unit)", () => {
      expect(normalizePropertyType("apartment")).toBe(1.0);
    });

    it("returns 0.5 for unknown types", () => {
      expect(normalizePropertyType("villa")).toBe(0.5);
    });
  });

  describe("normalizeLocationCluster", () => {
    it("returns value between 0 and 1", () => {
      const result = normalizeLocationCluster("NSW", 800000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("returns higher value for premium suburbs", () => {
      const budget = normalizeLocationCluster("NSW", 400000);
      const premium = normalizeLocationCluster("NSW", 1500000);
      expect(premium).toBeGreaterThan(budget);
    });
  });

  describe("normalizePriceBracket", () => {
    it("returns 0.0 for very low prices", () => {
      expect(normalizePriceBracket(100000)).toBe(0.0);
    });

    it("returns 1.0 for very high prices", () => {
      expect(normalizePriceBracket(5000000)).toBe(1.0);
    });

    it("returns value in middle range for typical prices", () => {
      const result = normalizePriceBracket(800000);
      expect(result).toBeGreaterThan(0.3);
      expect(result).toBeLessThan(0.7);
    });
  });

  describe("normalizeYield", () => {
    it("normalizes yields to 0-1 range", () => {
      expect(normalizeYield(0)).toBe(0);
      expect(normalizeYield(5)).toBeCloseTo(0.5, 1);
      expect(normalizeYield(10)).toBe(1.0);
    });
  });

  describe("normalizeGrowth", () => {
    it("normalizes growth to 0-1 range", () => {
      expect(normalizeGrowth(-10)).toBe(0);
      expect(normalizeGrowth(0)).toBeCloseTo(0.5, 1);
      expect(normalizeGrowth(10)).toBe(1.0);
    });
  });

  describe("generatePropertyVector", () => {
    it("returns array of 5 numbers", () => {
      const vector = generatePropertyVector({
        state: "NSW",
        suburb: "Sydney",
        propertyType: "house",
        currentValue: 1000000,
        grossYield: 4.5,
        capitalGrowthRate: 5.0,
      });

      expect(vector).toHaveLength(5);
      vector.forEach((v) => {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });
  });
});
