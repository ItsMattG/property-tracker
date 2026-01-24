# AI-Powered Categorization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement AI-powered transaction categorization using Claude API with merchant memory and a review interface.

**Architecture:** New categorization service calls Claude Haiku to suggest categories for uncategorized transactions during bank sync. Merchant memory (learned mappings) skips API calls for known merchants. Users review suggestions on a dedicated page with batch actions.

**Tech Stack:** Claude Haiku API via Anthropic SDK, Drizzle ORM, tRPC, Next.js App Router, shadcn/ui

---

## Task 1: Add Database Schema

**Files:**
- Modify: `/src/server/db/schema.ts:175-198` (add enums)
- Modify: `/src/server/db/schema.ts:276` (add transaction suggestion fields)
- Modify: `/src/server/db/schema.ts:1005` (add new tables before type exports)

**Step 1: Add suggestion status enum**

Add after `auditActionEnum` (line 197):

```typescript
export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "accepted",
  "rejected",
]);
```

**Step 2: Add suggestion fields to transactions table**

Modify the transactions table (around line 250-285) to add three new fields after `notes`:

```typescript
    notes: text("notes"),
    suggestedCategory: categoryEnum("suggested_category"),
    suggestionConfidence: decimal("suggestion_confidence", { precision: 5, scale: 2 }),
    suggestionStatus: suggestionStatusEnum("suggestion_status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
```

**Step 3: Add merchantCategories table**

Add before type exports (around line 1005):

```typescript
export const merchantCategories = pgTable(
  "merchant_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    merchantName: text("merchant_name").notNull(),
    category: categoryEnum("category").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }).default("80.00").notNull(),
    usageCount: decimal("usage_count", { precision: 8, scale: 0 }).default("1").notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("merchant_categories_user_id_idx").on(table.userId),
    index("merchant_categories_merchant_name_idx").on(table.merchantName),
  ]
);

export const categorizationExamples = pgTable(
  "categorization_examples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    category: categoryEnum("category").notNull(),
    wasCorrection: boolean("was_correction").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("categorization_examples_user_id_idx").on(table.userId),
  ]
);

export const merchantCategoriesRelations = relations(merchantCategories, ({ one }) => ({
  user: one(users, {
    fields: [merchantCategories.userId],
    references: [users.id],
  }),
}));

export const categorizationExamplesRelations = relations(categorizationExamples, ({ one }) => ({
  user: one(users, {
    fields: [categorizationExamples.userId],
    references: [users.id],
  }),
}));
```

**Step 4: Add type exports**

Add at end of file with other type exports:

```typescript
export type MerchantCategory = typeof merchantCategories.$inferSelect;
export type NewMerchantCategory = typeof merchantCategories.$inferInsert;
export type CategorizationExample = typeof categorizationExamples.$inferSelect;
export type NewCategorizationExample = typeof categorizationExamples.$inferInsert;
```

**Step 5: Generate migration**

Run: `npx drizzle-kit generate`
Expected: Migration file created in `drizzle/` folder

**Step 6: Apply migration**

Run: `npx drizzle-kit push`
Expected: Database schema updated successfully

**Step 7: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(categorization): add database schema for AI categorization

- Add suggestionStatusEnum
- Add suggestedCategory, suggestionConfidence, suggestionStatus to transactions
- Add merchantCategories table for learned mappings
- Add categorizationExamples table for few-shot prompts"
```

---

## Task 2: Create Categorization Service

**Files:**
- Create: `/src/server/services/categorization.ts`

**Step 1: Write failing test**

Create `/src/server/services/__tests__/categorization.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeMerchantName,
  buildCategorizationPrompt,
  parseCategorizationResponse,
} from "../categorization";

