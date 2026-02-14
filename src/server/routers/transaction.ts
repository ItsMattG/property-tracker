import { z } from "zod";
import { signedAmountSchema } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { transactionNotes } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
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

/** Derive transaction type and deductibility from a category */
function deriveTransactionFields(category: string) {
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
  if (incomeCategories.includes(category)) {
    transactionType = "income";
  } else if (capitalCategories.includes(category)) {
    transactionType = "capital";
  } else if (category === "transfer") {
    transactionType = "transfer";
  } else if (category === "personal") {
    transactionType = "personal";
  }

  const isDeductible = !nonDeductibleCategories.includes(category);

  return { transactionType, isDeductible };
}

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
      return ctx.uow.transactions.findByOwner(ctx.portfolio.ownerId, input);
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
      const results = await ctx.uow.transactions.findAllByOwner(ctx.portfolio.ownerId, input);

      const header = "Date,Description,Amount,Category,Transaction Type,Property,Is Deductible,Is Verified,Notes";
      const rows = results.map((t) => {
        const escapeCsv = (val: string) => {
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        const prop = t.property as { address?: string } | null | undefined;
        return [
          t.date,
          escapeCsv(t.description),
          t.amount,
          getCategoryLabel(t.category),
          t.transactionType,
          prop?.address ?? "",
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
      const transaction = await ctx.uow.transactions.findById(input.id, ctx.portfolio.ownerId);
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
        amount: signedAmountSchema,
        category: z.enum(categoryValues).default("uncategorized"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const numericAmount = parseFloat(data.amount);
      const { transactionType, isDeductible } = deriveTransactionFields(data.category);

      const transaction = await ctx.uow.transactions.update(id, ctx.portfolio.ownerId, {
        propertyId: data.propertyId,
        date: data.date,
        description: data.description,
        amount: String(numericAmount),
        category: data.category,
        transactionType,
        isDeductible,
        notes: data.notes,
        updatedAt: new Date(),
      });

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
      const existingTx = await ctx.uow.transactions.findById(input.id, ctx.portfolio.ownerId);
      const { transactionType, isDeductible } = deriveTransactionFields(input.category);

      const transaction = await ctx.uow.transactions.update(input.id, ctx.portfolio.ownerId, {
        category: input.category,
        transactionType,
        isDeductible,
        propertyId: input.propertyId,
        updatedAt: new Date(),
      });

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
      const { transactionType, isDeductible } = deriveTransactionFields(input.category);

      await ctx.uow.transactions.updateMany(input.ids, ctx.portfolio.ownerId, {
        category: input.category,
        transactionType,
        isDeductible,
        propertyId: input.propertyId,
        updatedAt: new Date(),
      });

      return { success: true, count: input.ids.length };
    }),

  toggleVerified: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.transactions.findById(input.id, ctx.portfolio.ownerId);

      if (!existing) {
        throw new Error("Transaction not found");
      }

      const transaction = await ctx.uow.transactions.update(input.id, ctx.portfolio.ownerId, {
        isVerified: !existing.isVerified,
        updatedAt: new Date(),
      });

      return transaction;
    }),

  updateNotes: writeProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.uow.transactions.update(input.id, ctx.portfolio.ownerId, {
        notes: input.notes,
        updatedAt: new Date(),
      });

      return transaction;
    }),

  create: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        date: z.string(),
        description: z.string().min(1, "Description is required"),
        amount: signedAmountSchema,
        category: z.enum(categoryValues).default("uncategorized"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionType, isDeductible } = deriveTransactionFields(input.category);

      const transaction = await ctx.uow.transactions.create({
        userId: ctx.portfolio.ownerId,
        propertyId: input.propertyId,
        date: input.date,
        description: input.description,
        amount: input.amount,
        category: input.category,
        transactionType,
        isDeductible,
        notes: input.notes,
      });

      return transaction;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.transactions.delete(input.id, ctx.portfolio.ownerId);

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
          const transaction = await ctx.uow.transactions.create({
            userId: ctx.portfolio.ownerId,
            propertyId: input.propertyId,
            date: row.date,
            description: row.description,
            amount: row.amount,
            category: "uncategorized",
            transactionType: parseFloat(row.amount) >= 0 ? "income" : "expense",
            isDeductible: false,
          });

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
            propertyId: z.string().uuid().nullable(),
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
          const transaction = await ctx.uow.transactions.create({
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
          });

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
      const { transactionType, isDeductible } = deriveTransactionFields(input.category);

      const transaction = await ctx.uow.transactions.update(input.id, ctx.portfolio.ownerId, {
        category: input.category,
        transactionType,
        isDeductible,
        propertyId: input.propertyId ?? null,
        claimPercent: String(input.claimPercent),
        updatedAt: new Date(),
      });

      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      return transaction;
    }),

  // Discussion notes CRUD — transactionNotes stay as direct db calls (no notes repository)
  listNotes: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify the transaction belongs to this user
      const tx = await ctx.uow.transactions.findById(input.transactionId, ctx.portfolio.ownerId);
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
      const tx = await ctx.uow.transactions.findById(input.transactionId, ctx.portfolio.ownerId);
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
