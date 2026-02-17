import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";
import type { CategorizationRule } from "@/server/db/schema/categorization-rules";

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

const mockRule: CategorizationRule = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  userId: "user-1",
  name: "Body Corp Rule",
  merchantPattern: "Body Corporate",
  descriptionPattern: null,
  matchType: "contains",
  amountMin: null,
  amountMax: null,
  targetCategory: "body_corporate",
  targetPropertyId: null,
  priority: 0,
  isActive: true,
  matchCount: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupCtx(overrides: Record<string, Record<string, unknown>> = {}) {
  const uow = createMockUow({
    categorizationRules: {
      findByUser: vi.fn().mockResolvedValue([mockRule]),
      findById: vi.fn().mockResolvedValue(mockRule),
      countByUser: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(mockRule),
      update: vi.fn().mockResolvedValue(mockRule),
      delete: vi.fn().mockResolvedValue(undefined),
      incrementMatchCount: vi.fn().mockResolvedValue(undefined),
    },
    user: {
      findSubscriptionFull: vi.fn().mockResolvedValue(null), // Free plan
    },
    transactions: {
      findRecent: vi.fn().mockResolvedValue([]),
    },
    properties: {
      findById: vi.fn().mockResolvedValue({ id: "prop-1", userId: "user-1" }),
    },
    ...overrides,
  });

  currentMockUow = uow;

  const ctx = createMockContext({ userId: mockUser.id, user: mockUser, uow });
  ctx.db = {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
    },
  } as ReturnType<typeof createMockContext>["db"];

  return { ctx, caller: createTestCaller(ctx), uow };
}

describe("categorizationRules router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns all rules for the authenticated user", async () => {
      const { caller } = setupCtx();
      const result = await caller.categorizationRules.list();
      expect(result).toEqual([mockRule]);
    });
  });

  describe("create", () => {
    it("creates a new rule", async () => {
      const { caller, uow } = setupCtx();
      const input = {
        name: "Test Rule",
        merchantPattern: "Test Merchant",
        descriptionPattern: null,
        matchType: "contains" as const,
        amountMin: null,
        amountMax: null,
        targetCategory: "insurance",
        targetPropertyId: null,
        priority: 5,
        isActive: true,
      };

      await caller.categorizationRules.create(input);
      expect(uow.categorizationRules.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          name: "Test Rule",
          merchantPattern: "Test Merchant",
        }),
      );
    });

    it("rejects creation without any pattern", async () => {
      const { caller } = setupCtx();
      await expect(
        caller.categorizationRules.create({
          name: "No Pattern",
          merchantPattern: null,
          descriptionPattern: null,
          targetCategory: "insurance",
          targetPropertyId: null,
          amountMin: null,
          amountMax: null,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("enforces free plan limit of 5 rules", async () => {
      const { caller } = setupCtx({
        categorizationRules: {
          countByUser: vi.fn().mockResolvedValue(5),
          create: vi.fn(),
        },
        user: {
          findSubscriptionFull: vi.fn().mockResolvedValue(null),
        },
      });

      await expect(
        caller.categorizationRules.create({
          name: "Sixth Rule",
          merchantPattern: "Test",
          descriptionPattern: null,
          targetCategory: "insurance",
          targetPropertyId: null,
          amountMin: null,
          amountMax: null,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("validates targetPropertyId ownership", async () => {
      const { caller } = setupCtx({
        properties: {
          findById: vi.fn().mockResolvedValue(null), // Property not found/not owned
        },
      });

      await expect(
        caller.categorizationRules.create({
          name: "With Property",
          merchantPattern: "Test",
          descriptionPattern: null,
          targetCategory: "insurance",
          targetPropertyId: "550e8400-e29b-41d4-a716-446655440001",
          amountMin: null,
          amountMax: null,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("allows unlimited rules for pro plan", async () => {
      const createdRule = { ...mockRule, name: "Pro Rule" };
      const { caller } = setupCtx({
        categorizationRules: {
          countByUser: vi.fn().mockResolvedValue(10),
          create: vi.fn().mockResolvedValue(createdRule),
        },
        user: {
          findSubscriptionFull: vi.fn().mockResolvedValue({
            plan: "pro",
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 86400000),
          }),
        },
      });

      const result = await caller.categorizationRules.create({
        name: "Pro Rule",
        merchantPattern: "Test",
        descriptionPattern: null,
        targetCategory: "insurance",
        targetPropertyId: null,
        amountMin: null,
        amountMax: null,
      });
      expect(result.name).toBe("Pro Rule");
    });
  });

  describe("update", () => {
    it("updates an existing rule", async () => {
      const { caller, uow } = setupCtx();
      await caller.categorizationRules.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Updated Rule",
      });
      expect(uow.categorizationRules.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        expect.objectContaining({ name: "Updated Rule" }),
      );
    });

    it("validates targetPropertyId ownership on update", async () => {
      const { caller } = setupCtx({
        properties: {
          findById: vi.fn().mockResolvedValue(null),
        },
      });

      await expect(
        caller.categorizationRules.update({
          id: "550e8400-e29b-41d4-a716-446655440000",
          targetPropertyId: "550e8400-e29b-41d4-a716-446655440099",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns NOT_FOUND for non-existent rule", async () => {
      const { caller } = setupCtx({
        categorizationRules: {
          update: vi.fn().mockResolvedValue(null),
          findById: vi.fn().mockResolvedValue(null),
        },
      });

      await expect(
        caller.categorizationRules.update({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Nope" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("delete", () => {
    it("deletes a rule", async () => {
      const { caller, uow } = setupCtx();
      await caller.categorizationRules.delete({ id: "550e8400-e29b-41d4-a716-446655440000" });
      expect(uow.categorizationRules.delete).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000", "user-1");
    });
  });

  describe("test", () => {
    it("dry-runs a rule against recent transactions", async () => {
      const { caller } = setupCtx({
        categorizationRules: {
          findById: vi.fn().mockResolvedValue(mockRule),
        },
        transactions: {
          findRecent: vi.fn().mockResolvedValue([
            {
              id: "txn-1",
              description: "Body Corporate Fees",
              amount: "-450.00",
              category: "uncategorized",
              createdAt: new Date(),
              propertyId: null,
            },
            {
              id: "txn-2",
              description: "Bunnings Warehouse",
              amount: "-89.00",
              category: "uncategorized",
              createdAt: new Date(),
              propertyId: null,
            },
          ]),
        },
      });

      const result = await caller.categorizationRules.test({ ruleId: "550e8400-e29b-41d4-a716-446655440000" });
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].id).toBe("txn-1");
    });

    it("tests inline rule without saving", async () => {
      const { caller } = setupCtx({
        transactions: {
          findRecent: vi.fn().mockResolvedValue([
            {
              id: "txn-1",
              description: "Water Utility Payment",
              amount: "-200.00",
              category: "uncategorized",
              createdAt: new Date(),
              propertyId: null,
            },
          ]),
        },
      });

      const result = await caller.categorizationRules.test({
        rule: {
          name: "Water Rule",
          merchantPattern: null,
          descriptionPattern: "Water",
          matchType: "contains",
          amountMin: null,
          amountMax: null,
          targetCategory: "water_charges",
          targetPropertyId: null,
          priority: 0,
          isActive: true,
        },
      });
      expect(result.matchCount).toBe(1);
    });

    it("requires either ruleId or rule", async () => {
      const { caller } = setupCtx();
      await expect(
        caller.categorizationRules.test({}),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });
});
