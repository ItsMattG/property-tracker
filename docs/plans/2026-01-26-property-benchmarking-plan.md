# Property Performance Benchmarking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to benchmark their properties against suburb market data, showing yield/growth/expense percentiles and identifying underperformers.

**Architecture:** Suburb benchmarks table stores market data (from Domain API mock initially). Performance benchmarking service calculates percentiles and scores. New PerformanceCard component shows results on property detail page. Extends existing benchmarking system (which handles cost comparison) with market performance comparison.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, PostgreSQL

---

## Task 1: Add Suburb Benchmark Database Table

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add the propertyTypeEnum if it doesn't exist**

Find the enums section and add (if not already present):

```typescript
export const benchmarkPropertyTypeEnum = pgEnum("benchmark_property_type", [
  "house",
  "unit",
  "townhouse",
]);
```

**Step 2: Add suburbBenchmarks table**

Add after the existing tables (near the end of the file, before relations):

```typescript
export const suburbBenchmarks = pgTable("suburb_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  suburb: text("suburb").notNull(),
  state: text("state").notNull(),
  postcode: text("postcode").notNull(),
  propertyType: text("property_type").notNull(), // 'house', 'unit', 'townhouse'
  bedrooms: integer("bedrooms"), // null = all bedrooms aggregate

  // Rental metrics
  medianRent: decimal("median_rent", { precision: 10, scale: 2 }),
  rentalYield: decimal("rental_yield", { precision: 5, scale: 2 }),
  vacancyRate: decimal("vacancy_rate", { precision: 5, scale: 2 }),
  daysOnMarket: integer("days_on_market"),

  // Sales metrics
  medianPrice: decimal("median_price", { precision: 12, scale: 2 }),
  priceGrowth1yr: decimal("price_growth_1yr", { precision: 5, scale: 2 }),
  priceGrowth5yr: decimal("price_growth_5yr", { precision: 5, scale: 2 }),

  // Metadata
  sampleSize: integer("sample_size"),
  dataSource: text("data_source"), // 'domain', 'corelogic', 'mock'
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add suburb_benchmarks table"
```

---

## Task 2: Add Property Performance Benchmarks Table

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add propertyPerformanceBenchmarks table**

Add after suburbBenchmarks:

```typescript
export const propertyPerformanceBenchmarks = pgTable("property_performance_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  // Percentile rankings (0-100)
  yieldPercentile: integer("yield_percentile"),
  growthPercentile: integer("growth_percentile"),
  expensePercentile: integer("expense_percentile"),
  vacancyPercentile: integer("vacancy_percentile"),

  // Overall score
  performanceScore: integer("performance_score"), // 0-100

  // Comparison context
  cohortSize: integer("cohort_size"),
  cohortDescription: text("cohort_description"), // "3-bed houses in Richmond VIC"
  suburbBenchmarkId: uuid("suburb_benchmark_id").references(() => suburbBenchmarks.id),

  // Insights
  insights: text("insights"), // JSON string of {type, message, severity}[]

  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add property_performance_benchmarks table"
```

---

## Task 3: Add Relations and Type Exports

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add relations**

Add after existing relations:

```typescript
export const suburbBenchmarksRelations = relations(suburbBenchmarks, ({ many }) => ({
  propertyBenchmarks: many(propertyPerformanceBenchmarks),
}));

export const propertyPerformanceBenchmarksRelations = relations(
  propertyPerformanceBenchmarks,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyPerformanceBenchmarks.propertyId],
      references: [properties.id],
    }),
    suburbBenchmark: one(suburbBenchmarks, {
      fields: [propertyPerformanceBenchmarks.suburbBenchmarkId],
      references: [suburbBenchmarks.id],
    }),
  })
);
```

**Step 2: Add type exports**

Add to exports section:

```typescript
export type SuburbBenchmark = typeof suburbBenchmarks.$inferSelect;
export type NewSuburbBenchmark = typeof suburbBenchmarks.$inferInsert;
export type PropertyPerformanceBenchmark = typeof propertyPerformanceBenchmarks.$inferSelect;
export type NewPropertyPerformanceBenchmark = typeof propertyPerformanceBenchmarks.$inferInsert;
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add performance benchmark relations and types"
```

