import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { transactions, transactionNotes } from "../db/schema";
import { eq, and, desc, gte, lte, inArray, sql, count } from "drizzle-orm";
import { parseCSV } from "../services/csv-import";
import { metrics } from "@/lib/metrics";
import { getCategoryLabel } from "@/lib/categories";

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
        bankAccountId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transactions.userId, ctx.portfolio.ownerId)];

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
      if (input.bankAccountId) {
        conditions.push(eq(transactions.bankAccountId, input.bankAccountId));
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

  exportCSV: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        category: z.enum(categoryValues).optional(),
        isVerified: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        bankAccountId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transactions.userId, ctx.portfolio.ownerId)];

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
      if (input.bankAccountId) {
        conditions.push(eq(transactions.bankAccountId, input.bankAccountId));
      }

      const results = await ctx.db.query.transactions.findMany({
        where: and(...conditions),
        orderBy: [desc(transactions.date)],
        with: {
          property: true,
        },
      });

      const header = "Date,Description,Amount,Category,Transaction Type,Property,Is Deductible,Is Verified,Notes";
      const rows = results.map((t) => {
        const escapeCsv = (val: string) => {
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        return [
          t.date,
          escapeCsv(t.description),
          t.amount,
          getCategoryLabel(t.category),
          t.transactionType,
          t.property?.address ?? "",
          t.isDeductible ? "Yes" : "No",
          t.isVerified ? "Yes" : "No",
          escapeCsv(t.notes ?? ""),
        ].join(",");
      });

      const csv = [header, ...rows].join("\n");
      const today = new Date().toISOString().split("T")[0];
      const filename = `bricktrack-transactions-${today}.csv`;

      return { csv, filename };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const transaction = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.userId, ctx.portfolio.ownerId)
        ),
      });
      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }
      return transaction;
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        propertyId: z.string().uuid(),
        date: z.string(),
        description: z.string().min(1, "Description is required"),
        amount: z.string().regex(/^-?\d+\.?\d*$/, "Invalid amount"),
        category: z.enum(categoryValues).default("uncategorized"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const numericAmount = parseFloat(data.amount);

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
      if (incomeCategories.includes(data.category)) {
        transactionType = "income";
      } else if (capitalCategories.includes(data.category)) {
        transactionType = "capital";
      } else if (data.category === "transfer") {
        transactionType = "transfer";
      } else if (data.category === "personal") {
        transactionType = "personal";
      }

      const isDeductible = !nonDeductibleCategories.includes(data.category);

      const [transaction] = await ctx.db
        .update(transactions)
        .set({
          propertyId: data.propertyId,
          date: data.date,
          description: data.description,
          amount: String(numericAmount),
          category: data.category,
          transactionType,
          isDeductible,
          notes: data.notes,
          updatedAt: new Date(),
        })
        .where(
          and(eq(transactions.id, id), eq(transactions.userId, ctx.portfolio.ownerId))
        )
        .returning();

      return transaction;
    }),

  updateCategory: writeProcedure
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
          eq(transactions.userId, ctx.portfolio.ownerId)
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
          and(eq(transactions.id, input.id), eq(transactions.userId, ctx.portfolio.ownerId))
        )
        .returning();

      // Track category override for monitoring
      if (existingTx && existingTx.category !== input.category) {
        metrics.categorizationOverride(input.id, existingTx.category, input.category);
      }

      return transaction;
    }),

  bulkUpdateCategory: writeProcedure
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
            eq(transactions.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true, count: input.ids.length };
    }),

  toggleVerified: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.userId, ctx.portfolio.ownerId)
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

  updateNotes: writeProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [transaction] = await ctx.db
        .update(transactions)
        .set({
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(
          and(eq(transactions.id, input.id), eq(transactions.userId, ctx.portfolio.ownerId))
        )
        .returning();

      return transaction;
    }),

  create: writeProcedure
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
          userId: ctx.portfolio.ownerId,
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

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(transactions)
        .where(
          and(eq(transactions.id, input.id), eq(transactions.userId, ctx.portfolio.ownerId))
        );

      return { success: true };
    }),

  importCSV: writeProcedure
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
              userId: ctx.portfolio.ownerId,
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

  importRichCSV: writeProcedure
    .input(
      z.object({
        rows: z.array(
          z.object({
            date: z.string(),
            description: z.string().min(1),
            amount: z.number(),
            propertyId: z.string().uuid(),
            category: z.enum(categoryValues),
            transactionType: z.enum(["income", "expense", "capital", "transfer", "personal"]),
            isDeductible: z.boolean(),
            notes: z.string().nullable(),
            invoiceUrl: z.string().nullable(),
            invoicePresent: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const imported: string[] = [];
      const errors: string[] = [];

      for (const row of input.rows) {
        try {
          const [transaction] = await ctx.db
            .insert(transactions)
            .values({
              userId: ctx.portfolio.ownerId,
              propertyId: row.propertyId,
              date: row.date,
              description: row.description,
              amount: row.amount.toString(),
              category: row.category,
              transactionType: row.transactionType,
              isDeductible: row.isDeductible,
              notes: row.notes,
              invoiceUrl: row.invoiceUrl,
              invoicePresent: row.invoicePresent,
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

  allocate: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        category: z.enum(categoryValues),
        propertyId: z.string().uuid().optional(),
        claimPercent: z.number().min(0).max(100).default(100),
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
        .update(transactions)
        .set({
          category: input.category,
          transactionType,
          isDeductible,
          propertyId: input.propertyId ?? null,
          claimPercent: String(input.claimPercent),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactions.id, input.id),
            eq(transactions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      return transaction;
    }),

  // Discussion notes CRUD
  listNotes: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify the transaction belongs to this user
      const tx = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.transactionId),
          eq(transactions.userId, ctx.portfolio.ownerId)
        ),
      });
      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      const notes = await ctx.db.query.transactionNotes.findMany({
        where: eq(transactionNotes.transactionId, input.transactionId),
        orderBy: [desc(transactionNotes.createdAt)],
        with: {
          user: {
            columns: { id: true, name: true },
          },
        },
      });
      return notes;
    }),

  addNote: writeProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
        content: z.string().min(1, "Note content is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the transaction belongs to this user
      const tx = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.transactionId),
          eq(transactions.userId, ctx.portfolio.ownerId)
        ),
      });
      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      const [note] = await ctx.db
        .insert(transactionNotes)
        .values({
          transactionId: input.transactionId,
          userId: ctx.portfolio.ownerId,
          content: input.content,
        })
        .returning();

      return note;
    }),

  updateNote: writeProcedure
    .input(
      z.object({
        noteId: z.string().uuid(),
        content: z.string().min(1, "Note content is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [note] = await ctx.db
        .update(transactionNotes)
        .set({
          content: input.content,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactionNotes.id, input.noteId),
            eq(transactionNotes.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!note) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      return note;
    }),

  deleteNote: writeProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(transactionNotes)
        .where(
          and(
            eq(transactionNotes.id, input.noteId),
            eq(transactionNotes.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),
});
