import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  userOnboarding,
  properties,
  bankAccounts,
  transactions,
  recurringTransactions,
  propertyValues,
} from "../db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { calculateProgress, type OnboardingCounts } from "../services/onboarding";

export const onboardingRouter = router({
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    // Get or create onboarding record
    let onboarding = await ctx.db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, ctx.user.id),
    });

    if (!onboarding) {
      const [created] = await ctx.db
        .insert(userOnboarding)
        .values({ userId: ctx.user.id })
        .returning();
      onboarding = created;
    }

    // Get counts in parallel
    const [
      propertyResult,
      bankAccountResult,
      categorizedResult,
      recurringResult,
      propertyValueResult,
    ] = await Promise.all([
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(properties)
        .where(eq(properties.userId, ctx.user.id)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, ctx.user.id)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ctx.user.id),
            ne(transactions.category, "uncategorized")
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(recurringTransactions)
        .where(eq(recurringTransactions.userId, ctx.user.id)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(propertyValues)
        .where(eq(propertyValues.userId, ctx.user.id)),
    ]);

    const counts: OnboardingCounts = {
      propertyCount: propertyResult[0]?.count ?? 0,
      bankAccountCount: bankAccountResult[0]?.count ?? 0,
      categorizedCount: categorizedResult[0]?.count ?? 0,
      recurringCount: recurringResult[0]?.count ?? 0,
      propertyValueCount: propertyValueResult[0]?.count ?? 0,
    };

    const progress = calculateProgress(counts);

    return {
      ...onboarding,
      progress,
      showWizard: !onboarding.wizardDismissedAt && counts.propertyCount === 0,
      showChecklist:
        !onboarding.checklistDismissedAt && progress.completed < progress.total,
    };
  }),

  dismissWizard: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        wizardDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.user.id))
      .returning();

    return updated;
  }),

  dismissChecklist: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        checklistDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.user.id))
      .returning();

    return updated;
  }),

  markStepComplete: protectedProcedure
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const onboarding = await ctx.db.query.userOnboarding.findFirst({
        where: eq(userOnboarding.userId, ctx.user.id),
      });

      if (!onboarding) return null;

      const currentSteps = onboarding.completedSteps || [];
      if (currentSteps.includes(input.stepId)) {
        return onboarding;
      }

      const [updated] = await ctx.db
        .update(userOnboarding)
        .set({
          completedSteps: [...currentSteps, input.stepId],
          updatedAt: new Date(),
        })
        .where(eq(userOnboarding.userId, ctx.user.id))
        .returning();

      return updated;
    }),
});
