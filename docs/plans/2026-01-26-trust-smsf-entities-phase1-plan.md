# Trust/SMSF Entity Support - Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add core entity infrastructure - schema, CRUD, entity switcher, migrate properties to entities.

**Architecture:** Entities replace portfolios as the primary organizational unit. Properties belong to entities. Users access entities via entity_members.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, React, Tailwind CSS

---

### Task 1: Add Entity Types

**Files:**
- Create: `src/types/entity.ts`

**Step 1: Create entity types**

Create `src/types/entity.ts`:

```typescript
export type EntityType = "personal" | "trust" | "smsf" | "company";

export interface Entity {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  abn: string | null;
  tfn: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrustDetails {
  id: string;
  entityId: string;
  trusteeType: "individual" | "corporate";
  trusteeName: string;
  settlementDate: string | null;
  trustDeedDate: string | null;
}

export interface SmsfDetails {
  id: string;
  entityId: string;
  fundName: string;
  fundAbn: string | null;
  establishmentDate: string | null;
  auditorName: string | null;
  auditorContact: string | null;
}

export interface EntityMember {
  id: string;
  entityId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "accountant";
  invitedBy: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
}

export type EntityWithDetails = Entity & {
  trustDetails?: TrustDetails | null;
  smsfDetails?: SmsfDetails | null;
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/entity.ts
git commit -m "feat: add entity types"
```

---

### Task 2: Add Entity Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add entity enums**

Add after the existing enums (around line 30):

```typescript
export const entityTypeEnum = pgEnum("entity_type", [
  "personal",
  "trust",
  "smsf",
  "company",
]);

export const trusteeTypeEnum = pgEnum("trustee_type", [
  "individual",
  "corporate",
]);

export const entityMemberRoleEnum = pgEnum("entity_member_role", [
  "owner",
  "admin",
  "member",
  "accountant",
]);
```

**Step 2: Add entities table**

Add after the users table:

```typescript
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: entityTypeEnum("type").notNull(),
    name: text("name").notNull(),
    abn: text("abn"),
    tfn: text("tfn"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("entities_user_id_idx").on(table.userId),
  ]
);

export const trustDetails = pgTable("trust_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .references(() => entities.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  trusteeType: trusteeTypeEnum("trustee_type").notNull(),
  trusteeName: text("trustee_name").notNull(),
  settlementDate: date("settlement_date"),
  trustDeedDate: date("trust_deed_date"),
});

export const smsfDetails = pgTable("smsf_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .references(() => entities.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  fundName: text("fund_name").notNull(),
  fundAbn: text("fund_abn"),
  establishmentDate: date("establishment_date"),
  auditorName: text("auditor_name"),
  auditorContact: text("auditor_contact"),
});

export const entityMembers = pgTable(
  "entity_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: entityMemberRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at"),
  },
  (table) => [
    index("entity_members_entity_id_idx").on(table.entityId),
    index("entity_members_user_id_idx").on(table.userId),
  ]
);
```

**Step 3: Add relations**

Add with the other relations:

```typescript
export const entitiesRelations = relations(entities, ({ one, many }) => ({
  user: one(users, {
    fields: [entities.userId],
    references: [users.id],
  }),
  trustDetails: one(trustDetails),
  smsfDetails: one(smsfDetails),
  members: many(entityMembers),
  properties: many(properties),
}));

export const trustDetailsRelations = relations(trustDetails, ({ one }) => ({
  entity: one(entities, {
    fields: [trustDetails.entityId],
    references: [entities.id],
  }),
}));

export const smsfDetailsRelations = relations(smsfDetails, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfDetails.entityId],
    references: [entities.id],
  }),
}));

export const entityMembersRelations = relations(entityMembers, ({ one }) => ({
  entity: one(entities, {
    fields: [entityMembers.entityId],
    references: [entities.id],
  }),
  user: one(users, {
    fields: [entityMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [entityMembers.invitedBy],
    references: [users.id],
    relationName: "entityInviter",
  }),
}));
```

**Step 4: Add type exports**

Add at the end with other type exports:

