import { describe, it, expect } from "vitest";
import { getMargin, LoanPurpose, RepaymentType } from "../rate-data";

describe("rate-data service", () => {
  describe("getMargin", () => {
    it("returns 2.00 for owner occupied P&I with LVR <= 80%", () => {
      const margin = getMargin("owner_occupied", "principal_and_interest", 80);
      expect(margin).toBe(2.0);
    });

    it("returns 2.30 for owner occupied P&I with LVR > 80%", () => {
      const margin = getMargin("owner_occupied", "principal_and_interest", 85);
      expect(margin).toBe(2.3);
    });

    it("returns 2.40 for owner occupied IO with LVR <= 80%", () => {
      const margin = getMargin("owner_occupied", "interest_only", 70);
      expect(margin).toBe(2.4);
    });

    it("returns 2.70 for owner occupied IO with LVR > 80%", () => {
      const margin = getMargin("owner_occupied", "interest_only", 90);
      expect(margin).toBe(2.7);
    });

    it("returns 2.30 for investor P&I with LVR <= 80%", () => {
      const margin = getMargin("investor", "principal_and_interest", 75);
      expect(margin).toBe(2.3);
    });

    it("returns 2.60 for investor P&I with LVR > 80%", () => {
      const margin = getMargin("investor", "principal_and_interest", 85);
      expect(margin).toBe(2.6);
    });

    it("returns 2.60 for investor IO with LVR <= 80%", () => {
      const margin = getMargin("investor", "interest_only", 80);
      expect(margin).toBe(2.6);
    });

    it("returns 2.90 for investor IO with LVR > 80%", () => {
      const margin = getMargin("investor", "interest_only", 95);
      expect(margin).toBe(2.9);
    });
  });
});
