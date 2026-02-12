# Theme Selector for Settings Page — Design

**Date:** 2026-02-08
**Task:** property-tracker-j1i
**Status:** Design approved

## Overview

Add a theme picker to the Settings page that lets users switch between 6 colour themes. Theme choice persists in the database (follows user across devices) with localStorage fallback for unauthenticated pages. Also implements the missing Ocean theme.

## Themes

| Name | Primary | Style |
|------|---------|-------|
| Forest (default) | `#15803d` green | Green accent, white bg |
| Clean | `#0066cc` blue | Professional blue, white bg |
| Dark | `#3b82f6` blue-500 | Dark backgrounds, light text |
| Friendly | `#047857` emerald | Warm green, rounded corners |
| Bold | `#1d4ed8` deep blue | Strong blue, sharp corners |
| **Ocean (new)** | `#0891b2` cyan-600 | Teal/cyan, white bg |

## Acceptance Criteria

1. Users can select a theme from the Settings page
2. Theme applies immediately without page reload
3. Theme persists in DB — same theme on any device after login
4. No FOUC (flash of unstyled content) on page load
5. localStorage fallback for unauthenticated/landing pages
6. **All 6 themes must meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)**
7. Ocean theme implemented with distinct teal/cyan palette

## Database

Add `theme` column to existing `users` table:

```sql
ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT NULL;
```

- `NULL` = forest (default, matches `:root`)
- Valid values: `forest`, `clean`, `dark`, `friendly`, `bold`, `ocean`

Register in BetterAuth `additionalFields` so it's available on the session user object.

## API

**`user.setTheme` mutation** (protectedProcedure — users can always change their own theme):
- Input: `z.enum(["forest", "clean", "dark", "friendly", "bold", "ocean"])`
- Updates `users.theme` where `id = ctx.user.id`
- Returns the updated theme value

**Theme in session**: Add `theme` to BetterAuth `additionalFields` so `getAuthSession()` returns it with the user object. No extra DB query needed.

## Theme Application Flow

### Authenticated pages (SSR)
1. Dashboard layout reads `getAuthSession().user.theme`
2. Passes theme to a `<ThemeProvider>` that sets `data-theme` on `<html>`
3. Correct theme is in the initial HTML — no flash

### Unauthenticated pages (localStorage fallback)
1. Small inline `<script>` in root `layout.tsx` `<head>` reads `localStorage.getItem("bricktrack-theme")`
2. Sets `document.documentElement.dataset.theme` before first paint
3. Prevents FOUC for returning visitors on landing/auth pages

### On theme change (Settings page)
1. Optimistically set `document.documentElement.dataset.theme` immediately
2. Sync to `localStorage.setItem("bricktrack-theme", theme)`
3. Fire `user.setTheme` tRPC mutation in background
4. On error: revert to previous theme, show toast

## Settings Page UI

New "Appearance" section added at the top of the Settings page (before "Account"):

- Section header: "Appearance" (same `uppercase tracking-wide text-muted-foreground` style)
- Grid of 6 swatch cards (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`)
- Each card uses existing `Card` component:
  - Small colour bar at top showing the theme's primary colour
  - Theme name (e.g. "Forest")
  - One-word descriptor (e.g. "Green", "Teal")
  - Checkmark icon on active theme
  - Active card border highlights with that theme's primary colour
- Click = instant apply + background save

## Ocean Theme CSS

```css
[data-theme="ocean"] {
  --color-primary: #0891b2;        /* cyan-600 */
  --color-primary-hover: #0e7490;  /* cyan-700 */
  --color-primary-light: #cffafe;  /* cyan-100 */
  --color-primary-foreground: #ffffff;
  --bg-primary: #ffffff;
  --bg-secondary: #f0fdfa;         /* teal-50 */
  --bg-tertiary: #ccfbf1;          /* teal-100 */
  --bg-card: #ffffff;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #636b75;
  --border-light: #e5e7eb;
  --border-medium: #d1d5db;
  --color-secondary-accent: #0284c7;   /* sky-600 */
  --color-secondary-accent-light: #e0f2fe;
  --color-accent-warm: #d97706;
  --color-accent-warm-light: #fef3c7;
  --color-highlight: #6366f1;          /* indigo-500 */
  --color-highlight-light: #e0e7ff;
}
```

## WCAG Compliance

All themes must pass these checks:
- **Primary on white bg**: 4.5:1 minimum for normal text
- **text-primary on bg-primary**: 4.5:1 minimum
- **text-secondary on bg-primary**: 4.5:1 minimum
- **text-muted on bg-primary**: 3:1 minimum (large text) or 4.5:1 (normal text)
- **primary-foreground on primary**: 4.5:1 minimum (buttons)
- Dark theme: same ratios but inverted (light text on dark bg)

Audit existing themes for compliance and fix any failures.

## Files to Create/Modify

1. `src/server/db/schema.ts` — Add `theme` column to `users` table
2. `src/lib/auth.ts` — Add `theme` to BetterAuth `additionalFields`
3. `src/server/routers/user.ts` — Add `setTheme` mutation (or create if doesn't exist)
4. `src/server/routers/_app.ts` — Register user router if new
5. `src/styles/themes.css` — Add Ocean theme
6. `src/components/theme/ThemeProvider.tsx` — Client component: applies `data-theme` to `<html>`
7. `src/app/layout.tsx` — Add inline script for localStorage fallback + ThemeProvider
8. `src/app/(dashboard)/settings/page.tsx` — Add Appearance section with swatch cards
9. Unit tests for `setTheme` mutation
10. E2E test for theme selection flow
