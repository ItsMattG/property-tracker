# Multi-user Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add role-based portfolio sharing allowing owners to invite partners and accountants.

**Architecture:** Add portfolio context to tRPC that resolves current user's role and permissions. All existing queries filter by ownerId (from context) instead of userId. New team router handles invites and member management. Portfolio switcher in sidebar for users with multiple portfolios.

**Tech Stack:** Drizzle ORM, tRPC, Clerk auth, Resend email, React, shadcn/ui

---

## Task 1: Add Database Schema

**Files:**
- Modify: `/src/server/db/schema.ts`

**Step 1: Add the enums and tables**

Add after the existing enums (around line 130):

```typescript
export const portfolioMemberRoleEnum = pgEnum("portfolio_member_role", [
  "owner",
  "partner",
  "accountant",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "member_invited",
  "member_removed",
  "role_changed",
  "invite_accepted",
  "invite_declined",
  "bank_connected",
  "bank_disconnected",
]);
```

Add the tables (after existing tables, before relations):

```typescript
export const portfolioMembers = pgTable(
  "portfolio_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: portfolioMemberRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by")
      .references(() => users.id, { onDelete: "set null" }),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at"),
  },
  (table) => [
    index("portfolio_members_owner_id_idx").on(table.ownerId),
    index("portfolio_members_user_id_idx").on(table.userId),
  ]
);

export const portfolioInvites = pgTable(
  "portfolio_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    role: portfolioMemberRoleEnum("role").notNull(),
    status: inviteStatusEnum("status").default("pending").notNull(),
    token: text("token").notNull().unique(),
    invitedBy: uuid("invited_by")
      .references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("portfolio_invites_owner_id_idx").on(table.ownerId),
    index("portfolio_invites_token_idx").on(table.token),
    index("portfolio_invites_email_idx").on(table.email),
  ]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorId: uuid("actor_id")
      .references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    targetEmail: text("target_email"),
    metadata: text("metadata"), // JSON string
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_owner_id_idx").on(table.ownerId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
);
```

**Step 2: Add relations**

```typescript
export const portfolioMembersRelations = relations(portfolioMembers, ({ one }) => ({
  owner: one(users, {
    fields: [portfolioMembers.ownerId],
    references: [users.id],
    relationName: "portfolioOwner",
  }),
  user: one(users, {
    fields: [portfolioMembers.userId],
    references: [users.id],
    relationName: "portfolioMember",
  }),
  inviter: one(users, {
    fields: [portfolioMembers.invitedBy],
    references: [users.id],
    relationName: "portfolioInviter",
  }),
}));

export const portfolioInvitesRelations = relations(portfolioInvites, ({ one }) => ({
  owner: one(users, {
    fields: [portfolioInvites.ownerId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [portfolioInvites.invitedBy],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  owner: one(users, {
    fields: [auditLog.ownerId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [auditLog.actorId],
    references: [users.id],
  }),
}));
```

**Step 3: Add type exports**

```typescript
export type PortfolioMember = typeof portfolioMembers.$inferSelect;
export type NewPortfolioMember = typeof portfolioMembers.$inferInsert;
export type PortfolioInvite = typeof portfolioInvites.$inferSelect;
export type NewPortfolioInvite = typeof portfolioInvites.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(team): add portfolio members, invites, and audit log tables"
```

---

## Task 2: Create Portfolio Access Service

