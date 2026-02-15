import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { milestonePreferences, propertyMilestoneOverrides } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_LVR_THRESHOLDS,
  DEFAULT_EQUITY_THRESHOLDS,
} from "../../services/notification";

export const milestonePreferencesRouter = router({
  getGlobal: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.milestonePreferences.findFirst({
      where: eq(milestonePreferences.userId, ctx.portfolio.ownerId),
    });

    return prefs ?? {
      userId: ctx.portfolio.ownerId,
      lvrThresholds: [...DEFAULT_LVR_THRESHOLDS],
      equityThresholds: [...DEFAULT_EQUITY_THRESHOLDS],
      enabled: true,
    };
  }),

  updateGlobal: writeProcedure
    .input(
      z.object({
        lvrThresholds: z.array(z.number().min(0).max(100)).optional(),
        equityThresholds: z.array(z.number().min(0)).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.milestonePreferences.findFirst({
        where: eq(milestonePreferences.userId, ctx.portfolio.ownerId),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(milestonePreferences)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(milestonePreferences.userId, ctx.portfolio.ownerId))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(milestonePreferences)
        .values({
          userId: ctx.portfolio.ownerId,
          lvrThresholds: input.lvrThresholds ?? [...DEFAULT_LVR_THRESHOLDS],
          equityThresholds: input.equityThresholds ?? [...DEFAULT_EQUITY_THRESHOLDS],
          enabled: input.enabled ?? true,
        })
        .returning();
      return created;
    }),

  getPropertyOverride: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.propertyMilestoneOverrides.findFirst({
        where: eq(propertyMilestoneOverrides.propertyId, input.propertyId),
      });
    }),

  updatePropertyOverride: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        lvrThresholds: z.array(z.number().min(0).max(100)).nullable().optional(),
        equityThresholds: z.array(z.number().min(0)).nullable().optional(),
        enabled: z.boolean().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, ...data } = input;

      const existing = await ctx.db.query.propertyMilestoneOverrides.findFirst({
        where: eq(propertyMilestoneOverrides.propertyId, propertyId),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(propertyMilestoneOverrides)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(propertyMilestoneOverrides.propertyId, propertyId))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(propertyMilestoneOverrides)
        .values({
          propertyId,
          lvrThresholds: data.lvrThresholds ?? null,
          equityThresholds: data.equityThresholds ?? null,
          enabled: data.enabled ?? null,
        })
        .returning();
      return created;
    }),

  deletePropertyOverride: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(propertyMilestoneOverrides)
        .where(eq(propertyMilestoneOverrides.propertyId, input.propertyId));
      return { success: true };
    }),
});
