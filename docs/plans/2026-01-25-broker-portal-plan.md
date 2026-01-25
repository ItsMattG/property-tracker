# Broker Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to generate shareable "Loan Application Pack" reports with portfolio data for mortgage brokers.

**Architecture:** Token-based shareable links similar to existing portfolio share feature. Snapshot data captured at generation time, stored as JSONB. Public web view with PDF download option.

**Tech Stack:** Drizzle ORM, tRPC, Next.js App Router, @react-pdf/renderer

---

## Task 1: Database Schema

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/0010_loan_packs.sql`

**Step 1: Add loan_packs table to schema.ts**

Add after the `equityMilestones` table (around line 1535):

```typescript
export const loanPacks = pgTable(
  "loan_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").default(0).notNull(),
    snapshotData: jsonb("snapshot_data").notNull(),
  },
  (table) => [
    index("loan_packs_user_id_idx").on(table.userId),
    index("loan_packs_token_idx").on(table.token),
    index("loan_packs_expires_at_idx").on(table.expiresAt),
  ]
);
```

**Step 2: Add relations**

After the table definition, add:

```typescript
export const loanPacksRelations = relations(loanPacks, ({ one }) => ({
  user: one(users, {
    fields: [loanPacks.userId],
    references: [users.id],
  }),
}));
```

**Step 3: Add type exports**

At the end of the type exports section:

```typescript
export type LoanPack = typeof loanPacks.$inferSelect;
export type NewLoanPack = typeof loanPacks.$inferInsert;
```

**Step 4: Create migration file**

Create `drizzle/0010_loan_packs.sql`:

```sql
CREATE TABLE IF NOT EXISTS "loan_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accessed_at" timestamp with time zone,
  "access_count" integer DEFAULT 0 NOT NULL,
  "snapshot_data" jsonb NOT NULL
);

ALTER TABLE "loan_packs" ADD CONSTRAINT "loan_packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "loan_packs_user_id_idx" ON "loan_packs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "loan_packs_token_idx" ON "loan_packs" USING btree ("token");
CREATE INDEX IF NOT EXISTS "loan_packs_expires_at_idx" ON "loan_packs" USING btree ("expires_at");
```

**Step 5: Run migration**

```bash
npm run db:push
```

**Step 6: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 7: Commit**

```bash
git add src/server/db/schema.ts drizzle/0010_loan_packs.sql
git commit -m "feat: add loan_packs schema for broker portal"
```

---

## Task 2: Snapshot Types and Generator Service

**Files:**
- Create: `src/server/services/loanPack.ts`

**Step 1: Create the service file with types and generator**

```typescript
import { randomBytes } from "crypto";
import { db } from "@/server/db";
import {
  properties,
  propertyValues,
  loans,
  transactions,
  complianceRecords,
  equityMilestones,
  users,
} from "@/server/db/schema";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { getRequirementsForState, type AustralianState } from "@/lib/compliance-requirements";
import { calculateComplianceStatus } from "./compliance";
import { formatMilestone } from "@/lib/equity-milestones";

// Snapshot interfaces
export interface LoanPackSnapshot {
  generatedAt: string;
  userName: string;

  portfolio: {
    properties: PropertyData[];
    totals: {
      totalValue: number;
      totalDebt: number;
      totalEquity: number;
      avgLvr: number;
    };
  };

  income: {
    monthlyRent: number;
    annualRent: number;
    byProperty: Array<{
      address: string;
      monthlyRent: number;
    }>;
  };

  expenses: {
    categories: Array<{
      name: string;
      monthlyAvg: number;
      annual: number;
    }>;
    totalMonthly: number;
    totalAnnual: number;
  };

  compliance: {
    items: Array<{
      property: string;
      type: string;
      status: string;
      dueDate: string | null;
    }>;
    summary: {
      compliant: number;
      overdue: number;
      upcoming: number;
    };
  };

  milestones: Array<{
    property: string;
    type: "lvr" | "equity_amount";
    value: number;
    formattedValue: string;
    achievedAt: string;
  }>;

