import { z } from "zod";
import { positiveAmountSchema } from "@/lib/validation";
import { router, protectedProcedure, writeProcedure } from "../trpc";

const loanSchema = z.object({
  propertyId: z.string().uuid(),
  lender: z.string().min(1, "Lender is required"),
  accountNumberMasked: z.string().optional(),
  loanType: z.enum(["principal_and_interest", "interest_only"]),
  rateType: z.enum(["variable", "fixed", "split"]),
  originalAmount: positiveAmountSchema,
  currentBalance: positiveAmountSchema,
  interestRate: positiveAmountSchema,
  fixedRateExpiry: z.string().optional(),
  repaymentAmount: positiveAmountSchema,
  repaymentFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
  offsetAccountId: z.string().uuid().optional(),
});

const STALE_DAYS = 90;

export const loanRouter = router({
  stale: protectedProcedure.query(async ({ ctx }) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_DAYS);
    return ctx.uow.loan.findStale(ctx.portfolio.ownerId, cutoff);
  }),

  list: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.uow.loan.findByOwner(ctx.portfolio.ownerId, {
        propertyId: input?.propertyId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.uow.loan.findById(input.id, ctx.portfolio.ownerId);

      if (!loan) {
        throw new Error("Loan not found");
      }

      return loan;
    }),

  create: writeProcedure.input(loanSchema).mutation(async ({ ctx, input }) => {
    return ctx.uow.loan.create({
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
    });
  }),

  update: writeProcedure
    .input(z.object({ id: z.string().uuid() }).merge(loanSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.uow.loan.update(id, ctx.portfolio.ownerId, data);
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.loan.delete(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  updateBalance: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        currentBalance: positiveAmountSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.loan.update(input.id, ctx.portfolio.ownerId, {
        currentBalance: input.currentBalance,
      });
    }),
});
