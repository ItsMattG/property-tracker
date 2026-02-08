import { z } from "zod";
import { router, protectedProcedure, writeProcedure, bankProcedure } from "../trpc";
import { anomalyAlerts, bankAccounts, connectionAlerts, properties, transactions, users } from "../db/schema";
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

      // Look up stored basiqUserId for API calls
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
      });

      if (!user?.basiqUserId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Basiq account linked. Please connect your bank first.",
        });
      }

      try {
        // Refresh connection via Basiq
        await basiqService.refreshConnection(account.basiqConnectionId);

        // Fetch new transactions
        const fromDate = account.lastSyncedAt?.toISOString().split("T")[0];
        const { data: basiqTransactions } = await basiqService.getTransactions(
          user.basiqUserId,
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

          // Collect all anomaly alerts to batch insert
          type AnomalyAlertInsert = typeof anomalyAlerts.$inferInsert;
          const anomalyAlertsToInsert: AnomalyAlertInsert[] = [];

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
              anomalyAlertsToInsert.push({
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
              anomalyAlertsToInsert.push({
                userId: ctx.portfolio.ownerId,
                propertyId: account.defaultPropertyId,
                ...duplicateResult,
              });
            }

            // Check for unexpected expense
            const unexpectedResult = detectUnexpectedExpense(txnInput, knownMerchants);
            if (unexpectedResult) {
              anomalyAlertsToInsert.push({
                userId: ctx.portfolio.ownerId,
                propertyId: account.defaultPropertyId,
                ...unexpectedResult,
              });
            }
          }

          // Batch insert all anomaly alerts at once
          if (anomalyAlertsToInsert.length > 0) {
            await ctx.db.insert(anomalyAlerts).values(anomalyAlertsToInsert);
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

  renameInstitution: writeProcedure
    .input(
      z.object({
        institution: z.string(),
        nickname: z.string().trim().max(100).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(bankAccounts)
        .set({
          institutionNickname: input.nickname || null,
        })
        .where(
          and(
            eq(bankAccounts.institution, input.institution),
            eq(bankAccounts.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),

  renameAccount: writeProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        nickname: z.string().trim().max(100).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .update(bankAccounts)
        .set({
          nickname: input.nickname || null,
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

  removeAccount: writeProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const account = await ctx.db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.id, input.accountId),
          eq(bankAccounts.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Delete bank account — transactions and connection_alerts cascade-delete via FK
      await ctx.db.delete(bankAccounts).where(eq(bankAccounts.id, input.accountId));

      return { success: true };
    }),

  processConnection: bankProcedure
    .input(z.object({ jobIds: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      // Look up stored basiqUserId
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
      });

      if (!user?.basiqUserId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Basiq account linked.",
        });
      }

      // Fetch accounts from Basiq
      const { data: basiqAccounts } = await basiqService.getAccounts(user.basiqUserId);

      // Get existing accounts to avoid duplicates
      const existingAccounts = await ctx.db.query.bankAccounts.findMany({
        where: eq(bankAccounts.userId, ctx.portfolio.ownerId),
      });
      const existingBasiqIds = new Set(existingAccounts.map((a) => a.basiqAccountId));

      let accountsAdded = 0;
      const newAccounts: Array<{ id: string; accountName: string; institution: string; accountType: string }> = [];

      for (const acct of basiqAccounts) {
        if (existingBasiqIds.has(acct.id)) continue;

        const accountType = (["transaction", "savings", "mortgage", "offset", "credit_card", "line_of_credit"].includes(acct.class?.type)
          ? acct.class.type
          : "transaction") as "transaction";

        const [inserted] = await ctx.db.insert(bankAccounts).values({
          userId: ctx.portfolio.ownerId,
          basiqAccountId: acct.id,
          basiqConnectionId: acct.connection,
          accountName: acct.name,
          accountNumberMasked: acct.accountNo ? `****${acct.accountNo.slice(-4)}` : null,
          accountType,
          institution: acct.institution,
          connectionStatus: "connected",
        }).returning({ id: bankAccounts.id });

        newAccounts.push({
          id: inserted.id,
          accountName: acct.name,
          institution: acct.institution,
          accountType,
        });
        accountsAdded++;
      }

      // Check for pre-selected property from connect page
      const pendingPropertyId = user.pendingBankPropertyId;

      // Clear the pending property regardless of outcome
      if (pendingPropertyId) {
        await ctx.db
          .update(users)
          .set({ pendingBankPropertyId: null })
          .where(eq(users.id, ctx.portfolio.ownerId));
      }

      return {
        accountsAdded,
        newAccountIds: newAccounts.map((a) => a.id),
        pendingPropertyId: pendingPropertyId ?? null,
      };
    }),

  connect: bankProcedure
    .input(z.object({
      propertyId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Look up user's basiqUserId
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let basiqUserId = user.basiqUserId;

      // Store the pre-selected property for auto-assignment after Basiq callback
      if (input.propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          ),
        });
        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
        await ctx.db
          .update(users)
          .set({ pendingBankPropertyId: input.propertyId })
          .where(eq(users.id, user.id));
      }

      // Create Basiq user if needed (email only — no mobile avoids SMS verification step)
      if (!basiqUserId) {
        const basiqUser = await basiqService.createUser(user.email);
        basiqUserId = basiqUser.id;

        await ctx.db
          .update(users)
          .set({ basiqUserId })
          .where(eq(users.id, user.id));
      }

      // Create auth link for consent flow
      const { links } = await basiqService.createAuthLink(basiqUserId);

      return { url: links.public };
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

      // Look up stored basiqUserId
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
      });

      if (!user?.basiqUserId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Basiq account linked. Please connect your bank first.",
        });
      }

      // Generate new auth link via Basiq
      const { links } = await basiqService.createAuthLink(user.basiqUserId);

      return { url: links.public };
    }),
});