**Files:**
- Create: `/src/server/services/portfolio-access.ts`
- Create: `/src/server/services/__tests__/portfolio-access.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  getPermissions,
  canWrite,
  canManageMembers,
  canManageBanks,
  canViewAuditLog,
} from "../portfolio-access";

describe("portfolio-access", () => {
  describe("getPermissions", () => {
    it("returns full permissions for owner", () => {
      const perms = getPermissions("owner");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canManageBanks).toBe(true);
      expect(perms.canViewAuditLog).toBe(true);
    });

    it("returns write permissions for partner", () => {
      const perms = getPermissions("partner");
      expect(perms.canWrite).toBe(true);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(true);
      expect(perms.canViewAuditLog).toBe(true);
    });

    it("returns read-only for accountant", () => {
      const perms = getPermissions("accountant");
      expect(perms.canWrite).toBe(false);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canManageBanks).toBe(false);
      expect(perms.canViewAuditLog).toBe(false);
    });
  });

  describe("permission helpers", () => {
    it("canWrite returns true for owner and partner", () => {
      expect(canWrite("owner")).toBe(true);
      expect(canWrite("partner")).toBe(true);
      expect(canWrite("accountant")).toBe(false);
    });

    it("canManageMembers returns true only for owner", () => {
      expect(canManageMembers("owner")).toBe(true);
      expect(canManageMembers("partner")).toBe(false);
      expect(canManageMembers("accountant")).toBe(false);
    });

    it("canManageBanks returns true for owner and partner", () => {
      expect(canManageBanks("owner")).toBe(true);
      expect(canManageBanks("partner")).toBe(true);
      expect(canManageBanks("accountant")).toBe(false);
    });

    it("canViewAuditLog returns true for owner and partner", () => {
      expect(canViewAuditLog("owner")).toBe(true);
      expect(canViewAuditLog("partner")).toBe(true);
      expect(canViewAuditLog("accountant")).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/portfolio-access.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement the service**

```typescript
export type PortfolioRole = "owner" | "partner" | "accountant";

export interface PortfolioPermissions {
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewAuditLog: boolean;
  canUploadDocuments: boolean;
}

export function getPermissions(role: PortfolioRole): PortfolioPermissions {
  switch (role) {
    case "owner":
      return {
        canWrite: true,
        canManageMembers: true,
        canManageBanks: true,
        canViewAuditLog: true,
        canUploadDocuments: true,
      };
    case "partner":
      return {
        canWrite: true,
        canManageMembers: false,
        canManageBanks: true,
        canViewAuditLog: true,
        canUploadDocuments: true,
      };
    case "accountant":
      return {
        canWrite: false,
        canManageMembers: false,
        canManageBanks: false,
        canViewAuditLog: false,
        canUploadDocuments: true,
      };
  }
}

export function canWrite(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner";
}

export function canManageMembers(role: PortfolioRole): boolean {
  return role === "owner";
}

export function canManageBanks(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner";
}

export function canViewAuditLog(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner";
}

export function generateInviteToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function getInviteExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/portfolio-access.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/server/services/portfolio-access.ts src/server/services/__tests__/portfolio-access.test.ts
git commit -m "feat(team): add portfolio access service with permissions"
```

---

## Task 3: Add Portfolio Context to tRPC

**Files:**
- Modify: `/src/server/trpc.ts`

**Step 1: Update tRPC context with portfolio resolution**

Replace the entire file:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "./db";
import { users, portfolioMembers } from "./db/schema";
import { eq, and, or } from "drizzle-orm";
import { type PortfolioRole, getPermissions } from "./services/portfolio-access";

export interface PortfolioContext {
  ownerId: string;
  role: PortfolioRole;
  canWrite: boolean;
  canManageMembers: boolean;
  canManageBanks: boolean;
  canViewAuditLog: boolean;
}

export const createTRPCContext = async () => {
  const { userId: clerkId } = await auth();
  const cookieStore = await cookies();
  const portfolioOwnerId = cookieStore.get("portfolio_owner_id")?.value;

  return {
    db,
    clerkId,
    portfolioOwnerId,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.clerkId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.clerkId),
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found. Please sign out and sign in again.",
    });
  }

  // Resolve portfolio context
  let portfolio: PortfolioContext;

  if (ctx.portfolioOwnerId && ctx.portfolioOwnerId !== user.id) {
    // Viewing someone else's portfolio - check membership
    const membership = await ctx.db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.ownerId, ctx.portfolioOwnerId),
        eq(portfolioMembers.userId, user.id)
      ),
    });

    if (!membership || !membership.joinedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this portfolio",
      });
    }

    const perms = getPermissions(membership.role);
    portfolio = {
      ownerId: ctx.portfolioOwnerId,
      role: membership.role,
      ...perms,
    };
  } else {
    // Viewing own portfolio
    portfolio = {
      ownerId: user.id,
      role: "owner",
      canWrite: true,
      canManageMembers: true,
      canManageBanks: true,
      canViewAuditLog: true,
    };
  }

  return next({
    ctx: {
      ...ctx,
      user,
      portfolio,
    },
  });
});

// Procedure that requires write access
export const writeProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.portfolio.canWrite) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have write access to this portfolio",
    });
  }
  return next({ ctx });
});

// Procedure that requires member management access
export const memberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.portfolio.canManageMembers) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the portfolio owner can manage team members",
    });
  }
  return next({ ctx });
});

// Procedure that requires bank management access
export const bankProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.portfolio.canManageBanks) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to manage bank connections",
    });
  }
  return next({ ctx });
});
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in routers using `ctx.user.id` (expected - we'll fix in next task)

**Step 3: Commit**

```bash
git add src/server/trpc.ts
git commit -m "feat(team): add portfolio context to tRPC with role-based procedures"
```

---

## Task 4: Update Existing Routers for Portfolio Context

**Files:**
- Modify: `/src/server/routers/property.ts`
- Modify: `/src/server/routers/transaction.ts`
- Modify: `/src/server/routers/loan.ts`
- Modify: `/src/server/routers/banking.ts`
- Modify: All other routers

**Step 1: Update property router**

Change all instances of `ctx.user.id` to `ctx.portfolio.ownerId` for data queries.
Change mutations to use `writeProcedure` instead of `protectedProcedure`.

Example pattern for each router:

```typescript
// Before:
list: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db.query.properties.findMany({
    where: eq(properties.userId, ctx.user.id),
  });
}),

