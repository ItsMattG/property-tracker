# AI Property Health Score & Insights Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add LLM-generated portfolio insights using Claude 3.5 Haiku — on-demand generation with 24h DB cache, dashboard widget, and scorecard page integration.

**Architecture:** New `portfolio_insights` table caches AI-generated insight arrays per user. Two new tRPC procedures (`getInsights` reads cache, `generateInsights` calls Haiku and caches). Dashboard widget shows top 3 insights; scorecard page shows full per-property breakdown. Rate-limited to 1 generation/hr/user.

**Tech Stack:** Drizzle ORM (jsonb typed columns), tRPC v11, Anthropic SDK (Claude 3.5 Haiku), React 19, Tailwind v4, Vitest

**Design doc:** `docs/plans/2026-02-19-ai-property-health-score-design.md`

**Beads task:** property-tracker-z23

---

## Tech Notes

**Anthropic SDK JSON output:** No native JSON mode. Use prompt instructions to request JSON, parse `message.content[0].text` manually. Validate with Zod before caching.

**Drizzle typed JSONB:** `jsonb("col").$type<MyType>()` provides TypeScript inference on queries. Use `.$type<PortfolioInsight[]>()` for the insights column.

**tRPC rate limiting:** `throw new TRPCError({ code: "TOO_MANY_REQUESTS" })` is valid in v11.

**Existing patterns:** Anthropic client from `categorization.ts` uses `getAnthropicClient()` lazy init. Repos extend `BaseRepository`, implement interface, register in UoW with lazy getter. Portfolio router already has `getSummary`, `getPropertyMetrics`, `getBorrowingPower`.

---

### Task 1: Schema — portfolio_insights table

**Files:**
- Create: `src/server/db/schema/portfolio-insights.ts`
- Modify: `src/server/db/schema/index.ts`

**Step 1: Create the schema file**

Create `src/server/db/schema/portfolio-insights.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "./_common";
import { users } from "./auth";

export interface PortfolioInsight {
  propertyId: string | null;
  category:
    | "yield"
    | "expense"
    | "loan"
    | "concentration"
    | "compliance"
    | "growth"
    | "general";
  severity: "positive" | "info" | "warning" | "critical";
  title: string;
  body: string;
}

export const portfolioInsights = pgTable(
  "portfolio_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    insights: jsonb("insights").$type<PortfolioInsight[]>().notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    modelUsed: text("model_used").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("portfolio_insights_user_id_idx").on(table.userId)]
);

export type PortfolioInsightRow = typeof portfolioInsights.$inferSelect;
export type NewPortfolioInsightRow = typeof portfolioInsights.$inferInsert;
```

**Step 2: Add barrel export**

In `src/server/db/schema/index.ts`, add at the end:

```typescript
export * from "./portfolio-insights";
```

**Step 3: Commit**

```bash
git add src/server/db/schema/portfolio-insights.ts src/server/db/schema/index.ts
git commit -m "feat: add portfolio_insights schema for AI-generated insights cache"
```

---

### Task 2: Repository — InsightsRepository with interface

**Files:**
- Create: `src/server/repositories/interfaces/insights.repository.interface.ts`
- Modify: `src/server/repositories/interfaces/index.ts`
- Create: `src/server/repositories/insights.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts`

**Step 1: Create the interface**

Create `src/server/repositories/interfaces/insights.repository.interface.ts`:

```typescript
import type {
  PortfolioInsightRow,
  NewPortfolioInsightRow,
} from "../../db/schema";

export interface IInsightsRepository {
  findFreshByUser(userId: string): Promise<PortfolioInsightRow | null>;
  upsert(data: NewPortfolioInsightRow): Promise<PortfolioInsightRow>;
}
```

**Step 2: Add to interfaces barrel**

In `src/server/repositories/interfaces/index.ts`, add:

```typescript
export type { IInsightsRepository } from "./insights.repository.interface";
```

**Step 3: Create the repository**

Create `src/server/repositories/insights.repository.ts`:

```typescript
import { eq, gt } from "drizzle-orm";
import { BaseRepository } from "./base";
import type { IInsightsRepository } from "./interfaces/insights.repository.interface";
import {
  portfolioInsights,
  type PortfolioInsightRow,
  type NewPortfolioInsightRow,
} from "../db/schema";
import type { DB } from "./base";

export class InsightsRepository
  extends BaseRepository
  implements IInsightsRepository
{
  async findFreshByUser(userId: string): Promise<PortfolioInsightRow | null> {
    const [row] = await this.db
      .select()
      .from(portfolioInsights)
      .where(eq(portfolioInsights.userId, userId))
      .orderBy(portfolioInsights.generatedAt)
      .limit(1);

    if (!row) return null;

    // Check if still fresh (expiresAt > now)
    if (row.expiresAt < new Date()) return null;

    return row;
  }

  async upsert(
    data: NewPortfolioInsightRow,
    tx?: DB
  ): Promise<PortfolioInsightRow> {
    const client = this.resolve(tx);

    // Delete existing row for user, then insert new
    await client
      .delete(portfolioInsights)
      .where(eq(portfolioInsights.userId, data.userId));

    const [row] = await client
      .insert(portfolioInsights)
      .values(data)
      .returning();

    return row;
  }
}
```

**Step 4: Register in UnitOfWork**

In `src/server/repositories/unit-of-work.ts`:

1. Add import at top with other interface imports:
```typescript
import type { IInsightsRepository } from "./interfaces/insights.repository.interface";
```

2. Add import with other concrete class imports:
```typescript
import { InsightsRepository } from "./insights.repository";
```

3. Add private field with the other fields:
```typescript
private _insights?: IInsightsRepository;
```

4. Add lazy getter with the other getters:
```typescript
get insights(): IInsightsRepository {
  return (this._insights ??= new InsightsRepository(this.db));
}
```

**Step 5: Commit**

```bash
git add src/server/repositories/interfaces/insights.repository.interface.ts src/server/repositories/interfaces/index.ts src/server/repositories/insights.repository.ts src/server/repositories/unit-of-work.ts
git commit -m "feat: add InsightsRepository with interface and UoW registration"
```

---

### Task 3: Insight generation service

**Files:**
- Create: `src/server/services/ai/insight-generator.ts`

This service builds the prompt, calls Haiku, and parses the response. Separated from the router for testability.

**Step 1: Create the service**

Create `src/server/services/ai/insight-generator.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { PortfolioInsight } from "@/server/db/schema";

const HAIKU_MODEL = "claude-3-5-haiku-20241022";

const insightSchema = z.object({
  propertyId: z.string().nullable(),
  category: z.enum([
    "yield",
    "expense",
    "loan",
    "concentration",
    "compliance",
    "growth",
    "general",
  ]),
  severity: z.enum(["positive", "info", "warning", "critical"]),
  title: z.string().max(100),
  body: z.string().max(300),
});

const insightsArraySchema = z.array(insightSchema).min(1).max(20);

export interface PortfolioDataForInsights {
  properties: Array<{
    id: string;
    address: string;
    suburb: string;
    state: string;
    purchasePrice: number;
    currentValue: number;
    grossYield: number | null;
    netYield: number | null;
    performanceScore: number | null;
  }>;
  loans: Array<{
    propertyId: string;
    balance: number;
    rate: number;
    repaymentAmount: number;
    repaymentFrequency: string;
  }>;
  portfolioMetrics: {
    totalValue: number;
    totalDebt: number;
    totalEquity: number;
    portfolioLVR: number;
    annualRentalIncome: number;
    annualExpenses: number;
    netSurplus: number;
  };
  suburbConcentration: Array<{
    suburb: string;
    state: string;
    count: number;
    percentage: number;
  }>;
  expenseBreakdown: Array<{
    propertyAddress: string;
    category: string;
    annualAmount: number;
  }>;
}

function buildSystemPrompt(): string {
  return `You are a property investment analyst reviewing an Australian investor's portfolio.

Analyze the portfolio data and return 8-15 actionable insights as a JSON array.

Each insight must have:
- "propertyId": string or null (null for portfolio-level insights)
- "category": one of "yield", "expense", "loan", "concentration", "compliance", "growth", "general"
- "severity": one of "positive" (good news), "info" (neutral observation), "warning" (needs attention), "critical" (urgent action needed)
- "title": short headline (max 100 chars)
- "body": 1-2 sentence explanation with specific actionable advice (max 300 chars)