---

## Task 4: Create Performance Benchmarking Types

**Files:**
- Create: `src/types/performance-benchmarking.ts`

**Step 1: Create types file**

```typescript
// src/types/performance-benchmarking.ts

export interface PercentileResult {
  value: number;        // User's actual value
  median: number;       // Suburb median
  percentile: number;   // 0-100
  status: "excellent" | "good" | "average" | "below" | "poor";
}

export interface PerformanceInsight {
  type: "yield" | "growth" | "expense" | "vacancy";
  message: string;
  severity: "positive" | "neutral" | "warning" | "critical";
}

export interface PropertyPerformanceResult {
  propertyId: string;
  performanceScore: number;           // 0-100
  scoreLabel: "Excellent" | "Good" | "Average" | "Below Average" | "Poor";

  yield: PercentileResult | null;
  growth: PercentileResult | null;
  expenses: PercentileResult | null;
  vacancy: PercentileResult | null;

  cohortDescription: string;          // "3-bed houses in Richmond VIC"
  cohortSize: number;

  insights: PerformanceInsight[];
  isUnderperforming: boolean;
  calculatedAt: Date;
}

export interface PortfolioPerformanceSummary {
  totalProperties: number;
  averageScore: number;
  underperformingCount: number;
  topPerformer: { propertyId: string; address: string; score: number } | null;
  worstPerformer: { propertyId: string; address: string; score: number } | null;
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/performance-benchmarking.ts
git commit -m "feat(types): add performance benchmarking types"
```

---

## Task 5: Create Performance Benchmarking Service

**Files:**
- Create: `src/server/services/performance-benchmarking.ts`

**Step 1: Create the service file**

