# Rent Review Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-property rent review analysis comparing actual rent (from transactions) against user-entered market rent, with state-specific notice period info and a portfolio summary widget.

**Architecture:** New `rent_reviews` table stores market rent per property. A `rentReview` tRPC router calculates actual rent from transactions, computes the gap, and returns status/recommendations. Pluggable `RentDataProvider` interface for future API integration. UI: `RentReviewCard` on property detail + `RentReviewSummary` on dashboard.

**Tech Stack:** Drizzle ORM (decimal columns), tRPC v11, React 19, Tailwind v4, Vitest

**Design doc:** `docs/plans/2026-02-19-rent-review-assistant-design.md`

**Beads task:** property-tracker-71b

---

## Tech Notes

**Drizzle decimal columns:** `decimal("field", { precision: 12, scale: 2 })` — returns string from DB, must `Number()` cast in application code.

**Rental income queries:** Filter transactions with `eq(transactions.category, "rental_income")` and `gte(transactions.date, cutoffDate)`. Date format is ISO string `"YYYY-MM-DD"`. Amount is stored as string, cast with `Number()`.

**Existing rent calculation:** `src/server/routers/property/rentalYield.ts` already sums rental income for 12 months. Reuse same query pattern but don't depend on the router — query transactions directly via `ctx.db`.

**Repository pattern:** Extend `BaseRepository`, implement interface, register in UoW with lazy getter. Use `this.resolve(tx)` for optional transaction support.

**Router registration:** Add to `src/server/routers/property/index.ts` barrel, then register in `src/server/routers/_app.ts`.

---

### Task 1: Schema — rent_reviews table

**Files:**
- Create: `src/server/db/schema/rent-reviews.ts`
- Modify: `src/server/db/schema/index.ts`

**Step 1: Read existing schema patterns**

Read `src/server/db/schema/portfolio-insights.ts` and `src/server/db/schema/_common.ts` for patterns.

**Step 2: Create the schema file**

Create `src/server/db/schema/rent-reviews.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  date,
  index,
  uniqueIndex,
  relations,
} from "./_common";
import { users } from "./auth";
import { properties } from "./properties";

export const rentReviews = pgTable(
  "rent_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    marketRentWeekly: decimal("market_rent_weekly", {
      precision: 12,
      scale: 2,
    }).notNull(),
    dataSource: text("data_source").notNull().default("manual"),
    lastReviewedAt: timestamp("last_reviewed_at").notNull(),
    nextReviewDate: date("next_review_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rent_reviews_property_id_idx").on(table.propertyId),
    index("rent_reviews_user_id_idx").on(table.userId),
  ]
);

export const rentReviewsRelations = relations(rentReviews, ({ one }) => ({
  user: one(users, {
    fields: [rentReviews.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [rentReviews.propertyId],
    references: [properties.id],
  }),
}));

export type RentReviewRow = typeof rentReviews.$inferSelect;
export type NewRentReviewRow = typeof rentReviews.$inferInsert;
```

**Step 3: Add barrel export**

In `src/server/db/schema/index.ts`, add:

```typescript
export * from "./rent-reviews";
```

**Step 4: Commit**

```bash
git add src/server/db/schema/rent-reviews.ts src/server/db/schema/index.ts
git commit -m "feat: add rent_reviews schema for market rent tracking"
```

---

### Task 2: Static config — state rent increase rules

**Files:**
- Create: `src/lib/rent-increase-rules.ts`

**Step 1: Create the rules file**

Create `src/lib/rent-increase-rules.ts`:

```typescript
export interface RentIncreaseRule {
  noticeDays: number;
  maxFrequency: string;
  fixedTermRule: string;
}

export const RENT_INCREASE_RULES: Record<string, RentIncreaseRule> = {
  NSW: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  VIC: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  QLD: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  SA: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "As per agreement",
  },
  WA: {
    noticeDays: 60,
    maxFrequency: "6 months",
    fixedTermRule: "Only if agreement allows",
  },
  TAS: {
    noticeDays: 60,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
  NT: {
    noticeDays: 30,
    maxFrequency: "6 months",
    fixedTermRule: "Only at end of fixed term",
  },
  ACT: {
    noticeDays: 56,
    maxFrequency: "12 months",
    fixedTermRule: "Only at end of fixed term",
  },
};

export type AustralianState = keyof typeof RENT_INCREASE_RULES;

export function getRentIncreaseRule(
  state: string
): RentIncreaseRule | undefined {
  return RENT_INCREASE_RULES[state];
}
```

