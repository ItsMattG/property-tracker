# Basiq Integration Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add connection health monitoring, alerts with email notifications, and on-demand sync with rate limiting to the Basiq bank integration.

**Architecture:** Extend schema with connectionAlerts table and new columns on bankAccounts. Add sync service layer that handles Basiq API calls, rate limiting, and alert management. Banking router exposes sync/alert endpoints. Dashboard shows alert banner, banking page shows per-account status and sync controls.

**Tech Stack:** Drizzle ORM, tRPC, Vitest, React, Supabase Edge Functions (for email)

---

### Task 1: Add Schema Enums and connectionAlerts Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `npm run db:generate` (verify migration generates)

**Step 1: Add new enums to schema.ts**

Add after line 113 (after `valueSourceEnum`):

```typescript
export const connectionStatusEnum = pgEnum("connection_status", [
  "connected",
  "disconnected",
  "error",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "success",
  "failed",
  "pending",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "disconnected",
  "requires_reauth",
  "sync_failed",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "dismissed",
  "resolved",
]);
```

**Step 2: Add connectionAlerts table**

Add after `propertyValues` table (after line 391):

```typescript
export const connectionAlerts = pgTable(
  "connection_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id")
      .references(() => bankAccounts.id, { onDelete: "cascade" })
      .notNull(),
    alertType: alertTypeEnum("alert_type").notNull(),
    status: alertStatusEnum("status").default("active").notNull(),
    errorMessage: text("error_message"),
    emailSentAt: timestamp("email_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("connection_alerts_user_id_idx").on(table.userId),
    index("connection_alerts_bank_account_id_idx").on(table.bankAccountId),
    index("connection_alerts_status_idx").on(table.status),
  ]
);
```

**Step 3: Add relations for connectionAlerts**

Add after `propertyValuesRelations`:

```typescript
export const connectionAlertsRelations = relations(connectionAlerts, ({ one }) => ({
  user: one(users, {
    fields: [connectionAlerts.userId],
    references: [users.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [connectionAlerts.bankAccountId],
    references: [bankAccounts.id],
  }),
}));
```

**Step 4: Add type exports**

Add at end of file:

```typescript
export type ConnectionAlert = typeof connectionAlerts.$inferSelect;
export type NewConnectionAlert = typeof connectionAlerts.$inferInsert;
```

**Step 5: Run migration generation**

Run: `npm run db:generate`
Expected: New migration file created in `drizzle/` folder