// After:
list: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db.query.properties.findMany({
    where: eq(properties.userId, ctx.portfolio.ownerId),
  });
}),

// Before (mutation):
create: protectedProcedure.input(...).mutation(async ({ ctx, input }) => {
  // ...
  userId: ctx.user.id,
});

// After (mutation):
create: writeProcedure.input(...).mutation(async ({ ctx, input }) => {
  // ...
  userId: ctx.portfolio.ownerId,
});
```

**Step 2: Update banking router to use bankProcedure**

```typescript
// For bank connection endpoints:
connect: bankProcedure.input(...).mutation(...)
disconnect: bankProcedure.input(...).mutation(...)
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Run tests**

Run: `npm run test:unit`
Expected: Some tests may fail due to missing portfolio context in mocks - update test-utils

**Step 5: Update test utilities**

In `/src/server/__tests__/test-utils.ts`, update mock context:

```typescript
// Add to mock context:
portfolio: {
  ownerId: mockUser.id,
  role: "owner" as const,
  canWrite: true,
  canManageMembers: true,
  canManageBanks: true,
  canViewAuditLog: true,
},
```

**Step 6: Run tests again**

Run: `npm run test:unit`
Expected: PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(team): update all routers to use portfolio context"
```

---

## Task 5: Create Team Router

**Files:**
- Create: `/src/server/routers/team.ts`
- Modify: `/src/server/routers/_app.ts`

**Step 1: Create the team router**

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, memberProcedure } from "../trpc";
import {
  portfolioMembers,
  portfolioInvites,
  auditLog,
  users,
} from "../db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import {
  generateInviteToken,
  getInviteExpiryDate,
} from "../services/portfolio-access";
import { sendEmail } from "../services/notification";
import { inviteEmailTemplate } from "@/lib/email/templates/invite";

export const teamRouter = router({
  // List team members
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.portfolio.canViewAuditLog) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to view team members",
      });
    }

    const members = await ctx.db.query.portfolioMembers.findMany({
      where: eq(portfolioMembers.ownerId, ctx.portfolio.ownerId),
      with: {
        user: true,
      },
      orderBy: [desc(portfolioMembers.joinedAt)],
    });

    // Add owner as first member
    const owner = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.portfolio.ownerId),
    });

    return {
      owner,
      members: members.filter((m) => m.joinedAt !== null),
    };
  }),

  // List pending invites
  listInvites: memberProcedure.query(async ({ ctx }) => {
    return ctx.db.query.portfolioInvites.findMany({
      where: and(
        eq(portfolioInvites.ownerId, ctx.portfolio.ownerId),
        eq(portfolioInvites.status, "pending")
      ),
      orderBy: [desc(portfolioInvites.createdAt)],
    });
  }),

  // Send invite
  sendInvite: memberProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["partner", "accountant"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if already a member
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (existingUser) {
        const existingMember = await ctx.db.query.portfolioMembers.findFirst({
          where: and(
            eq(portfolioMembers.ownerId, ctx.portfolio.ownerId),
            eq(portfolioMembers.userId, existingUser.id)
          ),
        });

        if (existingMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This user is already a member of your portfolio",
          });
        }
      }

      // Check for pending invite
      const existingInvite = await ctx.db.query.portfolioInvites.findFirst({
        where: and(
          eq(portfolioInvites.ownerId, ctx.portfolio.ownerId),
          eq(portfolioInvites.email, input.email.toLowerCase()),
          eq(portfolioInvites.status, "pending")
        ),
      });

      if (existingInvite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An invite has already been sent to this email",
        });
      }

      const token = generateInviteToken();
      const expiresAt = getInviteExpiryDate();

      const [invite] = await ctx.db
        .insert(portfolioInvites)
        .values({
          ownerId: ctx.portfolio.ownerId,
          email: input.email.toLowerCase(),
          role: input.role,
          token,
          invitedBy: ctx.user.id,
          expiresAt,
        })
        .returning();

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "member_invited",
        targetEmail: input.email.toLowerCase(),
        metadata: JSON.stringify({ role: input.role }),
      });

      // Send email
      const owner = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
      });

      await sendEmail(
        input.email,
        `${owner?.name || "Someone"} invited you to PropertyTracker`,
        inviteEmailTemplate({
          ownerName: owner?.name || "A PropertyTracker user",
          role: input.role,
          token,
          expiresAt,
        })
      );

      return invite;
    }),

  // Cancel invite
  cancelInvite: memberProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(portfolioInvites)
        .where(
          and(
            eq(portfolioInvites.id, input.inviteId),
            eq(portfolioInvites.ownerId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),

  // Resend invite
  resendInvite: memberProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.query.portfolioInvites.findFirst({
        where: and(
          eq(portfolioInvites.id, input.inviteId),
          eq(portfolioInvites.ownerId, ctx.portfolio.ownerId)
        ),
      });

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }

      const newToken = generateInviteToken();
      const newExpiry = getInviteExpiryDate();

      await ctx.db
        .update(portfolioInvites)
        .set({
          token: newToken,
          expiresAt: newExpiry,
          status: "pending",
        })
        .where(eq(portfolioInvites.id, input.inviteId));

      // Send email
      const owner = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.portfolio.ownerId),
      });

      await sendEmail(
        invite.email,
        `${owner?.name || "Someone"} invited you to PropertyTracker`,
        inviteEmailTemplate({
          ownerName: owner?.name || "A PropertyTracker user",
          role: invite.role,
          token: newToken,
          expiresAt: newExpiry,
        })
      );

      return { success: true };
    }),

  // Change member role
  changeRole: memberProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
        role: z.enum(["partner", "accountant"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.query.portfolioMembers.findFirst({
        where: and(
          eq(portfolioMembers.id, input.memberId),
          eq(portfolioMembers.ownerId, ctx.portfolio.ownerId)
        ),
        with: { user: true },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await ctx.db
        .update(portfolioMembers)
        .set({ role: input.role })
        .where(eq(portfolioMembers.id, input.memberId));

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "role_changed",
        targetEmail: member.user?.email,
        metadata: JSON.stringify({ oldRole: member.role, newRole: input.role }),
      });

      return { success: true };
    }),

  // Remove member
  removeMember: memberProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.query.portfolioMembers.findFirst({
        where: and(
          eq(portfolioMembers.id, input.memberId),
          eq(portfolioMembers.ownerId, ctx.portfolio.ownerId)
        ),
        with: { user: true },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      await ctx.db
        .delete(portfolioMembers)
        .where(eq(portfolioMembers.id, input.memberId));

      // Log audit
      await ctx.db.insert(auditLog).values({
        ownerId: ctx.portfolio.ownerId,
        actorId: ctx.user.id,
        action: "member_removed",
        targetEmail: member.user?.email,
      });

      return { success: true };
    }),

  // Get portfolios user has access to (for switcher)
  getAccessiblePortfolios: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.portfolioMembers.findMany({
      where: and(
        eq(portfolioMembers.userId, ctx.user.id),
        // Only include accepted memberships (has joinedAt)
      ),
      with: {
        owner: true,
      },
    });

    return memberships
      .filter((m) => m.joinedAt !== null)
      .map((m) => ({
        ownerId: m.ownerId,
        ownerName: m.owner?.name || m.owner?.email || "Unknown",
        role: m.role,
      }));
  }),

  // Get audit log
  getAuditLog: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.portfolio.canViewAuditLog) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to view the audit log",
        });
      }

      const entries = await ctx.db.query.auditLog.findMany({
        where: eq(auditLog.ownerId, ctx.portfolio.ownerId),
        with: {
          actor: true,
        },
        orderBy: [desc(auditLog.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return entries;
    }),

  // Get current portfolio context (for UI)
  getContext: protectedProcedure.query(async ({ ctx }) => {
    const owner = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.portfolio.ownerId),
    });

    return {
      ownerId: ctx.portfolio.ownerId,
      ownerName: owner?.name || owner?.email || "Unknown",
      role: ctx.portfolio.role,
      isOwnPortfolio: ctx.portfolio.ownerId === ctx.user.id,
      permissions: {
        canWrite: ctx.portfolio.canWrite,
        canManageMembers: ctx.portfolio.canManageMembers,
        canManageBanks: ctx.portfolio.canManageBanks,
        canViewAuditLog: ctx.portfolio.canViewAuditLog,
      },
    };
  }),
});
```

