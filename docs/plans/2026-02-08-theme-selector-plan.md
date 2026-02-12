# Theme Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a theme selector to the Settings page with 6 themes (including new Ocean), persisted to DB with localStorage fallback.

**Architecture:** Add `theme` column to `users` table, expose via BetterAuth session, apply via `data-theme` attribute on `<html>`. SSR reads theme from session for authenticated pages; inline script reads localStorage for unauthenticated pages. Settings page shows inline swatch cards for selection.

**Tech Stack:** Drizzle ORM, BetterAuth, tRPC, Next.js, Tailwind CSS, Vitest, Playwright

**Design doc:** `docs/plans/2026-02-08-theme-selector-design.md`

---

### Task 1: Add Ocean theme CSS + WCAG audit of all themes

**Files:**
- Modify: `src/styles/themes.css` (append after line 148)

**Step 1: Add Ocean theme to themes.css**

Append after the Bold theme block (line 148):

```css
/* Ocean Theme (Teal/Cyan) */
[data-theme="ocean"] {
	--color-primary: #0891b2;
	--color-primary-hover: #0e7490;
	--color-primary-light: #cffafe;
	--color-primary-foreground: #ffffff;
	--bg-primary: #ffffff;
	--bg-secondary: #f0fdfa;
	--bg-tertiary: #ccfbf1;
	--bg-card: #ffffff;
	--text-primary: #111827;
	--text-secondary: #4b5563;
	--text-muted: #636b75;
	--border-light: #e5e7eb;
	--border-medium: #d1d5db;
	--color-secondary-accent: #0284c7;
	--color-secondary-accent-light: #e0f2fe;
	--color-accent-warm: #d97706;
	--color-accent-warm-light: #fef3c7;
	--color-highlight: #6366f1;
	--color-highlight-light: #e0e7ff;
}
```

**Step 2: WCAG contrast audit**

Manually verify these contrast ratios for ALL 6 themes using the formula or a tool. Key pairs to check:

| Theme | `--color-primary` on `#fff` | `--text-primary` on `--bg-primary` | `--text-secondary` on `--bg-primary` | `--text-muted` on `--bg-primary` | `#fff` on `--color-primary` (buttons) |
|-------|---|---|---|---|---|
| Forest | `#15803d` on `#fff` = 5.1:1 OK | `#111827` on `#fff` = 17.4:1 OK | `#4b5563` on `#fff` = 7.2:1 OK | `#636b75` on `#fff` = 4.7:1 OK | `#fff` on `#15803d` = 5.1:1 OK |
| Clean | `#0066cc` on `#fff` = 4.6:1 OK | Same text = OK | `#6b7280` on `#fff` = 4.9:1 OK | `#9ca3af` on `#fff` = 2.7:1 FAIL | `#fff` on `#0066cc` = 4.6:1 OK |
| Dark | `#3b82f6` on `#0f172a` = 5.0:1 OK | `#f8fafc` on `#0f172a` = 17.1:1 OK | `#94a3b8` on `#0f172a` = 5.8:1 OK | `#64748b` on `#0f172a` = 3.8:1 OK | `#fff` on `#3b82f6` = 3.6:1 FAIL |
| Friendly | `#047857` on `#fafaf9` = 5.0:1 OK | `#1c1917` on `#fafaf9` = 16.6:1 OK | `#78716c` on `#fafaf9` = 4.1:1 FAIL | `#a8a29e` on `#fafaf9` = 2.5:1 FAIL | `#fff` on `#047857` = 5.0:1 OK |
| Bold | `#1d4ed8` on `#f8fafc` = 6.5:1 OK | `#0f172a` on `#f8fafc` = 17.1:1 OK | `#475569` on `#f8fafc` = 7.4:1 OK | `#94a3b8` on `#f8fafc` = 2.9:1 FAIL | `#fff` on `#1d4ed8` = 6.5:1 OK |
| Ocean | `#0891b2` on `#fff` = 3.7:1 FAIL | `#111827` on `#fff` = 17.4:1 OK | `#4b5563` on `#fff` = 7.2:1 OK | `#636b75` on `#fff` = 4.7:1 OK | `#fff` on `#0891b2` = 3.7:1 FAIL |

