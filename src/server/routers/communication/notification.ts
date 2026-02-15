import { z } from "zod";
import { timeSchema } from "@/lib/validation";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { getDefaultPreferences } from "../../services/notification";

export const notificationRouter = router({
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    let prefs = await ctx.uow.notification.findPreferences(ctx.portfolio.ownerId);
    if (!prefs) {
      const defaults = getDefaultPreferences();
      prefs = await ctx.uow.notification.createPreferences({
        userId: ctx.portfolio.ownerId,
        ...defaults,
      });
    }
    return prefs;
  }),

  updatePreferences: writeProcedure
    .input(
      z.object({
        emailEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        rentReceived: z.boolean().optional(),
        syncFailed: z.boolean().optional(),
        anomalyDetected: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
        quietHoursStart: timeSchema.optional(),
        quietHoursEnd: timeSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.notification.findPreferences(ctx.portfolio.ownerId);
      if (!existing) {
        const defaults = getDefaultPreferences();
        return ctx.uow.notification.createPreferences({
          userId: ctx.portfolio.ownerId,
          ...defaults,
          ...input,
        });
      }
      return ctx.uow.notification.updatePreferences(ctx.portfolio.ownerId, input);
    }),

  registerPushSubscription: writeProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.notification.findPushSubscription(
        ctx.portfolio.ownerId,
        input.endpoint
      );
      if (existing) return existing;
      return ctx.uow.notification.createPushSubscription({
        userId: ctx.portfolio.ownerId,
        ...input,
      });
    }),

  unregisterPushSubscription: writeProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.notification.deletePushSubscription(ctx.portfolio.ownerId, input.endpoint);
      return { success: true };
    }),

  listPushSubscriptions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.notification.listPushSubscriptions(ctx.portfolio.ownerId);
  }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.notification.findNotificationLog(ctx.portfolio.ownerId, input.limit);
    }),

  getVapidPublicKey: protectedProcedure.query(() => {
    return process.env.VAPID_PUBLIC_KEY || null;
  }),
});
