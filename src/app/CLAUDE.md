# App Directory Patterns

> Loaded when working in `src/app/`. For UI components see `src/components/CLAUDE.md`. For server patterns see `src/server/CLAUDE.md`.

## Page Template (3-State Pattern)

Every dashboard page follows loading → data → empty:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { PropertyListSkeleton } from "@/components/skeletons";

export default function MyPage() {
  const { data: items, isLoading } = trpc.myRouter.list.useQuery();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Page Title</h2>
          <p className="text-muted-foreground">Description text</p>
        </div>
        <Button asChild>
          <Link href="/my-route/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Link>
        </Button>
      </div>

      {/* 3-state render */}
      {isLoading ? (
        <PropertyListSkeleton count={3} />
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={item.id} className="animate-card-entrance" style={{ '--stagger-index': i } as React.CSSProperties}>
              <ItemCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No items yet</h3>
          <p className="text-muted-foreground max-w-sm mt-2">Description of what to do</p>
          <Button asChild className="mt-4">
            <Link href="/my-route/new">Add your first item</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

### Server Component Pages (rare — only `/dashboard`)

Fetch with `getServerTRPC()`, pass as `initialData`:

```tsx
// page.tsx (server component, NO "use client")
import { getServerTRPC } from "@/lib/trpc/server";
import { MyClient } from "./MyClient";

export default async function MyPage() {
  const trpc = await getServerTRPC();
  const data = await trpc.myRouter.getData().catch(() => null);
  return <MyClient initialData={data} />;
}
```

### Suspense Boundary Pages (report pages)

```tsx
import { Suspense } from "react";
export const dynamic = "force-dynamic";

export default function MyPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-lg" />}>
      <MyContent />
    </Suspense>
  );
}
```

## Middleware (`src/middleware.ts`)

```tsx
import { getSessionCookie } from "better-auth/cookies";

const publicRoutes = ["/", "/blog", "/sign-in", "/sign-up"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));
  if (isPublic) return NextResponse.next();

  const session = await getSessionCookie();
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}
```

All non-public routes require auth via middleware. tRPC `protectedProcedure` resolves user + portfolio context.

## Navigation

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Collapsible (16px vs 256px), `Cmd+\` shortcut
- State persisted in localStorage (`sidebar-collapsed`, `sidebar-sections`)
- Grouped sections: Properties & Banking, Reports & Tax, Communication
- Active link: `border-l-2 border-primary bg-primary/5 text-primary font-semibold`
- Prefetch on hover
- Feature-flag gating: items with `featureFlag` prop hidden when flag is false

### Header (`src/components/layout/Header.tsx`)
Auto-generates breadcrumbs from pathname. Right side: HelpButton, FeedbackButton, AlertBadge, WhatsNewButton, QuickAddButton, UserButton.

### Breadcrumbs
```tsx
<Breadcrumb items={[{ label: "Properties", href: "/properties" }, { label: "Details" }]} />
```

### Feature Flags (`src/config/feature-flags.ts`)
Simple boolean object. Used in sidebar (hide nav items), middleware (redirect gated routes), components (conditional render).

## Context Providers

**Provider tree (outermost → innermost):**
1. `ClerkProvider` — auth
2. `TRPCProvider` — tRPC + React Query (staleTime 30s, gcTime 5min)
3. `PostHogProvider` — DISABLED (no-op wrapper)
4. `ChatProvider` — chat panel open/close (`useChatPanel()`)
5. `SidebarProvider` — sidebar collapsed/expanded + Cmd+\ (`useSidebar()`)

| Hook | Import | Purpose |
|------|--------|---------|
| `useSidebar()` | `@/components/layout/SidebarProvider` | Sidebar collapsed state |
| `useChatPanel()` | `@/components/chat/ChatProvider` | Chat panel open/close |
| `useTour({ tourId })` | `@/hooks/useTour` | driver.js guided tours |
| `usePushSubscription()` | `@/hooks/usePushSubscription` | Web Push subscription |
| `useReferralTracking()` | `@/hooks/useReferralTracking` | Referral cookie tracking |
| `useSidebarState()` | `@/lib/hooks/useSidebarState` | localStorage sidebar state |

## Onboarding Tours

```tsx
import { useTour } from "@/hooks/useTour";
export default function MyPage() {
  useTour({ tourId: "my-feature" });
}
```

Target elements with `data-tour` attributes. Tour configs in `src/config/tours/`. Existing tours: dashboard, add-property, banking, transactions, portfolio.

## Responsive Grid Patterns

```
grid-cols-1 md:grid-cols-2 lg:grid-cols-3  → Properties, portfolio cards
grid-cols-1 md:grid-cols-2 lg:grid-cols-4  → Dashboard stats, compliance
grid-cols-1 md:grid-cols-3                  → Reports hub
grid-cols-1 md:grid-cols-2                  → Loans, tax
grid-cols-1 lg:grid-cols-2                  → Property detail, secondary widgets
```

All grids use `gap-4` or `gap-6`. Always mobile-first single-column.