  cashFlow: {
    monthlyNet: number;
    annualNet: number;
  };
}

interface PropertyData {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  valuationDate: string;
  valuationSource: string;
  loans: Array<{
    lender: string;
    balance: number;
    rate: number;
    type: string;
  }>;
  lvr: number;
  equity: number;
}

export function generateLoanPackToken(): string {
  return randomBytes(16).toString("base64url");
}

export async function generateLoanPackSnapshot(userId: string): Promise<LoanPackSnapshot> {
  // Get user for name
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get active properties
  const userProperties = await db.query.properties.findMany({
    where: and(eq(properties.userId, userId), eq(properties.status, "active")),
  });

  if (userProperties.length === 0) {
    throw new Error("No properties found");
  }

  const propertyIds = userProperties.map((p) => p.id);

  // Get latest valuations
  const allValues = await db.query.propertyValues.findMany({
    where: and(eq(propertyValues.userId, userId), inArray(propertyValues.propertyId, propertyIds)),
    orderBy: [desc(propertyValues.valueDate)],
  });

  const latestValuesByProperty = new Map<
    string,
    { value: number; date: string; source: string }
  >();
  for (const v of allValues) {
    if (!latestValuesByProperty.has(v.propertyId)) {
      latestValuesByProperty.set(v.propertyId, {
        value: Number(v.estimatedValue),
        date: v.valueDate,
        source: v.source,
      });
    }
  }

  // Get all loans
  const allLoans = await db.query.loans.findMany({
    where: and(eq(loans.userId, userId), inArray(loans.propertyId, propertyIds)),
  });

  const loansByProperty = new Map<
    string,
    Array<{ lender: string; balance: number; rate: number; type: string }>
  >();
  for (const loan of allLoans) {
    const list = loansByProperty.get(loan.propertyId) || [];
    list.push({
      lender: loan.lender,
      balance: Number(loan.currentBalance),
      rate: Number(loan.interestRate),
      type: loan.loanType,
    });
    loansByProperty.set(loan.propertyId, list);
  }

  // Get transactions for last 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDateStr = oneYearAgo.toISOString().split("T")[0];
  const endDateStr = new Date().toISOString().split("T")[0];

  const yearTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      gte(transactions.date, startDateStr),
      lte(transactions.date, endDateStr)
    ),
  });

  // Calculate income by property
  const incomeByProperty = new Map<string, number>();
  let totalIncome = 0;
  for (const t of yearTransactions) {
    if (t.transactionType === "income" && t.propertyId) {
      const current = incomeByProperty.get(t.propertyId) || 0;
      const amount = Number(t.amount);
      incomeByProperty.set(t.propertyId, current + amount);
      totalIncome += amount;
    }
  }

  // Calculate expenses by category
  const expensesByCategory = new Map<string, number>();
  let totalExpenses = 0;
  for (const t of yearTransactions) {
    if (t.transactionType === "expense") {
      const current = expensesByCategory.get(t.category) || 0;
      const amount = Math.abs(Number(t.amount));
      expensesByCategory.set(t.category, current + amount);
      totalExpenses += amount;
    }
  }

  // Get compliance records
  const allComplianceRecords = await db.query.complianceRecords.findMany({
    where: eq(complianceRecords.userId, userId),
  });

  const complianceItems: LoanPackSnapshot["compliance"]["items"] = [];
  let compliantCount = 0;
  let overdueCount = 0;
  let upcomingCount = 0;

  for (const property of userProperties) {
    const requirements = getRequirementsForState(property.state as AustralianState);
    const propertyRecords = allComplianceRecords.filter((r) => r.propertyId === property.id);

    for (const req of requirements) {
      const record = propertyRecords.find((r) => r.requirementId === req.id);
      if (record) {
        const nextDue = new Date(record.nextDueAt);
        const status = calculateComplianceStatus(nextDue);

        complianceItems.push({
          property: property.address,
          type: req.name,
          status,
          dueDate: record.nextDueAt,
        });

        if (status === "compliant") compliantCount++;
        else if (status === "overdue") overdueCount++;
        else upcomingCount++;
      }
    }
  }

  // Get milestones
  const allMilestones = await db.query.equityMilestones.findMany({
    where: and(eq(equityMilestones.userId, userId), inArray(equityMilestones.propertyId, propertyIds)),
    orderBy: [desc(equityMilestones.achievedAt)],
  });

  const milestonesData: LoanPackSnapshot["milestones"] = allMilestones.map((m) => {
    const property = userProperties.find((p) => p.id === m.propertyId);
    return {
      property: property?.address || "Unknown",
      type: m.milestoneType as "lvr" | "equity_amount",
      value: Number(m.milestoneValue),
      formattedValue: formatMilestone(m.milestoneType as "lvr" | "equity_amount", Number(m.milestoneValue)),
      achievedAt: m.achievedAt.toISOString(),
    };
  });

  // Build property data
  let totalValue = 0;
  let totalDebt = 0;

  const propertiesData: PropertyData[] = userProperties.map((property) => {
    const valuation = latestValuesByProperty.get(property.id);
    const propertyLoans = loansByProperty.get(property.id) || [];
    const propertyDebt = propertyLoans.reduce((sum, l) => sum + l.balance, 0);
    const value = valuation?.value || 0;
    const equity = value - propertyDebt;
    const lvr = value > 0 ? (propertyDebt / value) * 100 : 0;

    totalValue += value;
    totalDebt += propertyDebt;

    return {
      address: property.address,
      suburb: property.suburb,
      state: property.state,
      postcode: property.postcode,
      purchasePrice: Number(property.purchasePrice),
      purchaseDate: property.purchaseDate,
      currentValue: value,
      valuationDate: valuation?.date || property.purchaseDate,
      valuationSource: valuation?.source || "purchase_price",
      loans: propertyLoans,
      lvr,
      equity,
    };
  });

  const totalEquity = totalValue - totalDebt;
  const avgLvr = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

  // Build income by property array
  const incomeByPropertyArray = userProperties.map((p) => ({
    address: p.address,
    monthlyRent: (incomeByProperty.get(p.id) || 0) / 12,
  }));

  // Build expense categories array
  const expenseCategoriesArray = Array.from(expensesByCategory.entries()).map(([name, annual]) => ({
    name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    monthlyAvg: annual / 12,
    annual,
  }));

  const monthlyNet = totalIncome / 12 - totalExpenses / 12;
  const annualNet = totalIncome - totalExpenses;

  return {
    generatedAt: new Date().toISOString(),
    userName: user.name || user.email,

    portfolio: {
      properties: propertiesData,
      totals: {
        totalValue,
        totalDebt,
        totalEquity,
        avgLvr,
      },
    },

    income: {
      monthlyRent: totalIncome / 12,
      annualRent: totalIncome,
      byProperty: incomeByPropertyArray,
    },

    expenses: {
      categories: expenseCategoriesArray,
      totalMonthly: totalExpenses / 12,
      totalAnnual: totalExpenses,
    },

    compliance: {
      items: complianceItems,
      summary: {
        compliant: compliantCount,
        overdue: overdueCount,
        upcoming: upcomingCount,
      },
    },

    milestones: milestonesData,

    cashFlow: {
      monthlyNet,
      annualNet,
    },
  };
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 3: Commit**

