import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import {
  referralCodes,
  referrals,
  referralCredits,
  users,
} from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateReferralCode } from "../../services/referral";

export const referralRouter = router({
  // Get or create user's referral code
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    let [existing] = await ctx.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, ctx.user.id));

    if (!existing) {
      [existing] = await ctx.db
        .insert(referralCodes)
        .values({
          userId: ctx.user.id,
          code: generateReferralCode(),
        })
        .returning();
    }

    return {
      code: existing.code,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.propertytracker.com.au"}/r/${existing.code}`,
    };
  }),

  // Get referral stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [code] = await ctx.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, ctx.user.id));

    if (!code) {
      return { invited: 0, qualified: 0, totalCredits: 0 };
    }

    const myReferrals = await ctx.db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerUserId, ctx.user.id));

    const invited = myReferrals.length;
    const qualified = myReferrals.filter(
      (r) => r.status === "qualified" || r.status === "rewarded"
    ).length;

    const [creditResult] = await ctx.db
      .select({ total: sql<number>`coalesce(sum(${referralCredits.monthsFree}), 0)::int` })
      .from(referralCredits)
      .where(eq(referralCredits.userId, ctx.user.id));

    return {
      invited,
      qualified,
      totalCredits: creditResult?.total ?? 0,
    };
  }),

  // Get referral list (for settings page)
  listReferrals: protectedProcedure.query(async ({ ctx }) => {
    const myReferrals = await ctx.db
      .select({
        id: referrals.id,
        status: referrals.status,
        createdAt: referrals.createdAt,
        qualifiedAt: referrals.qualifiedAt,
        refereeName: users.name,
        refereeEmail: users.email,
      })
      .from(referrals)
      .leftJoin(users, eq(users.id, referrals.refereeUserId))
      .where(eq(referrals.referrerUserId, ctx.user.id))
      .orderBy(desc(referrals.createdAt));

    return myReferrals;
  }),

  // Resolve referral code (for /r/[code] page)
  resolveCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const [codeRecord] = await ctx.db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code));

      if (!codeRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid referral code",
        });
      }

      // Don't allow self-referral
      if (codeRecord.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot use your own referral code",
        });
      }

      return { valid: true };
    }),

  // Record a referral (called during signup when cookie is present)
  recordReferral: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [codeRecord] = await ctx.db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code));

      if (!codeRecord || codeRecord.userId === ctx.user.id) {
        return { recorded: false };
      }

      // Check if already referred
      const [existing] = await ctx.db
        .select()
        .from(referrals)
        .where(eq(referrals.refereeUserId, ctx.user.id));

      if (existing) {
        return { recorded: false };
      }

      await ctx.db.insert(referrals).values({
        referrerUserId: codeRecord.userId,
        refereeUserId: ctx.user.id,
        referralCodeId: codeRecord.id,
      });

      return { recorded: true };
    }),

  // Qualify referral (called when referee adds first property)
  qualifyReferral: protectedProcedure.mutation(async ({ ctx }) => {
    const [referral] = await ctx.db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.refereeUserId, ctx.user.id),
          eq(referrals.status, "pending")
        )
      );

    if (!referral) {
      return { qualified: false };
    }

    // Update status
    await ctx.db
      .update(referrals)
      .set({ status: "qualified", qualifiedAt: new Date() })
      .where(eq(referrals.id, referral.id));

    // Create credits for both users (1 month free each)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await ctx.db.insert(referralCredits).values([
      {
        userId: referral.referrerUserId,
        referralId: referral.id,
        monthsFree: 1,
        expiresAt,
      },
      {
        userId: referral.refereeUserId,
        referralId: referral.id,
        monthsFree: 1,
        expiresAt,
      },
    ]);

    return { qualified: true };
  }),
});
