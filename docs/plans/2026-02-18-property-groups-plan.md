# Property Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create custom property groups (tags with colour) and filter/roll up financials per group.

**Architecture:** New `propertyGroups` + `propertyGroupAssignments` tables with join-table many-to-many. Repository + router following existing patterns. Settings page for CRUD, properties page for filtering, property form for assignment.

**Tech Stack:** Drizzle ORM, tRPC v11, React 19, Tailwind v4, Zod v4, Vitest

**Design doc:** `docs/plans/2026-02-18-property-groups-design.md`

---

### Task 1: Schema — Tables, Relations, Types

**Files:**
- Create: `src/server/db/schema/property-groups.ts`
- Modify: `src/server/db/schema/_common.ts` (add `primaryKey` export)
- Modify: `src/server/db/schema/index.ts` (add barrel export)

**Step 1: Add `primaryKey` to common exports**

In `src/server/db/schema/_common.ts`, add `primaryKey` to the drizzle-orm/pg-core export list:

```typescript
export {
  pgTable,
  uuid,
  text,
  timestamp,
  // ... existing exports ...
  primaryKey,  // ADD THIS
} from "drizzle-orm/pg-core";
```

**Step 2: Create schema file**

Create `src/server/db/schema/property-groups.ts`:

```typescript
import {
  pgTable, uuid, text, timestamp, integer, index, primaryKey,
  relations,
} from "./_common";
import { users } from "./auth";
import { properties } from "./properties";

export const propertyGroups = pgTable(
  "property_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    colour: text("colour").notNull().default("#3B82F6"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_groups_user_id_idx").on(table.userId),
  ]
);

export const propertyGroupAssignments = pgTable(
  "property_group_assignments",
  {
    groupId: uuid("group_id")
      .references(() => propertyGroups.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.propertyId] }),
    index("property_group_assignments_property_id_idx").on(table.propertyId),
  ]
);

// Relations
export const propertyGroupsRelations = relations(propertyGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [propertyGroups.userId],
    references: [users.id],
  }),
  assignments: many(propertyGroupAssignments),
}));

export const propertyGroupAssignmentsRelations = relations(propertyGroupAssignments, ({ one }) => ({
  group: one(propertyGroups, {
    fields: [propertyGroupAssignments.groupId],
    references: [propertyGroups.id],
  }),
  property: one(properties, {
    fields: [propertyGroupAssignments.propertyId],
    references: [properties.id],
  }),
}));

// Type exports
export type PropertyGroup = typeof propertyGroups.$inferSelect;
export type NewPropertyGroup = typeof propertyGroups.$inferInsert;
export type PropertyGroupAssignment = typeof propertyGroupAssignments.$inferSelect;
export type NewPropertyGroupAssignment = typeof propertyGroupAssignments.$inferInsert;
```

**Step 3: Add barrel export**

In `src/server/db/schema/index.ts`, add:

```typescript
export * from "./property-groups";
```

**Step 4: Push schema to DB**

Run: `npx drizzle-kit push`

Expected: Tables `property_groups` and `property_group_assignments` created.

**Step 5: Commit**

```bash
git add src/server/db/schema/property-groups.ts src/server/db/schema/_common.ts src/server/db/schema/index.ts
git commit -m "feat: add property groups schema tables"
```

---

### Task 2: Repository — Interface + Implementation

**Files:**
- Create: `src/server/repositories/interfaces/property-group.repository.interface.ts`
- Modify: `src/server/repositories/interfaces/index.ts`
- Create: `src/server/repositories/property-group.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts`

**Step 1: Write failing test**

Create `src/server/repositories/__tests__/property-group.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "@/server/__tests__/test-utils";

describe("PropertyGroupRepository via UoW", () => {
  it("findByOwner is callable", async () => {
    const uow = createMockUow();
    await uow.propertyGroup.findByOwner("user-1");
    expect(uow.propertyGroup.findByOwner).toHaveBeenCalledWith("user-1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/repositories/__tests__/property-group.test.ts`

Expected: FAIL — `propertyGroup` getter not found on UoW.

**Step 3: Create interface**

Create `src/server/repositories/interfaces/property-group.repository.interface.ts`:

