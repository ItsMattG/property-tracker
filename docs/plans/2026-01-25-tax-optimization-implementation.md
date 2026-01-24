# Tax Optimization Suggestions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement tax optimization suggestions with depreciation tracking, timing alerts, and missed deduction detection.

**Architecture:** New tax optimization service generates suggestions based on user data. Depreciation schedules uploaded as PDFs are extracted via Claude API. Suggestions displayed on tax page with EOFY notifications.

**Tech Stack:** Claude Haiku API, Drizzle ORM, tRPC, Next.js App Router, shadcn/ui, Resend (email)

---

## Task 1: Add Database Schema

**Files:**
- Modify: `/src/server/db/schema.ts`

**Step 1: Add enums after existing enums (around line 198)**

```typescript
export const depreciationCategoryEnum = pgEnum("depreciation_category", [
  "plant_equipment",
  "capital_works",
]);

export const depreciationMethodEnum = pgEnum("depreciation_method", [
  "diminishing_value",
  "prime_cost",
]);

export const suggestionTypeEnum = pgEnum("suggestion_type", [
  "prepay_interest",
  "schedule_repairs",
  "claim_depreciation",
  "missed_deduction",
]);

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "active",
  "dismissed",
  "actioned",
]);
```

**Step 2: Add tables before type exports**

```typescript
export const depreciationSchedules = pgTable(
  "depreciation_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    effectiveDate: date("effective_date").notNull(),
    totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_schedules_property_id_idx").on(table.propertyId),
    index("depreciation_schedules_user_id_idx").on(table.userId),
  ]
);

export const depreciationAssets = pgTable(
  "depreciation_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id")
      .references(() => depreciationSchedules.id, { onDelete: "cascade" })
      .notNull(),
    assetName: text("asset_name").notNull(),
    category: depreciationCategoryEnum("category").notNull(),
    originalCost: decimal("original_cost", { precision: 12, scale: 2 }).notNull(),
    effectiveLife: decimal("effective_life", { precision: 5, scale: 2 }).notNull(),
    method: depreciationMethodEnum("method").notNull(),
    yearlyDeduction: decimal("yearly_deduction", { precision: 12, scale: 2 }).notNull(),
    remainingValue: decimal("remaining_value", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_assets_schedule_id_idx").on(table.scheduleId),
  ]
);

export const taxSuggestions = pgTable(
  "tax_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    type: suggestionTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    estimatedSavings: decimal("estimated_savings", { precision: 12, scale: 2 }),
    actionUrl: text("action_url"),
    financialYear: decimal("financial_year", { precision: 4, scale: 0 }).notNull(),
    status: suggestionStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_suggestions_user_id_idx").on(table.userId),
    index("tax_suggestions_status_idx").on(table.status),
    index("tax_suggestions_financial_year_idx").on(table.financialYear),
  ]
);
```

**Step 3: Add relations**

```typescript
export const depreciationSchedulesRelations = relations(
  depreciationSchedules,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [depreciationSchedules.propertyId],
      references: [properties.id],
    }),
    user: one(users, {
      fields: [depreciationSchedules.userId],
      references: [users.id],
    }),
    document: one(documents, {
      fields: [depreciationSchedules.documentId],
      references: [documents.id],
    }),
    assets: many(depreciationAssets),
  })
);

export const depreciationAssetsRelations = relations(
  depreciationAssets,
  ({ one }) => ({
    schedule: one(depreciationSchedules, {
      fields: [depreciationAssets.scheduleId],
      references: [depreciationSchedules.id],
    }),
  })
);

export const taxSuggestionsRelations = relations(taxSuggestions, ({ one }) => ({
  user: one(users, {
    fields: [taxSuggestions.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [taxSuggestions.propertyId],
    references: [properties.id],
  }),
}));
```

**Step 4: Add type exports**

```typescript
export type DepreciationSchedule = typeof depreciationSchedules.$inferSelect;
export type NewDepreciationSchedule = typeof depreciationSchedules.$inferInsert;
export type DepreciationAsset = typeof depreciationAssets.$inferSelect;
export type NewDepreciationAsset = typeof depreciationAssets.$inferInsert;
export type TaxSuggestion = typeof taxSuggestions.$inferSelect;
export type NewTaxSuggestion = typeof taxSuggestions.$inferInsert;
```

**Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(tax): add database schema for tax optimization

- Add depreciationSchedules and depreciationAssets tables
- Add taxSuggestions table for optimization recommendations
- Add enums for depreciation category, method, suggestion type/status"
```

---

## Task 2: Create Depreciation Extraction Service

**Files:**
- Create: `/src/server/services/depreciation-extract.ts`

**Step 1: Create the service**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ExtractedAsset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
}

export interface ExtractionResult {
  success: boolean;
  assets: ExtractedAsset[];
  totalValue: number;
  effectiveDate: string | null;
  error?: string;
}

const EXTRACTION_PROMPT = `You are extracting depreciation schedule data from an Australian quantity surveyor report.

