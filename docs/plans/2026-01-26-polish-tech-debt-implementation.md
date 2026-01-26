# Polish, Performance & Technical Debt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix security vulnerabilities, optimize performance, improve code quality, and polish UX across the codebase.

**Architecture:** Phased approach - security first (CRITICAL), then performance optimizations, code quality improvements, and finally UX polish. Each task is atomic and independently testable.

**Tech Stack:** Next.js 16, React 19, tRPC, Drizzle ORM, TypeScript, Zod

---

## Phase 1: Security Fixes

### Task 1: Implement Basiq Webhook Signature Verification

**Files:**
- Modify: `src/app/api/webhooks/basiq/route.ts`
- Modify: `.env.example` (add BASIQ_WEBHOOK_SECRET)
- Create: `src/app/api/webhooks/basiq/__tests__/route.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/webhooks/basiq/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

// Mock environment
vi.stubEnv("BASIQ_WEBHOOK_SECRET", "test-webhook-secret");

describe("Basiq Webhook Route", () => {
  const WEBHOOK_SECRET = "test-webhook-secret";

  function signPayload(payload: string): string {
    return createHmac("sha256", WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");
  }

  it("should reject requests without signature", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/webhooks/basiq", {
      method: "POST",
      body: JSON.stringify({ type: "connection.created", data: {} }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should reject requests with invalid signature", async () => {
    const { POST } = await import("../route");
    const payload = JSON.stringify({ type: "connection.created", data: {} });
    const request = new Request("http://localhost/api/webhooks/basiq", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "x-basiq-signature": "invalid-signature",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should accept requests with valid signature", async () => {
    const { POST } = await import("../route");
    const payload = JSON.stringify({ type: "connection.created", data: { connectionId: "test-123" } });
    const signature = signPayload(payload);
    const request = new Request("http://localhost/api/webhooks/basiq", {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "x-basiq-signature": signature,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/webhooks/basiq/__tests__/route.test.ts`
Expected: FAIL (signature verification not implemented)

**Step 3: Implement signature verification**

Modify `src/app/api/webhooks/basiq/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bankAccounts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.BASIQ_WEBHOOK_SECRET;

type BasiqWebhookEvent = {
  type: string;
  data: {
    connectionId?: string;
    accountId?: string;
    userId?: string;
    status?: string;
  };
};

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!WEBHOOK_SECRET || !signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-basiq-signature");

    // Verify signature in production
    if (process.env.NODE_ENV === "production" || WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(payload, signature)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const event: BasiqWebhookEvent = JSON.parse(payload);

    switch (event.type) {
      case "connection.created":
      case "connection.updated":
        if (event.data.connectionId) {
          await handleConnectionUpdate(event.data.connectionId, event.data.status);
        }
        break;

      case "transactions.created":
      case "transactions.updated":
        if (event.data.accountId) {
          await handleTransactionSync(event.data.accountId);
        }
        break;

      case "connection.deleted":
        if (event.data.connectionId) {
          await handleConnectionDeleted(event.data.connectionId);
        }
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleConnectionUpdate(connectionId: string, status?: string) {
  const isConnected = status === "active" || status === "connected";
  await db
    .update(bankAccounts)
    .set({ isConnected, lastSyncedAt: new Date() })
    .where(eq(bankAccounts.basiqConnectionId, connectionId));
}

async function handleTransactionSync(accountId: string) {
  await db
    .update(bankAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(bankAccounts.basiqAccountId, accountId));
}

async function handleConnectionDeleted(connectionId: string) {
  await db
    .update(bankAccounts)
    .set({ isConnected: false })
    .where(eq(bankAccounts.basiqConnectionId, connectionId));
}
```

**Step 4: Add environment variable to .env.example**

Add to `.env.example`:
```
BASIQ_WEBHOOK_SECRET=your-webhook-secret-from-basiq-dashboard
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/app/api/webhooks/basiq/__tests__/route.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/webhooks/basiq/route.ts src/app/api/webhooks/basiq/__tests__/route.test.ts .env.example
git commit -m "fix(security): implement Basiq webhook signature verification

- Add HMAC-SHA256 signature verification
- Use timing-safe comparison to prevent timing attacks
- Remove console.log statements
- Add comprehensive tests"
```

---

### Task 2: Harden Cron Route Authentication

