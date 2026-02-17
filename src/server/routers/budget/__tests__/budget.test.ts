import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

// Shared reference for the mock UoW instance to be returned by the UnitOfWork constructor
let currentMockUow: UnitOfWork;

// Mock UnitOfWork so protectedProcedure doesn't overwrite our mock UoW
vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

/**
 * Create an authenticated mock context with UoW.
 * Sets up ctx.db.query.users.findFirst so the protectedProcedure
 * middleware resolves the user before reaching the router handler.
 * Also configures the mocked UnitOfWork constructor to return our uow.
 */
function createAuthCtxWithUow(uow: UnitOfWork) {
  currentMockUow = uow;
  const ctx = createMockContext({
    userId: mockUser.id,
    user: mockUser,
    uow,
  });
  ctx.db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(mockUser),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return ctx;
}

describe("budget router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Auth Tests ---
  describe("authentication", () => {
    it("budget.list throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ userId: null });
      const caller = createTestCaller(ctx);

      await expect(
        caller.budget.list({ month: new Date(2026, 1, 1) })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.budget.list({ month: new Date(2026, 1, 1) })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("budget.create throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ userId: null });
      const caller = createTestCaller(ctx);

      await expect(
        caller.budget.create({
          personalCategoryId: null,
          monthlyAmount: "500.00",
          effectiveFrom: new Date(2026, 1, 1),
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.budget.create({
          personalCategoryId: null,
          monthlyAmount: "500.00",
          effectiveFrom: new Date(2026, 1, 1),
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  // --- Category CRUD ---
  describe("categoryList", () => {
    it("returns categories from UoW", async () => {
      const mockCategories = [
        {
          id: "cat-1",
          userId: "user-1",
          name: "Groceries",
          group: "needs",
          icon: "shopping-cart",
          sortOrder: 0,
          createdAt: new Date(),
        },
        {
          id: "cat-2",
          userId: "user-1",
          name: "Entertainment",
          group: "wants",
          icon: "film",
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];
      const uow = createMockUow({
        personalCategories: {
          findByUser: vi.fn().mockResolvedValue(mockCategories),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.categoryList();

      expect(result).toEqual(mockCategories);
    });
  });

  describe("categoryCreate", () => {
    it("creates and returns a category", async () => {
      const newCategory = {
        id: "cat-new",
        userId: "user-1",
        name: "Subscriptions",
        group: "wants" as const,
        icon: "credit-card",
        sortOrder: 5,
        createdAt: new Date(),
      };
      const uow = createMockUow({
        personalCategories: {
          create: vi.fn().mockResolvedValue(newCategory),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.categoryCreate({
        name: "Subscriptions",
        group: "wants",
        icon: "credit-card",
      });

      expect(result).toEqual(newCategory);
      expect(uow.personalCategories.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "Subscriptions",
        group: "wants",
        icon: "credit-card",
      });
    });
  });

  // --- Budget CRUD ---
  describe("list", () => {
    it("returns budgets with spend for a month", async () => {
      const mockBudgets = [
        {
          id: "b1",
          userId: "user-1",
          personalCategoryId: "cat-1",
          monthlyAmount: "500.00",
          effectiveFrom: new Date(2026, 0, 1),
          createdAt: new Date(),
          updatedAt: new Date(),
          spent: 200,
          categoryName: "Groceries",
          categoryIcon: "shopping-cart",
          categoryGroup: "needs",
        },
      ];
      const uow = createMockUow({
        budgets: {
          findByUser: vi.fn().mockResolvedValue(mockBudgets),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.list({
        month: new Date(2026, 1, 1),
      });

      expect(result).toEqual(mockBudgets);
      expect(uow.budgets.findByUser).toHaveBeenCalledWith(
        "user-1",
        new Date(2026, 1, 1)
      );
    });
  });

  describe("create", () => {
    it("creates a budget", async () => {
      const newBudget = {
        id: "b-new",
        userId: "user-1",
        personalCategoryId: "cat-1",
        monthlyAmount: "300.00",
        effectiveFrom: new Date(2026, 1, 1),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const uow = createMockUow({
        budgets: {
          create: vi.fn().mockResolvedValue(newBudget),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.create({
        personalCategoryId: "550e8400-e29b-41d4-a716-446655440000",
        monthlyAmount: "300.00",
        effectiveFrom: new Date(2026, 1, 1),
      });

      expect(result).toEqual(newBudget);
      expect(uow.budgets.create).toHaveBeenCalledWith({
        userId: "user-1",
        personalCategoryId: "550e8400-e29b-41d4-a716-446655440000",
        monthlyAmount: "300.00",
        effectiveFrom: new Date(2026, 1, 1),
      });
    });
  });

  describe("update", () => {
    it("changes amount and returns updated budget", async () => {
      const updatedBudget = {
        id: "b-1",
        userId: "user-1",
        personalCategoryId: "cat-1",
        monthlyAmount: "600.00",
        effectiveFrom: new Date(2026, 0, 1),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const uow = createMockUow({
        budgets: {
          update: vi.fn().mockResolvedValue(updatedBudget),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        monthlyAmount: "600.00",
      });

      expect(result).toEqual(updatedBudget);
      expect(uow.budgets.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        { monthlyAmount: "600.00" }
      );
    });

    it("throws NOT_FOUND when budget does not exist", async () => {
      const uow = createMockUow({
        budgets: {
          update: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.budget.update({
          id: "550e8400-e29b-41d4-a716-446655440000",
          monthlyAmount: "600.00",
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.budget.update({
          id: "550e8400-e29b-41d4-a716-446655440000",
          monthlyAmount: "600.00",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("delete", () => {
    it("removes a budget", async () => {
      const uow = createMockUow({
        budgets: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.budget.delete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(uow.budgets.delete).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1"
      );
    });
  });

  // --- Transaction CRUD ---
  describe("transactionList", () => {
    it("returns filtered transactions", async () => {
      const mockResult = {
        transactions: [
          {
            id: "tx-1",
            userId: "user-1",
            date: new Date(2026, 1, 10),
            description: "Woolworths",
            amount: "-85.50",
            personalCategoryId: "cat-1",
            notes: null,
            source: "manual",
            basiqTransactionId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            categoryName: "Groceries",
            categoryIcon: "shopping-cart",
          },
        ],
        total: 1,
      };
      const uow = createMockUow({
        personalTransactions: {
          findByUser: vi.fn().mockResolvedValue(mockResult),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.transactionList({
        categoryId: "550e8400-e29b-41d4-a716-446655440000",
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual(mockResult);
      expect(uow.personalTransactions.findByUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          categoryId: "550e8400-e29b-41d4-a716-446655440000",
          limit: 20,
          offset: 0,
        })
      );
    });
  });

  describe("transactionCreate", () => {
    it("creates a manual transaction", async () => {
      const newTx = {
        id: "tx-new",
        userId: "user-1",
        date: new Date(2026, 1, 15),
        description: "Coffee",
        amount: "-4.50",
        personalCategoryId: "cat-2",
        notes: "Morning latte",
        source: "manual",
        basiqTransactionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const uow = createMockUow({
        personalTransactions: {
          create: vi.fn().mockResolvedValue(newTx),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.transactionCreate({
        date: new Date(2026, 1, 15),
        description: "Coffee",
        amount: "-4.50",
        personalCategoryId: "550e8400-e29b-41d4-a716-446655440000",
        notes: "Morning latte",
      });

      expect(result).toEqual(newTx);
      expect(uow.personalTransactions.create).toHaveBeenCalledWith({
        userId: "user-1",
        date: new Date(2026, 1, 15),
        description: "Coffee",
        amount: "-4.50",
        personalCategoryId: "550e8400-e29b-41d4-a716-446655440000",
        notes: "Morning latte",
      });
    });
  });

  describe("transactionDelete", () => {
    it("removes a transaction", async () => {
      const uow = createMockUow({
        personalTransactions: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.budget.transactionDelete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(uow.personalTransactions.delete).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1"
      );
    });
  });

  // --- Setup ---
  describe("setup", () => {
    it("seeds categories and creates overall budget", async () => {
      const seededCategories = [
        {
          id: "cat-1",
          userId: "user-1",
          name: "Groceries",
          group: "needs",
          icon: "shopping-cart",
          sortOrder: 0,
          createdAt: new Date(),
        },
        {
          id: "cat-2",
          userId: "user-1",
          name: "Entertainment",
          group: "wants",
          icon: "film",
          sortOrder: 1,
          createdAt: new Date(),
        },
      ];
      const budgetCreateMock = vi.fn().mockResolvedValue({
        id: "b-new",
        userId: "user-1",
        personalCategoryId: null,
        monthlyAmount: "5000.00",
        effectiveFrom: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const uow = createMockUow({
        personalCategories: {
          seedDefaults: vi.fn().mockResolvedValue(seededCategories),
        },
        budgets: {
          create: budgetCreateMock,
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.setup({
        monthlyTarget: "5000.00",
        categoryBudgets: [
          {
            categoryName: "Groceries",
            group: "needs",
            monthlyAmount: "800.00",
          },
          {
            categoryName: "Entertainment",
            group: "wants",
            monthlyAmount: "200.00",
          },
        ],
      });

      expect(result.categories).toEqual(seededCategories);
      expect(uow.personalCategories.seedDefaults).toHaveBeenCalledWith(
        "user-1"
      );
      // Overall budget + 2 category budgets = 3 calls
      expect(budgetCreateMock).toHaveBeenCalledTimes(3);
      // First call is the overall budget (null category)
      expect(budgetCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          personalCategoryId: null,
          monthlyAmount: "5000.00",
        })
      );
      // Category budgets
      expect(budgetCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          personalCategoryId: "cat-1",
          monthlyAmount: "800.00",
        })
      );
      expect(budgetCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          personalCategoryId: "cat-2",
          monthlyAmount: "200.00",
        })
      );
    });
  });

  // --- Monthly Summary ---
  describe("monthlySummary", () => {
    it("returns spending trend data", async () => {
      const mockSummary = [
        { month: "2026-01", income: 5000, expenses: 3500 },
        { month: "2025-12", income: 5200, expenses: 3800 },
        { month: "2025-11", income: 4800, expenses: 3200 },
      ];
      const uow = createMockUow({
        personalTransactions: {
          getMonthlySummary: vi.fn().mockResolvedValue(mockSummary),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.monthlySummary({ months: 3 });

      expect(result).toEqual(mockSummary);
      expect(uow.personalTransactions.getMonthlySummary).toHaveBeenCalledWith(
        "user-1",
        3
      );
    });
  });

  // --- Surplus ---
  describe("surplus", () => {
    it("returns income minus expenses calculation", async () => {
      const mockSummary = [
        { month: "2026-01", income: 5000, expenses: 3500 },
        { month: "2025-12", income: 5200, expenses: 3800 },
        { month: "2025-11", income: 4800, expenses: 3200 },
      ];
      const uow = createMockUow({
        budgets: {
          getAverageMonthlyExpenses: vi.fn().mockResolvedValue(3500),
        },
        personalTransactions: {
          getMonthlySummary: vi.fn().mockResolvedValue(mockSummary),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.surplus();

      // Average income = (5000 + 5200 + 4800) / 3 = 5000
      expect(result.avgMonthlyIncome).toBe(5000);
      expect(result.avgMonthlyExpenses).toBe(3500);
      expect(result.monthlySurplus).toBe(1500);
      expect(result.annualSavingsCapacity).toBe(18000);
    });

    it("handles empty summary gracefully", async () => {
      const uow = createMockUow({
        budgets: {
          getAverageMonthlyExpenses: vi.fn().mockResolvedValue(0),
        },
        personalTransactions: {
          getMonthlySummary: vi.fn().mockResolvedValue([]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.budget.surplus();

      expect(result.avgMonthlyIncome).toBe(0);
      expect(result.avgMonthlyExpenses).toBe(0);
      expect(result.monthlySurplus).toBe(0);
      expect(result.annualSavingsCapacity).toBe(0);
    });
  });
});
