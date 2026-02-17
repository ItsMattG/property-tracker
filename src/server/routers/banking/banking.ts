import { z } from "zod";
import { router, protectedProcedure, writeProcedure, bankProcedure } from "../../trpc";
import type { NewAnomalyAlert } from "../../db/schema";
import {
  batchCategorize,
  checkRateLimit,
  mapBasiqErrorToAlertType,
  mapAlertTypeToConnectionStatus,
  shouldCreateAlert,
  basiqService,
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  getHistoricalAverage,
  getKnownMerchants,
} from "../../services/banking";
import { TRPCError } from "@trpc/server";
import { metrics } from "@/lib/metrics";
import { axiomMetrics } from "@/lib/axiom";
import { logger } from "@/lib/logger";

export const bankingRouter = router({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.bankAccount.findByOwner(ctx.portfolio.ownerId, {
      withProperty: true,
      withAlerts: true,
    });
  }),

  getAccountSummaries: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.uow.bankAccount.findByOwner(ctx.portfolio.ownerId, {
      withProperty: true,
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const summaries = await Promise.all(
      accounts.map(async (account) => {
        const [unreconciledCount, reconciledBalance, monthlyCashFlow] = await Promise.all([
          ctx.uow.transactions.countUncategorized(account.id, ctx.portfolio.ownerId),
          ctx.uow.transactions.getReconciledBalance(account.id, ctx.portfolio.ownerId),
          ctx.uow.transactions.getMonthlyCashFlow(account.id, ctx.portfolio.ownerId, monthStart),
        ]);

        return {
          id: account.id,
          accountName: account.nickname || account.accountName,
          institution: account.institution,
          institutionNickname: account.institutionNickname,
          accountType: account.accountType,
          accountNumberMasked: account.accountNumberMasked,
          connectionStatus: account.connectionStatus,
          lastSyncedAt: account.lastSyncedAt,
          bankBalance: account.balance,
          property: account.defaultProperty,
          unreconciledCount,
          reconciledBalance,
          cashIn: monthlyCashFlow.cashIn,
          cashOut: monthlyCashFlow.cashOut,
        };
      })
    );

    return summaries;
  }),

  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.uow.bankAccount.findByOwner(ctx.portfolio.ownerId, {
      withAlerts: true,
    });

    return accounts.map((account) => ({
      id: account.id,
      accountName: account.accountName,
      institution: account.institution,
      connectionStatus: account.connectionStatus,
      lastSyncStatus: account.lastSyncStatus,
      lastSyncedAt: account.lastSyncedAt,
      lastManualSyncAt: account.lastManualSyncAt,
      activeAlertCount: account.alerts?.length ?? 0,
    }));
  }),

  syncAccount: bankProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify account belongs to user
      const account = await ctx.uow.bankAccount.findById(input.accountId, ctx.portfolio.ownerId);

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
      await ctx.uow.bankAccount.update(input.accountId, {
        lastManualSyncAt: new Date(),
        lastSyncStatus: "pending",
      });

      const syncStartTime = Date.now();
      logger.info("Bank sync started", { accountId: input.accountId, institution: account.institution });

      // Look up stored basiqUserId for API calls
      const user = await ctx.uow.user.findById(ctx.portfolio.ownerId);

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
        // TODO(budget-tracker): Route transactions based on account.defaultTransactionType
        // - 'property' (default/null): insert into property transactions (current pipeline)
        // - 'personal': insert into personalTransactions table for budget tracking
        // - 'ask': flag for user review (fall back to property pipeline for V1)
        // For V1, all transactions go through the existing property pipeline regardless
        // of defaultTransactionType. Personal transaction import will be added in a follow-up.
        let transactionsAdded = 0;
        for (const txn of basiqTransactions) {
          try {
            await ctx.uow.transactions.create({
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
          const recentTxns = await ctx.uow.transactions.findRecentByAccount(
            ctx.portfolio.ownerId,
            account.id,
            100
          );

          // Service-layer: DB passed to banking service functions
          const knownMerchants = await getKnownMerchants(
            ctx.db,
            ctx.portfolio.ownerId,
            account.defaultPropertyId ?? undefined
          );

          // Collect all anomaly alerts to batch insert
          const anomalyAlertsToInsert: NewAnomalyAlert[] = [];

          for (const txn of basiqTransactions.slice(0, transactionsAdded)) {
            const txnInput = {
              id: txn.id,
              amount: txn.direction === "credit" ? txn.amount : `-${txn.amount}`,
              description: txn.description,
              date: txn.postDate,
            };

            // Service-layer: DB passed to banking service functions
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
            await ctx.uow.bankAccount.createAnomalyAlerts(anomalyAlertsToInsert);
          }

          // Run AI categorization on new uncategorized transactions
          const uncategorizedTxns = await ctx.uow.transactions.findUncategorizedByAccount(
            ctx.portfolio.ownerId,
            account.id,
            50
          );

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
        await ctx.uow.bankAccount.update(input.accountId, {
          connectionStatus: "connected",
          lastSyncStatus: "success",
          lastSyncError: null,
          lastSyncedAt: new Date(),
        });

        // Resolve any active alerts
        await ctx.uow.bankAccount.resolveAlertsByAccount(input.accountId);

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
        await ctx.uow.bankAccount.update(input.accountId, {
          connectionStatus,
          lastSyncStatus: "failed",
          lastSyncError: errorMessage,
        });

        // Check if we should create a new alert
        const activeAlerts = await ctx.uow.bankAccount.findActiveAlertsByAccount(input.accountId);

        if (shouldCreateAlert(activeAlerts, alertType)) {
          await ctx.uow.bankAccount.createAlert({
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
    return ctx.uow.bankAccount.findActiveAlerts(ctx.portfolio.ownerId);
  }),

  dismissAlert: writeProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.uow.bankAccount.dismissAlert(input.alertId, ctx.portfolio.ownerId);

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
      await ctx.uow.bankAccount.updateByInstitution(
        input.institution,
        ctx.portfolio.ownerId,
        { institutionNickname: input.nickname || null }
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
      const existing = await ctx.uow.bankAccount.findById(input.accountId, ctx.portfolio.ownerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      return ctx.uow.bankAccount.update(input.accountId, {
        nickname: input.nickname || null,
      });
    }),

  linkAccountToProperty: writeProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        propertyId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.bankAccount.findById(input.accountId, ctx.portfolio.ownerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      return ctx.uow.bankAccount.update(input.accountId, {
        defaultPropertyId: input.propertyId,
      });
    }),

  updateDefaultTransactionType: writeProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        defaultTransactionType: z.enum(["property", "personal", "ask"]).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.bankAccount.findById(input.accountId, ctx.portfolio.ownerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      return ctx.uow.bankAccount.update(input.accountId, {
        defaultTransactionType: input.defaultTransactionType,
      });
    }),

  removeAccount: writeProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const account = await ctx.uow.bankAccount.findById(input.accountId, ctx.portfolio.ownerId);

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Delete bank account — transactions and connection_alerts cascade-delete via FK
      await ctx.uow.bankAccount.delete(input.accountId);

      return { success: true };
    }),

  processConnection: bankProcedure
    .input(z.object({ jobIds: z.array(z.string()).optional() }))
    .mutation(async ({ ctx }) => {
      // Look up stored basiqUserId
      const user = await ctx.uow.user.findById(ctx.portfolio.ownerId);

      if (!user?.basiqUserId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Basiq account linked.",
        });
      }

      // Fetch accounts from Basiq
      const { data: basiqAccounts } = await basiqService.getAccounts(user.basiqUserId);

      // Get existing accounts to avoid duplicates
      const existingAccounts = await ctx.uow.bankAccount.findByOwner(ctx.portfolio.ownerId);
      const existingBasiqIds = new Set(existingAccounts.map((a) => a.basiqAccountId));

      let accountsAdded = 0;
      const newAccounts: Array<{ id: string; accountName: string; institution: string; accountType: string }> = [];

      for (const acct of basiqAccounts) {
        if (existingBasiqIds.has(acct.id)) continue;

        const accountType = (["transaction", "savings", "mortgage", "offset", "credit_card", "line_of_credit"].includes(acct.class?.type)
          ? acct.class.type
          : "transaction") as "transaction";

        const created = await ctx.uow.bankAccount.create({
          userId: ctx.portfolio.ownerId,
          basiqAccountId: acct.id,
          basiqConnectionId: acct.connection,
          accountName: acct.name,
          accountNumberMasked: acct.accountNo ? `****${acct.accountNo.slice(-4)}` : null,
          accountType,
          institution: acct.institution,
          connectionStatus: "connected",
        });

        newAccounts.push({
          id: created.id,
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
        await ctx.uow.user.update(ctx.portfolio.ownerId, { pendingBankPropertyId: null });
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
      mobile: z.string().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Look up user's basiqUserId
      const user = await ctx.uow.user.findById(ctx.portfolio.ownerId);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let basiqUserId = user.basiqUserId;

      // Determine effective mobile: prefer freshly-submitted, fall back to stored
      const effectiveMobile = input.mobile || user.mobile;
      if (!effectiveMobile) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "MOBILE_REQUIRED",
        });
      }

      // Persist mobile on user record if new or changed
      if (input.mobile && input.mobile !== user.mobile) {
        await ctx.uow.user.update(user.id, { mobile: input.mobile });
      }

      // Store the pre-selected property for auto-assignment after Basiq callback,
      // or clear any stale value so the callback routes to the assign page
      if (input.propertyId) {
        const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
        await ctx.uow.user.update(user.id, { pendingBankPropertyId: input.propertyId });
      } else {
        await ctx.uow.user.update(user.id, { pendingBankPropertyId: null });
      }

      // Create or update Basiq user with mobile (required for auth link / SMS verification)
      if (!basiqUserId) {
        try {
          const basiqUser = await basiqService.createUser(user.email, effectiveMobile);
          basiqUserId = basiqUser.id;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: msg.includes("not configured")
              ? "Bank connections are not available at this time. Please try again later."
              : `Unable to initialize bank connection: ${msg}`,
          });
        }

        await ctx.uow.user.update(user.id, { basiqUserId });
      } else {
        // Existing Basiq user — update mobile in case it changed or wasn't set
        try {
          await basiqService.updateUser(basiqUserId, { mobile: effectiveMobile });
        } catch {
          // Non-fatal — mobile may already be set from a previous connection
        }
      }

      // Create auth link for consent flow — if the stored basiqUserId is stale
      // (e.g. API key changed, user deleted from Basiq), recreate the user and retry
      const hadExistingConsent = !!user.basiqUserId;
      try {
        const { links } = await basiqService.createAuthLink(basiqUserId);
        let url = links.public;
        // If user already has consent, append action=connect so Basiq skips the
        // consent management screen and goes straight to bank selection
        if (hadExistingConsent) {
          url += (url.includes("?") ? "&" : "?") + "action=connect";
        }
        return { url };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isNotFound = msg.includes("resource-not-found");
        if (!isNotFound) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: msg.includes("not configured")
              ? "Bank connections are not available at this time. Please try again later."
              : `Unable to connect to banking provider: ${msg}`,
          });
        }

        // Stale basiqUserId — create a new Basiq user and retry
        try {
          const basiqUser = await basiqService.createUser(user.email, effectiveMobile);
          basiqUserId = basiqUser.id;

          await ctx.uow.user.update(user.id, { basiqUserId });

          const { links } = await basiqService.createAuthLink(basiqUserId);
          // New Basiq user = fresh consent needed, no action param
          return { url: links.public };
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Unable to connect to banking provider: ${retryMsg}`,
          });
        }
      }
    }),

  reconnect: bankProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.uow.bankAccount.findById(input.accountId, ctx.portfolio.ownerId);

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Look up stored basiqUserId
      const user = await ctx.uow.user.findById(ctx.portfolio.ownerId);

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
