# Cash Flow Forecasting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 12-month cash flow projections with configurable scenarios and comparison views.

**Architecture:** New `forecastScenarios` and `cashFlowForecasts` tables. Service layer generates forecasts from recurring transactions + loans with configurable assumptions. Router exposes scenario CRUD and forecast retrieval. UI shows line chart with scenario comparison.

**Tech Stack:** Drizzle ORM, tRPC, Vitest, React, Recharts, Tailwind CSS

---

## Task 1: Database Schema - Add Forecast Tables

**Files:**
- Modify: `/src/server/db/schema.ts`

**Step 1: Add forecastScenarios table**

Add after the `anomalyAlerts` table and relations:

```typescript
export const forecastScenarios = pgTable(
  "forecast_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    assumptions: text("assumptions").notNull(), // JSON string
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("forecast_scenarios_user_id_idx").on(table.userId),
  ]
);

export const cashFlowForecasts = pgTable(
  "cash_flow_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scenarioId: uuid("scenario_id")
      .references(() => forecastScenarios.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    forecastMonth: date("forecast_month").notNull(),
    projectedIncome: decimal("projected_income", { precision: 12, scale: 2 }).notNull(),
    projectedExpenses: decimal("projected_expenses", { precision: 12, scale: 2 }).notNull(),
    projectedNet: decimal("projected_net", { precision: 12, scale: 2 }).notNull(),
    breakdown: text("breakdown"), // JSON string
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cash_flow_forecasts_user_id_idx").on(table.userId),
    index("cash_flow_forecasts_scenario_id_idx").on(table.scenarioId),
    index("cash_flow_forecasts_property_id_idx").on(table.propertyId),
    index("cash_flow_forecasts_month_idx").on(table.forecastMonth),
  ]
);
```

**Step 2: Add relations**

```typescript
export const forecastScenariosRelations = relations(forecastScenarios, ({ one, many }) => ({
  user: one(users, {
    fields: [forecastScenarios.userId],
    references: [users.id],
  }),
  forecasts: many(cashFlowForecasts),
}));

export const cashFlowForecastsRelations = relations(cashFlowForecasts, ({ one }) => ({
  user: one(users, {
    fields: [cashFlowForecasts.userId],
    references: [users.id],
  }),
  scenario: one(forecastScenarios, {
    fields: [cashFlowForecasts.scenarioId],
    references: [forecastScenarios.id],
  }),
  property: one(properties, {
    fields: [cashFlowForecasts.propertyId],
    references: [properties.id],
  }),
}));
```

**Step 3: Add type exports**

```typescript
export type ForecastScenario = typeof forecastScenarios.$inferSelect;
export type NewForecastScenario = typeof forecastScenarios.$inferInsert;
export type CashFlowForecast = typeof cashFlowForecasts.$inferSelect;
export type NewCashFlowForecast = typeof cashFlowForecasts.$inferInsert;
```

**Step 4: Generate migration**

Run: `npm run db:generate`

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add forecastScenarios and cashFlowForecasts tables"
```

---

## Task 2: Forecast Service - Core Calculation Logic

**Files:**
- Create: `/src/server/services/forecast.ts`
- Create: `/src/server/services/__tests__/forecast.test.ts`

**Step 1: Write failing tests**

Create `/src/server/services/__tests__/forecast.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  applyGrowthRate,
  calculateMonthlyLoanInterest,
  calculateMonthlyProjection,
  type ScenarioAssumptions,
} from "../forecast";