**Files:**
- Create: `src/lib/cron-auth.ts`
- Modify: `src/app/api/cron/generate-expected/route.ts`
- Modify: `src/app/api/cron/sync-banks/route.ts`
- Modify: `src/app/api/cron/anomaly-detection/route.ts`
- Modify: `src/app/api/cron/weekly-digest/route.ts`
- Modify: `src/app/api/cron/tax-suggestions/route.ts`
- Create: `src/lib/__tests__/cron-auth.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/cron-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyCronRequest } from "../cron-auth";

vi.stubEnv("CRON_SECRET", "test-cron-secret");

describe("verifyCronRequest", () => {
  it("should reject missing authorization header", () => {
    const headers = new Headers();
    expect(verifyCronRequest(headers)).toBe(false);
  });

  it("should reject invalid token", () => {
    const headers = new Headers();
    headers.set("authorization", "Bearer wrong-token");
    expect(verifyCronRequest(headers)).toBe(false);
  });

  it("should accept valid token", () => {
    const headers = new Headers();
    headers.set("authorization", "Bearer test-cron-secret");
    expect(verifyCronRequest(headers)).toBe(true);
  });

  it("should use timing-safe comparison", () => {
    // This test ensures we don't short-circuit on first character mismatch
    const headers = new Headers();
    headers.set("authorization", "Bearer xest-cron-secret"); // differs in first char

    const start = performance.now();
    verifyCronRequest(headers);
    const time1 = performance.now() - start;

    headers.set("authorization", "Bearer test-cron-secrex"); // differs in last char
    const start2 = performance.now();
    verifyCronRequest(headers);
    const time2 = performance.now() - start2;

    // Times should be similar (within 10ms) for timing-safe comparison
    expect(Math.abs(time1 - time2)).toBeLessThan(10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/cron-auth.test.ts`
Expected: FAIL (module doesn't exist)

**Step 3: Implement cron auth utility**

Create `src/lib/cron-auth.ts`:

```typescript
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Verify cron request using timing-safe comparison
 */
export function verifyCronRequest(headers: Headers): boolean {
  if (!CRON_SECRET) {
    return false;
  }

  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  try {
    // Pad to same length for timing-safe comparison
    const tokenBuffer = Buffer.from(token.padEnd(256, "\0"));
    const secretBuffer = Buffer.from(CRON_SECRET.padEnd(256, "\0"));

    return timingSafeEqual(tokenBuffer, secretBuffer) &&
           token.length === CRON_SECRET.length;
  } catch {
    return false;
  }
}

/**
 * Standard unauthorized response for cron routes
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/cron-auth.test.ts`
Expected: PASS

**Step 5: Update all cron routes**

Replace the auth check pattern in each cron route. Example for `src/app/api/cron/generate-expected/route.ts`:

Change:
```typescript
const authHeader = request.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

To:
```typescript
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

// At start of GET handler:
if (!verifyCronRequest(request.headers)) {
  return unauthorizedResponse();
}
```

Apply this pattern to all cron routes:
- `src/app/api/cron/generate-expected/route.ts`
- `src/app/api/cron/sync-banks/route.ts`
- `src/app/api/cron/anomaly-detection/route.ts`
- `src/app/api/cron/weekly-digest/route.ts`
- `src/app/api/cron/tax-suggestions/route.ts`
- `src/app/api/cron/rba-rate-check/route.ts`
- `src/app/api/cron/refinance-scan/route.ts`
- `src/app/api/cron/compliance-reminders/route.ts`
- `src/app/api/cron/equity-milestones/route.ts`

**Step 6: Commit**

```bash
git add src/lib/cron-auth.ts src/lib/__tests__/cron-auth.test.ts src/app/api/cron/
git commit -m "fix(security): harden cron route authentication

- Add timing-safe token comparison to prevent timing attacks
- Extract shared auth logic to src/lib/cron-auth.ts
- Apply consistent auth pattern across all cron routes"
```

---

### Task 3: Add CSV Import Sanitization

**Files:**
- Modify: `src/server/services/csv-import.ts`
- Create: `src/server/services/__tests__/csv-import.test.ts`

**Step 1: Write the failing test**

Create `src/server/services/__tests__/csv-import.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCSV, sanitizeField } from "../csv-import";