**Step 2: Commit**

```bash
git add src/lib/rent-increase-rules.ts
git commit -m "feat: add state-specific rent increase notice period rules"
```

---

### Task 3: Repository — RentReviewRepository with interface

**Files:**
- Create: `src/server/repositories/interfaces/rent-review.repository.interface.ts`
- Modify: `src/server/repositories/interfaces/index.ts`
- Create: `src/server/repositories/rent-review.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts`

**Step 1: Read existing patterns**

Read `src/server/repositories/insights.repository.ts` and its interface for the pattern. Read `src/server/repositories/base.ts` for `BaseRepository` and `DB` type.

**Step 2: Create the interface**

Create `src/server/repositories/interfaces/rent-review.repository.interface.ts`:

```typescript
import type { RentReviewRow, NewRentReviewRow } from "../../db/schema";

export interface IRentReviewRepository {
  findByPropertyId(
    propertyId: string,
    userId: string
  ): Promise<RentReviewRow | null>;
  findAllByUser(userId: string): Promise<RentReviewRow[]>;
  upsert(data: NewRentReviewRow): Promise<RentReviewRow>;
}
```

**Step 3: Add to interfaces barrel**

In `src/server/repositories/interfaces/index.ts`, add:

```typescript
export type { IRentReviewRepository } from "./rent-review.repository.interface";
```

**Step 4: Create the repository**

Create `src/server/repositories/rent-review.repository.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { BaseRepository } from "./base";
import type { IRentReviewRepository } from "./interfaces/rent-review.repository.interface";
import {
  rentReviews,
  type RentReviewRow,
  type NewRentReviewRow,
} from "../db/schema";

export class RentReviewRepository
  extends BaseRepository
  implements IRentReviewRepository
{
  async findByPropertyId(
    propertyId: string,
    userId: string
  ): Promise<RentReviewRow | null> {
    const [row] = await this.db
      .select()
      .from(rentReviews)
      .where(
        and(
          eq(rentReviews.propertyId, propertyId),
          eq(rentReviews.userId, userId)
        )
      )
      .limit(1);

    return row ?? null;
  }

  async findAllByUser(userId: string): Promise<RentReviewRow[]> {
    return this.db
      .select()
      .from(rentReviews)
      .where(eq(rentReviews.userId, userId));
  }

  async upsert(data: NewRentReviewRow): Promise<RentReviewRow> {
    // Delete existing for property, then insert
    await this.db
      .delete(rentReviews)
      .where(
        and(
          eq(rentReviews.propertyId, data.propertyId),
          eq(rentReviews.userId, data.userId)
        )
      );

    const [row] = await this.db
      .insert(rentReviews)
      .values(data)
      .returning();

    return row;
  }
}
```

**Step 5: Register in UnitOfWork**

In `src/server/repositories/unit-of-work.ts`:

1. Add interface import with others:
```typescript
import type { IRentReviewRepository } from "./interfaces/rent-review.repository.interface";
```

2. Add concrete class import with others:
```typescript
import { RentReviewRepository } from "./rent-review.repository";
```

3. Add private field:
```typescript
private _rentReview?: IRentReviewRepository;
```

4. Add lazy getter:
```typescript
get rentReview(): IRentReviewRepository {
  return (this._rentReview ??= new RentReviewRepository(this.db));
}
```

**Step 6: Commit**

```bash
git add src/server/repositories/interfaces/rent-review.repository.interface.ts src/server/repositories/interfaces/index.ts src/server/repositories/rent-review.repository.ts src/server/repositories/unit-of-work.ts
git commit -m "feat: add RentReviewRepository with interface and UoW registration"
```

---

### Task 4: Provider pattern — RentDataProvider interface

**Files:**
- Create: `src/server/services/rent-data/provider.ts`
- Create: `src/server/services/rent-data/manual-provider.ts`

**Step 1: Create the provider interface**

Create `src/server/services/rent-data/provider.ts`:

```typescript
export interface RentDataProvider {
  getMedianRent(
    suburb: string,
    state: string,
    propertyType?: string
  ): Promise<number | null>;
  readonly source: string;
}
```

**Step 2: Create the manual provider**

Create `src/server/services/rent-data/manual-provider.ts`:

```typescript
import type { RentDataProvider } from "./provider";

export class ManualProvider implements RentDataProvider {
  readonly source = "manual";

  async getMedianRent(): Promise<number | null> {
    // Manual provider always returns null — user enters market rent themselves
    return null;
  }
}
```

**Step 3: Commit**

```bash
git add src/server/services/rent-data/provider.ts src/server/services/rent-data/manual-provider.ts
git commit -m "feat: add RentDataProvider interface with ManualProvider"
```

---

### Task 5: Router procedures + tests

**Files:**
- Create: `src/server/routers/property/rentReview.ts`
- Modify: `src/server/routers/property/index.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `src/server/routers/property/__tests__/rentReview.test.ts`

**Step 1: Read existing patterns**

Read `src/server/routers/property/rentalYield.ts` for rental income query pattern. Read `src/server/routers/property/index.ts` for barrel exports. Read `src/server/routers/_app.ts` for router registration.

**Step 2: Write the test file**

Create `src/server/routers/property/__tests__/rentReview.test.ts`:

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

const mockProperty = {
  id: "prop-1",
  userId: "user-1",
  address: "123 Main St",
  suburb: "Richmond",
  state: "VIC",
  postcode: "3121",
  purchasePrice: "500000",
  purchaseDate: "2020-01-01",
  status: "active",
};

const mockRentReview = {
  id: "review-1",
  propertyId: "prop-1",
  userId: "user-1",
  marketRentWeekly: "550.00",
  dataSource: "manual",
  lastReviewedAt: new Date(),
  nextReviewDate: "2027-02-19",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTransactions = [
  {
    propertyId: "prop-1",
    amount: "-500",
    category: "rental_income",
    transactionType: "income",
    date: "2025-06-01",
  },
  {
    propertyId: "prop-1",
    amount: "-500",
    category: "rental_income",
    transactionType: "income",
    date: "2025-07-01",
  },
];

function setupCtx(
  overrides: Record<string, Record<string, unknown>> = {}
) {
  const uow = createMockUow({
    rentReview: {
      findByPropertyId: vi.fn().mockResolvedValue(null),
      findAllByUser: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(mockRentReview),
    },
    ...overrides,
  });

  currentMockUow = uow;

  const ctx = createMockContext({
    userId: mockUser.id,
    user: mockUser,
    uow,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial DB mock
  ctx.db = {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
      properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockTransactions),
      }),
    }),
  } as any;

  return { ctx, caller: createTestCaller(ctx), uow };
}

describe("rentReview.getForProperty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rent review with gap calculation when market rent is set", async () => {
    const { caller } = setupCtx({
      rentReview: {
        findByPropertyId: vi.fn().mockResolvedValue(mockRentReview),
        findAllByUser: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
    });

    const result = await caller.rentReview.getForProperty({
      propertyId: "prop-1",
    });

    expect(result.review).toBeDefined();
    expect(result.review!.marketRentWeekly).toBe("550.00");
    expect(result.actualRentWeekly).toBeDefined();
    expect(result.rentGapPercent).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.noticeRules).toBeDefined();
    expect(result.noticeRules!.noticeDays).toBe(60); // VIC
  });

  it("returns null review when no market rent set", async () => {
    const { caller } = setupCtx({
      rentReview: {
        findByPropertyId: vi.fn().mockResolvedValue(null),
        findAllByUser: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
    });

    const result = await caller.rentReview.getForProperty({
      propertyId: "prop-1",
    });

    expect(result.review).toBeNull();
    expect(result.actualRentWeekly).toBeDefined();
    expect(result.status).toBe("no_review");
  });
});

describe("rentReview.setMarketRent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new rent review row", async () => {
    const upsertMock = vi.fn().mockResolvedValue(mockRentReview);
    const { caller } = setupCtx({
      rentReview: {
        findByPropertyId: vi.fn().mockResolvedValue(null),
        findAllByUser: vi.fn().mockResolvedValue([]),
        upsert: upsertMock,
      },
    });

    const result = await caller.rentReview.setMarketRent({
      propertyId: "prop-1",
      marketRentWeekly: 550,
    });

    expect(upsertMock).toHaveBeenCalledOnce();
    expect(result.review).toBeDefined();
  });

  it("updates existing rent review row", async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      ...mockRentReview,
      marketRentWeekly: "600.00",
    });

    const { caller } = setupCtx({
      rentReview: {
        findByPropertyId: vi.fn().mockResolvedValue(mockRentReview),
        findAllByUser: vi.fn().mockResolvedValue([]),
        upsert: upsertMock,
      },
    });

    const result = await caller.rentReview.setMarketRent({
      propertyId: "prop-1",
      marketRentWeekly: 600,
    });

    expect(upsertMock).toHaveBeenCalledOnce();
    expect(result.review.marketRentWeekly).toBe("600.00");
  });
});

describe("rentReview.getPortfolioSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns properties sorted by gap descending", async () => {
    const { caller } = setupCtx({
      rentReview: {
        findByPropertyId: vi.fn(),
        findAllByUser: vi.fn().mockResolvedValue([
          { ...mockRentReview, propertyId: "prop-1", marketRentWeekly: "600.00" },
          { ...mockRentReview, id: "review-2", propertyId: "prop-2", marketRentWeekly: "700.00" },
        ]),
        upsert: vi.fn(),
      },
      portfolio: {
        findProperties: vi.fn().mockResolvedValue([
          mockProperty,
          { ...mockProperty, id: "prop-2", address: "456 Oak Ave", suburb: "Fitzroy", state: "VIC" },
        ]),
      },
    });

    const result = await caller.rentReview.getPortfolioSummary();

    expect(result.properties).toBeDefined();
    expect(Array.isArray(result.properties)).toBe(true);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/property/__tests__/rentReview.test.ts`