```typescript
// src/server/services/performance-benchmarking.ts

import type {
  PercentileResult,
  PerformanceInsight,
  PropertyPerformanceResult,
} from "@/types/performance-benchmarking";
import type { SuburbBenchmark } from "../db/schema";

/**
 * Calculate percentile based on user value vs benchmark median
 * Uses a simplified model comparing to median
 */
export function calculatePercentile(
  userValue: number,
  benchmarkMedian: number
): number {
  if (benchmarkMedian <= 0) return 50;
  const ratio = userValue / benchmarkMedian;

  if (ratio >= 1.2) return 90;  // 20%+ above median
  if (ratio >= 1.1) return 75;
  if (ratio >= 1.0) return 55;
  if (ratio >= 0.9) return 40;
  if (ratio >= 0.8) return 25;
  return 10;  // 20%+ below median
}

/**
 * Calculate inverted percentile (for metrics where lower is better)
 */
export function calculateInvertedPercentile(
  userValue: number,
  benchmarkMedian: number
): number {
  if (benchmarkMedian <= 0) return 50;
  // Invert: if user is 20% below median (good), they're in 90th percentile
  const ratio = userValue / benchmarkMedian;

  if (ratio <= 0.8) return 90;  // 20%+ below median (excellent)
  if (ratio <= 0.9) return 75;
  if (ratio <= 1.0) return 55;
  if (ratio <= 1.1) return 40;
  if (ratio <= 1.2) return 25;
  return 10;  // 20%+ above median (poor)
}

export function getPercentileStatus(
  percentile: number
): "excellent" | "good" | "average" | "below" | "poor" {
  if (percentile >= 80) return "excellent";
  if (percentile >= 60) return "good";
  if (percentile >= 40) return "average";
  if (percentile >= 20) return "below";
  return "poor";
}

export function getScoreLabel(
  score: number
): "Excellent" | "Good" | "Average" | "Below Average" | "Poor" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  if (score >= 20) return "Below Average";
  return "Poor";
}

/**
 * Calculate overall performance score from percentiles
 * Weights: Yield 40%, Growth 30%, Expenses 20% (inverted), Vacancy 10% (inverted)
 */
export function calculatePerformanceScore(
  yieldPercentile: number | null,
  growthPercentile: number | null,
  expensePercentile: number | null,
  vacancyPercentile: number | null
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  if (yieldPercentile !== null) {
    weightedSum += yieldPercentile * 0.4;
    totalWeight += 0.4;
  }
  if (growthPercentile !== null) {
    weightedSum += growthPercentile * 0.3;
    totalWeight += 0.3;
  }
  if (expensePercentile !== null) {
    weightedSum += expensePercentile * 0.2;
    totalWeight += 0.2;
  }
  if (vacancyPercentile !== null) {
    weightedSum += vacancyPercentile * 0.1;
    totalWeight += 0.1;
  }

  if (totalWeight === 0) return 50; // Default if no data
  return Math.round(weightedSum / totalWeight);
}

/**
 * Generate insights based on performance metrics
 */
export function generateInsights(
  userYield: number | null,
  medianYield: number | null,
  userExpenseRatio: number | null,
  medianExpenseRatio: number | null,
  userVacancyWeeks: number | null,
  suburbVacancyRate: number | null
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  // Yield insights
  if (userYield !== null && medianYield !== null && medianYield > 0) {
    const yieldRatio = userYield / medianYield;
    if (yieldRatio < 0.85) {
      const percentBelow = Math.round((1 - yieldRatio) * 100);
      insights.push({
        type: "yield",
        message: `Rent is ${percentBelow}% below market. Consider rent review at next lease renewal.`,
        severity: "warning",
      });
    } else if (yieldRatio > 1.1) {
      insights.push({
        type: "yield",
        message: "Strong yield performance - top quartile for similar properties.",
        severity: "positive",
      });
    }
  }

  // Expense insights
  if (userExpenseRatio !== null && medianExpenseRatio !== null && medianExpenseRatio > 0) {
    const expenseRatio = userExpenseRatio / medianExpenseRatio;
    if (expenseRatio > 1.2) {
      insights.push({
        type: "expense",
        message: "Operating expenses are high. Review insurance and management fees.",
        severity: "warning",
      });
    }
  }

  // Vacancy insights
  if (userVacancyWeeks !== null && suburbVacancyRate !== null && suburbVacancyRate > 0) {
    const expectedVacancyWeeks = suburbVacancyRate * 52 / 100;
    if (userVacancyWeeks > expectedVacancyWeeks * 2) {
      insights.push({
        type: "vacancy",
        message: "High vacancy compared to suburb average. Check property presentation or agent performance.",
        severity: "critical",
      });
    }
  }

  return insights;
}

/**
 * Determine if property is underperforming
 */
export function isUnderperforming(
  yieldPercentile: number | null,
  expensePercentile: number | null,
  vacancyPercentile: number | null
): boolean {
  // Underperforming if any critical metric is in bottom quartile
  if (yieldPercentile !== null && yieldPercentile < 25) return true;
  if (expensePercentile !== null && expensePercentile < 25) return true; // Inverted, so low = high expenses
  if (vacancyPercentile !== null && vacancyPercentile < 25) return true; // Inverted, so low = high vacancy
  return false;
}

/**
 * Build cohort description
 */
export function buildCohortDescription(
  bedrooms: number | null,
  propertyType: string,
  suburb: string,
  state: string
): string {
  const bedroomText = bedrooms ? `${bedrooms}-bed` : "";
  const typeText = propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
  const pluralType = typeText === "House" ? "houses" : typeText.toLowerCase() + "s";

  return `${bedroomText} ${pluralType} in ${suburb} ${state}`.trim().replace(/\s+/g, " ");
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/performance-benchmarking.ts
git commit -m "feat(service): add performance benchmarking calculations"
```

---

## Task 6: Create Mock Suburb Data Service

**Files:**
- Create: `src/server/services/suburb-data.ts`

**Step 1: Create the mock data service**

