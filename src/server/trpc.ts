import { initTRPC, TRPCError } from "@trpc/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "./db";
import { users, portfolioMembers } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { type PortfolioRole, getPermissions } from "./services/portfolio-access";
import { verifyMobileToken } from "./lib/mobile-jwt";

export interface PortfolioContext {
  ownerId: string;
  role: PortfolioRole;
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewAuditLog: boolean;
  canUploadDocuments: boolean;
}

export const createTRPCContext = async (opts?: { headers?: Headers }) => {
  let clerkId: string | null = null;
  let portfolioOwnerId: string | undefined;

  // Try Clerk auth - this will fail for routes excluded from clerkMiddleware
  // (like mobile auth routes), which is expected
  try {
    const authResult = await auth();
    clerkId = authResult.userId;
    const cookieStore = await cookies();
    portfolioOwnerId = cookieStore.get("portfolio_owner_id")?.value;
  } catch {
    // Clerk middleware didn't run - expected for mobile auth routes
    // These routes use JWT auth handled in protectedProcedure instead
    clerkId = null;
  }

  return {
    db,
    clerkId,
    portfolioOwnerId,
    headers: opts?.headers,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Try Clerk auth first (web)
  if (ctx.clerkId) {
    let user = await ctx.db.query.users.findFirst({
      where: eq(users.clerkId, ctx.clerkId),
    });

    // Auto-create user if they exist in Clerk but not in our database
    // This handles cases where the webhook didn't fire (e.g., local development)
    if (!user) {
      console.log("[trpc] User not found in DB, attempting auto-create for clerkId:", ctx.clerkId);
      try {
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(ctx.clerkId);
        console.log("[trpc] Got Clerk user:", clerkUser.emailAddresses.map(e => e.emailAddress));
        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        );

        if (primaryEmail) {
          const name = [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || null;

          const [newUser] = await ctx.db
            .insert(users)
            .values({
              clerkId: ctx.clerkId,
              email: primaryEmail.emailAddress.toLowerCase(),
              name,
            })
            .returning();

          user = newUser;
          console.log("[trpc] Auto-created user:", primaryEmail.emailAddress);
        }
      } catch (error) {
        console.error("[trpc] Failed to auto-create user:", error);
      }
    }

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
  }

  // Fall back to JWT auth (mobile)
  const authHeader = ctx.headers?.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const payload = verifyMobileToken(token);
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, payload.userId),
      });

      if (user) {
        // For mobile, always use user's own portfolio
        const portfolio: PortfolioContext = {
          ownerId: user.id,
          role: "owner",
          canWrite: true,
          canManageMembers: true,
          canManageBanks: true,
          canViewAuditLog: true,
          canUploadDocuments: true,
        };

        return next({ ctx: { ...ctx, user, portfolio } });
      }
    } catch {
      // Invalid JWT - fall through to unauthorized
    }
  }

  throw new TRPCError({ code: "UNAUTHORIZED" });
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
