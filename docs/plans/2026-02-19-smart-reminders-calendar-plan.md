# Smart Reminders Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a property reminders calendar with manual date entry, calendar/list views, dashboard widget, and email notifications for upcoming property dates (lease expiry, insurance renewal, etc.).

**Architecture:** New `propertyReminders` table with `reminderTypeEnum`. New `ReminderRepository` registered in UnitOfWork. New `reminder` tRPC router with 7 procedures. Calendar page at `/reminders` with calendar grid + list view. Dashboard widget. Daily Vercel cron sends email reminders.

**Tech Stack:** Drizzle ORM (schema, int array columns), tRPC v11, React 19, React DayPicker v9 (custom modifiers + DayButton), Tailwind v4, Vitest, Resend (email), Vercel Cron

**Design doc:** `docs/plans/2026-02-19-smart-reminders-calendar-design.md`

**Beads task:** property-tracker-3ex

---

## Tech Notes

**Drizzle integer arrays:** `integer("col").array().notNull().default(sql\`'{30,7}'\`)` — use `sql` template for array defaults. Query with `arrayContains` / `arrayOverlaps` from `drizzle-orm`.

**Drizzle date columns:** `date("col")` returns string by default (YYYY-MM-DD). Use `gte`/`lte` from `drizzle-orm` for range queries. Use `between(col, start, end)` for month queries.

**React DayPicker v9:** Custom modifiers via `modifiers={{ hasReminder: dateArray }}` + `modifiersClassNames`. Custom day content via `components={{ DayButton }}` prop. `onDayClick` receives `(date, modifiers)`.

**Vercel Cron:** Configure in `vercel.json` with `"schedule": "0 21 * * *"` (9PM UTC = ~7-8AM AEST). Secure with `CRON_SECRET` env var checked via `Authorization: Bearer` header. Hobby plan: once/day max.

**Resend email:** Project uses HTML templates via `baseTemplate()` from `src/lib/email/templates/base.ts`. Pattern: `sendEmailNotification(to, subject, html)` from notification service.

**Existing patterns:** All repos extend `BaseRepository`, implement interface from `interfaces/`. UoW has lazy getter per repo. Routers use `protectedProcedure` for reads, `writeProcedure` for mutations. Feature flags in `src/config/feature-flags.ts` with `routeToFlag` mapping.

---

### Task 1: Schema — reminderTypeEnum + property_reminders table

**Files:**
- Modify: `src/server/db/schema/enums.ts`
- Create: `src/server/db/schema/reminders.ts`
- Modify: `src/server/db/schema/index.ts`

**Step 1: Add reminderTypeEnum to enums.ts**

In `src/server/db/schema/enums.ts`, add after the last enum definition:

```typescript
export const reminderTypeEnum = pgEnum("reminder_type", [
  "lease_expiry",
  "insurance_renewal",
  "fixed_rate_expiry",
  "council_rates",
  "body_corporate",
  "smoke_alarm",
  "pool_safety",
  "tax_return",
  "custom",
]);
```

**Step 2: Create reminders.ts schema file**

Create `src/server/db/schema/reminders.ts`:

```typescript
import {
  pgTable, uuid, text, timestamp, integer, date, index, sql,
} from "./_common";
import { reminderTypeEnum } from "./enums";
import { users } from "./auth";
import { properties } from "./properties";

export const propertyReminders = pgTable(
  "property_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    reminderType: reminderTypeEnum("reminder_type").notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    reminderDaysBefore: integer("reminder_days_before")
      .array()
      .notNull()
      .default(sql`'{30,7}'`),
    notes: text("notes"),
    notifiedAt: timestamp("notified_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_reminders_user_id_idx").on(table.userId),
    index("property_reminders_property_id_idx").on(table.propertyId),
    index("property_reminders_due_date_idx").on(table.dueDate),
    index("property_reminders_user_due_idx").on(table.userId, table.dueDate),
  ]
);

export type PropertyReminder = typeof propertyReminders.$inferSelect;
export type NewPropertyReminder = typeof propertyReminders.$inferInsert;
```

**Step 3: Export from barrel**

In `src/server/db/schema/index.ts`, add:

```typescript
export * from "./reminders";
```

**Step 4: Push schema to database**

Run: `npx drizzle-kit push`

Expected: Migration applies, `property_reminders` table and `reminder_type` enum created.

**Step 5: Commit**

```bash
git add src/server/db/schema/enums.ts src/server/db/schema/reminders.ts src/server/db/schema/index.ts
git commit -m "feat: add reminderTypeEnum and property_reminders schema"
```

---

### Task 2: Repository — ReminderRepository with interface

**Files:**
- Create: `src/server/repositories/interfaces/reminder.repository.interface.ts`
- Modify: `src/server/repositories/interfaces/index.ts`
- Create: `src/server/repositories/reminder.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts`

