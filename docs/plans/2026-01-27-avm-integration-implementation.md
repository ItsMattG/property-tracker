# AVM Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automated property valuations with realistic mock data, a monthly cron job, and a dedicated Valuation tab per property.

**Architecture:** Enhanced mock valuation provider generates deterministic historical values anchored to purchase price. Monthly cron auto-updates all active properties. New Valuation tab on property detail shows current value, growth stats, and historical chart.

**Tech Stack:** Next.js App Router, TRPC, Drizzle ORM, Recharts, Tailwind CSS

---

### Task 1: Enhanced Mock Valuation Provider

**Files:**
- Modify: `src/server/services/valuation.ts`

**Step 1: Replace the existing `valuation.ts` with the enhanced provider**

The existing file has a basic `MockValuationProvider` that returns static values based on address hashing. Replace it with a trend-simulation provider that uses purchase price and date.

```typescript
export interface ValuationResult {
  estimatedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
  source: string;
}

export interface ValuationInput {
  propertyId: string;
  purchasePrice: number;
  purchaseDate: string; // ISO date string e.g. "2020-01-15"
  address: string;
  propertyType: string;
}

export interface ValuationProvider {
  getValuation(input: ValuationInput, targetDate?: Date): Promise<ValuationResult | null>;
  getName(): string;
}

// Deterministic hash for reproducible noise
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Returns a deterministic noise value in range [-0.002, +0.002] for a given property+month
function monthlyNoise(propertyId: string, monthIndex: number): number {
  const hash = hashString(`${propertyId}-month-${monthIndex}`);
  return ((hash % 401) - 200) / 100000; // range: -0.002 to +0.002
}

export class MockValuationProvider implements ValuationProvider {
  getName(): string {
    return "mock";
  }

  async getValuation(
    input: ValuationInput,
    targetDate?: Date
  ): Promise<ValuationResult | null> {
    const { propertyId, purchasePrice, purchaseDate } = input;

    if (purchasePrice <= 0) return null;

    const start = new Date(purchaseDate);
    const end = targetDate ?? new Date();
    const monthsElapsed = (end.getFullYear() - start.getFullYear()) * 12
      + (end.getMonth() - start.getMonth());

    if (monthsElapsed < 0) return null;

    const annualGrowthRate = 0.06;
    const monthlyBase = annualGrowthRate / 12;

    // Compound monthly with deterministic noise
    let value = purchasePrice;
    for (let i = 1; i <= monthsElapsed; i++) {
      const noise = monthlyNoise(propertyId, i);
      value *= (1 + monthlyBase + noise);
    }

    const estimatedValue = Math.round(value);
    const confidenceLow = Math.round(value * 0.92);
    const confidenceHigh = Math.round(value * 1.08);

    return { estimatedValue, confidenceLow, confidenceHigh, source: "mock" };
  }

  // Generate monthly valuations from purchase date to today
  async generateHistory(
    input: ValuationInput
  ): Promise<Array<ValuationResult & { valueDate: string }>> {
    const { purchasePrice, purchaseDate } = input;
    const start = new Date(purchaseDate);
    const now = new Date();
    const results: Array<ValuationResult & { valueDate: string }> = [];

    // Start from purchase month
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= now) {
      const result = await this.getValuation(input, current);
      if (result) {
        const valueDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
        results.push({ ...result, valueDate });
      }
      current.setMonth(current.getMonth() + 1);
    }

    return results;
  }
}

export function getValuationProvider(): ValuationProvider {
  const provider = process.env.VALUATION_PROVIDER;

  if (provider === "corelogic") {
    throw new Error("CoreLogic provider not implemented");
  }

  if (provider === "proptrack") {
    throw new Error("PropTrack provider not implemented");
  }

  return new MockValuationProvider();
}
```

**Step 2: Commit**

```bash
git add src/server/services/valuation.ts
git commit -m "feat(avm): enhance mock valuation provider with trend simulation"
```

---

### Task 2: TRPC Router — New Procedures

**Files:**
- Modify: `src/server/routers/propertyValue.ts`

**Step 1: Add `getValuationHistory`, `getCapitalGrowthStats`, and `triggerBackfill` procedures**

Add these after the existing `delete` procedure inside the `router({...})` call. The existing `list`, `getLatest`, `getCurrent`, `refresh`, `create`, `delete` procedures stay unchanged.

