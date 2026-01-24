import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { transactions, merchantCategories, categorizationExamples } from "../db/schema";
import { eq, and, isNotNull, desc, sql, inArray } from "drizzle-orm";
import {
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
          category: input.newCategory as typeof transactions.category.enumValues[number],
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
            inArray(transactions.id, input.transactionIds)
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
