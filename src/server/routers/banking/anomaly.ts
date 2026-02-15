import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { anomalyAlerts } from "../../db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
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
      const conditions = [eq(anomalyAlerts.userId, ctx.portfolio.ownerId)];

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
          eq(anomalyAlerts.userId, ctx.portfolio.ownerId)
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
    const result = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'critical')::int`,
        warning: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'warning')::int`,
        info: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'info')::int`,
      })
      .from(anomalyAlerts)
      .where(
        and(
          eq(anomalyAlerts.userId, ctx.portfolio.ownerId),
          eq(anomalyAlerts.status, "active")
        )
      );

    return {
      total: result[0]?.total ?? 0,
      critical: result[0]?.critical ?? 0,
      warning: result[0]?.warning ?? 0,
      info: result[0]?.info ?? 0,
    };
  }),

  dismiss: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.anomalyAlerts.findFirst({
        where: and(
          eq(anomalyAlerts.id, input.id),
          eq(anomalyAlerts.userId, ctx.portfolio.ownerId)
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

  bulkDismiss: writeProcedure
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
            eq(anomalyAlerts.userId, ctx.portfolio.ownerId)
          )
        );

      return { dismissed: input.ids.length };
    }),

  resolve: writeProcedure
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
            eq(anomalyAlerts.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      return alert;
    }),
});