describe("categorization service", () => {
  describe("normalizeMerchantName", () => {
    it("lowercases and removes extra whitespace", () => {
      expect(normalizeMerchantName("  BUNNINGS   WAREHOUSE  ")).toBe("bunnings warehouse");
    });

    it("removes common suffixes", () => {
      expect(normalizeMerchantName("Woolworths Pty Ltd")).toBe("woolworths");
    });

    it("removes location info in parentheses", () => {
      expect(normalizeMerchantName("Coles (Sydney CBD)")).toBe("coles");
    });
  });

  describe("buildCategorizationPrompt", () => {
    it("includes transaction details", () => {
      const prompt = buildCategorizationPrompt(
        "RENT PAYMENT FROM TENANT",
        1500,
        []
      );
      expect(prompt).toContain("RENT PAYMENT FROM TENANT");
      expect(prompt).toContain("1500");
    });

    it("includes examples when provided", () => {
      const prompt = buildCategorizationPrompt(
        "BUNNINGS",
        150,
        [{ description: "Bunnings Hardware", category: "repairs_and_maintenance" }]
      );
      expect(prompt).toContain("Bunnings Hardware");
      expect(prompt).toContain("repairs_and_maintenance");
    });
  });

  describe("parseCategorizationResponse", () => {
    it("parses valid JSON response", () => {
      const response = '{"category": "rental_income", "confidence": 95}';
      const result = parseCategorizationResponse(response);
      expect(result).toEqual({ category: "rental_income", confidence: 95 });
    });

    it("returns null for invalid category", () => {
      const response = '{"category": "invalid_cat", "confidence": 95}';
      const result = parseCategorizationResponse(response);
      expect(result).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      const response = "not json";
      const result = parseCategorizationResponse(response);
      expect(result).toBeNull();
    });

    it("clamps confidence to 0-100 range", () => {
      const response = '{"category": "rental_income", "confidence": 150}';
      const result = parseCategorizationResponse(response);
      expect(result?.confidence).toBe(100);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/categorization.test.ts`
Expected: FAIL - Cannot find module '../categorization'

**Step 3: Write minimal implementation**

Create `/src/server/services/categorization.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { merchantCategories, categorizationExamples, transactions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { categories } from "@/lib/categories";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VALID_CATEGORIES = categories.map((c) => c.value);
const CONFIDENCE_THRESHOLD = 80;

export interface CategorizationResult {
  category: string;
  confidence: number;
  reasoning?: string;
}

export interface Example {
  description: string;
  category: string;
}

/**
 * Normalize merchant name for consistent lookup
 */
export function normalizeMerchantName(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*(pty|ltd|inc|limited|australia|au)\s*/gi, "")
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim();
}

/**
 * Build the categorization prompt for Claude
 */
export function buildCategorizationPrompt(
  description: string,
  amount: number,
  examples: Example[]
): string {
  const categoryList = categories
    .map((c) => `- ${c.value}: ${c.label}${c.isDeductible ? " (tax deductible)" : ""}`)
    .join("\n");

  let prompt = `You are a categorization assistant for Australian property investors. Categorize this transaction.

Transaction:
- Description: ${description}
- Amount: $${Math.abs(amount).toFixed(2)} ${amount >= 0 ? "(credit/income)" : "(debit/expense)"}

Valid categories:
${categoryList}

`;

  if (examples.length > 0) {
    prompt += `\nExamples from this user's history:\n`;
    for (const ex of examples) {
      prompt += `- "${ex.description}" → ${ex.category}\n`;
    }
  }

  prompt += `
Respond with ONLY valid JSON in this format:
{"category": "category_value", "confidence": 0-100}

Choose the most appropriate category. If uncertain, use "uncategorized" with low confidence.`;

  return prompt;
}

/**
 * Parse Claude's response into a CategorizationResult
 */
export function parseCategorizationResponse(
  response: string
): CategorizationResult | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.category || typeof parsed.confidence !== "number") {
      return null;
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(parsed.category)) {
      return null;
    }

    // Clamp confidence
    const confidence = Math.max(0, Math.min(100, parsed.confidence));

    return {
      category: parsed.category,
      confidence,
      reasoning: parsed.reasoning,
    };
  } catch {
    return null;
  }
}

/**
 * Check merchant memory for a known category mapping
 */
export async function getMerchantCategory(
  userId: string,
  description: string
): Promise<{ category: string; confidence: number } | null> {
  const merchantName = normalizeMerchantName(description);

  const mapping = await db.query.merchantCategories.findFirst({
    where: and(
      eq(merchantCategories.userId, userId),
      eq(merchantCategories.merchantName, merchantName)
    ),
  });

  if (mapping && parseFloat(mapping.confidence) >= CONFIDENCE_THRESHOLD) {
    return {
      category: mapping.category,
      confidence: parseFloat(mapping.confidence),
    };
  }

  return null;
}

/**
 * Get recent categorization examples for few-shot prompting
 */
export async function getRecentExamples(
  userId: string,
  limit = 10
): Promise<Example[]> {
  const examples = await db.query.categorizationExamples.findMany({
    where: eq(categorizationExamples.userId, userId),
    orderBy: [desc(categorizationExamples.createdAt)],
    limit,
  });

  return examples.map((e) => ({
    description: e.description,
    category: e.category,
  }));
}

/**
 * Call Claude API to categorize a transaction
 */
export async function categorizeWithClaude(
  description: string,
  amount: number,
  examples: Example[]
): Promise<CategorizationResult | null> {
  try {
    const prompt = buildCategorizationPrompt(description, amount, examples);

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    return parseCategorizationResponse(content.text);
  } catch (error) {
    console.error("Claude API error:", error);
    return null;
  }
}

/**
 * Categorize a single transaction
 */
export async function categorizeTransaction(
  userId: string,
  transactionId: string,
  description: string,
  amount: number
): Promise<CategorizationResult | null> {
  // Check merchant memory first
  const merchantResult = await getMerchantCategory(userId, description);
  if (merchantResult) {
    // Update transaction with suggestion
    await db
      .update(transactions)
      .set({
        suggestedCategory: merchantResult.category as typeof transactions.suggestedCategory.enumValues[number],
        suggestionConfidence: merchantResult.confidence.toString(),
        suggestionStatus: "pending",
      })
      .where(eq(transactions.id, transactionId));

    return merchantResult;
  }

  // Call Claude API
  const examples = await getRecentExamples(userId);
  const result = await categorizeWithClaude(description, amount, examples);

  if (result) {
    await db
      .update(transactions)
      .set({
        suggestedCategory: result.category as typeof transactions.suggestedCategory.enumValues[number],
        suggestionConfidence: result.confidence.toString(),
        suggestionStatus: "pending",
      })
      .where(eq(transactions.id, transactionId));
  }

  return result;
}

/**
 * Update merchant memory when user accepts/rejects a suggestion
 */
export async function updateMerchantMemory(
  userId: string,
  description: string,
  category: string,
  wasCorrection: boolean
): Promise<void> {
  const merchantName = normalizeMerchantName(description);

  // Check if mapping exists
  const existing = await db.query.merchantCategories.findFirst({
    where: and(
      eq(merchantCategories.userId, userId),
      eq(merchantCategories.merchantName, merchantName)
    ),
  });

  if (existing) {
    // Update existing mapping with running average
    const currentCount = parseFloat(existing.usageCount);
    const currentConfidence = parseFloat(existing.confidence);
    const newConfidence = wasCorrection
      ? Math.max(0, currentConfidence - 10) // Reduce confidence on correction
      : (currentConfidence * currentCount + 100) / (currentCount + 1); // Increase on accept

    await db
      .update(merchantCategories)
      .set({
        category: category as typeof merchantCategories.category.enumValues[number],
        confidence: Math.min(100, newConfidence).toFixed(2),
        usageCount: (currentCount + 1).toString(),
        lastUsedAt: new Date(),
      })
      .where(eq(merchantCategories.id, existing.id));
  } else {
    // Create new mapping
    await db.insert(merchantCategories).values({
      userId,
      merchantName,
      category: category as typeof merchantCategories.category.enumValues[number],
      confidence: wasCorrection ? "70.00" : "80.00",
    });
  }

  // Store as example if it was a correction
  if (wasCorrection) {
    await db.insert(categorizationExamples).values({
      userId,
      description,
      category: category as typeof categorizationExamples.category.enumValues[number],
      wasCorrection: true,
    });
  }
}

/**
 * Batch categorize multiple transactions
 */
export async function batchCategorize(
  userId: string,
  transactionData: Array<{ id: string; description: string; amount: number }>
): Promise<Map<string, CategorizationResult | null>> {
  const results = new Map<string, CategorizationResult | null>();

  for (const txn of transactionData) {
    const result = await categorizeTransaction(
      userId,
      txn.id,
      txn.description,
      parseFloat(txn.amount.toString())
    );
    results.set(txn.id, result);
  }

  return results;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/categorization.test.ts`
Expected: PASS (3 test suites)

**Step 5: Commit**

```bash
git add src/server/services/categorization.ts src/server/services/__tests__/categorization.test.ts
git commit -m "feat(categorization): add categorization service

- normalizeMerchantName for consistent merchant lookup
- buildCategorizationPrompt for Claude API
- parseCategorizationResponse for JSON parsing
- getMerchantCategory for merchant memory lookup
- categorizeWithClaude for API calls
- updateMerchantMemory for learning from feedback
- batchCategorize for processing multiple transactions"
```

---

## Task 3: Create Categorization Router

**Files:**
- Create: `/src/server/routers/categorization.ts`
- Modify: `/src/server/routers/_app.ts`

**Step 1: Create categorization router**

Create `/src/server/routers/categorization.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { transactions, merchantCategories, categorizationExamples } from "../db/schema";
import { eq, and, isNotNull, desc, sql } from "drizzle-orm";
import {
  categorizeTransaction,
  updateMerchantMemory,
  batchCategorize,
} from "../services/categorization";
import { TRPCError } from "@trpc/server";
import { categories } from "@/lib/categories";

const categoryValues = categories.map((c) => c.value) as [string, ...string[]];

export const categorizationRouter = router({
  // Get transactions pending review
  getPendingReview: protectedProcedure
    .input(
      z.object({
        confidenceFilter: z.enum(["all", "high", "low"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(transactions.userId, ctx.portfolio.ownerId),
        eq(transactions.suggestionStatus, "pending"),
        isNotNull(transactions.suggestedCategory),
      ];

      if (input.confidenceFilter === "high") {
        conditions.push(sql`${transactions.suggestionConfidence}::numeric >= 85`);
      } else if (input.confidenceFilter === "low") {
        conditions.push(sql`${transactions.suggestionConfidence}::numeric < 60`);
      }

      const results = await ctx.db.query.transactions.findMany({
        where: and(...conditions),
        orderBy: [desc(transactions.date)],
        limit: input.limit,
        offset: input.offset,
        with: {
          property: true,
          bankAccount: true,
        },
      });

      // Get total count
      const [{ count: total }] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(...conditions));

      // Group by normalized merchant name for batch UI
      const grouped = new Map<string, typeof results>();
      for (const txn of results) {
        const merchantKey = txn.description.toLowerCase().split(" ").slice(0, 2).join(" ");
        if (!grouped.has(merchantKey)) {
          grouped.set(merchantKey, []);
        }
        grouped.get(merchantKey)!.push(txn);
      }

      return {
        transactions: results,
        total,
        hasMore: input.offset + results.length < total,
        groupedByMerchant: Array.from(grouped.entries()).map(([merchant, txns]) => ({
          merchantKey: merchant,
          transactions: txns,
          suggestedCategory: txns[0].suggestedCategory,
          avgConfidence:
            txns.reduce((sum, t) => sum + parseFloat(t.suggestionConfidence || "0"), 0) /
            txns.length,
        })),
      };
    }),

  // Get pending review count (for badge)
  getPendingCount: protectedProcedure.query(async ({ ctx }) => {
    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          eq(transactions.suggestionStatus, "pending"),
          isNotNull(transactions.suggestedCategory)
        )
      );

    return { count };
  }),

  // Accept a suggestion
  acceptSuggestion: writeProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const txn = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.transactionId),
          eq(transactions.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!txn || !txn.suggestedCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction or suggestion not found",
        });
      }

      // Apply the suggested category
      const incomeCategories = ["rental_income", "other_rental_income"];
      const capitalCategories = ["stamp_duty", "conveyancing", "buyers_agent_fees", "initial_repairs"];
      const nonDeductibleCategories = [...capitalCategories, "transfer", "personal", "uncategorized"];

      let transactionType: "income" | "expense" | "capital" | "transfer" | "personal" = "expense";
      if (incomeCategories.includes(txn.suggestedCategory)) {
        transactionType = "income";
      } else if (capitalCategories.includes(txn.suggestedCategory)) {
        transactionType = "capital";
      } else if (txn.suggestedCategory === "transfer") {
        transactionType = "transfer";
      } else if (txn.suggestedCategory === "personal") {
        transactionType = "personal";
      }

      const isDeductible = !nonDeductibleCategories.includes(txn.suggestedCategory);

      await ctx.db
        .update(transactions)
        .set({
          category: txn.suggestedCategory,
          transactionType,
          isDeductible,
          suggestionStatus: "accepted",
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, input.transactionId));

      // Update merchant memory
      await updateMerchantMemory(
        ctx.portfolio.ownerId,
        txn.description,
        txn.suggestedCategory,
        false
      );

      return { success: true };
    }),

  // Reject suggestion and apply different category
  rejectSuggestion: writeProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
        newCategory: z.enum(categoryValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const txn = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.transactionId),
          eq(transactions.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!txn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      // Apply the user's category
      const incomeCategories = ["rental_income", "other_rental_income"];
      const capitalCategories = ["stamp_duty", "conveyancing", "buyers_agent_fees", "initial_repairs"];
      const nonDeductibleCategories = [...capitalCategories, "transfer", "personal", "uncategorized"];

      let transactionType: "income" | "expense" | "capital" | "transfer" | "personal" = "expense";
      if (incomeCategories.includes(input.newCategory)) {
        transactionType = "income";
      } else if (capitalCategories.includes(input.newCategory)) {
        transactionType = "capital";
      } else if (input.newCategory === "transfer") {
        transactionType = "transfer";
      } else if (input.newCategory === "personal") {
        transactionType = "personal";
      }

      const isDeductible = !nonDeductibleCategories.includes(input.newCategory);

      await ctx.db
        .update(transactions)
        .set({
          category: input.newCategory,
          transactionType,
          isDeductible,
          suggestionStatus: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, input.transactionId));

      // Update merchant memory with correction
      await updateMerchantMemory(
        ctx.portfolio.ownerId,
        txn.description,
        input.newCategory,
        true
      );

      return { success: true };
    }),

  // Batch accept suggestions for same merchant
  batchAccept: writeProcedure
    .input(
      z.object({
        transactionIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let accepted = 0;

      for (const id of input.transactionIds) {
        try {
          const txn = await ctx.db.query.transactions.findFirst({
            where: and(
              eq(transactions.id, id),
              eq(transactions.userId, ctx.portfolio.ownerId),
              eq(transactions.suggestionStatus, "pending")
            ),
          });

          if (txn?.suggestedCategory) {
            const incomeCategories = ["rental_income", "other_rental_income"];
            const capitalCategories = ["stamp_duty", "conveyancing", "buyers_agent_fees", "initial_repairs"];
            const nonDeductibleCategories = [...capitalCategories, "transfer", "personal", "uncategorized"];

            let transactionType: "income" | "expense" | "capital" | "transfer" | "personal" = "expense";
            if (incomeCategories.includes(txn.suggestedCategory)) {
              transactionType = "income";
            } else if (capitalCategories.includes(txn.suggestedCategory)) {
              transactionType = "capital";
            } else if (txn.suggestedCategory === "transfer") {
              transactionType = "transfer";
            } else if (txn.suggestedCategory === "personal") {
              transactionType = "personal";
            }

            const isDeductible = !nonDeductibleCategories.includes(txn.suggestedCategory);

            await ctx.db
              .update(transactions)
              .set({
                category: txn.suggestedCategory,
                transactionType,
                isDeductible,
                suggestionStatus: "accepted",
                updatedAt: new Date(),
              })
              .where(eq(transactions.id, id));

            // Only update merchant memory once per batch
            if (accepted === 0) {
              await updateMerchantMemory(
                ctx.portfolio.ownerId,
                txn.description,
                txn.suggestedCategory,
                false
              );
            }

            accepted++;
          }
        } catch {
          // Continue with other transactions
        }
      }

      return { success: true, accepted };
    }),

  // Manually trigger categorization for uncategorized transactions
  triggerCategorization: writeProcedure
    .input(
      z.object({
        transactionIds: z.array(z.string().uuid()).optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let txnsToProcess;

      if (input.transactionIds?.length) {
        txnsToProcess = await ctx.db.query.transactions.findMany({
          where: and(
            eq(transactions.userId, ctx.portfolio.ownerId),
            sql`${transactions.id} IN ${input.transactionIds}`
          ),
        });
      } else {
        // Get uncategorized transactions without suggestions
        txnsToProcess = await ctx.db.query.transactions.findMany({
          where: and(
            eq(transactions.userId, ctx.portfolio.ownerId),
            eq(transactions.category, "uncategorized"),
            sql`${transactions.suggestionStatus} IS NULL`
          ),
          limit: input.limit,
          orderBy: [desc(transactions.date)],
        });
      }

      const results = await batchCategorize(
        ctx.portfolio.ownerId,
        txnsToProcess.map((t) => ({
          id: t.id,
          description: t.description,
          amount: parseFloat(t.amount),
        }))
      );

      const categorized = Array.from(results.values()).filter((r) => r !== null).length;

      return { processed: txnsToProcess.length, categorized };
    }),

  // Get merchant memory stats
  getMerchantStats: protectedProcedure.query(async ({ ctx }) => {
    const mappings = await ctx.db.query.merchantCategories.findMany({
      where: eq(merchantCategories.userId, ctx.portfolio.ownerId),
      orderBy: [desc(merchantCategories.lastUsedAt)],
      limit: 20,
    });

    const examples = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(categorizationExamples)
      .where(eq(categorizationExamples.userId, ctx.portfolio.ownerId));

    return {
      merchantMappings: mappings.length,
      totalExamples: examples[0].count,
      recentMappings: mappings.map((m) => ({
        merchantName: m.merchantName,
        category: m.category,
        confidence: parseFloat(m.confidence),
        usageCount: parseInt(m.usageCount),
      })),
    };
  }),
});
```

**Step 2: Register router in _app.ts**

Modify `/src/server/routers/_app.ts`:

```typescript
import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";
import { loanRouter } from "./loan";
import { reportsRouter } from "./reports";
import { cgtRouter } from "./cgt";
import { documentsRouter } from "./documents";
import { recurringRouter } from "./recurring";
import { propertyValueRouter } from "./propertyValue";
import { portfolioRouter } from "./portfolio";
import { onboardingRouter } from "./onboarding";
import { anomalyRouter } from "./anomaly";
import { forecastRouter } from "./forecast";
import { notificationRouter } from "./notification";
import { teamRouter } from "./team";
import { categorizationRouter } from "./categorization";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
  reports: reportsRouter,
  cgt: cgtRouter,
  documents: documentsRouter,
  recurring: recurringRouter,
  propertyValue: propertyValueRouter,
  portfolio: portfolioRouter,
  onboarding: onboardingRouter,
  anomaly: anomalyRouter,
  forecast: forecastRouter,
  notification: notificationRouter,
  team: teamRouter,
  categorization: categorizationRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/routers/categorization.ts src/server/routers/_app.ts
