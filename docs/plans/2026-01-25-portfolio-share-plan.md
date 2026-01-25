# Portfolio Share Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to create shareable portfolio reports with web links and PDF export for viral distribution.

**Architecture:** New `portfolioShares` table stores snapshot data with privacy modes. Public route `/share/[token]` renders reports without auth. Client-side PDF generation using existing jsPDF.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, jsPDF, Tailwind CSS

---

## Task 1: Add portfolioShares schema

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `src/server/db/__tests__/schema-share.test.ts`

**Step 1: Write the failing test**

Create `src/server/db/__tests__/schema-share.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  portfolioShares,
  portfolioSharesRelations,
  privacyModeEnum,
  type PortfolioShare,
  type NewPortfolioShare,
} from "../schema";

describe("Portfolio shares schema", () => {
  it("exports portfolioShares table", () => {
    expect(portfolioShares).toBeDefined();
    expect(portfolioShares.id).toBeDefined();
    expect(portfolioShares.userId).toBeDefined();
    expect(portfolioShares.token).toBeDefined();
    expect(portfolioShares.title).toBeDefined();
    expect(portfolioShares.privacyMode).toBeDefined();
    expect(portfolioShares.snapshotData).toBeDefined();
    expect(portfolioShares.expiresAt).toBeDefined();
    expect(portfolioShares.viewCount).toBeDefined();
    expect(portfolioShares.createdAt).toBeDefined();
    expect(portfolioShares.lastViewedAt).toBeDefined();
  });

  it("exports privacyModeEnum", () => {
    expect(privacyModeEnum).toBeDefined();
    expect(privacyModeEnum.enumValues).toContain("full");
    expect(privacyModeEnum.enumValues).toContain("summary");
    expect(privacyModeEnum.enumValues).toContain("redacted");
  });

  it("exports portfolioSharesRelations", () => {
    expect(portfolioSharesRelations).toBeDefined();
  });

  it("exports PortfolioShare type", () => {
    const share: Partial<PortfolioShare> = {
      id: "test-id",
      token: "abc123",
      privacyMode: "full",
    };
    expect(share.id).toBe("test-id");
  });

  it("exports NewPortfolioShare type", () => {
    const newShare: Partial<NewPortfolioShare> = {
      userId: "user-id",
      token: "abc123",
      title: "Test Share",
      privacyMode: "full",
    };
    expect(newShare.userId).toBe("user-id");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/schema-share.test.ts`
Expected: FAIL with import errors

**Step 3: Write the implementation**

Add to `src/server/db/schema.ts` after existing enums:

```typescript
export const privacyModeEnum = pgEnum("privacy_mode", [
  "full",
  "summary",
  "redacted",
]);
```

Add after existing tables:

```typescript
export const portfolioShares = pgTable("portfolio_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  title: text("title").notNull(),
  privacyMode: privacyModeEnum("privacy_mode").notNull().default("full"),
  snapshotData: jsonb("snapshot_data").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
});

export const portfolioSharesRelations = relations(portfolioShares, ({ one }) => ({
  user: one(users, {
    fields: [portfolioShares.userId],
    references: [users.id],
  }),
}));
```

Add type exports at the bottom with other types:

```typescript
export type PortfolioShare = typeof portfolioShares.$inferSelect;
export type NewPortfolioShare = typeof portfolioShares.$inferInsert;
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/schema-share.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-share.test.ts
git commit -m "feat(share): add portfolioShares schema with privacy modes"
```

---

## Task 2: Create share service with snapshot generation

**Files:**
- Create: `src/server/services/share.ts`
- Create: `src/server/services/__tests__/share.test.ts`

**Step 1: Write the failing test**