**Step 2: Register router in _app.ts**

```typescript
import { teamRouter } from "./team";

export const appRouter = router({
  // ... existing routers
  team: teamRouter,
});
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: May have errors for missing email template - create in next task

**Step 4: Commit**

```bash
git add src/server/routers/team.ts src/server/routers/_app.ts
git commit -m "feat(team): add team router with invite and member management"
```

---

## Task 6: Create Invite Email Template

**Files:**
- Create: `/src/lib/email/templates/invite.ts`

**Step 1: Create the template**

```typescript
import { baseTemplate } from "./base";

interface InviteEmailProps {
  ownerName: string;
  role: "partner" | "accountant";
  token: string;
  expiresAt: Date;
}

const roleDescriptions = {
  partner: "full access to view and manage properties, transactions, and loans",
  accountant: "read-only access to view financial data for tax and reporting purposes",
};

export function inviteEmailTemplate({
  ownerName,
  role,
  token,
  expiresAt,
}: InviteEmailProps): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";
  const acceptUrl = `${appUrl}/invite/accept?token=${token}`;
  const expiryDate = expiresAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const content = `
    <h2 style="color: #333; margin-bottom: 20px;">You've been invited!</h2>
    <p><strong>${ownerName}</strong> has invited you to access their property portfolio on PropertyTracker.</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Your role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
        This gives you ${roleDescriptions[role]}.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Accept Invitation
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      This invitation expires on ${expiryDate}. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  `;

  return baseTemplate(content);
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/email/templates/invite.ts
git commit -m "feat(team): add invite email template"
```

---

## Task 7: Create Accept Invite Page

**Files:**
- Create: `/src/app/invite/accept/page.tsx`

**Step 1: Create the accept invite page**

```typescript
import { Suspense } from "react";
import { AcceptInviteContent } from "./AcceptInviteContent";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
```

**Step 2: Create the content component**

Create `/src/app/invite/accept/AcceptInviteContent.tsx`:

```typescript
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error" | "expired">("loading");
  const [invite, setInvite] = useState<{
    ownerName: string;
    role: string;
    email: string;
  } | null>(null);

  const { data: inviteData, error: inviteError } = trpc.team.getInviteByToken.useQuery(
    { token: token || "" },
    { enabled: !!token && isSignedIn }
  );

  const acceptMutation = trpc.team.acceptInvite.useMutation({
    onSuccess: () => {
      setStatus("success");
      toast.success("Invitation accepted!");
      setTimeout(() => router.push("/dashboard"), 2000);
    },
    onError: (error) => {
      toast.error(error.message);
      setStatus("error");
    },
  });

  const declineMutation = trpc.team.declineInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation declined");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (inviteData) {
      setInvite(inviteData);
      setStatus("ready");
    }
    if (inviteError) {
      if (inviteError.message.includes("expired")) {
        setStatus("expired");
      } else {
        setStatus("error");
      }
    }
  }, [inviteData, inviteError]);

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p>Invalid invitation link</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sign in to accept invitation</CardTitle>
              <CardDescription>
                Create an account or sign in to accept this portfolio invitation.
              </CardDescription>
            </CardHeader>
          </Card>
          <SignIn afterSignInUrl={`/invite/accept?token=${token}`} />
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground">
              This invitation has expired. Please ask the portfolio owner to send a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-muted-foreground">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error" || !invite) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground">
              This invitation may be invalid or you may already be a member.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Portfolio Invitation</CardTitle>
          <CardDescription>
            {invite.ownerName} has invited you to access their portfolio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm">Your role</span>
            <Badge variant="secondary">
              {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            {invite.role === "partner"
              ? "You'll have full access to view and manage properties, transactions, and loans."
              : "You'll have read-only access to view financial data for tax and reporting purposes."}
          </p>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => declineMutation.mutate({ token: token! })}
              disabled={declineMutation.isPending}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={() => acceptMutation.mutate({ token: token! })}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Add accept/decline endpoints to team router**

