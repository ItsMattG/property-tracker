# Blog & SEO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public blog at `/blog` with 4 initial articles and SEO infrastructure (sitemap, robots.txt, structured data, Open Graph) for lead generation.

**Architecture:** Markdown files in `/content/blog/` synced to a `blog_posts` PostgreSQL table via a script (mirroring the changelog pattern). Public Next.js App Router pages at `/blog` and `/blog/[slug]` with server-side rendering. tRPC public procedures for listing, filtering, and reading posts. SEO via Next.js built-in sitemap/robots generation plus JSON-LD structured data.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM, PostgreSQL, tRPC, gray-matter, Zod, TailwindCSS, Radix UI, Playwright (E2E tests)

---

## Task 1: Database Schema — Blog Posts Table

**Files:**
- Modify: `src/server/db/schema.ts:423-430` (add enum after `changelogCategoryEnum`) and `:1330` (add table after `changelogEntries`)

**Step 1: Add the blog category enum and blog_posts table to the schema**

Add immediately after the `changelogCategoryEnum` definition (around line 427):

```typescript
export const blogCategoryEnum = pgEnum("blog_category", [
  "fundamentals",
  "strategy",
  "finance",
  "tax",
  "advanced",
]);
```

Add after the `userChangelogViews` table definition (around line 1336):

```typescript
// Blog posts (synced from markdown files)
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: blogCategoryEnum("category").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'`),
  author: text("author").notNull(),
  publishedAt: date("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Add at the end of the file (after the existing type exports):

```typescript
// Blog Types
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
```

**Note:** Ensure `serial` is imported from `drizzle-orm/pg-core` (check the existing imports at the top of schema.ts — it should already be there since other tables use it).

**Step 2: Generate the database migration**

Run: `npm run db:generate`
Expected: A new migration file in `drizzle/` that creates the `blog_category` enum and `blog_posts` table.

**Step 3: Apply the migration**

Run: `npm run db:push`
Expected: Schema applied to database successfully.

**Step 4: Verify by checking TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors related to blog schema.

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(blog): add blog_posts table and blog_category enum"
```

---

## Task 2: Blog Sync Script

**Files:**
- Create: `scripts/sync-blog.ts`
- Reference: `scripts/sync-changelog.ts` (same pattern)

**Step 1: Create the sync script**

Create `scripts/sync-blog.ts`:

```typescript
import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { blogPosts } from "../src/server/db/schema";
import { eq, notInArray } from "drizzle-orm";

config({ path: ".env.local" });

const BLOG_DIR = join(process.cwd(), "content", "blog");

const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(["fundamentals", "strategy", "finance", "tax", "advanced"]),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()).min(1),
  author: z.string().min(1),
});

const filenameSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-.+\.md$/);

async function syncBlog() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);

  console.log("Syncing blog posts...");

  let files: string[];
  try {
    files = await readdir(BLOG_DIR);
  } catch {
    console.log("No blog directory found, creating empty sync");
    files = [];
  }

  const validSlugs: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const filenameResult = filenameSchema.safeParse(file);
    if (!filenameResult.success) {
      errors.push(`Invalid filename: ${file} (expected YYYY-MM-DD-slug.md)`);
      continue;
    }

    const slug = file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const filePath = join(BLOG_DIR, file);
    const rawContent = await readFile(filePath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(rawContent);

    const result = frontmatterSchema.safeParse(frontmatter);
    if (!result.success) {
      errors.push(`Invalid frontmatter in ${file}: ${result.error.message}`);
      continue;
    }

    const { title, summary, category, publishedAt, tags, author } = result.data;

    const fileDate = file.substring(0, 10);
    if (fileDate !== publishedAt) {
      errors.push(`Date mismatch in ${file}: filename=${fileDate}, frontmatter=${publishedAt}`);
      continue;
    }

    validSlugs.push(slug);

    // Upsert blog post
    const existing = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug));

    if (existing.length > 0) {
      await db
        .update(blogPosts)
        .set({
          title,
          summary,
          content: markdownContent.trim(),
          category,
          tags,
          author,
          publishedAt,
        })
        .where(eq(blogPosts.slug, slug));
    } else {
      await db.insert(blogPosts).values({
        slug,
        title,
        summary,
        content: markdownContent.trim(),
        category,
        tags,
        author,
        publishedAt,
      });
    }

    console.log(`  ✓ ${slug}`);
  }

  // Delete posts not in filesystem
  if (validSlugs.length > 0) {
    await db
      .delete(blogPosts)
      .where(notInArray(blogPosts.slug, validSlugs));
  } else {
    await db.delete(blogPosts);
  }

  if (errors.length > 0) {
    console.log("\nWarnings:");
    errors.forEach((e) => console.log(`  ⚠ ${e}`));
  }

  console.log(`\nSync complete: ${validSlugs.length} posts`);

  await client.end();
}

