import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildTaxForecast } from "../services/transaction";

export const taxForecastRouter = router({
  getForecast: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().min(2020).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildTaxForecast(ctx.portfolio.ownerId, input.financialYear);
    }),
});