git commit -m "feat(categorization): add categorization router

- getPendingReview with confidence filtering and merchant grouping
- getPendingCount for badge display
- acceptSuggestion and rejectSuggestion endpoints
- batchAccept for same-merchant bulk actions
- triggerCategorization for manual categorization
- getMerchantStats for debugging/monitoring"
```

---

## Task 4: Integrate with Bank Sync

**Files:**
- Modify: `/src/server/routers/banking.ts:99-118`

**Step 1: Add categorization import**

Add import at top of `/src/server/routers/banking.ts`:

```typescript
import { batchCategorize } from "../services/categorization";
```

**Step 2: Add categorization after transaction insert**

Modify the syncAccount mutation. After the existing anomaly detection block (around line 186), add categorization:

```typescript
        // Run categorization on new uncategorized transactions
        if (transactionsAdded > 0) {
          const uncategorizedTxns = await ctx.db.query.transactions.findMany({
            where: and(
              eq(transactions.userId, ctx.portfolio.ownerId),
              eq(transactions.bankAccountId, account.id),
              eq(transactions.category, "uncategorized"),
              sql`${transactions.suggestionStatus} IS NULL`
            ),
            orderBy: [desc(transactions.createdAt)],
            limit: 50,
          });

          if (uncategorizedTxns.length > 0) {
            await batchCategorize(
              ctx.portfolio.ownerId,
              uncategorizedTxns.map((t) => ({
                id: t.id,
                description: t.description,
                amount: parseFloat(t.amount),
              }))
            );
          }
        }
