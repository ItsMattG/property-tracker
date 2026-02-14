import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import type { Transaction } from "../db/schema";
import { merchantCategories, categorizationExamples } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  updateMerchantMemory,
  batchCategorize,
} from "../services/banking";
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
      const { transactions: results, total } = await ctx.uow.transactions.findPendingSuggestions(
        ctx.portfolio.ownerId,
        {
          confidenceFilter: input.confidenceFilter,
          limit: input.limit,
          offset: input.offset,
        }
      );

      // Group by normalized merchant name + suggested category for batch UI
      const grouped = new Map<string, typeof results>();
      for (const txn of results) {
        const merchantKey = txn.description.toLowerCase().split(" ").slice(0, 2).join(" ");
        const groupKey = `${merchantKey}::${txn.suggestedCategory || "uncategorized"}`;
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey)!.push(txn);
      }

      return {
        transactions: results,
        total,
        hasMore: input.offset + results.length < total,
        groupedByMerchant: Array.from(grouped.entries()).map(([groupKey, txns]) => ({
          merchantKey: groupKey.split("::")[0],
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
    const count = await ctx.uow.transactions.countPendingSuggestions(ctx.portfolio.ownerId);
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
      const txn = await ctx.uow.transactions.findById(input.transactionId, ctx.portfolio.ownerId);

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

      await ctx.uow.transactions.update(input.transactionId, ctx.portfolio.ownerId, {
        category: txn.suggestedCategory as Transaction["category"],
        transactionType,
        isDeductible,
        isVerified: true,
        suggestionStatus: "accepted",
        updatedAt: new Date(),
      });

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
      const txn = await ctx.uow.transactions.findById(input.transactionId, ctx.portfolio.ownerId);

      if (!txn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

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

      await ctx.uow.transactions.update(input.transactionId, ctx.portfolio.ownerId, {
        category: input.newCategory as Transaction["category"],
        transactionType,
        isDeductible,
        isVerified: true,
        suggestionStatus: "rejected",
        updatedAt: new Date(),
      });

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
          const txn = await ctx.uow.transactions.findById(id, ctx.portfolio.ownerId);

          if (txn?.suggestedCategory && txn.suggestionStatus === "pending") {
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

            await ctx.uow.transactions.update(id, ctx.portfolio.ownerId, {
              category: txn.suggestedCategory as Transaction["category"],
              transactionType,
              isDeductible,
              isVerified: true,
              suggestionStatus: "accepted",
              updatedAt: new Date(),
            });

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
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI categorisation is not configured. Please set the ANTHROPIC_API_KEY environment variable.",
        });
      }

      let txnsToProcess;

      if (input.transactionIds?.length) {
        txnsToProcess = await ctx.uow.transactions.findByIds(input.transactionIds, ctx.portfolio.ownerId);
      } else {
        txnsToProcess = await ctx.uow.transactions.findForCategorization(ctx.portfolio.ownerId, {
          limit: input.limit,
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
      .select({ count: sql<number>`count(*)::int` })
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
