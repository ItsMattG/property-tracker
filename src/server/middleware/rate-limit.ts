import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * In-memory fallback for development/test environments where Upstash isn't configured.
 */
class InMemoryRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (entry && now >= entry.resetAt) {
      this.store.delete(key);
    }

    const current = this.store.get(key);

    if (!current) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (current.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    current.count++;
    return { allowed: true, remaining: this.maxRequests - current.count };
  }
}

interface DistributedRateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

/**
 * Upstash Redis-backed rate limiter for production (works across serverless instances).
 */
class UpstashRateLimiter implements DistributedRateLimiter {
  private ratelimit: Ratelimit;

  constructor(maxRequests: number, windowSeconds: number, prefix: string) {
    this.ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: `@bricktrack/ratelimit:${prefix}`,
      ephemeralCache: new Map(),
      timeout: 3000,
    });
  }

  async check(key: string): Promise<RateLimitResult> {
    const { success, remaining } = await this.ratelimit.limit(key);
    return { allowed: success, remaining };
  }
}

function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  prefix: string
): DistributedRateLimiter {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash) {
    return new UpstashRateLimiter(maxRequests, Math.floor(windowMs / 1000), prefix);
  }

  return new InMemoryRateLimiter(maxRequests, windowMs);
}

// Pre-configured limiters
export const apiRateLimiter = createRateLimiter(100, 60_000, "api");
export const authRateLimiter = createRateLimiter(10, 60_000, "auth");

// Re-export for tests
export { InMemoryRateLimiter };
