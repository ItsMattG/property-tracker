import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("property router", () => {
  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ clerkId: null });
      const caller = createTestCaller(ctx);

      await expect(caller.property.list()).rejects.toThrow(TRPCError);
      await expect(caller.property.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws UNAUTHORIZED when user not found in database", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123" });
      // Mock db.query.users.findFirst to return null
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(caller.property.list()).rejects.toThrow(TRPCError);
      await expect(caller.property.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: expect.stringContaining("User not found"),
      });
    });
  });

  describe("data isolation", () => {
    const mockUser = {
      id: "user-1",
      clerkId: "clerk_123",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const otherUser = {
      id: "user-2",
      clerkId: "clerk_456",
      email: "other@example.com",
      name: "Other User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("property.get throws error for other user's property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
          properties: {
            findFirst: vi.fn().mockResolvedValue(null), // Property belongs to other user
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(
        caller.property.get({ id: "550e8400-e29b-41d4-a716-446655440000" })
      ).rejects.toThrow("Property not found");
    });

    it("property.list only returns current user's properties", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      const userProperties = [
        { id: "prop-1", userId: "user-1", address: "123 Main St" },
        { id: "prop-2", userId: "user-1", address: "456 Oak Ave" },
      ];

      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
          properties: {
            findMany: vi.fn().mockResolvedValue(userProperties),
          },
        },
      };
      const caller = createTestCaller(ctx);

      const result = await caller.property.list();

      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.userId === "user-1")).toBe(true);
    });
  });
});