Focus on:
- Yield comparisons across properties (which outperform/underperform)
- Expense anomalies (insurance, rates, maintenance above/below average)
- Loan health (LVR, interest rate comparisons, refinancing opportunities)
- Geographic concentration risk
- Cash flow trends
- Capital growth observations

Be specific with numbers. Reference actual property addresses. Give concrete advice.
Do NOT give generic advice. Every insight must reference specific data from the portfolio.

Return ONLY the JSON array, no markdown, no explanation.`;
}

function buildUserPrompt(data: PortfolioDataForInsights): string {
  return JSON.stringify(data, null, 2);
}

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface InsightGenerationResult {
  insights: PortfolioInsight[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generatePortfolioInsights(
  data: PortfolioDataForInsights
): Promise<InsightGenerationResult> {
  const client = getClient();

  const message = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(data),
      },
    ],
    system: buildSystemPrompt(),
  });

  const content = message.content[0];
  if (content.type !== "text") {
    logger.error("Unexpected Anthropic response type", undefined, {
      type: content.type,
    });
    return {
      insights: [],
      modelUsed: HAIKU_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }

  // Parse and validate JSON response
  let parsed: unknown;
  try {
    // Strip markdown fences if present
    const text = content.text
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
    parsed = JSON.parse(text);
  } catch (parseError) {
    logger.error("Failed to parse insights JSON", parseError, {
      responseText: content.text.slice(0, 500),
    });
    return {
      insights: [],
      modelUsed: HAIKU_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }

  const validation = insightsArraySchema.safeParse(parsed);
  if (!validation.success) {
    logger.error("Insights failed Zod validation", undefined, {
      errors: validation.error.issues.slice(0, 5),
    });
    return {
      insights: [],
      modelUsed: HAIKU_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }

  return {
    insights: validation.data,
    modelUsed: HAIKU_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
```

**Step 2: Commit**

```bash
git add src/server/services/ai/insight-generator.ts
git commit -m "feat: add insight generator service with Haiku LLM and Zod validation"
```

---

### Task 4: Router procedures + tests — getInsights and generateInsights

**Files:**
- Modify: `src/server/routers/portfolio/portfolio.ts`
- Create: `src/server/routers/portfolio/__tests__/insights.test.ts`

**Step 1: Write the test file**

