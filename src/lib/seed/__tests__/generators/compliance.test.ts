import { describe, it, expect } from "vitest";
import { generateComplianceRecord } from "../../generators/compliance";

describe("generateComplianceRecord", () => {
  it("creates a compliance record", () => {
    const record = generateComplianceRecord({
      propertyId: "prop-123",
      userId: "user-123",
      requirementId: "smoke_alarms",
      completedAt: new Date("2024-01-15"),
      nextDueAt: new Date("2025-01-15"),
    });

    expect(record.requirementId).toBe("smoke_alarms");
    expect(record.completedAt).toBe("2024-01-15");
    expect(record.nextDueAt).toBe("2025-01-15");
  });

  it("creates an overdue compliance record", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);

    const record = generateComplianceRecord({
      propertyId: "prop-123",
      userId: "user-123",
      requirementId: "smoke_alarms",
      completedAt: new Date("2023-01-15"),
      nextDueAt: pastDate,
    });

    expect(new Date(record.nextDueAt) < new Date()).toBe(true);
  });
});
