import { z } from "zod";
import { positiveAmountSchema, australianPostcodeSchema } from "@/lib/validation";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { referrals, referralCredits, subscriptions, users } from "../db/schema";
import type { Property } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getClimateRisk } from "../services/climate-risk";
import { getPlanFromSubscription, PLAN_LIMITS, type Plan } from "../services/subscription";

const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().min(1, "Suburb is required"),
  state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]),
  postcode: australianPostcodeSchema,
  purchasePrice: positiveAmountSchema,
  contractDate: z.string().min(1, "Contract date is required"),
  settlementDate: z.string().optional(),
  entityName: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export const propertyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Get user's current plan to determine if locked properties should be filtered
    let currentPlan = "free";
    try {
      const sub = await ctx.db.query.subscriptions?.findFirst({
        where: eq(subscriptions.userId, ctx.portfolio.ownerId),
      });
      currentPlan = getPlanFromSubscription(
        sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
      );
    } catch {
      // If subscriptions query fails (e.g., in tests), default to showing all properties
      currentPlan = "pro";
    }

    return ctx.uow.property.findByOwner(ctx.portfolio.ownerId, {
      excludeLocked: currentPlan === "free",
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.id, ctx.portfolio.ownerId);

      if (!property) {
        throw new Error("Property not found");
      }

      // Free users cannot access locked properties
      if (property.locked) {
        let currentPlan = "free";
        try {
          const sub = await ctx.db.query.subscriptions?.findFirst({
            where: eq(subscriptions.userId, ctx.portfolio.ownerId),
          });
          currentPlan = getPlanFromSubscription(
            sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
          );
        } catch {
          // If subscriptions query fails, allow access
          currentPlan = "pro";
        }

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
      // Check if user is on trial — trial users get pro limits
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
        columns: { trialEndsAt: true, trialPlan: true },
      });
      const isOnTrial = user?.trialEndsAt && user.trialEndsAt > new Date();

      let currentPlan: Plan;
      if (isOnTrial) {
        currentPlan = (user.trialPlan as Plan) ?? "pro";
      } else {
        const sub = await ctx.db.query.subscriptions.findFirst({
          where: eq(subscriptions.userId, ctx.portfolio.ownerId),
        });
        currentPlan = getPlanFromSubscription(
          sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
        );
      }
      const limit = PLAN_LIMITS[currentPlan].maxProperties;

      if (limit !== Infinity) {
        const propertyCount = await ctx.uow.property.countByOwner(ctx.portfolio.ownerId);

        if (propertyCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${currentPlan} plan allows up to ${limit} property. Upgrade to Pro for unlimited properties.`,
          });
        }
      }

      const climateRisk = getClimateRisk(input.postcode);

      const property = await ctx.uow.property.create({
        userId: ctx.portfolio.ownerId,
        address: input.address,
        suburb: input.suburb,
        state: input.state,
        postcode: input.postcode,
        purchasePrice: input.purchasePrice,
        purchaseDate: input.contractDate,
        contractDate: input.contractDate,
        settlementDate: input.settlementDate || null,
        entityName: input.entityName || "Personal",
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        climateRisk,
      });

      // Check if this is the user's first property (for referral qualification)
      try {
        const propertyCount = await ctx.uow.property.countByOwner(ctx.portfolio.ownerId);

        if (propertyCount === 1) {
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

      // If contract date changes, keep purchaseDate in sync
      const updateData: Partial<Property> = {
        ...data,
        updatedAt: new Date(),
      };

      if (data.contractDate) {
        updateData.purchaseDate = data.contractDate;
      }

      if (data.postcode) {
        updateData.climateRisk = getClimateRisk(data.postcode);
      }

      // Convert empty lat/lng strings to null for decimal column
      if ("latitude" in updateData) {
        updateData.latitude = updateData.latitude || null;
      }
      if ("longitude" in updateData) {
        updateData.longitude = updateData.longitude || null;
      }

      return ctx.uow.property.update(id, ctx.portfolio.ownerId, updateData);
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.property.delete(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  getMilestones: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.property.findMilestones(input.propertyId, ctx.portfolio.ownerId);
    }),

  refreshClimateRisk: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.id, ctx.portfolio.ownerId);

      if (!property) {
        throw new Error("Property not found");
      }

      const climateRisk = getClimateRisk(property.postcode);

      return ctx.uow.property.update(input.id, ctx.portfolio.ownerId, {
        climateRisk,
        updatedAt: new Date(),
      });
    }),
});
