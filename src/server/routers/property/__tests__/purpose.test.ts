import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

let currentMockUow: UnitOfWork;

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
  } as any;
  return ctx;
}

const validPropertyInput = {
  address: "123 Test St",
  suburb: "Sydney",
  state: "NSW" as const,
  postcode: "2000",
  purchasePrice: "500000",
  contractDate: "2024-01-15",
};

describe("property purpose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("does not pass purpose when not provided", async () => {
      const uow = createMockUow();
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const mockProperty = { id: "prop-1", ...validPropertyInput, purpose: "investment" };
      vi.mocked(uow.property.create).mockResolvedValue(mockProperty as never);
      vi.mocked(uow.property.countByOwner).mockResolvedValue(0);
      vi.mocked(uow.user.findById).mockResolvedValue({ ...mockUser, trialEndsAt: null, trialPlan: null } as never);
      vi.mocked(uow.user.findSubscriptionFull).mockResolvedValue(null);

      await caller.property.create(validPropertyInput);

      expect(vi.mocked(uow.property.create)).toHaveBeenCalledWith(
        expect.not.objectContaining({ purpose: expect.anything() })
      );
    });

    it("accepts a purpose value when provided", async () => {
      const uow = createMockUow();
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const mockProperty = { id: "prop-1", ...validPropertyInput, purpose: "commercial" };
      vi.mocked(uow.property.create).mockResolvedValue(mockProperty as never);
      vi.mocked(uow.property.countByOwner).mockResolvedValue(0);
      vi.mocked(uow.user.findById).mockResolvedValue({ ...mockUser, trialEndsAt: null, trialPlan: null } as never);
      vi.mocked(uow.user.findSubscriptionFull).mockResolvedValue(null);

      await caller.property.create({ ...validPropertyInput, purpose: "commercial" });

      expect(vi.mocked(uow.property.create)).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "commercial" })
      );
    });
  });

  describe("update", () => {
    it("passes purpose through when updating", async () => {
      const uow = createMockUow();
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const mockProperty = { id: "prop-1", ...validPropertyInput, purpose: "short_term_rental", updatedAt: new Date() };
      vi.mocked(uow.property.update).mockResolvedValue(mockProperty as never);

      await caller.property.update({ id: "550e8400-e29b-41d4-a716-446655440000", purpose: "short_term_rental" });

      expect(vi.mocked(uow.property.update)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        expect.objectContaining({ purpose: "short_term_rental" })
      );
    });
  });
});
