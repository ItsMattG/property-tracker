import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("recurring router", () => {
  const mockUser = {
    id: "user-1",
    userId: "user-1",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperty = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    address: "123 Main St",
    suburb: "Sydney",
    state: "NSW",
  };

  const mockRecurring = {
    id: "770e8400-e29b-41d4-a716-446655440001",
    userId: "user-1",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    description: "Body Corporate",
    amount: "1500.00",
    category: "body_corporate",
    transactionType: "expense",
    frequency: "quarterly",
    dayOfMonth: "1",
    dayOfWeek: null,
    startDate: "2024-01-01",
    endDate: null,
    linkedBankAccountId: null,
    amountTolerance: "5.00",
    dateTolerance: "3",
    alertDelayDays: "3",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    property: mockProperty,
    linkedBankAccount: null,
  };

  const mockExpectedTransaction = {
    id: "880e8400-e29b-41d4-a716-446655440002",
    recurringTransactionId: "770e8400-e29b-41d4-a716-446655440001",
    userId: "user-1",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    expectedDate: "2024-01-01",
    expectedAmount: "1500.00",
    status: "pending",
    matchedTransactionId: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns recurring transactions for user", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          recurringTransactions: {
            findMany: vi.fn().mockResolvedValue([mockRecurring]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.list();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockRecurring.id);
      expect(result[0].description).toBe("Body Corporate");
    });

    it("filters by propertyId", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          recurringTransactions: {
            findMany: vi.fn().mockResolvedValue([mockRecurring]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.list({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("get", () => {
    it("returns a single recurring transaction with expected transactions", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          recurringTransactions: {
            findFirst: vi.fn().mockResolvedValue({
              ...mockRecurring,
              expectedTransactions: [mockExpectedTransaction],
            }),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.get({
        id: "770e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.id).toBe(mockRecurring.id);
      expect(result.expectedTransactions).toHaveLength(1);
    });

    it("throws error for non-existent recurring transaction", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          recurringTransactions: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.recurring.get({ id: "00000000-0000-0000-0000-000000000000" })
      ).rejects.toThrow("Recurring transaction not found");
    });
  });

  describe("create", () => {
    it("creates a recurring transaction and generates expected transactions", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRecurring]),
        }),
      });

      const insertExpectedMock = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
        insert: vi.fn().mockImplementation((table) => {
          // Check which table is being inserted to
          if (table.id?.name === "expected_transactions") {
            return insertExpectedMock();
          }
          return insertMock();
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.create({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        description: "Body Corporate",
        amount: "1500.00",
        category: "body_corporate",
        transactionType: "expense",
        frequency: "quarterly",
        dayOfMonth: 1,
        startDate: "2024-01-01",
      });

      expect(result.id).toBe(mockRecurring.id);
      expect(insertMock).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes a recurring transaction", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        delete: deleteMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.delete({
        id: "770e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.success).toBe(true);
      expect(deleteMock).toHaveBeenCalled();
    });
  });

  describe("skip", () => {
    it("marks an expected transaction as skipped", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockExpectedTransaction, status: "skipped" },
            ]),
          }),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        update: updateMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.skip({
        expectedId: "880e8400-e29b-41d4-a716-446655440002",
      });

      expect(result.status).toBe("skipped");
    });

    it("throws error for non-existent expected transaction", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        update: updateMock,
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.recurring.skip({ expectedId: "00000000-0000-0000-0000-000000000000" })
      ).rejects.toThrow("Expected transaction not found");
    });
  });

  describe("matchManually", () => {
    it("matches an expected transaction to an actual transaction", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const mockTransaction = {
        id: "990e8400-e29b-41d4-a716-446655440003",
        userId: "user-1",
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        description: "Body Corp Payment",
        amount: "-1500.00",
        category: "uncategorized",
        transactionType: "expense",
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...mockExpectedTransaction,
                status: "matched",
                matchedTransactionId: mockTransaction.id,
              },
            ]),
          }),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: {
            findFirst: vi.fn().mockResolvedValue({
              ...mockExpectedTransaction,
              recurringTransaction: mockRecurring,
            }),
          },
          transactions: {
            findFirst: vi.fn().mockResolvedValue(mockTransaction),
          },
        },
        update: updateMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.matchManually({
        expectedId: "880e8400-e29b-41d4-a716-446655440002",
        transactionId: "990e8400-e29b-41d4-a716-446655440003",
      });

      expect(result!.status).toBe("matched");
      expect(result!.matchedTransactionId).toBe(mockTransaction.id);
    });

    it("throws error for non-existent expected transaction", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          transactions: {
            findFirst: vi.fn().mockResolvedValue({ id: "tx-1" }),
          },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.recurring.matchManually({
          expectedId: "00000000-0000-0000-0000-000000000000",
          transactionId: "11111111-1111-1111-8111-111111111111",
        })
      ).rejects.toThrow("Expected transaction not found");
    });

    it("throws error for non-existent transaction", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: {
            findFirst: vi.fn().mockResolvedValue(mockExpectedTransaction),
          },
          transactions: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.recurring.matchManually({
          expectedId: "880e8400-e29b-41d4-a716-446655440002",
          transactionId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("Transaction not found");
    });
  });

  describe("getExpectedTransactions", () => {
    it("returns expected transactions for user", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: {
            findMany: vi.fn().mockResolvedValue([
              {
                ...mockExpectedTransaction,
                recurringTransaction: mockRecurring,
                property: mockProperty,
                matchedTransaction: null,
              },
            ]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.getExpectedTransactions();

      expect(result).toHaveLength(1);
      expect(result[0].expectedDate).toBe("2024-01-01");
    });

    it("filters by status", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.getExpectedTransactions({
        status: "missed",
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("getSuggestions", () => {
    it("returns pattern suggestions from transactions", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      // Create 3 monthly transactions
      const monthlyTransactions = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
          date: "2024-01-15",
          description: "Body Corp",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
        },
        {
          id: "tx-2",
          userId: "user-1",
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
          date: "2024-02-15",
          description: "Body Corp",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
        },
        {
          id: "tx-3",
          userId: "user-1",
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
          date: "2024-03-15",
          description: "Body Corp",
          amount: "-500.00",
          category: "body_corporate",
          transactionType: "expense",
        },
      ];

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: {
            findMany: vi.fn().mockResolvedValue(monthlyTransactions),
          },
          recurringTransactions: {
            findMany: vi.fn().mockResolvedValue([]), // No existing templates
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.getSuggestions();

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].frequency).toBe("monthly");
    });
  });
});
