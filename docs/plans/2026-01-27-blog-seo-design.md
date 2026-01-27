# Blog & SEO Design

**Date:** 2026-01-27
**Status:** Final
**Phase:** V0.3 Phase 4

## Overview

Add a public blog at `/blog` for SEO lead generation and educational content. Short-form articles (~250-300 words, 1-minute reads) published 1 per week on a scheduled cadence. 4 articles pre-loaded at launch. SEO infrastructure (sitemap, robots.txt, structured data, Open Graph) ships with the blog from day one.

---

## Content Architecture

Blog posts live as markdown files in `/content/blog/` following the changelog pattern. Each file is named `YYYY-MM-DD-slug.md` with YAML frontmatter:

```yaml
title: "Understanding LVR, Equity and LMI"
summary: "What every Australian property investor needs to know about loan-to-value ratios, usable equity, and when LMI makes sense."
category: "fundamentals"
publishedAt: 2026-02-03
tags: ["finance", "lvr", "equity", "lmi"]
author: "PropertyTracker"
```

**Categories** (mapped to source material modules):
- `fundamentals` — Debt, equity, yields, buffers (Module 0)
- `strategy` — Trident formula, portfolio building (Modules 1-2)
- `finance` — Broker, lending, serviceability (Module 3)
- `tax` — Structuring, trusts, SMSF, CGT (Modules 4-5)
- `advanced` — Market prediction, income boosting, renovations (Modules 6-9)

**Sync script** (`scripts/sync-blog.ts`) reads files, parses frontmatter with `gray-matter`, validates with Zod, upserts to DB, deletes removed entries. Same pattern as `scripts/sync-changelog.ts`.

**Scheduled publishing:** Posts with `publishedAt` in the future are synced to the DB but filtered out of public queries. Write articles in batches, set future dates, they auto-appear.

---

## Database Schema

One new table, one new enum:

```sql
CREATE TYPE blog_category AS ENUM ('fundamentals', 'strategy', 'finance', 'tax', 'advanced');

CREATE TABLE blog_posts (
  id SERIAL PRIMARY KEY,
  slug VARCHAR NOT NULL UNIQUE,
  title VARCHAR NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category blog_category NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  author VARCHAR NOT NULL,
  published_at DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

No user tracking table — unlike the changelog, no unread badge is needed.

---

## tRPC Router

New router: `src/server/routers/blog.ts`

| Procedure | Auth | Description |
|-----------|------|-------------|
| `list` | Public | Paginated posts, filterable by category and tag. Only `publishedAt <= now()`. Cursor-based, ordered by `publishedAt` desc. |
| `getBySlug` | Public | Single post by slug. Returns 404 if `publishedAt` is in the future. |
| `categories` | Public | Returns categories with post counts. |
| `tags` | Public | Returns all tags with post counts. |

---

## Routes & Pages

### `/blog` — Listing page
`src/app/blog/page.tsx` (public, async server component)

- Heading and brief intro text
- Category filter tabs: All, Fundamentals, Strategy, Finance, Tax, Advanced
- Grid of article cards: title, summary, category badge, date, reading time
- Pagination at bottom

### `/blog/[slug]` — Article page
`src/app/blog/[slug]/page.tsx` (public, async server component)

- `generateMetadata` for SEO: title, description, Open Graph, canonical URL
- Article header: title, category badge, date, reading time, author
- Markdown content rendered with regex-based formatter (same as changelog)
- Related articles section at bottom (same category, max 3)
- CTA banner: "Track your property portfolio — Start free" linking to `/sign-up`

### `/blog/layout.tsx` — Shared layout
- Same structure as changelog layout: header with PropertyTracker branding + nav, footer with links
- "Back to blog" link on article pages

No admin UI — content managed via markdown files in the repo. No comments system.

---

## SEO Infrastructure

### Sitemap (`src/app/sitemap.ts`)
- Next.js built-in sitemap generation
- Includes all published blog posts with `lastModified` dates
- Includes static pages: `/`, `/blog`, `/changelog`, `/sign-up`, `/sign-in`
- Queries DB for posts where `publishedAt <= now()`

### robots.txt (`src/app/robots.ts`)
- Allow all crawlers on public pages
- Disallow authenticated routes (`/dashboard`, `/properties`, `/transactions`, etc.)
- Reference sitemap URL

### Schema.org structured data
- `BlogPosting` JSON-LD on each article page: headline, description, datePublished, author, publisher
- `Blog` JSON-LD on the listing page
- Embedded via `<script type="application/ld+json">`

### Open Graph / Twitter meta (per article)
- `og:title`, `og:description`, `og:type` (article), `og:url`
- `og:image` — static default PropertyTracker branded image
- `twitter:card` (summary)
- Canonical URL pointing to `/blog/[slug]`

---

## Navigation Integration

- **Landing page header:** Add "Blog" link between "Sign In" and "Get Started"
- **Landing page footer:** Add "Blog" link alongside Changelog, Privacy Policy, Terms of Service
- **Blog/changelog layouts:** Cross-link between blog and changelog in headers
- **In-app sidebar:** No blog link — blog is a public marketing asset, not an in-app feature

---

## Initial 4 Articles

All ~250-300 words, single focused concept, Australian-specific examples.

| # | Title | Category | Source |
|---|-------|----------|--------|
| 1 | What Is LVR and Why Does It Matter? | fundamentals | Module 0 — Equity and LVR Explained |
| 2 | Positive vs Negative Gearing Explained | fundamentals | Module 0 — Positive Gearing vs Negative Gearing |
| 3 | How to Calculate Rental Yield | strategy | Module 0 — How to Calculate Rental Yield |
| 4 | Good Debt vs Bad Debt for Property Investors | fundamentals | Module 0 — Good Debt vs Bad Debt |

**Publishing schedule:** All 4 published on launch day. Subsequent articles: 1 per week with future `publishedAt` dates.

---

## Files Summary

**New files:**
- `src/server/routers/blog.ts` — tRPC router
- `src/app/blog/page.tsx` — Listing page
- `src/app/blog/[slug]/page.tsx` — Article page
- `src/app/blog/layout.tsx` — Shared layout
- `src/app/sitemap.ts` — Sitemap generation
- `src/app/robots.ts` — robots.txt generation
- `scripts/sync-blog.ts` — Content sync script
- `content/blog/*.md` — 4 initial articles

**Modified files:**
- `src/server/db/schema.ts` — Add `blog_posts` table + enum
- `src/server/routers/index.ts` — Register blog router
- `src/app/page.tsx` — Add Blog link to header + footer

**Database migration:** 1 new table, 1 new enum
