import { describe, it, expect, vi } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("transaction router", () => {
  describe("list pagination", () => {
    const mockUser = {
      id: "user-1",
      clerkId: "clerk_123",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("returns paginated results with total count", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const allTransactions = Array.from({ length: 150 }, (_, i) => ({
        id: `tx-${i}`,
        userId: "user-1",
        date: new Date(),
        description: `Transaction ${i}`,
        amount: 100,
      }));

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: {
            findMany: vi.fn().mockImplementation(({ limit, offset }) =>
              allTransactions.slice(offset, offset + limit)
            ),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 150 }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.list({ limit: 50, offset: 0 });

      expect(result.transactions).toHaveLength(50);
      expect(result.total).toBe(150);
      expect(result.hasMore).toBe(true);
    });

    it("returns hasMore: false on last page", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: {
            findMany: vi.fn().mockResolvedValue([
              { id: "tx-1", userId: "user-1" },
              { id: "tx-2", userId: "user-1" },
            ]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 52 }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.list({ limit: 50, offset: 50 });

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(52);
      expect(result.hasMore).toBe(false);
    });

    it("defaults to limit 50 and offset 0", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const findManyMock = vi.fn().mockResolvedValue([]);
      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: { findMany: findManyMock },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      await caller.transaction.list({});

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 })
      );
    });
  });
});
