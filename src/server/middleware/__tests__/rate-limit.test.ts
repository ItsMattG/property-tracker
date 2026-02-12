import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryRateLimiter } from "../rate-limit";

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(3, 60000);
  });

  it("allows requests within limit", async () => {
    expect(await limiter.check("user1")).toEqual({ allowed: true, remaining: 2 });
    expect(await limiter.check("user1")).toEqual({ allowed: true, remaining: 1 });
    expect(await limiter.check("user1")).toEqual({ allowed: true, remaining: 0 });
  });

  it("blocks requests over limit", async () => {
    await limiter.check("user1");
    await limiter.check("user1");
    await limiter.check("user1");
    expect(await limiter.check("user1")).toEqual({ allowed: false, remaining: 0 });
  });

  it("tracks users independently", async () => {
    await limiter.check("user1");
    await limiter.check("user1");
    await limiter.check("user1");
    expect((await limiter.check("user1")).allowed).toBe(false);
    expect((await limiter.check("user2")).allowed).toBe(true);
  });

  it("resets after window expires", async () => {
    vi.useFakeTimers();
    await limiter.check("user1");
    await limiter.check("user1");
    await limiter.check("user1");
    expect((await limiter.check("user1")).allowed).toBe(false);

    vi.advanceTimersByTime(61000);
    expect((await limiter.check("user1")).allowed).toBe(true);
    vi.useRealTimers();
  });
});
