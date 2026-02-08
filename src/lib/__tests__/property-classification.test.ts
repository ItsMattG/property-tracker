import { describe, it, expect } from "vitest";
import { classifyProperty, getPerformanceBadgeConfig } from "../property-classification";

describe("classifyProperty", () => {
  const base = {
    grossYield: 4,
    cashFlow: 100,
    capitalGrowthPercent: 5,
    lvr: 60,
    hasValue: true,
    annualIncome: 20000,
  };

  it("returns null for insufficient data (no value, no income)", () => {
    expect(
      classifyProperty({ ...base, hasValue: false, annualIncome: 0 })
    ).toBeNull();
  });

  it("classifies as underperforming when cashFlow < 0 AND lvr > 80", () => {
    expect(
      classifyProperty({ ...base, cashFlow: -500, lvr: 85 })
    ).toBe("underperforming");
  });

  it("classifies as top-performer when grossYield >= 5 AND cashFlow >= 0", () => {
    expect(
      classifyProperty({ ...base, grossYield: 5, cashFlow: 200 })
    ).toBe("top-performer");
  });

  it("classifies as top-performer when grossYield >= 5 AND cashFlow is exactly 0", () => {
    expect(
      classifyProperty({ ...base, grossYield: 6, cashFlow: 0 })
    ).toBe("top-performer");
  });

  it("classifies as growth-asset when capitalGrowthPercent >= 10", () => {
    expect(
      classifyProperty({ ...base, capitalGrowthPercent: 15, grossYield: 3 })
    ).toBe("growth-asset");
  });

  it("classifies as monitoring when cashFlow < 0 (but lvr <= 80)", () => {
    expect(
      classifyProperty({ ...base, cashFlow: -200, lvr: 70 })
    ).toBe("monitoring");
  });

  it("classifies as monitoring when lvr > 80 (but cashFlow >= 0)", () => {
    expect(
      classifyProperty({ ...base, cashFlow: 100, lvr: 85, grossYield: 3 })
    ).toBe("monitoring");
  });

  it("classifies as performing for default positive case", () => {
    expect(
      classifyProperty({ ...base, grossYield: 3, cashFlow: 100, capitalGrowthPercent: 5, lvr: 60 })
    ).toBe("performing");
  });

  it("classifies as performing when lvr is null and cashFlow >= 0", () => {
    expect(
      classifyProperty({ ...base, lvr: null, grossYield: 3, capitalGrowthPercent: 2 })
    ).toBe("performing");
  });

  it("classifies as performing when grossYield is null but cashFlow >= 0", () => {
    expect(
      classifyProperty({ ...base, grossYield: null, capitalGrowthPercent: 2, lvr: 50 })
    ).toBe("performing");
  });

  it("prioritizes underperforming over top-performer", () => {
    // Even with high yield, negative cash flow + high LVR = underperforming
    expect(
      classifyProperty({ ...base, grossYield: 6, cashFlow: -100, lvr: 90 })
    ).toBe("underperforming");
  });

  it("prioritizes top-performer over growth-asset", () => {
    expect(
      classifyProperty({ ...base, grossYield: 5, cashFlow: 100, capitalGrowthPercent: 15 })
    ).toBe("top-performer");
  });
});

describe("getPerformanceBadgeConfig", () => {
  it("returns config for top-performer", () => {
    const config = getPerformanceBadgeConfig("top-performer");
    expect(config.label).toBe("Top Performer");
  });

  it("returns config for growth-asset", () => {
    const config = getPerformanceBadgeConfig("growth-asset");
    expect(config.label).toBe("Growth Asset");
  });

  it("returns config for performing", () => {
    const config = getPerformanceBadgeConfig("performing");
    expect(config.label).toBe("Performing");
  });

  it("returns config for monitoring", () => {
    const config = getPerformanceBadgeConfig("monitoring");
    expect(config.label).toBe("Monitoring");
  });

  it("returns config for underperforming", () => {
    const config = getPerformanceBadgeConfig("underperforming");
    expect(config.label).toBe("Underperforming");
  });
});