Important notes:
- The existing `refresh` mutation calls `provider.getValuation(fullAddress, "house")` with the OLD interface. Update it to use the new `ValuationInput` interface.
- `propertyValues.estimatedValue` is stored as `decimal(12,2)` (string in JS). Always convert with `Number()` or `parseFloat()`.
- `properties.purchasePrice` is also `decimal(12,2)` (string in JS).
- `loans.currentBalance` is `decimal(12,2)` (string in JS).
- Import `asc` from `drizzle-orm` (currently only `desc` is imported).

**Changes to make:**

1. Add `asc` to the drizzle-orm import: `import { eq, and, desc, asc } from "drizzle-orm";`

2. Add `import { loans } from "../db/schema";` (add `loans` to the existing schema import)

3. Add `import { sql } from "drizzle-orm";` (add `sql` to the existing drizzle import)

4. Update the `refresh` mutation to use the new `ValuationInput` interface:

```typescript
  refresh: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const provider = getValuationProvider();
      const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
      const result = await provider.getValuation({
        propertyId: property.id,
        purchasePrice: Number(property.purchasePrice),
        purchaseDate: property.purchaseDate,
        address: fullAddress,
        propertyType: "house",
      });

      if (!result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get valuation from provider" });
      }

      const [value] = await ctx.db
        .insert(propertyValues)
        .values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          estimatedValue: result.estimatedValue.toString(),
          confidenceLow: result.confidenceLow.toString(),
          confidenceHigh: result.confidenceHigh.toString(),
          valueDate: new Date().toISOString().split("T")[0],
          source: result.source as "mock" | "corelogic" | "proptrack",
          apiResponseId: `mock-${Date.now()}`,
        })
        .returning();

      return value;
    }),
```

5. Add new procedures after `delete`:

```typescript
  getValuationHistory: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.db.query.propertyValues.findMany({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [asc(propertyValues.valueDate)],
      });
    }),

  getCapitalGrowthStats: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const latestValuation = await ctx.db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const previousValuation = await ctx.db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
        offset: 1,
      });

      if (!latestValuation) {
        return null;
      }

      const currentValue = Number(latestValuation.estimatedValue);
      const purchasePrice = Number(property.purchasePrice);
      const totalGain = currentValue - purchasePrice;
      const totalGainPercent = purchasePrice > 0 ? (totalGain / purchasePrice) * 100 : 0;

      // Annualized growth rate
      const purchaseDate = new Date(property.purchaseDate);
      const now = new Date();
      const yearsHeld = (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const annualizedGrowth = yearsHeld > 0
        ? (Math.pow(currentValue / purchasePrice, 1 / yearsHeld) - 1) * 100
        : 0;

      // Month-over-month change
      const previousValue = previousValuation ? Number(previousValuation.estimatedValue) : null;
      const monthlyChange = previousValue ? currentValue - previousValue : null;
      const monthlyChangePercent = previousValue && previousValue > 0
        ? ((currentValue - previousValue) / previousValue) * 100
        : null;

      // Equity and LVR (if loan data exists)
      const loanResult = await ctx.db
        .select({ total: sql<string>`COALESCE(SUM(current_balance), 0)` })
        .from(loans)
        .where(eq(loans.propertyId, input.propertyId));

      const totalLoanBalance = Number(loanResult[0]?.total || 0);
      const equity = currentValue - totalLoanBalance;
      const lvr = currentValue > 0 ? (totalLoanBalance / currentValue) * 100 : 0;
      const hasLoans = totalLoanBalance > 0;

      return {
        currentValue,
        purchasePrice,
        totalGain,
        totalGainPercent: Math.round(totalGainPercent * 100) / 100,
        annualizedGrowth: Math.round(annualizedGrowth * 100) / 100,
        monthlyChange,
        monthlyChangePercent: monthlyChangePercent !== null
          ? Math.round(monthlyChangePercent * 100) / 100
          : null,
        equity,
        lvr: Math.round(lvr * 100) / 100,
        hasLoans,
        lastUpdated: latestValuation.valueDate,
        source: latestValuation.source,
        confidenceLow: latestValuation.confidenceLow ? Number(latestValuation.confidenceLow) : null,
        confidenceHigh: latestValuation.confidenceHigh ? Number(latestValuation.confidenceHigh) : null,
      };
    }),

  triggerBackfill: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Check if valuations already exist
      const existingCount = await ctx.db.query.propertyValues.findMany({
        where: eq(propertyValues.propertyId, input.propertyId),
        columns: { id: true },
      });

      if (existingCount.length > 2) {
        return { backfilled: 0, message: "History already exists" };
      }

      const provider = getValuationProvider();
      if (!("generateHistory" in provider)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provider does not support backfill" });
      }

      const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
      const history = await (provider as MockValuationProvider).generateHistory({
        propertyId: property.id,
        purchasePrice: Number(property.purchasePrice),
        purchaseDate: property.purchaseDate,
        address: fullAddress,
        propertyType: "house",
      });

      // Get existing value dates to avoid duplicates
      const existingDates = new Set(existingCount.length > 0
        ? (await ctx.db.query.propertyValues.findMany({
            where: eq(propertyValues.propertyId, input.propertyId),
            columns: { valueDate: true },
          })).map(v => v.valueDate)
        : []
      );

      const toInsert = history.filter(h => !existingDates.has(h.valueDate));

      if (toInsert.length > 0) {
        await ctx.db.insert(propertyValues).values(
          toInsert.map(h => ({
            propertyId: input.propertyId,
            userId: ctx.portfolio.ownerId,
            estimatedValue: h.estimatedValue.toString(),
            confidenceLow: h.confidenceLow.toString(),
            confidenceHigh: h.confidenceHigh.toString(),
            valueDate: h.valueDate,
            source: "mock" as const,
            apiResponseId: `mock-backfill-${h.valueDate}`,
          }))
        );
      }

      return { backfilled: toInsert.length };
    }),
```