Extract each depreciable asset and return as a JSON object with this structure:
{
  "effectiveDate": "YYYY-MM-DD or null if not found",
  "assets": [
    {
      "assetName": "description of the item",
      "category": "plant_equipment" or "capital_works",
      "originalCost": number (dollar amount, no currency symbol),
      "effectiveLife": number (years),
      "method": "diminishing_value" or "prime_cost",
      "yearlyDeduction": number (first year deduction amount)
    }
  ]
}

Rules:
- Plant & Equipment items have effective life typically 2-20 years
- Capital Works (building structure) typically 40 years at 2.5% p.a.
- If method is not specified, assume "diminishing_value" for plant & equipment
- If yearly deduction is not shown, calculate: originalCost / effectiveLife for prime_cost, or (originalCost * 2) / effectiveLife for diminishing_value
- Extract ALL assets listed in the schedule
- Return ONLY valid JSON, no other text`;

/**
 * Download PDF from Supabase storage and get as base64
 */
async function getPdfContent(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download PDF: ${error?.message}`);
  }

  const buffer = await data.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Extract depreciation schedule data from a PDF using Claude
 */
export async function extractDepreciationSchedule(
  storagePath: string
): Promise<ExtractionResult> {
  try {
    const pdfBase64 = await getPdfContent(storagePath);

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return { success: false, assets: [], totalValue: 0, effectiveDate: null, error: "Unexpected response type" };
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, assets: [], totalValue: 0, effectiveDate: null, error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const assets: ExtractedAsset[] = parsed.assets || [];

    // Validate and clean assets
    const validAssets = assets.filter(
      (a) =>
        a.assetName &&
        a.originalCost > 0 &&
        a.effectiveLife > 0 &&
        ["plant_equipment", "capital_works"].includes(a.category) &&
        ["diminishing_value", "prime_cost"].includes(a.method)
    );

    const totalValue = validAssets.reduce((sum, a) => sum + a.originalCost, 0);

    return {
      success: true,
      assets: validAssets,
      totalValue,
      effectiveDate: parsed.effectiveDate || null,
    };
  } catch (error) {
    console.error("Depreciation extraction error:", error);
    return {
      success: false,
      assets: [],
      totalValue: 0,
      effectiveDate: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate remaining value after N years of depreciation
 */
export function calculateRemainingValue(
  originalCost: number,
  effectiveLife: number,
  method: "diminishing_value" | "prime_cost",
  yearsElapsed: number
): number {
  if (method === "prime_cost") {
    const annualDeduction = originalCost / effectiveLife;
    return Math.max(0, originalCost - annualDeduction * yearsElapsed);
  } else {
    // Diminishing value: rate = 2 / effective life
    const rate = 2 / effectiveLife;
    let value = originalCost;
    for (let i = 0; i < yearsElapsed; i++) {
      value = value * (1 - rate);
    }
    return Math.max(0, value);
  }
}
```

**Step 2: Commit**

```bash
git add src/server/services/depreciation-extract.ts
git commit -m "feat(tax): add depreciation PDF extraction service

- Extract depreciation schedule from QS report PDFs via Claude
- Parse assets with category, cost, effective life, method
- Calculate remaining value for depreciation tracking"
```

---

## Task 3: Create Tax Optimization Service

**Files:**
- Create: `/src/server/services/tax-optimization.ts`

**Step 1: Create the service**

```typescript
import { db } from "@/server/db";
import {
  taxSuggestions,
  transactions,
  properties,
  loans,
  depreciationSchedules,
} from "@/server/db/schema";
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import { getFinancialYearRange } from "./reports";

const MARGINAL_TAX_RATE = 0.37; // Assume 37% marginal rate
const COMMON_DEDUCTIBLE_CATEGORIES = [
  "insurance",
  "council_rates",
  "water_charges",
  "property_agent_fees",
  "land_tax",
  "repairs_and_maintenance",
];

interface SuggestionInput {
  userId: string;
  propertyId?: string;
  financialYear: number;
}

/**
 * Get current financial year (July-June)
 */
export function getCurrentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * Check if we're in EOFY season (May-June)
 */
export function isEofySeason(): boolean {
  const month = new Date().getMonth();
  return month === 4 || month === 5; // May or June
}

/**
 * Days until end of financial year
 */
export function daysUntilEofy(): number {
  const now = new Date();
  const fy = getCurrentFinancialYear();
  const eofy = new Date(fy, 5, 30); // June 30
  const diff = eofy.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Generate prepay interest suggestion
 */
export async function generatePrepayInterestSuggestion(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;
  const daysLeft = daysUntilEofy();

  if (daysLeft > 60 || daysLeft === 0) return; // Only suggest within 60 days of EOFY

  // Get user's loans
  const userLoans = await db.query.loans.findMany({
    where: eq(loans.userId, userId),
  });

  if (userLoans.length === 0) return;

  // Calculate total monthly interest
  const totalMonthlyInterest = userLoans.reduce((sum, loan) => {
    const balance = parseFloat(loan.currentBalance);
    const rate = parseFloat(loan.interestRate) / 100;
    return sum + (balance * rate) / 12;
  }, 0);

  if (totalMonthlyInterest < 100) return; // Not worth suggesting for small amounts

  const estimatedSavings = totalMonthlyInterest * MARGINAL_TAX_RATE;

  // Check if suggestion already exists
  const existing = await db.query.taxSuggestions.findFirst({
    where: and(
      eq(taxSuggestions.userId, userId),
      eq(taxSuggestions.type, "prepay_interest"),
      eq(taxSuggestions.financialYear, financialYear.toString()),
      eq(taxSuggestions.status, "active")
    ),
  });

  if (existing) return;

  await db.insert(taxSuggestions).values({
    userId,
    type: "prepay_interest",
    title: "Prepay loan interest before EOFY",
    description: `Prepaying ${formatCurrency(totalMonthlyInterest)} of interest before June 30 could save you ${formatCurrency(estimatedSavings)} in tax this financial year.`,
    estimatedSavings: estimatedSavings.toFixed(2),
    actionUrl: "/loans",
    financialYear: financialYear.toString(),
    expiresAt: new Date(financialYear, 5, 30), // June 30
  });
}

/**
 * Generate schedule repairs suggestion
 */
export async function generateScheduleRepairsSuggestion(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;
  const daysLeft = daysUntilEofy();

  if (daysLeft > 60 || daysLeft === 0) return;

  const { startDate, endDate } = getFinancialYearRange(financialYear);

  // Check if user has had repairs this FY
  const repairs = await db
    .select({ total: sql<number>`SUM(ABS(${transactions.amount}::numeric))` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.category, "repairs_and_maintenance"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  const repairsThisFy = repairs[0]?.total || 0;

  // Get historical average
  const prevYear = getFinancialYearRange(financialYear - 1);
  const prevRepairs = await db
    .select({ total: sql<number>`SUM(ABS(${transactions.amount}::numeric))` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.category, "repairs_and_maintenance"),
        gte(transactions.date, prevYear.startDate),
        lte(transactions.date, prevYear.endDate)
      )
    );

  const prevYearRepairs = prevRepairs[0]?.total || 0;

  // Suggest if significantly less than previous year
  if (repairsThisFy < prevYearRepairs * 0.5 && prevYearRepairs > 500) {
    const potentialDeduction = prevYearRepairs - repairsThisFy;
    const estimatedSavings = potentialDeduction * MARGINAL_TAX_RATE;

    const existing = await db.query.taxSuggestions.findFirst({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.type, "schedule_repairs"),
        eq(taxSuggestions.financialYear, financialYear.toString()),
        eq(taxSuggestions.status, "active")
      ),
    });

    if (existing) return;

    await db.insert(taxSuggestions).values({
      userId,
      type: "schedule_repairs",
      title: "Schedule repairs before EOFY",
      description: `You've claimed ${formatCurrency(repairsThisFy)} in repairs this FY vs ${formatCurrency(prevYearRepairs)} last year. Scheduling ${formatCurrency(potentialDeduction)} in repairs before June 30 could save ${formatCurrency(estimatedSavings)}.`,
      estimatedSavings: estimatedSavings.toFixed(2),
      actionUrl: "/transactions",
      financialYear: financialYear.toString(),
      expiresAt: new Date(financialYear, 5, 30),
    });
  }
}

/**
 * Generate claim depreciation suggestion
 */
export async function generateClaimDepreciationSuggestion(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;

  // Get properties without depreciation schedules
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
  });

  for (const property of userProperties) {
    const schedule = await db.query.depreciationSchedules.findFirst({
      where: eq(depreciationSchedules.propertyId, property.id),
    });

    if (schedule) continue; // Already has a schedule

    // Check if suggestion already exists
    const existing = await db.query.taxSuggestions.findFirst({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.propertyId, property.id),
        eq(taxSuggestions.type, "claim_depreciation"),
        eq(taxSuggestions.status, "active")
      ),
    });

    if (existing) continue;

    // Estimate typical first-year depreciation (rough estimate based on property value)
    const propertyValue = parseFloat(property.purchasePrice);
    const estimatedDepreciation = Math.min(15000, propertyValue * 0.02); // ~2% or max $15k
    const estimatedSavings = estimatedDepreciation * MARGINAL_TAX_RATE;

    await db.insert(taxSuggestions).values({
      userId,
      propertyId: property.id,
      type: "claim_depreciation",
      title: `Upload depreciation schedule for ${property.address}`,
      description: `A quantity surveyor report could identify ${formatCurrency(estimatedDepreciation)}+ in annual deductions, saving you ${formatCurrency(estimatedSavings)}+ per year.`,
      estimatedSavings: estimatedSavings.toFixed(2),
      actionUrl: `/reports/tax?property=${property.id}`,
      financialYear: financialYear.toString(),
    });
  }
}

