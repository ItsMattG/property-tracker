import { describe, it, expect } from "vitest";
import { generateDemoData } from "../../profiles/demo";

describe("generateDemoData", () => {
  it("generates 4 properties (1 sold)", () => {
    const data = generateDemoData("user-123");

    expect(data.properties).toHaveLength(4);
    expect(data.properties.filter((p) => p.status === "sold")).toHaveLength(1);
    expect(data.properties.filter((p) => p.status === "active")).toHaveLength(3);
  });

  it("generates loans for active properties only", () => {
    const data = generateDemoData("user-123");

    expect(data.loans).toHaveLength(3);
  });

  it("generates property sale for sold property", () => {
    const data = generateDemoData("user-123");

    expect(data.propertySales).toHaveLength(1);
  });

  it("generates transactions spanning 5 years", () => {
    const data = generateDemoData("user-123");

    const dates = data.transactions.map((t) => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const yearSpan = maxDate.getFullYear() - minDate.getFullYear();
    expect(yearSpan).toBeGreaterThanOrEqual(4);
  });

  it("generates anomaly alerts", () => {
    const data = generateDemoData("user-123");

    expect(data.anomalyAlerts.length).toBeGreaterThan(0);
    expect(data.anomalyAlerts.some((a) => a.alertType === "missed_rent")).toBe(true);
  });

  it("generates compliance records with one overdue", () => {
    const data = generateDemoData("user-123");

    expect(data.complianceRecords.length).toBeGreaterThan(0);
    const hasOverdue = data.complianceRecords.some(
      (r) => new Date(r.nextDueAt) < new Date()
    );
    expect(hasOverdue).toBe(true);
  });
});
