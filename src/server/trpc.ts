import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const createTRPCContext = async () => {
  const { userId: clerkId } = await auth();

  return {
    db,
    clerkId,
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

  // Get or create user in our database
  const user = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.clerkId),
  });

  if (!user) {
    // User will be created via webhook, but handle edge case
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found. Please sign out and sign in again.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});
