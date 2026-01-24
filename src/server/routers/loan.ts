import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { loans } from "../db/schema";
import { eq, and } from "drizzle-orm";

const loanSchema = z.object({
  propertyId: z.string().uuid(),
  lender: z.string().min(1, "Lender is required"),
  accountNumberMasked: z.string().optional(),
  loanType: z.enum(["principal_and_interest", "interest_only"]),
  rateType: z.enum(["variable", "fixed", "split"]),
  originalAmount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  currentBalance: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  interestRate: z.string().regex(/^\d+\.?\d*$/, "Invalid rate"),
  fixedRateExpiry: z.string().optional(),
  repaymentAmount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  repaymentFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
  offsetAccountId: z.string().uuid().optional(),
});

export const loanRouter = router({
  list: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(loans.userId, ctx.portfolio.ownerId)];

      if (input?.propertyId) {
        conditions.push(eq(loans.propertyId, input.propertyId));
      }

      return ctx.db.query.loans.findMany({
        where: and(...conditions),
        with: {
          property: true,
          offsetAccount: true,
        },
        orderBy: (loans, { desc }) => [desc(loans.createdAt)],
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.db.query.loans.findFirst({
        where: and(eq(loans.id, input.id), eq(loans.userId, ctx.portfolio.ownerId)),
        with: {
          property: true,
          offsetAccount: true,
        },
      });

      if (!loan) {
        throw new Error("Loan not found");
      }

      return loan;
    }),

  create: writeProcedure.input(loanSchema).mutation(async ({ ctx, input }) => {
    const [loan] = await ctx.db
      .insert(loans)
      .values({
        userId: ctx.portfolio.ownerId,
        propertyId: input.propertyId,
        lender: input.lender,
        accountNumberMasked: input.accountNumberMasked,
        loanType: input.loanType,
        rateType: input.rateType,
        originalAmount: input.originalAmount,
        currentBalance: input.currentBalance,
        interestRate: input.interestRate,
        fixedRateExpiry: input.fixedRateExpiry || null,
        repaymentAmount: input.repaymentAmount,
        repaymentFrequency: input.repaymentFrequency,
        offsetAccountId: input.offsetAccountId || null,
      })
      .returning();

    return loan;
  }),

  update: writeProcedure
    .input(z.object({ id: z.string().uuid() }).merge(loanSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [loan] = await ctx.db
        .update(loans)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(loans.id, id), eq(loans.userId, ctx.portfolio.ownerId)))
        .returning();

      return loan;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(loans)
        .where(and(eq(loans.id, input.id), eq(loans.userId, ctx.portfolio.ownerId)));

      return { success: true };
    }),

  updateBalance: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        currentBalance: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [loan] = await ctx.db
        .update(loans)
        .set({
          currentBalance: input.currentBalance,
          updatedAt: new Date(),
        })
        .where(and(eq(loans.id, input.id), eq(loans.userId, ctx.portfolio.ownerId)))
        .returning();

      return loan;
    }),
});
