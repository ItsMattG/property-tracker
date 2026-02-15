import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  bankAccounts,
  transactions,
  recurringTransactions,
  propertyValues,
} from "../../db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { calculateProgress, type OnboardingCounts } from "../../services/user/onboarding";

export const onboardingRouter = router({
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;

    // Get or create onboarding record
    let onboarding = await ctx.uow.user.findOnboarding(ownerId);

    if (!onboarding) {
      onboarding = await ctx.uow.user.createOnboarding(ownerId);
    }

    // Get counts in parallel — property count via repo, remaining via ctx.db
    // Cross-domain: bankAccounts, transactions, recurring, propertyValues have no count methods in their repos
    const [
      propertyCount,
      bankAccountResult,
      categorizedResult,
      recurringResult,
      propertyValueResult,
    ] = await Promise.all([
      ctx.uow.property.countByOwner(ownerId),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, ownerId)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ownerId),
            ne(transactions.category, "uncategorized")
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(recurringTransactions)
        .where(eq(recurringTransactions.userId, ownerId)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(propertyValues)
        .where(eq(propertyValues.userId, ownerId)),
    ]);

    const counts: OnboardingCounts = {
      propertyCount,
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
      completedTours: onboarding.completedTours || [],
      toursDisabled: onboarding.toursDisabled ?? false,
    };
  }),

  dismissWizard: writeProcedure.mutation(async ({ ctx }) => {
    return ctx.uow.user.updateOnboarding(ctx.portfolio.ownerId, {
      wizardDismissedAt: new Date(),
      updatedAt: new Date(),
    });
  }),

  dismissChecklist: writeProcedure.mutation(async ({ ctx }) => {
    return ctx.uow.user.updateOnboarding(ctx.portfolio.ownerId, {
      checklistDismissedAt: new Date(),
      updatedAt: new Date(),
    });
  }),

  markStepComplete: writeProcedure
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const onboarding = await ctx.uow.user.findOnboarding(ctx.portfolio.ownerId);

      if (!onboarding) return null;

      const currentSteps = onboarding.completedSteps || [];
      if (currentSteps.includes(input.stepId)) {
        return onboarding;
      }

      return ctx.uow.user.updateOnboarding(ctx.portfolio.ownerId, {
        completedSteps: [...currentSteps, input.stepId],
        updatedAt: new Date(),
      });
    }),

  completeTour: writeProcedure
    .input(z.object({ tourId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const onboarding = await ctx.uow.user.findOnboarding(ctx.portfolio.ownerId);

      if (!onboarding) return null;

      const currentTours = onboarding.completedTours || [];
      if (currentTours.includes(input.tourId)) {
        return onboarding;
      }

      return ctx.uow.user.updateOnboarding(ctx.portfolio.ownerId, {
        completedTours: [...currentTours, input.tourId],
        updatedAt: new Date(),
      });
    }),

  disableTours: writeProcedure.mutation(async ({ ctx }) => {
    return ctx.uow.user.updateOnboarding(ctx.portfolio.ownerId, {
      toursDisabled: true,
      updatedAt: new Date(),
    });
  }),
});