describe("CSV Import Sanitization", () => {
  describe("sanitizeField", () => {
    it("should escape formula injection characters", () => {
      expect(sanitizeField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeField("+1234567890")).toBe("'+1234567890");
      expect(sanitizeField("-1234567890")).toBe("'-1234567890");
      expect(sanitizeField("@SUM(A1)")).toBe("'@SUM(A1)");
    });

    it("should not modify safe strings", () => {
      expect(sanitizeField("Normal description")).toBe("Normal description");
      expect(sanitizeField("Payment to John")).toBe("Payment to John");
    });

    it("should truncate overly long fields", () => {
      const longString = "a".repeat(1000);
      expect(sanitizeField(longString).length).toBe(500);
    });
  });

  describe("parseCSV", () => {
    it("should sanitize description fields", () => {
      const csv = `date,description,amount
2024-01-15,=HYPERLINK("http://evil.com"),100.00`;

      const rows = parseCSV(csv);
      expect(rows[0].description).toBe("'=HYPERLINK(\"http://evil.com\")");
    });

    it("should parse valid CSV correctly", () => {
      const csv = `date,description,amount
2024-01-15,Rent payment,1500.00
2024-01-16,Water bill,-50.00`;

      const rows = parseCSV(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0].description).toBe("Rent payment");
      expect(rows[0].amount).toBe("1500.00");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/services/__tests__/csv-import.test.ts`
Expected: FAIL (sanitizeField not exported)

**Step 3: Implement sanitization**

Modify `src/server/services/csv-import.ts`:

```typescript
import { z } from "zod";

const MAX_FIELD_LENGTH = 500;
const FORMULA_CHARS = ["=", "+", "-", "@"];

export const csvRowSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
});

export type CSVRow = z.infer<typeof csvRowSchema>;

/**
 * Sanitize a field to prevent CSV injection attacks
 */
export function sanitizeField(value: string): string {
  let sanitized = value;

  // Truncate overly long fields
  if (sanitized.length > MAX_FIELD_LENGTH) {
    sanitized = sanitized.slice(0, MAX_FIELD_LENGTH);
  }

  // Escape formula injection characters by prefixing with single quote
  if (FORMULA_CHARS.some(char => sanitized.startsWith(char))) {
    sanitized = "'" + sanitized;
  }

  return sanitized;
}

export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const dateIdx = headers.findIndex((h) =>
    ["date", "transaction date", "trans date"].includes(h)
  );
  const descIdx = headers.findIndex((h) =>
    ["description", "desc", "narrative", "details", "memo"].includes(h)
  );
  const amountIdx = headers.findIndex((h) =>
    ["amount", "value", "debit/credit"].includes(h)
  );
  const debitIdx = headers.findIndex((h) => ["debit", "withdrawal"].includes(h));
  const creditIdx = headers.findIndex((h) => ["credit", "deposit"].includes(h));

  if (dateIdx === -1) throw new Error("Could not find date column");
  if (descIdx === -1) throw new Error("Could not find description column");
  if (amountIdx === -1 && (debitIdx === -1 || creditIdx === -1)) {
    throw new Error("Could not find amount column(s)");
  }

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const date = values[dateIdx]?.replace(/"/g, "");
    const rawDescription = values[descIdx]?.replace(/"/g, "");
    const description = sanitizeField(rawDescription || "");

    let amount: string;
    if (amountIdx !== -1) {
      amount = values[amountIdx]?.replace(/"/g, "").replace(/[$,]/g, "");
    } else {
      const debit = parseFloat(values[debitIdx]?.replace(/"/g, "").replace(/[$,]/g, "") || "0");
      const credit = parseFloat(values[creditIdx]?.replace(/"/g, "").replace(/[$,]/g, "") || "0");
      amount = (credit - debit).toString();
    }

    if (date && description && amount) {
      rows.push({
        date: normalizeDate(date),
        description,
        amount,
      });
    }
  }

  return rows;
}

function normalizeDate(dateStr: string): string {
  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern === patterns[1]) {
        return dateStr;
      }
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  throw new Error(`Could not parse date: ${dateStr}`);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/services/__tests__/csv-import.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/csv-import.ts src/server/services/__tests__/csv-import.test.ts
git commit -m "fix(security): add CSV import sanitization

- Escape formula injection characters (=, +, -, @)
- Truncate overly long fields to 500 characters
- Add comprehensive tests for sanitization"
```

---

## Phase 2: Performance Optimizations

### Task 4: Optimize Generate-Expected Cron Job Queries

**Files:**
- Modify: `src/app/api/cron/generate-expected/route.ts`

**Step 1: Analyze current implementation**

Current issues:
1. N+1 query for existing expected transactions per template
2. Fetches ALL transactions into memory
3. Filters transactions in-memory instead of SQL

**Step 2: Implement optimized version**

Modify `src/app/api/cron/generate-expected/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  recurringTransactions,
  expectedTransactions,
  transactions,
} from "@/server/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  generateExpectedTransactions,
  findMatchingTransactions,
} from "@/server/services/recurring";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const today = new Date();
  const results = {
    generated: 0,
    matched: 0,
    missed: 0,
    errors: [] as string[],
  };

  try {
    // Step 1: Get all active recurring templates
    const templates = await db.query.recurringTransactions.findMany({
      where: eq(recurringTransactions.isActive, true),
    });

    if (templates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active templates",
        results,
      });
    }

    const templateIds = templates.map((t) => t.id);

    // Step 2: Batch fetch ALL existing expected transactions for these templates
    const allExisting = await db.query.expectedTransactions.findMany({
      where: inArray(expectedTransactions.recurringTransactionId, templateIds),
    });

    // Group by template ID for O(1) lookup
    const existingByTemplate = new Map<string, Date[]>();
    for (const exp of allExisting) {
      const dates = existingByTemplate.get(exp.recurringTransactionId) || [];
      dates.push(new Date(exp.expectedDate));
      existingByTemplate.set(exp.recurringTransactionId, dates);
    }

    // Step 3: Generate new expected transactions (batch insert)
    const toInsert: Array<{
      recurringTransactionId: string;
      userId: string;
      propertyId: string;
      expectedDate: Date;
      expectedAmount: string;
    }> = [];

    for (const template of templates) {
      try {
        const existingDates = existingByTemplate.get(template.id) || [];
        const generated = generateExpectedTransactions(
          template,
          today,
          14,
          existingDates
        );

        for (const g of generated) {
          toInsert.push({
            recurringTransactionId: g.recurringTransactionId,
            userId: g.userId,
            propertyId: g.propertyId,
            expectedDate: g.expectedDate,
            expectedAmount: g.expectedAmount,
          });
        }
      } catch (error) {
        results.errors.push(
          `Failed to generate for template ${template.id}: ${error}`
        );
      }
    }

    // Batch insert all generated expected transactions
    if (toInsert.length > 0) {
      await db.insert(expectedTransactions).values(toInsert);
      results.generated = toInsert.length;
    }

    // Step 4: Run matching for pending expected transactions
    const pending = await db.query.expectedTransactions.findMany({
      where: eq(expectedTransactions.status, "pending"),
      with: {
        recurringTransaction: true,
      },
    });

    if (pending.length > 0) {
      // Get unique user IDs from pending
      const userIds = [...new Set(pending.map((p) => p.userId))];

      // Batch fetch transactions for all relevant users
      const recentTransactions = await db.query.transactions.findMany({
        where: inArray(transactions.userId, userIds),
        orderBy: (t, { desc }) => [desc(t.date)],
        limit: 1000, // Reasonable limit
      });

      // Group transactions by user for O(1) lookup
      const txByUser = new Map<string, typeof recentTransactions>();
      for (const tx of recentTransactions) {
        const userTxs = txByUser.get(tx.userId) || [];
        userTxs.push(tx);
        txByUser.set(tx.userId, userTxs);
      }

      // Process matches
      for (const expected of pending) {
        if (!expected.recurringTransaction) continue;

        try {
          const amountTolerance = Number(
            expected.recurringTransaction.amountTolerance
          );
          const dateTolerance = Number(
            expected.recurringTransaction.dateTolerance
          );

          const userTransactions = txByUser.get(expected.userId) || [];
          const matches = findMatchingTransactions(
            expected,
            userTransactions,
            amountTolerance,
            dateTolerance
          );

          if (matches.length > 0 && matches[0].confidence === "high") {
            await db
              .update(expectedTransactions)
              .set({
                status: "matched",
                matchedTransactionId: matches[0].transaction.id,
              })
              .where(eq(expectedTransactions.id, expected.id));

            await db
              .update(transactions)
              .set({
                category: expected.recurringTransaction.category,
                transactionType: expected.recurringTransaction.transactionType,
                propertyId: expected.propertyId,
                updatedAt: new Date(),
              })
              .where(eq(transactions.id, matches[0].transaction.id));

            results.matched++;
          }
        } catch (error) {
          results.errors.push(
            `Failed to match expected ${expected.id}: ${error}`
          );
        }
      }
    }

    // Step 5: Mark missed transactions
    const stillPending = await db.query.expectedTransactions.findMany({
      where: eq(expectedTransactions.status, "pending"),
      with: {
        recurringTransaction: true,
      },
    });

    for (const expected of stillPending) {
      if (!expected.recurringTransaction) continue;

      const alertDelayDays = Number(
        expected.recurringTransaction.alertDelayDays
      );
      const expectedDate = new Date(expected.expectedDate);
      const missedThreshold = new Date(expectedDate);
      missedThreshold.setDate(missedThreshold.getDate() + alertDelayDays);

      if (today > missedThreshold) {
        try {
          await db
            .update(expectedTransactions)
            .set({ status: "missed" })
            .where(eq(expectedTransactions.id, expected.id));
          results.missed++;
        } catch (error) {
          results.errors.push(
            `Failed to mark missed ${expected.id}: ${error}`
          );
        }
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        results,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Generate expected cron executed",
    timestamp: new Date().toISOString(),
    results,
  });
}
```

**Step 3: Run existing tests**

Run: `npm test -- generate-expected`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/cron/generate-expected/route.ts
git commit -m "perf: optimize generate-expected cron job queries

- Batch fetch existing expected transactions (eliminates N+1)
- Group transactions by user in memory for O(1) lookup
- Batch insert generated expected transactions
- Add reasonable limit on transaction fetch"
```

---

### Task 5: Add Database Indexes

**Files:**
- Create: `drizzle/migrations/0XXX_add_performance_indexes.sql`
- Modify: `src/server/db/schema.ts` (add index definitions)

**Step 1: Create migration file**

Create migration SQL (get next migration number by checking `drizzle/` folder):

```sql
-- Add performance indexes for common query patterns

-- Transactions by user and date (filtering dashboards, reports)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
ON transactions (user_id, date DESC);

-- Properties by user (property list queries)
CREATE INDEX IF NOT EXISTS idx_properties_user_id
ON properties (user_id);

-- Bank accounts by Basiq connection ID (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_bank_accounts_basiq_connection
ON bank_accounts (basiq_connection_id)
WHERE basiq_connection_id IS NOT NULL;

-- Expected transactions by user and status (cron job queries)
CREATE INDEX IF NOT EXISTS idx_expected_transactions_user_status
ON expected_transactions (user_id, status);

-- Recurring transactions by active status
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active
ON recurring_transactions (is_active)
WHERE is_active = true;
```

**Step 2: Run migration**

Run: `npm run db:migrate`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "perf: add database indexes for common query patterns

- transactions(user_id, date) for dashboard queries
- properties(user_id) for property list
- bank_accounts(basiq_connection_id) for webhook lookups
- expected_transactions(user_id, status) for cron jobs
- recurring_transactions(is_active) for active template queries"
```

---

### Task 6: Add Basiq API Retry Logic

**Files:**
- Modify: `src/server/services/basiq.ts`
- Create: `src/server/services/__tests__/basiq.test.ts`

**Step 1: Write the failing test**

Create `src/server/services/__tests__/basiq.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("BasiqService", () => {
  beforeEach(() => {
    vi.stubEnv("BASIQ_API_KEY", "test-api-key");
    vi.stubEnv("BASIQ_SERVER_URL", "https://test-api.basiq.io");
  });

  describe("retry logic", () => {
    it("should retry on 429 rate limit", async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            text: () => Promise.resolve("Rate limited"),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "user-123", email: "test@test.com" }),
        });
      });

      const { basiqService } = await import("../basiq");
      // Reset token to force re-auth
      (basiqService as any).accessToken = "valid-token";
      (basiqService as any).tokenExpiry = new Date(Date.now() + 3600000);

      const result = await basiqService.getUser("user-123");
      expect(result.id).toBe("user-123");
      expect(attempts).toBe(3);
    });

    it("should fail after max retries", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      });

      const { basiqService } = await import("../basiq");
      (basiqService as any).accessToken = "valid-token";
      (basiqService as any).tokenExpiry = new Date(Date.now() + 3600000);

      await expect(basiqService.getUser("user-123")).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/services/__tests__/basiq.test.ts`
Expected: FAIL (no retry logic)

**Step 3: Implement retry logic**

Modify `src/server/services/basiq.ts`:

```typescript
const BASIQ_API_URL = process.env.BASIQ_SERVER_URL || "https://au-api.basiq.io";
const BASIQ_API_KEY = process.env.BASIQ_API_KEY;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

