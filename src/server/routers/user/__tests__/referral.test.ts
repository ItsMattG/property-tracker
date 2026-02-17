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
  } as ReturnType<typeof createMockContext>["db"];
  return ctx;
}

const mockReferralCode = {
  id: "code-1",
  userId: "user-1",
  code: "REF-abc123",
  createdAt: new Date("2026-01-01"),
};

const mockReferrals = [
  {
    id: "ref-1",
    status: "qualified" as const,
    createdAt: new Date("2026-01-15"),
    qualifiedAt: new Date("2026-01-20"),
    refereeName: "Alice Smith",
    refereeEmail: "alice@example.com",
  },
  {
    id: "ref-2",
    status: "pending" as const,
    createdAt: new Date("2026-02-01"),
    qualifiedAt: null,
    refereeName: null,
    refereeEmail: "bob@example.com",
  },
];

describe("referral router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyCode", () => {
    it("returns existing referral code", async () => {
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(mockReferralCode),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getMyCode();

      expect(result.code).toBe("REF-abc123");
      expect(result.shareUrl).toContain("/r/REF-abc123");
    });

    it("creates a new code if none exists", async () => {
      const newCode = { ...mockReferralCode, code: "REF-newcode" };
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(null),
          createCode: vi.fn().mockResolvedValue(newCode),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getMyCode();

      expect(result.code).toBe("REF-newcode");
      expect(uow.referral.createCode).toHaveBeenCalledWith(
        "user-1",
        expect.stringContaining("REF-")
      );
    });
  });

  describe("getStats", () => {
    it("returns zero stats when no referral code exists", async () => {
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getStats();

      expect(result).toEqual({ invited: 0, qualified: 0, totalCredits: 0 });
    });

    it("returns correct stats when referrals exist", async () => {
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(mockReferralCode),
          findByReferrer: vi.fn().mockResolvedValue(mockReferrals),
          getCreditsTotal: vi.fn().mockResolvedValue(1),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getStats();

      expect(result.invited).toBe(2);
      expect(result.qualified).toBe(1);
      expect(result.totalCredits).toBe(1);
    });
  });

  describe("getReferralDetails", () => {
    it("returns comprehensive referral details", async () => {
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(mockReferralCode),
          findByReferrer: vi.fn().mockResolvedValue(mockReferrals),
          getCreditsTotal: vi.fn().mockResolvedValue(1),
          getPendingCount: vi.fn().mockResolvedValue(1),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getReferralDetails();

      expect(result.code).toBe("REF-abc123");
      expect(result.shareUrl).toContain("/r/REF-abc123");
      expect(result.stats.invited).toBe(2);
      expect(result.stats.qualified).toBe(1);
      expect(result.stats.pending).toBe(1);
      expect(result.stats.totalCreditsEarned).toBe(1);
      expect(result.bannerCopy.headline).toBe("Give a month, get a month");
    });

    it("returns mapped referral list with display names", async () => {
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(mockReferralCode),
          findByReferrer: vi.fn().mockResolvedValue(mockReferrals),
          getCreditsTotal: vi.fn().mockResolvedValue(1),
          getPendingCount: vi.fn().mockResolvedValue(1),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getReferralDetails();

      expect(result.referrals).toHaveLength(2);
      expect(result.referrals[0].displayName).toBe("Alice Smith");
      expect(result.referrals[0].status).toBe("qualified");
      expect(result.referrals[1].displayName).toBe("bob@example.com");
      expect(result.referrals[1].status).toBe("pending");
    });

    it("creates a code if none exists", async () => {
      const newCode = { ...mockReferralCode, code: "REF-newcode" };
      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(null),
          createCode: vi.fn().mockResolvedValue(newCode),
          findByReferrer: vi.fn().mockResolvedValue([]),
          getCreditsTotal: vi.fn().mockResolvedValue(0),
          getPendingCount: vi.fn().mockResolvedValue(0),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.getReferralDetails();

      expect(result.code).toBe("REF-newcode");
      expect(result.stats.invited).toBe(0);
      expect(uow.referral.createCode).toHaveBeenCalled();
    });

    it("uses parallel queries for performance", async () => {
      const findByReferrer = vi.fn().mockResolvedValue(mockReferrals);
      const getCreditsTotal = vi.fn().mockResolvedValue(1);
      const getPendingCount = vi.fn().mockResolvedValue(1);

      const uow = createMockUow({
        referral: {
          findCodeByUserId: vi.fn().mockResolvedValue(mockReferralCode),
          findByReferrer,
          getCreditsTotal,
          getPendingCount,
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.referral.getReferralDetails();

      // All three queries should have been called
      expect(findByReferrer).toHaveBeenCalledWith("user-1");
      expect(getCreditsTotal).toHaveBeenCalledWith("user-1");
      expect(getPendingCount).toHaveBeenCalledWith("user-1");
    });
  });

  describe("resolveCode", () => {
    it("returns valid for existing code of another user", async () => {
      const otherUserCode = { ...mockReferralCode, userId: "user-other" };
      const uow = createMockUow({
        referral: {
          resolveCode: vi.fn().mockResolvedValue(otherUserCode),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.resolveCode({ code: "REF-abc123" });

      expect(result.valid).toBe(true);
    });

    it("throws NOT_FOUND for invalid code", async () => {
      const uow = createMockUow({
        referral: {
          resolveCode: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.referral.resolveCode({ code: "INVALID" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.referral.resolveCode({ code: "INVALID" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws BAD_REQUEST for self-referral", async () => {
      const uow = createMockUow({
        referral: {
          resolveCode: vi.fn().mockResolvedValue(mockReferralCode),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.referral.resolveCode({ code: "REF-abc123" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.referral.resolveCode({ code: "REF-abc123" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("recordReferral", () => {
    it("records a new referral", async () => {
      const otherUserCode = { ...mockReferralCode, userId: "user-other" };
      const uow = createMockUow({
        referral: {
          resolveCode: vi.fn().mockResolvedValue(otherUserCode),
          findByReferee: vi.fn().mockResolvedValue(null),
          createReferral: vi.fn().mockResolvedValue({ id: "ref-new" }),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.recordReferral({
        code: "REF-abc123",
      });

      expect(result.recorded).toBe(true);
      expect(uow.referral.createReferral).toHaveBeenCalledWith({
        referrerUserId: "user-other",
        refereeUserId: "user-1",
        referralCodeId: "code-1",
      });
    });

    it("returns false if already referred", async () => {
      const otherUserCode = { ...mockReferralCode, userId: "user-other" };
      const uow = createMockUow({
        referral: {
          resolveCode: vi.fn().mockResolvedValue(otherUserCode),
          findByReferee: vi.fn().mockResolvedValue({ id: "existing" }),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.recordReferral({
        code: "REF-abc123",
      });

      expect(result.recorded).toBe(false);
    });

    it("returns false for self-referral", async () => {
      const uow = createMockUow({
        referral: {
          resolveCode: vi.fn().mockResolvedValue(mockReferralCode),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.recordReferral({
        code: "REF-abc123",
      });

      expect(result.recorded).toBe(false);
    });
  });

  describe("qualifyReferral", () => {
    it("qualifies a pending referral and creates credits", async () => {
      const pendingReferral = {
        id: "ref-1",
        referrerUserId: "user-other",
        refereeUserId: "user-1",
        status: "pending",
      };
      const uow = createMockUow({
        referral: {
          findByReferee: vi.fn().mockResolvedValue(pendingReferral),
          qualifyReferral: vi.fn().mockResolvedValue(undefined),
          createCredits: vi.fn().mockResolvedValue(undefined),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.qualifyReferral();

      expect(result.qualified).toBe(true);
      expect(uow.referral.qualifyReferral).toHaveBeenCalledWith("ref-1");
      expect(uow.referral.createCredits).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: "user-other",
            referralId: "ref-1",
            monthsFree: 1,
          }),
          expect.objectContaining({
            userId: "user-1",
            referralId: "ref-1",
            monthsFree: 1,
          }),
        ])
      );
    });

    it("returns false when no referral exists", async () => {
      const uow = createMockUow({
        referral: {
          findByReferee: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.qualifyReferral();

      expect(result.qualified).toBe(false);
    });

    it("returns false when referral is not pending", async () => {
      const qualifiedReferral = {
        id: "ref-1",
        referrerUserId: "user-other",
        refereeUserId: "user-1",
        status: "qualified",
      };
      const uow = createMockUow({
        referral: {
          findByReferee: vi.fn().mockResolvedValue(qualifiedReferral),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.referral.qualifyReferral();

      expect(result.qualified).toBe(false);
    });
  });

  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ userId: null });
      const caller = createTestCaller(ctx);

      await expect(caller.referral.getMyCode()).rejects.toThrow(TRPCError);
      await expect(caller.referral.getMyCode()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws UNAUTHORIZED for getReferralDetails when not authenticated", async () => {
      const ctx = createMockContext({ userId: null });
      const caller = createTestCaller(ctx);

      await expect(
        caller.referral.getReferralDetails()
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.referral.getReferralDetails()
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
