import { z } from "zod";
import { positiveAmountSchema } from "@/lib/validation";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  recurringTransactions,
  expectedTransactions,
  transactions,
} from "../../db/schema";
import type { RecurringTransaction } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import {
  generateExpectedTransactions,
  findMatchingTransactions,
  detectPatterns,
} from "../../services/transaction";

const frequencyEnum = z.enum([
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "annually",
]);

const recurringSchema = z.object({
  propertyId: z.string().uuid(),
  description: z.string().min(1, "Description is required"),
  amount: positiveAmountSchema,
  category: z.string(),
  transactionType: z.enum(["income", "expense", "capital", "transfer", "personal"]),
  frequency: frequencyEnum,
  dayOfMonth: z.number().min(1).max(31).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  linkedBankAccountId: z.string().uuid().optional(),
  amountTolerance: positiveAmountSchema.default("5.00"),
  dateTolerance: z.number().min(0).max(30).default(3),
  alertDelayDays: z.number().min(0).max(30).default(3),
});

export const recurringRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          propertyId: z.string().uuid().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.recurring.findByOwner(ctx.portfolio.ownerId, {
        propertyId: input?.propertyId,
        isActive: input?.isActive,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const recurring = await ctx.uow.recurring.findById(input.id, ctx.portfolio.ownerId);

      if (!recurring) {
        throw new Error("Recurring transaction not found");
      }

      return recurring;
    }),

  create: writeProcedure
    .input(recurringSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new Error("Property not found");
      }

      const recurring = await ctx.uow.recurring.create({
        userId: ctx.portfolio.ownerId,
        propertyId: input.propertyId,
        description: input.description,
        amount: input.amount,
        category: input.category as typeof recurringTransactions.$inferInsert.category,
        transactionType: input.transactionType,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth?.toString() ?? null,
        dayOfWeek: input.dayOfWeek?.toString() ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        linkedBankAccountId: input.linkedBankAccountId ?? null,
        amountTolerance: input.amountTolerance,
        dateTolerance: input.dateTolerance.toString(),
        alertDelayDays: input.alertDelayDays.toString(),
      });

      // Generate initial expected transactions
      const generated = generateExpectedTransactions(recurring, new Date(), 14);

      if (generated.length > 0) {
        await ctx.uow.recurring.createExpected(
          generated.map((g) => ({
            recurringTransactionId: g.recurringTransactionId,
            userId: g.userId,
            propertyId: g.propertyId,
            expectedDate: g.expectedDate,
            expectedAmount: g.expectedAmount,
          }))
        );
      }

      return recurring;
    }),

  update: writeProcedure
    .input(z.object({ id: z.string().uuid() }).merge(recurringSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: Partial<RecurringTransaction> = {
        updatedAt: new Date(),
      };

      if (data.propertyId) updateData.propertyId = data.propertyId;
      if (data.description) updateData.description = data.description;
      if (data.amount) updateData.amount = data.amount;
      if (data.category) updateData.category = data.category as RecurringTransaction["category"];
      if (data.transactionType) updateData.transactionType = data.transactionType;
      if (data.frequency) updateData.frequency = data.frequency;
      if (data.dayOfMonth !== undefined)
        updateData.dayOfMonth = data.dayOfMonth?.toString() ?? null;
      if (data.dayOfWeek !== undefined)
        updateData.dayOfWeek = data.dayOfWeek?.toString() ?? null;
      if (data.startDate) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate ?? null;
      if (data.linkedBankAccountId !== undefined)
        updateData.linkedBankAccountId = data.linkedBankAccountId ?? null;
      if (data.amountTolerance) updateData.amountTolerance = data.amountTolerance;
      if (data.dateTolerance !== undefined)
        updateData.dateTolerance = data.dateTolerance.toString();
      if (data.alertDelayDays !== undefined)
        updateData.alertDelayDays = data.alertDelayDays.toString();

      return ctx.uow.recurring.update(id, ctx.portfolio.ownerId, updateData);
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.recurring.delete(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  toggleActive: writeProcedure
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.recurring.update(input.id, ctx.portfolio.ownerId, {
        isActive: input.isActive,
        updatedAt: new Date(),
      });
    }),

  skip: writeProcedure
    .input(z.object({ expectedId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.uow.recurring.updateExpected(
        input.expectedId,
        ctx.portfolio.ownerId,
        { status: "skipped" }
      );

      if (!updated) {
        throw new Error("Expected transaction not found");
      }

      return updated;
    }),

  matchManually: writeProcedure
    .input(
      z.object({
        expectedId: z.string().uuid(),
        transactionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cross-domain: recurring matching queries expectedTransactions and transactions
      const [expected, tx] = await Promise.all([
        ctx.db.query.expectedTransactions.findFirst({
          where: and(
            eq(expectedTransactions.id, input.expectedId),
            eq(expectedTransactions.userId, ctx.portfolio.ownerId)
          ),
          with: { recurringTransaction: true },
        }),
        ctx.db.query.transactions.findFirst({
          where: and(
            eq(transactions.id, input.transactionId),
            eq(transactions.userId, ctx.portfolio.ownerId)
          ),
        }),
      ]);

      if (!expected) {
        throw new Error("Expected transaction not found");
      }

      if (!tx) {
        throw new Error("Transaction not found");
      }

      // Update expected transaction
      const updated = await ctx.uow.recurring.updateExpected(
        input.expectedId,
        ctx.portfolio.ownerId,
        {
          status: "matched",
          matchedTransactionId: input.transactionId,
        }
      );

      // Cross-domain: apply recurring template fields to matched transaction
      if (expected.recurringTransaction) {
        await ctx.db
          .update(transactions)
          .set({
            category: expected.recurringTransaction.category,
            transactionType: expected.recurringTransaction.transactionType,
            propertyId: expected.propertyId,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, input.transactionId));
      }

      return updated;
    }),

  getExpectedTransactions: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["pending", "matched", "missed", "skipped"])
            .optional(),
          propertyId: z.string().uuid().optional(),
          recurringTransactionId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.recurring.findExpected(ctx.portfolio.ownerId, {
        status: input?.status,
        propertyId: input?.propertyId,
        recurringTransactionId: input?.recurringTransactionId,
      });
    }),

  // getSuggestions and runMatching use cross-domain queries (transactions + recurring)
  // so they keep inline DB access for the transaction-domain parts
  getSuggestions: protectedProcedure.query(async ({ ctx }) => {
    // Cross-domain: recurring matching queries expectedTransactions and transactions
    const [recentTransactions, existingTemplates] = await Promise.all([
      ctx.db.query.transactions.findMany({
        where: eq(transactions.userId, ctx.portfolio.ownerId),
        orderBy: (t, { desc }) => [desc(t.date)],
        limit: 500,
      }),
      ctx.uow.recurring.findByOwner(ctx.portfolio.ownerId),
    ]);

    const templatePropertyCategories = new Set(
      existingTemplates.map((t) => `${t.propertyId}:${t.category}`)
    );

    const eligibleTransactions = recentTransactions.filter(
      (t) =>
        t.propertyId && !templatePropertyCategories.has(`${t.propertyId}:${t.category}`)
    );

    return detectPatterns(eligibleTransactions);
  }),

  runMatching: writeProcedure.mutation(async ({ ctx }) => {
    const pending = await ctx.uow.recurring.findPendingExpected(ctx.portfolio.ownerId);

    const matchedIds = pending
      .filter((p) => p.matchedTransactionId)
      .map((p) => p.matchedTransactionId!);

    // Cross-domain: recurring matching queries expectedTransactions and transactions
    const allTransactions = await ctx.db.query.transactions.findMany({
      where: eq(transactions.userId, ctx.portfolio.ownerId),
    });

    const unmatchedTransactions = allTransactions.filter(
      (t) => !matchedIds.includes(t.id)
    );

    const results: Array<{
      expectedId: string;
      matchedTransactionId: string | null;
      confidence: "high" | "medium" | "low" | null;
    }> = [];

    const expectedUpdates: Array<{ id: string; matchedTransactionId: string }> = [];
    const transactionUpdates: Array<{
      id: string;
      category: string;
      transactionType: string;
      propertyId: string;
    }> = [];

    for (const expected of pending) {
      if (!expected.recurringTransaction) continue;

      const amountTolerance = Number(expected.recurringTransaction.amountTolerance);
      const dateTolerance = Number(expected.recurringTransaction.dateTolerance);

      const matches = findMatchingTransactions(
        expected,
        unmatchedTransactions,
        amountTolerance,
        dateTolerance
      );

      if (matches.length > 0 && matches[0].confidence === "high") {
        expectedUpdates.push({
          id: expected.id,
          matchedTransactionId: matches[0].transaction.id,
        });
        transactionUpdates.push({
          id: matches[0].transaction.id,
          category: expected.recurringTransaction.category,
          transactionType: expected.recurringTransaction.transactionType,
          propertyId: expected.propertyId,
        });

        results.push({
          expectedId: expected.id,
          matchedTransactionId: matches[0].transaction.id,
          confidence: "high",
        });
      } else if (matches.length > 0) {
        results.push({
          expectedId: expected.id,
          matchedTransactionId: matches[0].transaction.id,
          confidence: matches[0].confidence,
        });
      } else {
        results.push({
          expectedId: expected.id,
          matchedTransactionId: null,
          confidence: null,
        });
      }
    }

    // Cross-domain: batch update expectedTransactions and transactions tables
    if (expectedUpdates.length > 0) {
      const now = new Date();
      await Promise.all([
        ...expectedUpdates.map((eu) =>
          ctx.db
            .update(expectedTransactions)
            .set({
              status: "matched",
              matchedTransactionId: eu.matchedTransactionId,
            })
            .where(eq(expectedTransactions.id, eu.id))
        ),
        ...transactionUpdates.map((tu) =>
          ctx.db
            .update(transactions)
            .set({
              category: tu.category as typeof transactions.$inferInsert.category,
              transactionType: tu.transactionType as typeof transactions.$inferInsert.transactionType,
              propertyId: tu.propertyId,
              updatedAt: now,
            })
            .where(eq(transactions.id, tu.id))
        ),
      ]);
    }

    return results;
  }),
});