syncBlog().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
```

**Step 2: Verify it compiles (no content yet, should handle empty dir)**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add scripts/sync-blog.ts
git commit -m "feat(blog): add blog content sync script"
```

---

## Task 3: Initial Blog Articles (4 Markdown Files)

**Files:**
- Create: `content/blog/2026-02-03-what-is-lvr.md`
- Create: `content/blog/2026-02-10-gearing-explained.md`
- Create: `content/blog/2026-02-17-calculate-rental-yield.md`
- Create: `content/blog/2026-02-24-good-vs-bad-debt.md`

**Step 1: Create the content/blog directory and first article**

Create `content/blog/2026-02-03-what-is-lvr.md`:

```markdown
---
title: "What Is LVR and Why Does It Matter?"
summary: "Loan-to-value ratio is the single most important number in property finance. Here's what it means and why every investor needs to know it."
category: "fundamentals"
publishedAt: "2026-02-03"
tags: ["finance", "lvr", "equity", "lending"]
author: "PropertyTracker"
---

If you're investing in property, your **Loan-to-Value Ratio (LVR)** is the number that determines how much you can borrow, what interest rate you'll pay, and whether you need Lenders Mortgage Insurance (LMI).

## What is LVR?

LVR is your loan amount divided by the property value, expressed as a percentage.

**Example:** You buy a $600,000 property with a $480,000 loan.
LVR = $480,000 ÷ $600,000 = **80%**

## Why 80% is the magic number

Most Australian lenders use 80% as the threshold:

- **Below 80% LVR** — No LMI required, better interest rates, easier approval
- **Above 80% LVR** — LMI applies (a one-off fee that can cost $10,000+), stricter assessment
- **Above 90% LVR** — Fewer lenders will consider your application

## How LVR affects investors

As your property grows in value, your LVR drops. A property purchased at 80% LVR that grows 10% now sits at roughly 73% LVR — unlocking **usable equity** you can borrow against for your next investment.

This is the core engine of portfolio growth: buy, wait for equity gains, then use that equity as a deposit for the next property.

## The takeaway

Track your LVR across every property. When it drops below 80%, you may have enough usable equity to fund your next deposit without saving a cent.
```

**Step 2: Create the second article**

Create `content/blog/2026-02-10-gearing-explained.md`:

