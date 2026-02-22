import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  DEFAULT_LVR_THRESHOLDS,
  DEFAULT_EQUITY_THRESHOLDS,
} from "../../services/notification";

export const milestonePreferencesRouter = router({
  getGlobal: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.uow.user.findMilestonePrefs(ctx.portfolio.ownerId);

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
      return ctx.uow.user.upsertMilestonePrefs(ctx.portfolio.ownerId, input);
    }),

  getPropertyOverride: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.user.findPropertyOverride(input.propertyId);
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
      return ctx.uow.user.upsertPropertyOverride(propertyId, data);
    }),

  deletePropertyOverride: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.user.deletePropertyOverride(input.propertyId);
      return { success: true };
    }),

  /** Get IDs of achievement milestones the user has been celebrated for */
  getAchievedMilestones: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.user.getAchievedMilestones(ctx.portfolio.ownerId);
  }),

  /** Record newly achieved milestones so they are not shown again */
  recordAchievedMilestones: writeProcedure
    .input(z.object({ milestoneIds: z.array(z.string().min(1)) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.user.addAchievedMilestones(
        ctx.portfolio.ownerId,
        input.milestoneIds,
      );
    }),
});