```typescript
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type TrustDetails = typeof trustDetails.$inferSelect;
export type NewTrustDetails = typeof trustDetails.$inferInsert;
export type SmsfDetails = typeof smsfDetails.$inferSelect;
export type NewSmsfDetails = typeof smsfDetails.$inferInsert;
export type EntityMember = typeof entityMembers.$inferSelect;
export type NewEntityMember = typeof entityMembers.$inferInsert;
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: add entity schema tables"
```

---

### Task 3: Add entityId to Properties

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add entityId column to properties**

In the properties table definition, add after userId:

```typescript
entityId: uuid("entity_id").references(() => entities.id, {
  onDelete: "set null",
}),
```

**Step 2: Update propertiesRelations**

Add entity relation:

```typescript
entity: one(entities, {
  fields: [properties.entityId],
  references: [entities.id],
}),
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: add entityId to properties"
```

---

### Task 4: Generate and Run Migration

**Step 1: Generate migration**

Run: `npm run db:generate`
Expected: Migration file created

**Step 2: Review migration**

Check the generated SQL in `drizzle/` folder

**Step 3: Push to database**

Run: `npm run db:push`
Expected: Schema updated

**Step 4: Commit migration**

```bash
git add drizzle/
git commit -m "chore: add entity migration"
```

---

### Task 5: Create Entity Service

**Files:**
- Create: `src/server/services/entity.ts`
- Create: `src/server/services/__tests__/entity.test.ts`

**Step 1: Write the tests**

Create `src/server/services/__tests__/entity.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getEntityPermissions,
  canAccessEntity,
  type EntityRole,
} from "../entity";

describe("entity service", () => {
  describe("getEntityPermissions", () => {
    it("returns full permissions for owner", () => {
      const perms = getEntityPermissions("owner");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canManageBanks).toBe(true);
      expect(perms.canViewFinancials).toBe(true);
    });

    it("returns full permissions for admin", () => {
      const perms = getEntityPermissions("admin");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canManageBanks).toBe(true);
    });

    it("returns limited permissions for member", () => {
      const perms = getEntityPermissions("member");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
    });

    it("returns read-only permissions for accountant", () => {
      const perms = getEntityPermissions("accountant");
      expect(perms.canWrite).toBe(false);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
      expect(perms.canViewFinancials).toBe(true);
    });
  });

  describe("canAccessEntity", () => {
    it("returns true for entity owner", () => {
      expect(canAccessEntity("user1", "user1", undefined)).toBe(true);
    });

    it("returns true for joined member", () => {
      const membership = { joinedAt: new Date(), role: "member" as EntityRole };
      expect(canAccessEntity("user2", "user1", membership)).toBe(true);
    });

    it("returns false for pending member", () => {
      const membership = { joinedAt: null, role: "member" as EntityRole };
      expect(canAccessEntity("user2", "user1", membership)).toBe(false);
    });

    it("returns false for non-member", () => {
      expect(canAccessEntity("user2", "user1", undefined)).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/entity.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement the service**

Create `src/server/services/entity.ts`:

```typescript
export type EntityRole = "owner" | "admin" | "member" | "accountant";

export interface EntityPermissions {
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewFinancials: boolean;
}

export function getEntityPermissions(role: EntityRole): EntityPermissions {
  switch (role) {
    case "owner":
    case "admin":
      return {
        canWrite: true,
        canManageMembers: true,
        canManageBanks: true,
        canViewFinancials: true,
      };
    case "member":
      return {
        canWrite: true,
        canManageMembers: false,
        canManageBanks: false,
        canViewFinancials: true,
      };
    case "accountant":
      return {
        canWrite: false,
        canManageMembers: false,
        canManageBanks: false,
        canViewFinancials: true,
      };
  }
}

