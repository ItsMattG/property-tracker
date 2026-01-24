import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
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
      where: eq(userOnboarding.userId, ctx.portfolio.ownerId),
    });

    if (!onboarding) {
      const [created] = await ctx.db
        .insert(userOnboarding)
        .values({ userId: ctx.portfolio.ownerId })
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
        .where(eq(properties.userId, ctx.portfolio.ownerId)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, ctx.portfolio.ownerId)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ctx.portfolio.ownerId),
            ne(transactions.category, "uncategorized")
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(recurringTransactions)
        .where(eq(recurringTransactions.userId, ctx.portfolio.ownerId)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(propertyValues)
        .where(eq(propertyValues.userId, ctx.portfolio.ownerId)),
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

  dismissWizard: writeProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        wizardDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.portfolio.ownerId))
      .returning();

    return updated;
  }),

  dismissChecklist: writeProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        checklistDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.portfolio.ownerId))
      .returning();

    return updated;
  }),

  markStepComplete: writeProcedure
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const onboarding = await ctx.db.query.userOnboarding.findFirst({
        where: eq(userOnboarding.userId, ctx.portfolio.ownerId),
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
        .where(eq(userOnboarding.userId, ctx.portfolio.ownerId))
        .returning();

      return updated;
    }),
});
