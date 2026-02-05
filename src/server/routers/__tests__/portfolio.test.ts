import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("portfolio router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperties = [
    {
      id: "prop-1",
      userId: "user-1",
      address: "123 Main St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      purchasePrice: "500000",
      purchaseDate: "2020-01-01",
      entityName: "Personal",
      status: "active",
    },
    {
      id: "prop-2",
      userId: "user-1",
      address: "456 Oak Ave",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      purchasePrice: "600000",
      purchaseDate: "2021-06-01",
      entityName: "Trust",
      status: "active",
    },
  ];

  const mockPropertyValues = [
    { propertyId: "prop-1", userId: "user-1", estimatedValue: "650000", valueDate: "2024-06-01" },
    { propertyId: "prop-2", userId: "user-1", estimatedValue: "700000", valueDate: "2024-06-01" },
  ];

  const mockLoans = [
    { propertyId: "prop-1", userId: "user-1", currentBalance: "300000" },
    { propertyId: "prop-2", userId: "user-1", currentBalance: "400000" },
  ];

  const mockTransactions = [
    { propertyId: "prop-1", userId: "user-1", amount: "2400", transactionType: "income", date: "2024-12-01" },
    { propertyId: "prop-1", userId: "user-1", amount: "-500", transactionType: "expense", date: "2024-12-15" },
    { propertyId: "prop-2", userId: "user-1", amount: "2800", transactionType: "income", date: "2024-12-01" },
    { propertyId: "prop-2", userId: "user-1", amount: "-600", transactionType: "expense", date: "2024-12-20" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSummary", () => {
    it("returns aggregated portfolio totals", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        execute: vi.fn().mockResolvedValue([
          { property_id: "prop-1", estimated_value: "650000" },
          { property_id: "prop-2", estimated_value: "700000" },
        ]),
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          loans: { findMany: vi.fn().mockResolvedValue(mockLoans) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getSummary({ period: "monthly" });

      expect(result.propertyCount).toBe(2);
      expect(result.totalValue).toBe(1350000); // 650000 + 700000
      expect(result.totalDebt).toBe(700000); // 300000 + 400000
      expect(result.totalEquity).toBe(650000); // 1350000 - 700000
    });

    it("returns empty summary when no properties", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getSummary({ period: "monthly" });

      expect(result.propertyCount).toBe(0);
      expect(result.totalValue).toBe(0);
      expect(result.totalDebt).toBe(0);
      expect(result.totalEquity).toBe(0);
    });

    it("filters by state", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        execute: vi.fn().mockResolvedValue([
          { property_id: "prop-1", estimated_value: "650000" },
        ]),
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          loans: { findMany: vi.fn().mockResolvedValue([mockLoans[0]]) },
          transactions: { findMany: vi.fn().mockResolvedValue([mockTransactions[0], mockTransactions[1]]) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getSummary({
        period: "monthly",
        state: "NSW",
      });

      expect(result.propertyCount).toBe(1);
    });
  });

  describe("getPropertyMetrics", () => {
    it("returns metrics for each property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        execute: vi.fn().mockResolvedValue([
          { property_id: "prop-1", estimated_value: "650000" },
          { property_id: "prop-2", estimated_value: "700000" },
        ]),
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          loans: { findMany: vi.fn().mockResolvedValue(mockLoans) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getPropertyMetrics({
        period: "monthly",
        sortBy: "equity",
        sortOrder: "desc",
      });

      expect(result).toHaveLength(2);
      // prop-1: 650000 - 300000 = 350000 equity
      // prop-2: 700000 - 400000 = 300000 equity
      expect(result[0].propertyId).toBe("prop-1"); // Higher equity first
      expect(result[0].equity).toBe(350000);
      expect(result[1].equity).toBe(300000);
    });

    it("sorts by cash flow", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        execute: vi.fn().mockResolvedValue([
          { property_id: "prop-1", estimated_value: "650000" },
          { property_id: "prop-2", estimated_value: "700000" },
        ]),
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          loans: { findMany: vi.fn().mockResolvedValue(mockLoans) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getPropertyMetrics({
        period: "monthly",
        sortBy: "cashFlow",
        sortOrder: "desc",
      });

      // prop-1: 2400 - 500 = 1900
      // prop-2: 2800 - 600 = 2200
      expect(result[0].propertyId).toBe("prop-2"); // Higher cash flow first
    });

    it("returns empty array when no properties", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getPropertyMetrics({
        period: "monthly",
        sortBy: "alphabetical",
        sortOrder: "asc",
      });

      expect(result).toHaveLength(0);
    });
  });
});
