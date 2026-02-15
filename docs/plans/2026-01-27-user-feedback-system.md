# User Feedback System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public feature request board with voting and a private bug report system.

**Architecture:** Feature requests are public with upvoting; bug reports are private. Both use tRPC routes with Drizzle ORM. Public `/feedback` page shows feature board. Bug reports go to admin-only dashboard in settings. Feedback button in sidebar triggers modals.

**Tech Stack:** Next.js 16, tRPC, Drizzle ORM, PostgreSQL, shadcn/ui, Vitest, Playwright

---

## Task 1: Database Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add enums and tables to schema**

Add after existing enums (around line 50):

```typescript
export const featureRequestStatusEnum = pgEnum("feature_request_status", [
  "open",
  "planned",
  "in_progress",
  "shipped",
  "rejected",
]);

export const featureRequestCategoryEnum = pgEnum("feature_request_category", [
  "feature",
  "improvement",
  "integration",
  "other",
]);

export const bugReportStatusEnum = pgEnum("bug_report_status", [
  "new",
  "investigating",
  "fixed",
  "wont_fix",
]);

export const bugReportSeverityEnum = pgEnum("bug_report_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);
```

Add tables after existing tables:

```typescript
export const featureRequests = pgTable(
  "feature_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    category: featureRequestCategoryEnum("category").notNull(),
    status: featureRequestStatusEnum("status").default("open").notNull(),
    voteCount: integer("vote_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_requests_user_id_idx").on(table.userId),
    index("feature_requests_status_idx").on(table.status),
    index("feature_requests_vote_count_idx").on(table.voteCount),
  ]
);

export const featureVotes = pgTable(
  "feature_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    featureId: uuid("feature_id")
      .references(() => featureRequests.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feature_votes_user_feature_idx").on(table.userId, table.featureId),
  ]
);

export const featureComments = pgTable(
  "feature_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureId: uuid("feature_id")
      .references(() => featureRequests.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_comments_feature_id_idx").on(table.featureId),
  ]
);

export const bugReports = pgTable(
  "bug_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    stepsToReproduce: text("steps_to_reproduce"),
    severity: bugReportSeverityEnum("severity").notNull(),
    browserInfo: jsonb("browser_info"),
    currentPage: varchar("current_page", { length: 500 }),
    status: bugReportStatusEnum("status").default("new").notNull(),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bug_reports_user_id_idx").on(table.userId),
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_severity_idx").on(table.severity),
  ]
);
```

**Step 2: Add relation definitions**

Add with other relations:

```typescript
export const featureRequestsRelations = relations(featureRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [featureRequests.userId],
    references: [users.id],
  }),
  votes: many(featureVotes),
  comments: many(featureComments),
}));

export const featureVotesRelations = relations(featureVotes, ({ one }) => ({
  user: one(users, {
    fields: [featureVotes.userId],
    references: [users.id],
  }),
  feature: one(featureRequests, {
    fields: [featureVotes.featureId],
    references: [featureRequests.id],
  }),
}));

export const featureCommentsRelations = relations(featureComments, ({ one }) => ({
  user: one(users, {
    fields: [featureComments.userId],
    references: [users.id],
  }),
  feature: one(featureRequests, {
    fields: [featureComments.featureId],
    references: [featureRequests.id],
  }),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
}));
```

**Step 3: Generate and push migration**

Run:
```bash
npm run db:generate
npm run db:push
```

Expected: Migration created and applied successfully.

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(feedback): add database schema for feature requests and bug reports"
```

---

## Task 2: Feedback Router - Feature Requests

**Files:**
- Create: `src/server/routers/feedback.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create feedback router file**

