import type {
  PortfolioMember,
  NewPortfolioMember,
  PortfolioInvite,
  NewPortfolioInvite,
  AuditLogEntry,
  NewAuditLogEntry,
} from "../../db/schema";
import type { DB } from "../base";

export interface MemberWithUser extends PortfolioMember {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export interface InviteWithOwner extends PortfolioInvite {
  owner: { id: string; name: string | null; email: string } | null;
}

export interface AuditEntryWithActor extends AuditLogEntry {
  actor: { id: string; name: string | null; email: string } | null;
}

export interface ITeamRepository {
  getOwner(
    ownerId: string
  ): Promise<{ id: string; name: string | null; email: string } | null>;
  listMembers(ownerId: string): Promise<MemberWithUser[]>;
  listPendingInvites(ownerId: string): Promise<PortfolioInvite[]>;
  findUserByEmail(email: string): Promise<{ id: string; email: string } | null>;
  findMembership(
    ownerId: string,
    userId: string
  ): Promise<PortfolioMember | null>;
  findPendingInviteByEmail(
    ownerId: string,
    email: string
  ): Promise<PortfolioInvite | null>;
  createInvite(data: NewPortfolioInvite, tx?: DB): Promise<PortfolioInvite>;
  cancelInvite(inviteId: string, ownerId: string, tx?: DB): Promise<void>;
  refreshInviteToken(
    inviteId: string,
    token: string,
    expiresAt: Date,
    tx?: DB
  ): Promise<void>;
  findInviteByToken(token: string): Promise<InviteWithOwner | null>;
  findInviteByTokenBasic(token: string): Promise<PortfolioInvite | null>;
  acceptInvite(
    inviteId: string,
    membership: NewPortfolioMember,
    tx?: DB
  ): Promise<void>;
  declineInvite(inviteId: string, tx?: DB): Promise<void>;
  findMemberById(
    memberId: string,
    ownerId: string
  ): Promise<MemberWithUser | null>;
  changeRole(memberId: string, role: string, tx?: DB): Promise<void>;
  removeMember(memberId: string, tx?: DB): Promise<void>;
  getAccessiblePortfolios(
    userId: string
  ): Promise<Array<{ ownerId: string; ownerName: string; role: string }>>;
  getAuditLog(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<AuditEntryWithActor[]>;
  logAudit(entry: NewAuditLogEntry, tx?: DB): Promise<void>;
}
