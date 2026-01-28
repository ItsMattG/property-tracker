import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock the database
const mockExecute = vi.fn();
vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          execute: mockExecute,
        })),
      })),
    })),
  },
}));

import { sendAlert, recordHeartbeat } from "../monitoring";

describe("monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    mockExecute.mockResolvedValue(undefined);
  });

  describe("sendAlert", () => {
    it("sends POST to ntfy with correct headers", async () => {
      await sendAlert("Test Title", "Test message");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ntfy.sh"),
        expect.objectContaining({
          method: "POST",
          body: "Test message",
          headers: expect.objectContaining({
            Title: "Test Title",
          }),
        })
      );
    });

    it("sends high priority when specified", async () => {
      await sendAlert("Alert", "Body", "high");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Priority: "high",
          }),
        })
      );
    });

    it("does not throw on fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(sendAlert("Title", "Body")).resolves.not.toThrow();
    });
  });

  describe("recordHeartbeat", () => {
    it("calls db insert with correct cron name and status", async () => {
      const { db } = await import("@/server/db");

      await recordHeartbeat("sync-banks", {
        status: "success",
        durationMs: 1234,
        metadata: { processed: 5 },
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("does not throw on db failure", async () => {
      mockExecute.mockRejectedValue(new Error("DB error"));

      await expect(
        recordHeartbeat("sync-banks", {
          status: "failure",
          durationMs: 500,
        })
      ).resolves.not.toThrow();
    });
  });
});