Create `src/server/routers/portfolio/__tests__/insights.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

let currentMockUow: UnitOfWork;

vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

// Mock the insight generator
vi.mock("../../../services/ai/insight-generator", () => ({
  generatePortfolioInsights: vi.fn().mockResolvedValue({
    insights: [
      {
        propertyId: null,
        category: "general",
        severity: "info",
        title: "Test insight",
        body: "This is a test insight body.",
      },
    ],
    modelUsed: "claude-3-5-haiku-20241022",
    inputTokens: 100,
    outputTokens: 200,
  }),
}));

const mockFreshInsightRow = {
  id: "insight-1",
  userId: "user-1",
  insights: [
    {
      propertyId: null,
      category: "general" as const,
      severity: "info" as const,
      title: "Portfolio diversification",
      body: "Your properties are concentrated in one suburb.",
    },
  ],
  generatedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  modelUsed: "claude-3-5-haiku-20241022",
  inputTokens: 150,
  outputTokens: 300,
  createdAt: new Date(),
};

const mockStaleInsightRow = {
  ...mockFreshInsightRow,
  expiresAt: new Date(Date.now() - 1000), // expired
};

function setupCtx(
  overrides: Record<string, Record<string, unknown>> = {}
) {
  const uow = createMockUow({
    insights: {
      findFreshByUser: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(mockFreshInsightRow),
    },
    portfolio: {
      findProperties: vi.fn().mockResolvedValue([]),
      getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
      findLoansByProperties: vi.fn().mockResolvedValue([]),
      findTransactionsInRange: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  });

  currentMockUow = uow;

  const ctx = createMockContext({
    userId: mockUser.id,
    user: mockUser,
    uow,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial Drizzle DB mock requires any
  ctx.db = { query: {} } as any;

  return { ctx, caller: createTestCaller(ctx), uow };
}

describe("portfolio.getInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached insights when fresh", async () => {
    const { caller } = setupCtx({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(mockFreshInsightRow),
        upsert: vi.fn(),
      },
    });

    const result = await caller.portfolio.getInsights();

    expect(result.stale).toBe(false);
    expect(result.insights).toEqual(mockFreshInsightRow.insights);
    expect(result.generatedAt).toBeDefined();
  });

  it("returns stale flag when no cached insights", async () => {
    const { caller } = setupCtx({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
    });

    const result = await caller.portfolio.getInsights();

    expect(result.stale).toBe(true);
    expect(result.insights).toBeNull();
  });
});

describe("portfolio.generateInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates insights and caches result", async () => {
    const upsertMock = vi.fn().mockResolvedValue(mockFreshInsightRow);
    const { caller } = setupCtx({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(null),
        upsert: upsertMock,
      },
    });

    const result = await caller.portfolio.generateInsights();

    expect(result.insights).toBeDefined();
    expect(upsertMock).toHaveBeenCalled();
  });

  it("rate-limits to 1 generation per hour", async () => {
    const recentRow = {
      ...mockFreshInsightRow,
      generatedAt: new Date(), // just now
    };

    const { caller } = setupCtx({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(recentRow),
        upsert: vi.fn(),
      },
    });

    // Second call within the hour should throw
    await expect(caller.portfolio.generateInsights()).rejects.toThrow(
      /rate limit/i
    );
  });

  it("returns empty insights on LLM failure", async () => {
    const { generatePortfolioInsights } = await import(
      "../../../services/ai/insight-generator"
    );
    vi.mocked(generatePortfolioInsights).mockResolvedValueOnce({
      insights: [],
      modelUsed: "claude-3-5-haiku-20241022",
      inputTokens: 100,
      outputTokens: 0,
    });

    const upsertMock = vi.fn().mockResolvedValue({
      ...mockFreshInsightRow,
      insights: [],
    });

    const { caller } = setupCtx({
      insights: {
        findFreshByUser: vi.fn().mockResolvedValue(null),
        upsert: upsertMock,
      },
    });

    const result = await caller.portfolio.generateInsights();

    expect(result.insights).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/portfolio/__tests__/insights.test.ts`
Expected: FAIL — `portfolio.getInsights` does not exist yet.

**Step 3: Add procedures to portfolio router**

In `src/server/routers/portfolio/portfolio.ts`:

1. Add imports at the top:
```typescript
import { TRPCError } from "@trpc/server";
import {
  generatePortfolioInsights,
  type PortfolioDataForInsights,
} from "../../services/ai/insight-generator";
import { categories } from "@/lib/categories";
```

Note: `TRPCError` may already be imported. Check and don't duplicate. The `categories` import may also already exist from `getBorrowingPower`.

2. Add two new procedures at the end of the router (before the closing `});`):

