import { describe, it, expect } from "vitest";
import {
  complianceRecords,
  type ComplianceRecord,
  type NewComplianceRecord,
} from "../schema";

describe("Compliance schema", () => {
  it("exports complianceRecords table", () => {
    expect(complianceRecords).toBeDefined();
  });

  it("exports ComplianceRecord type", () => {
    const record: ComplianceRecord = {
      id: "test-id",
      propertyId: "prop-id",
      userId: "user-id",
      requirementId: "smoke_alarm",
      completedAt: "2026-01-01",
      nextDueAt: "2027-01-01",
      notes: null,
      documentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(record.requirementId).toBe("smoke_alarm");
  });

  it("exports NewComplianceRecord type", () => {
    const newRecord: NewComplianceRecord = {
      propertyId: "prop-id",
      userId: "user-id",
      requirementId: "smoke_alarm",
      completedAt: "2026-01-01",
      nextDueAt: "2027-01-01",
    };
    expect(newRecord.requirementId).toBe("smoke_alarm");
  });
});
