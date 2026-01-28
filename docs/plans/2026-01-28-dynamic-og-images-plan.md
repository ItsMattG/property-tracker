# Dynamic OG Images Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate dynamic Open Graph images for portfolio share links so they render rich previews when shared on social media.

**Architecture:** Edge API route at `/api/og/share/[token]` uses Next.js `ImageResponse` to render a branded 1200x630 image from the share's snapshot data. The share page gets `generateMetadata()` pointing to this route. Privacy modes (full/summary/redacted) control what data appears in the image.

**Tech Stack:** Next.js `ImageResponse` (from `next/og`), Drizzle ORM, existing `PortfolioSnapshot` types

---

### Task 1: OG Image Route

**Files:**
- Create: `src/app/api/og/share/[token]/route.tsx`
- Test: `src/app/api/og/share/__tests__/route.test.ts`

**Step 1: Write the test file**

Create `src/app/api/og/share/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module before importing route
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

import { GET } from "../[token]/route";
import { db } from "@/server/db";

const mockShare = {
  id: "share-1",
  userId: "user-1",
  token: "abc123",
  title: "My Portfolio",
  privacyMode: "full" as const,
  snapshotData: {
    generatedAt: "2026-01-25T00:00:00Z",
    summary: {
      propertyCount: 3,
      states: ["VIC", "NSW"],
      totalValue: 2500000,
      totalDebt: 1800000,
      totalEquity: 700000,
      portfolioLVR: 72,
      cashFlow: 2500,
      averageYield: 4.2,
    },
    properties: [
      { suburb: "Richmond", state: "VIC", portfolioPercent: 34 },
      { suburb: "Bondi", state: "NSW", portfolioPercent: 66 },
    ],
  },
  expiresAt: new Date(Date.now() + 86400000), // tomorrow
  viewCount: 0,
  createdAt: new Date(),
  lastViewedAt: null,
};

describe("OG share image route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an image response for valid token", async () => {
    vi.mocked(db.select().from({} as never).where({} as never).limit).mockResolvedValue([mockShare]);

    const request = new Request("http://localhost/api/og/share/abc123");
    const response = await GET(request, { params: Promise.resolve({ token: "abc123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("public");
  });

  it("redirects to fallback for invalid token", async () => {
    vi.mocked(db.select().from({} as never).where({} as never).limit).mockResolvedValue([]);

    const request = new Request("http://localhost/api/og/share/invalid");
    const response = await GET(request, { params: Promise.resolve({ token: "invalid" }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/og-image.svg");
  });

  it("redirects to fallback for expired share", async () => {
    const expiredShare = {
      ...mockShare,
      expiresAt: new Date(Date.now() - 86400000), // yesterday
    };
    vi.mocked(db.select().from({} as never).where({} as never).limit).mockResolvedValue([expiredShare]);

    const request = new Request("http://localhost/api/og/share/expired");
    const response = await GET(request, { params: Promise.resolve({ token: "expired" }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/og-image.svg");
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/og/share/__tests__/route.test.ts`
Expected: FAIL — module `../[token]/route` not found

**Step 3: Create the OG image route**

Create `src/app/api/og/share/[token]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { portfolioShares } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { PortfolioSnapshot, PrivacyMode } from "@/server/services/share";

export const runtime = "nodejs";

const FALLBACK_URL = "/og-image.svg";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}K`;
}

function getGrowthLabel(snapshot: PortfolioSnapshot): string | null {
  const { totalValue, totalDebt } = snapshot.summary;
  if (totalValue && totalDebt) {
    const equity = totalValue - totalDebt;
    const equityPercent = ((equity / totalValue) * 100).toFixed(0);
    return `${equityPercent}% Equity`;
  }
  return null;
}