```typescript
  getInsights: protectedProcedure.query(async ({ ctx }) => {
    const cached = await ctx.uow.insights.findFreshByUser(
      ctx.portfolio.ownerId
    );

    if (cached) {
      return {
        stale: false,
        insights: cached.insights,
        generatedAt: cached.generatedAt,
      };
    }

    return {
      stale: true,
      insights: null as null,
      generatedAt: null as null,
    };
  }),

  generateInsights: writeProcedure.mutation(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;

    // Rate limit: max 1 generation per hour
    const existing = await ctx.uow.insights.findFreshByUser(ownerId);
    if (existing) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existing.generatedAt > hourAgo) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Insights were generated recently. Please wait before refreshing.",
        });
      }
    }

    // Gather all portfolio data
    const userProperties = await ctx.uow.portfolio.findProperties(ownerId);

    if (userProperties.length === 0) {
      return { insights: [], generatedAt: new Date() };
    }

    const propertyIds = userProperties.map((p) => p.id);
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const startDate = lastYear.toISOString().split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    const [latestValues, allLoans, transactions] = await Promise.all([
      ctx.uow.portfolio.getLatestPropertyValues(ownerId, propertyIds),
      ctx.uow.portfolio.findLoansByProperties(ownerId, propertyIds),
      ctx.uow.portfolio.findTransactionsInRange(ownerId, startDate, endDate),
    ]);

    // Build portfolio metrics
    const capitalCategoryValues = new Set(
      categories.filter((c) => c.type === "capital").map((c) => c.value)
    );

    let totalValue = 0;
    let totalDebt = 0;
    let annualRentalIncome = 0;
    let annualExpenses = 0;

    const propertyData = userProperties.map((p) => {
      const value =
        latestValues.get(p.id) || Number(p.purchasePrice);
      totalValue += value;

      const propertyLoans = allLoans.filter(
        (l) => l.propertyId === p.id
      );
      const propertyDebt = propertyLoans.reduce(
        (sum, l) => sum + Number(l.currentBalance),
        0
      );
      totalDebt += propertyDebt;

      const propertyTxns = transactions.filter(
        (t) => t.propertyId === p.id
      );
      const income = propertyTxns
        .filter((t) => t.transactionType === "income")
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      annualRentalIncome += income;

      const expenses = propertyTxns
        .filter(
          (t) =>
            t.transactionType === "expense" &&
            !capitalCategoryValues.has(t.category)
        )
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      annualExpenses += expenses;

      const grossYield = value > 0 ? (income / value) * 100 : null;
      const netYield =
        value > 0 ? ((income - expenses) / value) * 100 : null;

      return {
        id: p.id,
        address: p.address,
        suburb: p.suburb,
        state: p.state,
        purchasePrice: Number(p.purchasePrice),
        currentValue: value,
        grossYield: grossYield ? Math.round(grossYield * 10) / 10 : null,
        netYield: netYield ? Math.round(netYield * 10) / 10 : null,
        performanceScore: null,
      };
    });

    // Suburb concentration
    const suburbCounts = new Map<string, number>();
    for (const p of userProperties) {
      const key = `${p.suburb}, ${p.state}`;
      suburbCounts.set(key, (suburbCounts.get(key) || 0) + 1);
    }
    const suburbConcentration = Array.from(suburbCounts.entries()).map(
      ([key, count]) => {
        const [suburb, state] = key.split(", ");
        return {
          suburb,
          state,
          count,
          percentage: Math.round((count / userProperties.length) * 100),
        };
      }
    );

    // Expense breakdown per property
    const expenseBreakdown = transactions
      .filter(
        (t) =>
          t.transactionType === "expense" &&
          !capitalCategoryValues.has(t.category) &&
          t.propertyId
      )
      .map((t) => ({
        propertyAddress:
          userProperties.find((p) => p.id === t.propertyId)?.address ??
          "Unknown",
        category: t.category,
        annualAmount: Math.abs(Number(t.amount)),
      }));

    const frequencyMultiplier: Record<string, number> = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
      quarterly: 4,
    };

    const annualRepayments = allLoans.reduce((sum, loan) => {
      const multiplier =
        frequencyMultiplier[loan.repaymentFrequency] ?? 12;
      return sum + Number(loan.repaymentAmount) * multiplier;
    }, 0);

    const portfolioData: PortfolioDataForInsights = {
      properties: propertyData,
      loans: allLoans.map((l) => ({
        propertyId: l.propertyId,
        balance: Number(l.currentBalance),
        rate: Number(l.interestRate),
        repaymentAmount: Number(l.repaymentAmount),
        repaymentFrequency: l.repaymentFrequency,
      })),
      portfolioMetrics: {
        totalValue: Math.round(totalValue),
        totalDebt: Math.round(totalDebt),
        totalEquity: Math.round(totalValue - totalDebt),
        portfolioLVR:
          totalValue > 0
            ? Math.round((totalDebt / totalValue) * 1000) / 10
            : 0,
        annualRentalIncome: Math.round(annualRentalIncome),
        annualExpenses: Math.round(annualExpenses),
        netSurplus: Math.round(
          annualRentalIncome - annualExpenses - annualRepayments
        ),
      },
      suburbConcentration,
      expenseBreakdown,
    };

    // Call LLM
    const result = await generatePortfolioInsights(portfolioData);

    // Cache result
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await ctx.uow.insights.upsert({
      userId: ownerId,
      insights: result.insights,
      generatedAt: now,
      expiresAt,
      modelUsed: result.modelUsed,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    return {
      insights: result.insights,
      generatedAt: now,
    };
  }),
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/portfolio/__tests__/insights.test.ts`
Expected: All 4 tests PASS (may need 5 if you count the sub-describes).