Also add `MockValuationProvider` to the import:

```typescript
import { getValuationProvider, MockValuationProvider } from "../services/valuation";
```

**Step 2: Commit**

```bash
git add src/server/routers/propertyValue.ts
git commit -m "feat(avm): add valuation history, growth stats, and backfill TRPC procedures"
```

---

### Task 3: Monthly Valuation Cron Job

**Files:**
- Create: `src/app/api/cron/valuations/route.ts`
- Modify: `vercel.json`

**Step 1: Create the cron route**

Follow the exact pattern from `src/app/api/cron/equity-milestones/route.ts`.

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { properties, propertyValues } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { getValuationProvider, MockValuationProvider } from "@/server/services/valuation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const provider = getValuationProvider();
    let valuationsCreated = 0;
    let propertiesProcessed = 0;
    let backfilled = 0;
    const errors: string[] = [];

    const activeProperties = await db.query.properties.findMany({
      where: eq(properties.status, "active"),
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    for (const property of activeProperties) {
      try {
        propertiesProcessed++;

        // Check existing valuations count
        const existing = await db.query.propertyValues.findMany({
          where: eq(propertyValues.propertyId, property.id),
          columns: { id: true, valueDate: true },
        });

        const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
        const input = {
          propertyId: property.id,
          purchasePrice: Number(property.purchasePrice),
          purchaseDate: property.purchaseDate,
          address: fullAddress,
          propertyType: "house",
        };

        // Backfill history if no valuations exist
        if (existing.length === 0 && provider instanceof MockValuationProvider) {
          const history = await provider.generateHistory(input);
          if (history.length > 0) {
            await db.insert(propertyValues).values(
              history.map(h => ({
                propertyId: property.id,
                userId: property.userId,
                estimatedValue: h.estimatedValue.toString(),
                confidenceLow: h.confidenceLow.toString(),
                confidenceHigh: h.confidenceHigh.toString(),
                valueDate: h.valueDate,
                source: "mock" as const,
                apiResponseId: `mock-backfill-${h.valueDate}`,
              }))
            );
            backfilled += history.length;
          }
          continue; // backfill includes current month
        }

        // Skip if current month already has a valuation
        const existingDates = existing.map(e => e.valueDate);
        if (existingDates.includes(currentMonth)) {
          continue;
        }

        // Generate current month valuation
        const result = await provider.getValuation(input);
        if (result) {
          await db.insert(propertyValues).values({
            propertyId: property.id,
            userId: property.userId,
            estimatedValue: result.estimatedValue.toString(),
            confidenceLow: result.confidenceLow.toString(),
            confidenceHigh: result.confidenceHigh.toString(),
            valueDate: currentMonth,
            source: result.source as "mock" | "corelogic" | "proptrack",
            apiResponseId: `mock-cron-${Date.now()}`,
          });
          valuationsCreated++;
        }
      } catch (error) {
        const msg = `Failed for property ${property.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(msg);
        logger.error("Valuation cron error for property", { propertyId: property.id, error });
      }
    }

    logger.info("Valuation cron completed", {
      propertiesProcessed,
      valuationsCreated,
      backfilled,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      propertiesProcessed,
      valuationsCreated,
      backfilled,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Valuation cron error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Add cron schedule to `vercel.json`**

Add to the existing `crons` array:

```json
{
  "path": "/api/cron/valuations",
  "schedule": "0 2 1 * *"
}
```

This runs at 2am UTC on the 1st of each month.

**Step 3: Commit**

```bash
git add src/app/api/cron/valuations/route.ts vercel.json
git commit -m "feat(avm): add monthly valuation cron job"
```

---

### Task 4: Valuation Tab — Page and Layout Update

**Files:**
- Create: `src/app/(dashboard)/properties/[id]/valuation/page.tsx`
- Modify: `src/app/(dashboard)/properties/[id]/layout.tsx`

**Step 1: Update layout.tsx to add "Valuation" breadcrumb**

Add a new `else if` block in `getBreadcrumbItems()` before the final `else`:

```typescript
      } else if (pathname?.includes("/valuation")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Valuation" });
      }
```

**Step 2: Create the Valuation page**

This page orchestrates three components: `ValuationOverviewCard`, `CapitalGrowthStats`, and `ValuationChart`.

```typescript
"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ValuationOverviewCard } from "@/components/property/valuation-overview-card";
import { CapitalGrowthStats } from "@/components/property/capital-growth-stats";
import { ValuationChart } from "@/components/property/valuation-chart";

export default function PropertyValuationPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: stats, isLoading: statsLoading } = trpc.propertyValue.getCapitalGrowthStats.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const { data: history, isLoading: historyLoading } = trpc.propertyValue.getValuationHistory.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const utils = trpc.useUtils();

  const backfillMutation = trpc.propertyValue.triggerBackfill.useMutation({
    onSuccess: () => {
      utils.propertyValue.getValuationHistory.invalidate({ propertyId });
      utils.propertyValue.getCapitalGrowthStats.invalidate({ propertyId });
      utils.propertyValue.getCurrent.invalidate({ propertyId });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold">Property not found</h2>
        <p className="text-muted-foreground mt-1">
          The property you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/properties")}>
          Back to Properties
        </Button>
      </div>
    );
  }

  const hasHistory = history && history.length > 0;
  const showBackfill = !historyLoading && (!history || history.length <= 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Valuation</h1>
            <p className="text-muted-foreground">
              {property.address}, {property.suburb}
            </p>
          </div>
        </div>
        {showBackfill && (
          <Button
            variant="outline"
            onClick={() => backfillMutation.mutate({ propertyId })}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Generate History
          </Button>
        )}
      </div>

      {/* Current Value + Growth Stats */}
      <ValuationOverviewCard stats={stats} isLoading={statsLoading} />

      {/* Capital Growth Stats Row */}
      <CapitalGrowthStats stats={stats} isLoading={statsLoading} />

      {/* Historical Chart */}
      <ValuationChart
        history={history ?? []}
        purchasePrice={Number(property.purchasePrice)}
        isLoading={historyLoading}
      />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/valuation/page.tsx src/app/\(dashboard\)/properties/\[id\]/layout.tsx
git commit -m "feat(avm): add Valuation tab page and breadcrumb"
```

---

### Task 5: Valuation Overview Card Component

**Files:**
- Create: `src/components/property/valuation-overview-card.tsx`

**Step 1: Create the component**

This shows the current value, confidence range, and month-over-month change.

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  currentValue: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  monthlyChange: number | null;
  monthlyChangePercent: number | null;
  lastUpdated: string;
  source: string;
}

interface ValuationOverviewCardProps {
  stats: Stats | null | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));

const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    manual: "Manual",
    mock: "Estimated",
    corelogic: "CoreLogic",
    proptrack: "PropTrack",
  };
  return labels[source] || source;
};

export function ValuationOverviewCard({ stats, isLoading }: ValuationOverviewCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Estimated Value</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Estimated Value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No valuation data available. Click &quot;Generate History&quot; to create mock valuations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const changePositive = stats.monthlyChange !== null && stats.monthlyChange > 0;
  const changeNegative = stats.monthlyChange !== null && stats.monthlyChange < 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle>Current Estimated Value</CardTitle>
          <Badge variant="outline">{getSourceLabel(stats.source)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrency(stats.currentValue)}
          </p>
          {stats.monthlyChange !== null && stats.monthlyChangePercent !== null && (
            <div className={`flex items-center gap-1 pb-1 ${
              changePositive ? "text-green-600" : changeNegative ? "text-red-600" : "text-muted-foreground"
            }`}>
              {changePositive ? <TrendingUp className="h-4 w-4" /> :
               changeNegative ? <TrendingDown className="h-4 w-4" /> :
               <Minus className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {changePositive ? "+" : ""}{formatCurrency(stats.monthlyChange)}
                {" "}({changePositive ? "+" : ""}{stats.monthlyChangePercent.toFixed(1)}%)
              </span>
              <span className="text-xs text-muted-foreground">this month</span>
            </div>
          )}
        </div>

        {stats.confidenceLow !== null && stats.confidenceHigh !== null && (
          <p className="text-sm text-muted-foreground">
            Confidence range: {formatCurrency(stats.confidenceLow)} &mdash; {formatCurrency(stats.confidenceHigh)}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Last updated: {formatDate(stats.lastUpdated)}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/property/valuation-overview-card.tsx
git commit -m "feat(avm): add valuation overview card component"
```

---

### Task 6: Capital Growth Stats Component

**Files:**
- Create: `src/components/property/capital-growth-stats.tsx`

**Step 1: Create the component**

A row of stat cards showing total gain, annualized growth, equity, and LVR.

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Percent, Landmark, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalGain: number;
  totalGainPercent: number;
  annualizedGrowth: number;
  equity: number;
  lvr: number;
  hasLoans: boolean;
}

interface CapitalGrowthStatsProps {
  stats: Stats | null | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

export function CapitalGrowthStats({ stats, isLoading }: CapitalGrowthStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const gainPositive = stats.totalGain >= 0;

  const items = [
    {
      label: "Total Capital Gain",
      value: `${gainPositive ? "+" : ""}${formatCurrency(stats.totalGain)}`,
      sub: `${gainPositive ? "+" : ""}${stats.totalGainPercent.toFixed(1)}%`,
      icon: TrendingUp,
      color: gainPositive ? "text-green-600" : "text-red-600",
    },
    {
      label: "Annualized Growth",
      value: `${stats.annualizedGrowth.toFixed(1)}%`,
      sub: "per year",
      icon: Percent,
      color: stats.annualizedGrowth >= 0 ? "text-green-600" : "text-red-600",
    },
    ...(stats.hasLoans ? [
      {
        label: "Equity",
        value: formatCurrency(stats.equity),
        sub: "current equity",
        icon: Landmark,
        color: stats.equity >= 0 ? "text-blue-600" : "text-red-600",
      },
      {
        label: "LVR",
        value: `${stats.lvr.toFixed(1)}%`,
        sub: stats.lvr <= 80 ? "Below 80%" : "Above 80%",
        icon: ShieldCheck,
        color: stats.lvr <= 80 ? "text-green-600" : "text-amber-600",
      },
    ] : []),
  ];

  return (
    <div className={`grid grid-cols-2 ${stats.hasLoans ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4`}>
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </div>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/property/capital-growth-stats.tsx
git commit -m "feat(avm): add capital growth stats component"
```

---

### Task 7: Historical Valuation Chart Component

**Files:**
- Create: `src/components/property/valuation-chart.tsx`

**Step 1: Create the component**

Uses Recharts `AreaChart` with a shaded confidence band and purchase price reference line. Follows the exact chart pattern from `ForecastChart.tsx`.

```typescript
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ValuationRecord {
  id: string;
  estimatedValue: string;
  confidenceLow: string | null;
  confidenceHigh: string | null;
  valueDate: string;
  source: string;
}

interface ValuationChartProps {
  history: ValuationRecord[];
  purchasePrice: number;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

const formatMonth = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "2-digit",
  }).format(date);
};

export function ValuationChart({ history, purchasePrice, isLoading }: ValuationChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Value History</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Value History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            No valuation history available. Generate history to see the chart.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map((v) => ({
    date: v.valueDate,
    label: formatMonth(v.valueDate),
    value: Number(v.estimatedValue),
    low: v.confidenceLow ? Number(v.confidenceLow) : undefined,
    high: v.confidenceHigh ? Number(v.confidenceHigh) : undefined,
    // For the area chart confidence band, we need the range as [low, high]
    range: v.confidenceLow && v.confidenceHigh
      ? [Number(v.confidenceLow), Number(v.confidenceHigh)]
      : undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Value History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "Confidence Range") return "";
                  return [formatCurrency(value), name];
                }}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-card border rounded-lg p-3 shadow-md">
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-lg font-bold">{formatCurrency(data.value)}</p>
                      {data.low && data.high && (
                        <p className="text-xs text-muted-foreground">
                          Range: {formatCurrency(data.low)} &mdash; {formatCurrency(data.high)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {/* Confidence band */}
              <Area
                type="monotone"
                dataKey="high"
                stroke="none"
                fill="hsl(217, 91%, 60%)"
                fillOpacity={0.1}
                name="Confidence Range"
              />
              <Area
                type="monotone"
                dataKey="low"
                stroke="none"
                fill="hsl(var(--card))"
                fillOpacity={1}
                name="Confidence Range Low"
              />
              {/* Main value line */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                fill="none"
                name="Estimated Value"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(217, 91%, 60%)" }}
              />
              {/* Purchase price reference line */}
              <ReferenceLine
                y={purchasePrice}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: `Purchase: ${formatCurrency(purchasePrice)}`,
                  position: "insideBottomRight",
                  style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/property/valuation-chart.tsx
git commit -m "feat(avm): add historical valuation chart component"
```

---

### Task 8: Add Valuation Link to Property Overview Page

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx`

**Step 1: Add a link/button to the Valuation tab from the property overview**

The overview page already shows a `ValuationCard` (from `src/components/valuation/ValuationCard.tsx`). Add a "View Full Valuation" link that navigates to the new tab. Add this after the existing `ValuationCard`:

Import `Link` from `next/link` and `BarChart3` from `lucide-react` at the top of the file. Then after the `<ValuationCard propertyId={propertyId} />` line, add:

```typescript
      {/* Valuation Link */}
      <Card>
        <CardContent className="pt-6">
          <Link
            href={`/properties/${propertyId}/valuation`}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <BarChart3 className="h-4 w-4" />
            View Full Valuation History & Growth Stats
          </Link>
        </CardContent>
      </Card>
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/page.tsx
git commit -m "feat(avm): add valuation tab link from property overview"
```

---

### Task 9: Build Verification and Cleanup

**Step 1: Run TypeScript compiler to check for errors**

```bash
npx tsc --noEmit
```

Fix any type errors found.

**Step 2: Run linting**

```bash
npm run lint
```

Fix any lint errors found.

**Step 3: Run build**

```bash
npm run build
```

Verify the build succeeds.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(avm): resolve build errors"
```

---

### Task 10: Create PR and Merge

**Step 1: Push branch and create PR**

```bash
git push -u origin feature/avm-integration
gh pr create --title "feat(avm): Automated property valuations with mock provider (#35)" --body "## Summary
- Enhanced mock valuation provider with realistic trend simulation (6% annual growth + deterministic monthly variance)
- Monthly valuation cron job that auto-updates all active properties with backfill support
- New Valuation tab per property with current value card, capital growth stats, and historical chart
- TRPC procedures for valuation history, capital growth stats, and manual backfill trigger
- Pluggable provider interface ready for CoreLogic/PropTrack API integration

## Test plan
- [ ] Navigate to a property detail page and click 'View Full Valuation History'
- [ ] Click 'Generate History' to backfill mock valuations
- [ ] Verify historical chart shows values from purchase date to present
- [ ] Verify capital growth stats show correct gain, annualized %, equity, and LVR
- [ ] Verify current value card shows confidence range and monthly change
- [ ] Test the existing ValuationCard refresh still works with new provider interface
- [ ] Verify cron endpoint responds to authorized requests

Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 2: Merge PR**

```bash
gh pr merge --squash
```
