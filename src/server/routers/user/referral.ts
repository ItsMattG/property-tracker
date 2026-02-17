import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { generateReferralCode } from "../../services/user/referral";

export const referralRouter = router({
  // Get or create user's referral code
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    let existing = await ctx.uow.referral.findCodeByUserId(ctx.user.id);

    if (!existing) {
      existing = await ctx.uow.referral.createCode(ctx.user.id, generateReferralCode());
    }

    return {
      code: existing.code,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.bricktrack.au"}/r/${existing.code}`,
    };
  }),

  // Get referral stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const code = await ctx.uow.referral.findCodeByUserId(ctx.user.id);

    if (!code) {
      return { invited: 0, qualified: 0, totalCredits: 0 };
    }

    const myReferrals = await ctx.uow.referral.findByReferrer(ctx.user.id);

    const invited = myReferrals.length;
    const qualified = myReferrals.filter(
      (r) => r.status === "qualified" || r.status === "rewarded"
    ).length;

    const totalCredits = await ctx.uow.referral.getCreditsTotal(ctx.user.id);

    return { invited, qualified, totalCredits };
  }),

  // Get referral list (for settings page)
  listReferrals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.referral.findByReferrer(ctx.user.id);
  }),

  // Get comprehensive referral details for the dashboard
  getReferralDetails: protectedProcedure.query(async ({ ctx }) => {
    let codeRecord = await ctx.uow.referral.findCodeByUserId(ctx.user.id);

    if (!codeRecord) {
      codeRecord = await ctx.uow.referral.createCode(
        ctx.user.id,
        generateReferralCode()
      );
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.bricktrack.au"}/r/${codeRecord.code}`;

    const [referralList, totalCredits, pendingCount] = await Promise.all([
      ctx.uow.referral.findByReferrer(ctx.user.id),
      ctx.uow.referral.getCreditsTotal(ctx.user.id),
      ctx.uow.referral.getPendingCount(ctx.user.id),
    ]);

    const qualified = referralList.filter(
      (r) => r.status === "qualified" || r.status === "rewarded"
    ).length;

    return {
      code: codeRecord.code,
      shareUrl,
      referrals: referralList.map((r) => ({
        id: r.id,
        displayName: r.refereeName || r.refereeEmail || "Anonymous",
        status: r.status,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
      })),
      stats: {
        invited: referralList.length,
        qualified,
        pending: pendingCount,
        totalCreditsEarned: totalCredits,
      },
      bannerCopy: {
        headline: "Give a month, get a month",
        description:
          "Invite a friend to BrickTrack. When they add their first property, you both get 1 month of Pro free.",
      },
    };
  }),

  // Resolve referral code (for /r/[code] page)
  resolveCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const codeRecord = await ctx.uow.referral.resolveCode(input.code);

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
      const codeRecord = await ctx.uow.referral.resolveCode(input.code);

      if (!codeRecord || codeRecord.userId === ctx.user.id) {
        return { recorded: false };
      }

      // Check if already referred
      const existing = await ctx.uow.referral.findByReferee(ctx.user.id);

      if (existing) {
        return { recorded: false };
      }

      await ctx.uow.referral.createReferral({
        referrerUserId: codeRecord.userId,
        refereeUserId: ctx.user.id,
        referralCodeId: codeRecord.id,
      });

      return { recorded: true };
    }),

  // Qualify referral (called when referee adds first property)
  qualifyReferral: protectedProcedure.mutation(async ({ ctx }) => {
    const referral = await ctx.uow.referral.findByReferee(ctx.user.id);

    if (!referral || referral.status !== "pending") {
      return { qualified: false };
    }

    // Update status
    await ctx.uow.referral.qualifyReferral(referral.id);

    // Create credits for both users (1 month free each)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await ctx.uow.referral.createCredits([
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
