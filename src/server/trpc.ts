import { initTRPC, TRPCError } from "@trpc/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "./db";
import { users, portfolioMembers } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { type PortfolioRole, getPermissions } from "./services/portfolio-access";
import { verifyMobileToken } from "./lib/mobile-jwt";
import { axiomMetrics, flushAxiom } from "@/lib/axiom";
import { logger, setLogContext, clearLogContext } from "@/lib/logger";

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

  // Extract request ID from headers for correlation
  const requestId = opts?.headers?.get("x-request-id") || undefined;

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
    requestId,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

// Observability middleware - tracks timing and logs for all procedures
const observabilityMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const start = Date.now();

  // Set log context for this request
  setLogContext({ requestId: ctx.requestId });

  try {
    const result = await next({ ctx });
    const duration = Date.now() - start;

    // Track successful request
    axiomMetrics.timing("api.request.duration", duration, {
      path,
      type,
      status: "success",
    });
    axiomMetrics.increment("api.request.count", { path, type, status: "success" });

    logger.debug("tRPC request completed", { path, type, duration });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    // Track failed request
    axiomMetrics.timing("api.request.duration", duration, {
      path,
      type,
      status: "error",
    });
    axiomMetrics.increment("api.request.count", { path, type, status: "error" });
    axiomMetrics.increment("api.error.count", {
      path,
      type,
      errorType: error instanceof TRPCError ? error.code : "UNKNOWN",
    });

    logger.warn("tRPC request failed", { path, type, duration, error: String(error) });

    throw error;
  } finally {
    clearLogContext();
    // Flush Axiom at end of request
    await flushAxiom();
  }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(observabilityMiddleware);
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(observabilityMiddleware).use(async ({ ctx, next }) => {
  // Try Clerk auth first (web)
  if (ctx.clerkId) {
    let user = await ctx.db.query.users.findFirst({
      where: eq(users.clerkId, ctx.clerkId),
    });

    // Auto-create user if they exist in Clerk but not in our database
    // This handles cases where the webhook didn't fire (e.g., local development)
    if (!user) {
      logger.info("User not found in DB, attempting auto-create", { clerkId: ctx.clerkId });
      try {
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(ctx.clerkId);
        logger.debug("Got Clerk user", { emails: clerkUser.emailAddresses.map(e => e.emailAddress) });
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
          logger.info("Auto-created user", { email: primaryEmail.emailAddress });
        }
      } catch (error) {
        logger.error("Failed to auto-create user", error);
      }
    }

    // Add userId to log context once we have the user
    if (user) {
      setLogContext({ requestId: ctx.requestId, userId: user.id });
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
        // Add userId to log context for mobile auth
        setLogContext({ requestId: ctx.requestId, userId: user.id });

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