Add to `/src/server/routers/team.ts`:

```typescript
// Get invite by token (for accept page)
getInviteByToken: publicProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ ctx, input }) => {
    const invite = await ctx.db.query.portfolioInvites.findFirst({
      where: eq(portfolioInvites.token, input.token),
      with: { owner: true },
    });

    if (!invite) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
    }

    if (invite.status !== "pending") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already used" });
    }

    if (new Date() > invite.expiresAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
    }

    return {
      ownerName: invite.owner?.name || invite.owner?.email || "Unknown",
      role: invite.role,
      email: invite.email,
    };
  }),

// Accept invite
acceptInvite: protectedProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const invite = await ctx.db.query.portfolioInvites.findFirst({
      where: eq(portfolioInvites.token, input.token),
    });

    if (!invite || invite.status !== "pending") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite" });
    }

    if (new Date() > invite.expiresAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
    }

    // Verify email matches
    if (invite.email.toLowerCase() !== ctx.user.email?.toLowerCase()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This invite was sent to a different email address",
      });
    }

    // Create membership
    await ctx.db.insert(portfolioMembers).values({
      ownerId: invite.ownerId,
      userId: ctx.user.id,
      role: invite.role,
      invitedBy: invite.invitedBy,
      joinedAt: new Date(),
    });

    // Update invite status
    await ctx.db
      .update(portfolioInvites)
      .set({ status: "accepted" })
      .where(eq(portfolioInvites.id, invite.id));

    // Log audit
    await ctx.db.insert(auditLog).values({
      ownerId: invite.ownerId,
      actorId: ctx.user.id,
      action: "invite_accepted",
      targetEmail: ctx.user.email,
    });

    return { success: true };
  }),

// Decline invite
declineInvite: protectedProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const invite = await ctx.db.query.portfolioInvites.findFirst({
      where: eq(portfolioInvites.token, input.token),
    });

    if (!invite || invite.status !== "pending") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite" });
    }

    await ctx.db
      .update(portfolioInvites)
      .set({ status: "declined" })
      .where(eq(portfolioInvites.id, invite.id));

    // Log audit
    await ctx.db.insert(auditLog).values({
      ownerId: invite.ownerId,
      actorId: ctx.user.id,
      action: "invite_declined",
      targetEmail: ctx.user.email,
    });

    return { success: true };
  }),
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/invite/
git commit -m "feat(team): add accept invite page"
```

