# Portfolio Sharing — Polish & Unflag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the existing portfolio sharing feature by unflagging it, adding sidebar nav, share preview, email sharing, and UX polish.

**Architecture:** The feature is 90% built (schema, router, service, public viewer, management page). This plan modifies ~8 existing files and adds ~2 test files. No new tables or routers needed.

**Tech Stack:** Next.js 16 (App Router), tRPC v11, React 19, shadcn/ui, Sonner v2, Vitest, Playwright

---

### Task 1: Unflag Feature + Add Sidebar Navigation

**Files:**
- Modify: `src/config/feature-flags.ts:15`
- Modify: `src/components/layout/Sidebar.tsx:69-77`

**Step 1: Enable the feature flag**

In `src/config/feature-flags.ts`, change line 15:

```typescript
// Before
portfolioShares: false,

// After
portfolioShares: true,
```

**Step 2: Add sidebar navigation item**

In `src/components/layout/Sidebar.tsx`, find the "Reports & Tax" section (around line 69). Add the Portfolio Shares item after "Accountant Pack":

```typescript
{
  label: "Reports & Tax",
  items: [
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/reports/tax-position", label: "Tax Position", icon: Calculator },
    { href: "/reports/accountant-pack", label: "Accountant Pack", icon: FileOutput },
    { href: "/reports/share", label: "Portfolio Shares", icon: Share2, featureFlag: "portfolioShares" },
    { href: "/cash-flow", label: "Cash Flow", icon: CalendarDays, featureFlag: "cashFlow" },
    { href: "/analytics/scorecard", label: "Scorecard", icon: Award },
    { href: "/reports/forecast", label: "Forecast", icon: TrendingUp, featureFlag: "forecast" },
  ],
},
```

