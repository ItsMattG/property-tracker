# Server & Data Layer Quick Reference

> See `docs/codebase-patterns.md` for full usage patterns and anti-patterns.

## Key Files

| File | Purpose |
|------|---------|
| `src/server/trpc.ts` | tRPC init, all procedure types, middleware |
| `src/server/routers/_app.ts` | Root router (54 sub-routers) |
| `src/server/db/index.ts` | Drizzle + postgres client (max: 1 for serverless) |
| `src/server/db/schema.ts` | ~3300 lines, 80+ tables, 40+ enums, relations |
| `src/lib/trpc/client.ts` | Frontend tRPC: `createTRPCReact<AppRouter>()` |
| `src/lib/trpc/Provider.tsx` | TRPCProvider + QueryClient config |
| `src/lib/trpc/server.ts` | Server-side caller: `getServerTRPC()` |
| `src/app/api/trpc/[trpc]/route.ts` | API route handler + error sanitization |
| `src/lib/errors.ts` | `getErrorMessage(error)` utility |

## Procedure Types

```
publicProcedure        → No auth, observability only
protectedProcedure     → Clerk/JWT auth + portfolio resolution
writeProcedure         → + canWrite check (403 if viewer)
memberProcedure        → + canManageMembers check
bankProcedure          → + canManageBanks check
proProcedure           → + subscription >= "pro"
teamProcedure          → + subscription >= "team"
```

**Choose the right procedure:**
- Read-only data: `protectedProcedure`
- Create/update/delete: `writeProcedure`
- Member management: `memberProcedure`
- Bank operations: `bankProcedure`
- Pro plan features: `proProcedure`
- Team plan features: `teamProcedure`

## Context Shape (after protectedProcedure)

```typescript
ctx.user      // { id, clerkId, email, name, ... }
ctx.portfolio // { ownerId, role, canWrite, canManageMembers, canManageBanks, canViewAuditLog, canUploadDocuments }
ctx.db        // Drizzle database instance
```

## Router Template

```typescript
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { eq, and, desc } from "drizzle-orm";
import { myTable } from "../db/schema";

export const myRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.myTable.findMany({
      where: eq(myTable.userId, ctx.portfolio.ownerId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.query.myTable.findFirst({
        where: and(eq(myTable.id, input.id), eq(myTable.userId, ctx.portfolio.ownerId)),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.insert(myTable).values({
        userId: ctx.portfolio.ownerId,
        name: input.name,
      }).returning();
      return item;
    }),

  update: writeProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.update(myTable)
        .set({ name: input.name, updatedAt: new Date() })
        .where(and(eq(myTable.id, input.id), eq(myTable.userId, ctx.portfolio.ownerId)))
        .returning();
      return item;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(myTable)
        .where(and(eq(myTable.id, input.id), eq(myTable.userId, ctx.portfolio.ownerId)));
    }),
});
```

**Register in `_app.ts`:**
```typescript
import { myRouter } from "./my";
export const appRouter = router({ my: myRouter, /* ... */ });
```

## Drizzle Query Patterns

```typescript
// Relational query with joins
ctx.db.query.bankAccounts.findMany({
  where: eq(bankAccounts.userId, ctx.portfolio.ownerId),
  with: { defaultProperty: true, alerts: { where: eq(connectionAlerts.status, "active") } },
});

// Aggregation
ctx.db.select({ count: sql<number>`count(*)::int` }).from(transactions)
  .where(eq(transactions.userId, ctx.portfolio.ownerId));

// Bulk update
ctx.db.update(transactions)
  .set({ category: input.category })
  .where(and(inArray(transactions.id, input.ids), eq(transactions.userId, ctx.portfolio.ownerId)));

// Parallel queries
const [result1, result2] = await Promise.all([query1, query2]);
```

## Schema Conventions

```typescript
// Table with standard fields
export const myTable = pgTable("my_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // ... domain fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("my_table_user_id_idx").on(table.userId),
]);

// Relations
export const myTableRelations = relations(myTable, ({ one, many }) => ({
  user: one(users, { fields: [myTable.userId], references: [users.id] }),
  items: many(childTable),
}));

// Enum
export const myStatusEnum = pgEnum("my_status", ["active", "inactive", "archived"]);
```

## Error Codes Reference

| Code | When | Example |
|------|------|---------|
| `UNAUTHORIZED` | User not found / not authenticated | Missing Clerk session |
| `FORBIDDEN` | No write access / plan insufficient | Viewer role, free plan |
| `NOT_FOUND` | Entity doesn't exist or wrong owner | Property not found |
| `TOO_MANY_REQUESTS` | Rate limit exceeded | Too many API calls |
| `PRECONDITION_FAILED` | Missing prerequisite | No Basiq account linked |
| `INTERNAL_SERVER_ERROR` | Unexpected failure | Gets sanitized with error ID |

## Key Anti-Patterns

| DO | DON'T |
|----|-------|
| Always filter by `ctx.portfolio.ownerId` | Query without user scoping |
| Use `writeProcedure` for mutations | Use `protectedProcedure` for writes |
| `.returning()` on insert/update | Separate select after write |
| `inArray()` for bulk operations | Loop with individual queries |
| `Promise.all()` for parallel queries | Sequential awaits for independent queries |
| `sql<number>\`count(*)::int\`` | `count(*)` without int cast |
| `prepare: false` in DB config | Enable prepared statements (breaks serverless) |
| `max: 1` connection | Multiple connections (serverless) |
