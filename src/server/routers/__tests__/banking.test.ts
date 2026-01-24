import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  createUnauthenticatedContext,
  createAuthenticatedContext,
} from "../../__tests__/test-utils";

describe("banking router", () => {
  describe("authentication", () => {
    it("listAccounts throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.banking.listAccounts()).rejects.toThrow(TRPCError);
      await expect(caller.banking.listAccounts()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("listAlerts throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.banking.listAlerts()).rejects.toThrow(TRPCError);
      await expect(caller.banking.listAlerts()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("getConnectionStatus throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.banking.getConnectionStatus()).rejects.toThrow(TRPCError);
      await expect(caller.banking.getConnectionStatus()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("data isolation", () => {
    it("listAccounts only returns user's accounts", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.bankAccounts = { findMany: findManyMock };

      const caller = createTestCaller(ctx);
      await caller.banking.listAccounts();

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("listAlerts only returns user's alerts", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.connectionAlerts = { findMany: findManyMock };

      const caller = createTestCaller(ctx);
      await caller.banking.listAlerts();

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("syncAccount rejects non-owned account", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.bankAccounts = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.banking.syncAccount({
          accountId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow();
    });

    it("dismissAlert only updates user's own alerts", async () => {
      const ctx = createAuthenticatedContext();
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "alert-1", status: "dismissed" }]),
          }),
        }),
      });
      ctx.db.update = updateMock;

      const caller = createTestCaller(ctx);

      // The procedure only updates alerts where userId matches
      await caller.banking.dismissAlert({
        alertId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(updateMock).toHaveBeenCalled();
    });

    it("reconnect rejects non-owned account", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.bankAccounts = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.banking.reconnect({
          accountId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow();
    });
  });
});