Create `src/server/services/__tests__/share.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  generateShareToken,
  transformForPrivacy,
  type PortfolioSnapshot,
} from "../share";

describe("Share service", () => {
  describe("generateShareToken", () => {
    it("generates a URL-safe token", () => {
      const token = generateShareToken();
      expect(token).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(16);
    });

    it("generates unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateShareToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe("transformForPrivacy", () => {
    const fullSnapshot: PortfolioSnapshot = {
      generatedAt: "2026-01-25T00:00:00Z",
      summary: {
        propertyCount: 3,
        states: ["VIC", "NSW"],
        totalValue: 2500000,
        totalDebt: 1800000,
        totalEquity: 700000,
        portfolioLVR: 72,
        cashFlow: 2500,
        averageYield: 4.2,
      },
      properties: [
        {
          address: "42 Smith St",
          suburb: "Richmond",
          state: "VIC",
          currentValue: 850000,
          totalLoans: 600000,
          equity: 250000,
          lvr: 70.6,
          cashFlow: 800,
          grossYield: 4.5,
          portfolioPercent: 34,
        },
        {
          address: "15 Jones Ave",
          suburb: "Bondi",
          state: "NSW",
          currentValue: 1650000,
          totalLoans: 1200000,
          equity: 450000,
          lvr: 72.7,
          cashFlow: 1700,
          grossYield: 4.0,
          portfolioPercent: 66,
        },
      ],
    };

    it("returns full data for full mode", () => {
      const result = transformForPrivacy(fullSnapshot, "full");
      expect(result).toEqual(fullSnapshot);
    });

    it("removes properties array for summary mode", () => {
      const result = transformForPrivacy(fullSnapshot, "summary");
      expect(result.summary).toEqual(fullSnapshot.summary);
      expect(result.properties).toBeUndefined();
    });

    it("redacts addresses and amounts for redacted mode", () => {
      const result = transformForPrivacy(fullSnapshot, "redacted");

      // Summary should have no dollar amounts
      expect(result.summary.totalValue).toBeUndefined();
      expect(result.summary.totalDebt).toBeUndefined();
      expect(result.summary.totalEquity).toBeUndefined();
      expect(result.summary.cashFlow).toBeUndefined();

      // Percentages should remain
      expect(result.summary.portfolioLVR).toBe(72);
      expect(result.summary.averageYield).toBe(4.2);
      expect(result.summary.propertyCount).toBe(3);

      // Properties should have suburb only, no address
      expect(result.properties![0].address).toBeUndefined();
      expect(result.properties![0].suburb).toBe("Richmond");
      expect(result.properties![0].currentValue).toBeUndefined();
      expect(result.properties![0].lvr).toBe(70.6);
      expect(result.properties![0].portfolioPercent).toBe(34);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/share.test.ts`
Expected: FAIL with import errors

**Step 3: Write the implementation**

Create `src/server/services/share.ts`:

```typescript
import { randomBytes } from "crypto";

export interface PropertySnapshot {
  address?: string;
  suburb: string;
  state: string;
  currentValue?: number;
  totalLoans?: number;
  equity?: number;
  lvr?: number;
  cashFlow?: number;
  grossYield?: number;
  portfolioPercent: number;
}

export interface SummarySnapshot {
  propertyCount: number;
  states: string[];
  totalValue?: number;
  totalDebt?: number;
  totalEquity?: number;
  portfolioLVR?: number;
  cashFlow?: number;
  averageYield?: number;
  cashFlowPositive?: boolean;
}

export interface PortfolioSnapshot {
  generatedAt: string;
  summary: SummarySnapshot;
  properties?: PropertySnapshot[];
}

export type PrivacyMode = "full" | "summary" | "redacted";

export function generateShareToken(): string {
  return randomBytes(12).toString("base64url");
}

export function transformForPrivacy(
  snapshot: PortfolioSnapshot,
  mode: PrivacyMode
): PortfolioSnapshot {
  if (mode === "full") {
    return snapshot;
  }

  if (mode === "summary") {
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      // No properties array
    };
  }

  // Redacted mode
  const redactedSummary: SummarySnapshot = {
    propertyCount: snapshot.summary.propertyCount,
    states: snapshot.summary.states,
    portfolioLVR: snapshot.summary.portfolioLVR,
    averageYield: snapshot.summary.averageYield,
    cashFlowPositive: snapshot.summary.cashFlow !== undefined
      ? snapshot.summary.cashFlow >= 0
      : undefined,
  };

  const redactedProperties = snapshot.properties?.map((p) => ({
    suburb: p.suburb,
    state: p.state,
    lvr: p.lvr,
    grossYield: p.grossYield,
    portfolioPercent: p.portfolioPercent,
  }));

  return {
    generatedAt: snapshot.generatedAt,
    summary: redactedSummary,
    properties: redactedProperties,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/share.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/server/services/share.ts src/server/services/__tests__/share.test.ts
git commit -m "feat(share): add share service with token generation and privacy transforms"
```