```markdown
---
title: "Positive vs Negative Gearing Explained"
summary: "Australia's most talked-about property tax strategy. Here's what positive and negative gearing actually mean for your cash flow and tax."
category: "fundamentals"
publishedAt: "2026-02-10"
tags: ["tax", "gearing", "cash-flow", "deductions"]
author: "PropertyTracker"
---

Gearing is simply whether your investment property makes or loses money each year before tax. It's the foundation of every Australian property investor's tax strategy.

## Negative gearing

Your property is **negatively geared** when expenses exceed income. The loss reduces your taxable income.

**Example:** $25,000 rent income – $32,000 expenses (interest, rates, insurance, depreciation) = **–$7,000 loss**. If you're on a 37% marginal tax rate, that saves you $2,590 in tax.

You're spending real money to get a tax deduction — the strategy only works if the property grows in value over time.

## Positive gearing

Your property is **positively geared** when income exceeds expenses. You're making money from day one, but you'll pay tax on the profit.

**Example:** $30,000 rent income – $24,000 expenses = **+$6,000 profit**. At a 37% tax rate, you owe $2,220 extra tax, but you're still $3,780 ahead.

## Which is better?

Neither is inherently better. It depends on your income, goals, and stage of investing:

- **High income earners** often start negatively geared to offset tax, expecting capital growth
- **Investors closer to retirement** prefer positive gearing for cash flow
- **Most properties** shift from negative to positive gearing as rents rise and fixed expenses don't

## The takeaway

Don't chase negative gearing for its own sake. Focus on total return — capital growth plus rental yield minus all costs. Track both sides so you know exactly where you stand at tax time.
```

**Step 3: Create the third article**

Create `content/blog/2026-02-17-calculate-rental-yield.md`:

```markdown
---
title: "How to Calculate Rental Yield"
summary: "Rental yield tells you how hard your property is working. Here's the formula every Australian investor should know."
category: "strategy"
publishedAt: "2026-02-17"
tags: ["yield", "rental", "strategy", "analysis"]
author: "PropertyTracker"
---

Rental yield measures how much income your property generates relative to its value. It's the quickest way to compare investment properties and understand your cash flow position.

## Gross rental yield

The simple version — annual rent divided by property value.

**Formula:** Gross Yield = (Annual Rent ÷ Property Value) × 100

**Example:** A $500,000 property renting for $500/week.
Annual rent = $500 × 52 = $26,000
Gross yield = $26,000 ÷ $500,000 × 100 = **5.2%**

## Net rental yield

The realistic version — factors in expenses like council rates, insurance, management fees, maintenance, and strata.

**Formula:** Net Yield = ((Annual Rent – Annual Expenses) ÷ Property Value) × 100

**Example:** Same property with $8,000 in annual expenses.
Net yield = ($26,000 – $8,000) ÷ $500,000 × 100 = **3.6%**

## What's a good yield?

For Australian investment properties in 2026:

- **Under 3% gross** — Low yield, relying heavily on capital growth (common in Sydney, Melbourne)
- **4-5% gross** — Balanced, typical of metro fringe suburbs
- **6%+ gross** — High yield, often regional areas (may trade off capital growth)

## Yield vs growth

High-yield properties generate cash flow. High-growth properties build equity. The best portfolio has a mix of both — some properties paying the bills, others building wealth.

## The takeaway

Always calculate net yield, not gross. Gross yield looks good on paper but doesn't account for the real costs of ownership. Track your actual expenses to know your true return.
```

**Step 4: Create the fourth article**

Create `content/blog/2026-02-24-good-vs-bad-debt.md`:

```markdown
---
title: "Good Debt vs Bad Debt for Property Investors"
summary: "Not all debt is equal. Understanding the difference between good and bad debt is the foundation of smart property investing."
category: "fundamentals"
publishedAt: "2026-02-24"
tags: ["finance", "debt", "strategy", "fundamentals"]
author: "PropertyTracker"
---

Most people are taught that debt is bad. But property investors know there's a critical difference between debt that costs you money and debt that builds wealth.

## What is good debt?

Good debt is borrowing to buy assets that grow in value or generate income. Investment property loans are the textbook example:

- The property appreciates over time
- Rent covers a portion (or all) of the loan repayments
- Interest on investment loans is tax-deductible
- Inflation erodes the real value of the debt

**Example:** A $500,000 investment loan at 6% costs $30,000/year in interest. But the property generates $26,000 in rent, grows 5% ($25,000) in value, and the interest is fully tax-deductible. Your wealth grows despite owing half a million dollars.

## What is bad debt?

Bad debt is borrowing for things that lose value or generate no income:

- Car loans (the car depreciates the moment you drive it out)
- Credit card debt (high interest, no asset)
- Personal loans for holidays or consumer goods

The interest isn't tax-deductible, the asset loses value, and the repayments come entirely from your salary.

## The crossover trap

Many investors accidentally turn good debt into bad debt by:

- Drawing equity from an investment loan to pay personal expenses (mixing loan purposes)
- Not maintaining proper loan structure (separate investment and personal loans)
- Refinancing in ways that muddy the tax-deductible purpose

## The takeaway

Keep your investment debt separate from personal debt. Every dollar of good debt should be clearly traceable to an income-producing asset. Your accountant will thank you at tax time — and so will your portfolio's growth.
```