**Step 1: Create repository interface**

Create `src/server/repositories/interfaces/reminder.repository.interface.ts`:

```typescript
import type { PropertyReminder, NewPropertyReminder } from "../../db/schema";
import type { DB } from "../base";

export interface IReminderRepository {
  /** List all reminders for a user, optionally filtered by property */
  findByOwner(
    userId: string,
    opts?: { propertyId?: string }
  ): Promise<PropertyReminder[]>;

  /** Get a single reminder by id scoped to user */
  findById(id: string, userId: string): Promise<PropertyReminder | null>;

  /** Get reminders due within N days from today, excluding completed */
  findUpcoming(userId: string, days: number): Promise<PropertyReminder[]>;

  /** Get reminders for a specific calendar month, excluding completed */
  findByMonth(
    userId: string,
    year: number,
    month: number
  ): Promise<PropertyReminder[]>;

  /** Find reminders that need notification today based on reminderDaysBefore */
  findDueForNotification(today: string): Promise<
    (PropertyReminder & { userEmail: string; propertyAddress: string })[]
  >;

  /** Create a reminder */
  create(data: NewPropertyReminder, tx?: DB): Promise<PropertyReminder>;

  /** Update a reminder */
  update(
    id: string,
    userId: string,
    data: Partial<PropertyReminder>,
    tx?: DB
  ): Promise<PropertyReminder | null>;

  /** Delete a reminder */
  delete(id: string, userId: string, tx?: DB): Promise<void>;
}
```

**Step 2: Export from interfaces barrel**

In `src/server/repositories/interfaces/index.ts`, add:

```typescript
export type { IReminderRepository } from "./reminder.repository.interface";
```

**Step 3: Create repository implementation**

Create `src/server/repositories/reminder.repository.ts`:

```typescript
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { propertyReminders, users, properties } from "../db/schema";
import type { PropertyReminder, NewPropertyReminder } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IReminderRepository } from "./interfaces/reminder.repository.interface";

export class ReminderRepository
  extends BaseRepository
  implements IReminderRepository
{
  async findByOwner(
    userId: string,
    opts?: { propertyId?: string }
  ): Promise<PropertyReminder[]> {
    const conditions = [eq(propertyReminders.userId, userId)];
    if (opts?.propertyId) {
      conditions.push(eq(propertyReminders.propertyId, opts.propertyId));
    }
    return this.db.query.propertyReminders.findMany({
      where: and(...conditions),
      orderBy: (r, { asc }) => [asc(r.dueDate)],
    });
  }

  async findById(
    id: string,
    userId: string
  ): Promise<PropertyReminder | null> {
    const result = await this.db.query.propertyReminders.findFirst({
      where: and(
        eq(propertyReminders.id, id),
        eq(propertyReminders.userId, userId)
      ),
    });
    return result ?? null;
  }

  async findUpcoming(
    userId: string,
    days: number
  ): Promise<PropertyReminder[]> {
    const today = new Date().toISOString().split("T")[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const future = futureDate.toISOString().split("T")[0];

    return this.db.query.propertyReminders.findMany({
      where: and(
        eq(propertyReminders.userId, userId),
        isNull(propertyReminders.completedAt),
        lte(propertyReminders.dueDate, future)
      ),
      orderBy: (r, { asc }) => [asc(r.dueDate)],
    });
  }

  async findByMonth(
    userId: string,
    year: number,
    month: number
  ): Promise<PropertyReminder[]> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    return this.db.query.propertyReminders.findMany({
      where: and(
        eq(propertyReminders.userId, userId),
        isNull(propertyReminders.completedAt),
        gte(propertyReminders.dueDate, startDate),
        lte(propertyReminders.dueDate, endDate)
      ),
      orderBy: (r, { asc }) => [asc(r.dueDate)],
    });
  }

  async findDueForNotification(today: string): Promise<
    (PropertyReminder & { userEmail: string; propertyAddress: string })[]
  > {
    // Find all active reminders where today is one of the notification days
    // Uses raw SQL because we need to check if (dueDate - today) is IN the array
    const results = await this.db
      .select({
        id: propertyReminders.id,
        propertyId: propertyReminders.propertyId,
        userId: propertyReminders.userId,
        reminderType: propertyReminders.reminderType,
        title: propertyReminders.title,
        dueDate: propertyReminders.dueDate,
        reminderDaysBefore: propertyReminders.reminderDaysBefore,
        notes: propertyReminders.notes,
        notifiedAt: propertyReminders.notifiedAt,
        completedAt: propertyReminders.completedAt,
        createdAt: propertyReminders.createdAt,
        updatedAt: propertyReminders.updatedAt,
        userEmail: users.email,
        propertyAddress: properties.address,
      })
      .from(propertyReminders)
      .innerJoin(users, eq(propertyReminders.userId, users.id))
      .innerJoin(properties, eq(propertyReminders.propertyId, properties.id))
      .where(
        and(
          isNull(propertyReminders.completedAt),
          gte(propertyReminders.dueDate, today),
          sql`(${propertyReminders.dueDate}::date - ${today}::date) = ANY(${propertyReminders.reminderDaysBefore})`
        )
      );

    return results as (PropertyReminder & {
      userEmail: string;
      propertyAddress: string;
    })[];
  }

  async create(
    data: NewPropertyReminder,
    tx?: DB
  ): Promise<PropertyReminder> {
    const client = this.resolve(tx);
    const [reminder] = await client
      .insert(propertyReminders)
      .values(data)
      .returning();
    return reminder;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<PropertyReminder>,
    tx?: DB
  ): Promise<PropertyReminder | null> {
    const client = this.resolve(tx);
    const [reminder] = await client
      .update(propertyReminders)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(propertyReminders.id, id),
          eq(propertyReminders.userId, userId)
        )
      )
      .returning();
    return reminder ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(propertyReminders)
      .where(
        and(
          eq(propertyReminders.id, id),
          eq(propertyReminders.userId, userId)
        )
      );
  }
}
```