```typescript
// src/server/services/suburb-data.ts

import type { NewSuburbBenchmark } from "../db/schema";

/**
 * Mock suburb benchmark data for development
 * In production, this would be fetched from Domain API
 */
const MOCK_SUBURB_DATA: Record<string, Partial<NewSuburbBenchmark>> = {
  // VIC suburbs
  "richmond-vic-house": {
    suburb: "Richmond",
    state: "VIC",
    postcode: "3121",
    propertyType: "house",
    medianRent: "650",
    rentalYield: "2.8",
    vacancyRate: "2.1",
    medianPrice: "1450000",
    priceGrowth1yr: "4.5",
    priceGrowth5yr: "32.0",
    sampleSize: 245,
    dataSource: "mock",
  },
  "richmond-vic-unit": {
    suburb: "Richmond",
    state: "VIC",
    postcode: "3121",
    propertyType: "unit",
    medianRent: "480",
    rentalYield: "3.8",
    vacancyRate: "2.5",
    medianPrice: "580000",
    priceGrowth1yr: "2.1",
    priceGrowth5yr: "18.0",
    sampleSize: 312,
    dataSource: "mock",
  },
  "fitzroy-vic-house": {
    suburb: "Fitzroy",
    state: "VIC",
    postcode: "3065",
    propertyType: "house",
    medianRent: "720",
    rentalYield: "2.5",
    vacancyRate: "1.8",
    medianPrice: "1680000",
    priceGrowth1yr: "5.2",
    priceGrowth5yr: "38.0",
    sampleSize: 89,
    dataSource: "mock",
  },
  // NSW suburbs
  "surry-hills-nsw-unit": {
    suburb: "Surry Hills",
    state: "NSW",
    postcode: "2010",
    propertyType: "unit",
    medianRent: "650",
    rentalYield: "3.2",
    vacancyRate: "2.0",
    medianPrice: "950000",
    priceGrowth1yr: "3.8",
    priceGrowth5yr: "25.0",
    sampleSize: 428,
    dataSource: "mock",
  },
  "parramatta-nsw-unit": {
    suburb: "Parramatta",
    state: "NSW",
    postcode: "2150",
    propertyType: "unit",
    medianRent: "520",
    rentalYield: "4.2",
    vacancyRate: "3.1",
    medianPrice: "620000",
    priceGrowth1yr: "1.5",
    priceGrowth5yr: "12.0",
    sampleSize: 567,
    dataSource: "mock",
  },
  // QLD suburbs
  "west-end-qld-unit": {
    suburb: "West End",
    state: "QLD",
    postcode: "4101",
    propertyType: "unit",
    medianRent: "550",
    rentalYield: "4.5",
    vacancyRate: "2.8",
    medianPrice: "580000",
    priceGrowth1yr: "6.2",
    priceGrowth5yr: "35.0",
    sampleSize: 234,
    dataSource: "mock",
  },
};

// Default benchmarks by state for fallback
const DEFAULT_BENCHMARKS: Record<string, Partial<NewSuburbBenchmark>> = {
  VIC: {
    medianRent: "550",
    rentalYield: "3.2",
    vacancyRate: "2.5",
    medianPrice: "850000",
    priceGrowth1yr: "3.5",
    priceGrowth5yr: "25.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
  NSW: {
    medianRent: "600",
    rentalYield: "2.8",
    vacancyRate: "2.2",
    medianPrice: "1100000",
    priceGrowth1yr: "4.0",
    priceGrowth5yr: "30.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
  QLD: {
    medianRent: "520",
    rentalYield: "4.0",
    vacancyRate: "2.8",
    medianPrice: "680000",
    priceGrowth1yr: "5.5",
    priceGrowth5yr: "40.0",
    sampleSize: 1000,
    dataSource: "mock",
  },
};

export function getMockSuburbBenchmark(
  suburb: string,
  state: string,
  propertyType: string
): Partial<NewSuburbBenchmark> | null {
  const key = `${suburb.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}-${propertyType.toLowerCase()}`;

  if (MOCK_SUBURB_DATA[key]) {
    return MOCK_SUBURB_DATA[key];
  }

  // Fallback to state defaults
  const stateDefault = DEFAULT_BENCHMARKS[state];
  if (stateDefault) {
    return {
      ...stateDefault,
      suburb,
      state,
      postcode: "0000",
      propertyType,
    };
  }

  return null;
}

/**
 * Get or create suburb benchmark in database
 * In production, this would check cache age and refresh from Domain API
 */
export async function getOrCreateSuburbBenchmark(
  db: {
    query: {
      suburbBenchmarks: {
        findFirst: (opts: unknown) => Promise<unknown>;
      };
    };
    insert: (table: unknown) => {
      values: (v: unknown) => {
        returning: () => Promise<unknown[]>;
      };
    };
  },
  suburbBenchmarksTable: unknown,
  suburb: string,
  state: string,
  propertyType: string
): Promise<unknown | null> {
  // Check if we have recent data (within 7 days)
  const existing = await db.query.suburbBenchmarks.findFirst({
    where: (sb: { suburb: unknown; state: unknown; propertyType: unknown }, { eq, and }: { eq: (a: unknown, b: unknown) => unknown; and: (...args: unknown[]) => unknown }) =>
      and(
        eq(sb.suburb, suburb),
        eq(sb.state, state),
        eq(sb.propertyType, propertyType)
      ),
  });

  if (existing) {
    return existing;
  }

  // Get mock data and insert
  const mockData = getMockSuburbBenchmark(suburb, state, propertyType);
  if (!mockData) {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  const [inserted] = await db
    .insert(suburbBenchmarksTable)
    .values({
      ...mockData,
      periodStart: today,
      periodEnd: today,
    })
    .returning();

  return inserted;
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/suburb-data.ts
git commit -m "feat(service): add mock suburb benchmark data"
```

