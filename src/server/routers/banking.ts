import { z } from "zod";
import { router, protectedProcedure, writeProcedure, bankProcedure } from "../trpc";
import { anomalyAlerts, bankAccounts, connectionAlerts, transactions } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { batchCategorize } from "../services/categorization";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, mapBasiqErrorToAlertType, mapAlertTypeToConnectionStatus } from "../services/sync";
import { shouldCreateAlert } from "../services/alerts";
import { basiqService } from "../services/basiq";
import {
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  getHistoricalAverage,
  getKnownMerchants,
} from "../services/anomaly";
import { metrics } from "@/lib/metrics";
import { axiomMetrics } from "@/lib/axiom";
import { logger } from "@/lib/logger";

export const bankingRouter = router({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bankAccounts.findMany({
      where: eq(bankAccounts.userId, ctx.portfolio.ownerId),
      with: {
        defaultProperty: true,
        alerts: {
          where: eq(connectionAlerts.status, "active"),
        },
      },
    });
  }),

  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.query.bankAccounts.findMany({
      where: eq(bankAccounts.userId, ctx.portfolio.ownerId),
      with: {
        alerts: {
          where: eq(connectionAlerts.status, "active"),
        },
      },
    });

    return accounts.map((account) => ({
      id: account.id,
      accountName: account.accountName,
      institution: account.institution,
      connectionStatus: account.connectionStatus,
      lastSyncStatus: account.lastSyncStatus,
      lastSyncedAt: account.lastSyncedAt,
      lastManualSyncAt: account.lastManualSyncAt,
      activeAlertCount: account.alerts.length,
    }));
  }),

  syncAccount: bankProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify account belongs to user
      const account = await ctx.db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.id, input.accountId),
          eq(bankAccounts.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Check rate limit
      const rateLimitResult = checkRateLimit(account.lastManualSyncAt);
      if (!rateLimitResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitResult.message,
          cause: { retryAfter: rateLimitResult.retryAfter },
        });
      }

      // Update sync status to pending
      await ctx.db
        .update(bankAccounts)
        .set({
          lastManualSyncAt: new Date(),
          lastSyncStatus: "pending",
        })
        .where(eq(bankAccounts.id, input.accountId));

      const syncStartTime = Date.now();
      logger.info("Bank sync started", { accountId: input.accountId, institution: account.institution });

      try {
        // Refresh connection via Basiq
        await basiqService.refreshConnection(account.basiqConnectionId);

        // Fetch new transactions
        const fromDate = account.lastSyncedAt?.toISOString().split("T")[0];
        const { data: basiqTransactions } = await basiqService.getTransactions(
          ctx.portfolio.ownerId,
          account.basiqAccountId,
          fromDate
        );

        // Insert new transactions (skip duplicates via unique constraint)
        let transactionsAdded = 0;
        for (const txn of basiqTransactions) {
          try {
            await ctx.db.insert(transactions).values({
              userId: ctx.portfolio.ownerId,
              bankAccountId: account.id,
              basiqTransactionId: txn.id,
              propertyId: account.defaultPropertyId,
              date: txn.postDate,
              description: txn.description,
              amount: txn.direction === "credit" ? txn.amount : `-${txn.amount}`,
              transactionType: txn.direction === "credit" ? "income" : "expense",
            });
            transactionsAdded++;
          } catch {
            // Skip duplicates
          }
        }

        // Run anomaly detection on new transactions
        if (transactionsAdded > 0) {
          const recentTxns = await ctx.db.query.transactions.findMany({
            where: and(
              eq(transactions.userId, ctx.portfolio.ownerId),
              eq(transactions.bankAccountId, account.id)
            ),
            orderBy: [desc(transactions.createdAt)],
            limit: 100,
          });

          const knownMerchants = await getKnownMerchants(
            ctx.db,
            ctx.portfolio.ownerId,
            account.defaultPropertyId ?? undefined
          );

          for (const txn of basiqTransactions.slice(0, transactionsAdded)) {
            const txnInput = {
              id: txn.id,
              amount: txn.direction === "credit" ? txn.amount : `-${txn.amount}`,
              description: txn.description,
              date: txn.postDate,
            };

            // Check for unusual amount
            const historical = await getHistoricalAverage(
              ctx.db,
              ctx.portfolio.ownerId,
              txn.description.split(" ")[0]
            );
            const unusualResult = detectUnusualAmount(txnInput, historical);
            if (unusualResult) {
              await ctx.db.insert(anomalyAlerts).values({
                userId: ctx.portfolio.ownerId,
                propertyId: account.defaultPropertyId,
                ...unusualResult,
              });
            }

            // Check for duplicates
            const duplicateResult = detectDuplicates(
              txnInput,
              recentTxns.map((t) => ({
                id: t.id,
                amount: t.amount,
                description: t.description,
                date: t.date,
              }))
            );
            if (duplicateResult) {
              await ctx.db.insert(anomalyAlerts).values({
                userId: ctx.portfolio.ownerId,
                propertyId: account.defaultPropertyId,
                ...duplicateResult,
              });
            }

            // Check for unexpected expense
            const unexpectedResult = detectUnexpectedExpense(txnInput, knownMerchants);
            if (unexpectedResult) {
              await ctx.db.insert(anomalyAlerts).values({
                userId: ctx.portfolio.ownerId,
                propertyId: account.defaultPropertyId,
                ...unexpectedResult,
              });
            }
          }

          // Run AI categorization on new uncategorized transactions
          const uncategorizedTxns = await ctx.db.query.transactions.findMany({
            where: and(
              eq(transactions.userId, ctx.portfolio.ownerId),
              eq(transactions.bankAccountId, account.id),
              eq(transactions.category, "uncategorized"),
              sql`${transactions.suggestionStatus} IS NULL`
            ),
            orderBy: [desc(transactions.createdAt)],
            limit: 50,
          });

          if (uncategorizedTxns.length > 0) {
            await batchCategorize(
              ctx.portfolio.ownerId,
              uncategorizedTxns.map((t) => ({
                id: t.id,
                description: t.description,
                amount: parseFloat(t.amount),
              }))
            );
          }
        }

        // Update account status to success
        await ctx.db
          .update(bankAccounts)
          .set({
            connectionStatus: "connected",
            lastSyncStatus: "success",
            lastSyncError: null,
            lastSyncedAt: new Date(),
          })
          .where(eq(bankAccounts.id, input.accountId));

        // Resolve any active alerts
        await ctx.db
          .update(connectionAlerts)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
          })
          .where(
            and(
              eq(connectionAlerts.bankAccountId, input.accountId),
              eq(connectionAlerts.status, "active")
            )
          );

        // Track successful sync for monitoring
        const syncDuration = Date.now() - syncStartTime;
        metrics.bankSyncSuccess(input.accountId, transactionsAdded);
        axiomMetrics.timing("bank_sync.duration", syncDuration, {
          accountId: input.accountId,
          institution: account.institution,
          status: "success",
        });
        axiomMetrics.increment("bank_sync.transactions", { accountId: input.accountId }, transactionsAdded);
        logger.info("Bank sync completed", {
          accountId: input.accountId,
          transactionsAdded,
          duration: syncDuration,
        });

        return { success: true, transactionsAdded };
      } catch (error) {
        // Determine error type and create alert
        const statusCode = (error as { status?: number }).status || 500;
        const alertType = mapBasiqErrorToAlertType(statusCode);
        const connectionStatus = mapAlertTypeToConnectionStatus(alertType);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Update account status
        await ctx.db
          .update(bankAccounts)
          .set({
            connectionStatus,
            lastSyncStatus: "failed",
            lastSyncError: errorMessage,
          })
          .where(eq(bankAccounts.id, input.accountId));

        // Check if we should create a new alert
        const activeAlerts = await ctx.db.query.connectionAlerts.findMany({
          where: and(
            eq(connectionAlerts.bankAccountId, input.accountId),
            eq(connectionAlerts.status, "active")
          ),
        });

        if (shouldCreateAlert(activeAlerts, alertType)) {
          await ctx.db.insert(connectionAlerts).values({
            userId: ctx.portfolio.ownerId,
            bankAccountId: input.accountId,
            alertType,
            errorMessage,
          });
        }

        // Track failed sync for monitoring
        const syncDuration = Date.now() - syncStartTime;
        metrics.bankSyncFailed(input.accountId, errorMessage);
        axiomMetrics.timing("bank_sync.duration", syncDuration, {
          accountId: input.accountId,
          institution: account.institution,
          status: "failed",
          errorType: alertType,
        });
        axiomMetrics.increment("bank_sync.failed", { accountId: input.accountId, errorType: alertType });
        logger.warn("Bank sync failed", {
          accountId: input.accountId,
          error: errorMessage,
          alertType,
          duration: syncDuration,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Sync failed: ${errorMessage}`,
        });
      }
    }),

  listAlerts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.connectionAlerts.findMany({
      where: and(
        eq(connectionAlerts.userId, ctx.portfolio.ownerId),
        eq(connectionAlerts.status, "active")
      ),
      with: {
        bankAccount: true,
      },
      orderBy: [desc(connectionAlerts.createdAt)],
    });
  }),

  dismissAlert: writeProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [alert] = await ctx.db
        .update(connectionAlerts)
        .set({
          status: "dismissed",
          dismissedAt: new Date(),
        })
        .where(
          and(
            eq(connectionAlerts.id, input.alertId),
            eq(connectionAlerts.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),

  linkAccountToProperty: writeProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        propertyId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .update(bankAccounts)
        .set({
          defaultPropertyId: input.propertyId,
        })
        .where(
          and(
            eq(bankAccounts.id, input.accountId),
            eq(bankAccounts.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      return account;
    }),

  reconnect: bankProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.id, input.accountId),
          eq(bankAccounts.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Generate new auth link via Basiq
      const { links } = await basiqService.createAuthLink(ctx.portfolio.ownerId);

      return { url: links.public };
    }),
});
