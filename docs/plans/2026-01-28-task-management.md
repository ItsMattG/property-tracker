# Task Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global task list with CRUD, property/entity linking, user assignment, list+Kanban views, configurable due-date reminders, and per-property/entity task tabs.

**Architecture:** New `tasks` table with FK links to properties, entities, and users. tRPC router for CRUD + filtering. Global `/tasks` page with list/Kanban toggle. Task slide-over for create/edit. Tasks tab on property and entity detail pages. Cron job for due-date reminders via existing notification system.

**Tech Stack:** Drizzle ORM, tRPC, React (Next.js), Radix UI, Tailwind CSS, Vitest, date-fns.

---

### Task 1: Database Schema — Enums and Table

**Files:**
- Modify: `src/server/db/schema.ts` (append after existing tables, before type exports ~line 2835)

**Step 1: Write the failing test**

Create `src/server/db/__tests__/schema-tasks.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  tasks,
  taskStatusEnum,
  taskPriorityEnum,
} from "../schema";

describe("tasks schema", () => {
  it("exports taskStatusEnum", () => {
    expect(taskStatusEnum).toBeDefined();
    expect(taskStatusEnum.enumValues).toEqual(["todo", "in_progress", "done"]);
  });

  it("exports taskPriorityEnum", () => {
    expect(taskPriorityEnum).toBeDefined();
    expect(taskPriorityEnum.enumValues).toEqual(["urgent", "high", "normal", "low"]);
  });

  it("exports tasks table", () => {
    expect(tasks).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/db/__tests__/schema-tasks.test.ts`
Expected: FAIL — `taskStatusEnum` is not exported

**Step 3: Write minimal implementation**

In `src/server/db/schema.ts`, add enums near the other enum definitions (after line ~210):

```typescript
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "urgent",
  "high",
  "normal",
  "low",
]);
```

Add the table before the type exports section (~line 2835):

```typescript
// ============================================================================
// Tasks
// ============================================================================

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").default("todo").notNull(),
    priority: taskPriorityEnum("priority").default("normal").notNull(),
    dueDate: date("due_date"),
    reminderOffset: integer("reminder_offset"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_assignee_id_idx").on(table.assigneeId),
    index("tasks_property_id_idx").on(table.propertyId),
    index("tasks_entity_id_idx").on(table.entityId),
    index("tasks_due_date_idx").on(table.dueDate),
    index("tasks_status_idx").on(table.status),
  ]
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "taskAssignee",
  }),
  property: one(properties, {
    fields: [tasks.propertyId],
    references: [properties.id],
  }),
  entity: one(entities, {
    fields: [tasks.entityId],
    references: [entities.id],
  }),
}));
```

Add type exports at the bottom of the file:

```typescript
// Task Types
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/db/__tests__/schema-tasks.test.ts`
Expected: PASS

**Step 5: Push schema to database**

Run: `npm run db:push`

**Step 6: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-tasks.test.ts
git commit -m "feat(tasks): add tasks table schema with enums and relations"
```

---

### Task 2: Task Service — Priority and Status Helpers

**Files:**
- Create: `src/server/services/task.ts`
- Create: `src/server/services/__tests__/task.test.ts`

**Step 1: Write the failing test**

Create `src/server/services/__tests__/task.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isOverdue,
  getDaysUntilDue,
  shouldSendReminder,
} from "../task";