**Step 3: Fix WCAG failures**

Apply these fixes in `themes.css`:

- **Clean**: Change `--text-muted: #9ca3af` → `--text-muted: #6b7280` (4.9:1)
- **Dark**: Change `--color-primary: #3b82f6` → `--color-primary: #60a5fa` (check) OR keep blue-500 since dark bg buttons use `--color-primary-foreground: #fff` on `--color-primary` which needs 4.5:1. Actually `#3b82f6` as bg with white text = 3.6:1 FAIL. Fix: change to `--color-primary: #2563eb` (blue-600, white on it = 4.6:1 OK, and on dark bg `#0f172a` = 4.2:1 — acceptable as large text). OR change `--color-primary-foreground: #0f172a` (dark text on blue). Better: use `#2563eb` — `#fff` on `#2563eb` = 5.3:1 OK, `#2563eb` on `#0f172a` = 3.9:1 (OK for large text/UI elements).
- **Friendly**: Change `--text-secondary: #78716c` → `--text-secondary: #57534e` (stone-600, 6.0:1 OK). Change `--text-muted: #a8a29e` → `--text-muted: #78716c` (stone-500, 4.1:1 OK for large text, borderline for small — use `#6c6560` for 4.5:1).
- **Bold**: Change `--text-muted: #94a3b8` → `--text-muted: #64748b` (slate-500, 4.6:1 OK).
- **Ocean**: Change `--color-primary: #0891b2` → `--color-primary: #0e7490` (cyan-700, 5.0:1 OK). Update `--color-primary-hover: #0e7490` → `--color-primary-hover: #155e75` (cyan-800). White on `#0e7490` = 5.0:1 OK.

**Note:** Verify all fixes with an actual contrast checker. The estimates above are approximate — use https://webaim.org/resources/contrastchecker/ or similar.

**Step 4: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat: add Ocean theme and fix WCAG contrast across all themes"
```

---

### Task 2: Add `theme` column to DB schema + BetterAuth config

**Files:**
- Modify: `src/server/db/schema.ts:508-522` (users table)
- Modify: `src/lib/auth.ts:28-35` (additionalFields)

**Step 1: Add theme column to users table in schema.ts**

In `src/server/db/schema.ts`, add `theme` field to the `users` table (after `trialPlan` on line 519):

```typescript
  theme: varchar("theme", { length: 20 }),
```

This goes right before `createdAt`. `NULL` means default (forest).

**Step 2: Register theme in BetterAuth additionalFields**

In `src/lib/auth.ts`, add to the `additionalFields` object (line ~28-35):

```typescript
      theme: { type: "string", required: false, input: false },
```

This ensures `getAuthSession().user.theme` returns the value without needing a separate DB query.

**Step 3: Push schema to DB**

Run: `npx drizzle-kit push`

Expected: Schema synced, `theme` column added to `users` table.

**Step 4: Commit**

```bash
git add src/server/db/schema.ts src/lib/auth.ts
git commit -m "feat: add theme column to users table and BetterAuth config"
```

---

### Task 3: Add `setTheme` mutation to user router (TDD)

**Files:**
- Create: `src/server/routers/__tests__/user.test.ts`
- Modify: `src/server/routers/user.ts`

**Step 1: Write failing test**

Create `src/server/routers/__tests__/user.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  createAuthenticatedContext,
  createTestCaller,
} from "../../__tests__/test-utils";