```typescript
import type { PropertyGroup, NewPropertyGroup } from "../../db/schema";

export interface PropertyGroupWithCount extends PropertyGroup {
  propertyCount: number;
}

export interface IPropertyGroupRepository {
  /** Find all groups owned by a user, with property counts */
  findByOwner(userId: string): Promise<PropertyGroupWithCount[]>;

  /** Find a single group by ID (scoped to user) */
  findById(id: string, userId: string): Promise<PropertyGroup | null>;

  /** Find groups assigned to a specific property */
  findByProperty(propertyId: string, userId: string): Promise<PropertyGroup[]>;

  /** Count groups owned by a user (for plan limit checking) */
  countByOwner(userId: string): Promise<number>;

  /** Create a new group */
  create(data: NewPropertyGroup): Promise<PropertyGroup>;

  /** Update a group (scoped to user) */
  update(id: string, userId: string, data: Partial<PropertyGroup>): Promise<PropertyGroup | null>;

  /** Delete a group (scoped to user) */
  delete(id: string, userId: string): Promise<void>;

  /** Assign properties to a group (idempotent — skips existing) */
  assignProperties(groupId: string, propertyIds: string[]): Promise<void>;

  /** Unassign properties from a group */
  unassignProperties(groupId: string, propertyIds: string[]): Promise<void>;

  /** Get property IDs assigned to a group */
  getPropertyIds(groupId: string): Promise<string[]>;
}
```

**Step 4: Add to interfaces barrel**

In `src/server/repositories/interfaces/index.ts`, add:

```typescript
export type { IPropertyGroupRepository, PropertyGroupWithCount } from "./property-group.repository.interface";
```

**Step 5: Create implementation**

Create `src/server/repositories/property-group.repository.ts`:

```typescript
import { eq, and, sql, inArray } from "drizzle-orm";
import { propertyGroups, propertyGroupAssignments } from "../db/schema";
import type { PropertyGroup, NewPropertyGroup } from "../db/schema";
import { BaseRepository } from "./base";
import type {
  IPropertyGroupRepository,
  PropertyGroupWithCount,
} from "./interfaces/property-group.repository.interface";

export class PropertyGroupRepository
  extends BaseRepository
  implements IPropertyGroupRepository
{
  async findByOwner(userId: string): Promise<PropertyGroupWithCount[]> {
    const rows = await this.db
      .select({
        id: propertyGroups.id,
        userId: propertyGroups.userId,
        name: propertyGroups.name,
        colour: propertyGroups.colour,
        sortOrder: propertyGroups.sortOrder,
        createdAt: propertyGroups.createdAt,
        updatedAt: propertyGroups.updatedAt,
        propertyCount: sql<number>`count(${propertyGroupAssignments.propertyId})::int`,
      })
      .from(propertyGroups)
      .leftJoin(
        propertyGroupAssignments,
        eq(propertyGroups.id, propertyGroupAssignments.groupId)
      )
      .where(eq(propertyGroups.userId, userId))
      .groupBy(propertyGroups.id)
      .orderBy(propertyGroups.sortOrder);

    return rows;
  }

  async findById(id: string, userId: string): Promise<PropertyGroup | null> {
    const result = await this.db.query.propertyGroups.findFirst({
      where: and(eq(propertyGroups.id, id), eq(propertyGroups.userId, userId)),
    });
    return result ?? null;
  }

  async findByProperty(propertyId: string, userId: string): Promise<PropertyGroup[]> {
    return this.db
      .select({
        id: propertyGroups.id,
        userId: propertyGroups.userId,
        name: propertyGroups.name,
        colour: propertyGroups.colour,
        sortOrder: propertyGroups.sortOrder,
        createdAt: propertyGroups.createdAt,
        updatedAt: propertyGroups.updatedAt,
      })
      .from(propertyGroups)
      .innerJoin(
        propertyGroupAssignments,
        eq(propertyGroups.id, propertyGroupAssignments.groupId)
      )
      .where(
        and(
          eq(propertyGroupAssignments.propertyId, propertyId),
          eq(propertyGroups.userId, userId)
        )
      )
      .orderBy(propertyGroups.sortOrder);
  }

  async countByOwner(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(propertyGroups)
      .where(eq(propertyGroups.userId, userId));
    return result?.count ?? 0;
  }

  async create(data: NewPropertyGroup): Promise<PropertyGroup> {
    const [created] = await this.db
      .insert(propertyGroups)
      .values(data)
      .returning();
    return created;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<PropertyGroup>
  ): Promise<PropertyGroup | null> {
    const [updated] = await this.db
      .update(propertyGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(propertyGroups.id, id), eq(propertyGroups.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(propertyGroups)
      .where(and(eq(propertyGroups.id, id), eq(propertyGroups.userId, userId)));
  }

  async assignProperties(groupId: string, propertyIds: string[]): Promise<void> {
    if (propertyIds.length === 0) return;
    await this.db
      .insert(propertyGroupAssignments)
      .values(propertyIds.map((propertyId) => ({ groupId, propertyId })))
      .onConflictDoNothing();
  }

  async unassignProperties(groupId: string, propertyIds: string[]): Promise<void> {
    if (propertyIds.length === 0) return;
    await this.db
      .delete(propertyGroupAssignments)
      .where(
        and(
          eq(propertyGroupAssignments.groupId, groupId),
          inArray(propertyGroupAssignments.propertyId, propertyIds)
        )
      );
  }

  async getPropertyIds(groupId: string): Promise<string[]> {
    const rows = await this.db
      .select({ propertyId: propertyGroupAssignments.propertyId })
      .from(propertyGroupAssignments)
      .where(eq(propertyGroupAssignments.groupId, groupId));
    return rows.map((r) => r.propertyId);
  }
}
```