describe("forecast service", () => {
  describe("applyGrowthRate", () => {
    it("returns base amount for month 0", () => {
      const result = applyGrowthRate(1000, 0, 12);
      expect(result).toBe(1000);
    });

    it("applies monthly compounding for 12% annual rate", () => {
      // 12% annual = 1% monthly, after 1 month: 1000 * 1.01 = 1010
      const result = applyGrowthRate(1000, 1, 12);
      expect(result).toBeCloseTo(1010, 0);
    });

    it("compounds correctly over 12 months", () => {
      // 12% annual compounded monthly: 1000 * (1.01)^12 ≈ 1126.83
      const result = applyGrowthRate(1000, 12, 12);
      expect(result).toBeCloseTo(1126.83, 0);
    });
  });

  describe("calculateMonthlyLoanInterest", () => {
    it("calculates interest for standard loan", () => {
      // $500,000 at 6% = $2,500/month interest
      const result = calculateMonthlyLoanInterest(500000, 6, 0);
      expect(result).toBeCloseTo(2500, 0);
    });

    it("applies rate adjustment", () => {
      // $500,000 at 6% + 1% adjustment = 7% = $2,916.67/month
      const result = calculateMonthlyLoanInterest(500000, 6, 1);
      expect(result).toBeCloseTo(2916.67, 0);
    });
  });

  describe("calculateMonthlyProjection", () => {
    const baseAssumptions: ScenarioAssumptions = {
      rentGrowthPercent: 0,
      expenseInflationPercent: 0,
      vacancyRatePercent: 0,
      interestRateChangePercent: 0,
    };

    it("calculates net as income minus expenses", () => {
      const result = calculateMonthlyProjection({
        monthsAhead: 0,
        baseIncome: 2000,
        baseExpenses: 1500,
        loanBalance: 0,
        loanRate: 0,
        assumptions: baseAssumptions,
      });

      expect(result.projectedIncome).toBe(2000);
      expect(result.projectedExpenses).toBe(1500);
      expect(result.projectedNet).toBe(500);
    });

    it("applies vacancy rate to income", () => {
      const result = calculateMonthlyProjection({
        monthsAhead: 0,
        baseIncome: 2000,
        baseExpenses: 1000,
        loanBalance: 0,
        loanRate: 0,
        assumptions: { ...baseAssumptions, vacancyRatePercent: 10 },
      });

      expect(result.projectedIncome).toBe(1800); // 2000 * 0.9
    });

    it("includes loan interest in expenses", () => {
      const result = calculateMonthlyProjection({
        monthsAhead: 0,
        baseIncome: 3000,
        baseExpenses: 500,
        loanBalance: 500000,
        loanRate: 6,
        assumptions: baseAssumptions,
      });

      // 500 base + 2500 interest = 3000
      expect(result.projectedExpenses).toBeCloseTo(3000, 0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/forecast.test.ts`
Expected: FAIL - module not found

**Step 3: Implement the service**

Create `/src/server/services/forecast.ts`:

```typescript
export interface ScenarioAssumptions {
  rentGrowthPercent: number;
  expenseInflationPercent: number;
  vacancyRatePercent: number;
  interestRateChangePercent: number;
}

export const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  rentGrowthPercent: 2,
  expenseInflationPercent: 3,
  vacancyRatePercent: 0,
  interestRateChangePercent: 0,
};

export interface MonthlyProjection {
  projectedIncome: number;
  projectedExpenses: number;
  projectedNet: number;
}

export interface ProjectionInput {
  monthsAhead: number;
  baseIncome: number;
  baseExpenses: number;
  loanBalance: number;
  loanRate: number;
  assumptions: ScenarioAssumptions;
}

/**
 * Apply compound growth rate to a base amount
 * @param baseAmount Starting amount
 * @param monthsAhead Number of months to project
 * @param annualRatePercent Annual growth rate as percentage (e.g., 12 for 12%)
 */
export function applyGrowthRate(
  baseAmount: number,
  monthsAhead: number,
  annualRatePercent: number
): number {
  if (monthsAhead === 0) return baseAmount;
  const monthlyRate = annualRatePercent / 100 / 12;
  return baseAmount * Math.pow(1 + monthlyRate, monthsAhead);
}

/**
 * Calculate monthly loan interest
 * @param balance Current loan balance
 * @param currentRatePercent Current annual interest rate
 * @param rateAdjustmentPercent Rate adjustment from scenario
 */
export function calculateMonthlyLoanInterest(
  balance: number,
  currentRatePercent: number,
  rateAdjustmentPercent: number
): number {
  const adjustedRate = currentRatePercent + rateAdjustmentPercent;
  return balance * (adjustedRate / 100 / 12);
}

/**
 * Calculate projected income, expenses, and net for a single month
 */
export function calculateMonthlyProjection(input: ProjectionInput): MonthlyProjection {
  const { monthsAhead, baseIncome, baseExpenses, loanBalance, loanRate, assumptions } = input;

  // Apply growth rates
  let projectedIncome = applyGrowthRate(baseIncome, monthsAhead, assumptions.rentGrowthPercent);
  const projectedBaseExpenses = applyGrowthRate(
    baseExpenses,
    monthsAhead,
    assumptions.expenseInflationPercent
  );

  // Apply vacancy rate
  projectedIncome = projectedIncome * (1 - assumptions.vacancyRatePercent / 100);

  // Calculate loan interest
  const loanInterest = calculateMonthlyLoanInterest(
    loanBalance,
    loanRate,
    assumptions.interestRateChangePercent
  );

  const projectedExpenses = projectedBaseExpenses + loanInterest;
  const projectedNet = projectedIncome - projectedExpenses;

  return {
    projectedIncome: Math.round(projectedIncome * 100) / 100,
    projectedExpenses: Math.round(projectedExpenses * 100) / 100,
    projectedNet: Math.round(projectedNet * 100) / 100,
  };
}

/**
 * Get the first day of a month, N months ahead
 */
export function getForecastMonth(monthsAhead: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + monthsAhead);
  return date.toISOString().split("T")[0];
}

/**
 * Parse assumptions from JSON string with defaults
 */
export function parseAssumptions(json: string | null): ScenarioAssumptions {
  if (!json) return DEFAULT_ASSUMPTIONS;
  try {
    const parsed = JSON.parse(json);
    return {
      rentGrowthPercent: parsed.rentGrowthPercent ?? DEFAULT_ASSUMPTIONS.rentGrowthPercent,
      expenseInflationPercent:
        parsed.expenseInflationPercent ?? DEFAULT_ASSUMPTIONS.expenseInflationPercent,
      vacancyRatePercent: parsed.vacancyRatePercent ?? DEFAULT_ASSUMPTIONS.vacancyRatePercent,
      interestRateChangePercent:
        parsed.interestRateChangePercent ?? DEFAULT_ASSUMPTIONS.interestRateChangePercent,
    };
  } catch {
    return DEFAULT_ASSUMPTIONS;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/forecast.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/services/forecast.ts src/server/services/__tests__/forecast.test.ts
git commit -m "feat(forecast): add core calculation logic for cash flow projections"
```

---

## Task 3: Forecast Router - CRUD and Generation

**Files:**
- Create: `/src/server/routers/forecast.ts`
- Modify: `/src/server/routers/_app.ts`

**Step 1: Create the forecast router**

Create `/src/server/routers/forecast.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  forecastScenarios,
  cashFlowForecasts,
  recurringTransactions,
  loans,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  DEFAULT_ASSUMPTIONS,
  parseAssumptions,
  calculateMonthlyProjection,
  getForecastMonth,
  type ScenarioAssumptions,
} from "../services/forecast";

const assumptionsSchema = z.object({
  rentGrowthPercent: z.number().min(-10).max(20).default(2),
  expenseInflationPercent: z.number().min(-5).max(15).default(3),
  vacancyRatePercent: z.number().min(0).max(100).default(0),
  interestRateChangePercent: z.number().min(-5).max(10).default(0),
});

export const forecastRouter = router({
  // Scenario CRUD
  listScenarios: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.forecastScenarios.findMany({
      where: eq(forecastScenarios.userId, ctx.user.id),
      orderBy: [desc(forecastScenarios.isDefault), desc(forecastScenarios.createdAt)],
    });
  }),

  createScenario: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        assumptions: assumptionsSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS;

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await ctx.db
          .update(forecastScenarios)
          .set({ isDefault: false })
          .where(eq(forecastScenarios.userId, ctx.user.id));
      }

      const [scenario] = await ctx.db
        .insert(forecastScenarios)
        .values({
          userId: ctx.user.id,
          name: input.name,
          assumptions: JSON.stringify(assumptions),
          isDefault: input.isDefault ?? false,
        })
        .returning();

      // Generate forecasts for this scenario
      await generateForecastsForScenario(ctx.db, ctx.user.id, scenario.id);

      return scenario;
    }),

  updateScenario: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        assumptions: assumptionsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.forecastScenarios.findFirst({
        where: and(
          eq(forecastScenarios.id, input.id),
          eq(forecastScenarios.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.assumptions) updates.assumptions = JSON.stringify(input.assumptions);

      const [scenario] = await ctx.db
        .update(forecastScenarios)
        .set(updates)
        .where(eq(forecastScenarios.id, input.id))
        .returning();

      // Regenerate forecasts if assumptions changed
      if (input.assumptions) {
        await generateForecastsForScenario(ctx.db, ctx.user.id, scenario.id);
      }

      return scenario;
    }),

  deleteScenario: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(forecastScenarios)
        .where(
          and(
            eq(forecastScenarios.id, input.id),
            eq(forecastScenarios.userId, ctx.user.id)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      return deleted;
    }),

  setDefaultScenario: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Unset all defaults for user
      await ctx.db
        .update(forecastScenarios)
        .set({ isDefault: false })
        .where(eq(forecastScenarios.userId, ctx.user.id));

      // Set new default
      const [scenario] = await ctx.db
        .update(forecastScenarios)
        .set({ isDefault: true })
        .where(
          and(
            eq(forecastScenarios.id, input.id),
            eq(forecastScenarios.userId, ctx.user.id)
          )
        )
        .returning();

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      return scenario;
    }),

  // Forecast retrieval
  getForecast: protectedProcedure
    .input(
      z.object({
        scenarioId: z.string().uuid(),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(cashFlowForecasts.userId, ctx.user.id),
        eq(cashFlowForecasts.scenarioId, input.scenarioId),
      ];

      if (input.propertyId) {
        conditions.push(eq(cashFlowForecasts.propertyId, input.propertyId));
      }

      const forecasts = await ctx.db.query.cashFlowForecasts.findMany({
        where: and(...conditions),
        with: {
          property: true,
        },
        orderBy: [cashFlowForecasts.forecastMonth],
      });

      // Calculate summary
      const totalIncome = forecasts.reduce((sum, f) => sum + Number(f.projectedIncome), 0);
      const totalExpenses = forecasts.reduce((sum, f) => sum + Number(f.projectedExpenses), 0);
      const totalNet = forecasts.reduce((sum, f) => sum + Number(f.projectedNet), 0);

      return {
        forecasts,
        summary: {
          totalIncome,
          totalExpenses,
          totalNet,
          monthsWithNegativeCashFlow: forecasts.filter((f) => Number(f.projectedNet) < 0).length,
        },
      };
    }),

  getComparison: protectedProcedure
    .input(
      z.object({
        scenarioIds: z.array(z.string().uuid()).min(2).max(3),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const results: Record<string, Awaited<ReturnType<typeof ctx.db.query.cashFlowForecasts.findMany>>> = {};

      for (const scenarioId of input.scenarioIds) {
        const conditions = [
          eq(cashFlowForecasts.userId, ctx.user.id),
          eq(cashFlowForecasts.scenarioId, scenarioId),
        ];

        if (input.propertyId) {
          conditions.push(eq(cashFlowForecasts.propertyId, input.propertyId));
        }

        results[scenarioId] = await ctx.db.query.cashFlowForecasts.findMany({
          where: and(...conditions),
          orderBy: [cashFlowForecasts.forecastMonth],
        });
      }

      return results;
    }),

  regenerate: protectedProcedure
    .input(z.object({ scenarioId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.db.query.forecastScenarios.findFirst({
        where: and(
          eq(forecastScenarios.id, input.scenarioId),
          eq(forecastScenarios.userId, ctx.user.id)
        ),
      });

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      await generateForecastsForScenario(ctx.db, ctx.user.id, input.scenarioId);

      return { success: true };
    }),
});

async function generateForecastsForScenario(
  db: any,
  userId: string,
  scenarioId: string
) {
  // Get scenario assumptions
  const scenario = await db.query.forecastScenarios.findFirst({
    where: eq(forecastScenarios.id, scenarioId),
  });

  if (!scenario) return;

  const assumptions = parseAssumptions(scenario.assumptions);

  // Get recurring transactions for income/expenses
  const recurring = await db.query.recurringTransactions.findMany({
    where: and(
      eq(recurringTransactions.userId, userId),
      eq(recurringTransactions.isActive, true)
    ),
  });

  // Get loans for interest calculations
  const userLoans = await db.query.loans.findMany({
    where: eq(loans.userId, userId),
  });

  // Calculate base monthly income/expenses from recurring transactions
  const baseIncome = recurring
    .filter((r: any) => r.transactionType === "income")
    .reduce((sum: number, r: any) => sum + Math.abs(Number(r.amount)), 0);

  const baseExpenses = recurring
    .filter((r: any) => r.transactionType === "expense")
    .reduce((sum: number, r: any) => sum + Math.abs(Number(r.amount)), 0);

  // Calculate total loan balance and weighted average rate
  const totalLoanBalance = userLoans.reduce(
    (sum: number, l: any) => sum + Number(l.currentBalance),
    0
  );
  const weightedRate =
    totalLoanBalance > 0
      ? userLoans.reduce(
          (sum: number, l: any) =>
            sum + (Number(l.currentBalance) / totalLoanBalance) * Number(l.interestRate),
          0
        )
      : 0;

  // Delete existing forecasts for this scenario
  await db
    .delete(cashFlowForecasts)
    .where(eq(cashFlowForecasts.scenarioId, scenarioId));

  // Generate 12 months of forecasts
  for (let month = 0; month < 12; month++) {
    const projection = calculateMonthlyProjection({
      monthsAhead: month,
      baseIncome,
      baseExpenses,
      loanBalance: totalLoanBalance,
      loanRate: weightedRate,
      assumptions,
    });

    await db.insert(cashFlowForecasts).values({
      userId,
      scenarioId,
      propertyId: null, // Portfolio-wide
      forecastMonth: getForecastMonth(month),
      projectedIncome: String(projection.projectedIncome),
      projectedExpenses: String(projection.projectedExpenses),
      projectedNet: String(projection.projectedNet),
      breakdown: JSON.stringify({
        baseIncome,
        baseExpenses,
        loanInterest: projection.projectedExpenses - baseExpenses,
      }),
    });
  }
}
```

**Step 2: Register the router**

Modify `/src/server/routers/_app.ts`:

Add import:
```typescript
import { forecastRouter } from "./forecast";
```

Add to appRouter:
```typescript
forecast: forecastRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/forecast.ts src/server/routers/_app.ts
git commit -m "feat(forecast): add router with scenario CRUD and forecast generation"
```

---

## Task 4: Forecast Page - Basic Layout

**Files:**
- Create: `/src/app/(dashboard)/reports/forecast/page.tsx`
- Modify: `/src/app/(dashboard)/reports/page.tsx`

**Step 1: Create forecast page**

Create `/src/app/(dashboard)/reports/forecast/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ForecastChart } from "@/components/forecast/ForecastChart";
import { ForecastSummary } from "@/components/forecast/ForecastSummary";
import { ScenarioModal } from "@/components/forecast/ScenarioModal";
import { Plus, Settings } from "lucide-react";

export default function ForecastPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: scenarios, isLoading: scenariosLoading } = trpc.forecast.listScenarios.useQuery();
  const utils = trpc.useUtils();

  // Set default scenario on load
  const defaultScenario = scenarios?.find((s) => s.isDefault) ?? scenarios?.[0];
  const activeScenarioId = selectedScenarioId ?? defaultScenario?.id;

  const { data: forecastData, isLoading: forecastLoading } = trpc.forecast.getForecast.useQuery(
    { scenarioId: activeScenarioId! },
    { enabled: !!activeScenarioId }
  );

  const handleScenarioCreated = () => {
    utils.forecast.listScenarios.invalidate();
    setIsModalOpen(false);
  };

  if (scenariosLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month projections for your portfolio</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // No scenarios yet - show create prompt
  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month projections for your portfolio</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Create your first forecast scenario to get started
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Scenario
            </Button>
          </CardContent>
        </Card>
        <ScenarioModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleScenarioCreated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month projections for your portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={activeScenarioId}
            onValueChange={setSelectedScenarioId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {scenario.name} {scenario.isDefault && "(Default)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setIsModalOpen(true)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {forecastLoading ? (
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      ) : forecastData ? (
        <>
          <ForecastChart forecasts={forecastData.forecasts} />
          <ForecastSummary summary={forecastData.summary} />
        </>
      ) : null}

      <ScenarioModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleScenarioCreated}
        scenarios={scenarios}
      />
    </div>
  );
}
```

**Step 2: Add forecast link to reports page**

Modify `/src/app/(dashboard)/reports/page.tsx`:

Add to reportTypes array after "Capital Gains Tax":
```typescript
{
  title: "Cash Flow Forecast",
  description: "12-month projections with scenario modeling",
  icon: TrendingUp,
  href: "/reports/forecast",
},
```

Note: TrendingUp is already imported, but change the CGT icon to `Calculator` if needed to avoid duplicate:

```typescript
import { FileText, PieChart, Download, TrendingUp, Calculator } from "lucide-react";
```

And update CGT to use Calculator icon.

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/reports/forecast/page.tsx" "src/app/(dashboard)/reports/page.tsx"
git commit -m "feat(ui): add forecast page with scenario selector"
```