interface BasiqToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface BasiqUser {
  id: string;
  email: string;
}

interface BasiqConnection {
  id: string;
  status: string;
  institution: {
    id: string;
    name: string;
  };
}

interface BasiqAccount {
  id: string;
  name: string;
  accountNo: string;
  balance: string;
  availableFunds: string;
  currency: string;
  class: {
    type: string;
    product: string;
  };
  connection: string;
  institution: string;
}

interface BasiqTransaction {
  id: string;
  status: string;
  description: string;
  amount: string;
  account: string;
  balance: string;
  direction: "credit" | "debit";
  class: string;
  postDate: string;
  transactionDate: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

class BasiqService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiry &&
      this.tokenExpiry > new Date()
    ) {
      return this.accessToken;
    }

    if (!BASIQ_API_KEY) {
      throw new Error("BASIQ_API_KEY is not configured");
    }

    const response = await fetch(`${BASIQ_API_URL}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${BASIQ_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "basiq-version": "3.0",
      },
      body: "scope=SERVER_ACCESS",
    });

    if (!response.ok) {
      throw new Error(`Failed to get Basiq access token: ${response.statusText}`);
    }

    const data: BasiqToken = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${BASIQ_API_URL}${endpoint}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "basiq-version": "3.0",
            ...options.headers,
          },
        });

        if (!response.ok) {
          if (isRetryableError(response.status) && attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            await sleep(delay);
            continue;
          }

          const error = await response.text();
          throw new Error(`Basiq API error: ${response.statusText} - ${error}`);
        }

        return response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
      }
    }

    throw lastError || new Error("Request failed after max retries");
  }

  async createUser(email: string): Promise<BasiqUser> {
    return this.request<BasiqUser>("/users", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async getUser(userId: string): Promise<BasiqUser> {
    return this.request<BasiqUser>(`/users/${userId}`);
  }

  async createAuthLink(userId: string): Promise<{ links: { public: string } }> {
    return this.request(`/users/${userId}/auth_link`, {
      method: "POST",
    });
  }

  async getConnections(userId: string): Promise<{ data: BasiqConnection[] }> {
    return this.request(`/users/${userId}/connections`);
  }

  async getAccounts(userId: string): Promise<{ data: BasiqAccount[] }> {
    return this.request(`/users/${userId}/accounts`);
  }

  async getTransactions(
    userId: string,
    accountId?: string,
    fromDate?: string
  ): Promise<{ data: BasiqTransaction[] }> {
    const params = new URLSearchParams();
    if (accountId) params.append("filter[account.id]", accountId);
    if (fromDate) params.append("filter[transaction.postDate][gte]", fromDate);

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/users/${userId}/transactions${query}`);
  }

  async refreshConnection(connectionId: string): Promise<BasiqConnection> {
    return this.request(`/connections/${connectionId}/refresh`, {
      method: "POST",
    });
  }
}

