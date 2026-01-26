# Changelog & What's New Design

## Overview

A public changelog page for SEO and marketing, plus an in-app "What's New" drawer for logged-in users to see recent updates with read-tracking.

## Content Architecture

### Markdown Source Files

Changelog entries live in `/content/changelog/` as individual markdown files:

```
/content/changelog/
  2026-01-27-user-feedback-system.md
  2026-01-20-tax-position-calculator.md
  ...
```

Each file has frontmatter:

```yaml
---
title: "User Feedback System"
summary: "Submit feature requests and bug reports directly from the app"
category: "feature"  # feature | improvement | fix
publishedAt: "2026-01-27"
---

Full markdown content here describing the feature in detail...
```

### Database Schema

```sql
-- Enum for categories
CREATE TYPE changelog_category AS ENUM ('feature', 'improvement', 'fix');

-- Changelog entries (synced from markdown)
CREATE TABLE changelog_entries (
  id            TEXT PRIMARY KEY,  -- slug from filename
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,     -- 1-2 line description
  content       TEXT NOT NULL,     -- full markdown
  category      changelog_category NOT NULL,
  published_at  DATE NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Track when users last viewed changelog
CREATE TABLE user_changelog_views (
  user_id        TEXT PRIMARY KEY,  -- Clerk user ID
  last_viewed_at TIMESTAMP NOT NULL
);
```

### Sync Process

A build script reads markdown files and upserts to the database. Runs during `npm run build` or can be triggered manually. Deleted files get removed from DB.

## Public Changelog Page

**Route**: `/changelog` (outside dashboard layout, accessible without login)

**Layout**:
- Clean marketing-style page with header/footer consistent with landing page
- Hero section: "Changelog" title + brief description
- Filter tabs: All | Features | Improvements | Fixes
- Entry list: Newest first, paginated

**Entry Display**:
- Category badge + date
- Title
- Summary (1-2 lines)
- "Read more" expands full content or navigates to `/changelog/[slug]`

**SEO Considerations**:
- Static generation at build time (after DB sync)
- Individual entry pages at `/changelog/[slug]` for deep linking
- Proper meta tags, Open Graph data

**Logged-in Behavior**:
When a logged-in user visits `/changelog`, the page also updates their `last_viewed_at` timestamp.

## In-App What's New Drawer

### Header Button

Positioned in the header next to AlertBadge:
```
[AlertBadge] [WhatsNewButton] [QuickAddButton] [UserButton]
```

Button shows a sparkles icon with a small red notification dot when there are unread entries.

### Drawer Component

Slide-in drawer from the right side:
- Header: "What's New" with close button
- List of recent entries (5-10) showing:
  - Category badge + date
  - Title
  - Summary
- Footer: "View full changelog" link

### Behavior

- Shows last 5-10 entries
- On open: Updates `last_viewed_at` to current timestamp, dot disappears
- Click entry: Navigates to `/changelog/[slug]`

## tRPC API

**Router**: `src/server/routers/changelog.ts`

### Public Procedures

```typescript
// List entries with optional filtering and pagination
list: publicProcedure
  .input(z.object({
    category: z.enum(['feature', 'improvement', 'fix']).optional(),
    limit: z.number().default(20),
    cursor: z.string().optional()
  }))
  .query(...)

// Get single entry by slug
getBySlug: publicProcedure
  .input(z.object({ slug: z.string() }))
  .query(...)
```

### Protected Procedures

```typescript
// Get count of entries since last viewed
getUnreadCount: protectedProcedure
  .query(...)

// Update last_viewed_at timestamp
markAsViewed: protectedProcedure
  .mutation(...)
```

### Data Flow

1. **Header Button**: Calls `getUnreadCount` with 5-minute refetch interval. Shows dot if count > 0.
2. **Drawer Open**: Fetches entries via `list`, calls `markAsViewed`, invalidates `getUnreadCount`.
3. **Changelog Page**: Calls `list` with filters. If logged in, also calls `markAsViewed`.

## Build & Sync Process

### Sync Script

`scripts/sync-changelog.ts`:
1. Read all `.md` files from `/content/changelog/`
2. Parse frontmatter + content using `gray-matter`
3. Validate against Zod schema
4. Upsert to database
5. Delete entries not in filesystem

### Integration

```json
{
  "scripts": {
    "changelog:sync": "tsx scripts/sync-changelog.ts",
    "build": "npm run changelog:sync && next build"
  }
}
```

### Validation

- Filename must match pattern `YYYY-MM-DD-slug.md`
- Required frontmatter: title, summary, category, publishedAt
- Category must be one of: feature, improvement, fix
- Invalid files logged as warnings, skipped

## File Structure

```
/content/changelog/
  2026-01-27-user-feedback-system.md

/src/server/db/schema.ts                 # Add tables + enum
/drizzle/0017_changelog.sql              # Migration

/src/server/routers/changelog.ts         # tRPC router
/src/server/routers/index.ts             # Register router

/src/components/changelog/
  WhatsNewButton.tsx                     # Header button with dot
  WhatsNewDrawer.tsx                     # Slide-in drawer
  ChangelogEntry.tsx                     # Reusable entry card

/src/app/changelog/
  page.tsx                               # Public changelog page
  [slug]/page.tsx                        # Individual entry page
  layout.tsx                             # Marketing layout

/scripts/sync-changelog.ts               # Markdown → DB sync
```

## Dependencies

- `gray-matter` - Parse markdown frontmatter

## Testing

- Unit test for sync script (mock filesystem)
- E2E test: Visit changelog, verify entries render
- E2E test: Login, check drawer opens, dot clears
