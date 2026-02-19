import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

// ─── Stable test UUIDs ────────────────────────────────────────────
const PROP_ID = "00000000-0000-4000-a000-000000000001";
const SCHEDULE_ID = "00000000-0000-4000-a000-000000000002";
const ASSET_ID = "00000000-0000-4000-a000-000000000003";
const CW_ID = "00000000-0000-4000-a000-000000000004";
const CLAIM_ID = "00000000-0000-4000-a000-000000000005";
const ASSET_ID_2 = "00000000-0000-4000-a000-000000000006";

// Shared reference for the mock UoW instance returned by the UnitOfWork constructor
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
  } as any;
  return ctx;
}

// Reusable mock asset
function makeMockAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    scheduleId: SCHEDULE_ID,
    assetName: "Hot Water System",
    category: "plant_equipment",
    originalCost: "5000.00",
    effectiveLife: "12.00",
    method: "diminishing_value",
    purchaseDate: "2025-07-01",
    poolType: "individual",
    openingWrittenDownValue: null,
    yearlyDeduction: "833.33",
    remainingValue: "5000.00",
    createdAt: new Date(),
    ...overrides,
  };
}

// Reusable mock schedule with assets
function makeMockSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHEDULE_ID,
    propertyId: PROP_ID,
    userId: "user-1",
    documentId: null,
    effectiveDate: "2025-07-01",
    totalValue: "10000.00",
    createdAt: new Date(),
    assets: [
      {
        ...makeMockAsset(),
        claims: [],
      },
    ],
    ...overrides,
  };
}

