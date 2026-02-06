# MVP Feature Flags & Blog Fixes Design

## Date: 2026-02-06

## Goals

1. Feature-flag non-MVP features to ship a clean, focused product to first customers
2. Fix blog article markdown rendering (tables, numbered lists broken)
3. Fix scrollbar bug on blog category tabs

---

## 1. Feature Flag System

### Config file: `src/config/feature-flags.ts`

Simple boolean map. No external service, no database, no runtime toggling.

```typescript
export const featureFlags = {
  // Main nav
  discover: false,
  alerts: false,
  portfolio: false,
  forecast: false,
  portfolioShares: false,
  compliance: false,
  brokerPortal: false,
  mytaxExport: false,
  loans: false,
  compareLoans: false,
  export: false,
  emails: false,
  tasks: false,
  // Settings
  refinanceAlerts: false,
  emailConnections: false,
  mobileApp: false,
  team: false,
  auditLog: false,
  supportAdmin: false,
  // Other UI
  aiAssistant: false,
  whatsNew: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;
```

### MVP sidebar (items with no flag = always shown):

- Dashboard
- Properties
- Transactions
- Review
- Banking
- Reports
- Tax Position

### Settings kept visible:

- Notifications
- Support
- Bug Reports
- Feature Requests

### Sidebar integration

Each nav item gets an optional `featureFlag` property. Filter before rendering:

```typescript
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass, featureFlag: "discover" as FeatureFlag },
  // ...
];

const visibleNavItems = navItems.filter(
  (item) => !item.featureFlag || featureFlags[item.featureFlag]
);
```

### Route gating (server-side)

In `src/app/(dashboard)/layout.tsx`, check the current path against feature flags. If a flagged-off route is accessed directly, redirect to `/dashboard`.

Map of route prefixes to flags:

```typescript
const routeToFlag: Record<string, FeatureFlag> = {
  "/discover": "discover",
  "/alerts": "alerts",
  "/portfolio": "portfolio",
  "/reports/forecast": "forecast",
  "/reports/share": "portfolioShares",
  "/reports/compliance": "compliance",
  "/reports/brokers": "brokerPortal",
  "/reports/mytax": "mytaxExport",
  "/loans": "loans",
  "/export": "export",
  "/emails": "emails",
  "/tasks": "tasks",
  "/settings/refinance-alerts": "refinanceAlerts",
  "/settings/email-connections": "emailConnections",
  "/settings/mobile": "mobileApp",
  "/settings/team": "team",
  "/settings/audit-log": "auditLog",
  "/settings/support-admin": "supportAdmin",
};
```

Security: Flags are server-side only. No client-side state to tamper with. Routes redirect server-side.

---

## 2. Blog Markdown Rendering Fix

### Problem

Hand-rolled parser in `blog/[slug]/page.tsx` only handles `##`, `- ` lists, and inline formatting. Tables render as raw `| pipe | text |`. Numbered lists render as flat paragraphs.

### Solution

Replace the custom parser (lines 183-219) with `react-markdown` + `remark-gfm`.

Dependencies: `react-markdown`, `remark-gfm`

The existing `prose prose-neutral dark:prose-invert max-w-none` classes on the wrapper div already handle all typography styling via Tailwind Typography plugin.

### Before (broken):

```tsx
{post.content.split("\n\n").map((paragraph, i) => {
  if (paragraph.startsWith("## ")) { ... }
  if (paragraph.startsWith("- ")) { ... }
  return <p dangerouslySetInnerHTML={{...}} />;
})}
```

### After (fixed):

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {post.content}
</ReactMarkdown>
```

---

## 3. Blog Tab Scrollbar Fix

### Problem

`TabsList` has `className="flex w-full overflow-x-auto mb-8"` on the blog page. The component's default `w-fit` from shadcn fights with `w-full`, and `overflow-x-auto` creates a phantom scrollbar.

### Solution

Remove `overflow-x-auto` since the 6 tabs fit within `max-w-4xl`. Keep `w-full` and `mb-8` to properly space tabs across the container.

---

## Files to modify

1. `src/config/feature-flags.ts` (new)
2. `src/components/layout/Sidebar.tsx` (add featureFlag to items, filter)
3. `src/app/(dashboard)/layout.tsx` (add route gating)
4. `src/app/blog/[slug]/page.tsx` (replace markdown renderer)
5. `src/app/blog/page.tsx` (fix tab scrollbar)
6. `package.json` (add react-markdown, remark-gfm)