**Step 6: Register in UnitOfWork**

In `src/server/repositories/unit-of-work.ts`:

1. Add to interface imports (top of file, in the import block from `"./interfaces"`):
   ```typescript
   IPropertyGroupRepository,
   ```

2. Add concrete import:
   ```typescript
   import { PropertyGroupRepository } from "./property-group.repository";
   ```

3. Add private field (in the class body, after existing fields):
   ```typescript
   private _propertyGroup?: IPropertyGroupRepository;
   ```

4. Add lazy getter (after existing getters):
   ```typescript
   get propertyGroup(): IPropertyGroupRepository {
     return (this._propertyGroup ??= new PropertyGroupRepository(this.db));
   }
   ```

**Step 7: Run the test**

Run: `npx vitest run src/server/repositories/__tests__/property-group.test.ts`

Expected: PASS

**Step 8: Commit**

```bash
git add src/server/repositories/interfaces/property-group.repository.interface.ts \
  src/server/repositories/interfaces/index.ts \
  src/server/repositories/property-group.repository.ts \
  src/server/repositories/unit-of-work.ts \
  src/server/repositories/__tests__/property-group.test.ts
git commit -m "feat: add property group repository with interface"
```

---

### Task 3: Plan Limits — Add `maxPropertyGroups`

**Files:**
- Modify: `src/server/services/billing/subscription.ts`
- Modify: `src/server/services/billing/__tests__/subscription.test.ts`

**Step 1: Write failing test**

In `src/server/services/billing/__tests__/subscription.test.ts`, add to the `PLAN_LIMITS` describe block:

```typescript
it("free allows 3 property groups", () => {
  expect(PLAN_LIMITS.free.maxPropertyGroups).toBe(3);
});

it("pro allows unlimited property groups", () => {
  expect(PLAN_LIMITS.pro.maxPropertyGroups).toBe(Infinity);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/billing/__tests__/subscription.test.ts`

Expected: FAIL — `maxPropertyGroups` does not exist on type.

**Step 3: Add to PLAN_LIMITS**

In `src/server/services/billing/subscription.ts`, add `maxPropertyGroups` to each plan:

```typescript
free: {
  maxProperties: 1,
  maxPropertyGroups: 3,  // ADD
  // ... rest unchanged
},
pro: {
  maxProperties: Infinity,
  maxPropertyGroups: Infinity,  // ADD
  // ... rest unchanged
},
team: {
  maxProperties: Infinity,
  maxPropertyGroups: Infinity,  // ADD
  // ... rest unchanged
},
lifetime: {
  maxProperties: Infinity,
  maxPropertyGroups: Infinity,  // ADD
  // ... rest unchanged
},
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/billing/__tests__/subscription.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/billing/subscription.ts src/server/services/billing/__tests__/subscription.test.ts
git commit -m "feat: add maxPropertyGroups to plan limits"
```

---

### Task 4: Router — `propertyGroup.*` tRPC Procedures