**Step 4: Register in UnitOfWork**

In `src/server/repositories/unit-of-work.ts`:

1. Add import at top:
```typescript
import type { IReminderRepository } from "./interfaces/reminder.repository.interface";
import { ReminderRepository } from "./reminder.repository";
```

2. Add private field:
```typescript
private _reminder?: IReminderRepository;
```

3. Add lazy getter:
```typescript
get reminder(): IReminderRepository {
  return (this._reminder ??= new ReminderRepository(this.db));
}
```

**Step 5: Commit**

```bash
git add src/server/repositories/
git commit -m "feat: add ReminderRepository with interface and UoW registration"
```

---

### Task 3: Router + unit tests — reminder tRPC router

**Files:**
- Create: `src/server/routers/reminders/reminder.ts`
- Create: `src/server/routers/reminders/index.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `src/server/routers/reminders/__tests__/reminder.test.ts`

**Step 1: Write the test file**

Create `src/server/routers/reminders/__tests__/reminder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";
import type { PropertyReminder } from "../../../db/schema";

let currentMockUow: UnitOfWork;

vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

const mockReminder: PropertyReminder = {
  id: "rem-1",
  propertyId: "prop-1",
  userId: "user-1",
  reminderType: "insurance_renewal",
  title: "Insurance Renewal — 123 Test St",
  dueDate: "2026-04-15",
  reminderDaysBefore: [30, 7],
  notes: null,
  notifiedAt: null,
  completedAt: null,
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
};

