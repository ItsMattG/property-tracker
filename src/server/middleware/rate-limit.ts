interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Clean up expired entry
    if (entry && now >= entry.resetAt) {
      this.store.delete(key);
    }

    const current = this.store.get(key);

    if (!current) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return { allowed: true, remaining: this.config.maxRequests - 1 };
    }

    if (current.count >= this.config.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    current.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - current.count,
    };
  }
}

// Pre-configured limiters
export const apiRateLimiter = new RateLimiter({
  windowMs: 60_000, // 1 minute
  maxRequests: 100,
});

export const authRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
