import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { UnitOfWork } from "../../../repositories/unit-of-work";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";

let currentMockUow: UnitOfWork;

vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

// Mock extraction service (used by extract mutation's fire-and-forget)
vi.mock("../../../services/property-analysis", () => ({
  extractDocument: vi.fn(),
  matchPropertyByAddress: vi.fn(),
}));

function setupContext(plan: "free" | "pro" | "team" | "lifetime", monthlyCount: number) {
  const uow = createMockUow({
    document: {
      findById: vi.fn().mockResolvedValue({
        id: "doc-1",
        userId: mockUser.id,
        storagePath: "user-1/props/receipt.pdf",
        fileType: "application/pdf",
      }),
      findExtractionByDocumentId: vi.fn().mockResolvedValue(null),
      getMonthlyExtractionCount: vi.fn().mockResolvedValue(monthlyCount),
      createExtraction: vi.fn().mockResolvedValue({
        id: "ext-1",
        documentId: "doc-1",
        status: "processing",
      }),
    },
  });

  currentMockUow = uow;

  const ctx = createMockContext({ userId: mockUser.id, user: mockUser, uow });

  ctx.db = {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
      subscriptions: {
        findFirst: vi.fn().mockResolvedValue(
          plan === "free"
            ? null
            : { plan, status: "active", currentPeriodEnd: new Date("2027-01-01") }
        ),
      },
    },
  } as ReturnType<typeof createMockContext>["db"];

  return { ctx, uow };
}

describe("documentExtraction plan gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extract mutation", () => {
    it("throws FORBIDDEN when free user is at the monthly limit", async () => {
      const { ctx } = setupContext("free", 5);
      const caller = createTestCaller(ctx);

      await expect(
        caller.documentExtraction.extract({
          documentId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow(TRPCError);

      await expect(
        caller.documentExtraction.extract({
          documentId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("5 receipt scans"),
      });
    });

    it("allows extraction when free user is under the limit", async () => {
      const { ctx } = setupContext("free", 3);
      const caller = createTestCaller(ctx);

      const result = await caller.documentExtraction.extract({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "ext-1",
          status: "processing",
        })
      );
    });

    it("allows extraction for pro user regardless of count", async () => {
      const { ctx } = setupContext("pro", 100);
      const caller = createTestCaller(ctx);

      const result = await caller.documentExtraction.extract({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "ext-1",
          status: "processing",
        })
      );
    });
  });

  describe("getRemainingScans", () => {
    it("returns remaining count for free user", async () => {
      const { ctx } = setupContext("free", 2);
      const caller = createTestCaller(ctx);

      const result = await caller.documentExtraction.getRemainingScans();

      expect(result).toEqual({ used: 2, limit: 5, remaining: 3 });
    });

    it("returns null limit and remaining for pro user", async () => {
      const { ctx } = setupContext("pro", 50);
      const caller = createTestCaller(ctx);

      const result = await caller.documentExtraction.getRemainingScans();

      expect(result).toEqual({ used: 50, limit: null, remaining: null });
    });
  });
});
