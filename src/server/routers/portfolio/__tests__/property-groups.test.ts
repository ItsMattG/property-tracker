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

const mockGroup = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  userId: "user-1",
  name: "Sydney Properties",
  colour: "#3B82F6",
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const mockGroupWithCount = {
  ...mockGroup,
  propertyCount: 3,
};

describe("propertyGroup router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("calls findByOwner with correct ownerId", async () => {
      const findByOwner = vi.fn().mockResolvedValue([mockGroupWithCount]);
      const uow = createMockUow({
        propertyGroup: { findByOwner },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.list();

      expect(findByOwner).toHaveBeenCalledWith("user-1");
      expect(result).toEqual([mockGroupWithCount]);
    });

    it("returns empty array when no groups exist", async () => {
      const uow = createMockUow({
        propertyGroup: { findByOwner: vi.fn().mockResolvedValue([]) },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.list();

      expect(result).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns group with propertyIds", async () => {
      const uow = createMockUow({
        propertyGroup: {
          findById: vi.fn().mockResolvedValue(mockGroup),
          getPropertyIds: vi.fn().mockResolvedValue(["prop-1", "prop-2"]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.get({ id: mockGroup.id });

      expect(result).toEqual({ ...mockGroup, propertyIds: ["prop-1", "prop-2"] });
      expect(uow.propertyGroup.findById).toHaveBeenCalledWith(mockGroup.id, "user-1");
      expect(uow.propertyGroup.getPropertyIds).toHaveBeenCalledWith(mockGroup.id);
    });

    it("throws NOT_FOUND when group does not exist", async () => {
      const uow = createMockUow({
        propertyGroup: {
          findById: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.get({ id: "550e8400-e29b-41d4-a716-446655440001" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.propertyGroup.get({ id: "550e8400-e29b-41d4-a716-446655440001" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("create", () => {
    it("succeeds when under plan limit", async () => {
      const created = { ...mockGroup, name: "New Group" };
      const uow = createMockUow({
        propertyGroup: {
          countByOwner: vi.fn().mockResolvedValue(1),
          create: vi.fn().mockResolvedValue(created),
        },
        user: {
          findById: vi.fn().mockResolvedValue({ ...mockUser, trialEndsAt: null }),
          findSubscriptionFull: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.create({
        name: "New Group",
        colour: "#22C55E",
      });

      expect(result).toEqual(created);
      expect(uow.propertyGroup.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "New Group",
        colour: "#22C55E",
      });
    });

    it("rejects when plan limit reached (free plan, 3 groups)", async () => {
      const uow = createMockUow({
        propertyGroup: {
          countByOwner: vi.fn().mockResolvedValue(3),
        },
        user: {
          findById: vi.fn().mockResolvedValue({ ...mockUser, trialEndsAt: null }),
          findSubscriptionFull: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.create({ name: "Over Limit", colour: "#EF4444" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.propertyGroup.create({ name: "Over Limit", colour: "#EF4444" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("property groups"),
      });
    });

    it("allows unlimited groups for pro plan", async () => {
      const created = { ...mockGroup, name: "Pro Group" };
      const uow = createMockUow({
        propertyGroup: {
          create: vi.fn().mockResolvedValue(created),
        },
        user: {
          findById: vi.fn().mockResolvedValue({ ...mockUser, trialEndsAt: null }),
          findSubscriptionFull: vi.fn().mockResolvedValue({
            plan: "pro",
            status: "active",
            currentPeriodEnd: new Date("2027-01-01"),
          }),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.create({
        name: "Pro Group",
        colour: "#8B5CF6",
      });

      expect(result).toEqual(created);
      // countByOwner should NOT be called for pro plan (limit is Infinity)
      expect(uow.propertyGroup.countByOwner).not.toHaveBeenCalled();
    });

    it("uses trial plan when user is on trial", async () => {
      const created = { ...mockGroup, name: "Trial Group" };
      const uow = createMockUow({
        propertyGroup: {
          create: vi.fn().mockResolvedValue(created),
        },
        user: {
          findById: vi.fn().mockResolvedValue({
            ...mockUser,
            trialEndsAt: new Date("2027-01-01"),
            trialPlan: "pro",
          }),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.create({
        name: "Trial Group",
        colour: "#F97316",
      });

      expect(result).toEqual(created);
      // Should not call findSubscriptionFull when on trial
      expect(uow.user.findSubscriptionFull).not.toHaveBeenCalled();
    });

    it("rejects invalid colour format", async () => {
      const uow = createMockUow();
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.create({ name: "Bad Colour", colour: "red" })
      ).rejects.toThrow();
    });

    it("rejects empty name", async () => {
      const uow = createMockUow();
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.create({ name: "", colour: "#3B82F6" })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates group and returns result", async () => {
      const updated = { ...mockGroup, name: "Renamed" };
      const uow = createMockUow({
        propertyGroup: {
          update: vi.fn().mockResolvedValue(updated),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.update({
        id: mockGroup.id,
        name: "Renamed",
      });

      expect(result).toEqual(updated);
      expect(uow.propertyGroup.update).toHaveBeenCalledWith(
        mockGroup.id,
        "user-1",
        { name: "Renamed" }
      );
    });

    it("throws NOT_FOUND when group does not exist", async () => {
      const uow = createMockUow({
        propertyGroup: {
          update: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.update({
          id: "550e8400-e29b-41d4-a716-446655440099",
          name: "Nonexistent",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("delete", () => {
    it("deletes group successfully", async () => {
      const uow = createMockUow({
        propertyGroup: {
          findById: vi.fn().mockResolvedValue(mockGroup),
          delete: vi.fn().mockResolvedValue(undefined),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.delete({ id: mockGroup.id });

      expect(result).toEqual({ success: true });
      expect(uow.propertyGroup.delete).toHaveBeenCalledWith(mockGroup.id, "user-1");
    });

    it("throws NOT_FOUND when group does not exist", async () => {
      const uow = createMockUow({
        propertyGroup: {
          findById: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.delete({ id: "550e8400-e29b-41d4-a716-446655440099" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("assignProperties", () => {
    it("verifies group ownership before assigning", async () => {
      const findById = vi.fn().mockResolvedValue(mockGroup);
      const assignProperties = vi.fn().mockResolvedValue(undefined);
      const uow = createMockUow({
        propertyGroup: { findById, assignProperties },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.assignProperties({
        groupId: mockGroup.id,
        propertyIds: ["550e8400-e29b-41d4-a716-446655440010", "550e8400-e29b-41d4-a716-446655440011"],
      });

      expect(result).toEqual({ success: true });
      expect(findById).toHaveBeenCalledWith(mockGroup.id, "user-1");
      expect(assignProperties).toHaveBeenCalledWith(mockGroup.id, [
        "550e8400-e29b-41d4-a716-446655440010",
        "550e8400-e29b-41d4-a716-446655440011",
      ]);
    });

    it("throws NOT_FOUND when group does not belong to user", async () => {
      const uow = createMockUow({
        propertyGroup: {
          findById: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.assignProperties({
          groupId: "550e8400-e29b-41d4-a716-446655440099",
          propertyIds: ["550e8400-e29b-41d4-a716-446655440010"],
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("unassignProperties", () => {
    it("verifies group ownership before unassigning", async () => {
      const findById = vi.fn().mockResolvedValue(mockGroup);
      const unassignProperties = vi.fn().mockResolvedValue(undefined);
      const uow = createMockUow({
        propertyGroup: { findById, unassignProperties },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.unassignProperties({
        groupId: mockGroup.id,
        propertyIds: ["550e8400-e29b-41d4-a716-446655440010"],
      });

      expect(result).toEqual({ success: true });
      expect(findById).toHaveBeenCalledWith(mockGroup.id, "user-1");
      expect(unassignProperties).toHaveBeenCalledWith(mockGroup.id, [
        "550e8400-e29b-41d4-a716-446655440010",
      ]);
    });

    it("throws NOT_FOUND when group does not belong to user", async () => {
      const uow = createMockUow({
        propertyGroup: {
          findById: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.propertyGroup.unassignProperties({
          groupId: "550e8400-e29b-41d4-a716-446655440099",
          propertyIds: ["550e8400-e29b-41d4-a716-446655440010"],
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("forProperty", () => {
    it("returns groups for a property", async () => {
      const groups = [mockGroup];
      const uow = createMockUow({
        propertyGroup: {
          findByProperty: vi.fn().mockResolvedValue(groups),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.forProperty({
        propertyId: "550e8400-e29b-41d4-a716-446655440010",
      });

      expect(result).toEqual(groups);
      expect(uow.propertyGroup.findByProperty).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440010",
        "user-1"
      );
    });
  });

  describe("colours", () => {
    it("returns the preset colour palette", async () => {
      const uow = createMockUow();
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.propertyGroup.colours();

      expect(result).toEqual([
        "#3B82F6", "#22C55E", "#8B5CF6", "#F97316",
        "#EC4899", "#14B8A6", "#EF4444", "#EAB308",
      ]);
      expect(result).toHaveLength(8);
    });
  });

  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ userId: null });
      const caller = createTestCaller(ctx);

      await expect(caller.propertyGroup.list()).rejects.toThrow(TRPCError);
      await expect(caller.propertyGroup.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
