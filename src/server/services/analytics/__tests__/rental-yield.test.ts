import { describe, it, expect } from "vitest";
import { calculateGrossYield, calculateNetYield } from "../rental-yield";

describe("rental yield", () => {
  describe("calculateGrossYield", () => {
    it("calculates gross yield correctly", () => {
      // $500/week rent = $26,000/year, property value $500,000
      expect(calculateGrossYield(26000, 500000)).toBeCloseTo(5.2, 1);
    });

    it("returns 0 when no rent", () => {
      expect(calculateGrossYield(0, 500000)).toBe(0);
    });

    it("returns 0 when no value", () => {
      expect(calculateGrossYield(26000, 0)).toBe(0);
    });

    it("returns 0 when negative rent", () => {
      expect(calculateGrossYield(-5000, 500000)).toBe(0);
    });
  });

  describe("calculateNetYield", () => {
    it("calculates net yield correctly", () => {
      // $26,000 rent - $8,000 expenses = $18,000 net, value $500,000
      expect(calculateNetYield(26000, 8000, 500000)).toBeCloseTo(3.6, 1);
    });

    it("returns negative yield when expenses exceed rent", () => {
      expect(calculateNetYield(26000, 30000, 500000)).toBeCloseTo(-0.8, 1);
    });

    it("returns 0 when no value", () => {
      expect(calculateNetYield(26000, 8000, 0)).toBe(0);
    });
  });
});