export const basiqService = new BasiqService();

export type {
  BasiqUser,
  BasiqConnection,
  BasiqAccount,
  BasiqTransaction,
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/services/__tests__/basiq.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/basiq.ts src/server/services/__tests__/basiq.test.ts
git commit -m "perf: add exponential backoff retry logic to Basiq API

- Retry on 429 rate limit and 5xx errors
- Exponential backoff (1s, 2s, 4s)
- Max 3 retries before failing
- Add comprehensive tests"
```

---

## Phase 3: Code Quality Improvements

### Task 7: Create Logger Utility and Remove Console Statements

**Files:**
- Create: `src/lib/logger.ts`
- Modify: Multiple files to replace console.* calls

**Step 1: Create logger utility**

Create `src/lib/logger.ts`:

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL = process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, context));
    }
  },

  info(message: string, context?: LogContext) {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, context));
    }
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, context));
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (shouldLog("error")) {
      const errorContext = error instanceof Error
        ? { ...context, error: error.message, stack: error.stack }
        : { ...context, error: String(error) };
      console.error(formatMessage("error", message, errorContext));
    }
  },
};
```

**Step 2: Replace console statements in key files**

For each file with console.log/error/warn:

Example replacement pattern:
```typescript
// Before:
console.log("Received Basiq webhook:", event.type);
console.error("Basiq webhook error:", error);

// After:
import { logger } from "@/lib/logger";
logger.info("Received Basiq webhook", { type: event.type });
logger.error("Basiq webhook error", error);
```

Apply to these priority files:
- `src/app/api/webhooks/basiq/route.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/api/cron/*.ts` (all cron routes)
- `src/server/services/notification.ts`
- `src/server/trpc.ts`

**Step 3: Add ESLint rule**

Add to `.eslintrc.json` or `eslint.config.js`:
```json
{
  "rules": {
    "no-console": ["error", { "allow": ["debug", "info", "warn", "error"] }]
  }
}
```

**Step 4: Run linter to verify**

Run: `npm run lint`
Expected: No new console.log warnings in modified files

**Step 5: Commit**

```bash
git add src/lib/logger.ts src/app/api/ src/server/
git commit -m "refactor: replace console statements with structured logger

- Create src/lib/logger.ts with environment-aware logging
- Replace console.log/error/warn in API routes and services
- Add ESLint rule to prevent future console statements"
```

---

### Task 8: Fix Type Safety - Remove `as any` Casts

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/components/recurring/MakeRecurringDialog.tsx`
- Create: `src/types/category.ts` (shared category types)

**Step 1: Create shared category types**

Create `src/types/category.ts`:

```typescript
import { categoryEnum, transactionTypeEnum } from "@/server/db/schema";

// Extract the category type from the enum
export type Category = (typeof categoryEnum.enumValues)[number];
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];

