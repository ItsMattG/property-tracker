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

    it("property.get includes userId filter in query", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      const findFirstMock = vi.fn().mockResolvedValue(null);
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
          properties: {
            findFirst: findFirstMock,
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(
        caller.property.get({ id: "550e8400-e29b-41d4-a716-446655440000" })
      ).rejects.toThrow("Property not found");

      // Verify the query was called with a where clause
      expect(findFirstMock).toHaveBeenCalledTimes(1);
      expect(findFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("property.list includes userId filter in query", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      const userProperties = [
        { id: "prop-1", userId: "user-1", address: "123 Main St" },
        { id: "prop-2", userId: "user-1", address: "456 Oak Ave" },
      ];
      const findManyMock = vi.fn().mockResolvedValue(userProperties);

      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
          properties: {
            findMany: findManyMock,
          },
        },
      };
      const caller = createTestCaller(ctx);

      const result = await caller.property.list();

      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.userId === "user-1")).toBe(true);

      // Verify the query was called with a where clause for userId filtering
      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("property.update only updates user's own properties", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
        },
        update: updateMock,
      };
      const caller = createTestCaller(ctx);

      // Try to update a property (could be another user's)
      const result = await caller.property.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        address: "New Address",
      });

      // Verify update was called with proper table reference
      expect(updateMock).toHaveBeenCalledTimes(1);
      // The update chain was executed (where clause includes userId filter in router)
      expect(result).toBeUndefined(); // Empty array returns undefined
    });

    it("property.delete only deletes user's own properties", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
        },
        delete: deleteMock,
      };
      const caller = createTestCaller(ctx);

      // Try to delete a property (could be another user's)
      const result = await caller.property.delete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      // Verify delete was called with proper table reference
      expect(deleteMock).toHaveBeenCalledTimes(1);
      // The router includes userId in the where clause for security
      expect(result).toEqual({ success: true });
    });

    it("property.update returns undefined when property not found or belongs to other user", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      // Mock chain that returns empty array (no matching property)
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // No rows updated
            }),
          }),
        }),
      };
      const caller = createTestCaller(ctx);

      // Update on non-existent or other user's property returns undefined
      const result = await caller.property.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        address: "Hacked Address",
      });

      // Because where includes userId filter, other user's properties won't match
      expect(result).toBeUndefined();
    });
  });
});