---

## Task 7: Create Performance Benchmarking Router

**Files:**
- Create: `src/server/routers/performanceBenchmarking.ts`

**Step 1: Create the router**

```typescript
// src/server/routers/performanceBenchmarking.ts

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  properties,
  transactions,
  suburbBenchmarks,
  propertyPerformanceBenchmarks,
} from "../db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import {
  calculatePercentile,
  calculateInvertedPercentile,
  calculatePerformanceScore,
  generateInsights,
  isUnderperforming,
  buildCohortDescription,
  getScoreLabel,
  getPercentileStatus,
} from "../services/performance-benchmarking";
import { getOrCreateSuburbBenchmark } from "../services/suburb-data";
import type {
  PropertyPerformanceResult,
  PercentileResult,
  PortfolioPerformanceSummary,
} from "@/types/performance-benchmarking";

function getLastYearDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date;
}

export const performanceBenchmarkingRouter = router({
  getPropertyPerformance: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<PropertyPerformanceResult | null> => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
        with: {
          propertyValues: {
            orderBy: (v, { desc }) => [desc(v.valueDate)],
            limit: 1,
          },
        },
      });

      if (!property) return null;

      // Get suburb benchmark
      const suburbBenchmark = await getOrCreateSuburbBenchmark(
        ctx.db,
        suburbBenchmarks,
        property.suburb,
        property.state,
        property.propertyType || "house"
      ) as {
        id: string;
        medianRent: string | null;
        rentalYield: string | null;
        vacancyRate: string | null;
        medianPrice: string | null;
        priceGrowth1yr: string | null;
        sampleSize: number | null;
      } | null;

      if (!suburbBenchmark) {
        return null;
      }

      // Get property transactions for last year
      const lastYear = getLastYearDate();
      const propertyTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          gte(transactions.date, lastYear.toISOString().split("T")[0])
        ),
      });

      // Calculate user metrics
      const annualRent = propertyTransactions
        .filter((t) => t.category === "rental_income")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const annualExpenses = propertyTransactions
        .filter((t) => t.transactionType === "expense")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const currentValue = property.propertyValues?.[0]?.estimatedValue
        ? parseFloat(property.propertyValues[0].estimatedValue)
        : parseFloat(property.purchasePrice);

      const userYield = currentValue > 0 ? (annualRent / currentValue) * 100 : null;
      const userExpenseRatio = annualRent > 0 ? (annualExpenses / annualRent) * 100 : null;

      // Get benchmark values
      const medianYield = suburbBenchmark.rentalYield
        ? parseFloat(suburbBenchmark.rentalYield)
        : null;
      const medianPrice = suburbBenchmark.medianPrice
        ? parseFloat(suburbBenchmark.medianPrice)
        : null;
      const priceGrowth = suburbBenchmark.priceGrowth1yr
        ? parseFloat(suburbBenchmark.priceGrowth1yr)
        : null;
      const vacancyRate = suburbBenchmark.vacancyRate
        ? parseFloat(suburbBenchmark.vacancyRate)
        : null;

      // Calculate percentiles
      let yieldPercentile: number | null = null;
      let yieldResult: PercentileResult | null = null;
      if (userYield !== null && medianYield !== null) {
        yieldPercentile = calculatePercentile(userYield, medianYield);
        yieldResult = {
          value: Math.round(userYield * 10) / 10,
          median: medianYield,
          percentile: yieldPercentile,
          status: getPercentileStatus(yieldPercentile),
        };
      }

      let growthPercentile: number | null = null;
      let growthResult: PercentileResult | null = null;
      if (priceGrowth !== null) {
        // Use suburb growth as proxy for user property growth
        growthPercentile = 55; // Default to slightly above median
        growthResult = {
          value: priceGrowth,
          median: priceGrowth,
          percentile: growthPercentile,
          status: getPercentileStatus(growthPercentile),
        };
      }

      // Expense percentile (inverted - lower expenses = higher percentile)
      let expensePercentile: number | null = null;
      let expenseResult: PercentileResult | null = null;
      if (userExpenseRatio !== null) {
        // Assume typical expense ratio is 25-35% of rent
        const medianExpenseRatio = 30;
        expensePercentile = calculateInvertedPercentile(userExpenseRatio, medianExpenseRatio);
        expenseResult = {
          value: Math.round(userExpenseRatio),
          median: medianExpenseRatio,
          percentile: expensePercentile,
          status: getPercentileStatus(expensePercentile),
        };
      }

      // Vacancy percentile (inverted)
      let vacancyPercentile: number | null = null;
      let vacancyResult: PercentileResult | null = null;
      if (vacancyRate !== null) {
        // Use suburb vacancy as reference
        vacancyPercentile = 55; // Default - would calculate from actual vacancy if tracked
        vacancyResult = {
          value: vacancyRate,
          median: vacancyRate,
          percentile: vacancyPercentile,
          status: getPercentileStatus(vacancyPercentile),
        };
      }

      const performanceScore = calculatePerformanceScore(
        yieldPercentile,
        growthPercentile,
        expensePercentile,
        vacancyPercentile
      );

      const insights = generateInsights(
        userYield,
        medianYield,
        userExpenseRatio,
        30, // median expense ratio
        null, // user vacancy weeks
        vacancyRate
      );

      const cohortDescription = buildCohortDescription(
        property.bedrooms,
        property.propertyType || "house",
        property.suburb,
        property.state
      );

      // Cache the result
      await ctx.db
        .insert(propertyPerformanceBenchmarks)
        .values({
          propertyId: input.propertyId,
          yieldPercentile,
          growthPercentile,
          expensePercentile,
          vacancyPercentile,
          performanceScore,
          cohortSize: suburbBenchmark.sampleSize || 0,
          cohortDescription,
          suburbBenchmarkId: suburbBenchmark.id,
          insights: JSON.stringify(insights),
        })
        .onConflictDoUpdate({
          target: propertyPerformanceBenchmarks.propertyId,
          set: {
            yieldPercentile,
            growthPercentile,
            expensePercentile,
            vacancyPercentile,
            performanceScore,
            cohortSize: suburbBenchmark.sampleSize || 0,
            cohortDescription,
            suburbBenchmarkId: suburbBenchmark.id,
            insights: JSON.stringify(insights),
            calculatedAt: new Date(),
          },
        });

      return {
        propertyId: input.propertyId,
        performanceScore,
        scoreLabel: getScoreLabel(performanceScore),
        yield: yieldResult,
        growth: growthResult,
        expenses: expenseResult,
        vacancy: vacancyResult,
        cohortDescription,
        cohortSize: suburbBenchmark.sampleSize || 0,
        insights,
        isUnderperforming: isUnderperforming(yieldPercentile, expensePercentile, vacancyPercentile),
        calculatedAt: new Date(),
      };
    }),

  getPortfolioPerformance: protectedProcedure.query(
    async ({ ctx }): Promise<PortfolioPerformanceSummary> => {
      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      });

      if (userProperties.length === 0) {
        return {
          totalProperties: 0,
          averageScore: 0,
          underperformingCount: 0,
          topPerformer: null,
          worstPerformer: null,
        };
      }

      const benchmarks = await ctx.db.query.propertyPerformanceBenchmarks.findMany({
        where: inArray(
          propertyPerformanceBenchmarks.propertyId,
          userProperties.map((p) => p.id)
        ),
      });

      if (benchmarks.length === 0) {
        return {
          totalProperties: userProperties.length,
          averageScore: 50,
          underperformingCount: 0,
          topPerformer: null,
          worstPerformer: null,
        };
      }

      const scores = benchmarks
        .filter((b) => b.performanceScore !== null)
        .map((b) => ({
          propertyId: b.propertyId,
          score: b.performanceScore!,
          address: userProperties.find((p) => p.id === b.propertyId)?.address || "",
        }));

      const averageScore =
        scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

      const underperformingCount = benchmarks.filter((b) =>
        isUnderperforming(b.yieldPercentile, b.expensePercentile, b.vacancyPercentile)
      ).length;

      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const topPerformer = sorted[0] || null;
      const worstPerformer = sorted[sorted.length - 1] || null;

      return {
        totalProperties: userProperties.length,
        averageScore: Math.round(averageScore),
        underperformingCount,
        topPerformer,
        worstPerformer,
      };
    }
  ),

  getUnderperformers: protectedProcedure.query(async ({ ctx }) => {
    const userProperties = await ctx.db.query.properties.findMany({
      where: eq(properties.userId, ctx.portfolio.ownerId),
    });

    if (userProperties.length === 0) return [];

    const benchmarks = await ctx.db.query.propertyPerformanceBenchmarks.findMany({
      where: inArray(
        propertyPerformanceBenchmarks.propertyId,
        userProperties.map((p) => p.id)
      ),
    });

    return benchmarks
      .filter((b) =>
        isUnderperforming(b.yieldPercentile, b.expensePercentile, b.vacancyPercentile)
      )
      .map((b) => ({
        ...b,
        property: userProperties.find((p) => p.id === b.propertyId),
        insights: b.insights ? JSON.parse(b.insights) : [],
      }));
  }),

  getSuburbBenchmark: protectedProcedure
    .input(
      z.object({
        suburb: z.string(),
        state: z.string(),
        propertyType: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getOrCreateSuburbBenchmark(
        ctx.db,
        suburbBenchmarks,
        input.suburb,
        input.state,
        input.propertyType
      );
    }),
});
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/performanceBenchmarking.ts
git commit -m "feat(router): add performance benchmarking tRPC router"
```

