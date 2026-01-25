# Broker Portal Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Loan Packs into a full Broker Portal with contact management and pack association.

**Architecture:** New `brokers` table with CRUD router, updated `loanPackRouter` with broker association, new UI pages under `/reports/brokers`.

**Tech Stack:** Drizzle ORM, tRPC, React, shadcn/ui components

---

### Task 1: Database Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add brokers table and update loan_packs**

```typescript
// Add after existing table definitions

export const brokers = pgTable("brokers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const brokersRelations = relations(brokers, ({ many }) => ({
  loanPacks: many(loanPacks),
}));
```

Add to `loanPacks` table:
```typescript
brokerId: uuid("broker_id").references(() => brokers.id, { onDelete: "set null" }),
```

Update `loanPacksRelations`:
```typescript
export const loanPacksRelations = relations(loanPacks, ({ one }) => ({
  broker: one(brokers, {
    fields: [loanPacks.brokerId],
    references: [brokers.id],
  }),
}));
```

**Step 2: Generate and run migration**

Run: `npm run db:generate`
Run: `npm run db:migrate`

**Step 3: Verify migration**

Run: `npm run db:studio` and confirm `brokers` table exists with correct columns.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): add brokers table and brokerId to loan_packs"
```

---

### Task 2: Broker Router

**Files:**
- Create: `src/server/routers/broker.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create broker router**

```typescript
// src/server/routers/broker.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { brokers, loanPacks } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const brokerRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({
        id: brokers.id,
        name: brokers.name,
        email: brokers.email,
        phone: brokers.phone,
        company: brokers.company,
        notes: brokers.notes,
        createdAt: brokers.createdAt,
        updatedAt: brokers.updatedAt,
        packCount: sql<number>`count(${loanPacks.id})::int`,
        lastPackAt: sql<Date | null>`max(${loanPacks.createdAt})`,
      })
      .from(brokers)
      .leftJoin(loanPacks, eq(loanPacks.brokerId, brokers.id))
      .where(eq(brokers.userId, ctx.portfolio.ownerId))
      .groupBy(brokers.id)
      .orderBy(desc(brokers.updatedAt));

    return results;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const broker = await ctx.db.query.brokers.findFirst({
        where: and(
          eq(brokers.id, input.id),
          eq(brokers.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!broker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      const packs = await ctx.db.query.loanPacks.findMany({
        where: eq(loanPacks.brokerId, input.id),
        orderBy: [desc(loanPacks.createdAt)],
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return {
        ...broker,
        packs: packs.map((pack) => ({
          id: pack.id,
          token: pack.token,
          url: `${baseUrl}/share/loan-pack/${pack.token}`,
          expiresAt: pack.expiresAt,
          accessCount: pack.accessCount,
          createdAt: pack.createdAt,
          accessedAt: pack.accessedAt,
          isExpired: new Date() > pack.expiresAt,
        })),
      };
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [broker] = await ctx.db
        .insert(brokers)
        .values({
          userId: ctx.portfolio.ownerId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          notes: input.notes || null,
        })
        .returning();

      return broker;
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "Name is required"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(brokers)
        .set({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(brokers.id, input.id),
            eq(brokers.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(brokers)
        .where(
          and(
            eq(brokers.id, input.id),
            eq(brokers.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      return { success: true };
    }),
});
```

**Step 2: Register router in app router**

Add to `src/server/routers/_app.ts`:
```typescript
import { brokerRouter } from "./broker";

// In the router definition:
broker: brokerRouter,
```

**Step 3: Verify type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): add broker router with CRUD operations"
```

---

### Task 3: Update Loan Pack Router

**Files:**
- Modify: `src/server/routers/loanPack.ts`

**Step 1: Update create mutation to accept brokerId**

In the `create` mutation input, add:
```typescript
brokerId: z.string().uuid().optional(),
```

In the insert values, add:
```typescript
brokerId: input.brokerId || null,
```

**Step 2: Update list query to include broker info**

Update the list query to join with brokers table and return broker name.

**Step 3: Verify type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): add broker association to loan pack creation"
```

---

### Task 4: Broker Portal Main Page

**Files:**
- Create: `src/app/(dashboard)/reports/brokers/page.tsx`

**Step 1: Create the main broker portal page**

