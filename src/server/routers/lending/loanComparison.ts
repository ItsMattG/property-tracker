import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { positiveAmountSchema } from "@/lib/validation";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
  generateAmortizationSchedule,
} from "../../services/lending";
import { getEstimatedMarketRate } from "../../services/lending/rate-data";

export const loanComparisonRouter = router({
  calculate: protectedProcedure
    .input(
      z.object({
        principal: z.number().positive(),
        currentRate: z.number().min(0),
        newRate: z.number().min(0),
        remainingMonths: z.number().int().positive(),
        switchingCosts: z.number().min(0).default(0),
      })
    )
    .query(({ input }) => {
      const monthlySavings = calculateMonthlySavings(
        input.principal,
        input.currentRate,
        input.newRate,
        input.remainingMonths
      );

      const totalInterestSaved = calculateTotalInterestSaved(
        input.principal,
        input.currentRate,
        input.newRate,
        input.remainingMonths
      );

      const breakEvenMonths = calculateBreakEvenMonths(
        monthlySavings,
        input.switchingCosts
      );

      const currentSchedule = generateAmortizationSchedule(
        input.principal,
        input.currentRate,
        input.remainingMonths
      );

      const newSchedule = generateAmortizationSchedule(
        input.principal,
        input.newRate,
        input.remainingMonths
      );

      return {
        monthlySavings,
        totalInterestSaved,
        breakEvenMonths,
        currentSchedule,
        newSchedule,
      };
    }),

  getMarketRate: protectedProcedure
    .input(
      z.object({
        purpose: z.enum(["owner_occupied", "investor"]),
        repaymentType: z.enum(["principal_and_interest", "interest_only"]),
        lvr: z.number().min(0).max(100),
      })
    )
    .query(async ({ input }) => {
      const rate = await getEstimatedMarketRate(
        input.purpose,
        input.repaymentType,
        input.lvr
      );

      return { estimatedRate: rate };
    }),

  saveComparison: writeProcedure
    .input(
      z.object({
        loanId: z.string().uuid(),
        name: z.string().min(1),
        newRate: positiveAmountSchema,
        newLender: z.string().optional(),
        switchingCosts: positiveAmountSchema.default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.loan.createComparison({
        userId: ctx.portfolio.ownerId,
        loanId: input.loanId,
        name: input.name,
        newRate: input.newRate,
        newLender: input.newLender || null,
        switchingCosts: input.switchingCosts,
      });
    }),

  listComparisons: protectedProcedure
    .input(z.object({ loanId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.uow.loan.findComparisonsByOwner(ctx.portfolio.ownerId, input?.loanId);
    }),

  deleteComparison: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.loan.deleteComparison(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  getAlertConfig: protectedProcedure
    .input(z.object({ loanId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.uow.loan.findById(input.loanId, ctx.portfolio.ownerId);

      if (!loan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Loan not found" });
      }

      const config = await ctx.uow.loan.findRefinanceAlert(input.loanId);

      return config || {
        loanId: input.loanId,
        enabled: false,
        rateGapThreshold: "0.50",
        notifyOnCashRateChange: true,
        lastAlertedAt: null,
      };
    }),

  updateAlertConfig: writeProcedure
    .input(
      z.object({
        loanId: z.string().uuid(),
        enabled: z.boolean(),
        rateGapThreshold: positiveAmountSchema,
        notifyOnCashRateChange: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.uow.loan.findById(input.loanId, ctx.portfolio.ownerId);

      if (!loan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Loan not found" });
      }

      return ctx.uow.loan.upsertRefinanceAlert(input.loanId, {
        enabled: input.enabled,
        rateGapThreshold: input.rateGapThreshold,
        notifyOnCashRateChange: input.notifyOnCashRateChange,
      });
    }),
});
