import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildAuditReport } from "../services/audit-checks";

export const auditChecksRouter = router({
  getReport: protectedProcedure
    .input(
      z.object({
        year: z.number().min(2020).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildAuditReport(ctx.portfolio.ownerId, input.year);
    }),
});
