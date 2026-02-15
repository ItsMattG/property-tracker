import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, memberProcedure, publicProcedure } from "../../trpc";
import {
  generateInviteToken,
  getInviteExpiryDate,
} from "../../services/portfolio/portfolio-access";
import { TeamRepository } from "../../repositories/team.repository";

export const teamRouter = router({
  getContext: protectedProcedure.query(async ({ ctx }) => {
    const owner = await ctx.uow.team.getOwner(ctx.portfolio.ownerId);
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

  listMembers: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.portfolio.canViewAuditLog) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to view team members",
      });
    }

    const members = await ctx.uow.team.listMembers(ctx.portfolio.ownerId);
    const owner = await ctx.uow.team.getOwner(ctx.portfolio.ownerId);

    return {
      owner,
      members: members.filter((m) => m.joinedAt !== null),
    };
  }),

  listInvites: memberProcedure.query(async ({ ctx }) => {
    return ctx.uow.team.listPendingInvites(ctx.portfolio.ownerId);
  }),

  sendInvite: memberProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["partner", "accountant", "advisor"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingUser = await ctx.uow.team.findUserByEmail(
        input.email.toLowerCase()
      );

      if (existingUser) {
        const existingMember = await ctx.uow.team.findMembership(
          ctx.portfolio.ownerId,
          existingUser.id
        );
        if (existingMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This user is already a member of your portfolio",
          });
        }
      }

      const existingInvite = await ctx.uow.team.findPendingInviteByEmail(
        ctx.portfolio.ownerId,
        input.email.toLowerCase()
      );
      if (existingInvite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An invite has already been sent to this email",
        });
      }

      const token = generateInviteToken();
      const expiresAt = getInviteExpiryDate();

      const invite = await ctx.uow.team.createInvite({
        ownerId: ctx.portfolio.ownerId,
        email: input.email.toLowerCase(),
        role: input.role,
        token,
        invitedBy: ctx.user.id,
        expiresAt,
      });

      await ctx.uow.team.logAudit({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "member_invited",
        targetEmail: input.email.toLowerCase(),
        metadata: JSON.stringify({ role: input.role }),
      });

      return invite;
    }),

  cancelInvite: memberProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.team.cancelInvite(input.inviteId, ctx.portfolio.ownerId);
      return { success: true };
    }),

  resendInvite: memberProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.uow.team.findInviteByTokenBasic(input.inviteId);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      const newToken = generateInviteToken();
      const newExpiry = getInviteExpiryDate();

      await ctx.uow.team.refreshInviteToken(input.inviteId, newToken, newExpiry);
      return { success: true };
    }),

  changeRole: memberProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
        role: z.enum(["partner", "accountant", "advisor"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.uow.team.findMemberById(
        input.memberId,
        ctx.portfolio.ownerId
      );
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await ctx.uow.team.changeRole(input.memberId, input.role);

      await ctx.uow.team.logAudit({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "role_changed",
        targetEmail: member.user?.email,
        metadata: JSON.stringify({ oldRole: member.role, newRole: input.role }),
      });

      return { success: true };
    }),

  removeMember: memberProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.uow.team.findMemberById(
        input.memberId,
        ctx.portfolio.ownerId
      );
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await ctx.uow.team.removeMember(input.memberId);

      await ctx.uow.team.logAudit({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "member_removed",
        targetEmail: member.user?.email,
      });

      return { success: true };
    }),

  getAccessiblePortfolios: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.team.getAccessiblePortfolios(ctx.user.id);
  }),

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
      return ctx.uow.team.getAuditLog(
        ctx.portfolio.ownerId,
        input.limit,
        input.offset
      );
    }),

  // Public procedure: instantiate repo from ctx.db (no UoW on public context)
  getInviteByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const repo = new TeamRepository(ctx.db);
      const invite = await repo.findInviteByToken(input.token);

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

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.uow.team.findInviteByTokenBasic(input.token);

      if (!invite || invite.status !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite" });
      }

      if (new Date() > invite.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      }

      if (invite.email.toLowerCase() !== ctx.user.email?.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite was sent to a different email address",
        });
      }

      await ctx.uow.team.acceptInvite(invite.id, {
        ownerId: invite.ownerId,
        userId: ctx.user.id,
        role: invite.role,
        invitedBy: invite.invitedBy,
        joinedAt: new Date(),
      });

      await ctx.uow.team.logAudit({
        ownerId: invite.ownerId,
        actorId: ctx.user.id,
        action: "invite_accepted",
        targetEmail: ctx.user.email,
      });

      return { success: true };
    }),

  declineInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.uow.team.findInviteByTokenBasic(input.token);

      if (!invite || invite.status !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite" });
      }

      await ctx.uow.team.declineInvite(invite.id);

      await ctx.uow.team.logAudit({
        ownerId: invite.ownerId,
        actorId: ctx.user.id,
        action: "invite_declined",
        targetEmail: ctx.user.email,
      });

      return { success: true };
    }),
});
