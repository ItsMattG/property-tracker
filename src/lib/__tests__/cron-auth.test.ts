import { describe, it, expect, vi, beforeEach } from "vitest";

describe("verifyCronRequest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
  });

  it("should reject missing authorization header", async () => {
    const { verifyCronRequest } = await import("../cron-auth");
    const headers = new Headers();
    expect(verifyCronRequest(headers)).toBe(false);
  });

  it("should reject invalid token", async () => {
    const { verifyCronRequest } = await import("../cron-auth");
    const headers = new Headers();
    headers.set("authorization", "Bearer wrong-token");
    expect(verifyCronRequest(headers)).toBe(false);
  });

  it("should accept valid token", async () => {
    const { verifyCronRequest } = await import("../cron-auth");
    const headers = new Headers();
    headers.set("authorization", "Bearer test-cron-secret");
    expect(verifyCronRequest(headers)).toBe(true);
  });

  it("should reject when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { verifyCronRequest } = await import("../cron-auth");
    const headers = new Headers();
    headers.set("authorization", "Bearer test-cron-secret");
    expect(verifyCronRequest(headers)).toBe(false);
  });

  it("should use timing-safe comparison", async () => {
    const { verifyCronRequest } = await import("../cron-auth");

    // This test ensures we don't short-circuit on first character mismatch
    const headers = new Headers();
    headers.set("authorization", "Bearer xest-cron-secret"); // differs in first char

    const start = performance.now();
    verifyCronRequest(headers);
    const time1 = performance.now() - start;

    headers.set("authorization", "Bearer test-cron-secrex"); // differs in last char
    const start2 = performance.now();
    verifyCronRequest(headers);
    const time2 = performance.now() - start2;

    // Times should be similar (within 10ms) for timing-safe comparison
    expect(Math.abs(time1 - time2)).toBeLessThan(10);
  });
});
