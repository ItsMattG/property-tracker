import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { getPlanFromSubscription, PLAN_LIMITS, type Plan } from "../../services/billing/subscription";

const GROUP_COLOURS = [
  "#3B82F6", "#22C55E", "#8B5CF6", "#F97316",
  "#EC4899", "#14B8A6", "#EF4444", "#EAB308",
] as const;

const createGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid colour"),
});

const updateGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const assignSchema = z.object({
  groupId: z.string().uuid(),
  propertyIds: z.array(z.string().uuid()).min(1),
});

export const propertyGroupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.propertyGroup.findByOwner(ctx.portfolio.ownerId);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.uow.propertyGroup.findById(input.id, ctx.portfolio.ownerId);
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property group not found" });
      }
      const propertyIds = await ctx.uow.propertyGroup.getPropertyIds(group.id);
      return { ...group, propertyIds };
    }),

  create: writeProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }) => {
      // Check trial first
      const user = await ctx.uow.user.findById(ctx.portfolio.ownerId);
      const isOnTrial = user?.trialEndsAt && user.trialEndsAt > new Date();

      let currentPlan: Plan;
      if (isOnTrial) {
        currentPlan = (user.trialPlan as Plan) ?? "pro";
      } else {
        const sub = await ctx.uow.user.findSubscriptionFull(ctx.portfolio.ownerId);
        currentPlan = getPlanFromSubscription(
          sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
        );
      }
      const limit = PLAN_LIMITS[currentPlan].maxPropertyGroups;

      if (limit !== Infinity) {
        const count = await ctx.uow.propertyGroup.countByOwner(ctx.portfolio.ownerId);
        if (count >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${currentPlan} plan allows up to ${limit} property groups. Upgrade to Pro for unlimited groups.`,
          });
        }
      }

      return ctx.uow.propertyGroup.create({
        userId: ctx.portfolio.ownerId,
        name: input.name,
        colour: input.colour,
      });
    }),

  update: writeProcedure
    .input(updateGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.uow.propertyGroup.update(id, ctx.portfolio.ownerId, data);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property group not found" });
      }
      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.uow.propertyGroup.findById(input.id, ctx.portfolio.ownerId);
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property group not found" });
      }
      await ctx.uow.propertyGroup.delete(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  assignProperties: writeProcedure
    .input(assignSchema)
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.uow.propertyGroup.findById(input.groupId, ctx.portfolio.ownerId);
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property group not found" });
      }
      await ctx.uow.propertyGroup.assignProperties(input.groupId, input.propertyIds);
      return { success: true };
    }),

  unassignProperties: writeProcedure
    .input(assignSchema)
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.uow.propertyGroup.findById(input.groupId, ctx.portfolio.ownerId);
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property group not found" });
      }
      await ctx.uow.propertyGroup.unassignProperties(input.groupId, input.propertyIds);
      return { success: true };
    }),

  forProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.propertyGroup.findByProperty(input.propertyId, ctx.portfolio.ownerId);
    }),

  colours: protectedProcedure.query(() => {
    return [...GROUP_COLOURS];
  }),
});
