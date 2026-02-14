import { z } from "zod";
import { timeSchema } from "@/lib/validation";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  notificationPreferences,
  pushSubscriptions,
  notificationLog,
} from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getDefaultPreferences } from "../services/notification";

export const notificationRouter = router({
  // Get or create preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    let prefs = await ctx.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, ctx.portfolio.ownerId),
    });

    if (!prefs) {
      const defaults = getDefaultPreferences();
      const [created] = await ctx.db
        .insert(notificationPreferences)
        .values({
          userId: ctx.portfolio.ownerId,
          ...defaults,
        })
        .returning();
      prefs = created;
    }

    return prefs;
  }),

  // Update preferences
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
      // Ensure preferences exist
      const existing = await ctx.db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, ctx.portfolio.ownerId),
      });

      if (!existing) {
        const defaults = getDefaultPreferences();
        const [created] = await ctx.db
          .insert(notificationPreferences)
          .values({
            userId: ctx.portfolio.ownerId,
            ...defaults,
            ...input,
          })
          .returning();
        return created;
      }

      const [updated] = await ctx.db
        .update(notificationPreferences)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, ctx.portfolio.ownerId))
        .returning();

      return updated;
    }),

  // Register push subscription
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
      // Check if subscription already exists
      const existing = await ctx.db.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.userId, ctx.portfolio.ownerId),
          eq(pushSubscriptions.endpoint, input.endpoint)
        ),
      });

      if (existing) {
        return existing;
      }

      const [subscription] = await ctx.db
        .insert(pushSubscriptions)
        .values({
          userId: ctx.portfolio.ownerId,
          ...input,
        })
        .returning();

      return subscription;
    }),

  // Unregister push subscription
  unregisterPushSubscription: writeProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.portfolio.ownerId),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        );

      return { success: true };
    }),

  // List user's push subscriptions
  listPushSubscriptions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.userId, ctx.portfolio.ownerId),
      orderBy: [desc(pushSubscriptions.createdAt)],
    });
  }),

  // Get recent notification log
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.notificationLog.findMany({
        where: eq(notificationLog.userId, ctx.portfolio.ownerId),
        orderBy: [desc(notificationLog.sentAt)],
        limit: input.limit,
      });
    }),

  // Get VAPID public key for client
  getVapidPublicKey: protectedProcedure.query(() => {
    return process.env.VAPID_PUBLIC_KEY || null;
  }),
});