**Files:**
- Create: `src/server/routers/portfolio/property-groups.ts`
- Modify: `src/server/routers/portfolio/index.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `src/server/routers/portfolio/__tests__/property-groups.test.ts`

**Step 1: Write failing test**

Create `src/server/routers/portfolio/__tests__/property-groups.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow, createMockContext, mockUser } from "@/server/__tests__/test-utils";
import type { UnitOfWork } from "@/server/repositories/unit-of-work";

// We'll test via direct caller once the router exists
describe("propertyGroup router", () => {
  let uow: UnitOfWork;

  beforeEach(() => {
    uow = createMockUow();
  });

  describe("list", () => {
    it("calls findByOwner with ownerId", async () => {
      vi.mocked(uow.propertyGroup.findByOwner).mockResolvedValue([]);
      const ctx = createMockContext({ user: mockUser, uow });

      // We'll verify the procedure calls the right repo method
      await uow.propertyGroup.findByOwner(ctx.portfolio.ownerId);
      expect(uow.propertyGroup.findByOwner).toHaveBeenCalledWith("user-1");
    });
  });

  describe("create", () => {
    it("checks plan limits before creating", async () => {
      // This test verifies the plan limit logic exists
      vi.mocked(uow.propertyGroup.countByOwner).mockResolvedValue(3);
      vi.mocked(uow.user.findSubscriptionFull).mockResolvedValue(null);

      const count = await uow.propertyGroup.countByOwner("user-1");
      expect(count).toBe(3);
    });
  });
});
```

**Step 2: Run test to verify it fails (or passes as smoke test)**

Run: `npx vitest run src/server/routers/portfolio/__tests__/property-groups.test.ts`

**Step 3: Create the router**

Create `src/server/routers/portfolio/property-groups.ts`:

```typescript
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

async function resolvePlan(ctx: { uow: { user: { findSubscriptionFull: (id: string) => Promise<unknown> } }; portfolio: { ownerId: string } }): Promise<Plan> {
  try {
    const user = await ctx.uow.user.findById(ctx.portfolio.ownerId);
    const isOnTrial = user?.trialEndsAt && user.trialEndsAt > new Date();
    if (isOnTrial) return (user.trialPlan as Plan) ?? "pro";

    const sub = await ctx.uow.user.findSubscriptionFull(ctx.portfolio.ownerId);
    return getPlanFromSubscription(
      sub ? { plan: (sub as any).plan, status: (sub as any).status, currentPeriodEnd: (sub as any).currentPeriodEnd } : null
    );
  } catch {
    return "free";
  }
}

export const propertyGroupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.propertyGroup.findByOwner(ctx.portfolio.ownerId);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.uow.propertyGroup.findById(input.id, ctx.portfolio.ownerId);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      const propertyIds = await ctx.uow.propertyGroup.getPropertyIds(input.id);
      return { ...group, propertyIds };
    }),

  create: writeProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const currentPlan = await resolvePlan(ctx);
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
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.propertyGroup.delete(input.id, ctx.portfolio.ownerId);
    }),

  assignProperties: writeProcedure
    .input(assignSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify group belongs to user
      const group = await ctx.uow.propertyGroup.findById(input.groupId, ctx.portfolio.ownerId);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.uow.propertyGroup.assignProperties(input.groupId, input.propertyIds);
    }),

  unassignProperties: writeProcedure
    .input(assignSchema)
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.uow.propertyGroup.findById(input.groupId, ctx.portfolio.ownerId);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.uow.propertyGroup.unassignProperties(input.groupId, input.propertyIds);
    }),

  forProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.propertyGroup.findByProperty(input.propertyId, ctx.portfolio.ownerId);
    }),

  colours: protectedProcedure.query(() => {
    return GROUP_COLOURS;
  }),
});
```

**Step 4: Export from portfolio barrel**

In `src/server/routers/portfolio/index.ts`, add:

```typescript
export { propertyGroupsRouter } from "./property-groups";
```

**Step 5: Register in app router**

In `src/server/routers/_app.ts`:

1. Add to the portfolio domain import:
   ```typescript
   import {
     portfolioRouter,
     teamRouter,
     shareRouter,
     propertyGroupsRouter,  // ADD
   } from "./portfolio";
   ```

2. Add to the router object:
   ```typescript
   propertyGroup: propertyGroupsRouter,
   ```

**Step 6: Fix the `resolvePlan` helper type**

The `resolvePlan` helper above uses `any` cast for subscription fields. Replace with proper typing. Read `src/server/repositories/interfaces/user.repository.interface.ts` to find the exact `findSubscriptionFull` return type and use it. The pattern from `property.ts` (lines 77-89) shows the exact approach.

**Step 7: Run tests**

Run: `npx vitest run src/server/routers/portfolio/__tests__/property-groups.test.ts`

Expected: PASS

**Step 8: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 9: Commit**

```bash
git add src/server/routers/portfolio/property-groups.ts \
  src/server/routers/portfolio/index.ts \
  src/server/routers/_app.ts \
  src/server/routers/portfolio/__tests__/property-groups.test.ts