```bash
git add src/server/services/loanPack.ts
git commit -m "feat: add loan pack snapshot generator service"
```

---

## Task 3: tRPC Router

**Files:**
- Create: `src/server/routers/loanPack.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/loanPack.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure, publicProcedure } from "../trpc";
import { loanPacks } from "../db/schema";
import { eq, and, desc, gt } from "drizzle-orm";
import { generateLoanPackToken, generateLoanPackSnapshot } from "../services/loanPack";

export const loanPackRouter = router({
  create: writeProcedure
    .input(
      z.object({
        expiresInDays: z.number().int().min(3).max(30).default(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate snapshot
      const snapshot = await generateLoanPackSnapshot(ctx.portfolio.ownerId);

      // Generate token and expiry
      const token = generateLoanPackToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      // Save to database
      const [pack] = await ctx.db
        .insert(loanPacks)
        .values({
          userId: ctx.portfolio.ownerId,
          token,
          expiresAt,
          snapshotData: snapshot,
        })
        .returning();

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const url = `${baseUrl}/share/loan-pack/${token}`;

      return {
        id: pack.id,
        token: pack.token,
        url,
        expiresAt: pack.expiresAt,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const packs = await ctx.db.query.loanPacks.findMany({
      where: eq(loanPacks.userId, ctx.portfolio.ownerId),
      orderBy: [desc(loanPacks.createdAt)],
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return packs.map((pack) => ({
      id: pack.id,
      token: pack.token,
      url: `${baseUrl}/share/loan-pack/${pack.token}`,
      expiresAt: pack.expiresAt,
      accessCount: pack.accessCount,
      createdAt: pack.createdAt,
      accessedAt: pack.accessedAt,
      isExpired: new Date() > pack.expiresAt,
    }));
  }),

  revoke: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(loanPacks)
        .where(
          and(eq(loanPacks.id, input.id), eq(loanPacks.userId, ctx.portfolio.ownerId))
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Loan pack not found",
        });
      }

      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const pack = await ctx.db.query.loanPacks.findFirst({
        where: eq(loanPacks.token, input.token),
      });

      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found or has been revoked",
        });
      }

      if (new Date() > pack.expiresAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This report has expired",
        });
      }

      // Update access tracking
      await ctx.db
        .update(loanPacks)
        .set({
          accessCount: pack.accessCount + 1,
          accessedAt: new Date(),
        })
        .where(eq(loanPacks.id, pack.id));

      return {
        snapshot: pack.snapshotData,
        createdAt: pack.createdAt,
        expiresAt: pack.expiresAt,
      };
    }),
});
```

