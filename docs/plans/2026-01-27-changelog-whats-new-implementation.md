# Changelog & What's New Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a public changelog page and in-app "What's New" drawer with read-tracking.

**Architecture:** Markdown files in `/content/changelog/` are synced to PostgreSQL on build. Public pages render from DB. Logged-in users get read-tracking via `user_changelog_views` table. Header button shows notification dot when unread entries exist.

**Tech Stack:** Next.js 16, Drizzle ORM, tRPC, Radix UI Dialog, gray-matter, Tailwind CSS

---

## Task 1: Install gray-matter dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run:
```bash
npm install gray-matter
```

**Step 2: Verify installation**

Run:
```bash
grep "gray-matter" package.json
```
Expected: `"gray-matter": "^X.X.X"` in dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gray-matter for changelog markdown parsing"
```

---

## Task 2: Add database schema for changelog

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add the enum and tables to schema.ts**

Add after the last enum definition (around line 200):

```typescript
export const changelogCategoryEnum = pgEnum("changelog_category", [
  "feature",
  "improvement",
  "fix",
]);
```

Add after the last table definition:

```typescript
// Changelog entries (synced from markdown files)
export const changelogEntries = pgTable("changelog_entries", {
  id: text("id").primaryKey(), // slug from filename
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: changelogCategoryEnum("category").notNull(),
  publishedAt: date("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track when users last viewed changelog
export const userChangelogViews = pgTable("user_changelog_views", {
  userId: text("user_id").primaryKey(),
  lastViewedAt: timestamp("last_viewed_at").notNull(),
});
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Generate migration**

Run:
```bash
npm run db:generate
```
Expected: New migration file created in `/drizzle/`

**Step 4: Apply migration**

Run:
```bash
npm run db:push
```
Expected: Tables created successfully

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(changelog): add database schema for changelog entries and views"
```

---

## Task 3: Create changelog tRPC router

**Files:**
- Create: `src/server/routers/changelog.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router file**

Create `src/server/routers/changelog.ts`:

```typescript
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { changelogEntries, userChangelogViews } from "../db/schema";
import { eq, desc, gt, and } from "drizzle-orm";

export const changelogRouter = router({
  // List entries with optional filtering (public)
  list: publicProcedure
    .input(
      z.object({
        category: z.enum(["feature", "improvement", "fix"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.category) {
        conditions.push(eq(changelogEntries.category, input.category));
      }

      if (input.cursor) {
        conditions.push(gt(changelogEntries.id, input.cursor));
      }

      const entries = await ctx.db
        .select()
        .from(changelogEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(changelogEntries.publishedAt))
        .limit(input.limit + 1);

      let nextCursor: string | undefined;
      if (entries.length > input.limit) {
        const nextItem = entries.pop();
        nextCursor = nextItem?.id;
      }

      return { entries, nextCursor };
    }),

  // Get single entry by slug (public)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(changelogEntries)
        .where(eq(changelogEntries.id, input.slug));

      return entry ?? null;
    }),

  // Get count of unread entries (protected)
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [view] = await ctx.db
      .select()
      .from(userChangelogViews)
      .where(eq(userChangelogViews.userId, ctx.user.id));

    if (!view) {
      // User has never viewed - count all entries
      const [result] = await ctx.db
        .select({ count: changelogEntries.id })
        .from(changelogEntries);

      const entries = await ctx.db.select().from(changelogEntries);
      return entries.length;
    }

    // Count entries newer than last viewed
    const entries = await ctx.db
      .select()
      .from(changelogEntries)
      .where(gt(changelogEntries.createdAt, view.lastViewedAt));

    return entries.length;
  }),

  // Mark as viewed (protected)
  markAsViewed: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .insert(userChangelogViews)
      .values({
        userId: ctx.user.id,
        lastViewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userChangelogViews.userId,
        set: { lastViewedAt: new Date() },
      });

    return { success: true };
  }),
});
```

**Step 2: Register the router**

In `src/server/routers/_app.ts`, add the import and registration:

Add import at top:
```typescript
import { changelogRouter } from "./changelog";
```

Add to router object:
```typescript
  changelog: changelogRouter,
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/changelog.ts src/server/routers/_app.ts
git commit -m "feat(changelog): add tRPC router for changelog operations"
```

---

## Task 4: Create changelog sync script

**Files:**
- Create: `scripts/sync-changelog.ts`
- Modify: `package.json`

**Step 1: Create the sync script**

Create `scripts/sync-changelog.ts`:

```typescript
import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { changelogEntries } from "../src/server/db/schema";
import { eq, notInArray } from "drizzle-orm";

config({ path: ".env.local" });

const CHANGELOG_DIR = join(process.cwd(), "content", "changelog");

const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(["feature", "improvement", "fix"]),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const filenameSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-.+\.md$/);

async function syncChangelog() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);

  console.log("Syncing changelog entries...");

  let files: string[];
  try {
    files = await readdir(CHANGELOG_DIR);
  } catch {
    console.log("No changelog directory found, creating empty sync");
    files = [];
  }

  const validSlugs: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // Validate filename
    const filenameResult = filenameSchema.safeParse(file);
    if (!filenameResult.success) {
      errors.push(`Invalid filename: ${file} (expected YYYY-MM-DD-slug.md)`);
      continue;
    }

    const slug = file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const filePath = join(CHANGELOG_DIR, file);
    const content = await readFile(filePath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(content);

    // Validate frontmatter
    const result = frontmatterSchema.safeParse(frontmatter);
    if (!result.success) {
      errors.push(`Invalid frontmatter in ${file}: ${result.error.message}`);
      continue;
    }

    const { title, summary, category, publishedAt } = result.data;

    // Validate date matches filename
    const fileDate = file.substring(0, 10);
    if (fileDate !== publishedAt) {
      errors.push(`Date mismatch in ${file}: filename=${fileDate}, frontmatter=${publishedAt}`);
      continue;
    }

    validSlugs.push(slug);

    // Upsert entry
    await db
      .insert(changelogEntries)
      .values({
        id: slug,
        title,
        summary,
        content: markdownContent.trim(),
        category,
        publishedAt,
      })
      .onConflictDoUpdate({
        target: changelogEntries.id,
        set: {
          title,
          summary,
          content: markdownContent.trim(),
          category,
          publishedAt,
        },
      });

    console.log(`  ✓ ${slug}`);
  }

  // Delete entries not in filesystem
  if (validSlugs.length > 0) {
    await db
      .delete(changelogEntries)
      .where(notInArray(changelogEntries.id, validSlugs));
  } else {
    // If no valid files, delete all entries
    await db.delete(changelogEntries);
  }

  if (errors.length > 0) {
    console.log("\nWarnings:");
    errors.forEach((e) => console.log(`  ⚠ ${e}`));
  }

  console.log(`\nSync complete: ${validSlugs.length} entries`);

  await client.end();
}

syncChangelog().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
```

**Step 2: Add npm scripts**

In `package.json`, add to scripts:

```json
"changelog:sync": "tsx scripts/sync-changelog.ts",
```

**Step 3: Create content directory and sample entry**

Create `content/changelog/2026-01-27-user-feedback-system.md`:

```markdown
---
title: "User Feedback System"
summary: "Submit feature requests and bug reports directly from the app"
category: "feature"
publishedAt: "2026-01-27"
---

We've added a new feedback system that lets you:

- **Submit feature requests** - Vote and comment on ideas from other users
- **Report bugs** - Include browser info and steps to reproduce automatically
- **Track progress** - See when your feedback moves to "planned" or "shipped"

Find the feedback options in Settings > Feature Requests and Settings > Bug Reports.
```

**Step 4: Test the sync**

Run:
```bash
npm run changelog:sync
```
Expected: `Sync complete: 1 entries`

**Step 5: Commit**

```bash
git add scripts/sync-changelog.ts package.json content/
git commit -m "feat(changelog): add sync script and first changelog entry"
```

---

## Task 5: Create WhatsNewButton component

**Files:**
- Create: `src/components/changelog/WhatsNewButton.tsx`

**Step 1: Create the component**

Create `src/components/changelog/WhatsNewButton.tsx`:

```typescript
"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

interface WhatsNewButtonProps {
  onClick: () => void;
}

export function WhatsNewButton({ onClick }: WhatsNewButtonProps) {
  const { data: unreadCount } = trpc.changelog.getUnreadCount.useQuery(undefined, {
    refetchInterval: 300000, // 5 minutes
  });

  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="relative"
      aria-label="What's new"
    >
      <Sparkles className="h-5 w-5" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
        </span>
      )}
    </Button>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/changelog/WhatsNewButton.tsx
git commit -m "feat(changelog): add WhatsNewButton component with notification dot"
```

---

## Task 6: Create ChangelogEntry component

**Files:**
- Create: `src/components/changelog/ChangelogEntry.tsx`

**Step 1: Create the component**

Create `src/components/changelog/ChangelogEntry.tsx`:

```typescript
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";

interface ChangelogEntryProps {
  entry: {
    id: string;
    title: string;
    summary: string;
    category: "feature" | "improvement" | "fix";
    publishedAt: string;
  };
  showLink?: boolean;
}

const categoryStyles = {
  feature: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  improvement: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fix: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const categoryLabels = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Fix",
};

export function ChangelogEntry({ entry, showLink = true }: ChangelogEntryProps) {
  const content = (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className={categoryStyles[entry.category]}>
          {categoryLabels[entry.category]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {format(new Date(entry.publishedAt), "MMM d, yyyy")}
        </span>
      </div>
      <h3 className="font-semibold mb-1">{entry.title}</h3>
      <p className="text-sm text-muted-foreground">{entry.summary}</p>
    </div>
  );

  if (showLink) {
    return (
      <Link href={`/changelog/${entry.id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/changelog/ChangelogEntry.tsx
git commit -m "feat(changelog): add ChangelogEntry component"
```

---

## Task 7: Create WhatsNewDrawer component

**Files:**
- Create: `src/components/changelog/WhatsNewDrawer.tsx`

**Step 1: Create the component**

Create `src/components/changelog/WhatsNewDrawer.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ChangelogEntry } from "./ChangelogEntry";
import Link from "next/link";

interface WhatsNewDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function WhatsNewDrawer({ open, onClose }: WhatsNewDrawerProps) {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.changelog.list.useQuery(
    { limit: 10 },
    { enabled: open }
  );

  const markAsViewed = trpc.changelog.markAsViewed.useMutation({
    onSuccess: () => {
      utils.changelog.getUnreadCount.invalidate();
    },
  });

  useEffect(() => {
    if (open) {
      markAsViewed.mutate();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-lg z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">What&apos;s New</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data?.entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No updates yet. Check back soon!
            </p>
          ) : (
            <div className="space-y-4">
              {data?.entries.map((entry) => (
                <div key={entry.id} onClick={onClose}>
                  <ChangelogEntry entry={entry} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" asChild onClick={onClose}>
            <Link href="/changelog">View full changelog</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/changelog/WhatsNewDrawer.tsx
git commit -m "feat(changelog): add WhatsNewDrawer component"
```

---

## Task 8: Integrate What's New into Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Update Header to include What's New button and drawer**

Replace `src/components/layout/Header.tsx` with:

```typescript
"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { QuickAddButton } from "./QuickAddButton";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import { WhatsNewButton } from "@/components/changelog/WhatsNewButton";
import { WhatsNewDrawer } from "@/components/changelog/WhatsNewDrawer";

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <AlertBadge />
          <WhatsNewButton onClick={() => setDrawerOpen(true)} />
          <QuickAddButton />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      <WhatsNewDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(changelog): integrate What's New button and drawer into header"
```

---

## Task 9: Create public changelog page

**Files:**
- Create: `src/app/changelog/page.tsx`
- Create: `src/app/changelog/layout.tsx`

**Step 1: Create the layout**

Create `src/app/changelog/layout.tsx`:

```typescript
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Changelog - PropertyTracker",
  description: "See what's new in PropertyTracker. Latest features, improvements, and fixes.",
};

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">PropertyTracker</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              PropertyTracker &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

**Step 2: Create the page**

Create `src/app/changelog/page.tsx`:

```typescript
import { db } from "@/server/db";
import { changelogEntries } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { ChangelogEntry } from "@/components/changelog/ChangelogEntry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

async function getEntries(category?: "feature" | "improvement" | "fix") {
  const conditions = category ? eq(changelogEntries.category, category) : undefined;

  return db
    .select()
    .from(changelogEntries)
    .where(conditions)
    .orderBy(desc(changelogEntries.publishedAt));
}

export default async function ChangelogPage() {
  const allEntries = await getEntries();
  const featureEntries = await getEntries("feature");
  const improvementEntries = await getEntries("improvement");
  const fixEntries = await getEntries("fix");

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Changelog</h1>
          <p className="text-xl text-muted-foreground">
            See what&apos;s new in PropertyTracker
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="improvements">Improvements</TabsTrigger>
            <TabsTrigger value="fixes">Fixes</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {allEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No updates yet. Check back soon!
              </p>
            ) : (
              allEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            {featureEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No feature updates yet.
              </p>
            ) : (
              featureEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>

          <TabsContent value="improvements" className="space-y-4">
            {improvementEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No improvements yet.
              </p>
            ) : (
              improvementEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>

          <TabsContent value="fixes" className="space-y-4">
            {fixEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No fixes yet.
              </p>
            ) : (
              fixEntries.map((entry) => (
                <ChangelogEntry key={entry.id} entry={entry} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/changelog/
git commit -m "feat(changelog): add public changelog page with category filters"
```

---

## Task 10: Create individual changelog entry page

**Files:**
- Create: `src/app/changelog/[slug]/page.tsx`

**Step 1: Create the page**

Create `src/app/changelog/[slug]/page.tsx`:

```typescript
import { db } from "@/server/db";
import { changelogEntries } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-static";
export const revalidate = 3600;

const categoryStyles = {
  feature: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  improvement: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fix: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const categoryLabels = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Fix",
};

export async function generateStaticParams() {
  const entries = await db.select({ id: changelogEntries.id }).from(changelogEntries);
  return entries.map((entry) => ({ slug: entry.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, slug));

  if (!entry) {
    return { title: "Not Found - PropertyTracker" };
  }

  return {
    title: `${entry.title} - Changelog - PropertyTracker`,
    description: entry.summary,
  };
}

export default async function ChangelogEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, slug));

  if (!entry) {
    notFound();
  }

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" asChild className="mb-8">
          <Link href="/changelog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Changelog
          </Link>
        </Button>

        <article>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className={categoryStyles[entry.category]}>
              {categoryLabels[entry.category]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(entry.publishedAt), "MMMM d, yyyy")}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{entry.title}</h1>
          <p className="text-lg text-muted-foreground mb-8">{entry.summary}</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {entry.content.split("\n\n").map((paragraph, i) => {
              if (paragraph.startsWith("- ")) {
                const items = paragraph.split("\n").filter((line) => line.startsWith("- "));
                return (
                  <ul key={i}>
                    {items.map((item, j) => (
                      <li key={j} dangerouslySetInnerHTML={{ __html: formatMarkdown(item.slice(2)) }} />
                    ))}
                  </ul>
                );
              }
              return <p key={i} dangerouslySetInnerHTML={{ __html: formatMarkdown(paragraph) }} />;
            })}
          </div>
        </article>
      </div>
    </main>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/changelog/[slug]/
git commit -m "feat(changelog): add individual changelog entry page"
```

---

## Task 11: Add changelog link to landing page footer

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add changelog link to footer**

In `src/app/page.tsx`, find the footer links section and add the changelog link:

Find:
```typescript
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
```

Replace with:
```typescript
            <Link href="/changelog" className="hover:text-foreground">
              Changelog
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(changelog): add changelog link to landing page footer"
```

---

## Task 12: Create index export for changelog components

**Files:**
- Create: `src/components/changelog/index.ts`

**Step 1: Create the index file**

Create `src/components/changelog/index.ts`:

```typescript
export { WhatsNewButton } from "./WhatsNewButton";
export { WhatsNewDrawer } from "./WhatsNewDrawer";
export { ChangelogEntry } from "./ChangelogEntry";
```

**Step 2: Commit**

```bash
git add src/components/changelog/index.ts
git commit -m "chore(changelog): add component exports"
```

---

## Task 13: Test the feature manually

**Step 1: Start the dev server**

Run:
```bash
npm run dev
```

**Step 2: Test public changelog page**

1. Visit http://localhost:3000/changelog
2. Verify the page loads with the sample entry
3. Click on the entry to view the detail page
4. Test the category filter tabs

**Step 3: Test in-app What's New**

1. Sign in at http://localhost:3000/sign-in
2. Navigate to the dashboard
3. Verify the sparkles icon appears in the header with a notification dot
4. Click the button to open the drawer
5. Verify the drawer shows recent entries
6. Close and reopen - verify the dot is gone
7. Click "View full changelog" link

**Step 4: Commit any fixes if needed**

---

## Task 14: Add E2E test for changelog page

**Files:**
- Create: `e2e/changelog.spec.ts`

**Step 1: Create the E2E test**

Create `e2e/changelog.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Changelog", () => {
  test("public changelog page loads and shows entries", async ({ page }) => {
    await page.goto("/changelog");

    // Verify page title
    await expect(page.locator("h1")).toContainText("Changelog");

    // Verify tabs exist
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Features" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Improvements" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fixes" })).toBeVisible();
  });

  test("changelog entry detail page loads", async ({ page }) => {
    await page.goto("/changelog");

    // Click on an entry (if exists)
    const entry = page.locator("a[href^='/changelog/']").first();
    if (await entry.isVisible()) {
      await entry.click();

      // Verify we're on detail page
      await expect(page.getByRole("link", { name: /Back to Changelog/i })).toBeVisible();
    }
  });

  test("category filters work", async ({ page }) => {
    await page.goto("/changelog");

    // Click Features tab
    await page.getByRole("tab", { name: "Features" }).click();

    // Verify we're on the features tab
    await expect(page.getByRole("tab", { name: "Features" })).toHaveAttribute(
      "data-state",
      "active"
    );
  });
});
```

**Step 2: Run the test**

Run:
```bash
npm run test:e2e -- e2e/changelog.spec.ts
```
Expected: All tests pass

**Step 3: Commit**

```bash
git add e2e/changelog.spec.ts
git commit -m "test(changelog): add E2E tests for changelog pages"
```

---

## Task 15: Final verification and cleanup

**Step 1: Run all tests**

Run:
```bash
npm run test:unit
npm run test:e2e
```
Expected: All tests pass

**Step 2: Run linter**

Run:
```bash
npm run lint
```
Expected: No errors (fix any that appear)

**Step 3: Verify build works**

Run:
```bash
npm run build
```
Expected: Build succeeds

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(changelog): address lint and test issues"
```

---

## Summary

This implementation adds:

1. **Database schema** - `changelog_entries` and `user_changelog_views` tables
2. **Sync script** - Markdown files in `/content/changelog/` sync to database
3. **tRPC router** - Public listing + protected read-tracking
4. **Header integration** - What's New button with notification dot
5. **Drawer component** - Slide-in drawer showing recent updates
6. **Public pages** - `/changelog` list + `/changelog/[slug]` detail
7. **E2E tests** - Basic coverage for public pages

Total files created/modified: 15
