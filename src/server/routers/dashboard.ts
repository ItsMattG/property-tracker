import { router, protectedProcedure } from "../trpc";
import {
  properties,
  transactions,
  connectionAlerts,
  userOnboarding,
  bankAccounts,
  recurringTransactions,
  propertyValues,
  loans,
} from "../db/schema";
import { eq, and, ne, sql, gte, lt, inArray, desc } from "drizzle-orm";
import { calculateProgress, type OnboardingCounts } from "../services/onboarding";

export const dashboardRouter = router({
  getInitialData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.portfolio.ownerId;

    const [statsResult, alertsResult, onboardingResult, propertiesResult, trendsResult] =
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

        // Trends - month-over-month comparisons
        (async () => {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

          // Format as YYYY-MM-DD strings for text date comparisons
          const currentMonthStr = startOfMonth.toISOString().slice(0, 10);
          const prevMonthStr = startOfPrevMonth.toISOString().slice(0, 10);

          // Property count trend: current active vs active before start of current month
          const activeProperties = await ctx.db
            .select({ id: properties.id, createdAt: properties.createdAt, purchasePrice: properties.purchasePrice })
            .from(properties)
            .where(
              and(
                eq(properties.userId, userId),
                eq(properties.status, "active")
              )
            );

          const currentPropertyCount = activeProperties.length;
          const previousPropertyCount = activeProperties.filter(
            (p) => p.createdAt < startOfMonth
          ).length;

          // Transaction count trend: current month vs previous month
          const [currentTxns, prevTxns] = await Promise.all([
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, userId),
                  gte(transactions.date, currentMonthStr)
                )
              ),
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, userId),
                  gte(transactions.date, prevMonthStr),
                  lt(transactions.date, currentMonthStr)
                )
              ),
          ]);

          // Uncategorized count trend: current month vs previous month
          const [currentUncat, prevUncat] = await Promise.all([
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, userId),
                  eq(transactions.category, "uncategorized"),
                  gte(transactions.date, currentMonthStr)
                )
              ),
            ctx.db
              .select({ count: sql<number>`count(*)::int` })
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, userId),
                  eq(transactions.category, "uncategorized"),
                  gte(transactions.date, prevMonthStr),
                  lt(transactions.date, currentMonthStr)
                )
              ),
          ]);

          // Portfolio value and equity
          const activePropertyIds = activeProperties.map((p) => p.id);

          let currentPortfolioValue = 0;
          let previousPortfolioValue: number | null = null;

          if (activePropertyIds.length > 0) {
            // Current: latest estimated_value per active property (DISTINCT ON)
            const currentValues = await ctx.db
              .selectDistinctOn([propertyValues.propertyId], {
                propertyId: propertyValues.propertyId,
                estimatedValue: propertyValues.estimatedValue,
              })
              .from(propertyValues)
              .where(
                and(
                  eq(propertyValues.userId, userId),
                  inArray(propertyValues.propertyId, activePropertyIds)
                )
              )
              .orderBy(
                propertyValues.propertyId,
                desc(propertyValues.valueDate),
                desc(propertyValues.createdAt)
              );

            // Build map of latest valuations, fall back to purchasePrice
            const valuationMap = new Map<string, number>();
            for (const row of currentValues) {
              valuationMap.set(row.propertyId, parseFloat(row.estimatedValue || "0"));
            }
            currentPortfolioValue = activeProperties.reduce(
              (sum, p) => sum + (valuationMap.get(p.id) || parseFloat(p.purchasePrice || "0")),
              0
            );

            // Previous: latest value per property before start of current month
            const prevValues = await ctx.db
              .selectDistinctOn([propertyValues.propertyId], {
                propertyId: propertyValues.propertyId,
                estimatedValue: propertyValues.estimatedValue,
              })
              .from(propertyValues)
              .where(
                and(
                  eq(propertyValues.userId, userId),
                  inArray(propertyValues.propertyId, activePropertyIds),
                  lt(propertyValues.valueDate, currentMonthStr)
                )
              )
              .orderBy(
                propertyValues.propertyId,
                desc(propertyValues.valueDate),
                desc(propertyValues.createdAt)
              );

            // For previous period, fall back to purchasePrice for properties without prior valuations
            const prevValuationMap = new Map<string, number>();
            for (const row of prevValues) {
              prevValuationMap.set(row.propertyId, parseFloat(row.estimatedValue || "0"));
            }
            // Only compute previous if at least some properties existed before this month
            const propertiesBeforeMonth = activeProperties.filter(p => p.createdAt < startOfMonth);
            if (propertiesBeforeMonth.length > 0) {
              previousPortfolioValue = propertiesBeforeMonth.reduce(
                (sum, p) => sum + (prevValuationMap.get(p.id) || parseFloat(p.purchasePrice || "0")),
                0
              );
            }
          }

          // Total debt from loans on active properties
          let totalDebt = 0;
          if (activePropertyIds.length > 0) {
            const debtResult = await ctx.db
              .select({
                total: sql<string>`coalesce(sum(${loans.currentBalance}), 0)`,
              })
              .from(loans)
              .where(
                and(
                  eq(loans.userId, userId),
                  inArray(loans.propertyId, activePropertyIds)
                )
              );
            totalDebt = parseFloat(debtResult[0]?.total || "0");
          }

          const currentEquity = currentPortfolioValue - totalDebt;
          const previousEquity =
            previousPortfolioValue !== null
              ? previousPortfolioValue - totalDebt
              : null;

          return {
            propertyCount: {
              current: currentPropertyCount,
              previous: previousPropertyCount,
            },
            transactionCount: {
              current: currentTxns[0]?.count ?? 0,
              previous: prevTxns[0]?.count ?? 0,
            },
            uncategorizedCount: {
              current: currentUncat[0]?.count ?? 0,
              previous: prevUncat[0]?.count ?? 0,
            },
            portfolioValue: {
              current: currentPortfolioValue,
              previous: previousPortfolioValue,
            },
            totalEquity: {
              current: currentEquity,
              previous: previousEquity,
            },
          };
        })(),
      ]);

    return {
      stats: statsResult,
      alerts: alertsResult,
      onboarding: onboardingResult,
      properties: propertiesResult,
      trends: trendsResult,
    };
  }),
});