/**
 * Generate missed deduction suggestions
 */
export async function generateMissedDeductionSuggestions(
  input: SuggestionInput
): Promise<void> {
  const { userId, financialYear } = input;
  const { startDate, endDate } = getFinancialYearRange(financialYear);

  // Get user's properties owned for at least 6 months
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const eligibleProperties = userProperties.filter(
    (p) => new Date(p.purchaseDate) < sixMonthsAgo
  );

  if (eligibleProperties.length === 0) return;

  // Get categories with transactions this FY
  const claimedCategories = await db
    .selectDistinct({ category: transactions.category })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        sql`${transactions.category} != 'uncategorized'`
      )
    );

  const claimed = new Set(claimedCategories.map((c) => c.category));

  // Find commonly missed categories
  for (const category of COMMON_DEDUCTIBLE_CATEGORIES) {
    if (claimed.has(category)) continue;

    const existing = await db.query.taxSuggestions.findFirst({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.type, "missed_deduction"),
        eq(taxSuggestions.financialYear, financialYear.toString()),
        eq(taxSuggestions.status, "active"),
        sql`${taxSuggestions.description} LIKE ${`%${category}%`}`
      ),
    });

    if (existing) continue;

    const categoryLabel = getCategoryLabel(category);

    await db.insert(taxSuggestions).values({
      userId,
      type: "missed_deduction",
      title: `Check for ${categoryLabel} expenses`,
      description: `You haven't claimed any ${categoryLabel.toLowerCase()} this financial year. Most property investors have these expenses - make sure you're not missing deductions.`,
      actionUrl: `/transactions?category=${category}`,
      financialYear: financialYear.toString(),
    });
  }
}

