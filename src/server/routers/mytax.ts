import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildMyTaxReport } from "../services/mytax";

export const mytaxRouter = router({
  getReport: protectedProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildMyTaxReport(ctx.portfolio.ownerId, input.year);
    }),
});