Expected: FAIL — router doesn't exist yet.

**Step 4: Create the router**

Create `src/server/routers/property/rentReview.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { eq, and, gte, sql } from "drizzle-orm";
import { transactions, properties } from "../../db/schema";
import { getRentIncreaseRule } from "@/lib/rent-increase-rules";

type RentStatus =
  | "below_market_critical"
  | "below_market_warning"
  | "at_market"
  | "above_market"
  | "no_review";

function calculateStatus(gapPercent: number): RentStatus {
  if (gapPercent > 20) return "below_market_critical";
  if (gapPercent > 10) return "below_market_warning";
  if (gapPercent < -10) return "above_market";
  return "at_market";
}

export const rentReviewRouter = router({
  getForProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      // Verify property ownership — cross-domain query
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Get rent review
      const review = await ctx.uow.rentReview.findByPropertyId(
        input.propertyId,
        ownerId
      );

      // Calculate actual rent from last 12 months of transactions
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoffDate = oneYearAgo.toISOString().split("T")[0];

      // Cross-domain query for transactions
      const rentTransactions = await ctx.db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.propertyId, input.propertyId),
            eq(transactions.category, "rental_income"),
            gte(transactions.date, cutoffDate)
          )
        );

      const totalRentIncome = rentTransactions.reduce(
        (sum, t) => sum + Math.abs(Number(t.amount)),
        0
      );
      const actualRentWeekly = Math.round((totalRentIncome / 52) * 100) / 100;

      if (!review) {
        return {
          review: null,
          actualRentWeekly,
          rentGapPercent: null,
          annualUplift: null,
          status: "no_review" as RentStatus,
          noticeRules: getRentIncreaseRule(property.state),
        };
      }

      const marketRent = Number(review.marketRentWeekly);
      const rentGapPercent =
        marketRent > 0
          ? Math.round(((marketRent - actualRentWeekly) / marketRent) * 1000) /
            10
          : 0;
      const annualUplift = Math.round((marketRent - actualRentWeekly) * 52);

      return {
        review,
        actualRentWeekly,
        rentGapPercent,
        annualUplift,
        status: calculateStatus(rentGapPercent),
        noticeRules: getRentIncreaseRule(property.state),
      };
    }),

  setMarketRent: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        marketRentWeekly: z.number().positive(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      // Verify property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const now = new Date();
      const nextReview = new Date(now);
      nextReview.setFullYear(nextReview.getFullYear() + 1);

      const review = await ctx.uow.rentReview.upsert({
        propertyId: input.propertyId,
        userId: ownerId,
        marketRentWeekly: input.marketRentWeekly.toString(),
        dataSource: "manual",
        lastReviewedAt: now,
        nextReviewDate: nextReview.toISOString().split("T")[0],
        notes: input.notes ?? null,
      });

      return { review };
    }),

  getPortfolioSummary: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;

    const [userProperties, allReviews] = await Promise.all([
      ctx.uow.portfolio.findProperties(ownerId),
      ctx.uow.rentReview.findAllByUser(ownerId),
    ]);

    // Calculate actual rent for all properties with reviews
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split("T")[0];

    // Cross-domain query for all rental income transactions
    const rentTransactions = await ctx.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ownerId),
          eq(transactions.category, "rental_income"),
          gte(transactions.date, cutoffDate)
        )
      );

    // Group rent by property
    const rentByProperty = new Map<string, number>();
    for (const t of rentTransactions) {
      if (!t.propertyId) continue;
      const current = rentByProperty.get(t.propertyId) ?? 0;
      rentByProperty.set(t.propertyId, current + Math.abs(Number(t.amount)));
    }

    const reviewMap = new Map(allReviews.map((r) => [r.propertyId, r]));

    const propertyResults = userProperties
      .map((p) => {
        const review = reviewMap.get(p.id);
        const totalRent = rentByProperty.get(p.id) ?? 0;
        const actualWeekly = Math.round((totalRent / 52) * 100) / 100;

        if (!review) {
          return {
            propertyId: p.id,
            address: p.address,
            suburb: p.suburb,
            state: p.state,
            actualRentWeekly: actualWeekly,
            marketRentWeekly: null,
            rentGapPercent: null,
            annualUplift: null,
            status: "no_review" as RentStatus,
            hasReview: false,
          };
        }

        const marketRent = Number(review.marketRentWeekly);
        const gapPercent =
          marketRent > 0
            ? Math.round(
                ((marketRent - actualWeekly) / marketRent) * 1000
              ) / 10
            : 0;
        const uplift = Math.round((marketRent - actualWeekly) * 52);

        return {
          propertyId: p.id,
          address: p.address,
          suburb: p.suburb,
          state: p.state,
          actualRentWeekly: actualWeekly,
          marketRentWeekly: marketRent,
          rentGapPercent: gapPercent,
          annualUplift: uplift,
          status: calculateStatus(gapPercent),
          hasReview: true,
        };
      })
      .sort((a, b) => (b.rentGapPercent ?? -999) - (a.rentGapPercent ?? -999));

    return {
      properties: propertyResults,
      totalAnnualUplift: propertyResults.reduce(
        (sum, p) => sum + Math.max(0, p.annualUplift ?? 0),
        0
      ),
      propertiesWithReview: propertyResults.filter((p) => p.hasReview).length,
      totalProperties: propertyResults.length,
    };
  }),
});
```