/**
 * Generate all suggestions for a user
 */
export async function generateAllSuggestions(userId: string): Promise<number> {
  const financialYear = getCurrentFinancialYear();
  const input = { userId, financialYear };

  await generatePrepayInterestSuggestion(input);
  await generateScheduleRepairsSuggestion(input);
  await generateClaimDepreciationSuggestion(input);
  await generateMissedDeductionSuggestions(input);

  // Return count of active suggestions
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taxSuggestions)
    .where(
      and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.status, "active")
      )
    );

  return count;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    insurance: "Insurance",
    council_rates: "Council Rates",
    water_charges: "Water Charges",
    property_agent_fees: "Property Agent Fees",
    land_tax: "Land Tax",
    repairs_and_maintenance: "Repairs & Maintenance",
  };
  return labels[category] || category;
}
```

**Step 2: Commit**

```bash
git add src/server/services/tax-optimization.ts
git commit -m "feat(tax): add tax optimization suggestion service

- Generate prepay interest suggestions before EOFY
- Generate schedule repairs suggestions based on history
- Generate claim depreciation suggestions for properties without schedules
- Generate missed deduction alerts for common categories"
```

---

## Task 4: Create Tax Optimization Router

**Files:**
- Create: `/src/server/routers/taxOptimization.ts`
- Modify: `/src/server/routers/_app.ts`

**Step 1: Create router**

```typescript
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  taxSuggestions,
  depreciationSchedules,
  depreciationAssets,
  documents,
} from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { extractDepreciationSchedule } from "../services/depreciation-extract";
import {
  generateAllSuggestions,
  getCurrentFinancialYear,
} from "../services/tax-optimization";

