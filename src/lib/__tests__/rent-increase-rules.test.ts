import { describe, it, expect } from "vitest";
import {
  RENT_INCREASE_RULES,
  getRentIncreaseRule,
} from "../rent-increase-rules";

describe("RENT_INCREASE_RULES", () => {
  const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

  it("defines rules for all 8 states/territories", () => {
    for (const state of states) {
      expect(RENT_INCREASE_RULES[state]).toBeDefined();
      expect(RENT_INCREASE_RULES[state].noticeDays).toBeGreaterThan(0);
      expect(RENT_INCREASE_RULES[state].maxFrequency).toBeTruthy();
      expect(RENT_INCREASE_RULES[state].fixedTermRule).toBeTruthy();
    }
  });

  it("getRentIncreaseRule returns rule for valid state", () => {
    const rule = getRentIncreaseRule("VIC");
    expect(rule).toBeDefined();
    expect(rule!.noticeDays).toBe(60);
  });

  it("getRentIncreaseRule returns undefined for invalid state", () => {
    const rule = getRentIncreaseRule("INVALID");
    expect(rule).toBeUndefined();
  });
});