---

## Task 8: Create Team Settings Page

**Files:**
- Create: `/src/app/(dashboard)/settings/team/page.tsx`
- Create: `/src/components/team/MemberList.tsx`
- Create: `/src/components/team/InviteMemberModal.tsx`
- Create: `/src/components/team/PendingInvites.tsx`

**Step 1: Create team settings page**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { UserPlus } from "lucide-react";
import { MemberList } from "@/components/team/MemberList";
import { PendingInvites } from "@/components/team/PendingInvites";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";

export default function TeamSettingsPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { data: context } = trpc.team.getContext.useQuery();

  if (!context?.permissions.canManageMembers && context?.role !== "owner") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Team</h2>
        <p className="text-muted-foreground">
          Only the portfolio owner can manage team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <p className="text-muted-foreground">
            Manage who has access to your portfolio
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <MemberList />
      <PendingInvites />

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />
    </div>
  );
}
```

**Step 2: Create MemberList component**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Shield, User, Trash2 } from "lucide-react";
import { useState } from "react";

export function MemberList() {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.team.listMembers.useQuery();

  const changeRoleMutation = trpc.team.changeRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.team.listMembers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.team.listMembers.invalidate();
      setRemoveDialogOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "partner":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner */}
          {data?.owner && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{data.owner.name || "Owner"}</p>
                  <p className="text-sm text-muted-foreground">{data.owner.email}</p>
                </div>
              </div>
              <Badge variant="default">Owner</Badge>
            </div>
          )}

          {/* Members */}
          {data?.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{member.user?.name || "Member"}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        changeRoleMutation.mutate({
                          memberId: member.id,
                          role: member.role === "partner" ? "accountant" : "partner",
                        })
                      }
                    >
                      Change to {member.role === "partner" ? "Accountant" : "Partner"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setSelectedMemberId(member.id);
                        setRemoveDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {data?.members.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No team members yet. Invite someone to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to your portfolio. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedMemberId && removeMutation.mutate({ memberId: selectedMemberId })
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 3: Create InviteMemberModal component**

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["partner", "accountant"]),
});

type FormValues = z.infer<typeof formSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberModal({ open, onOpenChange }: InviteMemberModalProps) {
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      email: "",
      role: "accountant",
    },
  });

  const sendInviteMutation = trpc.team.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent!");
      form.reset();
      onOpenChange(false);
      utils.team.listInvites.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (values: FormValues) => {
    sendInviteMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your portfolio.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="partner">
                        <div>
                          <p className="font-medium">Partner</p>
                          <p className="text-xs text-muted-foreground">
                            Full access to manage properties and transactions
                          </p>
                        </div>
                      </SelectItem>
                      <SelectItem value="accountant">
                        <div>
                          <p className="font-medium">Accountant</p>
                          <p className="text-xs text-muted-foreground">
                            Read-only access for tax and reporting
                          </p>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={sendInviteMutation.isPending}
              >
                {sendInviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Create PendingInvites component**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Mail, RefreshCw, X } from "lucide-react";

export function PendingInvites() {
  const utils = trpc.useUtils();
  const { data: invites, isLoading } = trpc.team.listInvites.useQuery();

  const cancelMutation = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite cancelled");
      utils.team.listInvites.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resendMutation = trpc.team.resendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite resent");
      utils.team.listInvites.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading || !invites || invites.length === 0) {
    return null;
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Mail className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{invite.email}</p>
                <p className="text-sm text-muted-foreground">
                  Expires {formatDate(invite.expiresAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => resendMutation.mutate({ inviteId: invite.id })}
                disabled={resendMutation.isPending}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => cancelMutation.mutate({ inviteId: invite.id })}
                disabled={cancelMutation.isPending}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Update sidebar settings items**

In `/src/components/layout/Sidebar.tsx`, add team to settings:

```typescript
const settingsItems = [
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];
```

Add `Users` to the lucide-react import.

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/app/\(dashboard\)/settings/team/ src/components/team/ src/components/layout/Sidebar.tsx
git commit -m "feat(team): add team settings page with member and invite management"
```