Add `Share2` to the lucide-react import at the top of the file (check if it's already imported).

**Step 3: Verify the route is accessible**

Run: `npm run dev` and navigate to `/reports/share`. Confirm:
- Page loads without redirect to `/dashboard`
- Sidebar shows "Portfolio Shares" link in Reports & Tax section
- Link is active/highlighted when on the page

**Step 4: Commit**

```bash
git add src/config/feature-flags.ts src/components/layout/Sidebar.tsx
git commit -m "feat: unflag portfolio shares and add sidebar navigation"
```

---

### Task 2: Add Share Preview to Create Modal

**Files:**
- Modify: `src/components/share/CreateShareModal.tsx`

**Step 1: Add privacy mode description panel**

In `src/components/share/CreateShareModal.tsx`, after the privacy mode `<Select>` block (after line 156), add a description panel that updates based on the selected privacy mode:

```tsx
{/* Privacy mode preview description */}
<div className="rounded-lg border bg-muted/50 p-3">
  <p className="text-sm text-muted-foreground">
    {privacyMode === "full" && "Recipients will see all property addresses, values, loan details, and cash flow."}
    {privacyMode === "summary" && "Recipients will see portfolio totals only — no individual property data."}
    {privacyMode === "redacted" && "Recipients will see suburbs, percentages, and ratios — no addresses or dollar amounts."}
  </p>
</div>
```

This goes inside the form section (the `else` branch of the `createdUrl` ternary), after the privacy mode select and before the "Expires In" select.

**Step 2: Verify in browser**

Run: `npm run dev`, navigate to `/reports/share`, click "Create Share".
- Select each privacy mode and confirm the description updates
- Confirm the description is visible below the privacy mode dropdown

**Step 3: Commit**

```bash
git add src/components/share/CreateShareModal.tsx
git commit -m "feat: add privacy mode preview description to share creation modal"
```

---

### Task 3: Add Email Sharing to Success Step

**Files:**
- Modify: `src/components/share/CreateShareModal.tsx`

**Step 1: Add email share button after link creation**

In `src/components/share/CreateShareModal.tsx`, in the success state (the `createdUrl` truthy branch, around line 107-122), add an "Email Link" button after the copy button row. Import `Mail` from `lucide-react`.

Replace the success content section:

```tsx
{createdUrl ? (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      <Input value={createdUrl} readOnly className="font-mono text-sm" />
      <Button size="icon" variant="outline" onClick={handleCopy}>
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="flex-1"
        asChild
      >
        <a
          href={`mailto:?subject=${encodeURIComponent(`Portfolio snapshot — ${title}`)}&body=${encodeURIComponent(`View my portfolio snapshot on BrickTrack:\n\n${createdUrl}`)}`}
        >
          <Mail className="w-4 h-4 mr-2" />
          Email Link
        </a>
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">
      This link will expire in {expiresInDays} days.
    </p>
  </div>
) : (
```

Add `Mail` to the lucide-react import: `import { Copy, Check, Loader2, Mail } from "lucide-react";`

**Step 2: Verify in browser**

- Create a share, confirm "Email Link" button appears
- Click it — confirm native email client opens with pre-filled subject and body containing the share URL

**Step 3: Commit**

```bash
git add src/components/share/CreateShareModal.tsx
git commit -m "feat: add email sharing option to share creation success step"
```

---

### Task 4: Add Copy Button and Revoke Confirmation to Share Table

**Files:**
- Modify: `src/app/(dashboard)/reports/share/page.tsx`

**Step 1: Add direct copy button in table row**

In `src/app/(dashboard)/reports/share/page.tsx`, modify the actions `<TableCell>` (around line 145-169). Add a copy button before the dropdown menu:

```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => copyLink(share.url)}
      disabled={share.isExpired}
      aria-label="Copy share link"
    >
      <Copy className="w-4 h-4" />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Share actions">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => copyLink(share.url)}
          disabled={share.isExpired}
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setRevokeTarget(share)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Revoke
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</TableCell>
```

**Step 2: Add revoke confirmation dialog**

Add state at the top of the component:

```tsx
const [revokeTarget, setRevokeTarget] = useState<typeof shares[number] | null>(null);
```

Note: The type depends on the share list return type. Use whatever type `shares` items have.

Add an `AlertDialog` after the `CreateShareModal` at the bottom of the JSX. Import `AlertDialog` components:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

```tsx
<AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Revoke share link?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently disable the share link for &ldquo;{revokeTarget?.title}&rdquo;. Anyone with this link will no longer be able to view the portfolio.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        variant="destructive"
        onClick={() => {
          if (revokeTarget) {
            revokeMutation.mutate({ id: revokeTarget.id });
            setRevokeTarget(null);
          }
        }}
      >
        Revoke
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 3: Improve expiry display**

In the Expires `<TableCell>` (around line 128-137), update to show both date and relative time:

```tsx
<TableCell>
  {share.isExpired ? (
    <Badge variant="destructive">Expired</Badge>
  ) : isExpiringSoon(new Date(share.expiresAt)) ? (
    <Badge variant="secondary">
      {format(new Date(share.expiresAt), "MMM d")} — expires soon
    </Badge>
  ) : (
    <span className="text-sm">
      {format(new Date(share.expiresAt), "MMM d, yyyy")}
      <span className="text-muted-foreground ml-1">
        ({formatDistanceToNow(new Date(share.expiresAt), { addSuffix: true })})
      </span>
    </span>
  )}
</TableCell>
```

**Step 4: Verify in browser**

- Confirm copy button appears directly in table row
- Confirm clicking copy shows toast "Link copied to clipboard"
- Confirm clicking Revoke in dropdown opens confirmation dialog
- Confirm expiry column shows "Mar 5, 2026 (in 12 days)" format

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/share/page.tsx
git commit -m "feat: add copy button, revoke confirmation, and improved expiry display"
```

---

### Task 5: Unit Tests for Share Service

**Files:**
- Create: `src/server/services/portfolio/__tests__/share.test.ts`

**Step 1: Write the tests**

Create `src/server/services/portfolio/__tests__/share.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  generateShareToken,
  transformForPrivacy,
  type PortfolioSnapshot,
} from "../share";

const mockSnapshot: PortfolioSnapshot = {
  generatedAt: "2026-02-19T00:00:00Z",
  summary: {
    propertyCount: 3,
    states: ["NSW", "VIC"],
    totalValue: 2_500_000,
    totalDebt: 1_800_000,
    totalEquity: 700_000,
    portfolioLVR: 72,
    cashFlow: 15_000,
    averageYield: 4.2,
    cashFlowPositive: true,
  },
  properties: [
    {
      address: "123 Main St",
      suburb: "Sydney",
      state: "NSW",
      currentValue: 1_500_000,
      totalLoans: 1_000_000,
      equity: 500_000,
      lvr: 66.7,
      cashFlow: 10_000,
      grossYield: 4.5,
      portfolioPercent: 60,
    },
    {
      address: "456 High St",
      suburb: "Melbourne",
      state: "VIC",
      currentValue: 1_000_000,
      totalLoans: 800_000,
      equity: 200_000,
      lvr: 80,
      cashFlow: 5_000,
      grossYield: 3.8,
      portfolioPercent: 40,
    },
  ],
};

describe("generateShareToken", () => {
  it("generates a base64url token", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateShareToken()));
    expect(tokens.size).toBe(100);
  });

  it("generates tokens of consistent length", () => {
    const token = generateShareToken();
    expect(token.length).toBe(16); // 12 bytes = 16 base64url chars
  });
});

describe("transformForPrivacy", () => {
  describe("full mode", () => {
    it("returns snapshot unchanged", () => {
      const result = transformForPrivacy(mockSnapshot, "full");
      expect(result).toEqual(mockSnapshot);
    });
  });

  describe("summary mode", () => {
    it("includes summary data", () => {
      const result = transformForPrivacy(mockSnapshot, "summary");
      expect(result.summary).toEqual(mockSnapshot.summary);
      expect(result.generatedAt).toBe(mockSnapshot.generatedAt);
    });

    it("excludes properties array", () => {
      const result = transformForPrivacy(mockSnapshot, "summary");
      expect(result.properties).toBeUndefined();
    });
  });

  describe("redacted mode", () => {
    it("strips dollar amounts from summary", () => {
      const result = transformForPrivacy(mockSnapshot, "redacted");
      expect(result.summary.totalValue).toBeUndefined();
      expect(result.summary.totalDebt).toBeUndefined();
      expect(result.summary.totalEquity).toBeUndefined();
      expect(result.summary.cashFlow).toBeUndefined();
    });

    it("keeps percentages and ratios in summary", () => {
      const result = transformForPrivacy(mockSnapshot, "redacted");
      expect(result.summary.portfolioLVR).toBe(72);
      expect(result.summary.averageYield).toBe(4.2);
      expect(result.summary.propertyCount).toBe(3);
      expect(result.summary.states).toEqual(["NSW", "VIC"]);
    });

    it("derives cashFlowPositive from cashFlow", () => {
      const result = transformForPrivacy(mockSnapshot, "redacted");
      expect(result.summary.cashFlowPositive).toBe(true);
    });

    it("strips addresses from properties", () => {
      const result = transformForPrivacy(mockSnapshot, "redacted");
      expect(result.properties).toBeDefined();
      result.properties!.forEach((p) => {
        expect(p.address).toBeUndefined();
        expect(p.currentValue).toBeUndefined();
        expect(p.totalLoans).toBeUndefined();
        expect(p.equity).toBeUndefined();
        expect(p.cashFlow).toBeUndefined();
      });
    });

    it("keeps suburb, state, and percentages in properties", () => {
      const result = transformForPrivacy(mockSnapshot, "redacted");
      expect(result.properties![0].suburb).toBe("Sydney");
      expect(result.properties![0].state).toBe("NSW");
      expect(result.properties![0].lvr).toBe(66.7);
      expect(result.properties![0].grossYield).toBe(4.5);
      expect(result.properties![0].portfolioPercent).toBe(60);
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/server/services/portfolio/__tests__/share.test.ts`
Expected: All tests pass (these test existing working code)

**Step 3: Commit**

```bash
git add src/server/services/portfolio/__tests__/share.test.ts
git commit -m "test: add unit tests for portfolio share service"
```

---

### Task 6: Unit Tests for Share Repository

**Files:**
- Create: `src/server/repositories/__tests__/portfolio-share.test.ts`

**Step 1: Write the tests**

Create `src/server/repositories/__tests__/portfolio-share.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "../../test-utils";

describe("PortfolioRepository — share methods", () => {
  const uow = createMockUow();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createShare", () => {
    it("creates a share and returns it", async () => {
      const mockShare = {
        id: "share-1",
        userId: "user-1",
        token: "test-token",
        title: "My Share",
        privacyMode: "full" as const,
        snapshotData: { generatedAt: "2026-02-19", summary: { propertyCount: 1, states: ["NSW"] } },
        expiresAt: new Date("2026-03-05"),
        viewCount: 0,
        createdAt: new Date(),
        lastViewedAt: null,
      };

      vi.mocked(uow.portfolio.createShare).mockResolvedValue(mockShare);

      const result = await uow.portfolio.createShare(mockShare);
      expect(result).toEqual(mockShare);
      expect(uow.portfolio.createShare).toHaveBeenCalledWith(mockShare);
    });
  });

  describe("findSharesByOwner", () => {
    it("returns shares for the given user", async () => {
      const mockShares = [
        { id: "share-1", userId: "user-1", title: "Share 1", token: "t1", privacyMode: "full" as const, viewCount: 5, createdAt: new Date(), expiresAt: new Date(), snapshotData: {}, lastViewedAt: null },
        { id: "share-2", userId: "user-1", title: "Share 2", token: "t2", privacyMode: "summary" as const, viewCount: 0, createdAt: new Date(), expiresAt: new Date(), snapshotData: {}, lastViewedAt: null },
      ];

      vi.mocked(uow.portfolio.findSharesByOwner).mockResolvedValue(mockShares);

      const result = await uow.portfolio.findSharesByOwner("user-1");
      expect(result).toHaveLength(2);
      expect(uow.portfolio.findSharesByOwner).toHaveBeenCalledWith("user-1");
    });

    it("returns empty array when no shares exist", async () => {
      vi.mocked(uow.portfolio.findSharesByOwner).mockResolvedValue([]);

      const result = await uow.portfolio.findSharesByOwner("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("deleteShare", () => {
    it("deletes share scoped by user", async () => {
      vi.mocked(uow.portfolio.deleteShare).mockResolvedValue({ id: "share-1" } as any);

      await uow.portfolio.deleteShare("share-1", "user-1");
      expect(uow.portfolio.deleteShare).toHaveBeenCalledWith("share-1", "user-1");
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/repositories/__tests__/portfolio-share.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/repositories/__tests__/portfolio-share.test.ts
git commit -m "test: add unit tests for portfolio share repository"
```

---

### Task 7: E2E Test — Create and View Share

**Files:**
- Create: `e2e/portfolio-share.spec.ts`

**Step 1: Write the E2E test**

Create `e2e/portfolio-share.spec.ts`:

```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Portfolio Sharing", () => {
  test("creates a share and views it publicly", async ({ authenticatedPage: page }) => {
    // Navigate to Portfolio Shares page
    await page.goto("/reports/share");
    await expect(page.getByRole("heading", { name: "Portfolio Shares" })).toBeVisible();

    // Click Create Share
    await page.getByRole("button", { name: /create share/i }).click();

    // Fill in the modal
    await expect(page.getByRole("dialog")).toBeVisible();
    const titleInput = page.getByLabel("Title");
    await titleInput.clear();
    await titleInput.fill("E2E Test Share");

    // Create the share
    await page.getByRole("button", { name: /create share/i }).click();

    // Wait for success — share URL should appear
    await expect(page.getByText("Share Created")).toBeVisible({ timeout: 10_000 });

    // Copy the share URL
    const urlInput = page.locator("input[readonly]");
    const shareUrl = await urlInput.inputValue();
    expect(shareUrl).toContain("/share/");

    // Close the modal
    await page.getByRole("button", { name: "Done" }).click();

    // Verify share appears in table
    await expect(page.getByText("E2E Test Share")).toBeVisible();

    // Visit the public share page (no auth needed)
    await page.goto(new URL(shareUrl).pathname);
    await expect(page.getByText("E2E Test Share")).toBeVisible();
    await expect(page.getByText("Properties")).toBeVisible();

    // Verify "Powered by BrickTrack" footer
    await expect(page.getByText("Powered by BrickTrack")).toBeVisible();

    // Clean up — revoke the share
    await page.goto("/reports/share");
    const row = page.getByRole("row").filter({ hasText: "E2E Test Share" });
    await row.getByRole("button", { name: "Share actions" }).click();
    await page.getByRole("menuitem", { name: /revoke/i }).click();

    // Confirm revoke dialog
    await page.getByRole("button", { name: /revoke/i }).last().click();

    // Verify share is removed
    await expect(page.getByText("E2E Test Share")).not.toBeVisible();
  });
});
```

**Step 2: Run the E2E test**

Run: `npx playwright test e2e/portfolio-share.spec.ts --headed`
Expected: Test creates share, views public page, revokes share

Note: The revoke dialog step may need adjustment depending on the exact button selectors after Task 4's changes. Adjust selectors if the confirmation dialog changes the flow.

**Step 3: Commit**

```bash
git add e2e/portfolio-share.spec.ts
git commit -m "test: add E2E test for portfolio share create and view flow"
```

---

## Tech Notes

- **Feature flags**: Simple boolean object in `src/config/feature-flags.ts`. Route gating via `isRouteGated()` in proxy. Sidebar items have optional `featureFlag` prop.
- **Share tokens**: 12 random bytes encoded as base64url (96 bits entropy, 16 chars). Generated by `randomBytes(12).toString("base64url")`.
- **Privacy modes**: `full` (all data), `summary` (totals only, no properties), `redacted` (suburbs + percentages only). Transformation is server-side via `transformForPrivacy()`.
- **Snapshot approach**: Shares are frozen snapshots at creation time (JSONB column), not live data. This is by design — users control what's shared at a point in time.
- **shadcn AlertDialog**: Used for destructive confirmations. Import from `@/components/ui/alert-dialog`. `AlertDialogAction` accepts `variant="destructive"`.
- **Context7 unavailable**: Monthly quota exceeded. Plan based on direct codebase reading and existing CLAUDE.md patterns.