```

**Step 3: Add sql import**

Update the imports at the top of the file to include `sql`:

```typescript
import { eq, and, desc, sql } from "drizzle-orm";
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/server/routers/banking.ts
git commit -m "feat(categorization): integrate AI categorization with bank sync

- Run batchCategorize on new uncategorized transactions after sync
- Limit to 50 transactions per sync to control API costs"
```

---

## Task 5: Create ConfidenceBadge Component

**Files:**
- Create: `/src/components/categorization/ConfidenceBadge.tsx`

**Step 1: Create the component**

```typescript
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number;
  showValue?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceBadge({
  confidence,
  showValue = false,
  size = "md",
}: ConfidenceBadgeProps) {
  const getColor = () => {
    if (confidence >= 85) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLabel = () => {
    if (confidence >= 85) return "High confidence";
    if (confidence >= 60) return "Medium confidence";
    return "Low confidence";
  };

  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  return (
    <div className="flex items-center gap-2" title={getLabel()}>
      <span className={cn("rounded-full", dotSize, getColor())} />
      {showValue && (
        <span className="text-xs text-muted-foreground">{confidence.toFixed(0)}%</span>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/categorization/ConfidenceBadge.tsx
git commit -m "feat(categorization): add ConfidenceBadge component

- Green dot for >85% confidence
- Yellow dot for 60-85% confidence
- Red dot for <60% confidence
- Optional percentage display"
```

---

## Task 6: Create SuggestionCard Component

**Files:**
- Create: `/src/components/categorization/SuggestionCard.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { getCategoryLabel } from "@/lib/categories";
import { format } from "date-fns";

interface SuggestionCardProps {
  transaction: {
    id: string;
    date: string;
    description: string;
    amount: string;
    suggestedCategory: string | null;
    suggestionConfidence: string | null;
    property?: { address: string } | null;
  };
  onAccept: (id: string) => void;
  onReject: (id: string, newCategory: string) => void;
  isLoading?: boolean;
}

export function SuggestionCard({
  transaction,
  onAccept,
  onReject,
  isLoading,
}: SuggestionCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const confidence = parseFloat(transaction.suggestionConfidence || "0");
  const amount = parseFloat(transaction.amount);

  const handleReject = () => {
    if (selectedCategory) {
      onReject(transaction.id, selectedCategory);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-muted-foreground">
                {format(new Date(transaction.date), "dd MMM yyyy")}
              </span>
              {transaction.property && (
                <span className="text-xs text-muted-foreground truncate">
                  • {transaction.property.address}
                </span>
              )}
            </div>
            <p className="font-medium truncate">{transaction.description}</p>
            <p
              className={cn(
                "text-lg font-semibold",
                amount >= 0 ? "text-green-600" : "text-red-600"
              )}
            >
              ${Math.abs(amount).toFixed(2)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={confidence} showValue />
              <span className="text-sm font-medium">
                {getCategoryLabel(transaction.suggestedCategory || "uncategorized")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAccept(transaction.id)}
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-1" />
                Accept
              </Button>

              <div className="flex items-center gap-1">
                <CategorySelect
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                  disabled={isLoading}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReject}
                  disabled={isLoading || !selectedCategory}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

**Step 2: Commit**

```bash
git add src/components/categorization/SuggestionCard.tsx
git commit -m "feat(categorization): add SuggestionCard component

- Display transaction date, description, amount
- Show suggested category with confidence badge
- Accept button to apply suggestion
- Category dropdown to select different category and reject"
```

---

## Task 7: Create BatchSuggestionCard Component

**Files:**
- Create: `/src/components/categorization/BatchSuggestionCard.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SuggestionCard } from "./SuggestionCard";
import { getCategoryLabel } from "@/lib/categories";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  suggestedCategory: string | null;
  suggestionConfidence: string | null;
  property?: { address: string } | null;
}

interface BatchSuggestionCardProps {
  merchantKey: string;
  transactions: Transaction[];
  suggestedCategory: string | null;
  avgConfidence: number;
  onBatchAccept: (ids: string[]) => void;
  onAccept: (id: string) => void;
  onReject: (id: string, newCategory: string) => void;
  isLoading?: boolean;
}

export function BatchSuggestionCard({
  merchantKey,
  transactions,
  suggestedCategory,
  avgConfidence,
  onBatchAccept,
  onAccept,
  onReject,
  isLoading,
}: BatchSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalAmount = transactions.reduce(
    (sum, t) => sum + parseFloat(t.amount),
    0
  );

  if (transactions.length === 1) {
    return (
      <SuggestionCard
        transaction={transactions[0]}
        onAccept={onAccept}
        onReject={onReject}
        isLoading={isLoading}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base capitalize">{merchantKey}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({transactions.length} transactions)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={avgConfidence} showValue />
              <span className="text-sm font-medium">
                {getCategoryLabel(suggestedCategory || "uncategorized")}
              </span>
            </div>
            <span
              className={cn(
                "font-semibold",
                totalAmount >= 0 ? "text-green-600" : "text-red-600"
              )}
            >
              ${Math.abs(totalAmount).toFixed(2)} total
            </span>
          </div>

          <Button
            onClick={() => onBatchAccept(transactions.map((t) => t.id))}
            disabled={isLoading}
          >
            <Check className="w-4 h-4 mr-2" />
            Apply to all {transactions.length}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-2 mt-4 border-t pt-4">
            {transactions.map((txn) => (
              <SuggestionCard
                key={txn.id}
                transaction={txn}
                onAccept={onAccept}
                onReject={onReject}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

**Step 2: Commit**

```bash
git add src/components/categorization/BatchSuggestionCard.tsx
git commit -m "feat(categorization): add BatchSuggestionCard component

- Group transactions by merchant
- Show count and total amount
- Apply to all button for batch accept
- Expand/collapse to view individual transactions"
```

---

## Task 8: Create Review Page

**Files:**
- Create: `/src/app/(dashboard)/transactions/review/page.tsx`

**Step 1: Create the review page**

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchSuggestionCard } from "@/components/categorization/BatchSuggestionCard";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ConfidenceFilter = "all" | "high" | "low";

export default function ReviewPage() {
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.categorization.getPendingReview.useQuery({
    confidenceFilter,
    limit: 50,
  });

  const acceptMutation = trpc.categorization.acceptSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion accepted");
      utils.categorization.getPendingReview.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.categorization.rejectSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Category updated");
      utils.categorization.getPendingReview.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const batchAcceptMutation = trpc.categorization.batchAccept.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.accepted} transactions categorized`);
      utils.categorization.getPendingReview.invalidate();
      utils.categorization.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const triggerMutation = trpc.categorization.triggerCategorization.useMutation({
    onSuccess: (result) => {
      toast.success(`Categorized ${result.categorized} of ${result.processed} transactions`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isProcessing =
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    batchAcceptMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Review Suggestions
          </h1>
          <p className="text-muted-foreground">
            {data?.total ?? 0} transactions pending review
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => triggerMutation.mutate({ limit: 20 })}
          disabled={triggerMutation.isPending}
        >
          <RefreshCw
            className={cn(
              "w-4 h-4 mr-2",
              triggerMutation.isPending && "animate-spin"
            )}
          />
          Scan Uncategorized
        </Button>
      </div>

      <Tabs
        value={confidenceFilter}
        onValueChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="high">High Confidence</TabsTrigger>
          <TabsTrigger value="low">Low Confidence</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading suggestions...
        </div>
      ) : data?.groupedByMerchant.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">All caught up!</h3>
          <p className="text-muted-foreground">
            No transactions pending review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.groupedByMerchant.map((group) => (
            <BatchSuggestionCard
              key={group.merchantKey}
              merchantKey={group.merchantKey}
              transactions={group.transactions}
              suggestedCategory={group.suggestedCategory}
              avgConfidence={group.avgConfidence}
              onBatchAccept={(ids) => batchAcceptMutation.mutate({ transactionIds: ids })}
              onAccept={(id) => acceptMutation.mutate({ transactionId: id })}
              onReject={(id, cat) =>
                rejectMutation.mutate({ transactionId: id, newCategory: cat })
              }
              isLoading={isProcessing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/transactions/review/page.tsx
git commit -m "feat(categorization): add transaction review page

- List pending suggestions grouped by merchant
- Filter by confidence level (all/high/low)
- Accept individual or batch suggestions
- Scan uncategorized button to trigger AI categorization"
```

---

## Task 9: Update Sidebar with Review Badge

**Files:**
- Modify: `/src/components/layout/Sidebar.tsx`

**Step 1: Add review link with badge**

Update `/src/components/layout/Sidebar.tsx`. Add `Sparkles` to imports and add a new nav item:

```typescript
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  BarChart3,
  Landmark,
  Wallet,
  FileDown,
  PieChart,
  Bell,
  TrendingUp,
  Settings,
  Users,
  History,
  Sparkles,
} from "lucide-react";
```

Update the navItems array to include the review page after transactions:

```typescript
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/transactions/review", label: "Review", icon: Sparkles, showBadge: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reports/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/banking", label: "Banking", icon: Landmark },
  { href: "/loans", label: "Loans", icon: Wallet },
  { href: "/export", label: "Export", icon: FileDown },
];
```

Add trpc import and pending count query:

```typescript
import { trpc } from "@/lib/trpc/client";
```

Update the Sidebar component to fetch and display the badge:

```typescript
export function Sidebar() {
  const pathname = usePathname();
  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery();

  return (
    <aside className="w-64 border-r border-border bg-card min-h-screen p-4">
      {/* ... existing header code ... */}

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const showBadge = item.showBadge && pendingCount?.count && pendingCount.count > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
              {showBadge && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {pendingCount.count > 99 ? "99+" : pendingCount.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ... existing settings section ... */}
    </aside>
  );
}
```

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(categorization): add review link with pending count badge

- Add Review nav item with Sparkles icon
- Show badge with pending review count
- Badge hidden when count is 0"
```

---

## Task 10: Add Environment Variable

**Files:**
- Modify: `/.env.example`
- Modify: `/.env.local` (if exists, otherwise create)

**Step 1: Add ANTHROPIC_API_KEY to env example**

Add to `.env.example`:

```
# AI Categorization
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add ANTHROPIC_API_KEY to env example"
```

---

## Task 11: Run Full Test Suite and Manual Testing

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: No type errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No lint errors

**Step 4: Start dev server and manual test**

Run: `npm run dev`

Manual test checklist:
- [ ] Navigate to /transactions/review page
- [ ] Verify empty state displays correctly
- [ ] Trigger a bank sync (if connected) or use "Scan Uncategorized" button
- [ ] Verify suggestions appear with confidence badges
- [ ] Accept a suggestion and verify it updates
- [ ] Reject a suggestion with different category
- [ ] Verify batch accept works for grouped transactions
- [ ] Check sidebar badge updates after accepting/rejecting

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(categorization): complete AI-powered categorization feature

- Database schema for suggestions, merchant memory, examples
- Categorization service with Claude Haiku API
- Integration with bank sync for auto-suggestions
- Review page with batch processing
- Confidence badges and merchant grouping
- Sidebar badge for pending count"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database schema | schema.ts, migrations |
| 2 | Categorization service | categorization.ts |
| 3 | tRPC router | categorization.ts, _app.ts |
| 4 | Bank sync integration | banking.ts |
| 5 | ConfidenceBadge | ConfidenceBadge.tsx |
| 6 | SuggestionCard | SuggestionCard.tsx |
| 7 | BatchSuggestionCard | BatchSuggestionCard.tsx |
| 8 | Review page | review/page.tsx |
| 9 | Sidebar badge | Sidebar.tsx |
| 10 | Environment variable | .env.example |
| 11 | Testing | All files |
