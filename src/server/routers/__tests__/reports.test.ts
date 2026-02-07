import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

// Mock the reports service functions that use direct db imports
vi.mock("../../services/reports", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../services/reports")>();
  return {
    ...original,
    getFinancialYearTransactions: vi.fn(),
    getPropertiesWithLoans: vi.fn(),
  };
});

import {
  getFinancialYearTransactions,
  getPropertiesWithLoans,
} from "../../services/reports";

describe("reports router", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAvailableYears", () => {
    it("returns empty array when no transactions", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ minDate: null, maxDate: null }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.reports.getAvailableYears();

      expect(result).toEqual([]);
    });

    it("returns financial years when transactions exist", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ minDate: "2025-01-15", maxDate: "2025-08-15" }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.reports.getAvailableYears();

      // January 2025 is FY 2024-25, August 2025 is FY 2025-26
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ year: 2026, label: "FY 2025-26" });
      expect(result[1]).toEqual({ year: 2025, label: "FY 2024-25" });
    });
  });

  describe("taxReport", () => {
    it("returns report structure with properties and totals", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const mockProperties = [
        {
          id: "prop-1",
          userId: "user-1",
          address: "123 Main St",
          suburb: "Sydney",
          state: "NSW",
          entityName: "Personal",
        },
      ];

      const mockTransactions = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: "prop-1",
          date: "2025-08-15",
          description: "Rent",
          amount: "2400.00",
          category: "rental_income",
          transactionType: "income",
          property: mockProperties[0],
        },
      ];

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: {
            findMany: vi.fn().mockResolvedValue(mockProperties),
            findFirst: vi.fn().mockResolvedValue(mockProperties[0]),
          },
        },
      };

      // Mock the service function
      vi.mocked(getFinancialYearTransactions).mockResolvedValue(mockTransactions as any);

      const caller = createTestCaller(ctx);
      const result = await caller.reports.taxReport({ year: 2026 });

      expect(result.financialYear).toBe("FY 2025-26");
      expect(result.properties).toHaveLength(1);
      expect(result.properties[0].property.address).toBe("123 Main St");
      expect(result.totals.totalIncome).toBe(2400);
    });

    it("filters by propertyId when provided", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });
      const propertyId = "550e8400-e29b-41d4-a716-446655440000";

      const mockProperty = {
        id: propertyId,
        userId: "user-1",
        address: "123 Main St",
        suburb: "Sydney",
        state: "NSW",
        entityName: "Personal",
      };

      const findManyMock = vi.fn().mockResolvedValue([mockProperty]);
      const findFirstMock = vi.fn().mockResolvedValue(mockProperty);

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: {
            findMany: findManyMock,
            findFirst: findFirstMock,
          },
        },
      };

      // Mock the service function
      vi.mocked(getFinancialYearTransactions).mockResolvedValue([]);

      const caller = createTestCaller(ctx);
      await caller.reports.taxReport({ year: 2026, propertyId });

      // Verify property ownership was checked
      expect(findFirstMock).toHaveBeenCalled();
      // Verify service was called with propertyId
      expect(getFinancialYearTransactions).toHaveBeenCalledWith("user-1", 2026, propertyId);
    });
  });

  describe("portfolioSummary", () => {
    it("returns portfolio data with properties and monthly breakdown", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const mockProperties = [
        {
          id: "prop-1",
          userId: "user-1",
          address: "123 Main St",
          purchasePrice: "500000.00",
          loans: [{ currentBalance: "400000.00" }],
        },
      ];

      const mockTransactions = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: "prop-1",
          date: "2025-08-15",
          description: "Rent",
          amount: "2400.00",
          category: "rental_income",
          transactionType: "income",
          property: mockProperties[0],
        },
      ];

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      // Mock the service function
      vi.mocked(getPropertiesWithLoans).mockResolvedValue(mockProperties as any);

      const caller = createTestCaller(ctx);
      const result = await caller.reports.portfolioSummary({ period: "monthly", months: 12 });

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0].address).toBe("123 Main St");
      expect(result.properties[0].purchasePrice).toBe(500000);
      expect(result.properties[0].loanBalance).toBe(400000);
      expect(result.totals.propertyCount).toBe(1);
      expect(result.period).toBe("monthly");
    });
  });
});