Create `src/server/routers/feedback.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import {
  featureRequests,
  featureVotes,
  featureComments,
  bugReports,
  users,
} from "../db/schema";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const feedbackRouter = router({
  // List all feature requests (public)
  listFeatures: publicProcedure
    .input(
      z.object({
        status: z
          .enum(["open", "planned", "in_progress", "shipped", "rejected"])
          .optional(),
        sortBy: z.enum(["votes", "newest", "oldest"]).default("votes"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = input.status
        ? eq(featureRequests.status, input.status)
        : undefined;

      const orderBy =
        input.sortBy === "votes"
          ? desc(featureRequests.voteCount)
          : input.sortBy === "newest"
            ? desc(featureRequests.createdAt)
            : asc(featureRequests.createdAt);

      const features = await ctx.db
        .select({
          id: featureRequests.id,
          title: featureRequests.title,
          description: featureRequests.description,
          category: featureRequests.category,
          status: featureRequests.status,
          voteCount: featureRequests.voteCount,
          createdAt: featureRequests.createdAt,
          userName: users.name,
        })
        .from(featureRequests)
        .leftJoin(users, eq(featureRequests.userId, users.id))
        .where(conditions)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset);

      return features;
    }),

  // Get single feature with comments
  getFeature: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({
          id: featureRequests.id,
          title: featureRequests.title,
          description: featureRequests.description,
          category: featureRequests.category,
          status: featureRequests.status,
          voteCount: featureRequests.voteCount,
          createdAt: featureRequests.createdAt,
          userName: users.name,
        })
        .from(featureRequests)
        .leftJoin(users, eq(featureRequests.userId, users.id))
        .where(eq(featureRequests.id, input.id));

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }

      const comments = await ctx.db
        .select({
          id: featureComments.id,
          content: featureComments.content,
          createdAt: featureComments.createdAt,
          userName: users.name,
        })
        .from(featureComments)
        .leftJoin(users, eq(featureComments.userId, users.id))
        .where(eq(featureComments.featureId, input.id))
        .orderBy(asc(featureComments.createdAt));

      return { ...feature, comments };
    }),

  // Create feature request (authenticated)
  createFeature: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5).max(200),
        description: z.string().min(20).max(2000),
        category: z.enum(["feature", "improvement", "integration", "other"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .insert(featureRequests)
        .values({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
        })
        .returning();

      return feature;
    }),

  // Vote on feature (authenticated)
  voteFeature: protectedProcedure
    .input(z.object({ featureId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if already voted
      const [existingVote] = await ctx.db
        .select()
        .from(featureVotes)
        .where(
          and(
            eq(featureVotes.userId, ctx.user.id),
            eq(featureVotes.featureId, input.featureId)
          )
        );

      if (existingVote) {
        // Remove vote
        await ctx.db
          .delete(featureVotes)
          .where(eq(featureVotes.id, existingVote.id));

        await ctx.db
          .update(featureRequests)
          .set({ voteCount: sql`${featureRequests.voteCount} - 1` })
          .where(eq(featureRequests.id, input.featureId));

        return { voted: false };
      }

      // Add vote
      await ctx.db.insert(featureVotes).values({
        userId: ctx.user.id,
        featureId: input.featureId,
      });

      await ctx.db
        .update(featureRequests)
        .set({ voteCount: sql`${featureRequests.voteCount} + 1` })
        .where(eq(featureRequests.id, input.featureId));

      return { voted: true };
    }),

  // Check if user has voted (authenticated)
  getUserVotes: protectedProcedure.query(async ({ ctx }) => {
    const votes = await ctx.db
      .select({ featureId: featureVotes.featureId })
      .from(featureVotes)
      .where(eq(featureVotes.userId, ctx.user.id));

    return votes.map((v) => v.featureId);
  }),

  // Add comment (authenticated)
  addComment: protectedProcedure
    .input(
      z.object({
        featureId: z.string().uuid(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db
        .insert(featureComments)
        .values({
          featureId: input.featureId,
          userId: ctx.user.id,
          content: input.content,
        })
        .returning();

      return comment;
    }),
});
```

**Step 2: Register router in _app.ts**

In `src/server/routers/_app.ts`, add import and register:

```typescript
import { feedbackRouter } from "./feedback";

export const appRouter = router({
  // ... existing routers ...
  feedback: feedbackRouter,
});
```

**Step 3: Commit**

```bash
git add src/server/routers/feedback.ts src/server/routers/_app.ts
git commit -m "feat(feedback): add tRPC router for feature requests"
```

---

## Task 3: Feedback Router - Bug Reports

**Files:**
- Modify: `src/server/routers/feedback.ts`

**Step 1: Add bug report procedures to feedback router**

Add these procedures to the existing `feedbackRouter`:

```typescript
  // Submit bug report (authenticated)
  submitBug: protectedProcedure
    .input(
      z.object({
        description: z.string().min(10).max(2000),
        stepsToReproduce: z.string().max(2000).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        browserInfo: z.record(z.string()).optional(),
        currentPage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [bugReport] = await ctx.db
        .insert(bugReports)
        .values({
          userId: ctx.user.id,
          description: input.description,
          stepsToReproduce: input.stepsToReproduce,
          severity: input.severity,
          browserInfo: input.browserInfo,
          currentPage: input.currentPage,
        })
        .returning();

      // TODO: Send email notification to admin

      return { id: bugReport.id };
    }),

  // List bug reports (admin only - check env ADMIN_USER_IDS)
  listBugs: protectedProcedure
    .input(
      z.object({
        status: z.enum(["new", "investigating", "fixed", "wont_fix"]).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const conditions = [];
      if (input.status) conditions.push(eq(bugReports.status, input.status));
      if (input.severity) conditions.push(eq(bugReports.severity, input.severity));

      const bugs = await ctx.db
        .select({
          id: bugReports.id,
          description: bugReports.description,
          stepsToReproduce: bugReports.stepsToReproduce,
          severity: bugReports.severity,
          browserInfo: bugReports.browserInfo,
          currentPage: bugReports.currentPage,
          status: bugReports.status,
          adminNotes: bugReports.adminNotes,
          createdAt: bugReports.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(bugReports)
        .leftJoin(users, eq(bugReports.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(bugReports.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return bugs;
    }),

  // Update bug report status (admin only)
  updateBugStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["new", "investigating", "fixed", "wont_fix"]),
        adminNotes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const [updated] = await ctx.db
        .update(bugReports)
        .set({
          status: input.status,
          adminNotes: input.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(bugReports.id, input.id))
        .returning();

      return updated;
    }),

  // Update feature status (admin only)
  updateFeatureStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "planned", "in_progress", "shipped", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const [updated] = await ctx.db
        .update(featureRequests)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(featureRequests.id, input.id))
        .returning();

      return updated;
    }),
```

**Step 2: Commit**

```bash
git add src/server/routers/feedback.ts
git commit -m "feat(feedback): add bug report procedures to router"
```

---

## Task 4: Router Unit Tests

**Files:**
- Create: `src/server/routers/__tests__/feedback.test.ts`

**Step 1: Write tests for feedback router**

Create `src/server/routers/__tests__/feedback.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the db module before imports
vi.mock("../../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { feedbackRouter } from "../feedback";
import { createCallerFactory } from "../../trpc";

const createCaller = createCallerFactory(feedbackRouter);

describe("feedback router", () => {
  const mockUser = {
    id: "user-123",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
  };

  const mockAdminUser = {
    id: "admin-123",
    clerkId: "clerk_admin",
    email: "admin@example.com",
    name: "Admin User",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_USER_IDS", "admin-123");
  });

  describe("createFeature", () => {
    it("should create a feature request", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "feat-1",
                title: "Test Feature",
                description: "A test feature description",
                category: "feature",
                status: "open",
                voteCount: 0,
              },
            ]),
          }),
        }),
      };

      const caller = createCaller({
        db: mockDb as any,
        user: mockUser,
        clerkId: mockUser.clerkId,
        headers: new Headers(),
      });

      const result = await caller.createFeature({
        title: "Test Feature",
        description: "A test feature description",
        category: "feature",
      });

      expect(result.id).toBe("feat-1");
      expect(result.title).toBe("Test Feature");
    });
  });

  describe("voteFeature", () => {
    it("should add vote when not previously voted", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const caller = createCaller({
        db: mockDb as any,
        user: mockUser,
        clerkId: mockUser.clerkId,
        headers: new Headers(),
      });

      const result = await caller.voteFeature({ featureId: "feat-1" });
      expect(result.voted).toBe(true);
    });

    it("should remove vote when previously voted", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "vote-1" }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const caller = createCaller({
        db: mockDb as any,
        user: mockUser,
        clerkId: mockUser.clerkId,
        headers: new Headers(),
      });

      const result = await caller.voteFeature({ featureId: "feat-1" });
      expect(result.voted).toBe(false);
    });
  });

  describe("submitBug", () => {
    it("should create a bug report", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "bug-1" }]),
          }),
        }),
      };

      const caller = createCaller({
        db: mockDb as any,
        user: mockUser,
        clerkId: mockUser.clerkId,
        headers: new Headers(),
      });

      const result = await caller.submitBug({
        description: "Something is broken",
        severity: "high",
        currentPage: "/dashboard",
      });

      expect(result.id).toBe("bug-1");
    });
  });

  describe("listBugs (admin)", () => {
    it("should reject non-admin users", async () => {
      const mockDb = {} as any;

      const caller = createCaller({
        db: mockDb,
        user: mockUser,
        clerkId: mockUser.clerkId,
        headers: new Headers(),
      });

      await expect(caller.listBugs({})).rejects.toThrow("Admin access required");
    });

    it("should allow admin users", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      const caller = createCaller({
        db: mockDb as any,
        user: mockAdminUser,
        clerkId: mockAdminUser.clerkId,
        headers: new Headers(),
      });

      const result = await caller.listBugs({});
      expect(result).toEqual([]);
    });
  });
});
```