describe("reminder router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns all reminders for user", async () => {
      currentMockUow = createMockUow({
        reminder: {
          findByOwner: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.list({});
      expect(result).toEqual([mockReminder]);
      expect(currentMockUow.reminder.findByOwner).toHaveBeenCalledWith("user-1", {});
    });

    it("filters by propertyId when provided", async () => {
      currentMockUow = createMockUow({
        reminder: {
          findByOwner: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      await caller.reminder.list({ propertyId: "prop-1" });
      expect(currentMockUow.reminder.findByOwner).toHaveBeenCalledWith("user-1", {
        propertyId: "prop-1",
      });
    });
  });

  describe("getUpcoming", () => {
    it("returns upcoming reminders with default 90 days", async () => {
      currentMockUow = createMockUow({
        reminder: {
          findUpcoming: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.getUpcoming({});
      expect(result).toEqual([mockReminder]);
      expect(currentMockUow.reminder.findUpcoming).toHaveBeenCalledWith("user-1", 90);
    });

    it("accepts custom days parameter", async () => {
      currentMockUow = createMockUow({
        reminder: {
          findUpcoming: vi.fn().mockResolvedValue([]),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      await caller.reminder.getUpcoming({ days: 30 });
      expect(currentMockUow.reminder.findUpcoming).toHaveBeenCalledWith("user-1", 30);
    });
  });

  describe("getByMonth", () => {
    it("returns reminders for a specific month", async () => {
      currentMockUow = createMockUow({
        reminder: {
          findByMonth: vi.fn().mockResolvedValue([mockReminder]),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.getByMonth({ year: 2026, month: 4 });
      expect(result).toEqual([mockReminder]);
      expect(currentMockUow.reminder.findByMonth).toHaveBeenCalledWith("user-1", 2026, 4);
    });
  });

  describe("create", () => {
    it("creates a reminder with auto-generated title", async () => {
      currentMockUow = createMockUow({
        reminder: {
          create: vi.fn().mockResolvedValue(mockReminder),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.create({
        propertyId: "prop-1",
        reminderType: "insurance_renewal",
        dueDate: "2026-04-15",
        title: "Insurance Renewal — 123 Test St",
      });
      expect(result).toEqual(mockReminder);
      expect(currentMockUow.reminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          propertyId: "prop-1",
          reminderType: "insurance_renewal",
          dueDate: "2026-04-15",
          title: "Insurance Renewal — 123 Test St",
        })
      );
    });

    it("uses default reminderDaysBefore if not provided", async () => {
      currentMockUow = createMockUow({
        reminder: {
          create: vi.fn().mockResolvedValue(mockReminder),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      await caller.reminder.create({
        propertyId: "prop-1",
        reminderType: "lease_expiry",
        dueDate: "2026-06-01",
        title: "Lease Expiry",
      });
      expect(currentMockUow.reminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderDaysBefore: [30, 7],
        })
      );
    });
  });

  describe("update", () => {
    it("updates a reminder", async () => {
      const updated = { ...mockReminder, title: "Updated Title" };
      currentMockUow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(updated),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.update({
        id: "rem-1",
        title: "Updated Title",
      });
      expect(result.title).toBe("Updated Title");
    });

    it("throws NOT_FOUND when reminder does not exist", async () => {
      currentMockUow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      await expect(
        caller.reminder.update({ id: "nonexistent", title: "X" })
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("complete", () => {
    it("sets completedAt timestamp", async () => {
      const completed = { ...mockReminder, completedAt: new Date() };
      currentMockUow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(completed),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      const result = await caller.reminder.complete({ id: "rem-1" });
      expect(result.completedAt).toBeDefined();
      expect(currentMockUow.reminder.update).toHaveBeenCalledWith(
        "rem-1",
        "user-1",
        expect.objectContaining({ completedAt: expect.any(Date) })
      );
    });

    it("throws NOT_FOUND when reminder does not exist", async () => {
      currentMockUow = createMockUow({
        reminder: {
          update: vi.fn().mockResolvedValue(null),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      await expect(
        caller.reminder.complete({ id: "nonexistent" })
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("delete", () => {
    it("deletes a reminder", async () => {
      currentMockUow = createMockUow({
        reminder: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
      });
      const ctx = createMockContext({ userId: "user-1", user: mockUser, uow: currentMockUow });
      const caller = createTestCaller(ctx);

      await caller.reminder.delete({ id: "rem-1" });
      expect(currentMockUow.reminder.delete).toHaveBeenCalledWith("rem-1", "user-1");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/reminders/__tests__/reminder.test.ts`

Expected: FAIL — module `../reminder` not found.

**Step 3: Create the router**

Create `src/server/routers/reminders/reminder.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";

const reminderTypeValues = [
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

export const reminderRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.reminder.findByOwner(ctx.portfolio.ownerId, input);
    }),

  getUpcoming: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.reminder.findUpcoming(ctx.portfolio.ownerId, input.days);
    }),

  getByMonth: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2040),
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
        reminderType: z.enum(reminderTypeValues),
        title: z.string().min(1).max(200),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        reminderDaysBefore: z
          .array(z.number().int().min(0).max(365))
          .min(1)
          .max(5)
          .default([30, 7]),
        notes: z.string().max(1000).optional(),
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
        title: z.string().min(1).max(200).optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
          .optional(),
        reminderDaysBefore: z
          .array(z.number().int().min(0).max(365))
          .min(1)
          .max(5)
          .optional(),
        notes: z.string().max(1000).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.uow.reminder.update(id, ctx.portfolio.ownerId, data);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),

  complete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.uow.reminder.update(
        input.id,
        ctx.portfolio.ownerId,
        { completedAt: new Date() }
      );
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.reminder.delete(input.id, ctx.portfolio.ownerId);
    }),
});
```

**Step 4: Create barrel export**

Create `src/server/routers/reminders/index.ts`:

```typescript
export { reminderRouter } from "./reminder";
```

**Step 5: Register in app router**

In `src/server/routers/_app.ts`:

1. Add import:
```typescript
import { reminderRouter } from "./reminders";
```

2. Add to the `appRouter` definition:
```typescript
reminder: reminderRouter,
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/reminders/__tests__/reminder.test.ts`

Expected: All 9 tests PASS.

**Step 7: Commit**

```bash
git add src/server/routers/reminders/
git commit -m "feat: add reminder tRPC router with 7 procedures and tests"
```

---

### Task 4: Feature flag + sidebar nav item

**Files:**
- Modify: `src/config/feature-flags.ts`
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add feature flag**

In `src/config/feature-flags.ts`:

1. Add to the `featureFlags` object under `// ── Main navigation`:
```typescript
reminders: true,
```

2. Add to `routeToFlag`:
```typescript
"/reminders": "reminders",
```

**Step 2: Add sidebar nav item**

In `src/components/layout/Sidebar.tsx`:

1. Add `Bell` to the lucide-react import (or use `CalendarDays` which is already imported):
```typescript
import { ..., Bell } from "lucide-react";
```

2. Add a new item to the "Properties & Banking" group `items` array, after `{ href: "/banking", ... }`:
```typescript
{ href: "/reminders", label: "Reminders", icon: Bell, featureFlag: "reminders" },
```

**Step 3: Verify sidebar renders**

Run: `npx next dev` and check sidebar shows "Reminders" link.

**Step 4: Commit**

```bash
git add src/config/feature-flags.ts src/components/layout/Sidebar.tsx
git commit -m "feat: add reminders feature flag and sidebar nav item"
```

---

### Task 5: Reminders page — list view

**Files:**
- Create: `src/app/(dashboard)/reminders/page.tsx`

This is the main reminders page with a list view grouped by time horizon. Calendar view will be added in Task 6.

**Step 1: Create the page**

Create `src/app/(dashboard)/reminders/page.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  List,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const REMINDER_TYPE_LABELS: Record<string, string> = {
  lease_expiry: "Lease Expiry",
  insurance_renewal: "Insurance Renewal",
  fixed_rate_expiry: "Fixed Rate Expiry",
  council_rates: "Council Rates",
  body_corporate: "Body Corporate",
  smoke_alarm: "Smoke Alarm",
  pool_safety: "Pool Safety",
  tax_return: "Tax Return",
  custom: "Custom",
};

function getDaysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function CountdownBadge({ dueDate }: { dueDate: string }) {
  const days = getDaysUntil(dueDate);
  if (days < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        {Math.abs(days)}d overdue
      </Badge>
    );
  }
  if (days === 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Due today
      </Badge>
    );
  }
  if (days <= 7) {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
        {days}d left
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      {days}d left
    </Badge>
  );
}

type ViewMode = "list" | "calendar";

export default function RemindersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: reminders, isLoading } = trpc.reminder.list.useQuery({});
  const { data: properties } = trpc.property.list.useQuery();

  const completeMutation = trpc.reminder.complete.useMutation({
    onSuccess: () => {
      toast.success("Reminder completed");
      utils.reminder.list.invalidate();
      utils.reminder.getUpcoming.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = trpc.reminder.delete.useMutation({
    onSuccess: () => {
      toast.success("Reminder deleted");
      setDeleteId(null);
      utils.reminder.list.invalidate();
      utils.reminder.getUpcoming.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Group reminders by time horizon
  const grouped = useMemo(() => {
    if (!reminders) return { overdue: [], thisWeek: [], thisMonth: [], later: [], completed: [] };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const monthFromNow = new Date(now);
    monthFromNow.setDate(monthFromNow.getDate() + 30);

    const overdue: typeof reminders = [];
    const thisWeek: typeof reminders = [];
    const thisMonth: typeof reminders = [];
    const later: typeof reminders = [];
    const completed: typeof reminders = [];

    for (const r of reminders) {
      if (r.completedAt) {
        completed.push(r);
        continue;
      }
      const due = new Date(r.dueDate);
      if (due < now) overdue.push(r);
      else if (due <= weekFromNow) thisWeek.push(r);
      else if (due <= monthFromNow) thisMonth.push(r);
      else later.push(r);
    }

    return { overdue, thisWeek, thisMonth, later, completed };
  }, [reminders]);

  const propertyMap = useMemo(() => {
    if (!properties) return new Map<string, string>();
    return new Map(properties.map((p) => [p.id, p.address]));
  }, [properties]);

  function ReminderRow({ reminder }: { reminder: NonNullable<typeof reminders>[number] }) {
    return (
      <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <Bell className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{reminder.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {propertyMap.get(reminder.propertyId) ?? "Unknown property"} ·{" "}
              {REMINDER_TYPE_LABELS[reminder.reminderType] ?? reminder.reminderType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CountdownBadge dueDate={reminder.dueDate} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => completeMutation.mutate({ id: reminder.id })}
            title="Mark complete"
          >
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDeleteId(reminder.id)}
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  function ReminderGroup({
    label,
    items,
  }: {
    label: string;
    items: NonNullable<typeof reminders>;
  }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
          {label} ({items.length})
        </h3>
        {items.map((r) => (
          <ReminderRow key={r.id} reminder={r} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reminders</h2>
          <p className="text-muted-foreground">
            Track key property dates across your portfolio
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Reminder
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setViewMode("list")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            viewMode === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="w-4 h-4" />
          List
        </button>
        <button
          onClick={() => setViewMode("calendar")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            viewMode === "calendar"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="w-4 h-4" />
          Calendar
        </button>
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-2">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                Loading reminders...
              </div>
            ) : !reminders || reminders.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">No reminders yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Add your first reminder to track key property dates
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reminder
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <ReminderGroup label="Overdue" items={grouped.overdue} />
                <ReminderGroup label="This Week" items={grouped.thisWeek} />
                <ReminderGroup label="This Month" items={grouped.thisMonth} />
                <ReminderGroup label="Later" items={grouped.later} />
                <ReminderGroup label="Completed" items={grouped.completed} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calendar View — placeholder, implemented in Task 6 */}
      {viewMode === "calendar" && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Calendar view coming in next task
          </CardContent>
        </Card>
      )}

      {/* Add Reminder Dialog — implemented in Task 7 */}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Verify page renders**

Run: `npx next dev` and navigate to `/reminders`.

Expected: Page renders with empty state, view toggle pills, Add Reminder button.

**Step 3: Commit**

```bash
git add src/app/\\(dashboard\\)/reminders/page.tsx
git commit -m "feat: add reminders page with list view and time-grouped layout"
```

---

### Task 6: Calendar view with day dots

**Files:**
- Modify: `src/app/(dashboard)/reminders/page.tsx`

**Step 1: Add calendar view implementation**

Replace the calendar placeholder in the page with a full calendar implementation. Add these imports at the top:

```tsx
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
```

Replace the calendar placeholder block with:

```tsx
{viewMode === "calendar" && (
  <Card>
    <CardContent className="p-4">
      <CalendarView
        reminders={reminders ?? []}
        propertyMap={propertyMap}
        onComplete={(id) => completeMutation.mutate({ id })}
        onDelete={(id) => setDeleteId(id)}
      />
    </CardContent>
  </Card>
)}
```

Add a `CalendarView` component inside the file (before `RemindersPage`):

```tsx
function CalendarView({
  reminders,
  propertyMap,
  onComplete,
  onDelete,
}: {
  reminders: NonNullable<ReturnType<typeof trpc.reminder.list.useQuery>["data"]>;
  propertyMap: Map<string, string>;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [month, setMonth] = useState(new Date());

  // Build date -> reminders map
  const dateMap = useMemo(() => {
    const map = new Map<string, typeof reminders>();
    for (const r of reminders) {
      if (r.completedAt) continue;
      const key = r.dueDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [reminders]);

  // Build modifier dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueDates: Date[] = [];
  const urgentDates: Date[] = [];
  const futureDates: Date[] = [];

  for (const [dateStr] of dateMap) {
    const d = new Date(dateStr);
    const days = getDaysUntil(dateStr);
    if (days < 0) overdueDates.push(d);
    else if (days <= 7) urgentDates.push(d);
    else futureDates.push(d);
  }

  const selectedReminders = selectedDay
    ? dateMap.get(selectedDay.toISOString().split("T")[0]) ?? []
    : [];

  return (
    <div className="flex flex-col items-center gap-4">
      <DayPicker
        mode="single"
        selected={selectedDay ?? undefined}
        onSelect={(date) => setSelectedDay(date ?? null)}
        month={month}
        onMonthChange={setMonth}
        modifiers={{
          overdue: overdueDates,
          urgent: urgentDates,
          hasReminder: futureDates,
        }}
        modifiersClassNames={{
          overdue: "reminder-overdue",
          urgent: "reminder-urgent",
          hasReminder: "reminder-future",
        }}
        className="mx-auto"
        classNames={{
          today: "font-bold underline",
        }}
      />

      <style>{`
        .reminder-overdue { position: relative; }
        .reminder-overdue::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: hsl(var(--destructive));
        }
        .reminder-urgent { position: relative; }
        .reminder-urgent::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
        }
        .reminder-future { position: relative; }
        .reminder-future::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: hsl(var(--primary));
        }
      `}</style>

      {/* Selected day panel */}
      {selectedDay && (
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDay.toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reminders on this day
              </p>
            ) : (
              <div className="space-y-2">
                {selectedReminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {propertyMap.get(r.propertyId) ?? "Unknown"} ·{" "}
                        {REMINDER_TYPE_LABELS[r.reminderType]}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onComplete(r.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDelete(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify calendar renders**

Run: `npx next dev` and navigate to `/reminders`, toggle to calendar view.

Expected: Calendar grid renders with month navigation. Days with reminders show colored dots.

**Step 3: Commit**

```bash
git add src/app/\\(dashboard\\)/reminders/page.tsx
git commit -m "feat: add calendar view with color-coded day dots and day detail panel"
```

---

### Task 7: Add Reminder dialog

**Files:**
- Modify: `src/app/(dashboard)/reminders/page.tsx`

**Step 1: Add the AddReminderDialog component**

Add this component inside the page file (before `RemindersPage`):

```tsx
function AddReminderDialog({
  open,
  onOpenChange,
  properties,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: { id: string; address: string }[] | undefined;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [reminderType, setReminderType] = useState<string>("custom");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [daysBefore, setDaysBefore] = useState<number[]>([30, 7]);

  const utils = trpc.useUtils();

  const createMutation = trpc.reminder.create.useMutation({
    onSuccess: () => {
      toast.success("Reminder created");
      onOpenChange(false);
      resetForm();
      utils.reminder.list.invalidate();
      utils.reminder.getUpcoming.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function resetForm() {
    setPropertyId("");
    setReminderType("custom");
    setTitle("");
    setDueDate("");
    setNotes("");
    setDaysBefore([30, 7]);
  }

  // Auto-generate title when type or property changes
  function handleTypeChange(type: string) {
    setReminderType(type);
    if (type !== "custom" && propertyId) {
      const propName = properties?.find((p) => p.id === propertyId)?.address ?? "";
      setTitle(`${REMINDER_TYPE_LABELS[type]} — ${propName}`);
    }
  }

  function handlePropertyChange(id: string) {
    setPropertyId(id);
    if (reminderType !== "custom" && id) {
      const propName = properties?.find((p) => p.id === id)?.address ?? "";
      setTitle(`${REMINDER_TYPE_LABELS[reminderType]} — ${propName}`);
    }
  }

  const toggleDay = (day: number) => {
    setDaysBefore((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => b - a)
    );
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !title || !dueDate || daysBefore.length === 0) return;

    createMutation.mutate({
      propertyId,
      reminderType: reminderType as any,
      title,
      dueDate,
      reminderDaysBefore: daysBefore,
      notes: notes || undefined,
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Reminder</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            {/* Property selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Property</label>
              <select
                value={propertyId}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select a property...</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}
                  </option>
                ))}
              </select>
            </div>

            {/* Reminder type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select
                value={reminderType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(REMINDER_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Insurance Renewal — 123 Test St"
                required
                maxLength={200}
              />
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>

            {/* Reminder timing chips */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Remind me</label>
              <div className="flex flex-wrap gap-2">
                {[30, 14, 7, 1].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      daysBefore.includes(day)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-input hover:bg-muted"
                    )}
                  >
                    {day}d before
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                maxLength={1000}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                !propertyId ||
                !title ||
                !dueDate ||
                daysBefore.length === 0
              }
            >
              {createMutation.isPending ? "Creating..." : "Create Reminder"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Then wire it into `RemindersPage` by replacing the `{/* Add Reminder Dialog — implemented in Task 7 */}` comment:

```tsx
<AddReminderDialog
  open={showAddDialog}
  onOpenChange={setShowAddDialog}
  properties={properties?.map((p) => ({ id: p.id, address: p.address }))}
/>
```

**Step 2: Verify dialog works**

Run: `npx next dev` and click "Add Reminder" button.

Expected: Dialog opens with property selector, type dropdown (auto-fills title), date picker, timing chips, notes field. Submitting creates reminder and closes dialog.

**Step 3: Commit**

```bash
git add src/app/\\(dashboard\\)/reminders/page.tsx
git commit -m "feat: add reminder creation dialog with auto-title and timing chips"
```

---

### Task 8: Dashboard widget — Upcoming Reminders card

**Files:**
- Create: `src/components/dashboard/UpcomingRemindersCard.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx` (add widget to layout)

**Step 1: Create the widget component**

Create `src/components/dashboard/UpcomingRemindersCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Bell, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

function getDaysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function UpcomingRemindersCard() {
  const { data: reminders, isLoading } = trpc.reminder.getUpcoming.useQuery(
    { days: 90 },
    { staleTime: 60_000 }
  );

  // Show max 5 items
  const items = reminders?.slice(0, 5) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Upcoming Reminders
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reminders">
              View All
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No upcoming reminders
            </p>
            <Button variant="link" size="sm" asChild>
              <Link href="/reminders">Add a reminder</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const days = getDaysUntil(r.dueDate);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.dueDate).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  {days < 0 ? (
                    <Badge variant="destructive" className="text-xs flex-shrink-0">
                      Overdue
                    </Badge>
                  ) : days <= 7 ? (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs flex-shrink-0">
                      {days}d
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {days}d
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to dashboard layout**

In `src/components/dashboard/DashboardClient.tsx`, add the import:

```typescript
import { UpcomingRemindersCard } from "./UpcomingRemindersCard";
```

Then add `<UpcomingRemindersCard />` in the dashboard grid layout — after the existing cards. The exact position depends on the current grid layout; place it alongside other insight cards.

**Step 3: Verify widget renders**

Run: `npx next dev` and navigate to `/dashboard`.

Expected: "Upcoming Reminders" card appears showing next 5 reminders with countdown badges.

**Step 4: Commit**

```bash
git add src/components/dashboard/UpcomingRemindersCard.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add Upcoming Reminders dashboard widget"
```

---

### Task 9: Email template + cron route

**Files:**
- Create: `src/lib/email/templates/reminder-due.ts`
- Create: `src/app/api/cron/reminders/route.ts`
- Modify: `vercel.json` (add cron config)

**Step 1: Create email template**

Create `src/lib/email/templates/reminder-due.ts`:

```typescript
import { baseTemplate } from "./base";

interface ReminderDueData {
  title: string;
  propertyAddress: string;
  dueDate: string;
  daysUntil: number;
  reminderType: string;
  notes?: string | null;
}

const REMINDER_TYPE_LABELS: Record<string, string> = {
  lease_expiry: "Lease Expiry",
  insurance_renewal: "Insurance Renewal",
  fixed_rate_expiry: "Fixed Rate Expiry",
  council_rates: "Council Rates",
  body_corporate: "Body Corporate",
  smoke_alarm: "Smoke Alarm Compliance",
  pool_safety: "Pool Safety Certificate",
  tax_return: "Tax Return",
  custom: "Reminder",
};

export function reminderDueTemplate(data: ReminderDueData): string {
  const typeLabel =
    REMINDER_TYPE_LABELS[data.reminderType] ?? data.reminderType;

  const urgencyColor = data.daysUntil <= 7 ? "#dc2626" : "#f59e0b";
  const urgencyLabel =
    data.daysUntil === 0
      ? "Due today"
      : data.daysUntil === 1
        ? "Due tomorrow"
        : `Due in ${data.daysUntil} days`;

  const content = `
    <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid ${urgencyColor};">
      <h2 style="color: ${urgencyColor}; margin: 0 0 8px 0; font-size: 18px;">
        ${urgencyLabel}
      </h2>
      <p style="font-size: 20px; font-weight: bold; margin: 0; color: #1f2937;">
        ${data.title}
      </p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Type</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${typeLabel}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Property</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.propertyAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Due Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.dueDate}</td>
      </tr>
      ${
        data.notes
          ? `<tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Notes</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.notes}</td>
      </tr>`
          : ""
      }
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au"}/reminders"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Reminders
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function reminderDueSubject(data: ReminderDueData): string {
  const urgency =
    data.daysUntil === 0
      ? "TODAY"
      : data.daysUntil === 1
        ? "Tomorrow"
        : `in ${data.daysUntil} days`;

  return `Reminder: ${data.title} — due ${urgency}`;
}
```

**Step 2: Create cron API route**

Create `src/app/api/cron/reminders/route.ts`:

```typescript
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { ReminderRepository } from "@/server/repositories/reminder.repository";
import { sendEmailNotification } from "@/server/services/notification/notification";
import {
  reminderDueTemplate,
  reminderDueSubject,
} from "@/lib/email/templates/reminder-due";
import { propertyReminders } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const repo = new ReminderRepository(db);
    const today = new Date().toISOString().split("T")[0];

    // Find all reminders that need notification today
    const dueReminders = await repo.findDueForNotification(today);

    let sent = 0;
    let errors = 0;

    for (const reminder of dueReminders) {
      const dueDate = new Date(reminder.dueDate);
      const daysUntil = Math.ceil(
        (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const data = {
        title: reminder.title,
        propertyAddress: reminder.propertyAddress,
        dueDate: dueDate.toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        daysUntil,
        reminderType: reminder.reminderType,
        notes: reminder.notes,
      };

      try {
        await sendEmailNotification(
          reminder.userEmail,
          reminderDueSubject(data),
          reminderDueTemplate(data)
        );

        // Update notifiedAt
        await db
          .update(propertyReminders)
          .set({ notifiedAt: new Date() })
          .where(eq(propertyReminders.id, reminder.id));

        sent++;
      } catch (emailError) {
        logger.error("Failed to send reminder email", emailError as Error, {
          reminderId: reminder.id,
          userId: reminder.userId,
        });
        errors++;
      }
    }

    logger.info("Reminder cron completed", {
      found: dueReminders.length,
      sent,
      errors,
    });

    return Response.json({
      success: true,
      found: dueReminders.length,
      sent,
      errors,
    });
  } catch (error) {
    logger.error("Reminder cron failed", error as Error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
```

**Step 3: Add cron to vercel.json**

Check if `vercel.json` exists at the project root. If it does, add to the `crons` array. If not, create it:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 21 * * *"
    }
  ]
}
```

Note: `0 21 * * *` = 9PM UTC = ~7-8AM AEST, so users get reminder emails in the morning.

**Step 4: Add CRON_SECRET to environment**

Add `CRON_SECRET` to `.env.local` for local testing and to Vercel dashboard for production. Use a random 32-character string.

**Step 5: Commit**

```bash
git add src/lib/email/templates/reminder-due.ts src/app/api/cron/reminders/route.ts vercel.json
git commit -m "feat: add reminder email template and daily cron notification job"
```

---

### Task 10: TypeScript check + final test run

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Fix any type errors that arise.

**Step 2: Run full test suite**

Run: `npx vitest run`

Expected: All existing tests pass + new reminder tests pass.

**Step 3: Run lint**

Run: `npx next lint`

Fix any lint errors.

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve type and lint errors in reminders feature"
```
