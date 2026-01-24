import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
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
      const conditions = [eq(loans.userId, ctx.user.id)];

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
        where: and(eq(loans.id, input.id), eq(loans.userId, ctx.user.id)),
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

  create: protectedProcedure.input(loanSchema).mutation(async ({ ctx, input }) => {
    const [loan] = await ctx.db
      .insert(loans)
      .values({
        userId: ctx.user.id,
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

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).merge(loanSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [loan] = await ctx.db
        .update(loans)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(loans.id, id), eq(loans.userId, ctx.user.id)))
        .returning();

      return loan;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(loans)
        .where(and(eq(loans.id, input.id), eq(loans.userId, ctx.user.id)));

      return { success: true };
    }),

  updateBalance: protectedProcedure
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
        .where(and(eq(loans.id, input.id), eq(loans.userId, ctx.user.id)))
        .returning();

      return loan;
    }),
});