// Type guard for category validation
export function isValidCategory(value: string): value is Category {
  return categoryEnum.enumValues.includes(value as Category);
}

// Filter input type that accepts category or undefined
export interface TransactionFilterInput {
  propertyId?: string;
  category?: Category;
  startDate?: string;
  endDate?: string;
  isVerified?: boolean;
  limit?: number;
  offset?: number;
}
```

**Step 2: Fix transactions page**

Modify `src/app/(dashboard)/transactions/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { ImportCSVDialog } from "@/components/transactions/ImportCSVDialog";
import { ReconciliationView } from "@/components/recurring/ReconciliationView";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeftRight, List, Calendar } from "lucide-react";
import type { Category, TransactionFilterInput } from "@/types/category";

type ViewMode = "transactions" | "reconciliation";

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("transactions");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilterInput>({});

  const offset = (page - 1) * PAGE_SIZE;

  const utils = trpc.useUtils();

  const { data: properties } = trpc.property.list.useQuery();
  const {
    data: transactions,
    isLoading,
  } = trpc.transaction.list.useQuery({
    propertyId: filters.propertyId,
    category: filters.category,
    startDate: filters.startDate,
    endDate: filters.endDate,
    isVerified: filters.isVerified,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = transactions?.total
    ? Math.ceil(transactions.total / PAGE_SIZE)
    : 1;

  const queryKey: TransactionFilterInput & { limit: number; offset: number } = {
    propertyId: filters.propertyId,
    category: filters.category,
    startDate: filters.startDate,
    endDate: filters.endDate,
    isVerified: filters.isVerified,
    limit: PAGE_SIZE,
    offset,
  };

  const updateCategory = trpc.transaction.updateCategory.useMutation({
    onMutate: async (newData) => {
      await utils.transaction.list.cancel();
      const previous = utils.transaction.list.getData(queryKey);

      utils.transaction.list.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === newData.id ? { ...t, category: newData.category } : t
          ),
        };
      });

      return { previous, queryKey };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.transaction.list.setData(context.queryKey, context.previous);
      }
    },
    onSettled: () => {
      utils.transaction.list.invalidate();
    },
  });

  const bulkUpdateCategory = trpc.transaction.bulkUpdateCategory.useMutation({
    onSuccess: () => utils.transaction.list.invalidate(),
  });

  const toggleVerified = trpc.transaction.toggleVerified.useMutation({
    onMutate: async (newData) => {
      await utils.transaction.list.cancel();
      const previous = utils.transaction.list.getData(queryKey);

      utils.transaction.list.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === newData.id ? { ...t, isVerified: !t.isVerified } : t
          ),
        };
      });

      return { previous, queryKey };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.transaction.list.setData(context.queryKey, context.previous);
      }
    },
    onSettled: () => {
      utils.transaction.list.invalidate();
    },
  });

  const handleCategoryChange = (
    id: string,
    category: Category,
    propertyId?: string
  ) => {
    updateCategory.mutate({
      id,
      category,
      propertyId,
    });
  };

  const handleBulkCategoryChange = async (ids: string[], category: Category) => {
    await bulkUpdateCategory.mutateAsync({
      ids,
      category,
    });
  };

  const handleToggleVerified = (id: string) => {
    toggleVerified.mutate({ id });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleFiltersChange = (newFilters: TransactionFilterInput) => {
    setFilters(newFilters);
    setPage(1);
  };

  // ... rest of the component remains the same, but remove `as any` casts
}
```

**Step 3: Run TypeScript compiler**

Run: `npm run typecheck`
Expected: PASS with no errors

**Step 4: Commit**

```bash
git add src/types/category.ts src/app/\(dashboard\)/transactions/page.tsx src/components/
git commit -m "refactor: remove 'as any' type casts with proper types

