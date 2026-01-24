import { appRouter } from "../routers/_app";
import { vi } from "vitest";

type MockUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Standard mock user for tests
export const mockUser: MockUser = {
  id: "user-1",
  clerkId: "clerk_123",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Different user for isolation tests
export const otherUser: MockUser = {
  id: "user-2",
  clerkId: "clerk_456",
  email: "other@example.com",
  name: "Other User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function createMockContext(overrides: {
  clerkId?: string | null;
  user?: MockUser | null;
} = {}) {
  const user = overrides.user ?? null;
  return {
    db: {} as any, // Will be mocked per test
    clerkId: overrides.clerkId ?? null,
    user,
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
  const ctx = createMockContext({ clerkId: user.clerkId, user });
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
  return createMockContext({ clerkId: null });
}