describe("depreciation router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── list ──────────────────────────────────────────────────────

  describe("list", () => {
    it("calls both repo methods in parallel and returns { schedules, capitalWorks }", async () => {
      const mockSchedules = [makeMockSchedule()];
      const mockCapitalWorks = [
        {
          id: CW_ID,
          propertyId: PROP_ID,
          userId: "user-1",
          description: "Building extension",
          constructionDate: "2020-01-15",
          constructionCost: "50000.00",
          claimStartDate: "2020-06-01",
          createdAt: new Date(),
        },
      ];

      const findSchedulesByProperty = vi.fn().mockResolvedValue(mockSchedules);
      const findCapitalWorksByProperty = vi.fn().mockResolvedValue(mockCapitalWorks);

      const uow = createMockUow({
        depreciation: {
          findSchedulesByProperty,
          findCapitalWorksByProperty,
        },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.list({ propertyId: PROP_ID });

      expect(result.schedules).toEqual(mockSchedules);
      expect(result.capitalWorks).toEqual(mockCapitalWorks);
      expect(findSchedulesByProperty).toHaveBeenCalledWith(PROP_ID, "user-1");
      expect(findCapitalWorksByProperty).toHaveBeenCalledWith(PROP_ID, "user-1");
    });
  });

  // ─── addAsset — poolType assignment ────────────────────────────

  describe("addAsset", () => {
    it("assigns immediate_writeoff for cost <= $300", async () => {
      const createAsset = vi.fn().mockResolvedValue(makeMockAsset({ poolType: "immediate_writeoff", originalCost: "200.00" }));

      const uow = createMockUow({
        depreciation: { createAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.depreciation.addAsset({
        scheduleId: SCHEDULE_ID,
        assetName: "Small Tool",
        category: "plant_equipment",
        originalCost: 200,
        effectiveLife: 5,
        method: "diminishing_value",
      });

      expect(createAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: "immediate_writeoff",
          originalCost: "200.00",
          yearlyDeduction: "200.00", // immediate writeoff = full cost
        })
      );
    });

    it("assigns low_value for cost $300 < cost <= $1000", async () => {
      const createAsset = vi.fn().mockResolvedValue(makeMockAsset({ poolType: "low_value", originalCost: "500.00" }));

      const uow = createMockUow({
        depreciation: { createAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.depreciation.addAsset({
        scheduleId: SCHEDULE_ID,
        assetName: "Office Chair",
        category: "plant_equipment",
        originalCost: 500,
        effectiveLife: 10,
        method: "prime_cost",
      });

      expect(createAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: "low_value",
          originalCost: "500.00",
          yearlyDeduction: "50.00", // 500 / 10
        })
      );
    });

    it("assigns individual for cost > $1000", async () => {
      const createAsset = vi.fn().mockResolvedValue(makeMockAsset());

      const uow = createMockUow({
        depreciation: { createAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.depreciation.addAsset({
        scheduleId: SCHEDULE_ID,
        assetName: "Hot Water System",
        category: "plant_equipment",
        originalCost: 5000,
        effectiveLife: 12,
        method: "diminishing_value",
      });

      expect(createAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          poolType: "individual",
          originalCost: "5000.00",
          yearlyDeduction: "833.33", // 5000 * (2/12)
        })
      );
    });

    it("assigns immediate_writeoff for cost exactly $300", async () => {
      const createAsset = vi.fn().mockResolvedValue(makeMockAsset({ poolType: "immediate_writeoff" }));

      const uow = createMockUow({
        depreciation: { createAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.depreciation.addAsset({
        scheduleId: SCHEDULE_ID,
        assetName: "Exactly 300",
        category: "plant_equipment",
        originalCost: 300,
        effectiveLife: 5,
        method: "prime_cost",
      });

      expect(createAsset).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: "immediate_writeoff" })
      );
    });

    it("assigns low_value for cost exactly $1000", async () => {
      const createAsset = vi.fn().mockResolvedValue(makeMockAsset({ poolType: "low_value" }));

      const uow = createMockUow({
        depreciation: { createAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.depreciation.addAsset({
        scheduleId: SCHEDULE_ID,
        assetName: "Exactly 1000",
        category: "plant_equipment",
        originalCost: 1000,
        effectiveLife: 10,
        method: "prime_cost",
      });

      expect(createAsset).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: "low_value" })
      );
    });
  });

  // ─── moveToPool ────────────────────────────────────────────────

  describe("moveToPool", () => {
    it("throws BAD_REQUEST when remaining value > $1000", async () => {
      const findAssetById = vi.fn().mockResolvedValue(
        makeMockAsset({ remainingValue: "1500.00" })
      );

      const uow = createMockUow({
        depreciation: { findAssetById },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.depreciation.moveToPool({ assetId: ASSET_ID })
      ).rejects.toThrow(TRPCError);

      await expect(
        caller.depreciation.moveToPool({ assetId: ASSET_ID })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("updates poolType to low_value when remaining <= $1000", async () => {
      const findAssetById = vi.fn().mockResolvedValue(
        makeMockAsset({ remainingValue: "800.00" })
      );
      const updateAsset = vi.fn().mockResolvedValue(
        makeMockAsset({ poolType: "low_value", openingWrittenDownValue: "800.00" })
      );

      const uow = createMockUow({
        depreciation: { findAssetById, updateAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.moveToPool({ assetId: ASSET_ID });

      expect(updateAsset).toHaveBeenCalledWith(
        ASSET_ID,
        "user-1",
        expect.objectContaining({
          poolType: "low_value",
          openingWrittenDownValue: "800.00",
        })
      );
      expect(result.poolType).toBe("low_value");
    });

    it("throws NOT_FOUND when asset does not exist", async () => {
      const findAssetById = vi.fn().mockResolvedValue(null);

      const uow = createMockUow({
        depreciation: { findAssetById },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.depreciation.moveToPool({ assetId: ASSET_ID })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // ─── getProjection ─────────────────────────────────────────────

  describe("getProjection", () => {
    it("converts schedule assets and capital works to projection types", async () => {
      const schedule = makeMockSchedule({
        assets: [
          {
            ...makeMockAsset({
              originalCost: "3000.00",
              effectiveLife: "10.00",
              method: "diminishing_value",
              purchaseDate: "2025-07-01",
              poolType: "individual",
            }),
            claims: [],
          },
        ],
      });

      const capitalWork = {
        id: CW_ID,
        propertyId: PROP_ID,
        userId: "user-1",
        description: "Renovation",
        constructionDate: "2020-01-15",
        constructionCost: "50000.00",
        claimStartDate: "2020-06-01",
        createdAt: new Date(),
      };

      const findSchedulesByProperty = vi.fn().mockResolvedValue([schedule]);
      const findCapitalWorksByProperty = vi.fn().mockResolvedValue([capitalWork]);

      const uow = createMockUow({
        depreciation: {
          findSchedulesByProperty,
          findCapitalWorksByProperty,
        },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.getProjection({
        propertyId: PROP_ID,
        fromFY: 2026,
        toFY: 2028,
      });

      // Should return ProjectionRow[] with 3 years
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("financialYear", 2026);
      expect(result[0]).toHaveProperty("div40Total");
      expect(result[0]).toHaveProperty("div43Total");
      expect(result[0]).toHaveProperty("lowValuePoolTotal");
      expect(result[0]).toHaveProperty("grandTotal");

      // Verify the repo was called with correct args
      expect(findSchedulesByProperty).toHaveBeenCalledWith(PROP_ID, "user-1");
      expect(findCapitalWorksByProperty).toHaveBeenCalledWith(PROP_ID, "user-1");
    });

    it("returns rows with zeros when no assets or capital works exist", async () => {
      const findSchedulesByProperty = vi.fn().mockResolvedValue([]);
      const findCapitalWorksByProperty = vi.fn().mockResolvedValue([]);

      const uow = createMockUow({
        depreciation: {
          findSchedulesByProperty,
          findCapitalWorksByProperty,
        },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.getProjection({
        propertyId: PROP_ID,
        fromFY: 2026,
        toFY: 2028,
      });

      // Should still return rows (with all zeros)
      expect(result).toHaveLength(3);
      expect(result[0].grandTotal).toBe(0);
    });
  });

  // ─── updateAsset ───────────────────────────────────────────────

  describe("updateAsset", () => {
    it("throws NOT_FOUND when asset does not exist", async () => {
      const findAssetById = vi.fn().mockResolvedValue(null);
      const updateAsset = vi.fn().mockResolvedValue(null);

      const uow = createMockUow({
        depreciation: { findAssetById, updateAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.depreciation.updateAsset({
          assetId: ASSET_ID,
          originalCost: 2000,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("recalculates poolType when cost changes", async () => {
      const existingAsset = makeMockAsset({ originalCost: "5000.00", effectiveLife: "10.00", method: "prime_cost" });
      const findAssetById = vi.fn().mockResolvedValue(existingAsset);
      const updateAsset = vi.fn().mockResolvedValue(makeMockAsset({ poolType: "low_value", originalCost: "800.00" }));

      const uow = createMockUow({
        depreciation: { findAssetById, updateAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.depreciation.updateAsset({
        assetId: ASSET_ID,
        originalCost: 800,
      });

      expect(updateAsset).toHaveBeenCalledWith(
        ASSET_ID,
        "user-1",
        expect.objectContaining({
          poolType: "low_value",
          originalCost: "800.00",
        })
      );
    });
  });

  // ─── claimFY ───────────────────────────────────────────────────

  describe("claimFY", () => {
    it("creates one claim per amount item", async () => {
      const mockClaim = {
        id: CLAIM_ID,
        scheduleId: SCHEDULE_ID,
        assetId: ASSET_ID,
        financialYear: 2026,
        amount: "500.00",
        claimedAt: new Date(),
      };
      const createClaim = vi.fn().mockResolvedValue(mockClaim);

      const uow = createMockUow({
        depreciation: { createClaim },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.claimFY({
        scheduleId: SCHEDULE_ID,
        financialYear: 2026,
        amounts: [
          { assetId: ASSET_ID, amount: 500 },
          { assetId: null, amount: 1250 },
        ],
      });

      expect(createClaim).toHaveBeenCalledTimes(2);
      expect(createClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: SCHEDULE_ID,
          financialYear: 2026,
          assetId: ASSET_ID,
          amount: "500.00",
        })
      );
      expect(createClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: null,
          amount: "1250.00",
        })
      );
      expect(result).toHaveLength(2);
    });
  });

  // ─── unclaimFY ─────────────────────────────────────────────────

  describe("unclaimFY", () => {
    it("deletes all claims for the schedule and FY", async () => {
      const deleteClaimsByFY = vi.fn().mockResolvedValue(undefined);

      const uow = createMockUow({
        depreciation: { deleteClaimsByFY },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.unclaimFY({
        scheduleId: SCHEDULE_ID,
        financialYear: 2026,
      });

      expect(deleteClaimsByFY).toHaveBeenCalledWith(SCHEDULE_ID, 2026);
      expect(result).toEqual({ success: true });
    });
  });

  // ─── deleteAsset ───────────────────────────────────────────────

  describe("deleteAsset", () => {
    it("calls repo deleteAsset with correct args", async () => {
      const deleteAsset = vi.fn().mockResolvedValue(undefined);

      const uow = createMockUow({
        depreciation: { deleteAsset },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.deleteAsset({ assetId: ASSET_ID });

      expect(deleteAsset).toHaveBeenCalledWith(ASSET_ID, "user-1");
      expect(result).toEqual({ success: true });
    });
  });

  // ─── addCapitalWorks ───────────────────────────────────────────

  describe("addCapitalWorks", () => {
    it("creates capital work with userId from portfolio", async () => {
      const mockCW = {
        id: CW_ID,
        propertyId: PROP_ID,
        userId: "user-1",
        description: "Building extension",
        constructionDate: "2020-01-15",
        constructionCost: "50000.00",
        claimStartDate: "2020-06-01",
        createdAt: new Date(),
      };
      const createCapitalWork = vi.fn().mockResolvedValue(mockCW);

      const uow = createMockUow({
        depreciation: { createCapitalWork },
      });

      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.depreciation.addCapitalWorks({
        propertyId: PROP_ID,
        description: "Building extension",
        constructionDate: "2020-01-15",
        constructionCost: 50000,
        claimStartDate: "2020-06-01",
      });

      expect(createCapitalWork).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: PROP_ID,
          userId: "user-1",
          description: "Building extension",
          constructionCost: "50000.00",
        })
      );
      expect(result.id).toBe(CW_ID);
    });
  });

  // ─── Authentication ────────────────────────────────────────────

  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ userId: null });
      const caller = createTestCaller(ctx);

      await expect(
        caller.depreciation.list({ propertyId: PROP_ID })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
