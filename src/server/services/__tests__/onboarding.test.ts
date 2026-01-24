import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  getStepStatus,
  calculateProgress,
  isStepComplete,
} from "../onboarding";

describe("onboarding service", () => {
  describe("ONBOARDING_STEPS", () => {
    it("should have 5 defined steps", () => {
      expect(ONBOARDING_STEPS).toHaveLength(5);
    });

    it("should have correct step IDs", () => {
      const ids = ONBOARDING_STEPS.map((s) => s.id);
      expect(ids).toEqual([
        "add_property",
        "connect_bank",
        "categorize_10",
        "setup_recurring",
        "add_property_value",
      ]);
    });
  });

  describe("isStepComplete", () => {
    it("returns true when count meets threshold", () => {
      expect(isStepComplete("add_property", { propertyCount: 1 })).toBe(true);
      expect(isStepComplete("categorize_10", { categorizedCount: 10 })).toBe(true);
    });

    it("returns false when count below threshold", () => {
      expect(isStepComplete("add_property", { propertyCount: 0 })).toBe(false);
      expect(isStepComplete("categorize_10", { categorizedCount: 9 })).toBe(false);
    });

    it("returns false for unknown step", () => {
      expect(isStepComplete("unknown_step", { propertyCount: 10 })).toBe(false);
    });
  });

  describe("getStepStatus", () => {
    it("returns complete status for finished steps", () => {
      const counts = { propertyCount: 2, bankAccountCount: 1 };
      const status = getStepStatus("add_property", counts);
      expect(status.isComplete).toBe(true);
      expect(status.label).toBe("Add a property");
    });

    it("returns incomplete status with action link", () => {
      const counts = { propertyCount: 0 };
      const status = getStepStatus("add_property", counts);
      expect(status.isComplete).toBe(false);
      expect(status.actionLink).toBe("/properties/new");
    });

    it("returns empty status for unknown step", () => {
      const status = getStepStatus("unknown", {});
      expect(status.id).toBe("unknown");
      expect(status.label).toBe("");
    });
  });

  describe("calculateProgress", () => {
    it("returns 0/5 when nothing complete", () => {
      const counts = {
        propertyCount: 0,
        bankAccountCount: 0,
        categorizedCount: 0,
        recurringCount: 0,
        propertyValueCount: 0,
      };
      const progress = calculateProgress(counts);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(5);
    });

    it("returns correct count when some complete", () => {
      const counts = {
        propertyCount: 1,
        bankAccountCount: 1,
        categorizedCount: 5,
        recurringCount: 0,
        propertyValueCount: 0,
      };
      const progress = calculateProgress(counts);
      expect(progress.completed).toBe(2);
    });

    it("returns 5/5 when all complete", () => {
      const counts = {
        propertyCount: 1,
        bankAccountCount: 1,
        categorizedCount: 10,
        recurringCount: 1,
        propertyValueCount: 1,
      };
      const progress = calculateProgress(counts);
      expect(progress.completed).toBe(5);
    });

    it("includes all step statuses", () => {
      const counts = {
        propertyCount: 1,
        bankAccountCount: 0,
        categorizedCount: 0,
        recurringCount: 0,
        propertyValueCount: 0,
      };
      const progress = calculateProgress(counts);
      expect(progress.steps).toHaveLength(5);
      expect(progress.steps[0].isComplete).toBe(true);
      expect(progress.steps[1].isComplete).toBe(false);
    });
  });
});
