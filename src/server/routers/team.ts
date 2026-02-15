import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, memberProcedure, publicProcedure } from "../trpc";
import {
  portfolioMembers,
  portfolioInvites,
  auditLog,
  users,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generateInviteToken,
  getInviteExpiryDate,
} from "../services/portfolio/portfolio-access";

export const teamRouter = router({
  // Get current portfolio context (for UI)
  getContext: protectedProcedure.query(async ({ ctx }) => {
    const owner = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.portfolio.ownerId),
    });

    return {
      ownerId: ctx.portfolio.ownerId,
      ownerName: owner?.name || owner?.email || "Unknown",
      role: ctx.portfolio.role,
      isOwnPortfolio: ctx.portfolio.ownerId === ctx.user.id,
      permissions: {
        canWrite: ctx.portfolio.canWrite,
        canManageMembers: ctx.portfolio.canManageMembers,
        canManageBanks: ctx.portfolio.canManageBanks,
        canViewAuditLog: ctx.portfolio.canViewAuditLog,
      },
    };
  }),

  // List team members
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.portfolio.canViewAuditLog) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to view team members",
      });
    }

    const members = await ctx.db.query.portfolioMembers.findMany({
      where: eq(portfolioMembers.ownerId, ctx.portfolio.ownerId),
      with: {
        user: true,
      },
      orderBy: [desc(portfolioMembers.joinedAt)],
    });

    // Get owner info
    const owner = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.portfolio.ownerId),
    });

    return {
      owner,
      members: members.filter((m) => m.joinedAt !== null),
    };
  }),

  // List pending invites (owner only)
  listInvites: memberProcedure.query(async ({ ctx }) => {
    return ctx.db.query.portfolioInvites.findMany({
      where: and(
        eq(portfolioInvites.ownerId, ctx.portfolio.ownerId),
        eq(portfolioInvites.status, "pending")
      ),
      orderBy: [desc(portfolioInvites.createdAt)],
    });
  }),

  // Send invite (owner only)
  sendInvite: memberProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["partner", "accountant", "advisor"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if already a member
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (existingUser) {
        const existingMember = await ctx.db.query.portfolioMembers.findFirst({
          where: and(
            eq(portfolioMembers.ownerId, ctx.portfolio.ownerId),
            eq(portfolioMembers.userId, existingUser.id)
          ),
        });

        if (existingMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This user is already a member of your portfolio",
          });
        }
      }

      // Check for pending invite
      const existingInvite = await ctx.db.query.portfolioInvites.findFirst({
        where: and(
          eq(portfolioInvites.ownerId, ctx.portfolio.ownerId),
          eq(portfolioInvites.email, input.email.toLowerCase()),
          eq(portfolioInvites.status, "pending")
        ),
      });

      if (existingInvite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An invite has already been sent to this email",
        });
      }

      const token = generateInviteToken();
      const expiresAt = getInviteExpiryDate();

      const [invite] = await ctx.db
        .insert(portfolioInvites)
        .values({
          ownerId: ctx.portfolio.ownerId,
          email: input.email.toLowerCase(),
          role: input.role,
          token,
          invitedBy: ctx.user.id,
          expiresAt,
        })
        .returning();

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "member_invited",
        targetEmail: input.email.toLowerCase(),
        metadata: JSON.stringify({ role: input.role }),
      });

      // Note: Email sending will be added in Task 6

      return invite;
    }),

  // Cancel invite (owner only)
  cancelInvite: memberProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(portfolioInvites)
        .where(
          and(
            eq(portfolioInvites.id, input.inviteId),
            eq(portfolioInvites.ownerId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),

  // Resend invite (owner only)
  resendInvite: memberProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.query.portfolioInvites.findFirst({
        where: and(
          eq(portfolioInvites.id, input.inviteId),
          eq(portfolioInvites.ownerId, ctx.portfolio.ownerId)
        ),
      });

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      const newToken = generateInviteToken();
      const newExpiry = getInviteExpiryDate();

      await ctx.db
        .update(portfolioInvites)
        .set({
          token: newToken,
          expiresAt: newExpiry,
          status: "pending",
        })
        .where(eq(portfolioInvites.id, input.inviteId));

      // Note: Email sending will be added in Task 6

      return { success: true };
    }),

  // Change member role (owner only)
  changeRole: memberProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
        role: z.enum(["partner", "accountant", "advisor"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.query.portfolioMembers.findFirst({
        where: and(
          eq(portfolioMembers.id, input.memberId),
          eq(portfolioMembers.ownerId, ctx.portfolio.ownerId)
        ),
        with: { user: true },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await ctx.db
        .update(portfolioMembers)
        .set({ role: input.role })
        .where(eq(portfolioMembers.id, input.memberId));

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "role_changed",
        targetEmail: member.user?.email,
        metadata: JSON.stringify({ oldRole: member.role, newRole: input.role }),
      });

      return { success: true };
    }),

  // Remove member (owner only)
  removeMember: memberProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.query.portfolioMembers.findFirst({
        where: and(
          eq(portfolioMembers.id, input.memberId),
          eq(portfolioMembers.ownerId, ctx.portfolio.ownerId)
        ),
        with: { user: true },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await ctx.db
        .delete(portfolioMembers)
        .where(eq(portfolioMembers.id, input.memberId));

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "member_removed",
        targetEmail: member.user?.email,
      });

      return { success: true };
    }),

  // Get portfolios user has access to (for switcher)
  getAccessiblePortfolios: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.portfolioMembers.findMany({
      where: eq(portfolioMembers.userId, ctx.user.id),
      with: {
        owner: true,
      },
    });

    return memberships
      .filter((m) => m.joinedAt !== null)
      .map((m) => ({
        ownerId: m.ownerId,
        ownerName: m.owner?.name || m.owner?.email || "Unknown",
        role: m.role,
      }));
  }),

  // Get audit log
  getAuditLog: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.portfolio.canViewAuditLog) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to view the audit log",
        });
      }

      const entries = await ctx.db.query.auditLog.findMany({
        where: eq(auditLog.ownerId, ctx.portfolio.ownerId),
        with: {
          actor: true,
        },
        orderBy: [desc(auditLog.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return entries;
    }),

  // Get invite by token (for accept page - public)
  getInviteByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.query.portfolioInvites.findFirst({
        where: eq(portfolioInvites.token, input.token),
        with: { owner: true },
      });

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      if (invite.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already used" });
      }

      if (new Date() > invite.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      }

      return {
        ownerName: invite.owner?.name || invite.owner?.email || "Unknown",
        role: invite.role,
        email: invite.email,
      };
    }),

  // Accept invite
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.query.portfolioInvites.findFirst({
        where: eq(portfolioInvites.token, input.token),
      });

      if (!invite || invite.status !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite" });
      }

      if (new Date() > invite.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      }

      // Verify email matches (case-insensitive)
      if (invite.email.toLowerCase() !== ctx.user.email?.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite was sent to a different email address",
        });
      }

      // Create membership
      await ctx.db.insert(portfolioMembers).values({
        ownerId: invite.ownerId,
        userId: ctx.user.id,
        role: invite.role,
        invitedBy: invite.invitedBy,
        joinedAt: new Date(),
      });

      // Update invite status
      await ctx.db
        .update(portfolioInvites)
        .set({ status: "accepted" })
        .where(eq(portfolioInvites.id, invite.id));

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: invite.ownerId,
        actorId: ctx.user.id,
        action: "invite_accepted",
        targetEmail: ctx.user.email,
      });

      return { success: true };
    }),

  // Decline invite
  declineInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.query.portfolioInvites.findFirst({
        where: eq(portfolioInvites.token, input.token),
      });

      if (!invite || invite.status !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite" });
      }

      await ctx.db
        .update(portfolioInvites)
        .set({ status: "declined" })
        .where(eq(portfolioInvites.id, invite.id));

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: invite.ownerId,
        actorId: ctx.user.id,
        action: "invite_declined",
        targetEmail: ctx.user.email,
      });

      return { success: true };
    }),
});