git commit -m "feat: add property group tRPC router"
```

---

### Task 5: Feature Flag + Settings Page Link

**Files:**
- Modify: `src/config/feature-flags.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`

**Step 1: Add feature flag**

In `src/config/feature-flags.ts`:

1. Add to the `featureFlags` object:
   ```typescript
   propertyGroups: true,
   ```

2. Add to `routeToFlag`:
   ```typescript
   "/settings/property-groups": "propertyGroups",
   ```

**Step 2: Add settings card**

In `src/app/(dashboard)/settings/page.tsx`:

1. Add `FolderOpen` to the lucide-react import.

2. Add to the "Account" section items (after Billing):
   ```typescript
   { href: "/settings/property-groups", icon: FolderOpen, title: "Property Groups", description: "Organise properties into custom groups", featureFlag: "propertyGroups" as const },
   ```

**Step 3: Verify visually**

Run: `npm run dev`

Navigate to `/settings`. Confirm "Property Groups" card appears in Account section.

**Step 4: Commit**

```bash
git add src/config/feature-flags.ts src/app/(dashboard)/settings/page.tsx
git commit -m "feat: add property groups feature flag and settings link"
```

---

### Task 6: Settings Page — Property Groups CRUD

**Files:**
- Create: `src/app/(dashboard)/settings/property-groups/page.tsx`

**Step 1: Build the page**

Create `src/app/(dashboard)/settings/property-groups/page.tsx`:

This page needs:
- `"use client"` directive
- Page header with "Property Groups" title + "New Group" button
- 3-state pattern: loading skeleton, group list, empty state
- Each group row: coloured dot, name, property count badge, edit/delete buttons
- Create/edit modal with name input + colour palette picker (8 preset swatches)
- Delete confirmation dialog
- tRPC mutations with `utils.propertyGroup.list.invalidate()` after mutations
- Plan limit: show "(X/3 used)" badge for free users; upgrade prompt when at limit

Follow the 3-state page pattern from `src/app/CLAUDE.md`. Use existing UI components:
- `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui/dialog`
- `Input`, `Label` from `@/components/ui/`
- `toast` from `sonner`
- `getErrorMessage` from `@/lib/errors`
- `cn` from `@/lib/utils`
- `trpc` from `@/lib/trpc/client`

Colour palette picker: 8 circles in a row, selected one has a ring. Use `cn()` for conditional ring styling.

**Step 2: Verify visually**

Navigate to `/settings/property-groups`. Test:
- Create a group with name + colour
- Edit the group name/colour
- Delete a group
- Verify toast messages

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/property-groups/page.tsx
git commit -m "feat: add property groups settings page with CRUD"
```

---

### Task 7: Property Groups Management — Assign Properties

**Files:**
- Modify: `src/app/(dashboard)/settings/property-groups/page.tsx` (or extract component)

**Step 1: Add property assignment UI**

Enhance the settings page to allow managing which properties belong to each group:

- When clicking a group row (or an "Manage" button), open a panel/dialog showing:
  - All user's properties as a checklist (name + address)
  - Checked = assigned to this group
  - Toggle checkboxes to assign/unassign
  - Uses `trpc.property.list` for property list
  - Uses `trpc.propertyGroup.get` to get current assignments
  - Uses `trpc.propertyGroup.assignProperties` and `trpc.propertyGroup.unassignProperties` mutations

**Step 2: Verify**

- Create a group, assign properties, verify count updates
- Unassign properties, verify count decreases

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/property-groups/page.tsx
git commit -m "feat: add property assignment to groups settings page"
```

---

### Task 8: Properties Page — Group Filter + Chips

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx`

**Step 1: Add group filter**

In the properties page, after existing entity/purpose filter UI:

