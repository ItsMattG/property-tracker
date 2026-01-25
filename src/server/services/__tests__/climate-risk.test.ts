import { describe, it, expect } from "vitest";
import {
  getClimateRisk,
  calculateOverallRisk,
} from "../climate-risk";

describe("climate-risk service", () => {
  describe("calculateOverallRisk", () => {
    it("returns the higher of two risk levels", () => {
      expect(calculateOverallRisk("low", "high")).toBe("high");
      expect(calculateOverallRisk("high", "low")).toBe("high");
      expect(calculateOverallRisk("medium", "extreme")).toBe("extreme");
      expect(calculateOverallRisk("low", "low")).toBe("low");
    });
  });

  describe("getClimateRisk", () => {
    it("returns known risk for high-risk postcode", () => {
      const risk = getClimateRisk("4067"); // Brisbane flood-prone
      expect(risk.floodRisk).toBe("extreme");
      expect(risk.bushfireRisk).toBe("low");
      expect(risk.overallRisk).toBe("extreme");
      expect(risk.fetchedAt).toBeDefined();
    });

    it("returns known risk for bushfire-prone postcode", () => {
      const risk = getClimateRisk("2780"); // Blue Mountains
      expect(risk.floodRisk).toBe("low");
      expect(risk.bushfireRisk).toBe("extreme");
      expect(risk.overallRisk).toBe("extreme");
    });

    it("returns low risk for unknown postcode", () => {
      const risk = getClimateRisk("9999");
      expect(risk.floodRisk).toBe("low");
      expect(risk.bushfireRisk).toBe("low");
      expect(risk.overallRisk).toBe("low");
    });

    it("returns low risk for invalid postcode format", () => {
      const risk = getClimateRisk("invalid");
      expect(risk.floodRisk).toBe("low");
      expect(risk.bushfireRisk).toBe("low");
      expect(risk.overallRisk).toBe("low");
    });

    it("handles empty string postcode", () => {
      const risk = getClimateRisk("");
      expect(risk.overallRisk).toBe("low");
    });
  });
});
