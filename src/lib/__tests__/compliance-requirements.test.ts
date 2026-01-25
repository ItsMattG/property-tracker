import { describe, it, expect } from "vitest";
import {
  getRequirementsForState,
  getRequirementById,
  ALL_REQUIREMENTS,
  type AustralianState,
} from "../compliance-requirements";

describe("compliance-requirements", () => {
  describe("getRequirementsForState", () => {
    it("returns VIC requirements including smoke alarm and gas safety", () => {
      const vicReqs = getRequirementsForState("VIC");
      expect(vicReqs.length).toBeGreaterThan(0);

      const smokeAlarm = vicReqs.find((r) => r.id === "smoke_alarm");
      expect(smokeAlarm).toBeDefined();
      expect(smokeAlarm?.frequencyMonths).toBe(12);

      const gasSafety = vicReqs.find((r) => r.id === "gas_safety");
      expect(gasSafety).toBeDefined();
      expect(gasSafety?.frequencyMonths).toBe(24);
    });

    it("returns NSW requirements (no gas safety)", () => {
      const nswReqs = getRequirementsForState("NSW");
      const smokeAlarm = nswReqs.find((r) => r.id === "smoke_alarm");
      expect(smokeAlarm).toBeDefined();

      const gasSafety = nswReqs.find((r) => r.id === "gas_safety");
      expect(gasSafety).toBeUndefined();
    });

    it("all states have smoke alarm requirement", () => {
      const states: AustralianState[] = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
      for (const state of states) {
        const reqs = getRequirementsForState(state);
        const smokeAlarm = reqs.find((r) => r.id === "smoke_alarm");
        expect(smokeAlarm).toBeDefined();
      }
    });
  });

  describe("getRequirementById", () => {
    it("returns requirement by id", () => {
      const req = getRequirementById("smoke_alarm");
      expect(req).toBeDefined();
      expect(req?.name).toBe("Smoke Alarm Check");
    });

    it("returns undefined for unknown id", () => {
      const req = getRequirementById("unknown_requirement");
      expect(req).toBeUndefined();
    });
  });

  describe("ALL_REQUIREMENTS", () => {
    it("exports all unique requirements", () => {
      expect(ALL_REQUIREMENTS.length).toBeGreaterThan(0);
      const ids = ALL_REQUIREMENTS.map((r) => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });
});
