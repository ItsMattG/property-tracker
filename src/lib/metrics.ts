import * as Sentry from "@sentry/nextjs";

/**
 * Business metrics tracking via Sentry.
 * These custom events help monitor application health beyond errors.
 */
export const metrics = {
  /**
   * Track a failed bank sync attempt.
   * Use in catch blocks when Basiq sync fails.
   */
  bankSyncFailed: (accountId: string, error: string) => {
    Sentry.captureMessage("Bank sync failed", {
      level: "warning",
      tags: {
        type: "bank_sync",
        status: "failed",
      },
      extra: {
        accountId,
        error,
      },
    });
  },

  /**
   * Track a successful bank sync.
   * Added as breadcrumb for context on future errors.
   */
  bankSyncSuccess: (accountId: string, transactionCount: number) => {
    Sentry.addBreadcrumb({
      category: "bank_sync",
      message: `Synced ${transactionCount} transactions`,
      level: "info",
      data: {
        accountId,
        transactionCount,
      },
    });
  },

  /**
   * Track when a user overrides an auto-categorized transaction.
   * Helps measure categorization accuracy.
   */
  categorizationOverride: (
    transactionId: string,
    fromCategory: string,
    toCategory: string
  ) => {
    Sentry.captureMessage("Category override", {
      level: "info",
      tags: {
        type: "categorization",
        action: "override",
      },
      extra: {
        transactionId,
        fromCategory,
        toCategory,
      },
    });
  },
};