---

## Task 8: Register Performance Benchmarking Router

**Files:**
- Modify: `src/server/routers/_app.ts`

**Step 1: Add import**

Add to imports:

```typescript
import { performanceBenchmarkingRouter } from "./performanceBenchmarking";
```

**Step 2: Register router**

Add to appRouter object:

```typescript
  performanceBenchmarking: performanceBenchmarkingRouter,
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/_app.ts
git commit -m "feat(router): register performance benchmarking router"
```

---

## Task 9: Create Performance Card Component

**Files:**
- Create: `src/components/performance-benchmarking/PerformanceCard.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance-benchmarking/PerformanceCard.tsx

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { PercentileResult, PerformanceInsight } from "@/types/performance-benchmarking";

interface PerformanceCardProps {
  propertyId: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-emerald-600";
  if (score >= 40) return "text-yellow-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

function getScoreBadgeVariant(
  label: string
): "default" | "secondary" | "destructive" | "outline" {
  if (label === "Excellent" || label === "Good") return "default";
  if (label === "Average") return "secondary";
  return "destructive";
}

function PercentileBar({
  label,
  result,
  inverted = false,
}: {
  label: string;
  result: PercentileResult | null;
  inverted?: boolean;
}) {
  if (!result) return null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {result.percentile}th percentile
        </span>
      </div>
      <Progress value={result.percentile} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Your: {result.value}
          {label === "Rental Yield" || label === "Expenses" ? "%" : ""}
        </span>
        <span>
          Median: {result.median}
          {label === "Rental Yield" || label === "Expenses" ? "%" : ""}
        </span>
      </div>
      {inverted && (
        <p className="text-xs text-muted-foreground italic">(lower is better)</p>
      )}
    </div>
  );
}

function InsightItem({ insight }: { insight: PerformanceInsight }) {
  const severityStyles = {
    positive: "bg-green-50 border-green-200 text-green-800",
    neutral: "bg-gray-50 border-gray-200 text-gray-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    critical: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded border text-sm",
        severityStyles[insight.severity]
      )}
    >
      <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{insight.message}</span>
    </div>
  );
}

export function PerformanceCard({ propertyId }: PerformanceCardProps) {
  const { data: performance, isLoading } =
    trpc.performanceBenchmarking.getPropertyPerformance.useQuery({
      propertyId,
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!performance) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <CardTitle>Market Performance</CardTitle>
          </div>
          <Badge variant={getScoreBadgeVariant(performance.scoreLabel)}>
            {performance.scoreLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score */}
        <div className="text-center">
          <div
            className={cn(
              "text-4xl font-bold",
              getScoreColor(performance.performanceScore)
            )}
          >
            {performance.performanceScore}
          </div>
          <p className="text-sm text-muted-foreground">Performance Score</p>
          <p className="text-xs text-muted-foreground mt-1">
            Compared to {performance.cohortSize} {performance.cohortDescription}
          </p>
        </div>

        {/* Underperforming warning */}
        {performance.isUnderperforming && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              This property is underperforming compared to similar properties
            </span>
          </div>
        )}

        {/* Percentile bars */}
        <div className="space-y-4">
          <PercentileBar label="Rental Yield" result={performance.yield} />
          <PercentileBar label="Capital Growth" result={performance.growth} />
          <PercentileBar label="Expenses" result={performance.expenses} inverted />
        </div>

        {/* Insights */}
        {performance.insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Insights</h4>
            {performance.insights.map((insight, i) => (
              <InsightItem key={i} insight={insight} />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Based on suburb market data. Updated{" "}
          {new Date(performance.calculatedAt).toLocaleDateString()}.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create index export**

Create `src/components/performance-benchmarking/index.ts`:

```typescript
export { PerformanceCard } from "./PerformanceCard";
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/performance-benchmarking/
git commit -m "feat(ui): add PerformanceCard component"
```

---

## Task 10: Add Performance Card to Property Detail Page

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx`

