# Collapsible Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible left sidebar that shrinks to icon-only mode (64px), with tooltips and persisted user preference.

**Architecture:** Custom React hook manages collapsed state with localStorage persistence. Sidebar component receives state as prop, conditionally renders labels and wraps icons in tooltips when collapsed.

**Tech Stack:** React 18, Radix Tooltip, localStorage, Tailwind CSS, Lucide icons

---

## Task 1: Install Radix Tooltip

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run:
```bash
npm install @radix-ui/react-tooltip
```

**Step 2: Verify installation**

Run:
```bash
grep "react-tooltip" package.json
```
Expected: `"@radix-ui/react-tooltip": "^1.x.x"`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: install @radix-ui/react-tooltip

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Tooltip UI Component

**Files:**
- Create: `src/components/ui/tooltip.tsx`

**Step 1: Create the tooltip component**

```tsx
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

**Step 2: Verify TypeScript**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/tooltip.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Tooltip component from shadcn/ui

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create useSidebarState Hook

**Files:**
- Create: `src/lib/hooks/useSidebarState.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sidebar-collapsed";

export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    }
  }, [isCollapsed, isHydrated]);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  return { isCollapsed, toggle, isHydrated };
}
```

**Step 2: Verify TypeScript**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/hooks/useSidebarState.ts
git commit -m "$(cat <<'EOF'
feat: add useSidebarState hook with localStorage persistence

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Import hook and pass state to Sidebar**

Replace the current layout with:

```tsx
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import { LazyChatPanel } from "@/components/chat/LazyChatPanel";
import { SidebarProvider } from "@/components/layout/SidebarProvider";

// All dashboard pages require auth - skip static generation
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6 bg-secondary">{children}</main>
          </div>
        </div>
      </SidebarProvider>
      <ChatButton />
      <LazyChatPanel />
    </ChatProvider>
  );
}
```

**Step 2: Verify TypeScript** (will fail until Task 5)

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: Error about missing SidebarProvider (this is OK, we create it next)

**Step 3: Commit** (skip until Task 5 complete)

---

## Task 5: Create SidebarProvider Context

**Files:**
- Create: `src/components/layout/SidebarProvider.tsx`

**Step 1: Create the context provider**

```tsx
"use client";

import { createContext, useContext, useEffect } from "react";
import { useSidebarState } from "@/lib/hooks/useSidebarState";

