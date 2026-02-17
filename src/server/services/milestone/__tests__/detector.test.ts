import { describe, it, expect } from "vitest";
import { detectNewMilestones } from "../detector";
import { MILESTONES, type MilestoneContext } from "../types";

function makeContext(overrides: Partial<MilestoneContext> = {}): MilestoneContext {
  return {
    propertyCount: 0,
    totalEquity: 0,
    monthsPositiveCashFlow: 0,
    categorizedTransactionPercent: 0,
    bankAccountsConnected: 0,
    taxReportsGenerated: 0,
    ...overrides,
  };
}

describe("detectNewMilestones", () => {
  it("detects first-property milestone when propertyCount >= 1", () => {
    const ctx = makeContext({ propertyCount: 1 });
    const achieved: string[] = [];
    const newMilestones = detectNewMilestones(ctx, achieved);
    expect(newMilestones.map((m) => m.id)).toContain("first-property");
  });

  it("excludes already-achieved milestones", () => {
    const ctx = makeContext({ propertyCount: 1, bankAccountsConnected: 2 });
    const achieved = ["bank-connected"];
    const newMilestones = detectNewMilestones(ctx, achieved);
    expect(newMilestones.map((m) => m.id)).toContain("first-property");
    expect(newMilestones.map((m) => m.id)).not.toContain("bank-connected");
  });

  it("returns empty when all milestones already achieved", () => {
    const ctx = makeContext({
      propertyCount: 5,
      totalEquity: 1_500_000,
      monthsPositiveCashFlow: 24,
      categorizedTransactionPercent: 100,
      bankAccountsConnected: 3,
      taxReportsGenerated: 2,
    });
    const achieved = MILESTONES.map((m) => m.id);
    const newMilestones = detectNewMilestones(ctx, achieved);
    expect(newMilestones).toHaveLength(0);
  });

  it("returns empty when no milestones are met", () => {
    const ctx = makeContext();
    const newMilestones = detectNewMilestones(ctx, []);
    expect(newMilestones).toHaveLength(0);
  });

  it("detects multiple new milestones at once", () => {
    const ctx = makeContext({
      propertyCount: 3,
      totalEquity: 600_000,
      bankAccountsConnected: 1,
    });
    const newMilestones = detectNewMilestones(ctx, []);
    const ids = newMilestones.map((m) => m.id);
    expect(ids).toContain("first-property");
    expect(ids).toContain("portfolio-3");
    expect(ids).toContain("equity-100k");
    expect(ids).toContain("equity-500k");
    expect(ids).toContain("bank-connected");
    expect(ids).not.toContain("equity-1m");
  });

  it("detects equity-1m milestone at exactly 1,000,000", () => {
    const ctx = makeContext({ totalEquity: 1_000_000 });
    const newMilestones = detectNewMilestones(ctx, []);
    const ids = newMilestones.map((m) => m.id);
    expect(ids).toContain("equity-1m");
    expect(ids).toContain("equity-500k");
    expect(ids).toContain("equity-100k");
  });

  it("detects tax milestone when reports generated", () => {
    const ctx = makeContext({ taxReportsGenerated: 1 });
    const newMilestones = detectNewMilestones(ctx, []);
    expect(newMilestones.map((m) => m.id)).toContain("first-tax-report");
  });

  it("detects all-categorized at exactly 100%", () => {
    const ctx = makeContext({ categorizedTransactionPercent: 100 });
    const newMilestones = detectNewMilestones(ctx, []);
    expect(newMilestones.map((m) => m.id)).toContain("all-categorized");
  });

  it("does not detect all-categorized at 99%", () => {
    const ctx = makeContext({ categorizedTransactionPercent: 99 });
    const newMilestones = detectNewMilestones(ctx, []);
    expect(newMilestones.map((m) => m.id)).not.toContain("all-categorized");
  });
});
