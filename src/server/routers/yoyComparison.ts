import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildYoYComparison } from "../services/transaction";

export const yoyComparisonRouter = router({
  getComparison: protectedProcedure
    .input(
      z.object({
        currentYear: z.number().min(2020).max(2030),
        comparisonYear: z.number().min(2020).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildYoYComparison(
        ctx.portfolio.ownerId,
        input.currentYear,
        input.comparisonYear,
      );
    }),
});