**Step 5: Run the sync script to load articles into the database**

Run: `npx tsx scripts/sync-blog.ts`
Expected: Output showing 4 posts synced successfully.

**Step 6: Commit**

```bash
git add content/blog/ scripts/sync-blog.ts
git commit -m "feat(blog): add 4 initial blog articles and sync to database"
```

---

## Task 4: tRPC Blog Router

**Files:**
- Create: `src/server/routers/blog.ts`
- Modify: `src/server/routers/_app.ts` (register the router)

**Step 1: Create the blog router**

Create `src/server/routers/blog.ts`:

```typescript
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { blogPosts } from "../db/schema";
import { eq, desc, lte, and, sql } from "drizzle-orm";

export const blogRouter = router({
  // List published posts with optional category/tag filtering
  list: publicProcedure
    .input(
      z.object({
        category: z
          .enum(["fundamentals", "strategy", "finance", "tax", "advanced"])
          .optional(),
        tag: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().optional(), // post id for cursor-based pagination
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date().toISOString().split("T")[0];
      const conditions = [lte(blogPosts.publishedAt, now)];

      if (input.category) {
        conditions.push(eq(blogPosts.category, input.category));
      }

      if (input.tag) {
        conditions.push(sql`${input.tag} = ANY(${blogPosts.tags})`);
      }

      const posts = await ctx.db
        .select({
          id: blogPosts.id,
          slug: blogPosts.slug,
          title: blogPosts.title,
          summary: blogPosts.summary,
          category: blogPosts.category,
          tags: blogPosts.tags,
          author: blogPosts.author,
          publishedAt: blogPosts.publishedAt,
        })
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(input.limit + 1);

      let nextCursor: number | undefined;
      if (posts.length > input.limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem?.id;
      }

      return { posts, nextCursor };
    }),

  // Get single post by slug (only if published)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date().toISOString().split("T")[0];
      const [post] = await ctx.db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, input.slug), lte(blogPosts.publishedAt, now)));

      return post ?? null;
    }),

  // Get categories with post counts
  categories: publicProcedure.query(async ({ ctx }) => {
    const now = new Date().toISOString().split("T")[0];
    const result = await ctx.db
      .select({
        category: blogPosts.category,
        count: sql<number>`count(*)::int`,
      })
      .from(blogPosts)
      .where(lte(blogPosts.publishedAt, now))
      .groupBy(blogPosts.category);

    return result;
  }),

  // Get all tags with post counts
  tags: publicProcedure.query(async ({ ctx }) => {
    const now = new Date().toISOString().split("T")[0];
    const result = await ctx.db
      .select({
        tag: sql<string>`unnest(${blogPosts.tags})`,
        count: sql<number>`count(*)::int`,
      })
      .from(blogPosts)
      .where(lte(blogPosts.publishedAt, now))
      .groupBy(sql`unnest(${blogPosts.tags})`);

    return result;
  }),
});
```

**Step 2: Register the blog router in the app router**

In `src/server/routers/_app.ts`, add the import:

```typescript
import { blogRouter } from "./blog";
```

And add to the `appRouter` object:

```typescript
blog: blogRouter,
```

