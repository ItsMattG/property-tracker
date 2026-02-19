import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";

const reminderTypes = [
  "lease_expiry",
  "insurance_renewal",
  "fixed_rate_expiry",
  "council_rates",
  "body_corporate",
  "smoke_alarm",
  "pool_safety",
  "tax_return",
  "custom",
] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const reminderRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.reminder.findByOwner(ctx.portfolio.ownerId, {
        propertyId: input.propertyId,
      });
    }),

  getUpcoming: protectedProcedure
    .input(
      z.object({
        days: z.number().int().positive().default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.reminder.findUpcoming(ctx.portfolio.ownerId, input.days);
    }),

  getByMonth: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.reminder.findByMonth(
        ctx.portfolio.ownerId,
        input.year,
        input.month
      );
    }),

  create: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        reminderType: z.enum(reminderTypes),
        title: z.string().min(1, "Title is required"),
        dueDate: dateSchema,
        reminderDaysBefore: z.array(z.number().int().nonnegative()).optional(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.reminder.create({
        userId: ctx.portfolio.ownerId,
        propertyId: input.propertyId,
        reminderType: input.reminderType,
        title: input.title,
        dueDate: input.dueDate,
        reminderDaysBefore: input.reminderDaysBefore,
        notes: input.notes ?? null,
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        dueDate: dateSchema.optional(),
        reminderDaysBefore: z.array(z.number().int().nonnegative()).optional(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const reminder = await ctx.uow.reminder.update(
        id,
        ctx.portfolio.ownerId,
        data
      );

      if (!reminder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }

      return reminder;
    }),

  complete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const reminder = await ctx.uow.reminder.update(
        input.id,
        ctx.portfolio.ownerId,
        { completedAt: new Date() }
      );

      if (!reminder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }

      return reminder;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.reminder.delete(input.id, ctx.portfolio.ownerId);
    }),
});
