import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "./db";
import { users, portfolioMembers } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { type PortfolioRole, getPermissions } from "./services/portfolio-access";

export interface PortfolioContext {
  ownerId: string;
  role: PortfolioRole;
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewAuditLog: boolean;
  canUploadDocuments: boolean;
}

export const createTRPCContext = async () => {
  const { userId: clerkId } = await auth();
  const cookieStore = await cookies();
  const portfolioOwnerId = cookieStore.get("portfolio_owner_id")?.value;

  return {
    db,
    clerkId,
    portfolioOwnerId,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.clerkId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.clerkId),
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found. Please sign out and sign in again.",
    });
  }

  // Resolve portfolio context
  let portfolio: PortfolioContext;

  if (ctx.portfolioOwnerId && ctx.portfolioOwnerId !== user.id) {
    // Viewing someone else's portfolio - check membership
    const membership = await ctx.db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.ownerId, ctx.portfolioOwnerId),
        eq(portfolioMembers.userId, user.id)
      ),
    });

    if (!membership || !membership.joinedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this portfolio",
      });
    }

    const perms = getPermissions(membership.role);
    portfolio = {
      ownerId: ctx.portfolioOwnerId,
      role: membership.role,
      ...perms,
    };
  } else {
    // Viewing own portfolio
    portfolio = {
      ownerId: user.id,
      role: "owner",
      canWrite: true,
      canManageMembers: true,
      canManageBanks: true,
      canViewAuditLog: true,
      canUploadDocuments: true,
    };
  }

  return next({
    ctx: {
      ...ctx,
      user,
      portfolio,
    },
  });
});

// Procedure that requires write access
export const writeProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.portfolio.canWrite) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have write access to this portfolio",
    });
  }
  return next({ ctx });
});

// Procedure that requires member management access
export const memberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.portfolio.canManageMembers) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the portfolio owner can manage team members",
    });
  }
  return next({ ctx });
});

// Procedure that requires bank management access
export const bankProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.portfolio.canManageBanks) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to manage bank connections",
    });
  }
  return next({ ctx });
});
