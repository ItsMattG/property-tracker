import { describe, it, expect } from "vitest";
import {
  calculateInsuranceBenchmark,
  calculateCouncilRatesBenchmark,
  calculateManagementFeesBenchmark,
  getBenchmarkStatus,
} from "../benchmarking";

describe("benchmarking service", () => {
  describe("getBenchmarkStatus", () => {
    it("returns 'below' when under average", () => {
      expect(getBenchmarkStatus(800, 1000)).toBe("below");
    });

    it("returns 'average' when within threshold", () => {
      expect(getBenchmarkStatus(1000, 1000)).toBe("average");
      expect(getBenchmarkStatus(1100, 1000)).toBe("average"); // 10% above, under 15% threshold
    });

    it("returns 'above' when over threshold", () => {
      expect(getBenchmarkStatus(1200, 1000)).toBe("above"); // 20% above
    });
  });

  describe("calculateInsuranceBenchmark", () => {
    it("calculates insurance benchmark based on property value", () => {
      const result = calculateInsuranceBenchmark(2500, 500000, "NSW");
      // Expected: 500000/100000 * 180 = $900
      expect(result?.averageAmount).toBe(900);
      expect(result?.userAmount).toBe(2500);
      expect(result?.status).toBe("above");
      expect(result?.potentialSavings).toBe(1600);
    });

    it("returns null for zero user amount", () => {
      const result = calculateInsuranceBenchmark(0, 500000, "NSW");
      expect(result).toBeNull();
    });

    it("returns null for zero property value", () => {
      const result = calculateInsuranceBenchmark(1000, 0, "NSW");
      expect(result).toBeNull();
    });
  });

  describe("calculateCouncilRatesBenchmark", () => {
    it("calculates council rates benchmark", () => {
      const result = calculateCouncilRatesBenchmark(2500, "VIC");
      // VIC average: 2100
      expect(result?.averageAmount).toBe(2100);
      expect(result?.status).toBe("above"); // 2500 > 2100 * 1.15
    });

    it("returns average status when within threshold", () => {
      const result = calculateCouncilRatesBenchmark(2000, "VIC");
      expect(result?.status).toBe("average");
    });

    it("returns null for zero amount", () => {
      const result = calculateCouncilRatesBenchmark(0, "VIC");
      expect(result).toBeNull();
    });
  });

  describe("calculateManagementFeesBenchmark", () => {
    it("calculates management fees as percentage of rent", () => {
      const result = calculateManagementFeesBenchmark(3600, 40000); // 9% of rent
      expect(result?.userPercent).toBe(9);
      expect(result?.averagePercent).toBe(7);
      expect(result?.status).toBe("above");
      expect(result?.potentialSavings).toBe(800); // 3600 - (40000 * 0.07)
    });

    it("returns null when no rental income", () => {
      const result = calculateManagementFeesBenchmark(3600, 0);
      expect(result).toBeNull();
    });

    it("returns null when no fees", () => {
      const result = calculateManagementFeesBenchmark(0, 40000);
      expect(result).toBeNull();
    });

    it("returns average status for typical fees", () => {
      const result = calculateManagementFeesBenchmark(2800, 40000); // 7% of rent
      expect(result?.status).toBe("average");
    });
  });
});