**Step 5: Add to router barrel and app router**

In `src/server/routers/property/index.ts`, add:
```typescript
export { rentReviewRouter } from "./rentReview";
```

In `src/server/routers/_app.ts`, add the import and register:
```typescript
import { rentReviewRouter } from "./property";
// In the router object:
rentReview: rentReviewRouter,
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/property/__tests__/rentReview.test.ts`
Expected: All 5 tests pass.

**Step 7: Commit**

```bash
git add src/server/routers/property/rentReview.ts src/server/routers/property/index.ts src/server/routers/_app.ts src/server/routers/property/__tests__/rentReview.test.ts
git commit -m "feat: add rentReview router with getForProperty, setMarketRent, and getPortfolioSummary"
```

---

### Task 6: Feature flag

**Files:**
- Modify: `src/config/feature-flags.ts`

**Step 1: Add feature flag**

In `src/config/feature-flags.ts`, add `rentReview: true` to the property detail sections:

```typescript
  // ── Property detail sections ────────────────────────────────────
  valuation: true,
  rentReview: true,
  climateRisk: false,
```

**Step 2: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat: add rentReview feature flag"
```

---

### Task 7: Property detail — RentReviewCard component

**Files:**
- Create: `src/components/property/RentReviewCard.tsx`
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx`

**Step 1: Read existing property detail page**

Read `src/app/(dashboard)/properties/[id]/page.tsx` to understand layout and where to place the card. Read an existing card component like `src/components/property/PerformanceCard.tsx` for the pattern.

**Step 2: Create RentReviewCard**

