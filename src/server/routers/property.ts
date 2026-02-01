import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { properties, equityMilestones, referrals, referralCredits, subscriptions } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getClimateRisk } from "../services/climate-risk";
import { getPlanFromSubscription, PLAN_LIMITS } from "../services/subscription";

const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().min(1, "Suburb is required"),
  state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]),
  postcode: z.string().regex(/^\d{4}$/, "Invalid postcode"),
  purchasePrice: z.string().regex(/^\d+\.?\d*$/, "Invalid price"),
  purchaseDate: z.string(),
  entityName: z.string().optional(),
});

export const propertyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Get user's current plan to determine if locked properties should be filtered
    const sub = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.portfolio.ownerId),
    });
    const currentPlan = getPlanFromSubscription(
      sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
    );

    // Free users cannot see locked properties
    if (currentPlan === "free") {
      return ctx.db.query.properties.findMany({
        where: and(
          eq(properties.userId, ctx.portfolio.ownerId),
          eq(properties.locked, false)
        ),
        orderBy: (properties, { desc }) => [desc(properties.createdAt)],
      });
    }

    return ctx.db.query.properties.findMany({
      where: eq(properties.userId, ctx.portfolio.ownerId),
      orderBy: (properties, { desc }) => [desc(properties.createdAt)],
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.id),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      // Free users cannot access locked properties
      if (property.locked) {
        const sub = await ctx.db.query.subscriptions.findFirst({
          where: eq(subscriptions.userId, ctx.portfolio.ownerId),
        });
        const currentPlan = getPlanFromSubscription(
          sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
        );

        if (currentPlan === "free") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This property is locked. Upgrade to Pro to access all your properties.",
          });
        }
      }

      return property;
    }),

  create: writeProcedure
    .input(propertySchema)
    .mutation(async ({ ctx, input }) => {
      // Check property limit for current plan
      const sub = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, ctx.portfolio.ownerId),
      });
      const currentPlan = getPlanFromSubscription(
        sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
      );
      const limit = PLAN_LIMITS[currentPlan].maxProperties;

      if (limit !== Infinity) {
        const [propertyCount] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(properties)
          .where(eq(properties.userId, ctx.portfolio.ownerId));

        if ((propertyCount?.count ?? 0) >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${currentPlan} plan allows up to ${limit} property. Upgrade to Pro for unlimited properties.`,
          });
        }
      }

      const climateRisk = getClimateRisk(input.postcode);

      const [property] = await ctx.db
        .insert(properties)
        .values({
          userId: ctx.portfolio.ownerId,
          address: input.address,
          suburb: input.suburb,
          state: input.state,
          postcode: input.postcode,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
          entityName: input.entityName || "Personal",
          climateRisk,
        })
        .returning();

      // Check if this is the user's first property (for referral qualification)
      try {
        const [propertyCount] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(properties)
          .where(eq(properties.userId, ctx.portfolio.ownerId));

        if (propertyCount?.count === 1) {
          // First property — qualify any pending referral
          const [referral] = await ctx.db
            .select()
            .from(referrals)
            .where(
              and(
                eq(referrals.refereeUserId, ctx.portfolio.ownerId),
                eq(referrals.status, "pending")
              )
            );

          if (referral) {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            await ctx.db
              .update(referrals)
              .set({ status: "qualified", qualifiedAt: new Date() })
              .where(eq(referrals.id, referral.id));

            await ctx.db.insert(referralCredits).values([
              {
                userId: referral.referrerUserId,
                referralId: referral.id,
                monthsFree: 1,
                expiresAt,
              },
              {
                userId: referral.refereeUserId,
                referralId: referral.id,
                monthsFree: 1,
                expiresAt,
              },
            ]);
          }
        }
      } catch {
        // Non-critical — don't fail property creation
      }

      return property;
    }),

  update: writeProcedure
    .input(z.object({ id: z.string().uuid() }).merge(propertySchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // If postcode is being updated, refresh climate risk
      const updateData: Record<string, unknown> = {
        ...data,
        updatedAt: new Date(),
      };

      if (data.postcode) {
        updateData.climateRisk = getClimateRisk(data.postcode);
      }

      const [property] = await ctx.db
        .update(properties)
        .set(updateData)
        .where(and(eq(properties.id, id), eq(properties.userId, ctx.portfolio.ownerId)))
        .returning();

      return property;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(properties)
        .where(
          and(eq(properties.id, input.id), eq(properties.userId, ctx.portfolio.ownerId))
        );

      return { success: true };
    }),

  getMilestones: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(equityMilestones)
        .where(
          and(
            eq(equityMilestones.propertyId, input.propertyId),
            eq(equityMilestones.userId, ctx.portfolio.ownerId)
          )
        )
        .orderBy(desc(equityMilestones.achievedAt));
    }),

  refreshClimateRisk: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.id),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      const climateRisk = getClimateRisk(property.postcode);

      const [updated] = await ctx.db
        .update(properties)
        .set({ climateRisk, updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning();

      return updated;
    }),
});
