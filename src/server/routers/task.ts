import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import type { Task } from "../db/schema";

const taskStatusValues = ["todo", "in_progress", "done"] as const;
const taskPriorityValues = ["urgent", "high", "normal", "low"] as const;

export const taskRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(taskStatusValues).optional(),
        priority: z.enum(taskPriorityValues).optional(),
        propertyId: z.string().uuid().optional(),
        entityId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
        dueBefore: z.string().optional(),
        dueAfter: z.string().optional(),
        sortBy: z
          .enum(["dueDate", "priority", "createdAt"])
          .default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.task.list(ctx.portfolio.ownerId, input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.uow.task.findById(
        input.id,
        ctx.portfolio.ownerId
      );
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      return task;
    }),

  counts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.task.countByStatus(ctx.portfolio.ownerId);
  }),

  create: writeProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        status: z.enum(taskStatusValues).default("todo"),
        priority: z.enum(taskPriorityValues).default("normal"),
        propertyId: z.string().uuid().optional(),
        entityId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
        dueDate: z.string().optional(),
        reminderOffset: z.number().int().min(0).max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      // Validate property access via property repository
      if (input.propertyId) {
        const property = await ctx.uow.property.findById(
          input.propertyId,
          ownerId
        );
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      // Cross-domain: entity validation — no entity repository (small domain not worth a repo)
      if (input.entityId) {
        const entity = await ctx.db.query.entities.findFirst({
          where: (entities, { eq, and }) =>
            and(eq(entities.id, input.entityId!), eq(entities.userId, ownerId)),
        });
        if (!entity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entity not found",
          });
        }
      }

      // Validate assignee has portfolio access
      if (input.assigneeId) {
        const hasAccess = await ctx.uow.task.validateAssigneeAccess(
          ownerId,
          input.assigneeId
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assignee does not have portfolio access",
          });
        }
      }

      return ctx.uow.task.create({
        userId: ownerId,
        assigneeId: input.assigneeId || null,
        propertyId: input.propertyId || null,
        entityId: input.entityId || null,
        title: input.title,
        description: input.description || null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate || null,
        reminderOffset: input.reminderOffset ?? null,
        completedAt: input.status === "done" ? new Date() : null,
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        status: z.enum(taskStatusValues).optional(),
        priority: z.enum(taskPriorityValues).optional(),
        propertyId: z.string().uuid().nullable().optional(),
        entityId: z.string().uuid().nullable().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        reminderOffset: z.number().int().min(0).max(30).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;
      const { id, ...updates } = input;

      const existing = await ctx.uow.task.findByIdForOwner(id, ownerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      if (
        updates.assigneeId !== undefined &&
        updates.assigneeId !== null
      ) {
        const hasAccess = await ctx.uow.task.validateAssigneeAccess(
          ownerId,
          updates.assigneeId
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assignee does not have portfolio access",
          });
        }
      }

      const completedAt =
        updates.status === "done" && existing.status !== "done"
          ? new Date()
          : updates.status && updates.status !== "done"
            ? null
            : undefined;

      const updateData: Partial<Task> = {
        ...updates,
        updatedAt: new Date(),
      };
      if (completedAt !== undefined) {
        updateData.completedAt = completedAt;
      }

      return ctx.uow.task.update(id, updateData);
    }),

  updateStatus: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(taskStatusValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      const existing = await ctx.uow.task.findById(input.id, ownerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const completedAt =
        input.status === "done" && existing.status !== "done"
          ? new Date()
          : input.status !== "done"
            ? null
            : undefined;

      const updateData: Partial<Task> = {
        status: input.status,
        updatedAt: new Date(),
      };
      if (completedAt !== undefined) {
        updateData.completedAt = completedAt;
      }

      return ctx.uow.task.update(input.id, updateData);
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      const existing = await ctx.uow.task.findByIdForOwner(
        input.id,
        ownerId
      );
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      await ctx.uow.task.delete(input.id, ownerId);
      return { success: true };
    }),
});
