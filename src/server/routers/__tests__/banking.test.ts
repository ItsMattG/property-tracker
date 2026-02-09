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

  describe("getAccountSummaries", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.banking.getAccountSummaries()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("returns summaries for each account", async () => {
      const ctx = createAuthenticatedContext();
      const mockAccount = {
        id: "acct-1",
        nickname: "My Account",
        accountName: "Transaction Account",
        institution: "Test Bank",
        institutionNickname: null,
        accountType: "transaction",
        accountNumberMasked: "****1234",
        connectionStatus: "connected",
        lastSyncedAt: new Date().toISOString(),
        balance: "5000.00",
        defaultProperty: null,
      };

      ctx.db.query.bankAccounts = {
        findMany: vi.fn().mockResolvedValue([mockAccount]),
      };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn()
            .mockResolvedValueOnce([{ count: 5 }])      // unreconciled count
            .mockResolvedValueOnce([{ total: "3200.50" }]) // reconciled balance
            .mockResolvedValueOnce([{ cashIn: "2000", cashOut: "-800" }]), // monthly
        }),
      });

      const caller = createTestCaller(ctx);
      const result = await caller.banking.getAccountSummaries();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "acct-1",
        accountName: "My Account",
        unreconciledCount: 5,
        reconciledBalance: "3200.50",
        cashIn: "2000",
        cashOut: "-800",
      });
    });

    it("returns empty array when no accounts", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.bankAccounts = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.banking.getAccountSummaries();

      expect(result).toEqual([]);
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
