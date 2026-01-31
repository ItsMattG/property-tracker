import { router, protectedProcedure } from "../trpc";
import {
  properties,
  transactions,
  connectionAlerts,
  userOnboarding,
  bankAccounts,
  recurringTransactions,
  propertyValues,
} from "../db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { calculateProgress, type OnboardingCounts } from "../services/onboarding";

export const dashboardRouter = router({
  getInitialData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.portfolio.ownerId;

    const [statsResult, alertsResult, onboardingResult, propertiesResult] =
      await Promise.all([
        // Stats - same as stats.dashboard
        Promise.all([
          ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(properties)
            .where(eq(properties.userId, userId)),
          ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(eq(transactions.userId, userId)),
          ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(
              and(
                eq(transactions.userId, userId),
                eq(transactions.category, "uncategorized")
              )
            ),
        ]).then(([props, txns, uncategorized]) => ({
          propertyCount: props[0]?.count ?? 0,
          transactionCount: txns[0]?.count ?? 0,
          uncategorizedCount: uncategorized[0]?.count ?? 0,
        })),

        // Alerts - same as banking.listAlerts
        ctx.db.query.connectionAlerts.findMany({
          where: and(
            eq(connectionAlerts.userId, userId),
            eq(connectionAlerts.status, "active")
          ),
          with: {
            bankAccount: true,
          },
          orderBy: (alerts, { desc }) => [desc(alerts.createdAt)],
        }),

        // Onboarding - same as onboarding.getProgress
        (async () => {
          let onboarding = await ctx.db.query.userOnboarding.findFirst({
            where: eq(userOnboarding.userId, userId),
          });

          if (!onboarding) {
            const [created] = await ctx.db
              .insert(userOnboarding)
              .values({ userId })
              .returning();
            onboarding = created;
          }

          // Get counts in parallel for progress calculation
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
              .where(eq(properties.userId, userId)),
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(bankAccounts)
              .where(eq(bankAccounts.userId, userId)),
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, userId),
                  ne(transactions.category, "uncategorized")
                )
              ),
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(recurringTransactions)
              .where(eq(recurringTransactions.userId, userId)),
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(propertyValues)
              .where(eq(propertyValues.userId, userId)),
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
            showWizard:
              !onboarding.wizardDismissedAt && counts.propertyCount === 0,
            showChecklist:
              !onboarding.checklistDismissedAt &&
              progress.completed < progress.total,
            completedTours: onboarding.completedTours || [],
            toursDisabled: onboarding.toursDisabled ?? false,
          };
        })(),

        // Properties - same as property.list
        ctx.db.query.properties.findMany({
          where: eq(properties.userId, userId),
          orderBy: (properties, { desc }) => [desc(properties.createdAt)],
        }),
      ]);

    return {
      stats: statsResult,
      alerts: alertsResult,
      onboarding: onboardingResult,
      properties: propertiesResult,
    };
  }),
});