**Step 2: Run tests to verify**

Run:
```bash
npm run test -- src/server/routers/__tests__/feedback.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/feedback.test.ts
git commit -m "test(feedback): add unit tests for feedback router"
```

---

## Task 5: Feature Request Modal Component

**Files:**
- Create: `src/components/feedback/FeatureRequestModal.tsx`
- Create: `src/components/feedback/index.ts`

**Step 1: Create FeatureRequestModal component**

Create `src/components/feedback/FeatureRequestModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2 } from "lucide-react";

const featureSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(2000, "Description must be less than 2000 characters"),
  category: z.enum(["feature", "improvement", "integration", "other"]),
});

type FeatureFormData = z.infer<typeof featureSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeatureRequestModal({ open, onClose }: Props) {
  const utils = trpc.useUtils();

  const form = useForm<FeatureFormData>({
    resolver: zodResolver(featureSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "feature",
    },
  });

  const createMutation = trpc.feedback.createFeature.useMutation({
    onSuccess: () => {
      utils.feedback.listFeatures.invalidate();
      form.reset();
      onClose();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a Feature</DialogTitle>
          <DialogDescription>
            Describe the feature you&apos;d like to see. Other users can vote on
            your request.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief summary of your feature request"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="feature">New Feature</SelectItem>
                      <SelectItem value="improvement">Improvement</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what you'd like and why it would be useful..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Request
              </Button>
            </div>

            {createMutation.error && (
              <p className="text-sm text-destructive">
                {createMutation.error.message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create index barrel file**

Create `src/components/feedback/index.ts`:

```typescript
export { FeatureRequestModal } from "./FeatureRequestModal";
```

**Step 3: Commit**

```bash
git add src/components/feedback/
git commit -m "feat(feedback): add FeatureRequestModal component"
```

---

## Task 6: Bug Report Modal Component

**Files:**
- Create: `src/components/feedback/BugReportModal.tsx`
- Modify: `src/components/feedback/index.ts`

**Step 1: Create BugReportModal component**

Create `src/components/feedback/BugReportModal.tsx`:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";

const bugSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be less than 2000 characters"),
  stepsToReproduce: z
    .string()
    .max(2000, "Steps must be less than 2000 characters")
    .optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

type BugFormData = z.infer<typeof bugSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

function getBrowserInfo(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: String(window.screen.width),
    screenHeight: String(window.screen.height),
    windowWidth: String(window.innerWidth),
    windowHeight: String(window.innerHeight),
  };
}

export function BugReportModal({ open, onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<BugFormData>({
    resolver: zodResolver(bugSchema),
    defaultValues: {
      description: "",
      stepsToReproduce: "",
      severity: "medium",
    },
  });

  const submitMutation = trpc.feedback.submitBug.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    submitMutation.mutate({
      ...data,
      browserInfo: getBrowserInfo(),
      currentPage: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  });

  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <DialogTitle>Bug Report Submitted</DialogTitle>
            <p className="text-center text-muted-foreground">
              Thank you for reporting this issue. We&apos;ll investigate and get
              back to you if we need more information.
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues you encounter. Your browser
            information will be automatically included.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low - Minor issue</SelectItem>
                      <SelectItem value="medium">
                        Medium - Affects usability
                      </SelectItem>
                      <SelectItem value="high">
                        High - Major feature broken
                      </SelectItem>
                      <SelectItem value="critical">
                        Critical - Cannot use app
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the bug you encountered..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stepsToReproduce"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Steps to Reproduce (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Report
              </Button>
            </div>

            {submitMutation.error && (
              <p className="text-sm text-destructive">
                {submitMutation.error.message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Update index barrel file**

Update `src/components/feedback/index.ts`:

```typescript
export { FeatureRequestModal } from "./FeatureRequestModal";
export { BugReportModal } from "./BugReportModal";
```

**Step 3: Commit**

```bash
git add src/components/feedback/
git commit -m "feat(feedback): add BugReportModal component"
```

---

## Task 7: Feedback Button in Sidebar

**Files:**
- Create: `src/components/feedback/FeedbackButton.tsx`
- Modify: `src/components/feedback/index.ts`
- Modify: Sidebar component (find location first)

**Step 1: Create FeedbackButton component**

Create `src/components/feedback/FeedbackButton.tsx`:

```typescript
"use client";