Create page with:
- Header with "Broker Portal" title and "Add Broker" button
- Grid of broker cards showing name, company, pack count, last pack date
- Each card has "Send Pack" button and overflow menu (Edit, Delete)
- Empty state with "Add your first broker" message
- "Generate Standalone Pack" button for packs without broker

**Step 2: Verify page renders**

Run: `npm run dev`
Navigate to `/reports/brokers`
Expected: Page renders with empty state or broker cards

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): add broker portal main page"
```

---

### Task 5: Add/Edit Broker Modal

**Files:**
- Create: `src/components/broker/BrokerModal.tsx`
- Modify: `src/app/(dashboard)/reports/brokers/page.tsx`

**Step 1: Create BrokerModal component**

Modal with form fields:
- Name (required)
- Company (optional)
- Email (optional)
- Phone (optional)
- Notes (optional textarea)

Support both create and edit modes via optional `broker` prop.

**Step 2: Wire up modal to page**

Add state for modal open/close and selected broker (for edit).
Connect to broker.create and broker.update mutations.

**Step 3: Test create and edit flows**

Run: `npm run dev`
- Click "Add Broker" → fill form → save → broker appears
- Click Edit on broker → form pre-filled → update → changes saved

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): add broker create/edit modal"
```

---

### Task 6: Broker Detail Page

**Files:**
- Create: `src/app/(dashboard)/reports/brokers/[id]/page.tsx`

**Step 1: Create broker detail page**

Page layout:
- Back link to broker portal
- Broker info header (name, company, email, phone)
- Notes section
- Edit and Delete buttons
- "Loan Packs" section with pack list
- "Send Pack" button

Pack list items show:
- Created date
- Status badge (Active/Expired)
- Expiry date
- View count and last viewed
- Actions: Copy Link, Open, Revoke

**Step 2: Add delete confirmation dialog**

Use AlertDialog for delete confirmation.

**Step 3: Test the page**

Run: `npm run dev`
- Click broker card → navigates to detail page
- Verify all info displays correctly
- Test delete flow

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): add broker detail page with pack history"
```

---

### Task 7: Update Generate Pack Modal

**Files:**
- Modify: `src/components/loanPack/GenerateLoanPackModal.tsx`

**Step 1: Add broker dropdown to modal**

Add optional broker selection dropdown:
- Fetch brokers with `trpc.broker.list.useQuery()`
- Add select field above expiry dropdown
- Default to "No broker (standalone)"

**Step 2: Pass brokerId to create mutation**

Update mutation call to include selected brokerId.

**Step 3: Test pack generation with broker**

Run: `npm run dev`
- Generate pack with broker selected
- Verify pack appears in broker's detail page

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): add broker selection to loan pack generation"
```

---

### Task 8: Navigation Updates

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (or equivalent nav component)
- Delete: `src/app/(dashboard)/settings/loan-packs/page.tsx`

**Step 1: Add Broker Portal to Reports menu**

Add navigation item for `/reports/brokers` in the Reports section.
Use appropriate icon (e.g., Users or Briefcase from lucide-react).

**Step 2: Remove Loan Packs from Settings**

Remove the navigation item for `/settings/loan-packs`.
Delete or redirect the old page.

**Step 3: Test navigation**

Run: `npm run dev`
- Verify "Broker Portal" appears in Reports menu
- Verify old Settings link is gone
- Verify old URL redirects or 404s appropriately

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(nav): move broker portal to reports menu"
```

---

### Task 9: Final Cleanup and Testing

**Files:**
- Various cleanup as needed

**Step 1: Run full test suite**

Run: `npm run test`
Run: `npm run lint`
Run: `npm run type-check`
Expected: All pass

**Step 2: Manual E2E testing**

Test complete flows:
1. Add broker → generate pack for broker → view in detail page
2. Edit broker details
3. Delete broker (verify packs become unassociated)
4. Generate standalone pack (no broker)
5. Verify all copy/open/revoke actions work

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "chore: broker portal cleanup and fixes"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Database schema - brokers table, brokerId column |
| 2 | Broker router - CRUD operations |
| 3 | Update loan pack router - broker association |
| 4 | Broker portal main page |
| 5 | Add/Edit broker modal |
| 6 | Broker detail page |
| 7 | Update generate pack modal |
| 8 | Navigation updates |
| 9 | Final cleanup and testing |
