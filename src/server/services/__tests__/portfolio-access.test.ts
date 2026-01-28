import { describe, it, expect } from "vitest";
import {
  getPermissions,
  canWrite,
  canManageMembers,
  canManageBanks,
  canViewAuditLog,
} from "../portfolio-access";

describe("portfolio-access", () => {
  describe("getPermissions", () => {
    it("returns full permissions for owner", () => {
      const perms = getPermissions("owner");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canManageBanks).toBe(true);
      expect(perms.canViewAuditLog).toBe(true);
    });

    it("returns write permissions for partner", () => {
      const perms = getPermissions("partner");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(true);
      expect(perms.canViewAuditLog).toBe(true);
    });

    it("returns read-only for accountant", () => {
      const perms = getPermissions("accountant");
      expect(perms.canWrite).toBe(false);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
      expect(perms.canViewAuditLog).toBe(false);
    });

    it("returns read-only permissions for advisor role", () => {
      const perms = getPermissions("advisor");
      expect(perms.canWrite).toBe(false);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
      expect(perms.canViewAuditLog).toBe(true);
      expect(perms.canUploadDocuments).toBe(false);
    });
  });

  describe("permission helpers", () => {
    it("canWrite returns true for owner and partner", () => {
      expect(canWrite("owner")).toBe(true);
      expect(canWrite("partner")).toBe(true);
      expect(canWrite("accountant")).toBe(false);
      expect(canWrite("advisor")).toBe(false);
    });

    it("canManageMembers returns true only for owner", () => {
      expect(canManageMembers("owner")).toBe(true);
      expect(canManageMembers("partner")).toBe(false);
      expect(canManageMembers("accountant")).toBe(false);
      expect(canManageMembers("advisor")).toBe(false);
    });

    it("canManageBanks returns true for owner and partner", () => {
      expect(canManageBanks("owner")).toBe(true);
      expect(canManageBanks("partner")).toBe(true);
      expect(canManageBanks("accountant")).toBe(false);
      expect(canManageBanks("advisor")).toBe(false);
    });

    it("canViewAuditLog returns true for owner, partner, and advisor", () => {
      expect(canViewAuditLog("owner")).toBe(true);
      expect(canViewAuditLog("partner")).toBe(true);
      expect(canViewAuditLog("accountant")).toBe(false);
      expect(canViewAuditLog("advisor")).toBe(true);
    });
  });
});
