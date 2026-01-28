import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "../rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });
  });

  it("allows requests within limit", () => {
    expect(limiter.check("user1")).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check("user1")).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check("user1")).toEqual({ allowed: true, remaining: 0 });
  });

  it("blocks requests over limit", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1")).toEqual({ allowed: false, remaining: 0 });
  });

  it("tracks users independently", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1").allowed).toBe(false);
    expect(limiter.check("user2").allowed).toBe(true);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1").allowed).toBe(false);

    vi.advanceTimersByTime(61000);
    expect(limiter.check("user1").allowed).toBe(true);
    vi.useRealTimers();
  });
});
