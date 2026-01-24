import { appRouter } from "../routers/_app";

type MockUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createMockContext(overrides: {
  clerkId?: string | null;
  user?: MockUser | null;
} = {}) {
  return {
    db: {} as any, // Will be mocked per test
    clerkId: overrides.clerkId ?? null,
    user: overrides.user ?? null,
  };
}

export function createTestCaller(ctx: ReturnType<typeof createMockContext>) {
  return appRouter.createCaller(ctx as any);
}
