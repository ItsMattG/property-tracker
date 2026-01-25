import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { loanComparisons } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
  generateAmortizationSchedule,
} from "../services/loan-comparison";
import { getEstimatedMarketRate } from "../services/rate-data";

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
        newRate: z.string().regex(/^\d+\.?\d*$/),
        newLender: z.string().optional(),
        switchingCosts: z.string().regex(/^\d+\.?\d*$/).default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comparison] = await ctx.db
        .insert(loanComparisons)
        .values({
          userId: ctx.portfolio.ownerId,
          loanId: input.loanId,
          name: input.name,
          newRate: input.newRate,
          newLender: input.newLender || null,
          switchingCosts: input.switchingCosts,
        })
        .returning();

      return comparison;
    }),

  listComparisons: protectedProcedure
    .input(z.object({ loanId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(loanComparisons.userId, ctx.portfolio.ownerId)];

      if (input?.loanId) {
        conditions.push(eq(loanComparisons.loanId, input.loanId));
      }

      return ctx.db.query.loanComparisons.findMany({
        where: and(...conditions),
        with: {
          loan: {
            with: {
              property: true,
            },
          },
        },
        orderBy: (lc, { desc }) => [desc(lc.createdAt)],
      });
    }),

  deleteComparison: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(loanComparisons)
        .where(
          and(
            eq(loanComparisons.id, input.id),
            eq(loanComparisons.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),
});
