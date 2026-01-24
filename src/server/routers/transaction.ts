import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { transactions } from "../db/schema";
import { eq, and, desc, gte, lte, inArray, sql, count } from "drizzle-orm";
import { parseCSV } from "../services/csv-import";
import { metrics } from "@/lib/metrics";

const categoryValues = [
  "rental_income",
  "other_rental_income",
  "advertising",
  "body_corporate",
  "borrowing_expenses",
  "cleaning",
  "council_rates",
  "gardening",
  "insurance",
  "interest_on_loans",
  "land_tax",
  "legal_expenses",
  "pest_control",
  "property_agent_fees",
  "repairs_and_maintenance",
  "capital_works_deductions",
  "stationery_and_postage",
  "travel_expenses",
  "water_charges",
  "sundry_rental_expenses",
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
  "transfer",
  "personal",
  "uncategorized",
] as const;

export const transactionRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        category: z.enum(categoryValues).optional(),
        isVerified: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transactions.userId, ctx.user.id)];

      if (input.propertyId) {
        conditions.push(eq(transactions.propertyId, input.propertyId));
      }
      if (input.category) {
        conditions.push(eq(transactions.category, input.category));
      }
      if (input.isVerified !== undefined) {
        conditions.push(eq(transactions.isVerified, input.isVerified));
      }
      if (input.startDate) {
        conditions.push(gte(transactions.date, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(transactions.date, input.endDate));
      }

      const whereClause = and(...conditions);

      // Get paginated results
      const results = await ctx.db.query.transactions.findMany({
        where: whereClause,
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
        .where(whereClause);

      const hasMore = input.offset + results.length < total;

      return {
        transactions: results,
        total,
        hasMore,
      };
    }),

  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        category: z.enum(categoryValues),
        propertyId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing transaction to track category changes
      const existingTx = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.userId, ctx.user.id)
        ),
        columns: { category: true },
      });

      // Determine transaction type and deductibility based on category
      const incomeCategories = ["rental_income", "other_rental_income"];
      const capitalCategories = [
        "stamp_duty",
        "conveyancing",
        "buyers_agent_fees",
        "initial_repairs",
      ];
      const nonDeductibleCategories = [
        ...capitalCategories,
        "transfer",
        "personal",
        "uncategorized",
      ];

      let transactionType: "income" | "expense" | "capital" | "transfer" | "personal" =
        "expense";
      if (incomeCategories.includes(input.category)) {
        transactionType = "income";
      } else if (capitalCategories.includes(input.category)) {
        transactionType = "capital";
      } else if (input.category === "transfer") {
        transactionType = "transfer";
      } else if (input.category === "personal") {
        transactionType = "personal";
      }

      const isDeductible = !nonDeductibleCategories.includes(input.category);

      const [transaction] = await ctx.db
        .update(transactions)
        .set({
          category: input.category,
          transactionType,
          isDeductible,
          propertyId: input.propertyId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id))
        )
        .returning();

      // Track category override for monitoring
      if (existingTx && existingTx.category !== input.category) {
        metrics.categorizationOverride(input.id, existingTx.category, input.category);
      }

      return transaction;
    }),

  bulkUpdateCategory: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()),
        category: z.enum(categoryValues),
        propertyId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incomeCategories = ["rental_income", "other_rental_income"];
      const capitalCategories = [
        "stamp_duty",
        "conveyancing",
        "buyers_agent_fees",
        "initial_repairs",
      ];
      const nonDeductibleCategories = [
        ...capitalCategories,
        "transfer",
        "personal",
        "uncategorized",
      ];

      let transactionType: "income" | "expense" | "capital" | "transfer" | "personal" =
        "expense";
      if (incomeCategories.includes(input.category)) {
        transactionType = "income";
      } else if (capitalCategories.includes(input.category)) {
        transactionType = "capital";
      } else if (input.category === "transfer") {
        transactionType = "transfer";
      } else if (input.category === "personal") {
        transactionType = "personal";
      }

      const isDeductible = !nonDeductibleCategories.includes(input.category);

      await ctx.db
        .update(transactions)
        .set({
          category: input.category,
          transactionType,
          isDeductible,
          propertyId: input.propertyId,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(transactions.id, input.ids),
            eq(transactions.userId, ctx.user.id)
          )
        );

      return { success: true, count: input.ids.length };
    }),

  toggleVerified: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new Error("Transaction not found");
      }

      const [transaction] = await ctx.db
        .update(transactions)
        .set({
          isVerified: !existing.isVerified,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, input.id))
        .returning();

      return transaction;
    }),

  updateNotes: protectedProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [transaction] = await ctx.db
        .update(transactions)
        .set({
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(
          and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id))
        )
        .returning();

      return transaction;
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        date: z.string(),
        description: z.string().min(1, "Description is required"),
        amount: z.string().regex(/^-?\d+\.?\d*$/, "Invalid amount"),
        category: z.enum(categoryValues).default("uncategorized"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const incomeCategories = ["rental_income", "other_rental_income"];
      const capitalCategories = [
        "stamp_duty",
        "conveyancing",
        "buyers_agent_fees",
        "initial_repairs",
      ];
      const nonDeductibleCategories = [
        ...capitalCategories,
        "transfer",
        "personal",
        "uncategorized",
      ];

      let transactionType: "income" | "expense" | "capital" | "transfer" | "personal" =
        "expense";
      if (incomeCategories.includes(input.category)) {
        transactionType = "income";
      } else if (capitalCategories.includes(input.category)) {
        transactionType = "capital";
      } else if (input.category === "transfer") {
        transactionType = "transfer";
      } else if (input.category === "personal") {
        transactionType = "personal";
      }

      const isDeductible = !nonDeductibleCategories.includes(input.category);

      const [transaction] = await ctx.db
        .insert(transactions)
        .values({
          userId: ctx.user.id,
          propertyId: input.propertyId,
          date: input.date,
          description: input.description,
          amount: input.amount,
          category: input.category,
          transactionType,
          isDeductible,
          notes: input.notes,
        })
        .returning();

      return transaction;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(transactions)
        .where(
          and(eq(transactions.id, input.id), eq(transactions.userId, ctx.user.id))
        );

      return { success: true };
    }),

  importCSV: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        csvContent: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = parseCSV(input.csvContent);

      const imported: string[] = [];
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const [transaction] = await ctx.db
            .insert(transactions)
            .values({
              userId: ctx.user.id,
              propertyId: input.propertyId,
              date: row.date,
              description: row.description,
              amount: row.amount,
              category: "uncategorized",
              transactionType: parseFloat(row.amount) >= 0 ? "income" : "expense",
              isDeductible: false,
            })
            .returning();

          imported.push(transaction.id);
        } catch (error) {
          errors.push(`Row ${row.date} ${row.description}: ${error}`);
        }
      }

      return {
        importedCount: imported.length,
        errorCount: errors.length,
        errors: errors.slice(0, 5),
      };
    }),
});
