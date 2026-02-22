import { describe, it, expect, vi, beforeEach } from "vitest";
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
function createAuthCtxWithUow(
  uow: UnitOfWork,
  dbOverrides: Record<string, unknown> = {}
) {
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
    ...dbOverrides,
  } as any;
  return ctx;
}

describe("rentReview router", () => {
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
    purpose: "investment",
    soldAt: null,
    locked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRentReview = {
    id: "660e8400-e29b-41d4-a716-446655440001",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    marketRentWeekly: "600.00",
    dataSource: "manual",
    lastReviewedAt: new Date("2026-01-01"),
    nextReviewDate: "2027-01-01",
    notes: "Based on comparable rentals",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getForProperty", () => {
    it("returns rent review with gap calculation when market rent is set", async () => {
      const uow = createMockUow({
        rentReview: {
          findByPropertyId: vi.fn().mockResolvedValue(mockRentReview),
        },
      });

      // Annual rent = $26,000 (i.e. $500/week * 52)
      // Market rent = $600/week
      // Gap = (600 - 500) / 500 * 100 = 20%
      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: "26000.00" }]),
          }),
        }),
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.getForProperty({
        propertyId: mockProperty.id,
      });

      expect(result.status).toBe("below_market_warning");
      expect(result.currentRentWeekly).toBe(500);
      expect(result.marketRentWeekly).toBe(600);
      expect(result.gapPercent).toBe(20);
      expect(result.annualUplift).toBe(5200);
      expect(result.review).not.toBeNull();
      expect(result.noticeRules).toEqual({
        noticeDays: 60,
        maxFrequency: "12 months",
        fixedTermRule: "Only at end of fixed term",
      });
    });

    it("returns null review when no market rent set (status no_review)", async () => {
      const uow = createMockUow({
        rentReview: {
          findByPropertyId: vi.fn().mockResolvedValue(null),
        },
      });

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.getForProperty({
        propertyId: mockProperty.id,
      });

      expect(result.status).toBe("no_review");
      expect(result.currentRentWeekly).toBeNull();
      expect(result.marketRentWeekly).toBeNull();
      expect(result.gapPercent).toBeNull();
      expect(result.annualUplift).toBeNull();
      expect(result.review).toBeNull();
      expect(result.noticeRules).toBeDefined();
    });

    it("throws NOT_FOUND when property does not exist", async () => {
      const uow = createMockUow();

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      });

      const caller = createTestCaller(ctx);
      await expect(
        caller.rentReview.getForProperty({
          propertyId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("setMarketRent", () => {
    it("creates new rent review row", async () => {
      const uow = createMockUow({
        rentReview: {
          upsert: vi.fn().mockResolvedValue(mockRentReview),
        },
      });

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.setMarketRent({
        propertyId: mockProperty.id,
        marketRentWeekly: 600,
        notes: "Based on comparable rentals",
      });

      expect(result).toEqual(mockRentReview);
      expect(uow.rentReview.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: mockProperty.id,
          userId: "user-1",
          marketRentWeekly: "600",
          dataSource: "manual",
          notes: "Based on comparable rentals",
        })
      );
    });

    it("updates existing rent review row", async () => {
      const updatedReview = {
        ...mockRentReview,
        marketRentWeekly: "700.00",
        notes: "Updated after agent feedback",
      };

      const uow = createMockUow({
        rentReview: {
          upsert: vi.fn().mockResolvedValue(updatedReview),
        },
      });

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.setMarketRent({
        propertyId: mockProperty.id,
        marketRentWeekly: 700,
        notes: "Updated after agent feedback",
      });

      expect(result.marketRentWeekly).toBe("700.00");
      expect(uow.rentReview.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          marketRentWeekly: "700",
        })
      );
    });

    it("throws NOT_FOUND when property does not exist", async () => {
      const uow = createMockUow();

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      });

      const caller = createTestCaller(ctx);
      await expect(
        caller.rentReview.setMarketRent({
          propertyId: "00000000-0000-0000-0000-000000000000",
          marketRentWeekly: 600,
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("getPortfolioSummary", () => {
    it("returns properties sorted by gap descending", async () => {
      const property2 = {
        ...mockProperty,
        id: "550e8400-e29b-41d4-a716-446655440001",
        address: "456 Other St",
        suburb: "Melbourne",
        state: "VIC",
      };

      const review2 = {
        ...mockRentReview,
        id: "660e8400-e29b-41d4-a716-446655440002",
        propertyId: property2.id,
        marketRentWeekly: "800.00",
      };

      const uow = createMockUow({
        rentReview: {
          findAllByUser: vi.fn().mockResolvedValue([mockRentReview, review2]),
        },
      });

      // property1: annual rent $26,000 ($500/wk), market $600/wk -> gap 20%
      // property2: annual rent $26,000 ($500/wk), market $800/wk -> gap 60%
      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: {
            findMany: vi.fn().mockResolvedValue([mockProperty, property2]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { propertyId: mockProperty.id, total: "26000.00" },
                { propertyId: property2.id, total: "26000.00" },
              ]),
            }),
          }),
        }),
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.getPortfolioSummary();

      expect(result.properties).toHaveLength(2);
      // Sorted by gap descending: property2 (60%) first, then property1 (20%)
      expect(result.properties[0].propertyId).toBe(property2.id);
      expect(result.properties[0].gapPercent).toBe(60);
      expect(result.properties[1].propertyId).toBe(mockProperty.id);
      expect(result.properties[1].gapPercent).toBe(20);
      expect(result.summary.reviewedCount).toBe(2);
      expect(result.summary.totalCount).toBe(2);
      expect(result.summary.totalAnnualUplift).toBeGreaterThan(0);
    });

    it("returns empty when user has no properties", async () => {
      const uow = createMockUow({
        rentReview: {
          findAllByUser: vi.fn().mockResolvedValue([]),
        },
      });

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue([]) },
        },
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.getPortfolioSummary();

      expect(result.properties).toHaveLength(0);
      expect(result.summary.totalAnnualUplift).toBe(0);
      expect(result.summary.reviewedCount).toBe(0);
      expect(result.summary.totalCount).toBe(0);
    });

    it("places no_review properties at end of sorted list", async () => {
      const property2 = {
        ...mockProperty,
        id: "550e8400-e29b-41d4-a716-446655440001",
        address: "456 Other St",
        suburb: "Melbourne",
        state: "VIC",
      };

      // Only one review exists (for property1), property2 has no review
      const uow = createMockUow({
        rentReview: {
          findAllByUser: vi.fn().mockResolvedValue([mockRentReview]),
        },
      });

      const ctx = createAuthCtxWithUow(uow, {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: {
            findMany: vi.fn().mockResolvedValue([property2, mockProperty]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { propertyId: mockProperty.id, total: "26000.00" },
              ]),
            }),
          }),
        }),
      });

      const caller = createTestCaller(ctx);
      const result = await caller.rentReview.getPortfolioSummary();

      expect(result.properties).toHaveLength(2);
      // no_review property should be last
      expect(result.properties[0].status).not.toBe("no_review");
      expect(result.properties[1].status).toBe("no_review");
    });
  });
});