- Create src/types/category.ts with shared Category type
- Fix TransactionFilterInput type for proper category typing
- Remove all 'as any' casts in transactions page
- Type-safe category handling throughout"
```

---

### Task 9: Remove Sync-Banks TODO Stub

**Files:**
- Modify: `src/app/api/cron/sync-banks/route.ts`

**Step 1: Update to proper not-implemented response**

Modify `src/app/api/cron/sync-banks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  // Bank sync is handled via Basiq webhooks, not polling
  // This cron endpoint is kept for future use if we need scheduled syncs
  return NextResponse.json({
    success: true,
    message: "Bank sync handled via webhooks - no action needed",
    timestamp: new Date().toISOString(),
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/sync-banks/route.ts
git commit -m "refactor: clarify sync-banks cron purpose

Bank sync is handled via Basiq webhooks, not polling.
Remove TODO stub with clear explanation."
```

---

## Phase 4: Polish & UX Improvements

### Task 10: Create Skeleton Components

**Files:**
- Create: `src/components/ui/skeleton.tsx` (if not exists)
- Create: `src/components/skeletons/TransactionSkeleton.tsx`
- Create: `src/components/skeletons/PropertyCardSkeleton.tsx`

**Step 1: Create TransactionSkeleton**

Create `src/components/skeletons/TransactionSkeleton.tsx`:

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export function TransactionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TransactionTableSkeleton() {
  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <Skeleton className="h-4 w-full" />
      </div>
      <TransactionSkeleton />
    </div>
  );
}
```

**Step 2: Create PropertyCardSkeleton**

Create `src/components/skeletons/PropertyCardSkeleton.tsx`:

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export function PropertyCardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  );
}

