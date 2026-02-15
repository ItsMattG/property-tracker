import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  tasks,
  properties,
  entities,
  users,
  portfolioMembers,
} from "../../db/schema";
import type { Task } from "../../db/schema";
import { eq, and, or, desc, asc, lte, gte, count, sql } from "drizzle-orm";

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
      const ownerId = ctx.portfolio.ownerId;
      const conditions = [
        or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId)),
      ];

      if (input.status) conditions.push(eq(tasks.status, input.status));
      if (input.priority) conditions.push(eq(tasks.priority, input.priority));
      if (input.propertyId)
        conditions.push(eq(tasks.propertyId, input.propertyId));
      if (input.entityId) conditions.push(eq(tasks.entityId, input.entityId));
      if (input.assigneeId)
        conditions.push(eq(tasks.assigneeId, input.assigneeId));
      if (input.dueBefore)
        conditions.push(lte(tasks.dueDate, input.dueBefore));
      if (input.dueAfter) conditions.push(gte(tasks.dueDate, input.dueAfter));

      const sortColumn =
        input.sortBy === "dueDate"
          ? tasks.dueDate
          : input.sortBy === "priority"
            ? tasks.priority
            : tasks.createdAt;
      const sortFn = input.sortDir === "asc" ? asc : desc;

      const results = await ctx.db
        .select({
          task: tasks,
          propertyAddress: properties.address,
          propertySuburb: properties.suburb,
          entityName: entities.name,
          assigneeEmail: users.email,
        })
        .from(tasks)
        .leftJoin(properties, eq(tasks.propertyId, properties.id))
        .leftJoin(entities, eq(tasks.entityId, entities.id))
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .where(and(...conditions))
        .orderBy(sortFn(sortColumn))
        .limit(input.limit)
        .offset(input.offset);

      return results.map((r) => ({
        ...r.task,
        propertyName: r.propertyAddress
          ? `${r.propertyAddress}, ${r.propertySuburb}`
          : null,
        entityName: r.entityName,
        assigneeEmail: r.assigneeEmail,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;
      const result = await ctx.db
        .select({
          task: tasks,
          propertyAddress: properties.address,
          propertySuburb: properties.suburb,
          entityName: entities.name,
          assigneeEmail: users.email,
        })
        .from(tasks)
        .leftJoin(properties, eq(tasks.propertyId, properties.id))
        .leftJoin(entities, eq(tasks.entityId, entities.id))
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .where(
          and(
            eq(tasks.id, input.id),
            or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId))
          )
        )
        .limit(1);

      if (!result.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const r = result[0];
      return {
        ...r.task,
        propertyName: r.propertyAddress
          ? `${r.propertyAddress}, ${r.propertySuburb}`
          : null,
        entityName: r.entityName,
        assigneeEmail: r.assigneeEmail,
      };
    }),

  counts: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;
    const result = await ctx.db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .where(or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId)))
      .groupBy(tasks.status);

    const counts = { todo: 0, in_progress: 0, done: 0 };
    for (const row of result) {
      counts[row.status as keyof typeof counts] = Number(row.count);
    }
    return counts;
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

      // Validate property access
      if (input.propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ownerId)
          ),
        });
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      // Validate entity access
      if (input.entityId) {
        const entity = await ctx.db.query.entities.findFirst({
          where: and(
            eq(entities.id, input.entityId),
            eq(entities.userId, ownerId)
          ),
        });
        if (!entity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entity not found",
          });
        }
      }

      // Validate assignee has portfolio access
      if (input.assigneeId && input.assigneeId !== ownerId) {
        const member = await ctx.db.query.portfolioMembers.findFirst({
          where: and(
            eq(portfolioMembers.ownerId, ownerId),
            eq(portfolioMembers.userId, input.assigneeId)
          ),
        });
        if (!member) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assignee does not have portfolio access",
          });
        }
      }

      const [task] = await ctx.db
        .insert(tasks)
        .values({
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
        })
        .returning();

      return task;
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

      // Verify ownership
      const existing = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, id), eq(tasks.userId, ownerId)),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Validate assignee if changing
      if (
        updates.assigneeId !== undefined &&
        updates.assigneeId !== null &&
        updates.assigneeId !== ownerId
      ) {
        const member = await ctx.db.query.portfolioMembers.findFirst({
          where: and(
            eq(portfolioMembers.ownerId, ownerId),
            eq(portfolioMembers.userId, updates.assigneeId)
          ),
        });
        if (!member) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Assignee does not have portfolio access",
          });
        }
      }

      // Set completedAt when marking done
      const completedAt =
        updates.status === "done" && existing.status !== "done"
          ? new Date()
          : updates.status && updates.status !== "done"
            ? null
            : undefined;

      const updateValues: Partial<Task> = {
        ...updates,
        updatedAt: new Date(),
      };
      if (completedAt !== undefined) {
        updateValues.completedAt = completedAt;
      }

      const [updated] = await ctx.db
        .update(tasks)
        .set(updateValues)
        .where(eq(tasks.id, id))
        .returning();

      return updated;
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

      const existing = await ctx.db.query.tasks.findFirst({
        where: and(
          eq(tasks.id, input.id),
          or(eq(tasks.userId, ownerId), eq(tasks.assigneeId, ownerId))
        ),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const completedAt =
        input.status === "done" && existing.status !== "done"
          ? new Date()
          : input.status !== "done"
            ? null
            : undefined;

      const updateValues: Partial<Task> = {
        status: input.status,
        updatedAt: new Date(),
      };
      if (completedAt !== undefined) {
        updateValues.completedAt = completedAt;
      }

      const [updated] = await ctx.db
        .update(tasks)
        .set(updateValues)
        .where(eq(tasks.id, input.id))
        .returning();

      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      const existing = await ctx.db.query.tasks.findFirst({
        where: and(eq(tasks.id, input.id), eq(tasks.userId, ownerId)),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),
});
