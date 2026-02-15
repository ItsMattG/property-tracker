import { eq, and, desc } from "drizzle-orm";
import {
  portfolioMembers,
  portfolioInvites,
  auditLog,
  users,
} from "../db/schema";
import type {
  PortfolioMember,
  NewPortfolioMember,
  PortfolioInvite,
  NewPortfolioInvite,
  NewAuditLogEntry,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  ITeamRepository,
  MemberWithUser,
  InviteWithOwner,
  AuditEntryWithActor,
} from "./interfaces/team.repository.interface";

export class TeamRepository
  extends BaseRepository
  implements ITeamRepository
{
  async getOwner(
    ownerId: string
  ): Promise<{ id: string; name: string | null; email: string } | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.id, ownerId),
      columns: { id: true, name: true, email: true },
    });
    return result ?? null;
  }

  async listMembers(ownerId: string): Promise<MemberWithUser[]> {
    const results = await this.db.query.portfolioMembers.findMany({
      where: eq(portfolioMembers.ownerId, ownerId),
      with: { user: true },
      orderBy: [desc(portfolioMembers.joinedAt)],
    });
    return results as MemberWithUser[];
  }

  async listPendingInvites(ownerId: string): Promise<PortfolioInvite[]> {
    return this.db.query.portfolioInvites.findMany({
      where: and(
        eq(portfolioInvites.ownerId, ownerId),
        eq(portfolioInvites.status, "pending")
      ),
      orderBy: [desc(portfolioInvites.createdAt)],
    });
  }

  async findUserByEmail(
    email: string
  ): Promise<{ id: string; email: string } | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true },
    });
    return result ?? null;
  }

  async findMembership(
    ownerId: string,
    userId: string
  ): Promise<PortfolioMember | null> {
    const result = await this.db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.ownerId, ownerId),
        eq(portfolioMembers.userId, userId)
      ),
    });
    return result ?? null;
  }

  async findPendingInviteByEmail(
    ownerId: string,
    email: string
  ): Promise<PortfolioInvite | null> {
    const result = await this.db.query.portfolioInvites.findFirst({
      where: and(
        eq(portfolioInvites.ownerId, ownerId),
        eq(portfolioInvites.email, email),
        eq(portfolioInvites.status, "pending")
      ),
    });
    return result ?? null;
  }

  async createInvite(
    data: NewPortfolioInvite,
    tx?: DB
  ): Promise<PortfolioInvite> {
    const client = this.resolve(tx);
    const [invite] = await client
      .insert(portfolioInvites)
      .values(data)
      .returning();
    return invite;
  }

  async cancelInvite(
    inviteId: string,
    ownerId: string,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(portfolioInvites)
      .where(
        and(
          eq(portfolioInvites.id, inviteId),
          eq(portfolioInvites.ownerId, ownerId)
        )
      );
  }

  async refreshInviteToken(
    inviteId: string,
    token: string,
    expiresAt: Date,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(portfolioInvites)
      .set({ token, expiresAt, status: "pending" })
      .where(eq(portfolioInvites.id, inviteId));
  }

  async findInviteByToken(token: string): Promise<InviteWithOwner | null> {
    const result = await this.db.query.portfolioInvites.findFirst({
      where: eq(portfolioInvites.token, token),
      with: { owner: true },
    });
    if (!result) return null;
    return result as InviteWithOwner;
  }

  async findInviteByTokenBasic(
    token: string
  ): Promise<PortfolioInvite | null> {
    const result = await this.db.query.portfolioInvites.findFirst({
      where: eq(portfolioInvites.token, token),
    });
    return result ?? null;
  }

  async acceptInvite(
    inviteId: string,
    membership: NewPortfolioMember,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client.insert(portfolioMembers).values(membership);
    await client
      .update(portfolioInvites)
      .set({ status: "accepted" })
      .where(eq(portfolioInvites.id, inviteId));
  }

  async declineInvite(inviteId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(portfolioInvites)
      .set({ status: "declined" })
      .where(eq(portfolioInvites.id, inviteId));
  }

  async findMemberById(
    memberId: string,
    ownerId: string
  ): Promise<MemberWithUser | null> {
    const result = await this.db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.id, memberId),
        eq(portfolioMembers.ownerId, ownerId)
      ),
      with: { user: true },
    });
    if (!result) return null;
    return result as MemberWithUser;
  }

  async changeRole(memberId: string, role: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(portfolioMembers)
      .set({ role: role as PortfolioMember["role"] })
      .where(eq(portfolioMembers.id, memberId));
  }

  async removeMember(memberId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(portfolioMembers)
      .where(eq(portfolioMembers.id, memberId));
  }

  async getAccessiblePortfolios(
    userId: string
  ): Promise<Array<{ ownerId: string; ownerName: string; role: string }>> {
    const results = await this.db.query.portfolioMembers.findMany({
      where: eq(portfolioMembers.userId, userId),
      with: { owner: true },
    });
    return results
      .filter((m) => m.joinedAt !== null)
      .map((m) => ({
        ownerId: m.ownerId,
        ownerName: (m.owner as { name: string | null })?.name ?? "Unknown",
        role: m.role,
      }));
  }

  async getAuditLog(
    ownerId: string,
    limit: number,
    offset: number
  ): Promise<AuditEntryWithActor[]> {
    const results = await this.db.query.auditLog.findMany({
      where: eq(auditLog.ownerId, ownerId),
      with: { actor: true },
      orderBy: [desc(auditLog.createdAt)],
      limit,
      offset,
    });
    return results as AuditEntryWithActor[];
  }

  async logAudit(entry: NewAuditLogEntry, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.insert(auditLog).values(entry);
  }
}