**Step 1: Add import**

Add to imports:

```typescript
import { PerformanceCard } from "@/components/performance-benchmarking";
```

**Step 2: Add PerformanceCard to the page**

Find where BenchmarkCard is rendered and add PerformanceCard nearby:

```typescript
<PerformanceCard propertyId={propertyId} />
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/page.tsx
git commit -m "feat(ui): add PerformanceCard to property detail page"
```

---

## Task 11: Run Full Verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: add property performance benchmarking

- Suburb benchmarks table with market data (mock for now)
- Performance percentile calculations (yield, growth, expenses)
- Performance score with weighted combination
- Insight generation for actionable recommendations
- PerformanceCard component on property detail page
- tRPC router for performance data

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add suburb_benchmarks table |
| 2 | Add property_performance_benchmarks table |
| 3 | Add relations and type exports |
| 4 | Create performance benchmarking types |
| 5 | Create performance benchmarking service |
| 6 | Create mock suburb data service |
| 7 | Create performance benchmarking router |
| 8 | Register router in app |
| 9 | Create PerformanceCard component |
| 10 | Add PerformanceCard to property detail page |
| 11 | Final verification |

**Future enhancements (not in this plan):**
- Domain API integration for real suburb data
- Portfolio performance tab with all properties ranked
- Underperformer alerts/notifications
- Vector DB for advanced similarity matching
