import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  recurringTransactions,
  expectedTransactions,
  transactions,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  generateExpectedTransactions,
  findMatchingTransactions,
  detectPatterns,
} from "../services/recurring";

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
  amount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  category: z.string(),
  transactionType: z.enum(["income", "expense", "capital", "transfer", "personal"]),
  frequency: frequencyEnum,
  dayOfMonth: z.number().min(1).max(31).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  linkedBankAccountId: z.string().uuid().optional(),
  amountTolerance: z.string().regex(/^\d+\.?\d*$/).default("5.00"),
  dateTolerance: z.number().min(0).max(30).default(3),
  alertDelayDays: z.number().min(0).max(30).default(3),
});

export const recurringRouter = router({
  // List all recurring templates for user
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
      const conditions = [eq(recurringTransactions.userId, ctx.portfolio.ownerId)];

      if (input?.propertyId) {
        conditions.push(eq(recurringTransactions.propertyId, input.propertyId));
      }

      if (input?.isActive !== undefined) {
        conditions.push(eq(recurringTransactions.isActive, input.isActive));
      }

      return ctx.db.query.recurringTransactions.findMany({
        where: and(...conditions),
        with: {
          property: true,
          linkedBankAccount: true,
        },
        orderBy: (rt, { desc }) => [desc(rt.createdAt)],
      });
    }),

  // Get a single recurring template
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const recurring = await ctx.db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.userId, ctx.portfolio.ownerId)
        ),
        with: {
          property: true,
          linkedBankAccount: true,
          expectedTransactions: {
            orderBy: (et, { desc }) => [desc(et.expectedDate)],
            limit: 10,
          },
        },
      });

      if (!recurring) {
        throw new Error("Recurring transaction not found");
      }

      return recurring;
    }),

  // Create a new recurring template
  create: writeProcedure
    .input(recurringSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(transactions.id, input.propertyId),
          eq(transactions.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      const [recurring] = await ctx.db
        .insert(recurringTransactions)
        .values({
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
        })
        .returning();

      // Generate initial expected transactions
      const generated = generateExpectedTransactions(
        recurring,
        new Date(),
        14
      );

      if (generated.length > 0) {
        await ctx.db.insert(expectedTransactions).values(
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

  // Update a recurring template
  update: writeProcedure
    .input(z.object({ id: z.string().uuid() }).merge(recurringSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (data.propertyId) updateData.propertyId = data.propertyId;
      if (data.description) updateData.description = data.description;
      if (data.amount) updateData.amount = data.amount;
      if (data.category) updateData.category = data.category;
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

      const [recurring] = await ctx.db
        .update(recurringTransactions)
        .set(updateData)
        .where(
          and(
            eq(recurringTransactions.id, id),
            eq(recurringTransactions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      return recurring;
    }),

  // Delete a recurring template
  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(recurringTransactions)
        .where(
          and(
            eq(recurringTransactions.id, input.id),
            eq(recurringTransactions.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),

  // Toggle active status
  toggleActive: writeProcedure
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [recurring] = await ctx.db
        .update(recurringTransactions)
        .set({
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recurringTransactions.id, input.id),
            eq(recurringTransactions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      return recurring;
    }),

  // Skip an expected transaction
  skip: writeProcedure
    .input(z.object({ expectedId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(expectedTransactions)
        .set({ status: "skipped" })
        .where(
          and(
            eq(expectedTransactions.id, input.expectedId),
            eq(expectedTransactions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error("Expected transaction not found");
      }

      return updated;
    }),

  // Manually match an expected transaction to an actual transaction
  matchManually: writeProcedure
    .input(
      z.object({
        expectedId: z.string().uuid(),
        transactionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify both belong to user
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
      const [updated] = await ctx.db
        .update(expectedTransactions)
        .set({
          status: "matched",
          matchedTransactionId: input.transactionId,
        })
        .where(eq(expectedTransactions.id, input.expectedId))
        .returning();

      // Apply category/transactionType from template to the actual transaction
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

  // Get expected transactions with optional filters
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
      const conditions = [eq(expectedTransactions.userId, ctx.portfolio.ownerId)];

      if (input?.status) {
        conditions.push(eq(expectedTransactions.status, input.status));
      }

      if (input?.propertyId) {
        conditions.push(eq(expectedTransactions.propertyId, input.propertyId));
      }

      if (input?.recurringTransactionId) {
        conditions.push(
          eq(
            expectedTransactions.recurringTransactionId,
            input.recurringTransactionId
          )
        );
      }

      return ctx.db.query.expectedTransactions.findMany({
        where: and(...conditions),
        with: {
          recurringTransaction: true,
          property: true,
          matchedTransaction: true,
        },
        orderBy: (et, { desc }) => [desc(et.expectedDate)],
      });
    }),

  // Get pattern suggestions
  getSuggestions: protectedProcedure.query(async ({ ctx }) => {
    // Get recent transactions for the user
    const recentTransactions = await ctx.db.query.transactions.findMany({
      where: eq(transactions.userId, ctx.portfolio.ownerId),
      orderBy: (t, { desc }) => [desc(t.date)],
      limit: 500,
    });

    // Get existing recurring templates to exclude
    const existingTemplates = await ctx.db.query.recurringTransactions.findMany({
      where: eq(recurringTransactions.userId, ctx.portfolio.ownerId),
    });

    // Filter out transactions that are already part of a recurring template
    const templatePropertyCategories = new Set(
      existingTemplates.map((t) => `${t.propertyId}:${t.category}`)
    );

    const eligibleTransactions = recentTransactions.filter(
      (t) =>
        t.propertyId && !templatePropertyCategories.has(`${t.propertyId}:${t.category}`)
    );

    return detectPatterns(eligibleTransactions);
  }),

  // Run matching for pending expected transactions
  runMatching: writeProcedure.mutation(async ({ ctx }) => {
    // Get pending expected transactions
    const pending = await ctx.db.query.expectedTransactions.findMany({
      where: and(
        eq(expectedTransactions.userId, ctx.portfolio.ownerId),
        eq(expectedTransactions.status, "pending")
      ),
      with: {
        recurringTransaction: true,
      },
    });

    // Get unmatched transactions (not linked to any expected transaction)
    const matchedIds = pending
      .filter((p) => p.matchedTransactionId)
      .map((p) => p.matchedTransactionId!);

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
        // Auto-match high confidence
        await ctx.db
          .update(expectedTransactions)
          .set({
            status: "matched",
            matchedTransactionId: matches[0].transaction.id,
          })
          .where(eq(expectedTransactions.id, expected.id));

        // Apply template to transaction
        await ctx.db
          .update(transactions)
          .set({
            category: expected.recurringTransaction.category,
            transactionType: expected.recurringTransaction.transactionType,
            propertyId: expected.propertyId,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, matches[0].transaction.id));

        results.push({
          expectedId: expected.id,
          matchedTransactionId: matches[0].transaction.id,
          confidence: "high",
        });
      } else if (matches.length > 0) {
        // Flag for review
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

    return results;
  }),
});