function getSuburbList(snapshot: PortfolioSnapshot): string | null {
  if (!snapshot.properties || snapshot.properties.length === 0) return null;
  return snapshot.properties
    .map((p) => p.suburb)
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const [share] = await db
      .select()
      .from(portfolioShares)
      .where(eq(portfolioShares.token, token))
      .limit(1);

    if (!share) {
      return Response.redirect(new URL(FALLBACK_URL, _request.url), 302);
    }

    const now = new Date();
    if (now > new Date(share.expiresAt)) {
      return Response.redirect(new URL(FALLBACK_URL, _request.url), 302);
    }

    const snapshot = share.snapshotData as PortfolioSnapshot;
    const privacyMode = share.privacyMode as PrivacyMode;
    const { summary } = snapshot;

    const showValue = privacyMode !== "redacted" && summary.totalValue;
    const showGrowth = privacyMode !== "redacted";
    const showSuburbs = privacyMode === "full";
    const suburbs = showSuburbs ? getSuburbList(snapshot) : null;
    const growthLabel = showGrowth ? getGrowthLabel(snapshot) : null;

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px",
            background: "linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)",
            color: "white",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "32px", fontWeight: 700 }}>PropertyTracker</div>
            <div style={{ fontSize: "24px", opacity: 0.8 }}>Portfolio Share</div>
          </div>

          {/* Main content */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            {showValue ? (
              <>
                <div style={{ fontSize: "72px", fontWeight: 700 }}>
                  {formatCurrency(summary.totalValue!)}
                </div>
                <div style={{ fontSize: "28px", opacity: 0.8 }}>Portfolio Value</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "56px", fontWeight: 700 }}>Portfolio Overview</div>
              </>
            )}

            <div style={{ display: "flex", gap: "48px", marginTop: "16px" }}>
              <div style={{ fontSize: "24px", opacity: 0.9 }}>
                {summary.propertyCount} {summary.propertyCount === 1 ? "Property" : "Properties"}
              </div>
              {growthLabel && (
                <div style={{ fontSize: "24px", opacity: 0.9 }}>
                  {growthLabel}
                </div>
              )}
            </div>

            {suburbs && (
              <div style={{ fontSize: "22px", opacity: 0.7, marginTop: "8px" }}>
                {suburbs}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ fontSize: "20px", opacity: 0.6 }}>propertytracker.com.au</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch {
    return Response.redirect(new URL(FALLBACK_URL, _request.url), 302);
  }
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/og/share/__tests__/route.test.ts`
Expected: PASS (3 tests)

**Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 6: Commit**

```bash
git add src/app/api/og/share/
git commit -m "feat(og): dynamic OG image route for portfolio shares"
```

---

### Task 2: Share Page Metadata

**Files:**
- Modify: `src/app/share/[token]/page.tsx`

**Step 1: Add generateMetadata to the share page**

Add these imports at the top of `src/app/share/[token]/page.tsx` (line 10, after existing imports):

```typescript
import type { Metadata } from "next";
```

Add this function before the existing `getPrivacyLabel` function (after `PageProps` interface, around line 17):

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.propertytracker.com.au";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;

  const [share] = await db
    .select()
    .from(portfolioShares)
    .where(eq(portfolioShares.token, token))
    .limit(1);

  if (!share || new Date() > new Date(share.expiresAt)) {
    return {
      title: "Portfolio — PropertyTracker",
      description: "Track your investment properties with PropertyTracker.",
    };
  }

  const ogImageUrl = `${BASE_URL}/api/og/share/${token}`;

  return {
    title: `${share.title} — PropertyTracker`,
    description: "Portfolio snapshot shared via PropertyTracker.",
    openGraph: {
      title: `${share.title} — PropertyTracker`,
      description: "Portfolio snapshot shared via PropertyTracker.",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: share.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${share.title} — PropertyTracker`,
      description: "Portfolio snapshot shared via PropertyTracker.",
      images: [ogImageUrl],
    },
  };
}
```

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 3: Commit**

```bash
git add src/app/share/\[token\]/page.tsx
git commit -m "feat(og): add generateMetadata to portfolio share page"
```

---

### Task 3: Blog Twitter Card Upgrade

**Files:**
- Modify: `src/app/blog/[slug]/page.tsx:77-81`

**Step 1: Change twitter card type**

In `src/app/blog/[slug]/page.tsx`, change line 78 from:

```typescript
      card: "summary",
```

to:

```typescript
      card: "summary_large_image",
```

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 3: Commit**

```bash
git add src/app/blog/\[slug\]/page.tsx
git commit -m "feat(og): upgrade blog twitter card to summary_large_image"
```

---

### Task 4: Final Verification

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (730+ tests)

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors

**Step 4: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit any remaining changes**

If the OG route test needed adjustment, commit fixes here.