---

## Task 5: Forecast Chart Component

**Files:**
- Create: `/src/components/forecast/ForecastChart.tsx`

**Step 1: Create the chart component**

Create `/src/components/forecast/ForecastChart.tsx`:

```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import type { CashFlowForecast } from "@/server/db/schema";

type ForecastChartProps = {
  forecasts: CashFlowForecast[];
};

export function ForecastChart({ forecasts }: ForecastChartProps) {
  const chartData = forecasts.map((f) => ({
    month: format(parseISO(f.forecastMonth), "MMM yyyy"),
    income: Number(f.projectedIncome),
    expenses: Number(f.projectedExpenses),
    net: Number(f.projectedNet),
  }));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/forecast/ForecastChart.tsx
git commit -m "feat(ui): add forecast line chart component"
```

---

## Task 6: Forecast Summary Component

**Files:**
- Create: `/src/components/forecast/ForecastSummary.tsx`

**Step 1: Create the summary component**

Create `/src/components/forecast/ForecastSummary.tsx`:

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";

type ForecastSummaryProps = {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalNet: number;
    monthsWithNegativeCashFlow: number;
  };
};

export function ForecastSummary({ summary }: ForecastSummaryProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const isPositive = summary.totalNet >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Income</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.totalIncome)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Expenses</p>
              <p className="text-xl font-semibold">{formatCurrency(summary.totalExpenses)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                isPositive
                  ? "bg-blue-100 dark:bg-blue-900/20"
                  : "bg-orange-100 dark:bg-orange-900/20"
              }`}
            >
              <DollarSign
                className={`h-4 w-4 ${
                  isPositive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Net</p>
              <p
                className={`text-xl font-semibold ${
                  isPositive ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {formatCurrency(summary.totalNet)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                summary.monthsWithNegativeCashFlow === 0
                  ? "bg-green-100 dark:bg-green-900/20"
                  : "bg-yellow-100 dark:bg-yellow-900/20"
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 ${
                  summary.monthsWithNegativeCashFlow === 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Negative Months</p>
              <p className="text-xl font-semibold">{summary.monthsWithNegativeCashFlow} / 12</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/forecast/ForecastSummary.tsx
git commit -m "feat(ui): add forecast summary cards component"
```

---

## Task 7: Scenario Modal Component

**Files:**
- Create: `/src/components/forecast/ScenarioModal.tsx`

**Step 1: Create the modal component**

Create `/src/components/forecast/ScenarioModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Star } from "lucide-react";
import type { ForecastScenario } from "@/server/db/schema";

type ScenarioModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scenarios?: ForecastScenario[];
};

export function ScenarioModal({ open, onClose, onSuccess, scenarios }: ScenarioModalProps) {
  const [name, setName] = useState("");
  const [rentGrowth, setRentGrowth] = useState(2);
  const [expenseInflation, setExpenseInflation] = useState(3);
  const [vacancy, setVacancy] = useState(0);
  const [rateChange, setRateChange] = useState(0);

  const utils = trpc.useUtils();

  const createMutation = trpc.forecast.createScenario.useMutation({
    onSuccess: () => {
      utils.forecast.listScenarios.invalidate();
      resetForm();
      onSuccess();
    },
  });

  const deleteMutation = trpc.forecast.deleteScenario.useMutation({
    onSuccess: () => {
      utils.forecast.listScenarios.invalidate();
    },
  });

  const setDefaultMutation = trpc.forecast.setDefaultScenario.useMutation({
    onSuccess: () => {
      utils.forecast.listScenarios.invalidate();
    },
  });

  const resetForm = () => {
    setName("");
    setRentGrowth(2);
    setExpenseInflation(3);
    setVacancy(0);
    setRateChange(0);
  };

  const handleCreate = () => {
    if (!name.trim()) return;

    createMutation.mutate({
      name: name.trim(),
      assumptions: {
        rentGrowthPercent: rentGrowth,
        expenseInflationPercent: expenseInflation,
        vacancyRatePercent: vacancy,
        interestRateChangePercent: rateChange,
      },
      isDefault: !scenarios || scenarios.length === 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Scenarios</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing scenarios */}
          {scenarios && scenarios.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Scenarios</Label>
              <div className="space-y-2">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{scenario.name}</span>
                      {scenario.isDefault && (
                        <span className="text-xs text-muted-foreground">(Default)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!scenario.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate({ id: scenario.id })}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ id: scenario.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create new scenario */}
          <div className="space-y-4">
            <Label>Create New Scenario</Label>

            <div>
              <Label htmlFor="name" className="text-sm">
                Scenario Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Rate Rise 1%"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rentGrowth" className="text-sm">
                  Rent Growth (% p.a.)
                </Label>
                <Input
                  id="rentGrowth"
                  type="number"
                  step="0.5"
                  value={rentGrowth}
                  onChange={(e) => setRentGrowth(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="expenseInflation" className="text-sm">
                  Expense Inflation (% p.a.)
                </Label>
                <Input
                  id="expenseInflation"
                  type="number"
                  step="0.5"
                  value={expenseInflation}
                  onChange={(e) => setExpenseInflation(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="vacancy" className="text-sm">
                  Vacancy Rate (%)
                </Label>
                <Input
                  id="vacancy"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={vacancy}
                  onChange={(e) => setVacancy(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="rateChange" className="text-sm">
                  Interest Rate Change (%)
                </Label>
                <Input
                  id="rateChange"
                  type="number"
                  step="0.25"
                  value={rateChange}
                  onChange={(e) => setRateChange(Number(e.target.value))}
                />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Scenario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/forecast/ScenarioModal.tsx
git commit -m "feat(ui): add scenario management modal"
```

---

## Task 8: Final Integration and Testing

**Files:**
- Modify: `/src/components/layout/Sidebar.tsx` (add Forecast link)

**Step 1: Verify all tests pass**

Run: `npm run test:unit`

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Add forecast link to sidebar (under Reports section if exists, or standalone)**

The sidebar should already have reports links. If there's a Reports group, add Forecast there. Otherwise add as standalone.

Check Sidebar.tsx and add appropriately. The link should be:
```typescript
{ href: "/reports/forecast", label: "Forecast", icon: TrendingUp },
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete cash flow forecasting implementation"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | schema.ts | Database tables |
| 2 | forecast.ts, forecast.test.ts | Core calculation logic |
| 3 | forecast.ts (router), _app.ts | API endpoints |
| 4 | reports/forecast/page.tsx, reports/page.tsx | Main forecast page |
| 5 | ForecastChart.tsx | Line chart visualization |
| 6 | ForecastSummary.tsx | Summary cards |
| 7 | ScenarioModal.tsx | Scenario CRUD modal |
| 8 | Sidebar.tsx | Final integration |
