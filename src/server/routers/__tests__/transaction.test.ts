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
      const ctx = createMockContext({ userId: "user-1" });
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

  describe("get", () => {
    it("returns a transaction by id", async () => {
      const ctx = createAuthenticatedContext();
      const mockTx = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: mockUser.id,
        description: "Test tx",
        amount: "100",
      };

      ctx.db.query.transactions = {
        findFirst: vi.fn().mockResolvedValue(mockTx),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.get({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toEqual(mockTx);
    });

    it("throws NOT_FOUND when transaction does not exist", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.transactions = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.transaction.get({
          id: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("update", () => {
    it("updates a transaction and derives transactionType", async () => {
      const ctx = createAuthenticatedContext();
      const updatedTx = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        category: "insurance",
        transactionType: "expense",
        isDeductible: true,
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTx]),
          }),
        }),
      });

      ctx.db.update = updateMock;

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        propertyId: "660e8400-e29b-41d4-a716-446655440000",
        date: "2025-06-01",
        description: "Updated insurance",
        amount: "250.50",
        category: "insurance",
      });

      expect(updateMock).toHaveBeenCalled();
      expect(result).toEqual(updatedTx);
    });

    it("derives income type for rental_income category", async () => {
      const ctx = createAuthenticatedContext();

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ transactionType: "income" }]),
        }),
      });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      await caller.transaction.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        propertyId: "660e8400-e29b-41d4-a716-446655440000",
        date: "2025-06-01",
        description: "Rent",
        amount: "2000",
        category: "rental_income",
      });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "income",
          isDeductible: true,
        })
      );
    });

    it("derives capital type for stamp_duty category", async () => {
      const ctx = createAuthenticatedContext();

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ transactionType: "capital" }]),
        }),
      });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      await caller.transaction.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        propertyId: "660e8400-e29b-41d4-a716-446655440000",
        date: "2025-06-01",
        description: "Stamp duty",
        amount: "15000",
        category: "stamp_duty",
      });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "capital",
          isDeductible: false,
        })
      );
    });
  });

  describe("exportCSV", () => {
    it("returns CSV with header and rows", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.transactions = {
        findMany: vi.fn().mockResolvedValue([
          {
            date: "2025-06-01",
            description: "Rent payment",
            amount: "2000",
            category: "rental_income",
            transactionType: "income",
            property: { address: "123 Test St" },
            isDeductible: true,
            isVerified: true,
            notes: "",
          },
          {
            date: "2025-06-15",
            description: 'Item with "quotes", and commas',
            amount: "-150",
            category: "insurance",
            transactionType: "expense",
            property: null,
            isDeductible: true,
            isVerified: false,
            notes: null,
          },
        ]),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.exportCSV({});

      expect(result.csv).toContain("Date,Description,Amount,Category");
      expect(result.csv).toContain("2025-06-01,Rent payment,2000");
      expect(result.csv).toContain('""quotes""'); // CSV-escaped quotes
      expect(result.filename).toMatch(/^bricktrack-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("returns empty CSV when no transactions", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.transactions = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.exportCSV({});

      const lines = result.csv.split("\n");
      expect(lines).toHaveLength(1); // Header only
      expect(lines[0]).toContain("Date,Description");
    });

    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.transaction.exportCSV({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("bulkUpdateCategory", () => {
    it("updates multiple transactions", async () => {
      const ctx = createAuthenticatedContext();
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.bulkUpdateCategory({
        ids: [
          "550e8400-e29b-41d4-a716-446655440000",
          "660e8400-e29b-41d4-a716-446655440000",
        ],
        category: "insurance",
      });

      expect(ctx.db.update).toHaveBeenCalled();
      expect(result.count).toBe(2);
      expect(result.success).toBe(true);
    });

    it("derives income type for rental_income", async () => {
      const ctx = createAuthenticatedContext();
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      await caller.transaction.bulkUpdateCategory({
        ids: ["550e8400-e29b-41d4-a716-446655440000"],
        category: "rental_income",
      });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "income",
          isDeductible: true,
        })
      );
    });

    it("derives capital type for stamp_duty", async () => {
      const ctx = createAuthenticatedContext();
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      await caller.transaction.bulkUpdateCategory({
        ids: ["550e8400-e29b-41d4-a716-446655440000"],
        category: "stamp_duty",
      });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "capital",
          isDeductible: false,
        })
      );
    });
  });

  describe("toggleVerified", () => {
    it("toggles isVerified from false to true", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.transactions = {
        findFirst: vi.fn().mockResolvedValue({
          id: "550e8400-e29b-41d4-a716-446655440000",
          isVerified: false,
        }),
      };
      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ isVerified: true }]),
          }),
        }),
      });

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.toggleVerified({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toEqual({ isVerified: true });
    });

    it("throws when transaction not found", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.transactions = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.transaction.toggleVerified({
          id: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow("Transaction not found");
    });
  });

  describe("list pagination", () => {
    it("returns paginated results with total count", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

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
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

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

    it("passes bankAccountId filter when provided", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

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
      await caller.transaction.list({
        bankAccountId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    it("defaults to limit 50 and offset 0", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

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