**Step 5: Commit**

```bash
git add src/server/routers/portfolio/portfolio.ts src/server/routers/portfolio/__tests__/insights.test.ts
git commit -m "feat: add getInsights and generateInsights tRPC procedures with tests"
```

---

### Task 5: Feature flag

**Files:**
- Modify: `src/config/feature-flags.ts`

**Step 1: Add feature flag**

In `src/config/feature-flags.ts`, add to the `featureFlags` object:

```typescript
aiInsights: true,
```

No route mapping needed — insights appear as a widget and scorecard section, not a standalone route.

**Step 2: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat: add aiInsights feature flag"
```

---

### Task 6: Dashboard widget — AI Insights card

**Files:**
- Create: `src/components/dashboard/AIInsightsCard.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Create the widget component**

Create `src/components/dashboard/AIInsightsCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  positive: "bg-green-500",
};

function timeAgo(date: Date | string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AIInsightsCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolio.getInsights.useQuery(undefined, {
    staleTime: 60_000,
  });

  const generateMutation = trpc.portfolio.generateInsights.useMutation({
    onSuccess: () => {
      utils.portfolio.getInsights.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const isGenerating = generateMutation.isPending;

  // Top 3 insights by severity priority
  const severityOrder = ["critical", "warning", "info", "positive"];
  const topInsights = data?.insights
    ? [...data.insights]
        .sort(
          (a, b) =>
            severityOrder.indexOf(a.severity) -
            severityOrder.indexOf(b.severity)
        )
        .slice(0, 3)
    : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </CardTitle>
          {data?.insights && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics/scorecard">
                View All
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data?.stale || !data?.insights ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Generate AI-powered insights for your portfolio
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {topInsights.map((insight, i) => (
              <div key={i} className="flex gap-2.5 text-sm">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    SEVERITY_DOT[insight.severity]
                  )}
                />
                <div className="min-w-0">
                  <p className="font-medium">{insight.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {insight.body}
                  </p>
                </div>
              </div>
            ))}
            {data.generatedAt && (
              <p className="text-[10px] text-muted-foreground pt-1">
                Last updated {timeAgo(data.generatedAt)}
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3 leading-tight">
          AI-generated insights — verify with your financial advisor.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to dashboard layout**

In `src/components/dashboard/DashboardClient.tsx`:

1. Add import:
```typescript
import { AIInsightsCard } from "./AIInsightsCard";
```

2. Add `<AIInsightsCard />` in the bottom grid alongside `RecentActivityCard`, `SavingsWidget`, and `UpcomingRemindersCard`. Update that grid to accommodate 4 items (or place it in a new row). The simplest approach is to add it before `TopPerformerMatchesWidget`:

```tsx
      <AIInsightsCard />

      <TopPerformerMatchesWidget />
```

**Step 3: Commit**

```bash
git add src/components/dashboard/AIInsightsCard.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add AI Insights dashboard widget"
```

---

### Task 7: Scorecard page — insights section

**Files:**
- Create: `src/components/analytics/ScorecardInsights.tsx`
- Modify: `src/app/(dashboard)/analytics/scorecard/page.tsx`

**Step 1: Create the insights section component**

Create `src/components/analytics/ScorecardInsights.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import type { PortfolioInsight } from "@/server/db/schema";