export const taxOptimizationRouter = router({
  // Get active suggestions for current user
  getSuggestions: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().optional(),
        status: z.enum(["active", "dismissed", "actioned"]).default("active"),
      })
    )
    .query(async ({ ctx, input }) => {
      const fy = input.financialYear || getCurrentFinancialYear();

      const suggestions = await ctx.db.query.taxSuggestions.findMany({
        where: and(
          eq(taxSuggestions.userId, ctx.portfolio.ownerId),
          eq(taxSuggestions.financialYear, fy.toString()),
          eq(taxSuggestions.status, input.status)
        ),
        with: {
          property: true,
        },
        orderBy: [desc(taxSuggestions.estimatedSavings)],
      });

      return suggestions;
    }),

  // Get suggestion count (for badges)
  getSuggestionCount: protectedProcedure.query(async ({ ctx }) => {
    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(taxSuggestions)
      .where(
        and(
          eq(taxSuggestions.userId, ctx.portfolio.ownerId),
          eq(taxSuggestions.status, "active")
        )
      );

    return { count };
  }),

  // Dismiss a suggestion
  dismissSuggestion: writeProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(taxSuggestions)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(taxSuggestions.id, input.suggestionId),
            eq(taxSuggestions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  // Mark suggestion as actioned
  markActioned: writeProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(taxSuggestions)
        .set({ status: "actioned" })
        .where(
          and(
            eq(taxSuggestions.id, input.suggestionId),
            eq(taxSuggestions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  // Refresh suggestions
  refreshSuggestions: writeProcedure.mutation(async ({ ctx }) => {
    const count = await generateAllSuggestions(ctx.portfolio.ownerId);
    return { count };
  }),

  // Get depreciation schedules for a property
  getDepreciationSchedules: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(depreciationSchedules.userId, ctx.portfolio.ownerId)];

      if (input.propertyId) {
        conditions.push(eq(depreciationSchedules.propertyId, input.propertyId));
      }

      const schedules = await ctx.db.query.depreciationSchedules.findMany({
        where: and(...conditions),
        with: {
          property: true,
          assets: true,
          document: true,
        },
        orderBy: [desc(depreciationSchedules.createdAt)],
      });

      return schedules;
    }),

  // Extract depreciation from uploaded document
  extractDepreciation: writeProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        propertyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify document ownership
      const doc = await ctx.db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.documentId),
          eq(documents.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      // Extract from PDF
      const result = await extractDepreciationSchedule(doc.storagePath);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to extract depreciation schedule",
        });
      }

      return {
        assets: result.assets,
        totalValue: result.totalValue,
        effectiveDate: result.effectiveDate,
      };
    }),

  // Save extracted depreciation schedule
  saveDepreciationSchedule: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        documentId: z.string().uuid(),
        effectiveDate: z.string(),
        totalValue: z.number(),
        assets: z.array(
          z.object({
            assetName: z.string(),
            category: z.enum(["plant_equipment", "capital_works"]),
            originalCost: z.number(),
            effectiveLife: z.number(),
            method: z.enum(["diminishing_value", "prime_cost"]),
            yearlyDeduction: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create schedule
      const [schedule] = await ctx.db
        .insert(depreciationSchedules)
        .values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          documentId: input.documentId,
          effectiveDate: input.effectiveDate,
          totalValue: input.totalValue.toFixed(2),
        })
        .returning();

      // Insert assets
      if (input.assets.length > 0) {
        await ctx.db.insert(depreciationAssets).values(
          input.assets.map((asset) => ({
            scheduleId: schedule.id,
            assetName: asset.assetName,
            category: asset.category,
            originalCost: asset.originalCost.toFixed(2),
            effectiveLife: asset.effectiveLife.toFixed(2),
            method: asset.method,
            yearlyDeduction: asset.yearlyDeduction.toFixed(2),
            remainingValue: asset.originalCost.toFixed(2), // Start with full value
          }))
        );
      }

      // Mark any "claim_depreciation" suggestions for this property as actioned
      await ctx.db
        .update(taxSuggestions)
        .set({ status: "actioned" })
        .where(
          and(
            eq(taxSuggestions.userId, ctx.portfolio.ownerId),
            eq(taxSuggestions.propertyId, input.propertyId),
            eq(taxSuggestions.type, "claim_depreciation"),
            eq(taxSuggestions.status, "active")
          )
        );

      return schedule;
    }),

  // Delete depreciation schedule
  deleteDepreciationSchedule: writeProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(depreciationSchedules)
        .where(
          and(
            eq(depreciationSchedules.id, input.scheduleId),
            eq(depreciationSchedules.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),
});
```

**Step 2: Register router in _app.ts**

Add import and register:

```typescript
import { taxOptimizationRouter } from "./taxOptimization";

// In appRouter:
taxOptimization: taxOptimizationRouter,
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/taxOptimization.ts src/server/routers/_app.ts
git commit -m "feat(tax): add tax optimization router

- CRUD for tax suggestions with dismiss/action
- Depreciation schedule extraction and storage
- Refresh suggestions endpoint"
```

---

## Task 5: Create Tax Suggestion Components

**Files:**
- Create: `/src/components/tax/SuggestionCard.tsx`
- Create: `/src/components/tax/SuggestionList.tsx`

**Step 1: Create SuggestionCard**

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Wrench,
  FileText,
  AlertTriangle,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SuggestionCardProps {
  suggestion: {
    id: string;
    type: string;
    title: string;
    description: string;
    estimatedSavings: string | null;
    actionUrl: string | null;
    property?: { address: string } | null;
  };
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  isLoading?: boolean;
}

const typeIcons: Record<string, typeof DollarSign> = {
  prepay_interest: DollarSign,
  schedule_repairs: Wrench,
  claim_depreciation: FileText,
  missed_deduction: AlertTriangle,
};

const typeColors: Record<string, string> = {
  prepay_interest: "text-green-600 bg-green-50",
  schedule_repairs: "text-blue-600 bg-blue-50",
  claim_depreciation: "text-purple-600 bg-purple-50",
  missed_deduction: "text-amber-600 bg-amber-50",
};

export function SuggestionCard({
  suggestion,
  onDismiss,
  onAction,
  isLoading,
}: SuggestionCardProps) {
  const Icon = typeIcons[suggestion.type] || AlertTriangle;
  const colorClass = typeColors[suggestion.type] || "text-gray-600 bg-gray-50";
  const savings = suggestion.estimatedSavings
    ? parseFloat(suggestion.estimatedSavings)
    : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className={cn("p-2 rounded-lg h-fit", colorClass)}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium">{suggestion.title}</h4>
                {suggestion.property && (
                  <p className="text-xs text-muted-foreground">
                    {suggestion.property.address}
                  </p>
                )}
              </div>
              {savings && savings > 0 && (
                <Badge variant="secondary" className="whitespace-nowrap">
                  Save ~${savings.toLocaleString()}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {suggestion.description}
            </p>

            <div className="flex items-center gap-2 mt-3">
              {suggestion.actionUrl && (
                <Button size="sm" asChild>
                  <Link href={suggestion.actionUrl}>
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Take Action
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(suggestion.id)}
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-1" />
                Done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(suggestion.id)}
                disabled={isLoading}
              >
                <X className="w-4 h-4 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create SuggestionList**

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { SuggestionCard } from "./SuggestionCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function SuggestionList() {
  const utils = trpc.useUtils();

  const { data: suggestions, isLoading } =
    trpc.taxOptimization.getSuggestions.useQuery({});

  const dismissMutation = trpc.taxOptimization.dismissSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion dismissed");
      utils.taxOptimization.getSuggestions.invalidate();
      utils.taxOptimization.getSuggestionCount.invalidate();
    },
  });

  const actionMutation = trpc.taxOptimization.markActioned.useMutation({
    onSuccess: () => {
      toast.success("Marked as done");
      utils.taxOptimization.getSuggestions.invalidate();
      utils.taxOptimization.getSuggestionCount.invalidate();
    },
  });

  const refreshMutation = trpc.taxOptimization.refreshSuggestions.useMutation({
    onSuccess: (result) => {
      toast.success(`Found ${result.count} suggestions`);
      utils.taxOptimization.getSuggestions.invalidate();
      utils.taxOptimization.getSuggestionCount.invalidate();
    },
  });

  const isProcessing =
    dismissMutation.isPending || actionMutation.isPending;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading suggestions...</div>;
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No suggestions</h3>
        <p className="text-muted-foreground mb-4">
          You're all caught up on tax optimization opportunities.
        </p>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Check for Suggestions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          {suggestions.length} Optimization{suggestions.length !== 1 ? "s" : ""} Found
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onDismiss={(id) => dismissMutation.mutate({ suggestionId: id })}
          onAction={(id) => actionMutation.mutate({ suggestionId: id })}
          isLoading={isProcessing}
        />
      ))}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/tax/SuggestionCard.tsx src/components/tax/SuggestionList.tsx
git commit -m "feat(tax): add suggestion card and list components

- SuggestionCard with icon, savings badge, action buttons
- SuggestionList with refresh and empty state"
```