Create `src/components/property/RentReviewCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

interface RentReviewCardProps {
  propertyId: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  below_market_critical: {
    label: "Below Market",
    color: "bg-destructive text-destructive-foreground",
    icon: AlertTriangle,
  },
  below_market_warning: {
    label: "Below Market",
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: AlertTriangle,
  },
  at_market: {
    label: "At Market",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle,
  },
  above_market: {
    label: "Above Market",
    color:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: TrendingUp,
  },
  no_review: {
    label: "Not Set",
    color: "bg-muted text-muted-foreground",
    icon: Info,
  },
};

export function RentReviewCard({ propertyId }: RentReviewCardProps) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.rentReview.getForProperty.useQuery(
    { propertyId },
    { staleTime: 60_000 }
  );

  const setMarketRentMutation = trpc.rentReview.setMarketRent.useMutation({
    onSuccess: () => {
      utils.rentReview.getForProperty.invalidate({ propertyId });
      toast.success("Market rent updated");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [marketRentInput, setMarketRentInput] = useState("");

  const handleSetMarketRent = () => {
    const value = parseFloat(marketRentInput);
    if (isNaN(value) || value <= 0) {
      toast.error("Enter a valid weekly rent amount");
      return;
    }
    setMarketRentMutation.mutate({
      propertyId,
      marketRentWeekly: value,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Rent Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const statusConfig = STATUS_CONFIG[data.status];
  const StatusIcon = statusConfig.icon;

  // No market rent set — show input form
  if (!data.review) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Rent Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.actualRentWeekly > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Rent</span>
              <span className="font-medium">
                {formatCurrency(data.actualRentWeekly)}/wk
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Set the current market rent to see how your property compares.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Weekly market rent"
              value={marketRentInput}
              onChange={(e) => setMarketRentInput(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSetMarketRent}
              disabled={setMarketRentMutation.isPending}
            >
              {setMarketRentMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const marketRent = Number(data.review.marketRentWeekly);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Rent Review
          </CardTitle>
          <Badge className={cn("text-xs", statusConfig.color)}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-sm font-semibold">
              {formatCurrency(data.actualRentWeekly)}/wk
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Market</p>
            <p className="text-sm font-semibold">
              {formatCurrency(marketRent)}/wk
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gap</p>
            <p
              className={cn(
                "text-sm font-semibold",
                data.rentGapPercent && data.rentGapPercent > 10
                  ? "text-destructive"
                  : data.rentGapPercent && data.rentGapPercent > 0
                    ? "text-amber-600"
                    : "text-green-600"
              )}
            >
              {data.rentGapPercent !== null
                ? `${data.rentGapPercent > 0 ? "+" : ""}${data.rentGapPercent}%`
                : "—"}
            </p>
          </div>
        </div>

        {/* Annual uplift callout */}
        {data.annualUplift !== null && data.annualUplift > 0 && (
          <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/10 text-sm">
            <span className="text-amber-800 dark:text-amber-400">
              Potential {formatCurrency(data.annualUplift)}/yr additional income
            </span>
          </div>
        )}

        {/* Notice period */}
        {data.noticeRules && (
          <div className="p-2.5 rounded-md bg-muted text-xs space-y-1">
            <p className="font-medium">Notice Requirements</p>
            <p className="text-muted-foreground">
              {data.noticeRules.noticeDays} days notice required
            </p>
            <p className="text-muted-foreground">
              Maximum 1 increase per {data.noticeRules.maxFrequency}
            </p>
            <p className="text-muted-foreground">
              Fixed term: {data.noticeRules.fixedTermRule}
            </p>
          </div>
        )}

        {/* Edit market rent */}
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Weekly market rent"
              value={marketRentInput}
              onChange={(e) => setMarketRentInput(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSetMarketRent}
              disabled={setMarketRentMutation.isPending}
            >
              {setMarketRentMutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setMarketRentInput(marketRent.toString());
              setIsEditing(true);
            }}
          >
            Update Market Rent
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground">
          Last reviewed{" "}
          {new Date(data.review.lastReviewedAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Add to property detail page**

Read `src/app/(dashboard)/properties/[id]/page.tsx`, add the import and place `<RentReviewCard>` in the card grid. Gate with feature flag:

```tsx
import { RentReviewCard } from "@/components/property/RentReviewCard";
import { featureFlags } from "@/config/feature-flags";

// In JSX, near other property cards:
{featureFlags.rentReview && <RentReviewCard propertyId={property.id} />}
```

**Step 4: Commit**

```bash
git add src/components/property/RentReviewCard.tsx src/app/\(dashboard\)/properties/\[id\]/page.tsx
git commit -m "feat: add RentReviewCard to property detail page"
```

---

### Task 8: Dashboard widget — RentReviewSummary

**Files:**
- Create: `src/components/dashboard/RentReviewSummary.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Read DashboardClient for placement pattern**

