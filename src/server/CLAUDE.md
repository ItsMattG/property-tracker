# Server & Data Layer Quick Reference

## Key Files

| File | Purpose |
|------|---------|
| `src/server/trpc.ts` | tRPC init, all procedure types, middleware |
| `src/server/routers/_app.ts` | Root router (54 sub-routers) |
| `src/server/db/index.ts` | Drizzle + postgres client (max: 1 for serverless) |
| `src/server/db/schema/index.ts` | Barrel re-export of domain schema modules |
| `src/server/db/schema/*.ts` | Domain-split schema (auth, banking, properties, etc.) |
| `src/app/api/trpc/[trpc]/route.ts` | API route handler + error sanitization |
| `src/server/services/banking/categorization.ts` | AI categorization service (Anthropic SDK) |
| `src/app/api/chat/route.ts` | AI chat route (Vercel AI SDK) |

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
ctx.uow       // UnitOfWork — primary data access (22 typed repositories)
ctx.db        // Drizzle instance — only for cross-domain queries (must add comment explaining why)
```

## Router Template

Routers are thin controllers — all data access goes through `ctx.uow` (Unit of Work).

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";

export const myRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.myDomain.findByOwner(ctx.portfolio.ownerId);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.uow.myDomain.findById(input.id, ctx.portfolio.ownerId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.myDomain.create({
        userId: ctx.portfolio.ownerId,
        name: input.name,
      });
    }),

  update: writeProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.myDomain.update(input.id, ctx.portfolio.ownerId, {
        name: input.name,
      });
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.myDomain.delete(input.id, ctx.portfolio.ownerId);
    }),
});
```

**Register in `_app.ts`:**
```typescript
import { myRouter } from "./my";
export const appRouter = router({ my: myRouter, /* ... */ });
```

## Repository Pattern

Routers access data via `ctx.uow` (Unit of Work), not `ctx.db` directly.

```typescript
// Good — typed, testable
const property = await ctx.uow.property.findById(id, ctx.portfolio.ownerId);
await ctx.uow.property.update(id, ctx.portfolio.ownerId, { name: input.name });

// Bad — bypasses repository layer
const property = await ctx.db.query.properties.findFirst({ ... });
```

**When `ctx.db` is acceptable:**
- Cross-domain queries touching tables from multiple repositories (add a comment explaining why)
- Background closures where UoW is not available

**Interface rules:**
- Update methods: `data: Partial<SchemaType>` — never `Record<string, unknown>`
- Return types: always typed — never `Promise<unknown>` or `Promise<any>`
- Relation fields: always typed — never `unknown`

## Drizzle Query Patterns (for cross-domain queries and repository internals)

Use these patterns inside repositories or for cross-domain queries that span multiple repositories (always add a comment explaining why `ctx.db` is used).

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
| `Partial<SchemaType>` for repo updates | `Record<string, unknown>` (not type-safe) |
| `ctx.uow.repo.method()` in routers | `ctx.db` when repo method exists |
| Typed return values on repo methods | `Promise<unknown>` or `Promise<any>` |
| `prepare: false` in DB config | Enable prepared statements (breaks serverless) |
| `max: 1` connection | Multiple connections (serverless) |

## Server-Side Auth

```typescript
import { getAuthSession } from "@/lib/auth";
const session = await getAuthSession();
const userId = session?.user.id;
```

All non-public routes require auth via middleware (`src/middleware.ts`). tRPC `protectedProcedure` resolves user + portfolio context automatically.

## Plan / Subscription Gating (Server-Side)

Use `proProcedure` or `teamProcedure` instead of `protectedProcedure`:
```typescript
export const myRouter = router({
  proFeature: proProcedure.query(async ({ ctx }) => { /* ... */ }),
  teamFeature: teamProcedure.mutation(async ({ ctx, input }) => { /* ... */ }),
});
```
These automatically check subscription status and throw `FORBIDDEN` if insufficient.

## AI Integrations

### Chat (Vercel AI SDK)
- Route: `src/app/api/chat/route.ts`
- Model: `claude-sonnet-4-20250514` via `@ai-sdk/anthropic`
- Uses `streamText` + `createUIMessageStreamResponse`
- Gated behind `featureFlags.aiAssistant` (currently false)

### Categorization (Anthropic SDK)
- Service: `src/server/services/banking/categorization.ts`
- Model: `claude-3-haiku-20240307` for cost
- Two-tier: merchant memory first, Claude API fallback
- Direct `@anthropic-ai/sdk` usage (not Vercel AI SDK)

## API Error Sanitization

In `src/app/api/trpc/[trpc]/route.ts`:
- Known TRPCError codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`) pass through to client
- `INTERNAL_SERVER_ERROR`: generates error ID, logs full details, returns sanitized message to client
