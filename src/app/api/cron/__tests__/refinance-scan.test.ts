import { describe, it, expect } from "vitest";
import { shouldAlertForLoan, calculateLvr } from "../refinance-scan/helpers";

describe("refinance-scan helpers", () => {
  describe("calculateLvr", () => {
    it("calculates LVR correctly", () => {
      const lvr = calculateLvr(400000, 500000);
      expect(lvr).toBe(80);
    });

    it("handles zero property value", () => {
      const lvr = calculateLvr(400000, 0);
      expect(lvr).toBe(100);
    });
  });

  describe("shouldAlertForLoan", () => {
    it("returns true when rate gap exceeds threshold", () => {
      const result = shouldAlertForLoan({
        currentRate: 6.5,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: null,
      });
      expect(result).toBe(true);
    });

    it("returns false when rate gap below threshold", () => {
      const result = shouldAlertForLoan({
        currentRate: 6.0,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: null,
      });
      expect(result).toBe(false);
    });

    it("returns false when alerted recently (within 7 days)", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 3);

      const result = shouldAlertForLoan({
        currentRate: 6.5,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: recent,
      });
      expect(result).toBe(false);
    });

    it("returns true when last alert was over 7 days ago", () => {
      const old = new Date();
      old.setDate(old.getDate() - 10);

      const result = shouldAlertForLoan({
        currentRate: 6.5,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: old,
      });
      expect(result).toBe(true);
    });
  });
});