Read `src/components/dashboard/DashboardClient.tsx` to understand widget placement.

**Step 2: Create RentReviewSummary**

Create `src/components/dashboard/RentReviewSummary.tsx`:

```tsx
"use client";

import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

const STATUS_DOT: Record<string, string> = {
  below_market_critical: "bg-destructive",
  below_market_warning: "bg-amber-500",
  at_market: "bg-green-500",
  above_market: "bg-blue-500",
  no_review: "bg-muted-foreground/30",
};

export function RentReviewSummary() {
  const { data, isLoading } = trpc.rentReview.getPortfolioSummary.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Rent Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const reviewedProperties = data.properties.filter((p) => p.hasReview);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Rent Review
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {data.propertiesWithReview}/{data.totalProperties} reviewed
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {reviewedProperties.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Set market rents on your properties to see rent review insights
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewedProperties.slice(0, 4).map((p) => (
              <div key={p.propertyId} className="flex gap-2.5 text-sm">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    STATUS_DOT[p.status]
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between">
                    <p className="font-medium truncate">{p.address}</p>
                    {p.rentGapPercent !== null && (
                      <span
                        className={cn(
                          "text-xs font-medium ml-2 flex-shrink-0",
                          p.rentGapPercent > 10
                            ? "text-destructive"
                            : p.rentGapPercent > 0
                              ? "text-amber-600"
                              : "text-green-600"
                        )}
                      >
                        {p.rentGapPercent > 0 ? "+" : ""}
                        {p.rentGapPercent}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(p.actualRentWeekly)}/wk actual
                    {p.marketRentWeekly !== null &&
                      ` vs ${formatCurrency(p.marketRentWeekly)}/wk market`}
                  </p>
                </div>
              </div>
            ))}

            {data.totalAnnualUplift > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Total potential uplift:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(data.totalAnnualUplift)}/yr
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 3: Add to DashboardClient**

In `src/components/dashboard/DashboardClient.tsx`, add the import and place in the grid:

```typescript
import { RentReviewSummary } from "./RentReviewSummary";

// In the bottom grid:
<RentReviewSummary />
```

**Step 4: Commit**

```bash
git add src/components/dashboard/RentReviewSummary.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add RentReviewSummary dashboard widget"
```

---

### Task 9: Static config test

**Files:**
- Create: `src/lib/__tests__/rent-increase-rules.test.ts`

**Step 1: Write the test**

Create `src/lib/__tests__/rent-increase-rules.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  RENT_INCREASE_RULES,
  getRentIncreaseRule,
} from "../rent-increase-rules";

describe("RENT_INCREASE_RULES", () => {
  const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

  it("defines rules for all 8 states/territories", () => {
    for (const state of states) {
      expect(RENT_INCREASE_RULES[state]).toBeDefined();
      expect(RENT_INCREASE_RULES[state].noticeDays).toBeGreaterThan(0);
      expect(RENT_INCREASE_RULES[state].maxFrequency).toBeTruthy();
      expect(RENT_INCREASE_RULES[state].fixedTermRule).toBeTruthy();
    }
  });

  it("getRentIncreaseRule returns rule for valid state", () => {
    const rule = getRentIncreaseRule("VIC");
    expect(rule).toBeDefined();
    expect(rule!.noticeDays).toBe(60);
  });

  it("getRentIncreaseRule returns undefined for invalid state", () => {
    const rule = getRentIncreaseRule("INVALID");
    expect(rule).toBeUndefined();
  });
});
```

**Step 2: Run test**

Run: `npx vitest run src/lib/__tests__/rent-increase-rules.test.ts`
Expected: All 3 tests pass.

**Step 3: Commit**

```bash
git add src/lib/__tests__/rent-increase-rules.test.ts
git commit -m "test: add rent increase rules static config tests"
```

---

### Task 10: Final verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Fix any type errors in our files.

**Step 2: Run all rent review tests**

Run: `npx vitest run src/server/routers/property/__tests__/rentReview.test.ts src/lib/__tests__/rent-increase-rules.test.ts`
Expected: All tests pass.

**Step 3: Run lint**

Run: `npx next lint`
Fix any lint errors in our files.

**Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve type and lint errors in rent review feature"
```

---
