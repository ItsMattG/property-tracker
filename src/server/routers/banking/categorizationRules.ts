import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { categories } from "@/lib/categories";
import { matchTransaction } from "../../services/banking/rule-matcher";
import { getPlanFromSubscription } from "../../services/billing/subscription";
import type { CategorizationRule, NewCategorizationRule } from "../../db/schema";

const categoryValues = categories.map((c) => c.value) as [string, ...string[]];

const FREE_RULE_LIMIT = 5;

const matchTypes = ["contains", "equals", "starts_with", "regex"] as const;

const ruleInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  merchantPattern: z.string().max(200).nullable(),
  descriptionPattern: z.string().max(200).nullable(),
  matchType: z.enum(matchTypes).default("contains"),
  amountMin: z.number().int().nullable(),
  amountMax: z.number().int().nullable(),
  targetCategory: z.enum(categoryValues),
  targetPropertyId: z.string().uuid().nullable(),
  priority: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const categorizationRulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.categorizationRules.findByUser(ctx.portfolio.ownerId);
  }),

  create: writeProcedure
    .input(ruleInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate at least one pattern is provided
      if (!input.merchantPattern && !input.descriptionPattern) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one pattern (merchant or description) is required",
        });
      }

      // Check plan limits for free tier
      const sub = await ctx.uow.user.findSubscriptionFull(ctx.portfolio.ownerId);
      const plan = getPlanFromSubscription(
        sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null,
      );

      if (plan === "free") {
        const count = await ctx.uow.categorizationRules.countByUser(ctx.portfolio.ownerId);
        if (count >= FREE_RULE_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free plan is limited to ${FREE_RULE_LIMIT} categorisation rules. Upgrade to Pro for unlimited rules.`,
          });
        }
      }

      return ctx.uow.categorizationRules.create({
        userId: ctx.portfolio.ownerId,
        ...input,
        targetCategory: input.targetCategory as NewCategorizationRule["targetCategory"],
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }).merge(ruleInputSchema.partial()),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Validate patterns if both are being set to null
      if (data.merchantPattern === null && data.descriptionPattern === null) {
        // Check if the rule currently has at least one pattern
        const existing = await ctx.uow.categorizationRules.findById(id, ctx.portfolio.ownerId);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
        }
        const finalMerchant = data.merchantPattern !== undefined ? data.merchantPattern : existing.merchantPattern;
        const finalDescription = data.descriptionPattern !== undefined ? data.descriptionPattern : existing.descriptionPattern;
        if (!finalMerchant && !finalDescription) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one pattern (merchant or description) is required",
          });
        }
      }

      const rule = await ctx.uow.categorizationRules.update(
        id,
        ctx.portfolio.ownerId,
        data as Partial<CategorizationRule>,
      );
      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
      }
      return rule;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.categorizationRules.delete(input.id, ctx.portfolio.ownerId);
    }),

  /** Dry-run a rule against recent transactions to see what would match */
  test: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().uuid().optional(),
        /** Inline rule for testing before saving */
        rule: ruleInputSchema.optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let ruleToTest;

      if (input.ruleId) {
        const existing = await ctx.uow.categorizationRules.findById(input.ruleId, ctx.portfolio.ownerId);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
        }
        ruleToTest = existing;
      } else if (input.rule) {
        // Build a temporary rule object for testing
        ruleToTest = {
          id: "test-rule",
          userId: ctx.portfolio.ownerId,
          matchCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...input.rule,
        };
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either ruleId or rule must be provided",
        });
      }

      // Get recent transactions to test against
      const recentTxns = await ctx.uow.transactions.findRecent(ctx.portfolio.ownerId, input.limit);

      const matches = recentTxns
        .filter((txn) => {
          const result = matchTransaction([ruleToTest as Parameters<typeof matchTransaction>[0][number]], {
            merchant: txn.description ?? "",
            description: txn.description ?? "",
            amount: parseFloat(txn.amount),
          });
          return result !== null;
        })
        .map((txn) => ({
          id: txn.id,
          description: txn.description,
          amount: txn.amount,
          category: txn.category,
        }));

      return {
        matchCount: matches.length,
        matches,
      };
    }),
});