---

## Task 9: Add Portfolio Switcher

**Files:**
- Create: `/src/components/layout/PortfolioSwitcher.tsx`
- Modify: `/src/components/layout/Sidebar.tsx`

**Step 1: Create PortfolioSwitcher component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { ChevronDown, User, Briefcase } from "lucide-react";
import { toast } from "sonner";

export function PortfolioSwitcher() {
  const router = useRouter();
  const { data: context } = trpc.team.getContext.useQuery();
  const { data: portfolios } = trpc.team.getAccessiblePortfolios.useQuery();

  const switchPortfolio = async (ownerId: string | null) => {
    // Set or clear the portfolio cookie
    if (ownerId) {
      document.cookie = `portfolio_owner_id=${ownerId};path=/;max-age=31536000`;
    } else {
      document.cookie = "portfolio_owner_id=;path=/;max-age=0";
    }
    toast.success("Switched portfolio");
    router.refresh();
  };

  // Don't show if user only has their own portfolio
  if (!portfolios || portfolios.length === 0) {
    return null;
  }

  return (
    <div className="px-3 mb-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              <span className="truncate">
                {context?.isOwnPortfolio ? "My Portfolio" : context?.ownerName}
              </span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Switch Portfolio</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => switchPortfolio(null)}>
            <User className="w-4 h-4 mr-2" />
            My Portfolio
            {context?.isOwnPortfolio && (
              <Badge variant="secondary" className="ml-auto">
                Current
              </Badge>
            )}
          </DropdownMenuItem>
          {portfolios.map((p) => (
            <DropdownMenuItem
              key={p.ownerId}
              onClick={() => switchPortfolio(p.ownerId)}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              <span className="truncate">{p.ownerName}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {p.role}
              </Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!context?.isOwnPortfolio && (
        <div className="mt-2 px-2 py-1 text-xs text-muted-foreground bg-muted rounded">
          Viewing as {context?.role}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add PortfolioSwitcher to Sidebar**

Update `/src/components/layout/Sidebar.tsx`:

```typescript
import { PortfolioSwitcher } from "./PortfolioSwitcher";

// In the component, after the logo section:
<div className="mb-8">
  <Link href="/dashboard" className="flex items-center gap-2">
    {/* ... logo ... */}
  </Link>
</div>

<PortfolioSwitcher />

<nav className="space-y-1">
  {/* ... nav items ... */}
</nav>
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/layout/PortfolioSwitcher.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(team): add portfolio switcher for multi-portfolio access"
```

---

## Task 10: Add Audit Log Page

**Files:**
- Create: `/src/app/(dashboard)/settings/audit-log/page.tsx`

**Step 1: Create audit log page**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  UserPlus,
  UserMinus,
  Shield,
  CheckCircle,
  XCircle,
  Link,
  Unlink,
} from "lucide-react";

const actionIcons: Record<string, React.ElementType> = {
  member_invited: UserPlus,
  member_removed: UserMinus,
  role_changed: Shield,
  invite_accepted: CheckCircle,
  invite_declined: XCircle,
  bank_connected: Link,
  bank_disconnected: Unlink,
};

const actionLabels: Record<string, string> = {
  member_invited: "Invited member",
  member_removed: "Removed member",
  role_changed: "Changed role",
  invite_accepted: "Accepted invite",
  invite_declined: "Declined invite",
  bank_connected: "Connected bank",
  bank_disconnected: "Disconnected bank",
};

export default function AuditLogPage() {
  const { data: context } = trpc.team.getContext.useQuery();
  const { data: entries, isLoading } = trpc.team.getAuditLog.useQuery({
    limit: 50,
    offset: 0,
  });

  if (!context?.permissions.canViewAuditLog) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-muted-foreground">
          You do not have access to view the audit log.
        </p>
      </div>
    );
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-muted-foreground">
          Track important changes to your portfolio
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => {
                const Icon = actionIcons[entry.action] || Shield;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-3 border rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {actionLabels[entry.action] || entry.action}
                        </p>
                        {entry.targetEmail && (
                          <Badge variant="outline">{entry.targetEmail}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        by {entry.actor?.name || entry.actor?.email || "Unknown"} •{" "}
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No activity recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add audit log to sidebar settings**

Update settings items in Sidebar:

```typescript
const settingsItems = [
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/audit-log", label: "Audit Log", icon: History },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
];
```

Add `History` to imports.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/audit-log/ src/components/layout/Sidebar.tsx
git commit -m "feat(team): add audit log page"
```

---

## Task 11: Final Integration and Testing

**Files:**
- All files from previous tasks

**Step 1: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS (or fix any issues)

**Step 4: Manual testing checklist**

- [ ] Navigate to /settings/team - see team page
- [ ] Click "Invite Member" - modal opens
- [ ] Send invite - email received, invite shows in pending
- [ ] Open invite link - see accept page
- [ ] Accept invite - redirected to dashboard with new portfolio context
- [ ] Switch portfolios - data changes to selected portfolio
- [ ] As accountant - cannot edit transactions
- [ ] As partner - can edit but not manage team
- [ ] View audit log - see all actions recorded

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat(team): complete multi-user access feature"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add database schema | schema.ts |
| 2 | Create portfolio access service | portfolio-access.ts |
| 3 | Add portfolio context to tRPC | trpc.ts |
| 4 | Update existing routers | All routers |
| 5 | Create team router | team.ts |
| 6 | Create invite email template | invite.ts |
| 7 | Create accept invite page | /invite/accept |
| 8 | Create team settings page | /settings/team |
| 9 | Add portfolio switcher | PortfolioSwitcher.tsx |
| 10 | Add audit log page | /settings/audit-log |
| 11 | Final integration and testing | All files |
