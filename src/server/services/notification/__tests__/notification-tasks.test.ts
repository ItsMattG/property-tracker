import { describe, it, expect } from "vitest";
import { shouldSendNotification, type NotificationPrefs } from "../notification";

describe("task reminder notifications", () => {
  const basePrefs: NotificationPrefs = {
    emailEnabled: true,
    pushEnabled: true,
    rentReceived: true,
    syncFailed: true,
    anomalyDetected: true,
    weeklyDigest: true,
    complianceReminders: true,
    taskReminders: true,
  };

  it("sends task_reminder when taskReminders enabled", () => {
    expect(shouldSendNotification(basePrefs, "task_reminder", "email")).toBe(true);
  });

  it("blocks task_reminder when taskReminders disabled", () => {
    expect(
      shouldSendNotification({ ...basePrefs, taskReminders: false }, "task_reminder", "email")
    ).toBe(false);
  });

  it("sends task_assigned when taskReminders enabled", () => {
    expect(shouldSendNotification(basePrefs, "task_assigned", "email")).toBe(true);
  });
});
