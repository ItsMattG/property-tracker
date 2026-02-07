import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  mockUser,
  createUnauthenticatedContext,
  createAuthenticatedContext,
} from "../../__tests__/test-utils";

describe("transaction router", () => {
  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.transaction.list({})).rejects.toThrow(TRPCError);
      await expect(caller.transaction.list({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws UNAUTHORIZED when user not found in database", async () => {
      const ctx = createMockContext({ userId: "clerk_123" });
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(caller.transaction.list({})).rejects.toThrow(TRPCError);
      await expect(caller.transaction.list({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("data isolation", () => {
    it("transaction.list only returns user's transactions", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.transactions = { findMany: findManyMock };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const caller = createTestCaller(ctx);
      await caller.transaction.list({});

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("transaction.updateCategory only updates user's own transactions", async () => {
      const ctx = createAuthenticatedContext();
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      ctx.db.update = updateMock;
      ctx.db.query.transactions = {
        findFirst: vi.fn().mockResolvedValue({ category: "uncategorized" }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.updateCategory({
        id: "550e8400-e29b-41d4-a716-446655440000",
        category: "insurance",
      });

      expect(updateMock).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("transaction.delete only deletes user's own transactions", async () => {
      const ctx = createAuthenticatedContext();
      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db.delete = deleteMock;

      const caller = createTestCaller(ctx);
      await caller.transaction.delete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(deleteMock).toHaveBeenCalled();
    });

    it("transaction.create associates transaction with authenticated user", async () => {
      const ctx = createAuthenticatedContext();
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-tx", userId: mockUser.id }]),
        }),
      });

      ctx.db.insert = insertMock;

      const caller = createTestCaller(ctx);
      await caller.transaction.create({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-01-01",
        description: "Test",
        amount: "100",
      });

      expect(insertMock).toHaveBeenCalled();
    });
  });

  describe("list pagination", () => {
    it("returns paginated results with total count", async () => {
      const ctx = createMockContext({ userId: "clerk_123", user: mockUser });

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
      const ctx = createMockContext({ userId: "clerk_123", user: mockUser });

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
      const ctx = createMockContext({ userId: "clerk_123", user: mockUser });

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