Add it after the `changelog: changelogRouter` line.

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/server/routers/blog.ts src/server/routers/_app.ts
git commit -m "feat(blog): add tRPC blog router with list, getBySlug, categories, tags"
```

---

## Task 5: Blog Layout

**Files:**
- Create: `src/app/blog/layout.tsx`
- Reference: `src/app/changelog/layout.tsx` (same pattern)

**Step 1: Create the blog layout**

Create `src/app/blog/layout.tsx`:

```tsx
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Blog - PropertyTracker",
  description:
    "Property investment insights for Australian investors. Learn about LVR, gearing, rental yields, and portfolio strategy.",
};

export default function BlogLayout({
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
              <Link href="/blog">Blog</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/changelog">Changelog</Link>
            </Button>
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
            <Link href="/blog" className="hover:text-foreground">
              Blog
            </Link>
            <Link href="/changelog" className="hover:text-foreground">
              Changelog
            </Link>
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

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/blog/layout.tsx
git commit -m "feat(blog): add blog layout with header and footer"
```

---

## Task 6: Blog Listing Page

**Files:**
- Create: `src/app/blog/page.tsx`

**Step 1: Create the blog listing page**

Create `src/app/blog/page.tsx`:

```tsx
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { desc, lte, eq } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

const categoryStyles: Record<string, string> = {
  fundamentals:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  strategy:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  finance:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  tax: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const categoryLabels: Record<string, string> = {
  fundamentals: "Fundamentals",
  strategy: "Strategy",
  finance: "Finance",
  tax: "Tax",
  advanced: "Advanced",
};

function estimateReadingTime(content: string): string {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

async function getPosts(
  category?: "fundamentals" | "strategy" | "finance" | "tax" | "advanced"
) {
  const now = new Date().toISOString().split("T")[0];
  const conditions = category
    ? [lte(blogPosts.publishedAt, now), eq(blogPosts.category, category)]
    : [lte(blogPosts.publishedAt, now)];

  return db
    .select()
    .from(blogPosts)
    .where(conditions.length === 1 ? conditions[0] : undefined)
    .where(conditions.length > 1 ? eq(blogPosts.category, category!) : undefined)
    .orderBy(desc(blogPosts.publishedAt));
}

export default async function BlogPage() {
  const now = new Date().toISOString().split("T")[0];

  // Fetch all published posts
  const allPosts = await db
    .select()
    .from(blogPosts)
    .where(lte(blogPosts.publishedAt, now))
    .orderBy(desc(blogPosts.publishedAt));

  const fundamentalsPosts = allPosts.filter(
    (p) => p.category === "fundamentals"
  );
  const strategyPosts = allPosts.filter((p) => p.category === "strategy");
  const financePosts = allPosts.filter((p) => p.category === "finance");
  const taxPosts = allPosts.filter((p) => p.category === "tax");
  const advancedPosts = allPosts.filter((p) => p.category === "advanced");

  const renderPosts = (
    posts: typeof allPosts,
    emptyMessage: string
  ) => {
    if (posts.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="block rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className={categoryStyles[post.category]}
              >
                {categoryLabels[post.category]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {format(new Date(post.publishedAt), "MMM d, yyyy")}
              </span>
              <span className="text-sm text-muted-foreground">
                &middot; {estimateReadingTime(post.content)}
              </span>
            </div>
            <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
            <p className="text-sm text-muted-foreground">{post.summary}</p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground">
            Property investment insights for Australian investors
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {renderPosts(allPosts, "No blog posts yet. Check back soon!")}
          </TabsContent>

          <TabsContent value="fundamentals">
            {renderPosts(fundamentalsPosts, "No fundamentals posts yet.")}
          </TabsContent>

          <TabsContent value="strategy">
            {renderPosts(strategyPosts, "No strategy posts yet.")}
          </TabsContent>

          <TabsContent value="finance">
            {renderPosts(financePosts, "No finance posts yet.")}
          </TabsContent>

          <TabsContent value="tax">
            {renderPosts(taxPosts, "No tax posts yet.")}
          </TabsContent>

          <TabsContent value="advanced">
            {renderPosts(advancedPosts, "No advanced posts yet.")}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/blog/page.tsx
git commit -m "feat(blog): add blog listing page with category tabs"
```

---

## Task 7: Blog Article Page

**Files:**
- Create: `src/app/blog/[slug]/page.tsx`

**Step 1: Create the article detail page**

Create `src/app/blog/[slug]/page.tsx`:

```tsx
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { eq, and, lte, desc, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const categoryStyles: Record<string, string> = {
  fundamentals:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  strategy:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  finance:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  tax: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const categoryLabels: Record<string, string> = {
  fundamentals: "Fundamentals",
  strategy: "Strategy",
  finance: "Finance",
  tax: "Tax",
  advanced: "Advanced",
};

function estimateReadingTime(content: string): string {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const now = new Date().toISOString().split("T")[0];
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), lte(blogPosts.publishedAt, now)));

  if (!post) {
    return { title: "Not Found - PropertyTracker" };
  }

  const url = `${BASE_URL}/blog/${post.slug}`;

  return {
    title: `${post.title} - Blog - PropertyTracker`,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      url,
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: "summary",
      title: post.title,
      description: post.summary,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date().toISOString().split("T")[0];

  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), lte(blogPosts.publishedAt, now)));

  if (!post) {
    notFound();
  }

  // Get related articles (same category, max 3, excluding current)
  const relatedPosts = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      summary: blogPosts.summary,
      category: blogPosts.category,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.category, post.category),
        ne(blogPosts.slug, post.slug),
        lte(blogPosts.publishedAt, now)
      )
    )
    .orderBy(desc(blogPosts.publishedAt))
    .limit(3);

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "PropertyTracker",
      url: BASE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${post.slug}`,
    },
  };

  return (
    <main className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" asChild className="mb-8">
          <Link href="/blog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Link>
        </Button>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <article>
          <div className="flex items-center gap-2 mb-4">
            <Badge
              variant="secondary"
              className={categoryStyles[post.category]}
            >
              {categoryLabels[post.category]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(post.publishedAt), "MMMM d, yyyy")}
            </span>
            <span className="text-sm text-muted-foreground">
              &middot; {estimateReadingTime(post.content)}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
          <p className="text-lg text-muted-foreground mb-8">{post.summary}</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {post.content.split("\n\n").map((paragraph, i) => {
              // Headings
              if (paragraph.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-xl font-semibold mt-8 mb-4">
                    {paragraph.slice(3)}
                  </h2>
                );
              }
              // Lists
              if (paragraph.startsWith("- ")) {
                const items = paragraph
                  .split("\n")
                  .filter((line) => line.startsWith("- "));
                return (
                  <ul key={i}>
                    {items.map((item, j) => (
                      <li
                        key={j}
                        dangerouslySetInnerHTML={{
                          __html: formatMarkdown(item.slice(2)),
                        }}
                      />
                    ))}
                  </ul>
                );
              }
              // Regular paragraphs
              return (
                <p
                  key={i}
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(paragraph),
                  }}
                />
              );
            })}
          </div>
        </article>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-6">Related articles</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="block rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`${categoryStyles[related.category]} mb-2`}
                  >
                    {categoryLabels[related.category]}
                  </Badge>
                  <h3 className="font-semibold mb-1">{related.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {related.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-16 rounded-xl bg-primary text-primary-foreground p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">
            Track your property portfolio
          </h2>
          <p className="mb-6 opacity-90">
            Automated bank feeds, tax reports, and portfolio analytics for
            Australian investors.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sign-up">
              Start Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/blog/[slug]/page.tsx
git commit -m "feat(blog): add article page with SEO metadata, JSON-LD, and related posts"
```

---

## Task 8: SEO Infrastructure — Sitemap and robots.txt

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`

**Step 1: Create the sitemap**

Create `src/app/sitemap.ts`:

```typescript
import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { lte, desc } from "drizzle-orm";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString().split("T")[0];

  // Fetch published blog posts
  const posts = await db
    .select({
      slug: blogPosts.slug,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(lte(blogPosts.publishedAt, now))
    .orderBy(desc(blogPosts.publishedAt));

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sign-in`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Blog post pages
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}
```

**Step 2: Create robots.txt**

Create `src/app/robots.ts`:

```typescript
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/*", "/changelog", "/changelog/*", "/sign-up", "/sign-in"],
        disallow: [
          "/dashboard",
          "/dashboard/*",
          "/properties",
          "/properties/*",
          "/transactions",
          "/transactions/*",
          "/settings",
          "/settings/*",
          "/api",
          "/api/*",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts
git commit -m "feat(seo): add sitemap.xml and robots.txt generation"
```

---

## Task 9: Navigation Integration — Landing Page and Middleware

**Files:**
- Modify: `src/app/page.tsx` (add Blog link to header and footer)
- Modify: `src/middleware.ts` (add `/blog` to public routes)
- Modify: `src/app/changelog/layout.tsx` (add Blog cross-link)

**Step 1: Update the landing page header to add Blog link**

In `src/app/page.tsx`, find the header's `<div className="flex items-center gap-4">` and add a Blog link before Sign In:

```tsx
<div className="flex items-center gap-4">
  <Button variant="ghost" asChild>
    <Link href="/blog">Blog</Link>
  </Button>
  <Button variant="ghost" asChild>
    <Link href="/sign-in">Sign In</Link>
  </Button>
  <Button asChild>
    <Link href="/sign-up">Get Started</Link>
  </Button>
</div>
```

**Step 2: Update the landing page footer to add Blog link**

In `src/app/page.tsx`, find the footer's links div and add Blog before Changelog:

```tsx
<div className="flex items-center gap-6 text-sm text-muted-foreground">
  <Link href="/blog" className="hover:text-foreground">
    Blog
  </Link>
  <Link href="/changelog" className="hover:text-foreground">
    Changelog
  </Link>
  <Link href="/privacy" className="hover:text-foreground">
    Privacy Policy
  </Link>
  <Link href="/terms" className="hover:text-foreground">
    Terms of Service
  </Link>
</div>
```

**Step 3: Update middleware to add `/blog` as a public route**

In `src/middleware.ts`, update the `isPublicRoute` matcher:

```typescript
const isPublicRoute = createRouteMatcher([
  "/",
  "/blog(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/trpc/mobileAuth(.*)",
]);
```

**Step 4: Update changelog layout to add Blog cross-link**

In `src/app/changelog/layout.tsx`, update the header nav to include Blog:

```tsx
<div className="flex items-center gap-4">
  <Button variant="ghost" asChild>
    <Link href="/blog">Blog</Link>
  </Button>
  <Button variant="ghost" asChild>
    <Link href="/sign-in">Sign In</Link>
  </Button>
  <Button asChild>
    <Link href="/sign-up">Get Started</Link>
  </Button>
</div>
```

And update the changelog footer to include Blog:

```tsx
<div className="flex items-center gap-6 text-sm text-muted-foreground">
  <Link href="/blog" className="hover:text-foreground">
    Blog
  </Link>
  <Link href="/privacy" className="hover:text-foreground">
    Privacy Policy
  </Link>
  <Link href="/terms" className="hover:text-foreground">
    Terms of Service
  </Link>
</div>
```

**Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add src/app/page.tsx src/middleware.ts src/app/changelog/layout.tsx
git commit -m "feat(blog): add blog navigation links to landing page, changelog, and middleware"
```

---

## Task 10: E2E Tests

**Files:**
- Create: `e2e/blog.spec.ts`
- Modify: `e2e/landing.spec.ts` (add blog link assertion)

**Step 1: Create E2E tests for the blog**

Create `e2e/blog.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Blog", () => {
  test("public blog page loads and shows heading", async ({ page }) => {
    await page.goto("/blog");

    await expect(page.locator("h1")).toContainText("Blog");
    await expect(
      page.getByText(/property investment insights/i)
    ).toBeVisible();
  });

  test("blog page shows category tabs", async ({ page }) => {
    await page.goto("/blog");

    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Fundamentals" })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Strategy" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Finance" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tax" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Advanced" })).toBeVisible();
  });

  test("category tab filtering works", async ({ page }) => {
    await page.goto("/blog");

    await page.getByRole("tab", { name: "Fundamentals" }).click();
    await expect(
      page.getByRole("tab", { name: "Fundamentals" })
    ).toHaveAttribute("data-state", "active");
  });

  test("blog article detail page loads", async ({ page }) => {
    await page.goto("/blog");

    const article = page.locator("a[href^='/blog/']").first();
    if (await article.isVisible()) {
      await article.click();

      await expect(
        page.getByRole("link", { name: /Back to Blog/i })
      ).toBeVisible();
    }
  });

  test("blog article shows CTA banner", async ({ page }) => {
    await page.goto("/blog");

    const article = page.locator("a[href^='/blog/']").first();
    if (await article.isVisible()) {
      await article.click();

      await expect(
        page.getByText(/track your property portfolio/i)
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /start free/i })
      ).toBeVisible();
    }
  });

  test("blog header has navigation links", async ({ page }) => {
    await page.goto("/blog");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(
      header.getByRole("link", { name: /get started/i })
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: /changelog/i })
    ).toBeVisible();
  });
});
```

**Step 2: Update landing page E2E test to check for blog link**

In `e2e/landing.spec.ts`, update the footer links test to include blog:

Find the test `"should display footer with links"` and add:

```typescript
await expect(page.getByRole("link", { name: /blog/i }).first()).toBeVisible();
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add e2e/blog.spec.ts e2e/landing.spec.ts
git commit -m "test(blog): add E2E tests for blog pages and landing page blog link"
```

---

## Task 11: JSON-LD on Blog Listing Page

**Files:**
- Modify: `src/app/blog/page.tsx` (add Blog JSON-LD structured data)

**Step 1: Add JSON-LD to the listing page**

In `src/app/blog/page.tsx`, add the BASE_URL constant at the top (after imports):

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com.au";
```

