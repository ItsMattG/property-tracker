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

/**
 * Create an authenticated mock context with UoW.
 * Sets up ctx.db.query.users.findFirst so the protectedProcedure
 * middleware resolves the user before reaching the router handler.
 * Also configures the mocked UnitOfWork constructor to return our uow.
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
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- partial mock of Drizzle DB for test context
  return ctx;
}

const mockReminder = {
  id: "rem-1",
  propertyId: "prop-1",
  userId: "user-1",
  reminderType: "insurance_renewal" as const,
  title: "Insurance Renewal — 123 Test St",
  dueDate: "2026-04-15",
  reminderDaysBefore: [30, 7],
  notes: null,
  notifiedAt: null,
  completedAt: null,
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
};

describe("reminder router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- list ---
  describe("list", () => {
    it("returns all reminders for user", async () => {
      const uow = createMockUow({
        reminder: {
          findByOwner: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.list({});

      expect(result).toEqual([mockReminder]);
      expect(uow.reminder.findByOwner).toHaveBeenCalledWith("user-1", {});
    });

    it("filters by propertyId when provided", async () => {
      const uow = createMockUow({
        reminder: {
          findByOwner: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.list({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toEqual([mockReminder]);
      expect(uow.reminder.findByOwner).toHaveBeenCalledWith("user-1", {
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });
  });

  // --- getUpcoming ---
  describe("getUpcoming", () => {
    it("returns upcoming reminders with default 90 days", async () => {
      const uow = createMockUow({
        reminder: {
          findUpcoming: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.getUpcoming({});

      expect(result).toEqual([mockReminder]);
      expect(uow.reminder.findUpcoming).toHaveBeenCalledWith("user-1", 90);
    });

    it("accepts custom days parameter", async () => {
      const uow = createMockUow({
        reminder: {
          findUpcoming: vi.fn().mockResolvedValue([]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.getUpcoming({ days: 30 });

      expect(result).toEqual([]);
      expect(uow.reminder.findUpcoming).toHaveBeenCalledWith("user-1", 30);
    });
  });

  // --- getByMonth ---
  describe("getByMonth", () => {
    it("returns reminders for a specific month", async () => {
      const uow = createMockUow({
        reminder: {
          findByMonth: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.getByMonth({ year: 2026, month: 4 });

      expect(result).toEqual([mockReminder]);
      expect(uow.reminder.findByMonth).toHaveBeenCalledWith("user-1", 2026, 4);
    });
  });

  // --- create ---
  describe("create", () => {
    it("creates a reminder with provided fields", async () => {
      const uow = createMockUow({
        reminder: {
          create: vi.fn().mockResolvedValue(mockReminder),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.create({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        reminderType: "insurance_renewal",
        title: "Insurance Renewal — 123 Test St",
        dueDate: "2026-04-15",
        reminderDaysBefore: [30, 7],
        notes: "Call broker",
      });

      expect(result).toEqual(mockReminder);
      expect(uow.reminder.create).toHaveBeenCalledWith({
        userId: "user-1",
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        reminderType: "insurance_renewal",
        title: "Insurance Renewal — 123 Test St",
        dueDate: "2026-04-15",
        reminderDaysBefore: [30, 7],
        notes: "Call broker",
      });
    });
  });

  // --- update ---
  describe("update", () => {
    it("updates a reminder and returns it", async () => {
      const updated = { ...mockReminder, title: "Updated Title" };
      const uow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(updated),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Updated Title",
      });

      expect(result).toEqual(updated);
      expect(uow.reminder.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        { title: "Updated Title" }
      );
    });

    it("throws NOT_FOUND when reminder does not exist", async () => {
      const uow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.reminder.update({
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: "Won't work",
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.reminder.update({
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: "Won't work",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // --- complete ---
  describe("complete", () => {
    it("sets completedAt and returns the reminder", async () => {
      const completed = { ...mockReminder, completedAt: new Date("2026-02-19") };
      const uow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(completed),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.complete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toEqual(completed);
      expect(uow.reminder.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        { completedAt: expect.any(Date) }
      );
    });

    it("throws NOT_FOUND when reminder does not exist", async () => {
      const uow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await expect(
        caller.reminder.complete({
          id: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.reminder.complete({
          id: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // --- delete ---
  describe("delete", () => {
    it("deletes a reminder", async () => {
      const uow = createMockUow({
        reminder: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
      });
      const ctx = createAuthCtxWithUow(uow);
      const caller = createTestCaller(ctx);

      await caller.reminder.delete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(uow.reminder.delete).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1"
      );
    });
  });
});
