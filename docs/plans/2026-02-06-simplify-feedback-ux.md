# Simplify Feedback UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the Feedback button from sidebar to header (icon-only), remove Bug Reports and Support pages from sidebar settings, gate their routes, and change bug report submission to send email via Resend instead of inserting into the database.

**Architecture:** FeedbackButton moves to Header as an icon-only dropdown trigger matching existing header button patterns (`variant="ghost" size="icon"`). Bug Reports and Support sidebar entries are removed and their routes gated via feature flags set to `false`. The `submitBug` tRPC procedure switches from DB insert to calling the existing `sendEmailNotification` Resend wrapper.

**Tech Stack:** Next.js App Router, tRPC, Resend (email), Drizzle ORM, Playwright (e2e tests)

---

### Task 1: Add feature flags and route gating for Bug Reports and Support

**Files:**
- Modify: `src/config/feature-flags.ts:8-35` (add flags)
- Modify: `src/config/feature-flags.ts:40-58` (add route mappings)

**Step 1: Add `bugReports` and `support` flags to `featureFlags`**

In `src/config/feature-flags.ts`, add two new flags at the end of the `// ── Settings` section (after `supportAdmin: false`):

```typescript
  // ── Settings ──────────────────────────────────────────────────────
  refinanceAlerts: false,
  emailConnections: false,
  mobileApp: false,
  team: false,
  auditLog: false,
  supportAdmin: false,
  bugReports: false,
  support: false,
```

**Step 2: Add route mappings to `routeToFlag`**

Add two entries at the end of `routeToFlag` (after the `"/settings/support-admin"` entry):

```typescript
  "/settings/support-admin": "supportAdmin",
  "/settings/bug-reports": "bugReports",
  "/settings/support": "support",
```

**Step 3: Verify middleware gates the routes**

Run: `npx tsx -e "const {isRouteGated} = require('./src/config/feature-flags'); console.log(isRouteGated('/settings/bug-reports'), isRouteGated('/settings/support'))"`
Expected: `true true`

**Step 4: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat: gate bug-reports and support routes via feature flags"
```

---

### Task 2: Remove Bug Reports and Support from sidebar settings

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:6-37` (remove `Bug` import)
- Modify: `src/components/layout/Sidebar.tsx:80-96` (remove two settings items, add featureFlag to them)

**Step 1: Remove the `Bug` icon import**

In the lucide-react import block, remove `Bug` from the import list. Keep `Ticket` — it's still used by `supportAdmin`.

Before:
```typescript
  Bug,
  Mail,
```

After:
```typescript
  Mail,
```

**Step 2: Remove Bug Reports and Support entries from `settingsItems`**

Remove these two entries from the `settingsItems` array:

```typescript
  { href: "/settings/bug-reports", label: "Bug Reports", icon: Bug },
  { href: "/settings/support", label: "Support", icon: Ticket },
```

The resulting `settingsItems` should be:
```typescript
const settingsItems: Array<{
  href: string;
  label: string;
  icon: React.ElementType;
  featureFlag?: FeatureFlag;
}> = [
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/refinance-alerts", label: "Refinance Alerts", icon: BellRing, featureFlag: "refinanceAlerts" },
  { href: "/settings/email-connections", label: "Email Connections", icon: Mail, featureFlag: "emailConnections" },
  { href: "/settings/mobile", label: "Mobile App", icon: Smartphone, featureFlag: "mobileApp" },
  { href: "/settings/team", label: "Team", icon: Users, featureFlag: "team" },
  { href: "/settings/audit-log", label: "Audit Log", icon: History, featureFlag: "auditLog" },
  { href: "/settings/feature-requests", label: "Feature Requests", icon: MessageSquarePlus },
  { href: "/settings/support-admin", label: "Support Admin", icon: Ticket, featureFlag: "supportAdmin" },
];
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: remove Bug Reports and Support from sidebar settings"
```

---

### Task 3: Move FeedbackButton from Sidebar to Header

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:41` (remove FeedbackButton import)
- Modify: `src/components/layout/Sidebar.tsx:252-257` (remove FeedbackButton render block)
- Modify: `src/components/feedback/FeedbackButton.tsx:15-50` (restyle for header)
- Modify: `src/components/layout/Header.tsx:1-36` (add FeedbackButton)

**Step 1: Remove FeedbackButton from Sidebar**

In `src/components/layout/Sidebar.tsx`:

Remove the import line:
```typescript
import { FeedbackButton } from "@/components/feedback";
```

Remove the render block (the `{/* Feedback Button */}` section):
```tsx
        {/* Feedback Button */}
        {!isCollapsed && (
          <div className="mt-4 px-1">
            <FeedbackButton />
          </div>
        )}
```

**Step 2: Restyle FeedbackButton for header context (icon-only trigger)**

In `src/components/feedback/FeedbackButton.tsx`, change the trigger button from sidebar-style to header icon-style. Replace the full component:

```tsx
"use client";

import { useState } from "react";
import { MessageSquarePlus, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeatureRequestModal } from "./FeatureRequestModal";
import { BugReportModal } from "./BugReportModal";

