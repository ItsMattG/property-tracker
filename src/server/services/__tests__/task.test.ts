import { describe, it, expect } from "vitest";
import {
  isOverdue,
  getDaysUntilDue,
  shouldSendReminder,
} from "../task";

describe("task service", () => {
  describe("isOverdue", () => {
    it("returns true when due date is in the past and not done", () => {
      expect(isOverdue("2026-01-01", "todo", new Date("2026-01-15"))).toBe(true);
    });

    it("returns false when due date is in the future", () => {
      expect(isOverdue("2026-02-01", "todo", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when status is done", () => {
      expect(isOverdue("2026-01-01", "done", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when no due date", () => {
      expect(isOverdue(null, "todo", new Date("2026-01-15"))).toBe(false);
    });
  });

  describe("getDaysUntilDue", () => {
    it("returns positive days for future date", () => {
      expect(getDaysUntilDue("2026-01-20", new Date("2026-01-15"))).toBe(5);
    });

    it("returns negative days for past date", () => {
      expect(getDaysUntilDue("2026-01-10", new Date("2026-01-15"))).toBe(-5);
    });

    it("returns 0 for today", () => {
      expect(getDaysUntilDue("2026-01-15", new Date("2026-01-15"))).toBe(0);
    });

    it("returns null when no due date", () => {
      expect(getDaysUntilDue(null, new Date("2026-01-15"))).toBeNull();
    });
  });

  describe("shouldSendReminder", () => {
    it("returns true when days until due matches offset", () => {
      expect(shouldSendReminder("2026-01-18", 3, "todo", new Date("2026-01-15"))).toBe(true);
    });

    it("returns false when days until due does not match offset", () => {
      expect(shouldSendReminder("2026-01-20", 3, "todo", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when task is done", () => {
      expect(shouldSendReminder("2026-01-18", 3, "done", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when no reminder offset", () => {
      expect(shouldSendReminder("2026-01-18", null, "todo", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when no due date", () => {
      expect(shouldSendReminder(null, 3, "todo", new Date("2026-01-15"))).toBe(false);
    });
  });
});
