import { randomBytes } from "crypto";

export type PortfolioRole = "owner" | "partner" | "accountant" | "advisor";

export interface PortfolioPermissions {
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewAuditLog: boolean;
  canUploadDocuments: boolean;
}

export function getPermissions(role: PortfolioRole): PortfolioPermissions {
  switch (role) {
    case "owner":
      return {
        canWrite: true,
        canManageMembers: true,
        canManageBanks: true,
        canViewAuditLog: true,
        canUploadDocuments: true,
      };
    case "partner":
      return {
        canWrite: true,
        canManageMembers: false,
        canManageBanks: true,
        canViewAuditLog: true,
        canUploadDocuments: true,
      };
    case "accountant":
      return {
        canWrite: false,
        canManageMembers: false,
        canManageBanks: false,
        canViewAuditLog: false,
        canUploadDocuments: true,
      };
    case "advisor":
      return {
        canWrite: false,
        canManageMembers: false,
        canManageBanks: false,
        canViewAuditLog: true,
        canUploadDocuments: false,
      };
  }
}

export function canWrite(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner";
}

export function canManageMembers(role: PortfolioRole): boolean {
  return role === "owner";
}

export function canManageBanks(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner";
}

export function canViewAuditLog(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner" || role === "advisor";
}

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function getInviteExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}
