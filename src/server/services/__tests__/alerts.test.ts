import { describe, it, expect } from "vitest";
import {
  shouldCreateAlert,
  shouldSendEmail,
  formatAlertForEmail,
} from "../alerts";

describe("alerts service", () => {
  describe("shouldCreateAlert", () => {
    it("returns true when no active alerts exist", () => {
      const activeAlerts: { alertType: string }[] = [];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(true);
    });

    it("returns false when active alert of same type exists", () => {
      const activeAlerts = [{ alertType: "sync_failed" }];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(false);
    });

    it("returns true when active alert of different type exists", () => {
      const activeAlerts = [{ alertType: "disconnected" }];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(true);
    });

    it("returns true when multiple different alerts exist", () => {
      const activeAlerts = [
        { alertType: "disconnected" },
        { alertType: "requires_reauth" },
      ];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(true);
    });

    it("returns false when same type exists among multiple alerts", () => {
      const activeAlerts = [
        { alertType: "disconnected" },
        { alertType: "sync_failed" },
      ];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(false);
    });
  });

  describe("shouldSendEmail", () => {
    it("returns false when emailSentAt is set", () => {
      const alert = {
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        emailSentAt: new Date(),
      };
      expect(shouldSendEmail(alert)).toBe(false);
    });

    it("returns false when alert is less than 24 hours old", () => {
      const alert = {
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        emailSentAt: null,
      };
      expect(shouldSendEmail(alert)).toBe(false);
    });

    it("returns true when alert is 24+ hours old and no email sent", () => {
      const alert = {
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        emailSentAt: null,
      };
      expect(shouldSendEmail(alert)).toBe(true);
    });

    it("returns true when alert is exactly 24 hours old", () => {
      const alert = {
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        emailSentAt: null,
      };
      expect(shouldSendEmail(alert)).toBe(true);
    });

    it("returns false when alert is 23 hours old", () => {
      const alert = {
        createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
        emailSentAt: null,
      };
      expect(shouldSendEmail(alert)).toBe(false);
    });
  });

  describe("formatAlertForEmail", () => {
    it("formats disconnected alert correctly", () => {
      const alert = {
        alertType: "disconnected",
        bankAccount: { accountName: "Savings", institution: "CBA" },
      };
      expect(formatAlertForEmail(alert)).toBe("Savings (CBA) has been disconnected");
    });

    it("formats requires_reauth alert correctly", () => {
      const alert = {
        alertType: "requires_reauth",
        bankAccount: { accountName: "Everyday", institution: "NAB" },
      };
      expect(formatAlertForEmail(alert)).toBe("Everyday (NAB) requires re-authentication");
    });

    it("formats sync_failed alert correctly", () => {
      const alert = {
        alertType: "sync_failed",
        bankAccount: { accountName: "Home Loan", institution: "Westpac" },
      };
      expect(formatAlertForEmail(alert)).toBe("Home Loan (Westpac) failed to sync");
    });

    it("handles unknown alert type", () => {
      const alert = {
        alertType: "unknown",
        bankAccount: { accountName: "Test", institution: "Bank" },
      };
      expect(formatAlertForEmail(alert)).toBe("Test (Bank) has an issue");
    });
  });
});
