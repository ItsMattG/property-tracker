import { z } from "zod";
import { signedAmountSchema } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { parseCSV } from "../services/banking";
import { categoryValues, deriveTransactionFields, formatTransactionsCSV, importCSVRows, importRichCSVRows } from "../services/transaction";
import { metrics } from "@/lib/metrics";

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
      return formatTransactionsCSV(results);
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
      return importCSVRows(ctx.uow.transactions, ctx.portfolio.ownerId, input.propertyId, rows);
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
      return importRichCSVRows(ctx.uow.transactions, ctx.portfolio.ownerId, input.rows);
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

  // Discussion notes CRUD
  listNotes: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify the transaction belongs to this user
      const tx = await ctx.uow.transactions.findById(input.transactionId, ctx.portfolio.ownerId);
      if (!tx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      return ctx.uow.transactions.listNotes(input.transactionId);
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

      return ctx.uow.transactions.addNote(input.transactionId, ctx.portfolio.ownerId, input.content);
    }),

  updateNote: writeProcedure
    .input(
      z.object({
        noteId: z.string().uuid(),
        content: z.string().min(1, "Note content is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.uow.transactions.updateNote(input.noteId, ctx.portfolio.ownerId, input.content);

      if (!note) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      return note;
    }),

  deleteNote: writeProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.transactions.deleteNote(input.noteId, ctx.portfolio.ownerId);

      return { success: true };
    }),
});
