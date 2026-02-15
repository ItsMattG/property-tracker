import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";

export const anomalyRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "dismissed", "resolved"]).optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        propertyId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.bankAccount.findAnomalyAlerts(ctx.portfolio.ownerId, {
        status: input?.status,
        severity: input?.severity,
        propertyId: input?.propertyId,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const alert = await ctx.uow.bankAccount.findAnomalyAlertById(input.id, ctx.portfolio.ownerId);

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),

  getActiveCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.bankAccount.getAnomalyAlertCounts(ctx.portfolio.ownerId);
  }),

  dismiss: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.bankAccount.findAnomalyAlertById(input.id, ctx.portfolio.ownerId);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      const alert = await ctx.uow.bankAccount.updateAnomalyAlertStatus(input.id, ctx.portfolio.ownerId, {
        status: "dismissed",
        dismissedAt: new Date(),
        dismissalCount: String(parseInt(existing.dismissalCount) + 1),
      });

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),

  bulkDismiss: writeProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.bankAccount.bulkUpdateAnomalyAlertStatus(input.ids, ctx.portfolio.ownerId, {
        status: "dismissed",
        dismissedAt: new Date(),
      });

      return { dismissed: input.ids.length };
    }),

  resolve: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.uow.bankAccount.updateAnomalyAlertStatus(input.id, ctx.portfolio.ownerId, {
        status: "resolved",
        resolvedAt: new Date(),
      });

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),
});