import { useState } from "react";
import { MessageSquarePlus, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeatureRequestModal } from "./FeatureRequestModal";
import { BugReportModal } from "./BugReportModal";

export function FeedbackButton() {
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Feedback
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setFeatureModalOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Request Feature
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBugModalOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Report Bug
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeatureRequestModal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
      />
      <BugReportModal
        open={bugModalOpen}
        onClose={() => setBugModalOpen(false)}
      />
    </>
  );
}
```

**Step 2: Update index barrel file**

Update `src/components/feedback/index.ts`:

```typescript
export { FeatureRequestModal } from "./FeatureRequestModal";
export { BugReportModal } from "./BugReportModal";
export { FeedbackButton } from "./FeedbackButton";
```

**Step 3: Add FeedbackButton to sidebar**

Find the sidebar component (likely `src/components/layout/Sidebar.tsx` or similar) and add:

```typescript
import { FeedbackButton } from "@/components/feedback";

// In the sidebar JSX, add near the bottom (before settings/logout):
<FeedbackButton />
```

**Step 4: Commit**

```bash
git add src/components/feedback/ src/components/layout/
git commit -m "feat(feedback): add FeedbackButton to sidebar"
```

---

## Task 8: Public Feature Board Page

**Files:**
- Create: `src/app/feedback/page.tsx`
- Create: `src/components/feedback/FeatureList.tsx`
- Create: `src/components/feedback/FeatureCard.tsx`

**Step 1: Create FeatureCard component**

Create `src/components/feedback/FeatureCard.tsx`:

```typescript
"use client";

import { ChevronUp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useUser } from "@clerk/nextjs";

type FeatureCardProps = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  voteCount: number;
  userName: string | null;
  createdAt: Date;
  hasVoted: boolean;
};

const statusColors: Record<string, string> = {
  open: "bg-gray-100 text-gray-800",
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  shipped: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
  rejected: "Rejected",
};