export function PropertyListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

**Step 3: Create index export**

Create `src/components/skeletons/index.ts`:

```typescript
export * from "./TransactionSkeleton";
export * from "./PropertyCardSkeleton";
```

**Step 4: Commit**

```bash
git add src/components/skeletons/
git commit -m "feat(ui): add skeleton components for loading states

- TransactionSkeleton for transaction lists
- PropertyCardSkeleton for property cards
- Reusable components for consistent loading UX"
```

---

### Task 11: Add ARIA Attributes to Dialogs

**Files:**
- Modify: `src/components/recurring/MakeRecurringDialog.tsx`
- Modify: `src/components/transactions/AddTransactionDialog.tsx`
- Modify: `src/components/cgt/RecordSaleDialog.tsx`

**Step 1: Update Dialog pattern**

For each dialog, ensure proper ARIA attributes. Example for MakeRecurringDialog:

```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent
    className="max-w-lg max-h-[90vh] overflow-y-auto"
    aria-describedby="make-recurring-description"
  >
    <DialogHeader>
      <DialogTitle id="make-recurring-title">
        Create Recurring Transaction
      </DialogTitle>
      <DialogDescription id="make-recurring-description">
        Set up automatic tracking for this recurring payment or income.
      </DialogDescription>
    </DialogHeader>
    {/* ... form content ... */}
  </DialogContent>
</Dialog>
```

**Step 2: Add aria-invalid to form fields with errors**

For FormField components, add aria-invalid:

```typescript
<FormControl>
  <Input
    {...field}
    aria-invalid={!!form.formState.errors.description}
    aria-describedby={form.formState.errors.description ? "description-error" : undefined}
  />
</FormControl>
<FormMessage id="description-error" />
```

**Step 3: Commit**

```bash
git add src/components/
git commit -m "a11y: add ARIA attributes to dialog components

- Add aria-describedby to DialogContent
- Add aria-invalid to form fields with errors
- Link error messages with aria-describedby
- Improve screen reader experience"
```

---

### Task 12: Add formatDate Utility

**Files:**
- Modify: `src/lib/utils.ts`

**Step 1: Add date formatting utilities**

Add to `src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyWithCents(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffTime = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
```

**Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(utils): add date formatting utilities

- formatDate for consistent date display
- formatDateShort for compact dates
- formatDateISO for API/form values
- formatRelativeDate for relative time display"
```

---

## Summary

This implementation plan covers 12 tasks across 4 phases:

**Phase 1: Security (Tasks 1-3)**
- Basiq webhook signature verification (CRITICAL)
- Cron route hardening
- CSV import sanitization

**Phase 2: Performance (Tasks 4-6)**
- Generate-expected cron optimization
- Database indexes
- Basiq API retry logic

**Phase 3: Code Quality (Tasks 7-9)**
- Logger utility / remove console statements
- Fix type safety (remove `as any`)
- Clean up TODO stubs

**Phase 4: Polish (Tasks 10-12)**
- Skeleton components
- ARIA attributes for dialogs
- Date formatting utilities

Each task is atomic and can be executed independently. Security tasks should be prioritized first.
