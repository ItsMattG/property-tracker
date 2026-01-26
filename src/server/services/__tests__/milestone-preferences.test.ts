import { describe, it, expect } from "vitest";
import {
  resolveThresholds,
  DEFAULT_LVR_THRESHOLDS,
  DEFAULT_EQUITY_THRESHOLDS,
} from "../milestone-preferences";

describe("milestone-preferences", () => {
  describe("resolveThresholds", () => {
    it("returns system defaults when no preferences exist", () => {
      const result = resolveThresholds(null, null);
      expect(result).toEqual({
        lvrThresholds: DEFAULT_LVR_THRESHOLDS,
        equityThresholds: DEFAULT_EQUITY_THRESHOLDS,
        enabled: true,
      });
    });

    it("returns global preferences when no override exists", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60],
        equityThresholds: [100000, 500000],
        enabled: true,
      };
      const result = resolveThresholds(globalPrefs, null);
      expect(result).toEqual(globalPrefs);
    });

    it("returns property override when it exists", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60],
        equityThresholds: [100000, 500000],
        enabled: true,
      };
      const override = {
        lvrThresholds: [40, 20],
        equityThresholds: null,
        enabled: false,
      };
      const result = resolveThresholds(globalPrefs, override);
      expect(result).toEqual({
        lvrThresholds: [40, 20],
        equityThresholds: [100000, 500000], // from global
        enabled: false,
      });
    });

    it("handles disabled at global level", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60],
        equityThresholds: [100000],
        enabled: false,
      };
      const result = resolveThresholds(globalPrefs, null);
      expect(result.enabled).toBe(false);
    });

    it("handles partial override with null values", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60, 40],
        equityThresholds: [100000, 250000],
        enabled: true,
      };
      const override = {
        lvrThresholds: null,
        equityThresholds: [500000, 1000000],
        enabled: null,
      };
      const result = resolveThresholds(globalPrefs, override);
      expect(result).toEqual({
        lvrThresholds: [80, 60, 40], // from global (override is null)
        equityThresholds: [500000, 1000000], // from override
        enabled: true, // from global (override is null)
      });
    });
  });
});
