import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("propertyValue router", () => {
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
    purchasePrice: "500000",
    purchaseDate: "2020-01-01",
    entityName: "Personal",
    status: "active",
    soldAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPropertyValue = {
    id: "660e8400-e29b-41d4-a716-446655440001",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    estimatedValue: "650000",
    valueDate: "2024-06-01",
    source: "manual",
    notes: "Based on recent sales",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a property value entry", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockPropertyValue]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.create({
        propertyId: mockProperty.id,
        estimatedValue: "650000",
        valueDate: "2024-06-01",
        notes: "Based on recent sales",
      });

      expect(result.estimatedValue).toBe("650000");
      expect(ctx.db.insert).toHaveBeenCalled();
    });

    it("throws error if property not found", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.propertyValue.create({
          propertyId: "00000000-0000-0000-0000-000000000000",
          estimatedValue: "650000",
          valueDate: "2024-06-01",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("list", () => {
    it("returns value history for a property", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          propertyValues: {
            findMany: vi.fn().mockResolvedValue([mockPropertyValue]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.list({
        propertyId: mockProperty.id,
      });

      expect(result).toHaveLength(1);
      expect(result[0].estimatedValue).toBe("650000");
    });

    it("throws error if property not found", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.propertyValue.list({
          propertyId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("getLatest", () => {
    it("returns most recent value for a property", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          propertyValues: {
            findMany: vi.fn().mockResolvedValue([mockPropertyValue]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.getLatest({
        propertyId: mockProperty.id,
      });

      expect(result?.estimatedValue).toBe("650000");
    });

    it("returns null if no value exists", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          propertyValues: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.getLatest({
        propertyId: mockProperty.id,
      });

      expect(result).toBeNull();
    });

    it("throws error if property not found", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.propertyValue.getLatest({
          propertyId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("delete", () => {
    it("deletes a manual property value entry", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          propertyValues: { findFirst: vi.fn().mockResolvedValue(mockPropertyValue) },
        },
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.delete({
        id: mockPropertyValue.id,
      });

      expect(result.success).toBe(true);
      expect(ctx.db.delete).toHaveBeenCalled();
    });

    it("throws error when trying to delete non-manual valuation", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });
      const automatedValuation = { ...mockPropertyValue, source: "mock" };

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          propertyValues: { findFirst: vi.fn().mockResolvedValue(automatedValuation) },
        },
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.propertyValue.delete({ id: mockPropertyValue.id })
      ).rejects.toThrow("Only manual valuations can be deleted");
    });

    it("throws error if valuation not found", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          propertyValues: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.propertyValue.delete({ id: "00000000-0000-0000-0000-000000000000" })
      ).rejects.toThrow("Valuation not found");
    });
  });
});