---

## Task 6: Create Depreciation Upload Components

**Files:**
- Create: `/src/components/tax/DepreciationUpload.tsx`
- Create: `/src/components/tax/DepreciationTable.tsx`

**Step 1: Create DepreciationUpload**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Upload, Loader2, FileText } from "lucide-react";
import { DepreciationTable } from "./DepreciationTable";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ExtractedAsset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
}

export function DepreciationUpload() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "upload" | "review">("select");
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    assets: ExtractedAsset[];
    totalValue: number;
    effectiveDate: string | null;
    documentId: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: properties } = trpc.property.list.useQuery();

  const extractMutation = trpc.taxOptimization.extractDepreciation.useMutation({
    onSuccess: (data) => {
      setExtractedData({
        ...data,
        documentId: extractedData?.documentId || "",
      });
      setStep("review");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const saveMutation = trpc.taxOptimization.saveDepreciationSchedule.useMutation({
    onSuccess: () => {
      toast.success("Depreciation schedule saved");
      utils.taxOptimization.getDepreciationSchedules.invalidate();
      utils.taxOptimization.getSuggestions.invalidate();
      setOpen(false);
      resetState();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetState = () => {
    setStep("select");
    setSelectedProperty("");
    setExtractedData(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProperty) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase
      const fileName = `${Date.now()}-${file.name}`;
      const path = `depreciation/${selectedProperty}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file);

      if (uploadError) throw uploadError;

      // Create document record
      const docResponse = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storagePath: path,
          category: "depreciation",
        }),
      });

      const doc = await docResponse.json();

      setExtractedData((prev) => ({ ...prev!, documentId: doc.id }));

      // Extract depreciation data
      extractMutation.mutate({
        documentId: doc.id,
        propertyId: selectedProperty,
      });
    } catch (error) {
      toast.error("Failed to upload file");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!extractedData || !selectedProperty) return;

    saveMutation.mutate({
      propertyId: selectedProperty,
      documentId: extractedData.documentId,
      effectiveDate: extractedData.effectiveDate || new Date().toISOString().split("T")[0],
      totalValue: extractedData.totalValue,
      assets: extractedData.assets,
    });
  };

  const handleAssetUpdate = (index: number, field: string, value: string | number) => {
    if (!extractedData) return;

    const updatedAssets = [...extractedData.assets];
    updatedAssets[index] = { ...updatedAssets[index], [field]: value };

    const totalValue = updatedAssets.reduce((sum, a) => sum + a.originalCost, 0);

    setExtractedData({
      ...extractedData,
      assets: updatedAssets,
      totalValue,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Depreciation Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Select Property"}
            {step === "upload" && "Upload Schedule"}
            {step === "review" && "Review Extracted Assets"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setStep("upload")} disabled={!selectedProperty}>
              Continue
            </Button>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              {uploading || extractMutation.isPending ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {uploading ? "Uploading..." : "Extracting assets..."}
                  </p>
                </div>
              ) : (
                <>
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload your quantity surveyor depreciation schedule (PDF)
                  </p>
                  <Input
                    type="file"
                    accept=".pdf"
                    className="mt-4 max-w-xs mx-auto"
                    onChange={handleFileUpload}
                  />
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => setStep("select")}>
              Back
            </Button>
          </div>
        )}

        {step === "review" && extractedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {extractedData.assets.length} assets extracted
              </span>
              <span className="font-medium">
                Total: ${extractedData.totalValue.toLocaleString()}
              </span>
            </div>

            <DepreciationTable
              assets={extractedData.assets}
              onUpdate={handleAssetUpdate}
              editable
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Re-upload
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Save Schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create DepreciationTable**

```typescript
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Asset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
}

interface DepreciationTableProps {
  assets: Asset[];
  onUpdate?: (index: number, field: string, value: string | number) => void;
  editable?: boolean;
}

export function DepreciationTable({
  assets,
  onUpdate,
  editable = false,
}: DepreciationTableProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Life (yrs)</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Annual Deduction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset, index) => (
            <TableRow key={index}>
              <TableCell className="max-w-[200px]">
                {editable ? (
                  <Input
                    value={asset.assetName}
                    onChange={(e) => onUpdate?.(index, "assetName", e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <span className="truncate">{asset.assetName}</span>
                )}
              </TableCell>
              <TableCell>
                {editable ? (
                  <Select
                    value={asset.category}
                    onValueChange={(v) => onUpdate?.(index, "category", v)}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plant_equipment">Plant & Equipment</SelectItem>
                      <SelectItem value="capital_works">Capital Works</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  asset.category === "plant_equipment" ? "Plant & Equipment" : "Capital Works"
                )}
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    value={asset.originalCost}
                    onChange={(e) => onUpdate?.(index, "originalCost", parseFloat(e.target.value) || 0)}
                    className="h-8 w-24 text-right"
                  />
                ) : (
                  formatCurrency(asset.originalCost)
                )}
              </TableCell>
              <TableCell className="text-right">
                {editable ? (
                  <Input
                    type="number"
                    value={asset.effectiveLife}
                    onChange={(e) => onUpdate?.(index, "effectiveLife", parseFloat(e.target.value) || 0)}
                    className="h-8 w-16 text-right"
                  />
                ) : (
                  asset.effectiveLife
                )}
              </TableCell>
              <TableCell>
                {editable ? (
                  <Select
                    value={asset.method}
                    onValueChange={(v) => onUpdate?.(index, "method", v)}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diminishing_value">Diminishing Value</SelectItem>
                      <SelectItem value="prime_cost">Prime Cost</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  asset.method === "diminishing_value" ? "Diminishing Value" : "Prime Cost"
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(asset.yearlyDeduction)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/tax/DepreciationUpload.tsx src/components/tax/DepreciationTable.tsx
git commit -m "feat(tax): add depreciation upload and table components

- DepreciationUpload with property selection, PDF upload, Claude extraction
- DepreciationTable with editable mode for reviewing extracted assets"
```

---

## Task 7: Update Tax Report Page

**Files:**
- Modify: `/src/app/(dashboard)/reports/tax/page.tsx`

**Step 1: Add suggestions section**

Update the page to include the SuggestionList above the report:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { TaxReportView } from "@/components/reports/TaxReportView";
import { SuggestionList } from "@/components/tax/SuggestionList";
import { DepreciationUpload } from "@/components/tax/DepreciationUpload";
import { FileText, Download, Loader2, Lightbulb } from "lucide-react";

export default function TaxReportPage() {
  const currentYear = new Date().getMonth() >= 6
    ? new Date().getFullYear() + 1
    : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");

  const { data: availableYears, isLoading: yearsLoading } =
    trpc.reports.getAvailableYears.useQuery();

  const { data: properties } = trpc.property.list.useQuery();

  const { data: suggestionCount } = trpc.taxOptimization.getSuggestionCount.useQuery();

  const {
    data: taxReport,
    isLoading: reportLoading,
    refetch,
  } = trpc.reports.taxReport.useQuery(
    {
      year: selectedYear,
      propertyId: selectedProperty === "all" ? undefined : selectedProperty,
    },
    { enabled: !!selectedYear }
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Report</h2>
        <p className="text-muted-foreground">
          Generate ATO-compliant rental property tax reports
        </p>
      </div>

      {/* Tax Optimization Suggestions */}
      {suggestionCount && suggestionCount.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Tax Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SuggestionList />
          </CardContent>
        </Card>
      )}

      {/* Depreciation Schedules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Depreciation Schedules</CardTitle>
            <DepreciationUpload />
          </div>
        </CardHeader>
        <CardContent>
          <DepreciationSchedulesList />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Financial Year</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {yearsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : availableYears && availableYears.length > 0 ? (
                    availableYears.map((y) => (
                      <SelectItem key={y.year} value={String(y.year)}>
                        {y.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(currentYear)}>
                      FY {currentYear - 1}-{String(currentYear).slice(-2)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={selectedProperty}
                onValueChange={setSelectedProperty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              <Button variant="outline" disabled={!taxReport}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report View */}
      {reportLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Generating report...</p>
            </div>
          </CardContent>
        </Card>
      ) : taxReport ? (
        <TaxReportView data={taxReport} />
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>Select a financial year to generate your tax report</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DepreciationSchedulesList() {
  const { data: schedules, isLoading } =
    trpc.taxOptimization.getDepreciationSchedules.useQuery({});

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!schedules || schedules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No depreciation schedules uploaded yet. Upload a quantity surveyor report to track depreciation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map((schedule) => (
        <div
          key={schedule.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div>
            <p className="font-medium">{schedule.property?.address}</p>
            <p className="text-sm text-muted-foreground">
              {schedule.assets?.length || 0} assets • $
              {parseFloat(schedule.totalValue).toLocaleString()} total
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Effective {schedule.effectiveDate}
          </p>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/reports/tax/page.tsx
git commit -m "feat(tax): update tax page with suggestions and depreciation

- Add SuggestionList section with optimization recommendations
- Add DepreciationSchedulesList with upload button
- Integrate with taxOptimization router"
```

---

## Task 8: Add EOFY Cron Job

**Files:**
- Create: `/src/app/api/cron/tax-suggestions/route.ts`
- Modify: `/src/server/services/notification.ts`

**Step 1: Add notification type**

Update notification types in `/src/server/services/notification.ts`:

```typescript
export type NotificationType =
  | "rent_received"
  | "sync_failed"
  | "anomaly_critical"
  | "anomaly_warning"
  | "weekly_digest"
  | "eofy_suggestions";
```

**Step 2: Create cron route**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, notificationPreferences } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  generateAllSuggestions,
  isEofySeason,
  getCurrentFinancialYear,
} from "@/server/services/tax-optimization";
import { sendEmailNotification } from "@/server/services/notification";
import { eofySuggestionsTemplate, eofySuggestionsSubject } from "@/lib/email/templates/eofy-suggestions";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only run during EOFY season (May-June)
  if (!isEofySeason()) {
    return NextResponse.json({ message: "Not EOFY season, skipping" });
  }

  try {
    // Get all users with email notifications enabled
    const usersToNotify = await db
      .select({
        userId: users.id,
        email: users.email,
      })
      .from(users)
      .innerJoin(
        notificationPreferences,
        eq(notificationPreferences.userId, users.id)
      )
      .where(eq(notificationPreferences.emailEnabled, true));

    let processed = 0;
    let notified = 0;

    for (const user of usersToNotify) {
      try {
        // Generate suggestions for user
        const count = await generateAllSuggestions(user.userId);
        processed++;

        // Send email if they have suggestions
        if (count > 0) {
          const fy = getCurrentFinancialYear();
          const html = eofySuggestionsTemplate({
            suggestionCount: count,
            financialYear: `FY${fy - 1}-${String(fy).slice(-2)}`,
          });

          await sendEmailNotification(user.email, eofySuggestionsSubject(), html);
          notified++;
        }
      } catch (error) {
        console.error(`Failed to process user ${user.userId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      notified,
    });
  } catch (error) {
    console.error("Tax suggestions cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 3: Create email template**

Create `/src/lib/email/templates/eofy-suggestions.ts`:

```typescript
export function eofySuggestionsSubject(): string {
  return "EOFY Tax Optimization Suggestions";
}

export function eofySuggestionsTemplate(data: {
  suggestionCount: number;
  financialYear: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>EOFY Tax Suggestions</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">EOFY is approaching!</h1>

  <p style="color: #666; font-size: 16px; line-height: 1.5;">
    We've found <strong>${data.suggestionCount}</strong> tax optimization suggestion${data.suggestionCount !== 1 ? "s" : ""}
    for ${data.financialYear} that could help you maximize your deductions.
  </p>

  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p style="margin: 0; color: #666;">
      Review your suggestions before June 30 to ensure you don't miss out on potential tax savings.
    </p>
  </div>

  <a href="${process.env.NEXT_PUBLIC_APP_URL}/reports/tax"
     style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
    View Suggestions
  </a>

  <p style="color: #999; font-size: 14px; margin-top: 30px;">
    PropertyTracker - Smart property investment tracking
  </p>
</body>
</html>
  `.trim();
}
```

**Step 4: Commit**

```bash
git add src/app/api/cron/tax-suggestions/route.ts src/lib/email/templates/eofy-suggestions.ts src/server/services/notification.ts
git commit -m "feat(tax): add EOFY tax suggestions cron job

- Daily cron generates suggestions for all users during May-June
- Send email notification when suggestions found
- Add eofy_suggestions notification type"
```

---

## Task 9: Run Tests and Final Integration

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 4: Create component directories**

```bash
mkdir -p src/components/tax
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(tax): complete tax optimization feature

- Database schema for depreciation and suggestions
- PDF extraction via Claude API
- Suggestion generation for prepay interest, repairs, depreciation, missed deductions
- Tax page with suggestions section and depreciation upload
- EOFY notifications cron job"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database schema | schema.ts |
| 2 | Depreciation extraction service | depreciation-extract.ts |
| 3 | Tax optimization service | tax-optimization.ts |
| 4 | Tax optimization router | taxOptimization.ts, _app.ts |
| 5 | Suggestion components | SuggestionCard.tsx, SuggestionList.tsx |
| 6 | Depreciation components | DepreciationUpload.tsx, DepreciationTable.tsx |
| 7 | Tax page update | tax/page.tsx |
| 8 | EOFY cron job | cron/tax-suggestions/route.ts, notification.ts |
| 9 | Testing & integration | All files |
