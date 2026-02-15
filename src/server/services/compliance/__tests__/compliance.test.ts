import { describe, it, expect } from "vitest";
import {
  calculateNextDueDate,
  calculateComplianceStatus,
  type ComplianceStatus,
} from "../compliance";

describe("compliance service", () => {
  describe("calculateNextDueDate", () => {
    it("adds frequency months to completion date", () => {
      const completedAt = new Date("2026-01-15");
      const nextDue = calculateNextDueDate(completedAt, 12);
      expect(nextDue.toISOString().split("T")[0]).toBe("2027-01-15");
    });

    it("handles 24-month frequency", () => {
      const completedAt = new Date("2026-06-01");
      const nextDue = calculateNextDueDate(completedAt, 24);
      expect(nextDue.toISOString().split("T")[0]).toBe("2028-06-01");
    });
  });

  describe("calculateComplianceStatus", () => {
    it("returns compliant when more than 30 days until due", () => {
      const today = new Date("2026-01-01");
      const nextDueAt = new Date("2026-03-01"); // 59 days away
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("compliant");
    });

    it("returns upcoming when 30 days or less until due", () => {
      const today = new Date("2026-01-01");
      const nextDueAt = new Date("2026-01-25"); // 24 days away
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("upcoming");
    });

    it("returns due_soon when 7 days or less until due", () => {
      const today = new Date("2026-01-01");
      const nextDueAt = new Date("2026-01-05"); // 4 days away
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("due_soon");
    });

    it("returns overdue when past due date", () => {
      const today = new Date("2026-01-15");
      const nextDueAt = new Date("2026-01-10"); // 5 days overdue
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("overdue");
    });
  });
});
