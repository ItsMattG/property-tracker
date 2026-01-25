import { describe, it, expect } from "vitest";
import {
  rateHistory,
  loanComparisons,
  refinanceAlerts,
  loanPurposeEnum,
} from "../schema";

describe("loan comparison schema", () => {
  it("exports rateHistory table", () => {
    expect(rateHistory).toBeDefined();
    expect(rateHistory.id).toBeDefined();
    expect(rateHistory.rateDate).toBeDefined();
    expect(rateHistory.cashRate).toBeDefined();
  });

  it("exports loanComparisons table", () => {
    expect(loanComparisons).toBeDefined();
    expect(loanComparisons.id).toBeDefined();
    expect(loanComparisons.loanId).toBeDefined();
    expect(loanComparisons.newRate).toBeDefined();
    expect(loanComparisons.switchingCosts).toBeDefined();
  });

  it("exports refinanceAlerts table", () => {
    expect(refinanceAlerts).toBeDefined();
    expect(refinanceAlerts.id).toBeDefined();
    expect(refinanceAlerts.loanId).toBeDefined();
    expect(refinanceAlerts.enabled).toBeDefined();
    expect(refinanceAlerts.rateGapThreshold).toBeDefined();
    expect(refinanceAlerts.notifyOnCashRateChange).toBeDefined();
  });

  it("exports loanPurposeEnum", () => {
    expect(loanPurposeEnum).toBeDefined();
  });
});