const SEVERITY_STYLES: Record<string, { badge: string; label: string }> = {
  critical: { badge: "bg-destructive text-destructive-foreground", label: "Critical" },
  warning: { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", label: "Warning" },
  info: { badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Info" },
  positive: { badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Positive" },
};

interface ScorecardInsightsProps {
  properties: Array<{ id: string; address: string }>;
}

export function ScorecardInsights({ properties }: ScorecardInsightsProps) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolio.getInsights.useQuery(undefined, {
    staleTime: 60_000,
  });

  const generateMutation = trpc.portfolio.generateInsights.useMutation({
    onSuccess: () => {
      utils.portfolio.getInsights.invalidate();
      toast.success("Insights refreshed");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(
    new Set()
  );

  const toggleProperty = (propertyId: string) => {
    setExpandedProperties((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const isGenerating = generateMutation.isPending;
  const insights = data?.insights ?? [];

  // Group by property
  const portfolioInsights = insights.filter((i) => !i.propertyId);
  const propertyInsightsMap = new Map<string, PortfolioInsight[]>();
  for (const insight of insights) {
    if (insight.propertyId) {
      const existing = propertyInsightsMap.get(insight.propertyId) ?? [];
      existing.push(insight);
      propertyInsightsMap.set(insight.propertyId, existing);
    }
  }

  // Sort insights within groups by severity
  const severityOrder = ["critical", "warning", "info", "positive"];
  const sortBySeverity = (a: PortfolioInsight, b: PortfolioInsight) =>
    severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);

  const canRefresh =
    !data?.generatedAt ||
    new Date(data.generatedAt).getTime() < Date.now() - 60 * 60 * 1000;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Insights
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={isGenerating || !canRefresh}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {data?.stale ? "Generate" : "Refresh"}
              </>
            )}
          </Button>
        </div>
        {data?.generatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated{" "}
            {new Date(data.generatedAt).toLocaleString("en-AU", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            {!canRefresh && " — refresh available in 1 hour"}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : data?.stale || insights.length === 0 ? (
          <div className="py-8 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {data?.stale
                ? "Click Generate to analyze your portfolio with AI"
                : "No insights generated yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Portfolio-level insights */}
            {portfolioInsights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Portfolio
                </h4>
                {portfolioInsights.sort(sortBySeverity).map((insight, i) => (
                  <InsightRow key={`portfolio-${i}`} insight={insight} />
                ))}
              </div>
            )}

            {/* Per-property insights */}
            {properties
              .filter((p) => propertyInsightsMap.has(p.id))
              .map((property) => {
                const propInsights = propertyInsightsMap.get(property.id) ?? [];
                const isExpanded = expandedProperties.has(property.id);

                return (
                  <div key={property.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleProperty(property.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer w-full"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {property.address}
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        {propInsights.length}
                      </Badge>
                    </button>
                    {isExpanded &&
                      propInsights
                        .sort(sortBySeverity)
                        .map((insight, i) => (
                          <InsightRow
                            key={`${property.id}-${i}`}
                            insight={insight}
                          />
                        ))}
                  </div>
                );
              })}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-4 leading-tight">
          AI-generated insights — verify with your financial advisor.
        </p>
      </CardContent>
    </Card>
  );
}

function InsightRow({ insight }: { insight: PortfolioInsight }) {
  const style = SEVERITY_STYLES[insight.severity];
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Badge className={cn("text-[10px] flex-shrink-0 mt-0.5", style.badge)}>
        {style.label}
      </Badge>
      <div className="min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="text-xs text-muted-foreground">{insight.body}</p>
      </div>
    </div>
  );
}
```

**Step 2: Add to scorecard page**

In `src/app/(dashboard)/analytics/scorecard/page.tsx`:

1. Add import:
```typescript
import { ScorecardInsights } from "@/components/analytics/ScorecardInsights";
```

2. Add the insights section after the comparison section and before the property cards grid. Find the section where `ScorecardComparison` ends and add:

```tsx
        {/* AI Insights */}
        <ScorecardInsights
          properties={data.properties.map((p) => ({
            id: p.propertyId,
            address: p.address,
          }))}
        />
```

**Step 3: Commit**

```bash
git add src/components/analytics/ScorecardInsights.tsx src/app/(dashboard)/analytics/scorecard/page.tsx
git commit -m "feat: add AI Insights section to scorecard page"
```

---

### Task 8: Final verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Fix any type errors.

**Step 2: Run insight tests**

Run: `npx vitest run src/server/routers/portfolio/__tests__/insights.test.ts`
Expected: All tests pass.

**Step 3: Run lint**

Run: `npx next lint`
Fix any lint errors.

**Step 4: Commit (if fixes needed)**

```bash
git add -A
git commit -m "fix: resolve type and lint errors in AI insights feature"
```

---