export function canAccessEntity(
  userId: string,
  entityOwnerId: string,
  membership: { joinedAt: Date | null; role: EntityRole } | undefined
): boolean {
  // Owner always has access
  if (userId === entityOwnerId) {
    return true;
  }

  // Must have joined membership
  if (membership && membership.joinedAt) {
    return true;
  }

  return false;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/entity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/entity.ts src/server/services/__tests__/entity.test.ts
git commit -m "feat: add entity service with tests"
```

---

### Task 6: Create Entity Router

**Files:**
- Create: `src/server/routers/entity.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/entity.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { entities, trustDetails, smsfDetails, entityMembers, properties } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const createEntitySchema = z.object({
  type: z.enum(["personal", "trust", "smsf", "company"]),
  name: z.string().min(1, "Name is required"),
  abn: z.string().optional(),
  tfn: z.string().optional(),
  trustDetails: z
    .object({
      trusteeType: z.enum(["individual", "corporate"]),
      trusteeName: z.string().min(1),
      settlementDate: z.string().optional(),
      trustDeedDate: z.string().optional(),
    })
    .optional(),
  smsfDetails: z
    .object({
      fundName: z.string().min(1),
      fundAbn: z.string().optional(),
      establishmentDate: z.string().optional(),
      auditorName: z.string().optional(),
      auditorContact: z.string().optional(),
    })
    .optional(),
});

export const entityRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Get entities user owns
    const ownedEntities = await ctx.db.query.entities.findMany({
      where: eq(entities.userId, ctx.user.id),
      with: {
        trustDetails: true,
        smsfDetails: true,
      },
    });

    // Get entities user is a member of
    const memberships = await ctx.db.query.entityMembers.findMany({
      where: and(
        eq(entityMembers.userId, ctx.user.id),
        // joinedAt is not null - accepted invites only
      ),
      with: {
        entity: {
          with: {
            trustDetails: true,
            smsfDetails: true,
          },
        },
      },
    });

    const memberEntities = memberships
      .filter((m) => m.joinedAt !== null)
      .map((m) => ({ ...m.entity, role: m.role }));

    return [
      ...ownedEntities.map((e) => ({ ...e, role: "owner" as const })),
      ...memberEntities,
    ];
  }),

  get: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, input.entityId),
        with: {
          trustDetails: true,
          smsfDetails: true,
          members: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found",
        });
      }

      // Check access
      const isOwner = entity.userId === ctx.user.id;
      const membership = entity.members.find((m) => m.userId === ctx.user.id);

      if (!isOwner && (!membership || !membership.joinedAt)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this entity",
        });
      }

      return entity;
    }),

  create: protectedProcedure
    .input(createEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const { trustDetails: trustInput, smsfDetails: smsfInput, ...entityData } = input;

      // Validate type-specific details
      if (input.type === "trust" && !trustInput) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trust details required for trust entities",
        });
      }

      if (input.type === "smsf" && !smsfInput) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SMSF details required for SMSF entities",
        });
      }

      // Create entity
      const [entity] = await ctx.db
        .insert(entities)
        .values({
          userId: ctx.user.id,
          ...entityData,
        })
        .returning();

      // Create type-specific details
      if (input.type === "trust" && trustInput) {
        await ctx.db.insert(trustDetails).values({
          entityId: entity.id,
          ...trustInput,
        });
      }

      if (input.type === "smsf" && smsfInput) {
        await ctx.db.insert(smsfDetails).values({
          entityId: entity.id,
          ...smsfInput,
        });
      }

      return entity;
    }),

  update: protectedProcedure
    .input(
      z.object({
        entityId: z.string().uuid(),
        name: z.string().min(1).optional(),
        abn: z.string().optional(),
        tfn: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { entityId, ...updateData } = input;

      // Verify ownership
      const entity = await ctx.db.query.entities.findFirst({
        where: and(
          eq(entities.id, entityId),
          eq(entities.userId, ctx.user.id)
        ),
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found or you do not have permission",
        });
      }

      const [updated] = await ctx.db
        .update(entities)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(entities.id, entityId))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const entity = await ctx.db.query.entities.findFirst({
        where: and(
          eq(entities.id, input.entityId),
          eq(entities.userId, ctx.user.id)
        ),
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found or you do not have permission",
        });
      }

      // Check for properties
      const propertyCount = await ctx.db.query.properties.findMany({
        where: eq(properties.entityId, input.entityId),
      });

      if (propertyCount.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete entity with properties. Transfer or delete properties first.",
        });
      }

      await ctx.db.delete(entities).where(eq(entities.id, input.entityId));

      return { success: true };
    }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    // Get from cookie or return first owned entity
    const cookieStore = await import("next/headers").then((m) => m.cookies());
    const activeEntityId = (await cookieStore).get("active_entity_id")?.value;

    if (activeEntityId) {
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, activeEntityId),
        with: {
          trustDetails: true,
          smsfDetails: true,
        },
      });

      if (entity) {
        // Verify access
        const isOwner = entity.userId === ctx.user.id;
        if (isOwner) return entity;

        const membership = await ctx.db.query.entityMembers.findFirst({
          where: and(
            eq(entityMembers.entityId, activeEntityId),
            eq(entityMembers.userId, ctx.user.id)
          ),
        });

        if (membership?.joinedAt) return entity;
      }
    }

    // Return first owned entity or null
    const firstEntity = await ctx.db.query.entities.findFirst({
      where: eq(entities.userId, ctx.user.id),
      with: {
        trustDetails: true,
        smsfDetails: true,
      },
    });

    return firstEntity || null;
  }),
});
```

**Step 2: Register router in app**

In `src/server/routers/_app.ts`, add:

```typescript
import { entityRouter } from "./entity";

