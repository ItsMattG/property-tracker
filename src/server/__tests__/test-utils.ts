import { appRouter } from "../routers/_app";
import { vi } from "vitest";
import type { UnitOfWork } from "../repositories/unit-of-work";

type MockUser = {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Standard mock user for tests
export const mockUser: MockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Different user for isolation tests
export const otherUser: MockUser = {
  id: "user-2",
  email: "other@example.com",
  name: "Other User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function createMockContext(overrides: {
  userId?: string | null;
  user?: MockUser | null;
  uow?: UnitOfWork;
} = {}) {
  const user = overrides.user ?? null;
  return {
    db: {} as any, // Will be mocked per test
    userId: overrides.userId ?? null,
    user,
    uow: overrides.uow,
    portfolio: {
      ownerId: user?.id ?? "user-1",
      role: "owner" as const,
      canWrite: true,
      canManageMembers: true,
      canManageBanks: true,
      canViewAuditLog: true,
      canUploadDocuments: true,
    },
  };
}

export function createTestCaller(ctx: ReturnType<typeof createMockContext>) {
  return appRouter.createCaller(ctx as any);
}

// Create context with user lookup mock
export function createAuthenticatedContext(user = mockUser) {
  const ctx = createMockContext({ userId: user.id, user });
  ctx.db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  } as any;
  return ctx;
}

// Create unauthenticated context
export function createUnauthenticatedContext() {
  return createMockContext({ userId: null });
}

/**
 * Create a mock UoW with auto-generated vi.fn() stubs for all repository methods.
 *
 * Usage:
 *   const uow = createMockUow({
 *     property: { findById: vi.fn().mockResolvedValue(mockProperty) },
 *   });
 *   const ctx = createMockContext({ userId: "user-1", user: mockUser, uow });
 *
 * Any repository method not explicitly overridden returns a vi.fn() that resolves undefined.
 */
export function createMockUow(
  overrides: Record<string, Record<string, unknown>> = {}
): UnitOfWork {
  const repos: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop in repos) return repos[prop];
      // Create a proxy for each repository that auto-generates vi.fn() for any method
      repos[prop] = new Proxy(overrides[prop] ?? {}, {
        get(repoTarget, method: string) {
          if (method in repoTarget) return repoTarget[method];
          const fn = vi.fn();
          (repoTarget as Record<string, unknown>)[method] = fn;
          return fn;
        },
      });
      return repos[prop];
    },
  };
  return new Proxy({}, handler) as unknown as UnitOfWork;
}