type SidebarContextType = {
  isCollapsed: boolean;
  toggle: () => void;
  isHydrated: boolean;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const sidebarState = useSidebarState();

  // Keyboard shortcut: Cmd+\ or Ctrl+\
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        sidebarState.toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarState]);

  return (
    <SidebarContext.Provider value={sidebarState}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
```

**Step 2: Verify TypeScript**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit layout and provider together**

```bash
git add src/app/\(dashboard\)/layout.tsx src/components/layout/SidebarProvider.tsx
git commit -m "$(cat <<'EOF'
feat: add SidebarProvider context with keyboard shortcut

Adds Cmd+\ / Ctrl+\ toggle shortcut

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update Sidebar Component

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Update imports**

Add to existing imports:

```tsx
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useSidebar } from "./SidebarProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

**Step 2: Create NavItem helper component**

Add before the Sidebar function:

```tsx
function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
  badge,
  onMouseEnter,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
  badge?: React.ReactNode;
  onMouseEnter?: () => void;
}) {
  const content = (
    <Link
      href={href}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge}
        </>
      )}
      {isCollapsed && badge && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
```

**Step 3: Update Sidebar function**

Replace the `Sidebar` function with:

```tsx
export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const utils = trpc.useUtils();
  const shouldFetchPendingCount = pathname === "/dashboard" || pathname === "/transactions/review" || pathname?.startsWith("/transactions");

  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: shouldFetchPendingCount,
  });
  const { data: activeEntity } = trpc.entity.getActive.useQuery(undefined, {
    staleTime: Infinity,
  });

  const handlePrefetch = (href: string) => {
    if (href === "/dashboard") {
      utils.stats.dashboard.prefetch();
      utils.property.list.prefetch();
    } else if (href === "/portfolio") {
      utils.portfolio.getSummary.prefetch({ period: "monthly" });
      utils.portfolio.getPropertyMetrics.prefetch({ period: "monthly", sortBy: "alphabetical", sortOrder: "desc" });
    } else if (href === "/properties") {
      utils.property.list.prefetch();
    } else if (href === "/transactions") {
      utils.transaction.list.prefetch({ limit: 50, offset: 0 });
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r border-border bg-card min-h-screen p-4 transition-all duration-200 flex flex-col",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("mb-8", isCollapsed && "flex justify-center")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-lg">PropertyTracker</span>
            )}
          </Link>
        </div>

        {/* Portfolio Switcher */}
        {!isCollapsed && <PortfolioSwitcher />}

        {/* Entity Switcher */}
        <div className={cn("mb-4", isCollapsed && "px-0")}>
          <EntitySwitcher isCollapsed={isCollapsed} />
          {!isCollapsed && activeEntity && (activeEntity.type === "trust" || activeEntity.type === "smsf") && (
            <Link
              href={`/entities/${activeEntity.id}/compliance`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 mt-2 rounded-md text-sm font-medium transition-colors",
                pathname === `/entities/${activeEntity.id}/compliance`
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <ShieldCheck className="w-5 h-5" />
              Entity Compliance
            </Link>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1 flex-1" data-tour="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const showBadge = "showBadge" in item && item.showBadge && pendingCount?.count && pendingCount.count > 0;

            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                isCollapsed={isCollapsed}
                onMouseEnter={() => handlePrefetch(item.href)}
                badge={
                  showBadge ? (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {pendingCount.count > 99 ? "99+" : pendingCount.count}
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </nav>

        {/* Feedback Button */}
        {!isCollapsed && (
          <div className="mt-4 px-1">
            <FeedbackButton />
          </div>
        )}

        {/* Settings Section */}
        <div className="mt-4 pt-4 border-t border-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Settings className="w-4 h-4" />
              Settings
            </div>
          )}
          <nav className="space-y-1 mt-1">
            {settingsItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  isCollapsed={isCollapsed}
                />
              );
            })}
          </nav>
        </div>

        {/* Collapse Toggle Button */}
        <div className="mt-4 pt-4 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                  "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  isCollapsed && "justify-center px-2"
                )}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronsRight className="w-5 h-5" />
                ) : (
                  <>
                    <ChevronsLeft className="w-5 h-5" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
```

**Step 4: Verify TypeScript** (will fail until EntitySwitcher updated)

Run:
```bash
npx tsc --noEmit 2>&1 | head -10
```
Expected: Error about EntitySwitcher isCollapsed prop

**Step 5: Commit** (after Task 7)

---

## Task 7: Update EntitySwitcher

**Files:**
- Modify: `src/components/entities/EntitySwitcher.tsx`

**Step 1: Add isCollapsed prop**

Update the component to accept and use `isCollapsed`:

Add prop type:
```tsx
interface EntitySwitcherProps {
  isCollapsed?: boolean;
}

export function EntitySwitcher({ isCollapsed = false }: EntitySwitcherProps) {
```

**Step 2: Update the button rendering**

Replace the DropdownMenuTrigger button with:

```tsx
<DropdownMenuTrigger asChild>
  <Button
    variant="outline"
    className={cn(
      "justify-between",
      isCollapsed ? "w-10 h-10 p-0" : "w-[200px]"
    )}
    aria-label={`Switch entity. Current: ${activeEntity?.name || "Select Entity"}`}
  >
    {isCollapsed ? (
      <Icon className="h-4 w-4" />
    ) : (
      <>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="truncate">
            {activeEntity?.name || "Select Entity"}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </>
    )}
  </Button>
</DropdownMenuTrigger>
```

**Step 3: Add cn import if missing**

```tsx
import { cn } from "@/lib/utils";
```

**Step 4: Verify TypeScript**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 5: Commit Sidebar and EntitySwitcher together**

```bash
git add src/components/layout/Sidebar.tsx src/components/entities/EntitySwitcher.tsx
git commit -m "$(cat <<'EOF'
feat: make sidebar collapsible with icon-only mode

- Add collapse toggle button at bottom
- Show tooltips on hover when collapsed
- EntitySwitcher shows icon-only when collapsed
- Smooth transition animation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final Verification

**Step 1: Run all checks**

```bash
npm run lint && npx tsc --noEmit && npm run build
```
Expected: All pass

**Step 2: Manual testing checklist**

- [ ] Click toggle button - sidebar collapses to 64px
- [ ] Click again - sidebar expands to 256px
- [ ] Hover nav items when collapsed - tooltips appear
- [ ] Press Cmd+\ (Mac) or Ctrl+\ (Windows) - toggles sidebar
- [ ] Refresh page - collapsed state persists
- [ ] Entity dropdown works when collapsed
- [ ] All navigation links work in both states

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: address any issues found in testing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Step 4: Push and create PR**

```bash
git push -u origin feature/collapsible-sidebar
gh pr create --title "feat: add collapsible sidebar" --body "$(cat <<'EOF'
## Summary
- Sidebar collapses to icon-only mode (64px)
- Toggle button at bottom of sidebar
- Keyboard shortcut: Cmd+\ / Ctrl+\
- State persists in localStorage
- Tooltips on hover when collapsed
- Smooth 200ms transition animation

## Test plan
- [ ] Toggle button works
- [ ] Keyboard shortcut works
- [ ] State persists on refresh
- [ ] Tooltips appear when collapsed
- [ ] Entity/Portfolio dropdowns work when collapsed
- [ ] All navigation still works

## Screenshots
[Add before/after screenshots]

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install Radix Tooltip | package.json |
| 2 | Create Tooltip component | src/components/ui/tooltip.tsx |
| 3 | Create useSidebarState hook | src/lib/hooks/useSidebarState.ts |
| 4 | Update Dashboard Layout | src/app/(dashboard)/layout.tsx |
| 5 | Create SidebarProvider | src/components/layout/SidebarProvider.tsx |
| 6 | Update Sidebar component | src/components/layout/Sidebar.tsx |
| 7 | Update EntitySwitcher | src/components/entities/EntitySwitcher.tsx |
| 8 | Final verification | - |
