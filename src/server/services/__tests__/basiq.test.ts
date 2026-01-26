import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("BasiqService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("BASIQ_API_KEY", "test-api-key");
    vi.stubEnv("BASIQ_SERVER_URL", "https://test-api.basiq.io");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("retry logic", () => {
    it("should retry on 429 rate limit", async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            text: () => Promise.resolve("Rate limited"),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "user-123", email: "test@test.com" }),
        });
      });

      const { basiqService } = await import("../basiq");
      // Set a valid token to skip auth
      (basiqService as any).accessToken = "valid-token";
      (basiqService as any).tokenExpiry = new Date(Date.now() + 3600000);

      const result = await basiqService.getUser("user-123");
      expect(result.id).toBe("user-123");
      expect(attempts).toBe(3);
    });

    it("should retry on 500 server error", async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            text: () => Promise.resolve("Server error"),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "user-123", email: "test@test.com" }),
        });
      });

      const { basiqService } = await import("../basiq");
      (basiqService as any).accessToken = "valid-token";
      (basiqService as any).tokenExpiry = new Date(Date.now() + 3600000);

      const result = await basiqService.getUser("user-123");
      expect(result.id).toBe("user-123");
      expect(attempts).toBe(2);
    });

    it("should fail after max retries", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      });

      const { basiqService } = await import("../basiq");
      (basiqService as any).accessToken = "valid-token";
      (basiqService as any).tokenExpiry = new Date(Date.now() + 3600000);

      await expect(basiqService.getUser("user-123")).rejects.toThrow();
    });

    it("should not retry on 400 client error", async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: () => Promise.resolve("Invalid request"),
        });
      });

      const { basiqService } = await import("../basiq");
      (basiqService as any).accessToken = "valid-token";
      (basiqService as any).tokenExpiry = new Date(Date.now() + 3600000);

      await expect(basiqService.getUser("user-123")).rejects.toThrow();
      expect(attempts).toBe(1); // Should not retry
    });
  });
});