---

## Task 3: Create share tRPC router

**Files:**
- Create: `src/server/routers/share.ts`
- Create: `src/server/routers/__tests__/share.test.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing test**

Create `src/server/routers/__tests__/share.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shareRouter } from "../share";

describe("Share router", () => {
  it("exports shareRouter", () => {
    expect(shareRouter).toBeDefined();
  });

  it("has create procedure", () => {
    expect(shareRouter.create).toBeDefined();
  });

  it("has list procedure", () => {
    expect(shareRouter.list).toBeDefined();
  });

  it("has revoke procedure", () => {
    expect(shareRouter.revoke).toBeDefined();
  });

  it("has getByToken procedure", () => {
    expect(shareRouter.getByToken).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/routers/__tests__/share.test.ts`
Expected: FAIL with import errors

**Step 3: Write the implementation**

Create `src/server/routers/share.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure, publicProcedure } from "../trpc";
import { portfolioShares, properties, propertyValues, loans, transactions } from "../db/schema";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import {
  generateShareToken,
  transformForPrivacy,
  type PortfolioSnapshot,
  type PrivacyMode,
} from "../services/share";
import { getDateRangeForPeriod } from "../services/portfolio";

export const shareRouter = router({
  create: writeProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        privacyMode: z.enum(["full", "summary", "redacted"]),
        expiresInDays: z.number().int().min(7).max(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate snapshot from current portfolio data
      const { startDate, endDate } = getDateRangeForPeriod("annual");

      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      });

      if (userProperties.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No properties to share",
        });
      }

      const propertyIds = userProperties.map((p) => p.id);

      // Get latest values
      const allValues = await ctx.db.query.propertyValues.findMany({
        where: and(
          eq(propertyValues.userId, ctx.portfolio.ownerId),
          inArray(propertyValues.propertyId, propertyIds)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const latestValues = new Map<string, number>();
      for (const v of allValues) {
        if (!latestValues.has(v.propertyId)) {
          latestValues.set(v.propertyId, Number(v.estimatedValue));
        }
      }

      // Get loans
      const allLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, ctx.portfolio.ownerId),
          inArray(loans.propertyId, propertyIds)
        ),
      });

      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Get transactions
      const periodTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          gte(transactions.date, startDate.toISOString().split("T")[0])
        ),
      });

      // Calculate totals
      const totalValue = Array.from(latestValues.values()).reduce((a, b) => a + b, 0);
      const totalDebt = Array.from(loansByProperty.values()).reduce((a, b) => a + b, 0);
      const totalEquity = totalValue - totalDebt;
      const portfolioLVR = totalValue > 0 ? (totalDebt / totalValue) * 100 : null;

      const income = periodTransactions
        .filter((t) => t.transactionType === "income" && propertyIds.includes(t.propertyId || ""))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = periodTransactions
        .filter((t) => t.transactionType === "expense" && propertyIds.includes(t.propertyId || ""))
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      const cashFlow = income - expenses;

      const states = [...new Set(userProperties.map((p) => p.state))];

      // Build snapshot
      const snapshot: PortfolioSnapshot = {
        generatedAt: new Date().toISOString(),
        summary: {
          propertyCount: userProperties.length,
          states,
          totalValue,
          totalDebt,
          totalEquity,
          portfolioLVR: portfolioLVR ? Math.round(portfolioLVR * 10) / 10 : undefined,
          cashFlow,
          averageYield: totalValue > 0 ? Math.round((income / totalValue) * 1000) / 10 : undefined,
        },
        properties: userProperties.map((p) => {
          const value = latestValues.get(p.id) || 0;
          const debt = loansByProperty.get(p.id) || 0;
          const propTransactions = periodTransactions.filter((t) => t.propertyId === p.id);
          const propIncome = propTransactions
            .filter((t) => t.transactionType === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const propExpenses = propTransactions
            .filter((t) => t.transactionType === "expense")
            .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

          return {
            address: p.address,
            suburb: p.suburb,
            state: p.state,
            currentValue: value,
            totalLoans: debt,
            equity: value - debt,
            lvr: value > 0 ? Math.round((debt / value) * 1000) / 10 : undefined,
            cashFlow: propIncome - propExpenses,
            grossYield: value > 0 ? Math.round((propIncome / value) * 1000) / 10 : undefined,
            portfolioPercent: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
          };
        }),
      };

      // Generate token and save
      const token = generateShareToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const [share] = await ctx.db
        .insert(portfolioShares)
        .values({
          userId: ctx.portfolio.ownerId,
          token,
          title: input.title,
          privacyMode: input.privacyMode,
          snapshotData: snapshot,
          expiresAt,
        })
        .returning();

      return {
        id: share.id,
        token: share.token,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/share/${share.token}`,
        expiresAt: share.expiresAt,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.portfolioShares.findMany({
      where: eq(portfolioShares.userId, ctx.portfolio.ownerId),
      orderBy: [desc(portfolioShares.createdAt)],
    });
  }),

  revoke: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(portfolioShares)
        .where(
          and(
            eq(portfolioShares.id, input.id),
            eq(portfolioShares.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
      }

      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const share = await ctx.db.query.portfolioShares.findFirst({
        where: eq(portfolioShares.token, input.token),
      });

      if (!share) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
      }

      if (new Date(share.expiresAt) < new Date()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share has expired" });
      }

      // Increment view count
      await ctx.db
        .update(portfolioShares)
        .set({
          viewCount: share.viewCount + 1,
          lastViewedAt: new Date(),
        })
        .where(eq(portfolioShares.id, share.id));

      const snapshot = share.snapshotData as PortfolioSnapshot;
      const transformedData = transformForPrivacy(snapshot, share.privacyMode as PrivacyMode);

      return {
        title: share.title,
        privacyMode: share.privacyMode,
        snapshotData: transformedData,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      };
    }),
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/routers/__tests__/share.test.ts`
Expected: PASS (5 tests)

**Step 5: Register router in _app.ts**

Add import at top of `src/server/routers/_app.ts`:

```typescript
import { shareRouter } from "./share";
```

Add to router object:

```typescript
share: shareRouter,
```

**Step 6: Commit**

```bash
git add src/server/routers/share.ts src/server/routers/__tests__/share.test.ts src/server/routers/_app.ts
git commit -m "feat(share): add share tRPC router with CRUD and public getByToken"
```

---

## Task 4: Create manage shares page

**Files:**
- Create: `src/app/(dashboard)/reports/share/page.tsx`

**Step 1: Create the page**

Create `src/app/(dashboard)/reports/share/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Copy, Trash2, Eye, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { CreateShareModal } from "@/components/share/CreateShareModal";

export default function ManageSharesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const utils = trpc.useUtils();

  const { data: shares, isLoading } = trpc.share.list.useQuery();

  const revokeMutation = trpc.share.revoke.useMutation({
    onSuccess: () => {
      toast.success("Share revoked");
      utils.share.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const isExpired = (expiresAt: Date) => new Date(expiresAt) < new Date();
  const isExpiringSoon = (expiresAt: Date) => {
    const daysUntil = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 3 && daysUntil > 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Shares</h2>
          <p className="text-muted-foreground">
            Create shareable reports of your portfolio
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Share
        </Button>
      </div>

      {!shares || shares.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Share2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No shares yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a shareable link to your portfolio for brokers, partners, or advisors.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Share
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Shares</CardTitle>
            <CardDescription>
              Manage your shareable portfolio links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Privacy</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell className="font-medium">{share.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {share.privacyMode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {isExpired(share.expiresAt) ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : isExpiringSoon(share.expiresAt) ? (
                        <Badge variant="secondary">
                          {format(new Date(share.expiresAt), "MMM d")}
                        </Badge>
                      ) : (
                        format(new Date(share.expiresAt), "MMM d, yyyy")
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        {share.viewCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => copyLink(share.token)}
                            disabled={isExpired(share.expiresAt)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => revokeMutation.mutate({ id: share.id })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateShareModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/app.*share" | head -5`
Expected: Error about missing CreateShareModal (expected, will create next)

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/share/page.tsx
git commit -m "feat(share): add manage shares page"
```

---

## Task 5: Create share modal component

**Files:**
- Create: `src/components/share/CreateShareModal.tsx`

**Step 1: Create the component**

Create `src/components/share/CreateShareModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface CreateShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const privacyModes = [
  {
    value: "full",
    label: "Full",
    description: "All details visible including addresses and amounts",
  },
  {
    value: "summary",
    label: "Summary",
    description: "Portfolio totals only, no individual properties",
  },
  {
    value: "redacted",
    label: "Redacted",
    description: "Percentages only, suburbs instead of addresses",
  },
] as const;

export function CreateShareModal({ open, onOpenChange }: CreateShareModalProps) {
  const defaultTitle = `Portfolio Summary - ${format(new Date(), "MMMM yyyy")}`;

  const [title, setTitle] = useState(defaultTitle);
  const [privacyMode, setPrivacyMode] = useState<"full" | "summary" | "redacted">("full");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const createMutation = trpc.share.create.useMutation({
    onSuccess: (data) => {
      setCreatedUrl(data.url);
      utils.share.list.invalidate();
      toast.success("Share created");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({ title, privacyMode, expiresInDays });
  };

  const handleCopy = () => {
    if (createdUrl) {
      navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedUrl(null);
    setTitle(defaultTitle);
    setPrivacyMode("full");
    setExpiresInDays(14);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdUrl ? "Share Created" : "Create Portfolio Share"}
          </DialogTitle>
          <DialogDescription>
            {createdUrl
              ? "Your shareable link is ready"
              : "Generate a shareable link to your portfolio"}
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={createdUrl} readOnly className="font-mono text-sm" />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This link will expire in {expiresInDays} days.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Portfolio Summary"
              />
            </div>

            <div className="space-y-2">
              <Label>Privacy Mode</Label>
              <Select
                value={privacyMode}
                onValueChange={(v) => setPrivacyMode(v as typeof privacyMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {privacyModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div>
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {mode.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expires In</Label>
              <Select
                value={String(expiresInDays)}
                onValueChange={(v) => setExpiresInDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdUrl ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Share
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/components/share" | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/share/CreateShareModal.tsx
git commit -m "feat(share): add create share modal component"
```

---

## Task 6: Create public share view page

**Files:**
- Create: `src/app/share/[token]/page.tsx`
- Create: `src/components/share/PortfolioReport.tsx`

**Step 1: Create the report component**

Create `src/components/share/PortfolioReport.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  MapPin,
} from "lucide-react";
import type { PortfolioSnapshot } from "@/server/services/share";

interface PortfolioReportProps {
  data: PortfolioSnapshot;
  privacyMode: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function PortfolioReport({ data, privacyMode }: PortfolioReportProps) {
  const { summary, properties } = data;
  const isRedacted = privacyMode === "redacted";
  const isSummary = privacyMode === "summary";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-2xl font-bold">{summary.propertyCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.states.join(", ")}
            </p>
          </CardContent>
        </Card>

        {!isRedacted && summary.totalEquity !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Equity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold">
                  {formatCurrency(summary.totalEquity)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {summary.portfolioLVR !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portfolio LVR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-orange-500" />
                <span className="text-2xl font-bold">
                  {formatPercent(summary.portfolioLVR)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {summary.averageYield !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gross Yield
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-2xl font-bold">
                  {formatPercent(summary.averageYield)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!isRedacted && summary.cashFlow !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Annual Cash Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.cashFlow >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={`text-2xl font-bold ${
                    summary.cashFlow >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(summary.cashFlow)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {isRedacted && summary.cashFlowPositive !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cash Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.cashFlowPositive ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <Badge variant="default" className="bg-green-500">Positive</Badge>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <Badge variant="destructive">Negative</Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Property Breakdown */}
      {!isSummary && properties && properties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Property Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {properties.map((property, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      {!isRedacted && property.address && (
                        <p className="font-medium">{property.address}</p>
                      )}
                      <p className={isRedacted ? "font-medium" : "text-sm text-muted-foreground"}>
                        {property.suburb}, {property.state}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    {!isRedacted && property.currentValue !== undefined && (
                      <div className="text-right">
                        <p className="text-muted-foreground">Value</p>
                        <p className="font-medium">{formatCurrency(property.currentValue)}</p>
                      </div>
                    )}
                    {property.lvr !== undefined && (
                      <div className="text-right">
                        <p className="text-muted-foreground">LVR</p>
                        <p className="font-medium">{formatPercent(property.lvr)}</p>
                      </div>
                    )}
                    {property.grossYield !== undefined && (
                      <div className="text-right">
                        <p className="text-muted-foreground">Yield</p>
                        <p className="font-medium">{formatPercent(property.grossYield)}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-muted-foreground">Portfolio</p>
                      <p className="font-medium">{property.portfolioPercent}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Create the public page**

Create `src/app/share/[token]/page.tsx`:

```typescript
import { db } from "@/server/db";
import { portfolioShares } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { transformForPrivacy, type PortfolioSnapshot, type PrivacyMode } from "@/server/services/share";
import { PortfolioReport } from "@/components/share/PortfolioReport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import { Download, Clock } from "lucide-react";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicSharePage({ params }: Props) {
  const { token } = await params;

  const share = await db.query.portfolioShares.findFirst({
    where: eq(portfolioShares.token, token),
  });

  if (!share) {
    notFound();
  }

  const now = new Date();
  const expiresAt = new Date(share.expiresAt);

  if (expiresAt < now) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Share Expired</h1>
          <p className="text-muted-foreground mb-4">
            This portfolio share link has expired.
          </p>
          <Link href="/">
            <Button>Go to PropertyTracker</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Update view count
  await db
    .update(portfolioShares)
    .set({
      viewCount: share.viewCount + 1,
      lastViewedAt: now,
    })
    .where(eq(portfolioShares.id, share.id));

  const snapshot = share.snapshotData as PortfolioSnapshot;
  const transformedData = transformForPrivacy(snapshot, share.privacyMode as PrivacyMode);
  const daysUntilExpiry = differenceInDays(expiresAt, now);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{share.title}</h1>
            <p className="text-sm text-muted-foreground">
              Generated {format(new Date(share.createdAt), "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {daysUntilExpiry <= 3 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {share.privacyMode}
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <PortfolioReport data={transformedData} privacyMode={share.privacyMode} />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Powered by{" "}
              <Link href="/" className="font-medium text-primary hover:underline">
                PropertyTracker
              </Link>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Professional property portfolio management for Australian investors
            </p>
          </div>
          <Link href="/sign-up">
            <Button variant="outline" size="sm">
              Create Your Own Portfolio
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/(app/share|components/share)" | head -5`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/share/[token]/page.tsx src/components/share/PortfolioReport.tsx
git commit -m "feat(share): add public share view page and portfolio report component"
```

---

## Task 7: Add PDF export functionality

**Files:**
- Create: `src/lib/share-pdf.ts`
- Modify: `src/components/share/PortfolioReport.tsx`

**Step 1: Create PDF generation utility**

Create `src/lib/share-pdf.ts`:

```typescript
import jsPDF from "jspdf";
import type { PortfolioSnapshot } from "@/server/services/share";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function generateSharePDF(
  data: PortfolioSnapshot,
  privacyMode: string,
  title: string
): Blob {
  const doc = new jsPDF();
  const isRedacted = privacyMode === "redacted";
  const isSummary = privacyMode === "summary";
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.text(title, 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date(data.generatedAt).toLocaleDateString("en-AU")}`, 20, y);
  doc.setTextColor(0);
  y += 15;

  // Summary Section
  doc.setFontSize(14);
  doc.text("Portfolio Summary", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Properties: ${data.summary.propertyCount} (${data.summary.states.join(", ")})`, 20, y);
  y += 6;

  if (!isRedacted && data.summary.totalValue !== undefined) {
    doc.text(`Total Value: ${formatCurrency(data.summary.totalValue)}`, 20, y);
    y += 6;
    doc.text(`Total Debt: ${formatCurrency(data.summary.totalDebt || 0)}`, 20, y);
    y += 6;
    doc.text(`Total Equity: ${formatCurrency(data.summary.totalEquity || 0)}`, 20, y);
    y += 6;
  }

  if (data.summary.portfolioLVR !== undefined) {
    doc.text(`Portfolio LVR: ${formatPercent(data.summary.portfolioLVR)}`, 20, y);
    y += 6;
  }

  if (data.summary.averageYield !== undefined) {
    doc.text(`Gross Yield: ${formatPercent(data.summary.averageYield)}`, 20, y);
    y += 6;
  }

  if (!isRedacted && data.summary.cashFlow !== undefined) {
    doc.text(`Annual Cash Flow: ${formatCurrency(data.summary.cashFlow)}`, 20, y);
    y += 6;
  } else if (isRedacted && data.summary.cashFlowPositive !== undefined) {
    doc.text(`Cash Flow: ${data.summary.cashFlowPositive ? "Positive" : "Negative"}`, 20, y);
    y += 6;
  }

  y += 10;

  // Property Breakdown
  if (!isSummary && data.properties && data.properties.length > 0) {
    doc.setFontSize(14);
    doc.text("Property Breakdown", 20, y);
    y += 10;

    doc.setFontSize(9);
    for (const property of data.properties) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      const location = isRedacted
        ? `${property.suburb}, ${property.state}`
        : `${property.address || ""}, ${property.suburb}, ${property.state}`;

      doc.setFontSize(10);
      doc.text(location, 20, y);
      y += 5;

      doc.setFontSize(9);
      const metrics: string[] = [];

      if (!isRedacted && property.currentValue !== undefined) {
        metrics.push(`Value: ${formatCurrency(property.currentValue)}`);
      }
      if (property.lvr !== undefined) {
        metrics.push(`LVR: ${formatPercent(property.lvr)}`);
      }
      if (property.grossYield !== undefined) {
        metrics.push(`Yield: ${formatPercent(property.grossYield)}`);
      }
      metrics.push(`Portfolio: ${property.portfolioPercent}%`);

      doc.text(metrics.join("  |  "), 25, y);
      y += 10;
    }
  }

  // Footer with branding
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Generated by PropertyTracker - propertytracker.com.au", 20, 285);
    doc.text(`Page ${i} of ${pageCount}`, 180, 285);
  }

  return doc.output("blob");
}
```

**Step 2: Add download button to public page**

Update `src/app/share/[token]/page.tsx`, add client component for PDF download.

Create `src/components/share/DownloadPDFButton.tsx`:

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateSharePDF } from "@/lib/share-pdf";
import { downloadBlob } from "@/lib/export-utils";
import type { PortfolioSnapshot } from "@/server/services/share";

interface DownloadPDFButtonProps {
  data: PortfolioSnapshot;
  privacyMode: string;
  title: string;
}

export function DownloadPDFButton({ data, privacyMode, title }: DownloadPDFButtonProps) {
  const handleDownload = () => {
    const blob = generateSharePDF(data, privacyMode, title);
    const filename = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    downloadBlob(blob, filename);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download PDF
    </Button>
  );
}
```

**Step 3: Update public page to include download button**

In `src/app/share/[token]/page.tsx`, add import:

```typescript
import { DownloadPDFButton } from "@/components/share/DownloadPDFButton";
```

Add button in header div after badges:

```typescript
<DownloadPDFButton
  data={transformedData}
  privacyMode={share.privacyMode}
  title={share.title}
/>
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E "^src/(lib/share|components/share)" | head -5`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/share-pdf.ts src/components/share/DownloadPDFButton.tsx src/app/share/[token]/page.tsx
git commit -m "feat(share): add PDF export functionality with PropertyTracker branding"
```

---

## Task 8: Run all tests and verify

**Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors in src/ files

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (warnings OK)

**Step 4: Commit any fixes**

If any fixes needed, commit them.

---

## Task 9: Add navigation link to shares page

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add link to sidebar**

In `src/components/layout/Sidebar.tsx`, find the reports section and add a link for Portfolio Shares:

```typescript
{
  href: "/reports/share",
  label: "Portfolio Shares",
  icon: Share2,
},
```

Add `Share2` to the lucide-react imports.

**Step 2: Verify navigation works**

Run: `npm run dev`
Navigate to the shares page via sidebar.

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(share): add portfolio shares link to sidebar navigation"
```

---

## Summary

**Total tasks:** 9

**Files created:**
- `src/server/db/__tests__/schema-share.test.ts`
- `src/server/services/share.ts`
- `src/server/services/__tests__/share.test.ts`
- `src/server/routers/share.ts`
- `src/server/routers/__tests__/share.test.ts`
- `src/app/(dashboard)/reports/share/page.tsx`
- `src/components/share/CreateShareModal.tsx`
- `src/components/share/PortfolioReport.tsx`
- `src/components/share/DownloadPDFButton.tsx`
- `src/app/share/[token]/page.tsx`
- `src/lib/share-pdf.ts`

**Files modified:**
- `src/server/db/schema.ts`
- `src/server/routers/_app.ts`
- `src/components/layout/Sidebar.tsx`