// In the router definition:
entity: entityRouter,
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/entity.ts src/server/routers/_app.ts
git commit -m "feat: add entity router"
```

---

### Task 7: Create Entity Switcher Component

**Files:**
- Create: `src/components/entities/EntitySwitcher.tsx`
- Create: `src/components/entities/index.ts`

**Step 1: Create the switcher component**

Create `src/components/entities/EntitySwitcher.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Building2, Users, Landmark, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const entityTypeIcons = {
  personal: Building2,
  trust: Users,
  smsf: Landmark,
  company: Briefcase,
};

const entityTypeLabels = {
  personal: "Personal",
  trust: "Trust",
  smsf: "SMSF",
  company: "Company",
};

export function EntitySwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: entities, isLoading } = trpc.entity.list.useQuery();
  const { data: activeEntity } = trpc.entity.getActive.useQuery();

  const handleSwitch = async (entityId: string) => {
    // Set cookie via API route
    await fetch("/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId }),
    });

    setOpen(false);
    router.refresh();
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-[200px] justify-between">
        <span className="text-muted-foreground">Loading...</span>
      </Button>
    );
  }

  const Icon = activeEntity
    ? entityTypeIcons[activeEntity.type]
    : Building2;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="truncate">
              {activeEntity?.name || "Select Entity"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        {entities?.map((entity) => {
          const TypeIcon = entityTypeIcons[entity.type];
          const isActive = activeEntity?.id === entity.id;

          return (
            <DropdownMenuItem
              key={entity.id}
              onClick={() => handleSwitch(entity.id)}
              className={cn("flex items-center gap-2", isActive && "bg-accent")}
            >
              <TypeIcon className="h-4 w-4" />
              <span className="flex-1 truncate">{entity.name}</span>
              <Badge variant="secondary" className="text-xs">
                {entityTypeLabels[entity.type]}
              </Badge>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/entities/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Entity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Create index export**

Create `src/components/entities/index.ts`:

```typescript
export { EntitySwitcher } from "./EntitySwitcher";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/entities/
git commit -m "feat: add EntitySwitcher component"
```

---

### Task 8: Create Entity Switch API Route

**Files:**
- Create: `src/app/api/entity/switch/route.ts`

**Step 1: Create the API route**

Create `src/app/api/entity/switch/route.ts`:

```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { entityId } = await request.json();

  const cookieStore = await cookies();
  cookieStore.set("active_entity_id", entityId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/entity/switch/route.ts
git commit -m "feat: add entity switch API route"
```

---

### Task 9: Add EntitySwitcher to Header

**Files:**
- Modify: `src/components/layout/Header.tsx` (or similar header component)

**Step 1: Find the header component**

Look for the main header/nav component in the dashboard layout.

**Step 2: Import and add EntitySwitcher**

Add after the logo or before the user menu:

```typescript
import { EntitySwitcher } from "@/components/entities";

// In the JSX:
<EntitySwitcher />
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add entity switcher to header"
```

---

### Task 10: Create Entity List Page

**Files:**
- Create: `src/app/(dashboard)/entities/page.tsx`

**Step 1: Create the page**

Create `src/app/(dashboard)/entities/page.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2, Users, Landmark, Briefcase, ChevronRight } from "lucide-react";
import Link from "next/link";

const entityTypeIcons = {
  personal: Building2,
  trust: Users,
  smsf: Landmark,
  company: Briefcase,
};

const entityTypeLabels = {
  personal: "Personal",
  trust: "Trust",
  smsf: "SMSF",
  company: "Company",
};

export default function EntitiesPage() {
  const { data: entities, isLoading } = trpc.entity.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Entities</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entities</h1>
        <Link href="/entities/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Entity
          </Button>
        </Link>
      </div>

      {entities?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first entity to organize your properties.
            </p>
            <Link href="/entities/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Entity
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entities?.map((entity) => {
            const Icon = entityTypeIcons[entity.type];

            return (
              <Link key={entity.id} href={`/entities/${entity.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{entity.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          {entityTypeLabels[entity.type]}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {entity.abn && (
                      <p className="text-sm text-muted-foreground">
                        ABN: {entity.abn}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Role: {entity.role}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/entities/page.tsx
git commit -m "feat: add entities list page"
```

---

### Task 11: Create New Entity Page (Wizard)

**Files:**
- Create: `src/app/(dashboard)/entities/new/page.tsx`

**Step 1: Create the wizard page**

Create `src/app/(dashboard)/entities/new/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Users, Landmark, Briefcase, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EntityType = "personal" | "trust" | "smsf" | "company";

const entityTypes = [
  {
    type: "personal" as const,
    label: "Personal",
    description: "Properties held in your own name",
    icon: Building2,
  },
  {
    type: "trust" as const,
    label: "Trust",
    description: "Family trust or discretionary trust",
    icon: Users,
  },
  {
    type: "smsf" as const,
    label: "SMSF",
    description: "Self-managed superannuation fund",
    icon: Landmark,
  },
  {
    type: "company" as const,
    label: "Company",
    description: "Pty Ltd or other company structure",
    icon: Briefcase,
  },
];

export default function NewEntityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    abn: "",
    tfn: "",
    // Trust details
    trusteeType: "individual" as "individual" | "corporate",
    trusteeName: "",
    settlementDate: "",
    trustDeedDate: "",
    // SMSF details
    fundName: "",
    fundAbn: "",
    establishmentDate: "",
    auditorName: "",
    auditorContact: "",
  });

  const createEntity = trpc.entity.create.useMutation({
    onSuccess: (entity) => {
      router.push(`/entities/${entity.id}`);
    },
  });

  const handleSubmit = () => {
    if (!entityType) return;

    const payload: Parameters<typeof createEntity.mutate>[0] = {
      type: entityType,
      name: formData.name,
      abn: formData.abn || undefined,
      tfn: formData.tfn || undefined,
    };

    if (entityType === "trust") {
      payload.trustDetails = {
        trusteeType: formData.trusteeType,
        trusteeName: formData.trusteeName,
        settlementDate: formData.settlementDate || undefined,
        trustDeedDate: formData.trustDeedDate || undefined,
      };
    }

    if (entityType === "smsf") {
      payload.smsfDetails = {
        fundName: formData.fundName,
        fundAbn: formData.fundAbn || undefined,
        establishmentDate: formData.establishmentDate || undefined,
        auditorName: formData.auditorName || undefined,
        auditorContact: formData.auditorContact || undefined,
      };
    }

    createEntity.mutate(payload);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create New Entity</h1>
          <p className="text-muted-foreground">Step {step} of {entityType === "personal" || entityType === "company" ? 2 : 3}</p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Entity Type</CardTitle>
            <CardDescription>
              Choose the type of legal entity that will hold your properties.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {entityTypes.map((et) => (
              <button
                key={et.type}
                onClick={() => {
                  setEntityType(et.type);
                  setStep(2);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors",
                  "hover:border-primary hover:bg-primary/5",
                  entityType === et.type && "border-primary bg-primary/5"
                )}
              >
                <et.icon className="h-8 w-8 text-primary" />
                <span className="font-medium">{et.label}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {et.description}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Entity Details</CardTitle>
            <CardDescription>
              Enter the basic details for your {entityType} entity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Entity Name *</Label>
              <Input
                id="name"
                placeholder={entityType === "personal" ? "Personal" : "Smith Family Trust"}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abn">ABN (optional)</Label>
              <Input
                id="abn"
                placeholder="12 345 678 901"
                value={formData.abn}
                onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tfn">TFN (optional)</Label>
              <Input
                id="tfn"
                placeholder="123 456 789"
                value={formData.tfn}
                onChange={(e) => setFormData({ ...formData, tfn: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (entityType === "trust" || entityType === "smsf") {
                    setStep(3);
                  } else {
                    handleSubmit();
                  }
                }}
                disabled={!formData.name || createEntity.isPending}
              >
                {entityType === "trust" || entityType === "smsf" ? (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  createEntity.isPending ? "Creating..." : "Create Entity"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && entityType === "trust" && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Details</CardTitle>
            <CardDescription>
              Enter the trustee information for your trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Trustee Type *</Label>
              <div className="flex gap-4">
                <Button
                  variant={formData.trusteeType === "individual" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, trusteeType: "individual" })}
                >
                  Individual
                </Button>
                <Button
                  variant={formData.trusteeType === "corporate" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, trusteeType: "corporate" })}
                >
                  Corporate
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trusteeName">Trustee Name *</Label>
              <Input
                id="trusteeName"
                placeholder="John Smith or ABC Pty Ltd"
                value={formData.trusteeName}
                onChange={(e) => setFormData({ ...formData, trusteeName: e.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settlementDate">Settlement Date</Label>
                <Input
                  id="settlementDate"
                  type="date"
                  value={formData.settlementDate}
                  onChange={(e) => setFormData({ ...formData, settlementDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trustDeedDate">Trust Deed Date</Label>
                <Input
                  id="trustDeedDate"
                  type="date"
                  value={formData.trustDeedDate}
                  onChange={(e) => setFormData({ ...formData, trustDeedDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.trusteeName || createEntity.isPending}
              >
                {createEntity.isPending ? "Creating..." : "Create Entity"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && entityType === "smsf" && (
        <Card>
          <CardHeader>
            <CardTitle>SMSF Details</CardTitle>
            <CardDescription>
              Enter the fund details for your SMSF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fundName">Fund Name *</Label>
              <Input
                id="fundName"
                placeholder="Smith Family Super Fund"
                value={formData.fundName}
                onChange={(e) => setFormData({ ...formData, fundName: e.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fundAbn">Fund ABN</Label>
                <Input
                  id="fundAbn"
                  placeholder="12 345 678 901"
                  value={formData.fundAbn}
                  onChange={(e) => setFormData({ ...formData, fundAbn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="establishmentDate">Establishment Date</Label>
                <Input
                  id="establishmentDate"
                  type="date"
                  value={formData.establishmentDate}
                  onChange={(e) => setFormData({ ...formData, establishmentDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="auditorName">Auditor Name</Label>
                <Input
                  id="auditorName"
                  placeholder="SMSF Audit Co"
                  value={formData.auditorName}
                  onChange={(e) => setFormData({ ...formData, auditorName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auditorContact">Auditor Contact</Label>
                <Input
                  id="auditorContact"
                  placeholder="auditor@example.com"
                  value={formData.auditorContact}
                  onChange={(e) => setFormData({ ...formData, auditorContact: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.fundName || createEntity.isPending}
              >
                {createEntity.isPending ? "Creating..." : "Create Entity"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/entities/new/page.tsx
git commit -m "feat: add new entity wizard page"
```

---

### Task 12: Final Verification

**Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors

**Step 4: Commit any fixes**

If any fixes needed:
```bash
git add -A
git commit -m "fix: address lint/type issues"
```
