import { describe, it, expect } from "vitest";
import { generateDevData } from "../../profiles/dev";

describe("generateDevData", () => {
  it("generates 2 properties", () => {
    const data = generateDevData("user-123");

    expect(data.properties).toHaveLength(2);
    expect(data.properties.every((p) => p.status === "active")).toBe(true);
  });

  it("uses obviously fake addresses", () => {
    const data = generateDevData("user-123");

    expect(data.properties[0].address).toContain("Test");
    expect(data.properties[1].address).toContain("Dev");
  });

  it("generates ~100 transactions over 1 year", () => {
    const data = generateDevData("user-123");

    expect(data.transactions.length).toBeGreaterThan(50);
    expect(data.transactions.length).toBeLessThan(150);
  });

  it("generates one of each alert type", () => {
    const data = generateDevData("user-123");

    const alertTypes = data.anomalyAlerts.map((a) => a.alertType);
    expect(alertTypes).toContain("missed_rent");
    expect(alertTypes).toContain("unusual_amount");
  });
});