Then inside the returned JSX, before the `<div className="text-center mb-12">`, add:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "PropertyTracker Blog",
      description:
        "Property investment insights for Australian investors",
      url: `${BASE_URL}/blog`,
      publisher: {
        "@type": "Organization",
        name: "PropertyTracker",
        url: BASE_URL,
      },
    }),
  }}
/>
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/blog/page.tsx
git commit -m "feat(seo): add Blog JSON-LD structured data to listing page"
```

---

## Task 12: Final Verification

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run the blog sync script**

Run: `npx tsx scripts/sync-blog.ts`
Expected: 4 posts synced successfully.

**Step 3: Start dev server and manually verify**

Run: `npm run dev`

Verify these pages load:
- `http://localhost:3000/blog` — listing with 4 articles, category tabs
- `http://localhost:3000/blog/what-is-lvr` — article with back button, related posts, CTA
- `http://localhost:3000/blog/gearing-explained` — article loads
- `http://localhost:3000/blog/calculate-rental-yield` — article loads
- `http://localhost:3000/blog/good-vs-bad-debt` — article loads
- `http://localhost:3000/sitemap.xml` — contains blog posts
- `http://localhost:3000/robots.txt` — disallows dashboard routes
- `http://localhost:3000/` — Blog link in header and footer

**Step 4: Run E2E tests**

Run: `npx playwright test e2e/blog.spec.ts e2e/landing.spec.ts`
Expected: All tests pass.

**Step 5: Final commit if any fixes needed, then push**

```bash
git push origin feature/blog-seo
```
