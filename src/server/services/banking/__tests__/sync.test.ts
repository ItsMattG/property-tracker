import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  calculateRetryAfter,
  mapBasiqErrorToAlertType,
  RATE_LIMIT_MINUTES,
} from "../sync";

describe("sync service", () => {
  describe("checkRateLimit", () => {
    it("returns allowed when lastManualSyncAt is null", () => {
      const result = checkRateLimit(null);
      expect(result.allowed).toBe(true);
    });

    it("returns allowed when lastManualSyncAt is older than 15 minutes", () => {
      const oldSync = new Date(Date.now() - 16 * 60 * 1000);
      const result = checkRateLimit(oldSync);
      expect(result.allowed).toBe(true);
    });

    it("returns not allowed when lastManualSyncAt is within 15 minutes", () => {
      const recentSync = new Date(Date.now() - 5 * 60 * 1000);
      const result = checkRateLimit(recentSync);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.message).toContain("10 minutes");
    });

    it("returns correct remaining time in message", () => {
      const recentSync = new Date(Date.now() - 12 * 60 * 1000);
      const result = checkRateLimit(recentSync);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("3 minutes");
    });
  });

  describe("calculateRetryAfter", () => {
    it("calculates correct retry time", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const retryAfter = calculateRetryAfter(fiveMinutesAgo);

      // Should be about 10 minutes from now
      const diffMinutes = (retryAfter.getTime() - Date.now()) / (60 * 1000);
      expect(diffMinutes).toBeCloseTo(10, 0);
    });

    it("adds RATE_LIMIT_MINUTES to lastManualSyncAt", () => {
      const syncTime = new Date("2026-01-24T10:00:00Z");
      const retryAfter = calculateRetryAfter(syncTime);

      const expectedTime = new Date(syncTime.getTime() + RATE_LIMIT_MINUTES * 60 * 1000);
      expect(retryAfter.getTime()).toBe(expectedTime.getTime());
    });
  });

  describe("mapBasiqErrorToAlertType", () => {
    it("maps 401 to requires_reauth", () => {
      expect(mapBasiqErrorToAlertType(401)).toBe("requires_reauth");
    });

    it("maps 403 to requires_reauth", () => {
      expect(mapBasiqErrorToAlertType(403)).toBe("requires_reauth");
    });

    it("maps 408 timeout to disconnected", () => {
      expect(mapBasiqErrorToAlertType(408)).toBe("disconnected");
    });

    it("maps 504 gateway timeout to disconnected", () => {
      expect(mapBasiqErrorToAlertType(504)).toBe("disconnected");
    });

    it("maps 500 to sync_failed", () => {
      expect(mapBasiqErrorToAlertType(500)).toBe("sync_failed");
    });

    it("maps 400 to sync_failed", () => {
      expect(mapBasiqErrorToAlertType(400)).toBe("sync_failed");
    });

    it("maps unknown codes to sync_failed", () => {
      expect(mapBasiqErrorToAlertType(503)).toBe("sync_failed");
    });
  });
});
