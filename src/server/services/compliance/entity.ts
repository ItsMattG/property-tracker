export type EntityRole = "owner" | "admin" | "member" | "accountant";

export interface EntityPermissions {
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewFinancials: boolean;
}

export function getEntityPermissions(role: EntityRole): EntityPermissions {
  switch (role) {
    case "owner":
    case "admin":
      return {
        canWrite: true,
        canManageMembers: true,
        canManageBanks: true,
        canViewFinancials: true,
      };
    case "member":
      return {
        canWrite: true,
        canManageMembers: false,
        canManageBanks: false,
        canViewFinancials: true,
      };
    case "accountant":
      return {
        canWrite: false,
        canManageMembers: false,
        canManageBanks: false,
        canViewFinancials: true,
      };
  }
}

export function canAccessEntity(
  userId: string,
  entityOwnerId: string,
  membership: { joinedAt: Date | null; role: EntityRole } | undefined
): boolean {
  // Owner always has access
  if (userId === entityOwnerId) {
    return true;
  }

  // Must have joined membership
  if (membership && membership.joinedAt) {
    return true;
  }

  return false;
}
