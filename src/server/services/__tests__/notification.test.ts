import { describe, it, expect } from "vitest";
import {
  isQuietHours,
  shouldSendNotification,
  type NotificationPrefs,
} from "../notification";

describe("notification service", () => {
  describe("isQuietHours", () => {
    it("returns true during quiet hours (evening)", () => {
      // 10pm is after 9pm start
      const result = isQuietHours("21:00", "08:00", 22, 0);
      expect(result).toBe(true);
    });

    it("returns true during quiet hours (early morning)", () => {
      // 6am is before 8am end
      const result = isQuietHours("21:00", "08:00", 6, 0);
      expect(result).toBe(true);
    });

    it("returns false outside quiet hours", () => {
      // 2pm is outside 9pm-8am
      const result = isQuietHours("21:00", "08:00", 14, 0);
      expect(result).toBe(false);
    });

    it("returns false at exactly end time", () => {
      // 8am is end of quiet hours
      const result = isQuietHours("21:00", "08:00", 8, 0);
      expect(result).toBe(false);
    });
  });

  describe("shouldSendNotification", () => {
    const basePrefs: NotificationPrefs = {
      emailEnabled: true,
      pushEnabled: true,
      rentReceived: true,
      syncFailed: true,
      anomalyDetected: true,
      weeklyDigest: true,
      complianceReminders: true,
    };

    it("returns true when preference is enabled", () => {
      const result = shouldSendNotification(basePrefs, "rent_received", "email");
      expect(result).toBe(true);
    });

    it("returns false when channel is disabled", () => {
      const prefs = { ...basePrefs, emailEnabled: false };
      const result = shouldSendNotification(prefs, "rent_received", "email");
      expect(result).toBe(false);
    });

    it("returns false when notification type is disabled", () => {
      const prefs = { ...basePrefs, rentReceived: false };
      const result = shouldSendNotification(prefs, "rent_received", "email");
      expect(result).toBe(false);
    });

    it("handles anomaly types correctly", () => {
      const result = shouldSendNotification(basePrefs, "anomaly_critical", "push");
      expect(result).toBe(true);
    });
  });
});
