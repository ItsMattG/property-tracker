import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../../__tests__/test-utils";

describe("cgt router", () => {
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
    postcode: "2000",
    purchasePrice: "850000",
    purchaseDate: "2022-06-15",
    entityName: "Personal",
    status: "active",
    soldAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCostBase", () => {
    it("returns cost base with capital transactions", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const mockTransactions = [
        { id: "tx-1", propertyId: "550e8400-e29b-41d4-a716-446655440000", category: "stamp_duty", amount: "-35200", description: "Stamp duty" },
        { id: "tx-2", propertyId: "550e8400-e29b-41d4-a716-446655440000", category: "conveyancing", amount: "-1800", description: "Conveyancing" },
        { id: "tx-3", propertyId: "550e8400-e29b-41d4-a716-446655440000", category: "rental_income", amount: "2400", description: "Rent" },
      ];

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.cgt.getCostBase({ propertyId: "550e8400-e29b-41d4-a716-446655440000" });

      expect(result.purchasePrice).toBe(850000);
      expect(result.totalAcquisitionCosts).toBe(37000);
      expect(result.totalCostBase).toBe(887000);
      expect(result.acquisitionCosts).toHaveLength(2);
    });

    it("throws NOT_FOUND for non-existent property", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.cgt.getCostBase({ propertyId: "550e8400-e29b-41d4-a716-446655440000" })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("recordSale", () => {
    it("creates sale record and archives property", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const mockTransactions = [
        { id: "tx-1", propertyId: "550e8400-e29b-41d4-a716-446655440000", category: "stamp_duty", amount: "-35200" },
      ];

      const mockSale = {
        id: "sale-1",
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        salePrice: "1100000",
        costBase: "885200",
        capitalGain: "200000",
        discountedGain: "100000",
        heldOverTwelveMonths: true,
      };

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSale]),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
        insert: insertMock,
        update: updateMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.cgt.recordSale({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        salePrice: "1100000",
        settlementDate: "2025-06-15",
        agentCommission: "22000",
        legalFees: "1500",
      });

      expect(result.sale).toBeDefined();
      expect(insertMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });

    it("rejects sale for already sold property", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      const soldProperty = { ...mockProperty, status: "sold" };

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(soldProperty) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.cgt.recordSale({
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
          salePrice: "1100000",
          settlementDate: "2025-06-15",
        })
      ).rejects.toThrow("Property is already sold");
    });
  });
});