describe("task service", () => {
  describe("isOverdue", () => {
    it("returns true when due date is in the past and not done", () => {
      expect(isOverdue("2026-01-01", "todo", new Date("2026-01-15"))).toBe(true);
    });

    it("returns false when due date is in the future", () => {
      expect(isOverdue("2026-02-01", "todo", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when status is done", () => {
      expect(isOverdue("2026-01-01", "done", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when no due date", () => {
      expect(isOverdue(null, "todo", new Date("2026-01-15"))).toBe(false);
    });
  });

  describe("getDaysUntilDue", () => {
    it("returns positive days for future date", () => {
      expect(getDaysUntilDue("2026-01-20", new Date("2026-01-15"))).toBe(5);
    });

    it("returns negative days for past date", () => {
      expect(getDaysUntilDue("2026-01-10", new Date("2026-01-15"))).toBe(-5);
    });

    it("returns 0 for today", () => {
      expect(getDaysUntilDue("2026-01-15", new Date("2026-01-15"))).toBe(0);
    });

    it("returns null when no due date", () => {
      expect(getDaysUntilDue(null, new Date("2026-01-15"))).toBeNull();
    });
  });

  describe("shouldSendReminder", () => {
    it("returns true when days until due matches offset", () => {
      expect(shouldSendReminder("2026-01-18", 3, "todo", new Date("2026-01-15"))).toBe(true);
    });

    it("returns false when days until due does not match offset", () => {
      expect(shouldSendReminder("2026-01-20", 3, "todo", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when task is done", () => {
      expect(shouldSendReminder("2026-01-18", 3, "done", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when no reminder offset", () => {
      expect(shouldSendReminder("2026-01-18", null, "todo", new Date("2026-01-15"))).toBe(false);
    });

    it("returns false when no due date", () => {
      expect(shouldSendReminder(null, 3, "todo", new Date("2026-01-15"))).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/task.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/server/services/task.ts`:

```typescript
import { differenceInDays, parseISO } from "date-fns";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "urgent" | "high" | "normal" | "low";

export function isOverdue(
  dueDate: string | null,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (!dueDate || status === "done") return false;
  return differenceInDays(parseISO(dueDate), today) < 0;
}

export function getDaysUntilDue(
  dueDate: string | null,
  today: Date = new Date()
): number | null {
  if (!dueDate) return null;
  return differenceInDays(parseISO(dueDate), today);
}

export function shouldSendReminder(
  dueDate: string | null,
  reminderOffset: number | null,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (!dueDate || reminderOffset === null || status === "done") return false;
  const daysUntil = differenceInDays(parseISO(dueDate), today);
  return daysUntil === reminderOffset;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/task.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/task.ts src/server/services/__tests__/task.test.ts
git commit -m "feat(tasks): add task service with overdue, days-until-due, and reminder helpers"
```

---

### Task 3: Notification System — Add task_reminder Type

**Files:**
- Modify: `src/server/db/schema.ts` (update `notificationTypeEnum` and `notificationPreferences`)
- Modify: `src/server/services/notification.ts` (update `NotificationType` and `shouldSendNotification`)

**Step 1: Write the failing test**

Create `src/server/services/__tests__/notification-tasks.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldSendNotification, type NotificationPrefs } from "../notification";

describe("task reminder notifications", () => {
  const basePrefs: NotificationPrefs = {
    emailEnabled: true,
    pushEnabled: true,
    rentReceived: true,
    syncFailed: true,
    anomalyDetected: true,
    weeklyDigest: true,
    complianceReminders: true,
    taskReminders: true,
  };

  it("sends task_reminder when taskReminders enabled", () => {
    expect(shouldSendNotification(basePrefs, "task_reminder", "email")).toBe(true);
  });

  it("blocks task_reminder when taskReminders disabled", () => {
    expect(
      shouldSendNotification({ ...basePrefs, taskReminders: false }, "task_reminder", "email")
    ).toBe(false);
  });

  it("sends task_assigned when taskReminders enabled", () => {
    expect(shouldSendNotification(basePrefs, "task_assigned", "email")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/notification-tasks.test.ts`
Expected: FAIL — `task_reminder` not handled

**Step 3: Write minimal implementation**

In `src/server/db/schema.ts`, update `notificationTypeEnum` (~line 181):

```typescript
export const notificationTypeEnum = pgEnum("notification_type", [
  "rent_received",
  "sync_failed",
  "anomaly_critical",
  "anomaly_warning",
  "weekly_digest",
  "eofy_suggestions",
  "refinance_opportunity",
  "cash_rate_changed",
  "compliance_reminder",
  "equity_milestone",
  "task_reminder",
  "task_assigned",
  "task_completed",
]);
```

In `src/server/db/schema.ts`, add to `notificationPreferences` table:

```typescript
taskReminders: boolean("task_reminders").default(true).notNull(),
```

In `src/server/services/notification.ts`, update `NotificationType`:

```typescript
export type NotificationType =
  | "rent_received"
  | "sync_failed"
  | "anomaly_critical"
  | "anomaly_warning"
  | "weekly_digest"
  | "eofy_suggestions"
  | "refinance_opportunity"
  | "cash_rate_changed"
  | "compliance_reminder"
  | "task_reminder"
  | "task_assigned"
  | "task_completed";
```

Update `NotificationPrefs` interface:

```typescript
export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  rentReceived: boolean;
  syncFailed: boolean;
  anomalyDetected: boolean;
  weeklyDigest: boolean;
  complianceReminders: boolean;
  taskReminders: boolean;
}
```

Update `shouldSendNotification` switch:

```typescript
case "task_reminder":
case "task_assigned":
case "task_completed":
  return prefs.taskReminders;
```

Update `getDefaultPreferences` to include:

```typescript
taskReminders: true,
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/notification-tasks.test.ts`
Expected: PASS

**Step 5: Run existing notification tests to confirm no regressions**

Run: `npx vitest run src/server/services/__tests__/notification.test.ts`
Expected: PASS

**Step 6: Push schema changes**

Run: `npm run db:push`

**Step 7: Commit**

```bash
git add src/server/db/schema.ts src/server/services/notification.ts src/server/services/__tests__/notification-tasks.test.ts
git commit -m "feat(tasks): add task_reminder, task_assigned, task_completed notification types"
```

---

### Task 4: tRPC Router — Task CRUD

**Files:**
- Create: `src/server/routers/task.ts`
- Modify: `src/server/routers/_app.ts` (register router)
- Create: `src/server/routers/__tests__/task.test.ts`

**Step 1: Write the failing test**

Create `src/server/routers/__tests__/task.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { taskRouter } from "../task";

describe("Task router", () => {
  it("exports taskRouter", () => {
    expect(taskRouter).toBeDefined();
  });

  it("has list procedure", () => {
    expect(taskRouter.list).toBeDefined();
  });

  it("has getById procedure", () => {
    expect(taskRouter.getById).toBeDefined();
  });

  it("has counts procedure", () => {
    expect(taskRouter.counts).toBeDefined();
  });

  it("has create procedure", () => {
    expect(taskRouter.create).toBeDefined();
  });

  it("has update procedure", () => {
    expect(taskRouter.update).toBeDefined();
  });

  it("has updateStatus procedure", () => {
    expect(taskRouter.updateStatus).toBeDefined();
  });

  it("has delete procedure", () => {
    expect(taskRouter.delete).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/task.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/server/routers/task.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  tasks,
  properties,
  entities,
  users,
  portfolioMembers,
} from "../db/schema";
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

      const updateValues: Record<string, unknown> = {
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

      const updateValues: Record<string, unknown> = {
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
```

**Step 4: Register router in `_app.ts`**

In `src/server/routers/_app.ts`, add import and registration:

```typescript
import { taskRouter } from "./task";
```

Add to the router object:

```typescript
task: taskRouter,
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/server/routers/__tests__/task.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/routers/task.ts src/server/routers/_app.ts src/server/routers/__tests__/task.test.ts
git commit -m "feat(tasks): add tRPC task router with CRUD, filtering, and assignee validation"
```

---

### Task 5: Task Slide-Over Component (Create/Edit)

**Files:**
- Create: `src/components/tasks/TaskSlideOver.tsx`

**Step 1: Write implementation**

Create `src/components/tasks/TaskSlideOver.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
  defaultPropertyId?: string;
  defaultEntityId?: string;
}

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "text-red-600" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "normal", label: "Normal", color: "text-blue-500" },
  { value: "low", label: "Low", color: "text-gray-400" },
];

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const REMINDER_OPTIONS = [
  { value: "none", label: "No reminder" },
  { value: "0", label: "On due date" },
  { value: "1", label: "1 day before" },
  { value: "2", label: "2 days before" },
  { value: "3", label: "3 days before" },
  { value: "7", label: "1 week before" },
];

export function TaskSlideOver({
  open,
  onOpenChange,
  taskId,
  defaultPropertyId,
  defaultEntityId,
}: TaskSlideOverProps) {
  const utils = trpc.useUtils();
  const isEditing = !!taskId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("normal");
  const [propertyId, setPropertyId] = useState<string | undefined>(
    defaultPropertyId
  );
  const [entityId, setEntityId] = useState<string | undefined>(
    defaultEntityId
  );
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [reminderOffset, setReminderOffset] = useState("none");

  const { data: existingTask } = trpc.task.getById.useQuery(
    { id: taskId! },
    { enabled: !!taskId }
  );

  const { data: propertiesList } = trpc.property.list.useQuery();
  const { data: entitiesList } = trpc.entity.list.useQuery();

  // Load existing task data
  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description || "");
      setStatus(existingTask.status);
      setPriority(existingTask.priority);
      setPropertyId(existingTask.propertyId || undefined);
      setEntityId(existingTask.entityId || undefined);
      setAssigneeId(existingTask.assigneeId || undefined);
      setDueDate(existingTask.dueDate ? parseISO(existingTask.dueDate) : undefined);
      setReminderOffset(
        existingTask.reminderOffset !== null
          ? String(existingTask.reminderOffset)
          : "none"
      );
    }
  }, [existingTask]);

  // Reset form when opening for new task
  useEffect(() => {
    if (open && !taskId) {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("normal");
      setPropertyId(defaultPropertyId);
      setEntityId(defaultEntityId);
      setAssigneeId(undefined);
      setDueDate(undefined);
      setReminderOffset("none");
    }
  }, [open, taskId, defaultPropertyId, defaultEntityId]);

  const invalidate = () => {
    utils.task.list.invalidate();
    utils.task.counts.invalidate();
    if (taskId) utils.task.getById.invalidate({ id: taskId });
  };

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const data = {
      title,
      description: description || undefined,
      status: status as "todo" | "in_progress" | "done",
      priority: priority as "urgent" | "high" | "normal" | "low",
      propertyId: propertyId || undefined,
      entityId: entityId || undefined,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
      reminderOffset:
        reminderOffset !== "none" ? Number(reminderOffset) : undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: taskId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Task" : "New Task"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Fix leaky tap at 123 Main St"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Status & Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Property */}
          <div className="space-y-2">
            <Label>Property</Label>
            <Select
              value={propertyId || "none"}
              onValueChange={(v) => setPropertyId(v === "none" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {propertiesList?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}, {p.suburb}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity */}
          <div className="space-y-2">
            <Label>Entity</Label>
            <Select
              value={entityId || "none"}
              onValueChange={(v) => setEntityId(v === "none" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {entitiesList?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee — only show if property or entity selected */}
          {(propertyId || entityId) && (
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={assigneeId || "none"}
                onValueChange={(v) =>
                  setAssigneeId(v === "none" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {/* Portfolio members loaded from context */}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "No due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dueDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDueDate(undefined);
                  setReminderOffset("none");
                }}
              >
                Clear date
              </Button>
            )}
          </div>

          {/* Reminder — only show when due date set */}
          {dueDate && (
            <div className="space-y-2">
              <Label>Reminder</Label>
              <Select value={reminderOffset} onValueChange={setReminderOffset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter className="flex justify-between">
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate({ id: taskId })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title || isPending}>
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i task`
Expected: No errors related to task files (or fix any import issues)

**Step 3: Commit**

```bash
git add src/components/tasks/TaskSlideOver.tsx
git commit -m "feat(tasks): add TaskSlideOver component for create/edit"
```

---

### Task 6: Global Tasks Page — List View

**Files:**
- Create: `src/app/(dashboard)/tasks/page.tsx`

**Step 1: Write implementation**

Create `src/app/(dashboard)/tasks/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  List,
  LayoutGrid,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Circle,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "kanban";
type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "urgent" | "high" | "normal" | "low";

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; icon: typeof AlertCircle; className: string }
> = {
  urgent: { label: "Urgent", icon: AlertCircle, className: "text-red-600" },
  high: { label: "High", icon: ArrowUp, className: "text-orange-500" },
  normal: { label: "Normal", icon: ArrowRight, className: "text-blue-500" },
  low: { label: "Low", icon: ArrowDown, className: "text-gray-400" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  done: { label: "Done", variant: "secondary" },
};

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tasks-view") as ViewMode) || "list";
    }
    return "list";
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as TaskStatus) : undefined,
    priority:
      priorityFilter !== "all" ? (priorityFilter as TaskPriority) : undefined,
    propertyId: propertyFilter !== "all" ? propertyFilter : undefined,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 100,
  });

  const { data: counts } = trpc.task.counts.useQuery();
  const { data: propertiesList } = trpc.property.list.useQuery();
  const updateStatus = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.counts.invalidate();
    },
  });
  const utils = trpc.useUtils();

  const toggleView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("tasks-view", mode);
  };

  const openCreate = () => {
    setEditingTaskId(undefined);
    setSlideOverOpen(true);
  };

  const openEdit = (taskId: string) => {
    setEditingTaskId(taskId);
    setSlideOverOpen(true);
  };

  const isDueDateWarning = (dueDate: string | null, status: string) => {
    if (!dueDate || status === "done") return null;
    const d = parseISO(dueDate);
    if (isPast(d) && !isToday(d)) return "overdue";
    if (isToday(d)) return "today";
    return null;
  };

  const totalOpen = (counts?.todo || 0) + (counts?.in_progress || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            {totalOpen} open task{totalOpen !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => toggleView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => toggleView("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {propertiesList?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}, {p.suburb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading tasks...
          </CardContent>
        </Card>
      ) : !tasksList?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Circle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No tasks yet</h3>
            <p className="text-muted-foreground mt-1">
              Create your first task to start tracking property to-dos.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksList.map((task) => {
                const priorityCfg = PRIORITY_CONFIG[task.priority as TaskPriority];
                const PriorityIcon = priorityCfg.icon;
                const statusCfg = STATUS_CONFIG[task.status as TaskStatus];
                const dueDateWarning = isDueDateWarning(task.dueDate, task.status);

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEdit(task.id)}
                  >
                    <TableCell>
                      <PriorityIcon
                        className={cn("h-4 w-4", priorityCfg.className)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {task.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.propertyName || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={priorityCfg.className}>
                        {priorityCfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span
                          className={cn(
                            dueDateWarning === "overdue" && "text-red-600 font-medium",
                            dueDateWarning === "today" && "text-orange-500 font-medium"
                          )}
                        >
                          {format(parseISO(task.dueDate), "dd MMM yyyy")}
                          {dueDateWarning === "overdue" && " (overdue)"}
                          {dueDateWarning === "today" && " (today)"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assigneeEmail || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-3 gap-4">
          {(["todo", "in_progress", "done"] as const).map((status) => {
            const statusCfg = STATUS_CONFIG[status];
            const columnTasks = tasksList.filter((t) => t.status === status);
            const countLabel = counts?.[status] || 0;

            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {statusCfg.label}
                  </h3>
                  <Badge variant="secondary">{countLabel}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {columnTasks.map((task) => {
                    const priorityCfg =
                      PRIORITY_CONFIG[task.priority as TaskPriority];
                    const dueDateWarning = isDueDateWarning(
                      task.dueDate,
                      task.status
                    );

                    return (
                      <Card
                        key={task.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openEdit(task.id)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div
                              className={cn(
                                "w-1 h-full min-h-[20px] rounded-full flex-shrink-0",
                                task.priority === "urgent" && "bg-red-500",
                                task.priority === "high" && "bg-orange-400",
                                task.priority === "normal" && "bg-blue-400",
                                task.priority === "low" && "bg-gray-300"
                              )}
                            />
                            <p className="text-sm font-medium leading-tight">
                              {task.title}
                            </p>
                          </div>
                          {task.propertyName && (
                            <p className="text-xs text-muted-foreground pl-3">
                              {task.propertyName}
                            </p>
                          )}
                          <div className="flex items-center justify-between pl-3">
                            {task.dueDate ? (
                              <span
                                className={cn(
                                  "text-xs",
                                  dueDateWarning === "overdue" &&
                                    "text-red-600 font-medium",
                                  dueDateWarning === "today" &&
                                    "text-orange-500",
                                  !dueDateWarning && "text-muted-foreground"
                                )}
                              >
                                {format(parseISO(task.dueDate), "dd MMM")}
                              </span>
                            ) : (
                              <span />
                            )}
                            {task.assigneeEmail && (
                              <span className="text-xs text-muted-foreground">
                                {task.assigneeEmail.split("@")[0]}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
      />
    </div>
  );
}
```

**Step 2: Add nav item to sidebar**

In `src/components/layout/Sidebar.tsx`, add to the `navItems` array after the emails entry:

```typescript
{ href: "/tasks", label: "Tasks", icon: CheckSquare },
```

Import `CheckSquare` from `lucide-react`.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "error"`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/tasks/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(tasks): add global tasks page with list and kanban views"
```

---

### Task 7: Property Detail — Tasks Tab

**Files:**
- Create: `src/app/(dashboard)/properties/[id]/tasks/page.tsx`
- Create: `src/components/tasks/PropertyTasksSection.tsx`
- Modify: `src/app/(dashboard)/properties/[id]/layout.tsx` (add breadcrumb case)
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx` (add tasks section)

**Step 1: Create PropertyTasksSection component**

Create `src/components/tasks/PropertyTasksSection.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  CheckSquare,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PropertyTasksSectionProps {
  propertyId: string;
}

const PRIORITY_ICONS = {
  urgent: { icon: AlertCircle, className: "text-red-600" },
  high: { icon: ArrowUp, className: "text-orange-500" },
  normal: { icon: ArrowRight, className: "text-blue-500" },
  low: { icon: ArrowDown, className: "text-gray-400" },
};

const STATUS_BADGE = {
  todo: { label: "To Do", variant: "outline" as const },
  in_progress: { label: "In Progress", variant: "default" as const },
  done: { label: "Done", variant: "secondary" as const },
};

export function PropertyTasksSection({ propertyId }: PropertyTasksSectionProps) {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    propertyId,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 5,
  });

  const openTasks = tasksList?.filter((t) => t.status !== "done") || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Tasks
            {openTasks.length > 0 && (
              <Badge variant="secondary">{openTasks.length} open</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingTaskId(undefined);
                setSlideOverOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
            <Link href={`/properties/${propertyId}/tasks`}>
              <Button size="sm" variant="ghost">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : !tasksList?.length ? (
            <p className="text-muted-foreground text-sm">
              No tasks for this property.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksList.map((task) => {
                  const p = PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS];
                  const Icon = p.icon;
                  const s = STATUS_BADGE[task.status as keyof typeof STATUS_BADGE];
                  const isOverdue =
                    task.dueDate &&
                    task.status !== "done" &&
                    isPast(parseISO(task.dueDate)) &&
                    !isToday(parseISO(task.dueDate));

                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setSlideOverOpen(true);
                      }}
                    >
                      <TableCell>
                        <Icon className={cn("h-4 w-4", p.className)} />
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className={cn(isOverdue && "text-red-600")}>
                            {format(parseISO(task.dueDate), "dd MMM")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
        defaultPropertyId={propertyId}
      />
    </>
  );
}
```

**Step 2: Create dedicated tasks sub-page**

Create `src/app/(dashboard)/properties/[id]/tasks/page.tsx`:

```typescript
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";

export default function PropertyTasksPage() {
  const params = useParams();
  const propertyId = params?.id as string;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    propertyId,
    status: statusFilter !== "all" ? (statusFilter as "todo" | "in_progress" | "done") : undefined,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 100,
  });

  const PRIORITY_ICONS = {
    urgent: { icon: AlertCircle, className: "text-red-600" },
    high: { icon: ArrowUp, className: "text-orange-500" },
    normal: { icon: ArrowRight, className: "text-blue-500" },
    low: { icon: ArrowDown, className: "text-gray-400" },
  };

  const STATUS_BADGE = {
    todo: { label: "To Do", variant: "outline" as const },
    in_progress: { label: "In Progress", variant: "default" as const },
    done: { label: "Done", variant: "secondary" as const },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        <Button
          onClick={() => {
            setEditingTaskId(undefined);
            setSlideOverOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      ) : !tasksList?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tasks for this property.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksList.map((task) => {
                const p = PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS];
                const Icon = p.icon;
                const s = STATUS_BADGE[task.status as keyof typeof STATUS_BADGE];
                const isOverdue =
                  task.dueDate &&
                  task.status !== "done" &&
                  isPast(parseISO(task.dueDate)) &&
                  !isToday(parseISO(task.dueDate));

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditingTaskId(task.id);
                      setSlideOverOpen(true);
                    }}
                  >
                    <TableCell>
                      <Icon className={cn("h-4 w-4", p.className)} />
                    </TableCell>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className={p.className}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span className={cn(isOverdue && "text-red-600")}>
                          {format(parseISO(task.dueDate), "dd MMM yyyy")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assigneeEmail || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
        defaultPropertyId={propertyId}
      />
    </div>
  );
}
```

**Step 3: Update property layout breadcrumbs**

In `src/app/(dashboard)/properties/[id]/layout.tsx`, add a breadcrumb case for tasks (after the emails case):

```typescript
} else if (pathname?.includes("/tasks")) {
  items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
  items.push({ label: "Tasks" });
```

**Step 4: Add PropertyTasksSection to property detail page**

In `src/app/(dashboard)/properties/[id]/page.tsx`, import and add the section in the grid (after the compliance section):

```typescript
import { PropertyTasksSection } from "@/components/tasks/PropertyTasksSection";
```

```typescript
{/* Tasks Section (full width) */}
<div className="lg:col-span-2">
  <PropertyTasksSection propertyId={propertyId} />
</div>
```

**Step 5: Verify compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "error"`
Expected: No errors

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/tasks/page.tsx src/components/tasks/PropertyTasksSection.tsx src/app/\(dashboard\)/properties/\[id\]/layout.tsx src/app/\(dashboard\)/properties/\[id\]/page.tsx
git commit -m "feat(tasks): add tasks tab to property detail page"
```

---

### Task 8: Entity Detail — Tasks Tab

**Files:**
- Create: `src/components/tasks/EntityTasksSection.tsx`
- Modify: entity detail page (add section — follow same pattern as property)

**Step 1: Write implementation**

Create `src/components/tasks/EntityTasksSection.tsx` — same as `PropertyTasksSection` but uses `entityId` instead of `propertyId`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  CheckSquare,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { TaskSlideOver } from "@/components/tasks/TaskSlideOver";
import { cn } from "@/lib/utils";

interface EntityTasksSectionProps {
  entityId: string;
}

const PRIORITY_ICONS = {
  urgent: { icon: AlertCircle, className: "text-red-600" },
  high: { icon: ArrowUp, className: "text-orange-500" },
  normal: { icon: ArrowRight, className: "text-blue-500" },
  low: { icon: ArrowDown, className: "text-gray-400" },
};

const STATUS_BADGE = {
  todo: { label: "To Do", variant: "outline" as const },
  in_progress: { label: "In Progress", variant: "default" as const },
  done: { label: "Done", variant: "secondary" as const },
};

export function EntityTasksSection({ entityId }: EntityTasksSectionProps) {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();

  const { data: tasksList, isLoading } = trpc.task.list.useQuery({
    entityId,
    sortBy: "createdAt",
    sortDir: "desc",
    limit: 5,
  });

  const openTasks = tasksList?.filter((t) => t.status !== "done") || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Tasks
            {openTasks.length > 0 && (
              <Badge variant="secondary">{openTasks.length} open</Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingTaskId(undefined);
              setSlideOverOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : !tasksList?.length ? (
            <p className="text-muted-foreground text-sm">
              No tasks for this entity.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksList.map((task) => {
                  const p = PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS];
                  const Icon = p.icon;
                  const s = STATUS_BADGE[task.status as keyof typeof STATUS_BADGE];
                  const isOverdue =
                    task.dueDate &&
                    task.status !== "done" &&
                    isPast(parseISO(task.dueDate)) &&
                    !isToday(parseISO(task.dueDate));

                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setSlideOverOpen(true);
                      }}
                    >
                      <TableCell>
                        <Icon className={cn("h-4 w-4", p.className)} />
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        {task.dueDate ? (
                          <span className={cn(isOverdue && "text-red-600")}>
                            {format(parseISO(task.dueDate), "dd MMM")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TaskSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        taskId={editingTaskId}
        defaultEntityId={entityId}
      />
    </>
  );
}
```

**Step 2: Add to entity detail page**

Find the entity detail page (likely `src/app/(dashboard)/entities/[id]/page.tsx`) and add:

```typescript
import { EntityTasksSection } from "@/components/tasks/EntityTasksSection";
```

Add section in the layout:

```typescript
<EntityTasksSection entityId={entityId} />
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "error"`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/tasks/EntityTasksSection.tsx src/app/\(dashboard\)/entities/\[id\]/page.tsx
git commit -m "feat(tasks): add tasks section to entity detail page"
```

---

### Task 9: Task Reminder Cron Job

**Files:**
- Create: `src/app/api/cron/task-reminders/route.ts`

**Step 1: Write implementation**

Create `src/app/api/cron/task-reminders/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  tasks,
  users,
  properties,
  notificationPreferences,
} from "@/server/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { notifyUser } from "@/server/services/notification";
import { shouldSendReminder } from "@/server/services/task";
import { format, parseISO } from "date-fns";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const today = new Date();
    let sentCount = 0;
    let skippedCount = 0;

    // Get all tasks with due dates and reminder offsets that aren't done
    const tasksWithReminders = await db
      .select({
        task: tasks,
        user: users,
        propertyAddress: properties.address,
      })
      .from(tasks)
      .innerJoin(users, eq(tasks.userId, users.id))
      .leftJoin(properties, eq(tasks.propertyId, properties.id))
      .where(
        and(
          isNotNull(tasks.dueDate),
          isNotNull(tasks.reminderOffset),
          ne(tasks.status, "done")
        )
      );

    for (const { task, user, propertyAddress } of tasksWithReminders) {
      if (
        !shouldSendReminder(
          task.dueDate,
          task.reminderOffset,
          task.status as "todo" | "in_progress" | "done",
          today
        )
      ) {
        continue;
      }

      // Check preferences
      const prefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, user.id),
      });

      if (!prefs || !prefs.taskReminders) {
        skippedCount++;
        continue;
      }

      const dueDate = parseISO(task.dueDate!);
      const daysUntil = task.reminderOffset!;
      const dueDateFormatted = format(dueDate, "dd MMM yyyy");

      const title =
        daysUntil === 0
          ? `Task due today: ${task.title}`
          : `Task due in ${daysUntil} day${daysUntil > 1 ? "s" : ""}: ${task.title}`;

      const body = propertyAddress
        ? `${propertyAddress} — ${task.title} is due ${daysUntil === 0 ? "today" : `on ${dueDateFormatted}`}.`
        : `${task.title} is due ${daysUntil === 0 ? "today" : `on ${dueDateFormatted}`}.`;

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";
      const url = "/tasks";

      try {
        await notifyUser(user.id, user.email, "task_reminder", {
          title,
          body,
          url,
          emailSubject: title,
          emailHtml: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${daysUntil === 0 ? "#dc2626" : "#2563eb"};">
                ${title}
              </h2>
              <p style="font-size: 16px; color: #374151;">${body}</p>
              <a href="${appUrl}${url}"
                 style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                View Tasks
              </a>
            </div>
          `,
        });
        sentCount++;
      } catch (error) {
        logger.error("Failed to send task reminder", error, {
          taskId: task.id,
          userId: user.id,
        });
      }

      // Also notify assignee if different from owner
      if (task.assigneeId && task.assigneeId !== task.userId) {
        const assignee = await db.query.users.findFirst({
          where: eq(users.id, task.assigneeId),
        });
        if (assignee) {
          try {
            await notifyUser(assignee.id, assignee.email, "task_reminder", {
              title,
              body,
              url,
              emailSubject: title,
              emailHtml: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: ${daysUntil === 0 ? "#dc2626" : "#2563eb"};">${title}</h2>
                  <p style="font-size: 16px; color: #374151;">${body}</p>
                  <a href="${appUrl}${url}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Tasks</a>
                </div>
              `,
            });
          } catch (error) {
            logger.error("Failed to send task reminder to assignee", error, {
              taskId: task.id,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      checked: tasksWithReminders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Task reminders cron error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "error"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/cron/task-reminders/route.ts
git commit -m "feat(tasks): add task reminders cron job"
```

---

### Task 10: Notification Settings UI — Task Reminders Toggle

**Files:**
- Modify: `src/app/(dashboard)/settings/notifications/page.tsx` (add taskReminders toggle)

**Step 1: Add task reminders toggle**

In the notifications settings page, find where the existing toggles are (complianceReminders, etc.) and add:

```typescript
{/* Task Reminders */}
<div className="flex items-center justify-between">
  <div>
    <p className="font-medium">Task Reminders</p>
    <p className="text-sm text-muted-foreground">
      Get notified when tasks are approaching their due date
    </p>
  </div>
  <Switch
    checked={prefs.taskReminders}
    onCheckedChange={(checked) =>
      updatePrefs.mutate({ taskReminders: checked })
    }
  />
</div>
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "error"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/notifications/page.tsx
git commit -m "feat(tasks): add task reminders toggle to notification settings"
```

---

### Task 11: E2E Test — Task CRUD Flow

**Files:**
- Create: `e2e/tasks.spec.ts`

**Step 1: Write E2E test**

Create `e2e/tasks.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Task Management", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tasks page (assumes auth is handled by test setup)
    await page.goto("/tasks");
  });

  test("shows empty state when no tasks exist", async ({ page }) => {
    await expect(page.getByText("No tasks yet")).toBeVisible();
    await expect(page.getByText("New Task")).toBeVisible();
  });

  test("creates a new task", async ({ page }) => {
    await page.getByRole("button", { name: /new task/i }).click();

    // Fill in task form
    await page.getByLabel("Title").fill("Fix leaky tap");
    await page.getByLabel("Description").fill("Kitchen sink is dripping");

    // Set priority to High
    await page.getByLabel("Priority").click();
    await page.getByRole("option", { name: "High" }).click();

    // Submit
    await page.getByRole("button", { name: "Create" }).click();

    // Verify task appears in list
    await expect(page.getByText("Fix leaky tap")).toBeVisible();
    await expect(page.getByText("Task created")).toBeVisible();
  });

  test("edits an existing task", async ({ page }) => {
    // Click on a task row to open edit
    await page.getByText("Fix leaky tap").click();

    // Change title
    await page.getByLabel("Title").clear();
    await page.getByLabel("Title").fill("Fix leaky tap urgently");

    // Save
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Task updated")).toBeVisible();
    await expect(page.getByText("Fix leaky tap urgently")).toBeVisible();
  });

  test("toggles between list and kanban views", async ({ page }) => {
    // Default should be list view
    await expect(page.getByRole("table")).toBeVisible();

    // Switch to kanban
    await page.getByRole("button", { name: /kanban|board/i }).click();

    // Should see kanban columns
    await expect(page.getByText("To Do")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
  });

  test("filters tasks by status", async ({ page }) => {
    // Open status filter
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "To Do" }).click();

    // Only todo tasks should be visible
    // (Specific assertions depend on test data)
  });

  test("deletes a task", async ({ page }) => {
    await page.getByText("Fix leaky tap urgently").click();
    await page.getByRole("button", { name: /delete/i }).click();

    // Confirm deletion
    await page.getByRole("button", { name: /delete/i }).last().click();
    await expect(page.getByText("Task deleted")).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/tasks.spec.ts`
Expected: Tests pass (may need adjustments based on auth setup and test data)

**Step 3: Commit**

```bash
git add e2e/tasks.spec.ts
git commit -m "test(tasks): add E2E tests for task CRUD and view toggling"
```

---

### Task 12: Run All Tests and Final Verification

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(tasks): address test and lint issues"
```
