# Dynamic OG Images Design

**Date:** 2026-01-28
**Status:** Ready for implementation
**Scope:** Dynamic OG images for portfolio share pages, blog twitter card upgrade

## Goal

Generate dynamic Open Graph images for portfolio share links (`/share/[token]`) so they render rich previews on social media, messaging apps, and link previews. Upgrade blog post twitter cards to `summary_large_image`.

## Architecture

### New Route: `src/app/api/og/share/[token]/route.tsx`

Edge runtime API route using Next.js `ImageResponse` (from `next/og`). No extra dependency needed — built into Next.js 16+.

- Fetches portfolio snapshot by share token from database
- Validates token: exists, not expired, active
- Returns 1200x630 `ImageResponse` with portfolio data rendered as JSX
- If token invalid/expired/error: redirects to static `/og-image.svg` fallback
- Cache: `Cache-Control: public, max-age=3600` (1 hour — snapshots are point-in-time)

### Modified: `src/app/share/[token]/page.tsx`

Add `generateMetadata()` function:
- Sets `openGraph.images` to `/api/og/share/${token}`
- Sets `twitter.card` to `summary_large_image`
- Title: "Portfolio — PropertyTracker" (no private data in HTML title)
- If share not found/expired: generic PropertyTracker metadata

### Modified: `src/app/blog/[slug]/page.tsx`

- Upgrade twitter card from `summary` to `summary_large_image`

## Image Layout

1200x630px with blue-to-purple gradient background (#1e40af → #7c3aed), matching existing `public/og-image.svg`.

```
┌──────────────────────────────────────────────┐
│  [gradient background: #1e40af → #7c3aed]    │
│                                              │
│  PropertyTracker              Portfolio Share │
│                                              │
│         $2,450,000                           │
│         Portfolio Value                      │
│                                              │
│    3 Properties    +12.4% Growth             │
│                                              │
│    Richmond · Fitzroy · Brunswick            │
│                                              │
│  propertytracker.com.au                      │
└──────────────────────────────────────────────┘
```

System font stack (no custom font loading).

## Privacy Modes

Respects the share's existing privacy setting:

| Mode | Value | Count | Growth | Suburbs |
|------|-------|-------|--------|---------|
| full | Yes | Yes | Yes | Yes |
| summary | Yes | Yes | Yes | No |
| redacted | No | Yes | No | No |

Redacted mode shows "Portfolio Overview" heading instead of dollar value.

## Data Flow

1. Request hits `/api/og/share/[token]`
2. Query `portfolio_shares` table by token
3. Validate: exists, not expired, view limit not exceeded
4. Read snapshot data (already stored as JSON in share record)
5. Render `ImageResponse` with stats from snapshot
6. Return with 1-hour cache header

No new database tables or columns needed.

## Error Handling

All error paths return a usable image — social crawlers always get something:
- Invalid token → 302 redirect to `/og-image.svg`
- Expired share → 302 redirect to `/og-image.svg`
- DB error → 302 redirect to `/og-image.svg`

## Testing

- Unit test OG route with mocked DB
- Verify correct content-type (`image/png`)
- Verify expired token returns redirect
- Verify privacy modes show/hide correct fields