export function FeedbackButton() {
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Feedback">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setFeatureModalOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Request Feature
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBugModalOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Report Bug
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeatureRequestModal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
      />
      <BugReportModal
        open={bugModalOpen}
        onClose={() => setBugModalOpen(false)}
      />
    </>
  );
}
```

Key changes from original:
- `size="sm" className="w-full justify-start"` → `size="icon" title="Feedback"`
- Removed text label "Feedback" and `mr-2` from trigger icon
- Changed dropdown `align="start"` → `align="end"` (opens leftward in header)

**Step 3: Add FeedbackButton to Header**

In `src/components/layout/Header.tsx`, add the import and render it after HelpButton:

Add import:
```typescript
import { FeedbackButton } from "@/components/feedback";
```

In the actions div, add `<FeedbackButton />` between `<HelpButton />` and `<AlertBadge />`:

```tsx
        <div className="flex items-center gap-4" data-tour="quick-actions">
          <HelpButton />
          <FeedbackButton />
          <AlertBadge />
```

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/feedback/FeedbackButton.tsx src/components/layout/Header.tsx
git commit -m "feat: move FeedbackButton from sidebar to header as icon-only button"
```

---

### Task 4: Change submitBug to send email via Resend

**Files:**
- Modify: `src/server/routers/feedback.ts:1-11` (update imports)
- Modify: `src/server/routers/feedback.ts:194-219` (rewrite submitBug mutation)

**Step 1: Update imports**

In `src/server/routers/feedback.ts`:

Remove `bugReports` from the schema import (it's no longer used in submitBug, and `listBugs`/`updateBugStatus` still use it so keep those procedures intact):

Actually — `bugReports` IS still used by `listBugs` (line 248) and `updateBugStatus` (line 288). Keep the import.

Add the email notification import at the top of the file:

```typescript
import { sendEmailNotification } from "@/server/services/notification";
```

**Step 2: Rewrite the submitBug mutation to send email instead of DB insert**

Replace the `submitBug` mutation body (lines 205-218) with:

```typescript
  submitBug: protectedProcedure
    .input(
      z.object({
        description: z.string().min(10).max(2000),
        stepsToReproduce: z.string().max(2000).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        browserInfo: z.record(z.string(), z.string()).optional(),
        currentPage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reporterEmail = ctx.user.email;
      const reporterName = ctx.user.name || reporterEmail;

      const browserInfoHtml = input.browserInfo
        ? Object.entries(input.browserInfo)
            .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
            .join("")
        : "<li>Not provided</li>";

      const html = `
        <h2>Bug Report from ${reporterName}</h2>
        <p><strong>Severity:</strong> ${input.severity.toUpperCase()}</p>
        <p><strong>Reporter:</strong> ${reporterEmail}</p>
        <p><strong>Page:</strong> ${input.currentPage || "Unknown"}</p>
        <h3>Description</h3>
        <p>${input.description.replace(/\n/g, "<br>")}</p>
        ${input.stepsToReproduce ? `<h3>Steps to Reproduce</h3><p>${input.stepsToReproduce.replace(/\n/g, "<br>")}</p>` : ""}
        <h3>Browser Info</h3>
        <ul>${browserInfoHtml}</ul>
      `.trim();

      const recipient = process.env.BUG_REPORT_EMAIL || "bugs@bricktrack.com.au";
      const subject = `[Bug Report] [${input.severity.toUpperCase()}] ${input.description.slice(0, 80)}`;

      await sendEmailNotification(recipient, subject, html);

      return { id: "emailed" };
    }),
```

Key differences from original:
- No DB insert — sends email via existing Resend wrapper
- Returns `{ id: "emailed" }` to match the existing return shape so the client doesn't break
- Recipient is configurable via `BUG_REPORT_EMAIL` env var with sensible fallback
- Email includes all context: severity, description, steps, browser info, reporter email, current page

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/feedback.ts
git commit -m "feat: change bug report submission to send email via Resend"
```

---

### Task 5: Update Playwright tests

**Files:**
- Modify: `e2e/dashboard.spec.ts:154-189` (update settings section tests)

**Step 1: Update "should display settings section with core items" test**

Remove the assertions for "bug reports" and "support" from the core items test. The test at lines 154-171 should become:

```typescript
  test("should display settings section with core items", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Settings")).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /notifications/i })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /feature requests/i })
    ).toBeVisible();
  });
```

**Step 2: Add Bug Reports and Support to the "should hide feature-flagged settings items" test**

Add assertions to the existing test at lines 173-189:

```typescript
  test("should hide feature-flagged settings items", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("link", { name: "Refinance Alerts", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Team", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Audit Log", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Mobile App", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Bug Reports", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Support", exact: true })
    ).not.toBeVisible();
  });
```

**Step 3: Add test for Feedback button in header**

Add a new test after the header visibility test (after line 37):

```typescript
  test("should display feedback button in header", async ({
    authenticatedPage: page,
  }) => {
    const header = page.locator("header");
    await expect(
      header.getByRole("button", { name: /feedback/i })
    ).toBeVisible();
  });
```

**Step 4: Run the tests**

Run: `npx playwright test e2e/dashboard.spec.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test: update dashboard tests for feedback UX changes"
```

---

### Task 6: Final verification

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

**Step 2: Run the dashboard e2e tests**

Run: `npx playwright test e2e/dashboard.spec.ts`
Expected: All tests pass

**Step 3: Run full test suite to check for regressions**

Run: `npx playwright test`
Expected: No regressions

**Step 4: Verify manually (checklist)**

- [ ] Feedback button appears as icon in header (between HelpButton and AlertBadge)
- [ ] Clicking Feedback icon opens dropdown with "Request Feature" and "Report Bug"
- [ ] Bug Reports and Support links no longer appear in sidebar settings
- [ ] Feature Requests link still appears in sidebar settings
- [ ] Navigating to `/settings/bug-reports` redirects to `/dashboard`
- [ ] Navigating to `/settings/support` redirects to `/dashboard`
- [ ] Submitting a bug report via the modal triggers an email (check Resend dashboard)