export function FeatureCard({
  id,
  title,
  description,
  category,
  status,
  voteCount,
  userName,
  createdAt,
  hasVoted,
}: FeatureCardProps) {
  const { isSignedIn } = useUser();
  const utils = trpc.useUtils();

  const voteMutation = trpc.feedback.voteFeature.useMutation({
    onSuccess: () => {
      utils.feedback.listFeatures.invalidate();
      utils.feedback.getUserVotes.invalidate();
    },
  });

  const handleVote = () => {
    if (!isSignedIn) return;
    voteMutation.mutate({ featureId: id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              hasVoted && "text-primary"
            )}
            onClick={handleVote}
            disabled={!isSignedIn || voteMutation.isPending}
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium">{voteCount}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize">{category}</p>
        </div>
      </CardHeader>
      <CardContent className="pl-16">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {description}
        </p>
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>by {userName ?? "Anonymous"}</span>
          <span>{new Date(createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create FeatureList component**

Create `src/components/feedback/FeatureList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { FeatureCard } from "./FeatureCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@clerk/nextjs";
import { FeatureRequestModal } from "./FeatureRequestModal";

type StatusFilter = "all" | "open" | "planned" | "in_progress" | "shipped";
type SortBy = "votes" | "newest" | "oldest";

export function FeatureList() {
  const { isSignedIn } = useUser();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("votes");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: features, isLoading } = trpc.feedback.listFeatures.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    sortBy,
  });

  const { data: userVotes } = trpc.feedback.getUserVotes.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const votedFeatureIds = new Set(userVotes ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="votes">Most Votes</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSignedIn && (
          <Button onClick={() => setModalOpen(true)}>Request Feature</Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : features?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No feature requests yet. Be the first to suggest one!
        </div>
      ) : (
        <div className="space-y-4">
          {features?.map((feature) => (
            <FeatureCard
              key={feature.id}
              {...feature}
              hasVoted={votedFeatureIds.has(feature.id)}
            />
          ))}
        </div>
      )}

      <FeatureRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
```

**Step 3: Create public feedback page**

Create `src/app/feedback/page.tsx`:

```typescript
import { FeatureList } from "@/components/feedback/FeatureList";

export const metadata = {
  title: "Feature Requests | PropertyTracker",
  description: "Vote on features and suggest improvements for PropertyTracker",
};

export default function FeedbackPage() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feature Requests</h1>
        <p className="text-muted-foreground">
          Vote on features you&apos;d like to see, or suggest your own ideas.
          We use your feedback to prioritize our roadmap.
        </p>
      </div>

      <FeatureList />
    </div>
  );
}
```

**Step 4: Update index barrel file**

Update `src/components/feedback/index.ts`:

```typescript
export { FeatureRequestModal } from "./FeatureRequestModal";
export { BugReportModal } from "./BugReportModal";
export { FeedbackButton } from "./FeedbackButton";
export { FeatureList } from "./FeatureList";
export { FeatureCard } from "./FeatureCard";
```

**Step 5: Commit**

```bash
git add src/app/feedback/ src/components/feedback/
git commit -m "feat(feedback): add public feature board page"
```

---

## Task 9: Admin Bug Reports Dashboard

**Files:**
- Create: `src/app/(dashboard)/settings/bug-reports/page.tsx`
- Create: `src/components/feedback/BugReportList.tsx`

**Step 1: Create BugReportList component**

Create `src/components/feedback/BugReportList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type StatusFilter = "all" | "new" | "investigating" | "fixed" | "wont_fix";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";

const severityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  investigating: "bg-yellow-100 text-yellow-800",
  fixed: "bg-green-100 text-green-800",
  wont_fix: "bg-gray-100 text-gray-800",
};

type BugReport = {
  id: string;
  description: string;
  stepsToReproduce: string | null;
  severity: string;
  browserInfo: Record<string, string> | null;
  currentPage: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
};

export function BugReportList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: bugs, isLoading, error } = trpc.feedback.listBugs.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
  });

  const updateMutation = trpc.feedback.updateBugStatus.useMutation({
    onSuccess: () => {
      utils.feedback.listBugs.invalidate();
      setSelectedBug(null);
    },
  });

  const openBugDetail = (bug: BugReport) => {
    setSelectedBug(bug);
    setNewStatus(bug.status);
    setAdminNotes(bug.adminNotes ?? "");
  };

  const handleUpdate = () => {
    if (!selectedBug) return;
    updateMutation.mutate({
      id: selectedBug.id,
      status: newStatus as "new" | "investigating" | "fixed" | "wont_fix",
      adminNotes: adminNotes || undefined,
    });
  };

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : bugs?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No bug reports found.
        </div>
      ) : (
        <div className="space-y-4">
          {bugs?.map((bug) => (
            <Card
              key={bug.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openBugDetail(bug as BugReport)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {bug.description.slice(0, 100)}
                  {bug.description.length > 100 && "..."}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge className={severityColors[bug.severity]}>
                    {bug.severity}
                  </Badge>
                  <Badge className={statusColors[bug.status]}>
                    {bug.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <span>{bug.userName ?? "Anonymous"}</span>
                  <span className="mx-2">•</span>
                  <span>{bug.userEmail}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                  {bug.currentPage && (
                    <>
                      <span className="mx-2">•</span>
                      <span>{bug.currentPage}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedBug} onOpenChange={() => setSelectedBug(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
            <DialogDescription>
              Review and update the status of this bug report.
            </DialogDescription>
          </DialogHeader>

          {selectedBug && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Description</h4>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedBug.description}
                </p>
              </div>

              {selectedBug.stepsToReproduce && (
                <div>
                  <h4 className="font-medium mb-1">Steps to Reproduce</h4>
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedBug.stepsToReproduce}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Reported By</h4>
                  <p className="text-sm">
                    {selectedBug.userName ?? "Anonymous"} ({selectedBug.userEmail})
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Page</h4>
                  <p className="text-sm">{selectedBug.currentPage ?? "N/A"}</p>
                </div>
              </div>

              {selectedBug.browserInfo && (
                <div>
                  <h4 className="font-medium mb-1">Browser Info</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(selectedBug.browserInfo, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-1">Update Status</h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="font-medium mb-1">Admin Notes</h4>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this bug..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedBug(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Create admin bug reports page**

Create `src/app/(dashboard)/settings/bug-reports/page.tsx`:

```typescript
import { BugReportList } from "@/components/feedback/BugReportList";

export const metadata = {
  title: "Bug Reports | Settings",
};

export default function BugReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bug Reports</h1>
        <p className="text-muted-foreground">
          Review and manage bug reports submitted by users.
        </p>
      </div>

      <BugReportList />
    </div>
  );
}
```

**Step 3: Update index barrel file**

Update `src/components/feedback/index.ts`:

```typescript
export { FeatureRequestModal } from "./FeatureRequestModal";
export { BugReportModal } from "./BugReportModal";
export { FeedbackButton } from "./FeedbackButton";
export { FeatureList } from "./FeatureList";
export { FeatureCard } from "./FeatureCard";
export { BugReportList } from "./BugReportList";
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/bug-reports/ src/components/feedback/
git commit -m "feat(feedback): add admin bug reports dashboard"
```

---

## Task 10: Admin Feature Management

**Files:**
- Create: `src/app/(dashboard)/settings/feature-requests/page.tsx`
- Create: `src/components/feedback/AdminFeatureList.tsx`

**Step 1: Create AdminFeatureList component**

Create `src/components/feedback/AdminFeatureList.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type StatusFilter = "all" | "open" | "planned" | "in_progress" | "shipped" | "rejected";

const statusColors: Record<string, string> = {
  open: "bg-gray-100 text-gray-800",
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  shipped: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  voteCount: number;
  createdAt: Date;
  userName: string | null;
};

export function AdminFeatureList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: features, isLoading, error } = trpc.feedback.listFeatures.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    sortBy: "votes",
  });

  const updateMutation = trpc.feedback.updateFeatureStatus.useMutation({
    onSuccess: () => {
      utils.feedback.listFeatures.invalidate();
      setSelectedFeature(null);
    },
  });

  const openFeatureDetail = (feature: FeatureRequest) => {
    setSelectedFeature(feature);
    setNewStatus(feature.status);
  };

  const handleUpdate = () => {
    if (!selectedFeature) return;
    updateMutation.mutate({
      id: selectedFeature.id,
      status: newStatus as "open" | "planned" | "in_progress" | "shipped" | "rejected",
    });
  };

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : features?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No feature requests found.
        </div>
      ) : (
        <div className="space-y-4">
          {features?.map((feature) => (
            <Card
              key={feature.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openFeatureDetail(feature as FeatureRequest)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {feature.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{feature.voteCount} votes</span>
                  <Badge className={statusColors[feature.status]}>
                    {feature.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {feature.description}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <span>{feature.userName ?? "Anonymous"}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(feature.createdAt).toLocaleDateString()}</span>
                  <span className="mx-2">•</span>
                  <span className="capitalize">{feature.category}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedFeature} onOpenChange={() => setSelectedFeature(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Feature Request Details</DialogTitle>
            <DialogDescription>
              Review and update the status of this feature request.
            </DialogDescription>
          </DialogHeader>

          {selectedFeature && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">{selectedFeature.title}</h4>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedFeature.description}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  <span className="capitalize">{selectedFeature.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Votes:</span>{" "}
                  {selectedFeature.voteCount}
                </div>
                <div>
                  <span className="text-muted-foreground">By:</span>{" "}
                  {selectedFeature.userName ?? "Anonymous"}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-1">Update Status</h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedFeature(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Create admin feature requests page**

Create `src/app/(dashboard)/settings/feature-requests/page.tsx`:

```typescript
import { AdminFeatureList } from "@/components/feedback/AdminFeatureList";

export const metadata = {
  title: "Feature Requests | Settings",
};

export default function FeatureRequestsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Requests</h1>
        <p className="text-muted-foreground">
          Manage feature requests and update their status.
        </p>
      </div>

      <AdminFeatureList />
    </div>
  );
}
```

**Step 3: Update index barrel file**

Update `src/components/feedback/index.ts`:

```typescript
export { FeatureRequestModal } from "./FeatureRequestModal";
export { BugReportModal } from "./BugReportModal";
export { FeedbackButton } from "./FeedbackButton";
export { FeatureList } from "./FeatureList";
export { FeatureCard } from "./FeatureCard";
export { BugReportList } from "./BugReportList";
export { AdminFeatureList } from "./AdminFeatureList";
```

**Step 4: Add links to settings navigation**

Find the settings navigation component and add links:

```typescript
{ href: "/settings/feature-requests", label: "Feature Requests", icon: MessageSquarePlus },
{ href: "/settings/bug-reports", label: "Bug Reports", icon: Bug },
```

**Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/feature-requests/ src/components/feedback/
git commit -m "feat(feedback): add admin feature requests management"
```

---

## Task 11: E2E Tests

**Files:**
- Create: `e2e/feedback.spec.ts`

**Step 1: Write E2E tests for feedback system**

Create `e2e/feedback.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Request Board", () => {
  test("should display feature list on public page", async ({ page }) => {
    await page.goto("/feedback");

    await expect(page.getByRole("heading", { name: "Feature Requests" })).toBeVisible();
    await expect(page.getByText("Vote on features")).toBeVisible();
  });

  test("should filter features by status", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("combobox", { name: /filter by status/i }).click();
    await page.getByRole("option", { name: "Open" }).click();

    // Verify filter is applied (URL or UI state)
    await expect(page.getByRole("combobox")).toContainText("Open");
  });

  test("should sort features", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("combobox", { name: /sort by/i }).click();
    await page.getByRole("option", { name: "Newest" }).click();

    await expect(page.getByRole("combobox")).toContainText("Newest");
  });
});

test.describe("Feature Request Submission", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should open feature request modal", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: "Request Feature" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Request a Feature")).toBeVisible();
  });

  test("should submit feature request", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: "Request Feature" }).click();

    await page.getByLabel("Title").fill("Test Feature Request");
    await page.getByLabel("Description").fill("This is a test feature request description that is long enough.");
    await page.getByRole("combobox", { name: /category/i }).click();
    await page.getByRole("option", { name: "New Feature" }).click();

    await page.getByRole("button", { name: "Submit Request" }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("should vote on feature", async ({ page }) => {
    await page.goto("/feedback");

    // Find first feature card and click vote button
    const firstCard = page.locator("[data-testid='feature-card']").first();
    const voteButton = firstCard.getByRole("button").first();

    await voteButton.click();

    // Vote button should show voted state
    await expect(voteButton).toHaveClass(/text-primary/);
  });
});