describe("user router", () => {
  describe("setTheme", () => {
    it("updates the user theme in the database", async () => {
      const ctx = createAuthenticatedContext();
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ theme: "ocean" }]),
        }),
      });
      ctx.db.update = vi.fn().mockReturnValue({ set: setMock });

      const caller = createTestCaller(ctx);
      const result = await caller.user.setTheme({ theme: "ocean" });

      expect(result).toEqual({ theme: "ocean" });
      expect(ctx.db.update).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "ocean" })
      );
    });

    it("rejects invalid theme values", async () => {
      const ctx = createAuthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.user.setTheme({ theme: "invalid" as any })
      ).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/user.test.ts`

Expected: FAIL — `setTheme` doesn't exist on the user router yet.

**Step 3: Implement setTheme mutation**

In `src/server/routers/user.ts`, add after the `setMobilePassword` mutation:

```typescript
  // Set user theme preference
  setTheme: protectedProcedure
    .input(z.object({
      theme: z.enum(["forest", "clean", "dark", "friendly", "bold", "ocean"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ theme: input.theme })
        .where(eq(users.id, ctx.user.id))
        .returning({ theme: users.theme });
      return { theme: updated.theme };
    }),
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/routers/__tests__/user.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/__tests__/user.test.ts src/server/routers/user.ts
git commit -m "feat: add setTheme mutation to user router with tests"
```

---

### Task 4: Create ThemeProvider component

**Files:**
- Create: `src/components/theme/ThemeProvider.tsx`

**Step 1: Create the ThemeProvider**

This is a client component that:
- Accepts an optional `theme` prop (from SSR session data)
- Sets `data-theme` on `document.documentElement` on mount and when prop changes
- Also syncs to localStorage

Create `src/components/theme/ThemeProvider.tsx`:

```typescript
"use client";

import { useEffect } from "react";

export type Theme = "forest" | "clean" | "dark" | "friendly" | "bold" | "ocean";

const STORAGE_KEY = "bricktrack-theme";

export function ThemeProvider({
  theme,
  children,
}: {
  theme?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const resolved = (theme as Theme) || "forest";
    if (resolved === "forest") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    localStorage.setItem(STORAGE_KEY, resolved);
  }, [theme]);

  return <>{children}</>;
}

export function applyTheme(theme: Theme) {
  if (theme === "forest") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem(STORAGE_KEY, theme);
}
```

**Step 2: Commit**

```bash
git add src/components/theme/ThemeProvider.tsx
git commit -m "feat: create ThemeProvider component for data-theme management"
```

---

### Task 5: Wire ThemeProvider into layouts

**Files:**
- Modify: `src/app/layout.tsx` (add inline FOUC prevention script)
- Modify: `src/app/(dashboard)/layout.tsx` (add ThemeProvider with session theme)

**Step 1: Add FOUC prevention script to root layout**

In `src/app/layout.tsx`, add an inline script inside `<head>` (before `<body>`). This must be a raw `<script>` tag, not a React component, so it runs before paint:

```tsx
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("bricktrack-theme");if(t&&t!=="forest")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
```

Also add `suppressHydrationWarning` to `<html>` since the server won't have `data-theme` but the inline script might add it before React hydrates.

**Step 2: Add ThemeProvider to dashboard layout**

In `src/app/(dashboard)/layout.tsx`, import and wrap with ThemeProvider. Read theme from session:

```typescript
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getAuthSession } from "@/lib/auth";
```

Make the layout async and read the session:

```typescript
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  const theme = session?.user?.theme ?? null;

  return (
    <ThemeProvider theme={theme}>
      <ChatProvider>
        {/* ... existing layout content ... */}
      </ChatProvider>
    </ThemeProvider>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: wire ThemeProvider into layouts with FOUC prevention"
```

---

### Task 6: Build theme picker UI on Settings page

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

> **REQUIRED:** Use `frontend-design` skill for this task to produce a polished, distinctive theme picker UI.

**Step 1: Add theme swatch data and picker component**

In `src/app/(dashboard)/settings/page.tsx`, add above `settingsSections`:

```typescript
import { Check, Palette } from "lucide-react";
import { applyTheme, type Theme } from "@/components/theme/ThemeProvider";
import { trpc } from "@/lib/trpc/client";
import { useState, useEffect } from "react";

const THEMES: { id: Theme; name: string; label: string; primary: string; bg: string }[] = [
  { id: "forest", name: "Forest", label: "Green", primary: "#15803d", bg: "#ffffff" },
  { id: "clean", name: "Clean", label: "Blue", primary: "#0066cc", bg: "#ffffff" },
  { id: "dark", name: "Dark", label: "Night", primary: "#2563eb", bg: "#0f172a" },
  { id: "friendly", name: "Friendly", label: "Warm", primary: "#047857", bg: "#fafaf9" },
  { id: "bold", name: "Bold", label: "Strong", primary: "#1d4ed8", bg: "#f8fafc" },
  { id: "ocean", name: "Ocean", label: "Teal", primary: "#0e7490", bg: "#ffffff" },
];

function ThemePicker() {
  const [activeTheme, setActiveTheme] = useState<Theme>("forest");
  const setThemeMutation = trpc.user.setTheme.useMutation();

  useEffect(() => {
    const stored = localStorage.getItem("bricktrack-theme") as Theme | null;
    if (stored) setActiveTheme(stored);
  }, []);

  const handleSelect = (theme: Theme) => {
    const previous = activeTheme;
    setActiveTheme(theme);
    applyTheme(theme);
    setThemeMutation.mutate(
      { theme },
      {
        onError: () => {
          setActiveTheme(previous);
          applyTheme(previous);
          // toast error handled by tRPC global error handler
        },
      }
    );
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => handleSelect(t.id)}
          className={`relative rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
            activeTheme === t.id
              ? "ring-2 ring-offset-2"
              : "border-[var(--border-light)] hover:border-[var(--border-medium)]"
          }`}
          style={{
            borderColor: activeTheme === t.id ? t.primary : undefined,
            ringColor: activeTheme === t.id ? t.primary : undefined,
          }}
        >
          <div
            className="h-2 w-full rounded-full mb-2"
            style={{ backgroundColor: t.primary }}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
            {activeTheme === t.id && (
              <Check className="h-4 w-4" style={{ color: t.primary }} />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Add Appearance section to Settings page**

In the JSX of `SettingsPage`, add the Appearance section before the existing `settingsSections.map(...)`:

```tsx
      <div>
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
            Appearance
          </CardTitle>
        </CardHeader>
        <ThemePicker />
      </div>
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat: add theme picker to Settings page"
```

---

### Task 7: E2E test for theme selection

**Files:**
- Create: `e2e/settings.spec.ts`

**Step 1: Write E2E test**

Create `e2e/settings.spec.ts`:

```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Settings - Theme Selector", () => {
  test("can select a theme and it persists", async ({ authenticatedPage: page }) => {
    // Track page errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to settings
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible();

    // Click the Ocean theme card
    await page.getByRole("button", { name: /Ocean/i }).click();

    // Verify data-theme attribute is set on <html>
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(theme).toBe("ocean");

    // Reload and verify theme persists (from DB via SSR)
    await page.reload();
    await page.waitForLoadState("networkidle");

    const themeAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(themeAfterReload).toBe("ocean");

    // Reset back to forest (default) to clean up
    await page.getByRole("button", { name: /Forest/i }).click();
    const resetTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    // Forest is default, so data-theme should be removed
    expect(resetTheme).toBeNull();

    // No page errors
    expect(errors).toEqual([]);
  });
});
```

**Step 2: Run E2E to verify it fails (Red)**

Run: `npm run test:e2e -- --grep "Theme Selector"`

Expected: FAIL — settings page doesn't have Appearance section yet (or it does if tasks are run in order — in that case it tests the full flow).

**Step 3: Commit**

```bash
git add e2e/settings.spec.ts
git commit -m "test: add E2E test for theme selection flow"
```

---

### Task 8: Full validation and cleanup

**Step 1: Run unit tests**

Run: `npm run test:unit`

Expected: ALL pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`

Expected: No errors

**Step 4: Run E2E tests**

Follow the Environment Spin-Up Procedure from CLAUDE.md, then:

Run: `npm run test:e2e`

Expected: ALL pass (including new settings theme test)

**Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint/type/test issues from theme selector"
```

---

## Task Dependency Graph

```
Task 1 (Ocean CSS + WCAG) ──┐
Task 2 (DB schema)  ────────┤
Task 3 (tRPC mutation) ─────┤── Task 5 (wire layouts) ── Task 6 (UI) ── Task 7 (E2E) ── Task 8 (validate)
Task 4 (ThemeProvider) ──────┘
```

Tasks 1-4 can run in parallel. Task 5 depends on 2+4. Task 6 depends on 3+4+5. Tasks 7-8 are sequential after 6.