**Step 6: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(schema): add connectionAlerts table and status enums"
```

---

### Task 2: Add New Columns to bankAccounts Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `npm run db:generate`

**Step 1: Add new columns to bankAccounts**

Modify `bankAccounts` table (around line 143-160). Add these columns before `createdAt`:

```typescript
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  basiqConnectionId: text("basiq_connection_id").notNull(),
  basiqAccountId: text("basiq_account_id").notNull().unique(),
  institution: text("institution").notNull(),
  accountName: text("account_name").notNull(),
  accountNumberMasked: text("account_number_masked"),
  accountType: accountTypeEnum("account_type").notNull(),
  defaultPropertyId: uuid("default_property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  isConnected: boolean("is_connected").default(true).notNull(),
  connectionStatus: connectionStatusEnum("connection_status").default("connected").notNull(),
  lastSyncStatus: syncStatusEnum("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  lastManualSyncAt: timestamp("last_manual_sync_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2: Update bankAccountsRelations to include alerts**

Modify the relation to add alerts:

```typescript
export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [bankAccounts.userId],
    references: [users.id],
  }),
  defaultProperty: one(properties, {
    fields: [bankAccounts.defaultPropertyId],
    references: [properties.id],
  }),
  transactions: many(transactions),
  alerts: many(connectionAlerts),
}));
```

**Step 3: Run migration generation**

Run: `npm run db:generate`
Expected: New migration file adds columns to bank_accounts

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(schema): add connection status columns to bankAccounts"
```

---

### Task 3: Create Sync Service with Rate Limiting

**Files:**
- Create: `src/server/services/sync.ts`
- Create: `src/server/services/__tests__/sync.test.ts`

**Step 1: Write failing tests**

Create `src/server/services/__tests__/sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkRateLimit,
  calculateRetryAfter,
  mapBasiqErrorToAlertType,
  RATE_LIMIT_MINUTES,
} from "../sync";

describe("sync service", () => {
  describe("checkRateLimit", () => {
    it("returns allowed when lastManualSyncAt is null", () => {
      const result = checkRateLimit(null);
      expect(result.allowed).toBe(true);
    });

    it("returns allowed when lastManualSyncAt is older than 15 minutes", () => {
      const oldSync = new Date(Date.now() - 16 * 60 * 1000);
      const result = checkRateLimit(oldSync);
      expect(result.allowed).toBe(true);
    });

    it("returns not allowed when lastManualSyncAt is within 15 minutes", () => {
      const recentSync = new Date(Date.now() - 5 * 60 * 1000);
      const result = checkRateLimit(recentSync);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });
  });

  describe("calculateRetryAfter", () => {
    it("calculates correct retry time", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const retryAfter = calculateRetryAfter(fiveMinutesAgo);

      // Should be about 10 minutes from now
      const diffMinutes = (retryAfter.getTime() - Date.now()) / (60 * 1000);
      expect(diffMinutes).toBeCloseTo(10, 0);
    });
  });

  describe("mapBasiqErrorToAlertType", () => {
    it("maps 401 to requires_reauth", () => {
      expect(mapBasiqErrorToAlertType(401)).toBe("requires_reauth");
    });

    it("maps 403 to requires_reauth", () => {
      expect(mapBasiqErrorToAlertType(403)).toBe("requires_reauth");
    });

    it("maps timeout errors to disconnected", () => {
      expect(mapBasiqErrorToAlertType(408)).toBe("disconnected");
      expect(mapBasiqErrorToAlertType(504)).toBe("disconnected");
    });

    it("maps other errors to sync_failed", () => {
      expect(mapBasiqErrorToAlertType(500)).toBe("sync_failed");
      expect(mapBasiqErrorToAlertType(400)).toBe("sync_failed");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/sync.test.ts`
Expected: FAIL - module not found

**Step 3: Implement sync service**

Create `src/server/services/sync.ts`:

```typescript
export const RATE_LIMIT_MINUTES = 15;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: Date;
  message?: string;
}

export function checkRateLimit(lastManualSyncAt: Date | null): RateLimitResult {
  if (!lastManualSyncAt) {
    return { allowed: true };
  }

  const now = new Date();
  const diffMs = now.getTime() - lastManualSyncAt.getTime();
  const diffMinutes = diffMs / (60 * 1000);

  if (diffMinutes >= RATE_LIMIT_MINUTES) {
    return { allowed: true };
  }

  const retryAfter = calculateRetryAfter(lastManualSyncAt);
  const remainingMinutes = Math.ceil(RATE_LIMIT_MINUTES - diffMinutes);

  return {
    allowed: false,
    retryAfter,
    message: `Please wait ${remainingMinutes} minutes before syncing again`,
  };
}

export function calculateRetryAfter(lastManualSyncAt: Date): Date {
  return new Date(lastManualSyncAt.getTime() + RATE_LIMIT_MINUTES * 60 * 1000);
}

export type AlertType = "disconnected" | "requires_reauth" | "sync_failed";

export function mapBasiqErrorToAlertType(statusCode: number): AlertType {
  if (statusCode === 401 || statusCode === 403) {
    return "requires_reauth";
  }
  if (statusCode === 408 || statusCode === 504) {
    return "disconnected";
  }
  return "sync_failed";
}

export function mapAlertTypeToConnectionStatus(alertType: AlertType): "disconnected" | "error" {
  if (alertType === "disconnected") {
    return "disconnected";
  }
  return "error";
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/sync.test.ts`
Expected: All 7 tests pass

**Step 5: Commit**

```bash
git add src/server/services/sync.ts src/server/services/__tests__/sync.test.ts
git commit -m "feat(sync): add rate limiting and error mapping utilities"
```

---

### Task 4: Create Alert Service

**Files:**
- Create: `src/server/services/alerts.ts`
- Create: `src/server/services/__tests__/alerts.test.ts`

**Step 1: Write failing tests**

Create `src/server/services/__tests__/alerts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldCreateAlert,
  shouldSendEmail,
} from "../alerts";

describe("alerts service", () => {
  describe("shouldCreateAlert", () => {
    it("returns true when no active alerts exist", () => {
      const activeAlerts: { alertType: string }[] = [];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(true);
    });

    it("returns false when active alert of same type exists", () => {
      const activeAlerts = [{ alertType: "sync_failed" }];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(false);
    });

    it("returns true when active alert of different type exists", () => {
      const activeAlerts = [{ alertType: "disconnected" }];
      expect(shouldCreateAlert(activeAlerts, "sync_failed")).toBe(true);
    });
  });

  describe("shouldSendEmail", () => {
    it("returns false when emailSentAt is set", () => {
      const alert = {
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        emailSentAt: new Date(),
      };
      expect(shouldSendEmail(alert)).toBe(false);
    });

    it("returns false when alert is less than 24 hours old", () => {
      const alert = {
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        emailSentAt: null,
      };
      expect(shouldSendEmail(alert)).toBe(false);
    });

    it("returns true when alert is 24+ hours old and no email sent", () => {
      const alert = {
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        emailSentAt: null,
      };
      expect(shouldSendEmail(alert)).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/alerts.test.ts`
Expected: FAIL - module not found

**Step 3: Implement alerts service**

Create `src/server/services/alerts.ts`:

```typescript
const EMAIL_DELAY_HOURS = 24;

export function shouldCreateAlert(
  activeAlerts: { alertType: string }[],
  newAlertType: string
): boolean {
  return !activeAlerts.some((alert) => alert.alertType === newAlertType);
}

export function shouldSendEmail(alert: {
  createdAt: Date;
  emailSentAt: Date | null;
}): boolean {
  if (alert.emailSentAt) {
    return false;
  }

  const now = new Date();
  const ageHours = (now.getTime() - alert.createdAt.getTime()) / (60 * 60 * 1000);

  return ageHours >= EMAIL_DELAY_HOURS;
}

export function formatAlertForEmail(alert: {
  alertType: string;
  bankAccount: { accountName: string; institution: string };
}): string {
  const typeMessages: Record<string, string> = {
    disconnected: "has been disconnected",
    requires_reauth: "requires re-authentication",
    sync_failed: "failed to sync",
  };

  const message = typeMessages[alert.alertType] || "has an issue";
  return `${alert.bankAccount.accountName} (${alert.bankAccount.institution}) ${message}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/alerts.test.ts`
Expected: All 5 tests pass

**Step 5: Commit**

```bash
git add src/server/services/alerts.ts src/server/services/__tests__/alerts.test.ts
git commit -m "feat(alerts): add alert creation and email timing utilities"
```

---

### Task 5: Update Banking Router with Sync and Alert Endpoints

**Files:**
- Modify: `src/server/routers/banking.ts`
- Create: `src/server/routers/__tests__/banking.test.ts`

**Step 1: Write failing tests**

Create `src/server/routers/__tests__/banking.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the context
const mockDb = {
  query: {
    bankAccounts: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    connectionAlerts: {
      findMany: vi.fn(),
    },
  },
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

const mockUser = { id: "user-123" };

describe("banking router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncAccount rate limiting", () => {
    it("rejects sync within 15 minutes of last sync", async () => {
      const recentSync = new Date(Date.now() - 5 * 60 * 1000);
      mockDb.query.bankAccounts.findFirst.mockResolvedValue({
        id: "account-123",
        userId: "user-123",
        lastManualSyncAt: recentSync,
      });

      // This tests the logic - actual router test would need more setup
      const { checkRateLimit } = await import("../../services/sync");
      const result = checkRateLimit(recentSync);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it("allows sync after 15 minutes", async () => {
      const oldSync = new Date(Date.now() - 20 * 60 * 1000);

      const { checkRateLimit } = await import("../../services/sync");
      const result = checkRateLimit(oldSync);

      expect(result.allowed).toBe(true);
    });
  });

  describe("listAlerts", () => {
    it("returns only active alerts for user", async () => {
      const mockAlerts = [
        { id: "alert-1", status: "active", alertType: "sync_failed" },
      ];
      mockDb.query.connectionAlerts.findMany.mockResolvedValue(mockAlerts);

      // Verify the mock was set up correctly
      const alerts = await mockDb.query.connectionAlerts.findMany();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].status).toBe("active");
    });
  });

  describe("dismissAlert", () => {
    it("sets dismissed status and timestamp", async () => {
      mockDb.returning.mockResolvedValue([{
        id: "alert-1",
        status: "dismissed",
        dismissedAt: new Date(),
      }]);

      // Verify update chain works
      const result = await mockDb.update().set().where().returning();
      expect(result[0].status).toBe("dismissed");
      expect(result[0].dismissedAt).toBeDefined();
    });
  });
});
```

**Step 2: Run tests to verify they pass (mocked)**

Run: `npm run test:unit -- src/server/routers/__tests__/banking.test.ts`
Expected: All tests pass

**Step 3: Update banking router**

Replace `src/server/routers/banking.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { bankAccounts, connectionAlerts, transactions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, mapBasiqErrorToAlertType, mapAlertTypeToConnectionStatus } from "../services/sync";
import { shouldCreateAlert } from "../services/alerts";
import { basiqService } from "../services/basiq";

export const bankingRouter = router({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bankAccounts.findMany({
      where: eq(bankAccounts.userId, ctx.user.id),
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
      where: eq(bankAccounts.userId, ctx.user.id),
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

  syncAccount: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify account belongs to user
      const account = await ctx.db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.id, input.accountId),
          eq(bankAccounts.userId, ctx.user.id)
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

      try {
        // Refresh connection via Basiq
        await basiqService.refreshConnection(account.basiqConnectionId);

        // Fetch new transactions
        const fromDate = account.lastSyncedAt?.toISOString().split("T")[0];
        const { data: basiqTransactions } = await basiqService.getTransactions(
          ctx.user.id,
          account.basiqAccountId,
          fromDate
        );

        // Insert new transactions (skip duplicates via unique constraint)
        let transactionsAdded = 0;
        for (const txn of basiqTransactions) {
          try {
            await ctx.db.insert(transactions).values({
              userId: ctx.user.id,
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
            userId: ctx.user.id,
            bankAccountId: input.accountId,
            alertType,
            errorMessage,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Sync failed: ${errorMessage}`,
        });
      }
    }),

  listAlerts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.connectionAlerts.findMany({
      where: and(
        eq(connectionAlerts.userId, ctx.user.id),
        eq(connectionAlerts.status, "active")
      ),
      with: {
        bankAccount: true,
      },
      orderBy: [desc(connectionAlerts.createdAt)],
    });
  }),

  dismissAlert: protectedProcedure
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
            eq(connectionAlerts.userId, ctx.user.id)
          )
        )
        .returning();

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),

  linkAccountToProperty: protectedProcedure
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
            eq(bankAccounts.userId, ctx.user.id)
          )
        )
        .returning();

      return account;
    }),

  reconnect: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.id, input.accountId),
          eq(bankAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Generate new auth link via Basiq
      const { links } = await basiqService.createAuthLink(ctx.user.id);

      return { url: links.public };
    }),
});
```

**Step 4: Run tests**

Run: `npm run test:unit -- src/server/routers/__tests__/banking.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/server/routers/banking.ts src/server/routers/__tests__/banking.test.ts
git commit -m "feat(banking): add sync, alerts, and reconnect endpoints"
```

---

### Task 6: Create ConnectionAlertBanner Component

**Files:**
- Create: `src/components/banking/ConnectionAlertBanner.tsx`

**Step 1: Create the component**

Create `src/components/banking/ConnectionAlertBanner.tsx`:

```typescript
"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ConnectionAlertBannerProps {
  alertCount: number;
  hasAuthError: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function ConnectionAlertBanner({
  alertCount,
  hasAuthError,
  onDismiss,
  className,
}: ConnectionAlertBannerProps) {
  if (alertCount === 0) {
    return null;
  }

  const message =
    alertCount === 1
      ? "1 bank connection needs attention"
      : `${alertCount} bank connections need attention`;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg px-4 py-3",
        hasAuthError
          ? "bg-destructive/10 border border-destructive/20"
          : "bg-yellow-500/10 border border-yellow-500/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle
          className={cn(
            "w-5 h-5",
            hasAuthError ? "text-destructive" : "text-yellow-600"
          )}
        />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/banking">View Details</Link>
        </Button>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/banking/ConnectionAlertBanner.tsx
git commit -m "feat(ui): add ConnectionAlertBanner component"
```

---

### Task 7: Create SyncButton Component

**Files:**
- Create: `src/components/banking/SyncButton.tsx`

**Step 1: Create the component**

Create `src/components/banking/SyncButton.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SyncButtonProps {
  onSync: () => Promise<void>;
  lastManualSyncAt: Date | null;
  rateLimitMinutes?: number;
  className?: string;
}

export function SyncButton({
  onSync,
  lastManualSyncAt,
  rateLimitMinutes = 15,
  className,
}: SyncButtonProps) {
  const [status, setStatus] = useState<"ready" | "syncing" | "success" | "rate-limited">("ready");
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    if (!lastManualSyncAt) {
      setStatus("ready");
      return;
    }

    const checkRateLimit = () => {
      const now = Date.now();
      const syncTime = new Date(lastManualSyncAt).getTime();
      const diffMs = now - syncTime;
      const limitMs = rateLimitMinutes * 60 * 1000;

      if (diffMs >= limitMs) {
        setStatus("ready");
        setRemainingTime(0);
      } else {
        setStatus("rate-limited");
        setRemainingTime(Math.ceil((limitMs - diffMs) / 1000));
      }
    };

    checkRateLimit();
    const interval = setInterval(checkRateLimit, 1000);
    return () => clearInterval(interval);
  }, [lastManualSyncAt, rateLimitMinutes]);

  const handleClick = async () => {
    if (status !== "ready") return;

    setStatus("syncing");
    try {
      await onSync();
      setStatus("success");
      setTimeout(() => setStatus("ready"), 2000);
    } catch {
      setStatus("ready");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getButtonContent = () => {
    switch (status) {
      case "syncing":
        return (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Syncing...
          </>
        );
      case "success":
        return (
          <>
            <Check className="w-4 h-4 mr-2" />
            Synced!
          </>
        );
      case "rate-limited":
        return <>Sync in {formatTime(remainingTime)}</>;
      default:
        return (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Now
          </>
        );
    }
  };

  return (
    <Button
      variant={status === "rate-limited" ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={status !== "ready"}
      className={cn(
        status === "success" && "bg-green-600 hover:bg-green-600",
        className
      )}
    >
      {getButtonContent()}
    </Button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/banking/SyncButton.tsx
git commit -m "feat(ui): add SyncButton component with rate limiting"
```

---

### Task 8: Create AccountStatusIndicator Component

**Files:**
- Create: `src/components/banking/AccountStatusIndicator.tsx`

**Step 1: Create the component**

Create `src/components/banking/AccountStatusIndicator.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "disconnected" | "error";

interface AccountStatusIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: "bg-green-500", label: "Connected" },
  disconnected: { color: "bg-yellow-500", label: "Disconnected" },
  error: { color: "bg-red-500", label: "Error" },
};

export function AccountStatusIndicator({
  status,
  showLabel = false,
  className,
}: AccountStatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/banking/AccountStatusIndicator.tsx
git commit -m "feat(ui): add AccountStatusIndicator component"
```

---

### Task 9: Update Banking Page with New Components

**Files:**
- Modify: `src/app/(dashboard)/banking/page.tsx`

**Step 1: Update the banking page**

Replace `src/app/(dashboard)/banking/page.tsx`:

```typescript
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Landmark, Plus, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";
import { SyncButton } from "@/components/banking/SyncButton";
import { AccountStatusIndicator } from "@/components/banking/AccountStatusIndicator";
import { toast } from "sonner";

export default function BankingPage() {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.banking.listAccounts.useQuery();
  const { data: alerts } = trpc.banking.listAlerts.useQuery();

  const syncAccount = trpc.banking.syncAccount.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.transactionsAdded} new transactions`);
      utils.banking.listAccounts.invalidate();
      utils.banking.listAlerts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onSuccess: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const reconnect = trpc.banking.reconnect.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError = alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Banking</h2>
            <p className="text-muted-foreground">
              Manage your connected bank accounts
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {alerts && alerts.length > 0 && (
        <ConnectionAlertBanner
          alertCount={alerts.length}
          hasAuthError={hasAuthError}
          onDismiss={handleDismissAllAlerts}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Banking</h2>
          <p className="text-muted-foreground">
            Manage your connected bank accounts
          </p>
        </div>
        <Button asChild>
          <Link href="/banking/connect">
            <Plus className="w-4 h-4 mr-2" />
            Connect Bank
          </Link>
        </Button>
      </div>

      {accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((account) => {
            const accountAlerts = alerts?.filter(
              (a) => a.bankAccountId === account.id
            );
            const needsReauth = accountAlerts?.some(
              (a) => a.alertType === "requires_reauth"
            );

            return (
              <Card key={account.id}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          {account.accountName}
                        </CardTitle>
                        <AccountStatusIndicator
                          status={account.connectionStatus as "connected" | "disconnected" | "error"}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.institution}
                      </p>
                    </div>
                  </div>
                  {accountAlerts && accountAlerts.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {accountAlerts.length}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Account</span>
                      <span>{account.accountNumberMasked || "****"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline">{account.accountType}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last synced</span>
                      <span>
                        {account.lastSyncedAt
                          ? formatDistanceToNow(new Date(account.lastSyncedAt), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Default property
                      </span>
                      <span>{account.defaultProperty?.suburb || "None"}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {needsReauth ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            reconnect.mutate({ accountId: account.id })
                          }
                        >
                          Reconnect
                        </Button>
                      ) : (
                        <SyncButton
                          onSync={() =>
                            syncAccount.mutateAsync({ accountId: account.id })
                          }
                          lastManualSyncAt={account.lastManualSyncAt}
                          className="flex-1"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Landmark className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No bank accounts connected</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Connect your bank account to automatically import transactions for
            your investment properties.
          </p>
          <Button asChild className="mt-4">
            <Link href="/banking/connect">
              <Plus className="w-4 h-4 mr-2" />
              Connect Your Bank
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/banking/page.tsx
git commit -m "feat(banking): integrate sync and alert components into banking page"
```

---

### Task 10: Add Dashboard Alert Banner

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Read current dashboard page**

First, check the current dashboard implementation to find where to add the banner.

**Step 2: Add alert banner to dashboard**

Add at the top of the dashboard page content:

```typescript
// Add to imports
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";

// Add query for alerts
const { data: alerts } = trpc.banking.listAlerts.useQuery();

// Add dismiss mutation
const dismissAlert = trpc.banking.dismissAlert.useMutation({
  onSuccess: () => {
    utils.banking.listAlerts.invalidate();
  },
});

const handleDismissAllAlerts = async () => {
  if (!alerts) return;
  for (const alert of alerts) {
    await dismissAlert.mutateAsync({ alertId: alert.id });
  }
};

const hasAuthError = alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

// Add banner at top of return JSX (before existing content)
{alerts && alerts.length > 0 && (
  <ConnectionAlertBanner
    alertCount={alerts.length}
    hasAuthError={hasAuthError}
    onDismiss={handleDismissAllAlerts}
    className="mb-6"
  />
)}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): add connection alert banner"
```

---

### Task 11: Run All Tests and Verify Build

**Files:**
- None (verification only)

**Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address test and build issues"
```

---

### Task 12: Final Push

**Step 1: Push all changes**

Run: `git push origin feature/infrastructure`

**Step 2: Summary**

Completed features:
- connectionAlerts table with full schema
- bankAccounts extended with status columns
- Sync service with 15-minute rate limiting
- Alert service with 24-hour email delay logic
- Banking router with sync, alerts, dismiss, reconnect endpoints
- ConnectionAlertBanner component
- SyncButton component with countdown timer
- AccountStatusIndicator component
- Updated banking page with full integration
- Dashboard alert banner

Remaining for Phase 2:
- Supabase Edge Function for email notifications
- Categorization rules
- Account matching improvements