test.describe("Bug Report Submission", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should open bug report modal from sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Feedback" }).click();
    await page.getByRole("menuitem", { name: "Report Bug" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Report a Bug")).toBeVisible();
  });

  test("should submit bug report", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Feedback" }).click();
    await page.getByRole("menuitem", { name: "Report Bug" }).click();

    await page.getByRole("combobox", { name: /severity/i }).click();
    await page.getByRole("option", { name: /high/i }).click();

    await page.getByLabel("What happened?").fill("Test bug report description");

    await page.getByRole("button", { name: "Submit Report" }).click();

    // Should show success message
    await expect(page.getByText("Bug Report Submitted")).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

Run:
```bash
npm run test:e2e -- e2e/feedback.spec.ts
```

Expected: Tests should pass (may need auth setup adjustments).

**Step 3: Commit**

```bash
git add e2e/feedback.spec.ts
git commit -m "test(feedback): add E2E tests for feedback system"
```

---

## Task 12: Add ADMIN_USER_IDS to Environment

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (if exists, don't commit)

**Step 1: Update .env.example**

Add to `.env.example`:

```
# Admin user IDs (comma-separated UUIDs)
ADMIN_USER_IDS=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add ADMIN_USER_IDS to env example"
```

---

## Task 13: Final Integration and Cleanup

**Step 1: Run full test suite**

```bash
npm run test
npm run lint
npm run build
```

**Step 2: Fix any issues**

Address any TypeScript errors, lint issues, or test failures.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(feedback): complete user feedback system implementation

- Public feature request board with voting
- Private bug report submission
- Admin dashboards for managing requests and bugs
- Feedback button in sidebar
- Full test coverage"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database schema | `src/server/db/schema.ts` |
| 2 | Feedback router (features) | `src/server/routers/feedback.ts`, `_app.ts` |
| 3 | Feedback router (bugs) | `src/server/routers/feedback.ts` |
| 4 | Router unit tests | `src/server/routers/__tests__/feedback.test.ts` |
| 5 | FeatureRequestModal | `src/components/feedback/FeatureRequestModal.tsx` |
| 6 | BugReportModal | `src/components/feedback/BugReportModal.tsx` |
| 7 | FeedbackButton in sidebar | `src/components/feedback/FeedbackButton.tsx` |
| 8 | Public feature board page | `src/app/feedback/page.tsx`, `FeatureList.tsx`, `FeatureCard.tsx` |
| 9 | Admin bug reports dashboard | `src/app/(dashboard)/settings/bug-reports/page.tsx` |
| 10 | Admin feature management | `src/app/(dashboard)/settings/feature-requests/page.tsx` |
| 11 | E2E tests | `e2e/feedback.spec.ts` |
| 12 | Environment config | `.env.example` |
| 13 | Final integration | All files |