**Step 2: Register the router in _app.ts**

Add import at the top:

```typescript
import { loanPackRouter } from "./loanPack";
```

Add to the router object:

```typescript
loanPack: loanPackRouter,
```

**Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 4: Commit**

```bash
git add src/server/routers/loanPack.ts src/server/routers/_app.ts
git commit -m "feat: add loan pack tRPC router"
```

---

## Task 4: Public Web View Page

**Files:**
- Create: `src/app/share/loan-pack/[token]/page.tsx`
- Create: `src/components/loanPack/LoanPackReport.tsx`

**Step 1: Create the LoanPackReport component**

Create `src/components/loanPack/LoanPackReport.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LoanPackSnapshot } from "@/server/services/loanPack";
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  Trophy,
  Wallet,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

interface LoanPackReportProps {
  data: LoanPackSnapshot;
}

export function LoanPackReport({ data }: LoanPackReportProps) {
  const { portfolio, income, expenses, compliance, milestones, cashFlow } = data;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Portfolio Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(portfolio.totals.totalValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Debt</p>
              <p className="text-2xl font-bold">{formatCurrency(portfolio.totals.totalDebt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Equity</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(portfolio.totals.totalEquity)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average LVR</p>
              <p className="text-2xl font-bold">{formatPercent(portfolio.totals.avgLvr)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Properties ({portfolio.properties.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {portfolio.properties.map((property, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium">{property.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {property.suburb}, {property.state} {property.postcode}
                    </p>
                  </div>
                  <Badge variant={property.lvr <= 80 ? "default" : "secondary"}>
                    {formatPercent(property.lvr)} LVR
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current Value</p>
                    <p className="font-medium">{formatCurrency(property.currentValue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Equity</p>
                    <p className="font-medium text-green-600">{formatCurrency(property.equity)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purchase Price</p>
                    <p className="font-medium">{formatCurrency(property.purchasePrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">{property.purchaseDate}</p>
                  </div>
                </div>
                {property.loans.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Loans</p>
                    <div className="space-y-2">
                      {property.loans.map((loan, lIdx) => (
                        <div key={lIdx} className="flex justify-between text-sm">
                          <span>{loan.lender}</span>
                          <span>
                            {formatCurrency(loan.balance)} @ {loan.rate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Income */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Rent</p>
              <p className="text-xl font-bold">{formatCurrency(income.monthlyRent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual Rent</p>
              <p className="text-xl font-bold">{formatCurrency(income.annualRent)}</p>
            </div>
          </div>
          {income.byProperty.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">By Property</p>
              <div className="space-y-2">
                {income.byProperty.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.address}</span>
                    <span>{formatCurrency(item.monthlyRent)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Average</p>
              <p className="text-xl font-bold">{formatCurrency(expenses.totalMonthly)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual Total</p>
              <p className="text-xl font-bold">{formatCurrency(expenses.totalAnnual)}</p>
            </div>
          </div>
          {expenses.categories.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">By Category</p>
              <div className="space-y-2">
                {expenses.categories.map((cat, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{cat.name}</span>
                    <span>{formatCurrency(cat.annual)}/yr</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Net</p>
              <p
                className={`text-xl font-bold ${cashFlow.monthlyNet >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatCurrency(cashFlow.monthlyNet)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual Net</p>
              <p
                className={`text-xl font-bold ${cashFlow.annualNet >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatCurrency(cashFlow.annualNet)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      {compliance.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge variant="default">{compliance.summary.compliant} Compliant</Badge>
              {compliance.summary.upcoming > 0 && (
                <Badge variant="secondary">{compliance.summary.upcoming} Upcoming</Badge>
              )}
              {compliance.summary.overdue > 0 && (
                <Badge variant="destructive">{compliance.summary.overdue} Overdue</Badge>
              )}
            </div>
            <div className="space-y-2">
              {compliance.items.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.property} - {item.type}
                  </span>
                  <Badge
                    variant={
                      item.status === "compliant"
                        ? "default"
                        : item.status === "overdue"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Milestones Achieved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.slice(0, 5).map((m, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {m.property} - {m.formattedValue}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(m.achievedAt).toLocaleDateString("en-AU")}
                  </span>
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

Create `src/app/share/loan-pack/[token]/page.tsx`:

```typescript
import { db } from "@/server/db";
import { loanPacks } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LoanPackReport } from "@/components/loanPack/LoanPackReport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import type { LoanPackSnapshot } from "@/server/services/loanPack";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function LoanPackViewPage({ params }: PageProps) {
  const { token } = await params;

  const [pack] = await db
    .select()
    .from(loanPacks)
    .where(eq(loanPacks.token, token))
    .limit(1);

  if (!pack) {
    notFound();
  }

  const now = new Date();
  const isExpired = now > new Date(pack.expiresAt);

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-muted p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">Report Expired</h1>
            <p className="text-muted-foreground mb-6">
              This loan pack report has expired and is no longer available.
            </p>
            <Link href="/">
              <Button>Go to PropertyTracker</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Update access tracking
  db.update(loanPacks)
    .set({
      accessCount: pack.accessCount + 1,
      accessedAt: now,
    })
    .where(eq(loanPacks.id, pack.id))
    .execute()
    .catch(() => {});

  const snapshot = pack.snapshotData as LoanPackSnapshot;
  const daysUntilExpiry = differenceInDays(new Date(pack.expiresAt), now);
  const isExpiringSoon = daysUntilExpiry <= 3 && daysUntilExpiry > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Loan Application Pack</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Generated for {snapshot.userName} on{" "}
                {format(new Date(snapshot.generatedAt), "MMMM d, yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isExpiringSoon && (
                <Badge variant="warning">
                  Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="secondary">
                Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <LoanPackReport data={snapshot} />
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Powered by{" "}
                <Link href="/" className="font-medium text-foreground hover:underline">
                  PropertyTracker
                </Link>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Track, analyze, and share your property investment portfolio
              </p>
            </div>
            <Link href="/sign-up">
              <Button variant="outline" size="sm">
                Create Your Free Account
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 4: Commit**

```bash
git add src/app/share/loan-pack src/components/loanPack
git commit -m "feat: add loan pack public web view"
```

---

## Task 5: PDF Generation

**Files:**
- Create: `src/app/api/loan-pack/[token]/pdf/route.ts`
- Create: `src/components/loanPack/LoanPackPDF.tsx`

**Step 1: Create PDF component**

Create `src/components/loanPack/LoanPackPDF.tsx`:

```typescript
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { LoanPackSnapshot } from "@/server/services/loanPack";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    width: "23%",
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    fontWeight: "bold",
  },
  propertyCard: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  propertyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  propertyAddress: {
    fontSize: 11,
    fontWeight: "bold",
  },
  propertySuburb: {
    fontSize: 9,
    color: "#666",
  },
  badge: {
    backgroundColor: "#e5e5e5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
  },
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

interface LoanPackPDFProps {
  data: LoanPackSnapshot;
}

export function LoanPackPDF({ data }: LoanPackPDFProps) {
  const { portfolio, income, expenses, cashFlow, compliance, milestones } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Loan Application Pack</Text>
          <Text style={styles.subtitle}>
            Generated for {data.userName} on{" "}
            {new Date(data.generatedAt).toLocaleDateString("en-AU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Summary</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Total Value</Text>
              <Text style={styles.value}>{formatCurrency(portfolio.totals.totalValue)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Total Debt</Text>
              <Text style={styles.value}>{formatCurrency(portfolio.totals.totalDebt)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Total Equity</Text>
              <Text style={styles.value}>{formatCurrency(portfolio.totals.totalEquity)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Average LVR</Text>
              <Text style={styles.value}>{formatPercent(portfolio.totals.avgLvr)}</Text>
            </View>
          </View>
        </View>

        {/* Properties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Properties ({portfolio.properties.length})</Text>
          {portfolio.properties.map((property, idx) => (
            <View key={idx} style={styles.propertyCard}>
              <View style={styles.propertyHeader}>
                <View>
                  <Text style={styles.propertyAddress}>{property.address}</Text>
                  <Text style={styles.propertySuburb}>
                    {property.suburb}, {property.state} {property.postcode}
                  </Text>
                </View>
                <Text style={styles.badge}>{formatPercent(property.lvr)} LVR</Text>
              </View>
              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Current Value</Text>
                  <Text style={{ fontSize: 10 }}>{formatCurrency(property.currentValue)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Equity</Text>
                  <Text style={{ fontSize: 10 }}>{formatCurrency(property.equity)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Purchase Price</Text>
                  <Text style={{ fontSize: 10 }}>{formatCurrency(property.purchasePrice)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Purchase Date</Text>
                  <Text style={{ fontSize: 10 }}>{property.purchaseDate}</Text>
                </View>
              </View>
              {property.loans.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>Loans</Text>
                  {property.loans.map((loan, lIdx) => (
                    <View key={lIdx} style={styles.row}>
                      <Text style={{ fontSize: 9 }}>{loan.lender}</Text>
                      <Text style={{ fontSize: 9 }}>
                        {formatCurrency(loan.balance)} @ {loan.rate}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by PropertyTracker • {new Date(data.generatedAt).toISOString()}
        </Text>
      </Page>

      {/* Page 2: Financials */}
      <Page size="A4" style={styles.page}>
        {/* Income */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Monthly Rent</Text>
              <Text style={styles.value}>{formatCurrency(income.monthlyRent)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Annual Rent</Text>
              <Text style={styles.value}>{formatCurrency(income.annualRent)}</Text>
            </View>
          </View>
          {income.byProperty.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {income.byProperty.map((item, idx) => (
                <View key={idx} style={styles.row}>
                  <Text style={{ fontSize: 9 }}>{item.address}</Text>
                  <Text style={{ fontSize: 9 }}>{formatCurrency(item.monthlyRent)}/mo</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Expenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Monthly Average</Text>
              <Text style={styles.value}>{formatCurrency(expenses.totalMonthly)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Annual Total</Text>
              <Text style={styles.value}>{formatCurrency(expenses.totalAnnual)}</Text>
            </View>
          </View>
          {expenses.categories.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {expenses.categories.map((cat, idx) => (
                <View key={idx} style={styles.row}>
                  <Text style={{ fontSize: 9 }}>{cat.name}</Text>
                  <Text style={{ fontSize: 9 }}>{formatCurrency(cat.annual)}/yr</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Cash Flow */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cash Flow</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Monthly Net</Text>
              <Text style={[styles.value, { color: cashFlow.monthlyNet >= 0 ? "#16a34a" : "#dc2626" }]}>
                {formatCurrency(cashFlow.monthlyNet)}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Annual Net</Text>
              <Text style={[styles.value, { color: cashFlow.annualNet >= 0 ? "#16a34a" : "#dc2626" }]}>
                {formatCurrency(cashFlow.annualNet)}
              </Text>
            </View>
          </View>
        </View>

        {/* Compliance */}
        {compliance.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliance Status</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <Text style={styles.badge}>{compliance.summary.compliant} Compliant</Text>
              {compliance.summary.upcoming > 0 && (
                <Text style={styles.badge}>{compliance.summary.upcoming} Upcoming</Text>
              )}
              {compliance.summary.overdue > 0 && (
                <Text style={[styles.badge, { backgroundColor: "#fecaca" }]}>
                  {compliance.summary.overdue} Overdue
                </Text>
              )}
            </View>
            {compliance.items.slice(0, 10).map((item, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={{ fontSize: 9 }}>
                  {item.property} - {item.type}
                </Text>
                <Text style={{ fontSize: 9 }}>{item.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Milestones Achieved</Text>
            {milestones.slice(0, 10).map((m, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={{ fontSize: 9 }}>
                  {m.property} - {m.formattedValue}
                </Text>
                <Text style={{ fontSize: 9 }}>
                  {new Date(m.achievedAt).toLocaleDateString("en-AU")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by PropertyTracker • {new Date(data.generatedAt).toISOString()}
        </Text>
      </Page>
    </Document>
  );
}
```

**Step 2: Create PDF API route**

Create `src/app/api/loan-pack/[token]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { loanPacks } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { LoanPackPDF } from "@/components/loanPack/LoanPackPDF";
import type { LoanPackSnapshot } from "@/server/services/loanPack";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const [pack] = await db
      .select()
      .from(loanPacks)
      .where(eq(loanPacks.token, token))
      .limit(1);

    if (!pack) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (new Date() > pack.expiresAt) {
      return NextResponse.json({ error: "Report expired" }, { status: 403 });
    }

    const snapshot = pack.snapshotData as LoanPackSnapshot;
    const pdfBuffer = await renderToBuffer(<LoanPackPDF data={snapshot} />);

    const filename = `loan-pack-${new Date(snapshot.generatedAt).toISOString().split("T")[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
```

**Step 3: Add download button to the public page**

Update `src/app/share/loan-pack/[token]/page.tsx` - add to the header section after the badges:

```typescript
<a
  href={`/api/loan-pack/${token}/pdf`}
  download
  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
>
  Download PDF
</a>
```

**Step 4: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 5: Commit**

```bash
git add src/components/loanPack/LoanPackPDF.tsx src/app/api/loan-pack
git commit -m "feat: add loan pack PDF generation"
```

---

## Task 6: Dashboard Integration

**Files:**
- Create: `src/components/loanPack/GenerateLoanPackButton.tsx`
- Create: `src/components/loanPack/GenerateLoanPackModal.tsx`
- Modify: `src/app/(dashboard)/page.tsx` (add button to dashboard)

**Step 1: Create the modal component**

Create `src/components/loanPack/GenerateLoanPackModal.tsx`:

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, Copy, Loader2 } from "lucide-react";

interface GenerateLoanPackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateLoanPackModal({ open, onOpenChange }: GenerateLoanPackModalProps) {
  const [expiryDays, setExpiryDays] = useState("7");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const createMutation = trpc.loanPack.create.useMutation({
    onSuccess: (data) => {
      setGeneratedUrl(data.url);
      utils.loanPack.list.invalidate();
    },
  });

  const handleGenerate = () => {
    createMutation.mutate({ expiresInDays: parseInt(expiryDays) });
  };

  const handleCopy = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setGeneratedUrl(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Loan Application Pack</DialogTitle>
          <DialogDescription>
            Create a shareable report with your portfolio data for your mortgage broker.
          </DialogDescription>
        </DialogHeader>

        {!generatedUrl ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Link Expiry</Label>
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger id="expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>The report will include:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Property details and valuations</li>
                  <li>Loan balances and rates</li>
                  <li>Income and expense summary</li>
                  <li>Compliance status</li>
                  <li>Equity milestones</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input value={generatedUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this link with your mortgage broker. The link will expire in {expiryDays} days.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create the button component**

Create `src/components/loanPack/GenerateLoanPackButton.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { GenerateLoanPackModal } from "./GenerateLoanPackModal";

export function GenerateLoanPackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-2 h-4 w-4" />
        Generate Loan Pack
      </Button>
      <GenerateLoanPackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
```

**Step 3: Add button to dashboard**

Find the dashboard page and add the button to a suitable location. Look at `src/app/(dashboard)/page.tsx`.

Add import:

```typescript
import { GenerateLoanPackButton } from "@/components/loanPack/GenerateLoanPackButton";
```

Add the button in an appropriate place in the dashboard header/actions area.

**Step 4: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 5: Commit**

```bash
git add src/components/loanPack/GenerateLoanPackButton.tsx src/components/loanPack/GenerateLoanPackModal.tsx src/app/\(dashboard\)/page.tsx
git commit -m "feat: add loan pack generation button to dashboard"
```

---

## Task 7: Management Page

**Files:**
- Create: `src/app/(dashboard)/settings/loan-packs/page.tsx`

**Step 1: Create the management page**

Create `src/app/(dashboard)/settings/loan-packs/page.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Copy, Check, Trash2, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";
import { GenerateLoanPackButton } from "@/components/loanPack/GenerateLoanPackButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function LoanPacksPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: packs, isLoading } = trpc.loanPack.list.useQuery();
  const utils = trpc.useUtils();

  const revokeMutation = trpc.loanPack.revoke.useMutation({
    onSuccess: () => {
      utils.loanPack.list.invalidate();
      setRevokeId(null);
    },
  });

  const handleCopy = async (id: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = () => {
    if (revokeId) {
      revokeMutation.mutate({ id: revokeId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loan Application Packs</h1>
          <p className="text-muted-foreground">
            Manage your shareable portfolio reports for mortgage brokers
          </p>
        </div>
        <GenerateLoanPackButton />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </CardContent>
        </Card>
      ) : !packs || packs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No loan packs yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate a loan pack to share your portfolio data with your mortgage broker.
            </p>
            <GenerateLoanPackButton />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {packs.map((pack) => (
            <Card key={pack.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Loan Pack - {format(new Date(pack.createdAt), "MMM d, yyyy")}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {pack.isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="secondary">
                          Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")}
                        </Badge>
                      )}
                      <span className="ml-2">{pack.accessCount} views</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!pack.isExpired && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(pack.id, pack.url)}
                        >
                          {copiedId === pack.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={pack.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRevokeId(pack.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!pack.isExpired && (
                <CardContent className="pt-0">
                  <div className="font-mono text-sm text-muted-foreground bg-muted p-2 rounded truncate">
                    {pack.url}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Loan Pack</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this loan pack and make the link inaccessible. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Add navigation link to settings**

Find the settings navigation and add a link to the loan packs page. Look for settings layout or sidebar component.

**Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

**Step 4: Run tests**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/settings/loan-packs
git commit -m "feat: add loan pack management page"
```

---

## Task 8: Final Verification

**Step 1: Run full test suite**

```bash
npm test
```

**Step 2: Run TypeScript check**

```bash
npm run typecheck
```

**Step 3: Run lint**

```bash
npm run lint
```

**Step 4: Manual testing checklist**

- [ ] Generate a loan pack from dashboard
- [ ] Copy link and open in incognito
- [ ] Verify all data sections display correctly
- [ ] Download PDF and verify contents
- [ ] View management page at /settings/loan-packs
- [ ] Revoke a pack and verify link no longer works
- [ ] Test expired pack shows error message

**Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup for broker portal"
```