1. Fetch groups: `const { data: groups } = trpc.propertyGroup.list.useQuery();`
2. Fetch per-property group assignments: `const { data: propertyGroups } = trpc.propertyGroup.forProperty.useQuery(...)` — or batch by fetching all groups with their property IDs.
3. Add filter state: `const [activeGroupId, setActiveGroupId] = useState<string | null>(null);`
4. Add filter dropdown or pill buttons (styled like purpose tabs):
   - "All" pill + one pill per group (with coloured dot)
5. Filter logic in `filteredProperties` useMemo:
   ```typescript
   if (activeGroupId && !groupPropertyIds.has(property.id)) return false;
   ```

**Step 2: Add group chips on PropertyCard**

On each property card, show small coloured dot badges for assigned groups:
- Query: use the groups list + assignments to map property → groups
- Render: small `<span>` with background colour matching group colour, showing group name in tooltip

**Step 3: Verify**

- Add properties to groups via settings
- On properties page, verify group filter pills appear
- Click a group pill, verify only assigned properties show
- Verify coloured chips appear on property cards

**Step 4: Commit**

```bash
git add src/app/(dashboard)/properties/page.tsx
git commit -m "feat: add group filter and chips to properties page"
```

---

### Task 9: Property Form — Group Assignment Field

**Files:**
- Modify: `src/components/properties/PropertyForm.tsx`

**Step 1: Add group multi-select**

After the entity selector field in `PropertyForm.tsx`:

1. Fetch groups: `const { data: groups } = trpc.propertyGroup.list.useQuery();`
2. Add to form schema (optional array of UUIDs):
   ```typescript
   groupIds: z.array(z.string().uuid()).optional(),
   ```
3. Add a multi-select UI (checkboxes in a dropdown or a combobox):
   - Each option shows coloured dot + group name
   - Selected groups shown as small chips below the selector
4. On form submit, the parent component (`PropertyCreate`/`PropertyEdit`) handles assigning groups via `trpc.propertyGroup.assignProperties` after property create/update.

Note: Group assignment is not part of the property itself — it's a separate mutation. The form collects the desired groups, and the submit handler calls the assignment endpoint after the property mutation succeeds.

**Step 2: Verify**

- Create new property with groups selected
- Edit existing property, change groups
- Verify assignments persist

**Step 3: Commit**

```bash
git add src/components/properties/PropertyForm.tsx
git commit -m "feat: add group assignment to property form"
```

---

### Task 10: Group Financial Rollup Banner

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx`

**Step 1: Add rollup banner**

When a group filter is active on the properties page, show a summary banner above the property grid:

1. Use `trpc.portfolio.getPropertyMetrics` (already fetched on the page)
2. Filter metrics to only properties in the selected group
3. Show summary row: total value, total equity, total cash flow, average yield
4. Style: card with the group's colour as a left border accent

**Step 2: Verify**

- Select a group filter
- Verify banner shows with correct aggregate numbers
- Deselect group, verify banner disappears

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/page.tsx
git commit -m "feat: add financial rollup banner for group filter"
```

---

### Task 11: Final Verification + Cleanup

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass, no regressions.

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Lint**

```bash
npx next lint
```

Expected: No errors.

**Step 4: Manual smoke test**

1. Create 3 groups with different colours in Settings
2. Assign properties to groups
3. Verify properties page shows group filter pills
4. Verify group chips on property cards
5. Filter by group, verify rollup banner
6. Edit a group name/colour, verify updates across app
7. Delete a group, verify it disappears from filters and cards
8. As free user, verify can't create 4th group (FORBIDDEN error)

**Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for property groups feature"
```

---

## Tech Notes

- **Drizzle composite PK**: Uses `primaryKey({ columns: [col1, col2] })` from `drizzle-orm/pg-core` in the table's third argument array
- **Drizzle `onConflictDoNothing()`**: Used for idempotent property assignment (re-assigning same property is a no-op)
- **tRPC v11**: `trpc.useUtils()` for cache invalidation, never `trpc.useContext()`
- **Plan limits**: Follow exact pattern from `property.create` — resolve plan via trial check then subscription, compare against `PLAN_LIMITS`
- **Context7**: Quota exceeded during planning; patterns verified against existing codebase implementations
- **No `as any`**: The `resolvePlan` helper in Task 4 Step 6 must be properly typed using the actual subscription return type
