import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { anomalyAlerts } from "../db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
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
      const conditions = [eq(anomalyAlerts.userId, ctx.user.id)];

      if (input?.status) {
        conditions.push(eq(anomalyAlerts.status, input.status));
      }
      if (input?.severity) {
        conditions.push(eq(anomalyAlerts.severity, input.severity));
      }
      if (input?.propertyId) {
        conditions.push(eq(anomalyAlerts.propertyId, input.propertyId));
      }

      const alerts = await ctx.db.query.anomalyAlerts.findMany({
        where: and(...conditions),
        with: {
          property: true,
          transaction: true,
        },
        orderBy: [desc(anomalyAlerts.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });

      return alerts;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const alert = await ctx.db.query.anomalyAlerts.findFirst({
        where: and(
          eq(anomalyAlerts.id, input.id),
          eq(anomalyAlerts.userId, ctx.user.id)
        ),
        with: {
          property: true,
          transaction: true,
          recurringTransaction: true,
          expectedTransaction: true,
        },
      });

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),

  getActiveCount: protectedProcedure.query(async ({ ctx }) => {
    const alerts = await ctx.db.query.anomalyAlerts.findMany({
      where: and(
        eq(anomalyAlerts.userId, ctx.user.id),
        eq(anomalyAlerts.status, "active")
      ),
      columns: { severity: true },
    });

    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
    };
  }),

  dismiss: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.anomalyAlerts.findFirst({
        where: and(
          eq(anomalyAlerts.id, input.id),
          eq(anomalyAlerts.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      const [alert] = await ctx.db
        .update(anomalyAlerts)
        .set({
          status: "dismissed",
          dismissedAt: new Date(),
          dismissalCount: String(parseInt(existing.dismissalCount) + 1),
        })
        .where(eq(anomalyAlerts.id, input.id))
        .returning();

      return alert;
    }),

  bulkDismiss: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(anomalyAlerts)
        .set({
          status: "dismissed",
          dismissedAt: new Date(),
        })
        .where(
          and(
            inArray(anomalyAlerts.id, input.ids),
            eq(anomalyAlerts.userId, ctx.user.id)
          )
        );

      return { dismissed: input.ids.length };
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [alert] = await ctx.db
        .update(anomalyAlerts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(anomalyAlerts.id, input.id),
            eq(anomalyAlerts.userId, ctx.user.id)
          )
        )
        .returning();

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),
});
