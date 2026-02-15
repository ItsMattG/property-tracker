import { describe, it, expect } from "vitest";
import {
  getEntityPermissions,
  canAccessEntity,
  type EntityRole,
} from "../entity";

describe("entity service", () => {
  describe("getEntityPermissions", () => {
    it("returns full permissions for owner", () => {
      const perms = getEntityPermissions("owner");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canManageBanks).toBe(true);
      expect(perms.canViewFinancials).toBe(true);
    });

    it("returns full permissions for admin", () => {
      const perms = getEntityPermissions("admin");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canManageBanks).toBe(true);
    });

    it("returns limited permissions for member", () => {
      const perms = getEntityPermissions("member");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
    });

    it("returns read-only permissions for accountant", () => {
      const perms = getEntityPermissions("accountant");
      expect(perms.canWrite).toBe(false);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
      expect(perms.canViewFinancials).toBe(true);
    });
  });

  describe("canAccessEntity", () => {
    it("returns true for entity owner", () => {
      expect(canAccessEntity("user1", "user1", undefined)).toBe(true);
    });

    it("returns true for joined member", () => {
      const membership = { joinedAt: new Date(), role: "member" as EntityRole };
      expect(canAccessEntity("user2", "user1", membership)).toBe(true);
    });

    it("returns false for pending member", () => {
      const membership = { joinedAt: null, role: "member" as EntityRole };
      expect(canAccessEntity("user2", "user1", membership)).toBe(false);
    });

    it("returns false for non-member", () => {
      expect(canAccessEntity("user2", "user1", undefined)).toBe(false);
    });
  });
});
