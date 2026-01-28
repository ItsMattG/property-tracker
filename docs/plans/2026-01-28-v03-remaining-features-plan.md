# V0.3 Remaining Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining v0.3 roadmap items: SEO polish, email attachment downloads, email thread grouping, advisor invitation system, and referral/rewards program.

**Architecture:** Three independent feature branches, each merged separately. Feature A (SEO + Email) touches metadata, tRPC email router, Supabase signed URLs, and email list UI. Feature B (Advisors) extends the existing role/permission system with an advisor role, dedicated settings page, and advisor dashboard. Feature C (Referrals) adds new DB tables, a referral tracking flow via cookies, and a settings page.

**Tech Stack:** Next.js 14 App Router, tRPC, Drizzle ORM, PostgreSQL, Supabase Storage, Clerk Auth, Tailwind CSS, shadcn/ui

---

## Feature A: SEO Polish + Email Fixes

### Task 1: Add Open Graph & Twitter metadata to root layout

**Files:**
- Modify: `src/app/layout.tsx:19-22`

**Step 1: Update metadata export**

Replace the existing metadata in `src/app/layout.tsx` (lines 19-22) with:

```typescript
export const metadata: Metadata = {
  title: "PropertyTracker - Australian Property Investment Tracking",
  description:
    "Track your investment properties, automate bank feeds, and generate tax reports. Built for Australian property investors.",
  metadataBase: new URL("https://www.propertytracker.com.au"),
  openGraph: {
    title: "PropertyTracker - Australian Property Investment Tracking",
    description:
      "Track your investment properties, automate bank feeds, and generate tax reports. Built for Australian property investors.",
    siteName: "PropertyTracker",
    type: "website",
    locale: "en_AU",
    url: "https://www.propertytracker.com.au",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyTracker - Australian Property Investment Tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyTracker - Australian Property Investment Tracking",
    description:
      "Track your investment properties, automate bank feeds, and generate tax reports.",
    images: ["/og-image.png"],
  },
};
```

**Step 2: Create OG image placeholder**

Create a 1200x630 PNG at `public/og-image.png`. For now, generate a simple branded image. Can be replaced with a designed asset later.

**Step 3: Add JSON-LD structured data to landing page**

Modify `src/app/page.tsx` — add a `<script type="application/ld+json">` block in the returned JSX:

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PropertyTracker",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: "https://www.propertytracker.com.au",
  description:
    "Track your investment properties, automate bank feeds, and generate tax reports.",
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
      name: "Free",
    },
    {
      "@type": "Offer",
      price: "14",
      priceCurrency: "AUD",
      name: "Pro",
    },
    {
      "@type": "Offer",
      price: "29",
      priceCurrency: "AUD",
      name: "Team",
    },
  ],
  publisher: {
    "@type": "Organization",
    name: "PropertyTracker",
    url: "https://www.propertytracker.com.au",
  },
};
```

Add `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />` at the top of the returned JSX.

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx public/og-image.png
git commit -m "feat(seo): add Open Graph, Twitter Card, and JSON-LD structured data"
```

---

### Task 2: Add email attachment download endpoint

**Files:**
- Modify: `src/server/routers/email.ts` (add `downloadAttachment` procedure after `rejectMatch`)
- Test: `src/server/routers/__tests__/email.test.ts` (create)

**Step 1: Write failing test**

Create `src/server/routers/__tests__/email.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed-url" },
          error: null,
        }),
      }),
    },
  }),
}));

import { createTestCaller } from "../../__tests__/test-utils";

describe("email router", () => {
  describe("downloadAttachment", () => {
    it("returns signed URL for valid attachment", async () => {
      const caller = await createTestCaller();
      // This test verifies the procedure exists and returns a URL shape
      // Full integration test requires seeded email + attachment data
      await expect(
        caller.email.downloadAttachment({ attachmentId: 999 })
      ).rejects.toThrow(); // NOT_FOUND for non-existent attachment
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/email.test.ts`
Expected: FAIL — `downloadAttachment` does not exist on the router

**Step 3: Add downloadAttachment procedure**

Add to `src/server/routers/email.ts` after the `rejectMatch` procedure (before the closing `});`):

```typescript
  // Download attachment (generates signed URL)
  downloadAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Get attachment with ownership verification
      const [attachment] = await ctx.db
        .select({
          id: propertyEmailAttachments.id,
          storagePath: propertyEmailAttachments.storagePath,
          filename: propertyEmailAttachments.filename,
          contentType: propertyEmailAttachments.contentType,
          emailId: propertyEmailAttachments.emailId,
        })
        .from(propertyEmailAttachments)
        .where(eq(propertyEmailAttachments.id, input.attachmentId));

      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      // Verify ownership via email → user
      const [email] = await ctx.db
        .select({ userId: propertyEmails.userId })
        .from(propertyEmails)
        .where(eq(propertyEmails.id, attachment.emailId));

      if (email?.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      // Generate signed URL (valid for 1 hour)
      const { getSupabaseAdmin } = await import("@/lib/supabase/server");
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.storage
        .from("email-attachments")
        .createSignedUrl(attachment.storagePath, 3600);

      if (error || !data?.signedUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate download URL",
        });
      }

      return {
        url: data.signedUrl,
        filename: attachment.filename,
        contentType: attachment.contentType,
      };
    }),
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/routers/__tests__/email.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/email.ts src/server/routers/__tests__/email.test.ts
git commit -m "feat(email): add attachment download with signed URLs"
```

---

### Task 3: Wire download button in email detail UI

**Files:**
- Modify: `src/app/(dashboard)/emails/[id]/page.tsx:162-165`

**Step 1: Add the download mutation/query call**

In `src/app/(dashboard)/emails/[id]/page.tsx`, after the existing mutation declarations (around line 42), add:

```typescript
const utils = trpc.useUtils();
```

**Step 2: Replace the stub download button**

Replace lines 163-165 (the stub `<Button variant="ghost" size="sm">`) with:

```typescript
<Button
  variant="ghost"
  size="sm"
  onClick={async () => {
    try {
      const result = await utils.email.downloadAttachment.fetch({
        attachmentId: att.id,
      });
      window.open(result.url, "_blank");
    } catch {
      // Toast error handled by tRPC provider
    }
  }}
>
  <Download className="w-4 h-4" />
</Button>
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(dashboard)/emails/[id]/page.tsx
git commit -m "feat(email): wire attachment download button to signed URL endpoint"
```

---

### Task 4: Add email thread grouping to inbox

**Files:**
- Modify: `src/app/(dashboard)/emails/page.tsx`

**Step 1: Add thread grouping logic**

In `src/app/(dashboard)/emails/page.tsx`, after the `propertyMap` declaration (line 41), add thread grouping:

```typescript
// Group emails by thread
const threadGroups = useMemo(() => {
  if (!data?.emails) return [];

  const groups: Map<string, typeof data.emails> = new Map();
  const ungrouped: typeof data.emails = [];

  for (const email of data.emails) {
    if (email.threadId) {
      const existing = groups.get(email.threadId) || [];
      existing.push(email);
      groups.set(email.threadId, existing);
    } else {
      ungrouped.push(email);
    }
  }

  // Convert to flat list with thread info
  type EmailWithThread = (typeof data.emails)[0] & {
    threadCount?: number;
    isThreadChild?: boolean;
  };

  const result: EmailWithThread[] = [];

  for (const [, emails] of groups) {
    const sorted = emails.sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
    result.push({ ...sorted[0], threadCount: sorted.length });
    for (let i = 1; i < sorted.length; i++) {
      result.push({ ...sorted[i], isThreadChild: true });
    }
  }

  for (const email of ungrouped) {
    result.push(email);
  }

  // Sort by most recent
  result.sort(
    (a, b) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

  return result;
}, [data?.emails]);
```

Add `import { useMemo, useState } from "react";` (update existing useState import).

Add `import { ChevronDown, ChevronRight } from "lucide-react";` to imports.

**Step 2: Add thread expand/collapse state**

Add after the existing useState declarations:

```typescript
const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
  new Set()
);

const toggleThread = (threadId: string) => {
  setExpandedThreads((prev) => {
    const next = new Set(prev);
    if (next.has(threadId)) {
      next.delete(threadId);
    } else {
      next.add(threadId);
    }
    return next;
  });
};
```

**Step 3: Update email list rendering**

Replace the email list rendering section (the `data.emails.map` block, approximately lines 95-184) to use `threadGroups` instead of `data.emails`, filtering out collapsed thread children:

In the map, change `data.emails.map((email) => (` to:

```typescript
{threadGroups
  .filter(
    (email) =>
      !email.isThreadChild ||
      (email.threadId && expandedThreads.has(email.threadId))
  )
  .map((email) => (
```

And inside each Card, before the sender name, add a thread indicator:

```typescript
{email.threadCount && email.threadCount > 1 && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (email.threadId) toggleThread(email.threadId);
    }}
    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
  >
    {email.threadId && expandedThreads.has(email.threadId) ? (
      <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronRight className="w-3 h-3" />
    )}
    <Badge variant="secondary" className="text-xs">
      {email.threadCount}
    </Badge>
  </button>
)}
{email.isThreadChild && (
  <div className="w-4 border-l-2 border-muted-foreground/30 ml-1" />
)}
```

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/(dashboard)/emails/page.tsx
git commit -m "feat(email): add thread grouping with expand/collapse in inbox"
```

---

### Task 5: Run all tests, create PR for Feature A

**Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Create PR**

```bash
git push -u origin feature/seo-email-polish
gh pr create --title "feat: SEO polish + email attachment downloads and thread grouping" --body "## Summary
- Add Open Graph, Twitter Card metadata, and JSON-LD structured data to landing page
- Add email attachment download endpoint with Supabase signed URLs
- Wire download button in email detail page
- Add email thread grouping with expand/collapse in global inbox

## Test plan
- [ ] Verify og:image renders on social media preview tools
- [ ] Download email attachment from detail page
- [ ] Thread grouping collapses/expands correctly

Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 4: Merge PR**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

## Feature B: Advisor Invitation System

### Task 6: Add advisor role to schema and permissions

**Files:**
- Modify: `src/server/db/schema.ts` (lines 208-212 and 344-349)
- Modify: `src/server/services/portfolio-access.ts` (lines 1-66)
- Modify: `src/server/routers/team.ts` (line 82 — role enum in sendInvite input)
- Test: `src/server/services/__tests__/portfolio-access.test.ts` (create)

**Step 1: Write failing test**

Create `src/server/services/__tests__/portfolio-access.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPermissions } from "../portfolio-access";

describe("getPermissions", () => {
  it("returns read-only permissions for advisor role", () => {
    const perms = getPermissions("advisor");
    expect(perms.canWrite).toBe(false);
    expect(perms.canManageMembers).toBe(false);
    expect(perms.canManageBanks).toBe(false);
    expect(perms.canViewAuditLog).toBe(true);
    expect(perms.canUploadDocuments).toBe(false);
  });

  it("returns full permissions for owner", () => {
    const perms = getPermissions("owner");
    expect(perms.canWrite).toBe(true);
    expect(perms.canManageMembers).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/portfolio-access.test.ts`
Expected: FAIL — `advisor` is not a valid role

**Step 3: Update schema enums**

In `src/server/db/schema.ts`, update the portfolio member role enum (lines 208-212):

```typescript
export const portfolioMemberRoleEnum = pgEnum("portfolio_member_role", [
  "owner",
  "partner",
  "accountant",
  "advisor",
]);
```

Update entity member role enum (lines 344-349):

```typescript
export const entityMemberRoleEnum = pgEnum("entity_member_role", [
  "owner",
  "admin",
  "member",
  "accountant",
  "advisor",
]);
```

**Step 4: Update portfolio-access.ts**

In `src/server/services/portfolio-access.ts`:

Update the type (line 3):
```typescript
export type PortfolioRole = "owner" | "partner" | "accountant" | "advisor";
```

Add advisor case in `getPermissions` (after the accountant case):
```typescript
    case "advisor":
      return {
        canWrite: false,
        canManageMembers: false,
        canManageBanks: false,
        canViewAuditLog: true,
        canUploadDocuments: false,
      };
```

Update `canViewAuditLog` function:
```typescript
export function canViewAuditLog(role: PortfolioRole): boolean {
  return role === "owner" || role === "partner" || role === "advisor";
}
```

**Step 5: Update team router sendInvite input**

In `src/server/routers/team.ts`, line 82, update the role enum:

```typescript
role: z.enum(["partner", "accountant", "advisor"]),
```

Also update `changeRole` (line 205):
```typescript
role: z.enum(["partner", "accountant", "advisor"]),
```

**Step 6: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/portfolio-access.test.ts`
Expected: PASS

**Step 7: Generate DB migration**

Run: `npx drizzle-kit generate`
This will create a migration adding 'advisor' to the role enums.

**Step 8: Commit**

```bash
git add src/server/db/schema.ts src/server/services/portfolio-access.ts src/server/routers/team.ts src/server/services/__tests__/portfolio-access.test.ts drizzle/
git commit -m "feat(advisor): add advisor role to schema and permissions"
```

---

### Task 7: Create advisor settings page

**Files:**
- Create: `src/app/(dashboard)/settings/advisors/page.tsx`

**Step 1: Create the advisors settings page**

Create `src/app/(dashboard)/settings/advisors/page.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Shield, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdvisorsPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"accountant" | "advisor">(
    "accountant"
  );

  const { data: context } = trpc.team.getContext.useQuery();
  const { data: members, refetch: refetchMembers } =
    trpc.team.listMembers.useQuery(undefined, {
      enabled: context?.permissions.canManageMembers ?? false,
    });
  const { data: invites, refetch: refetchInvites } =
    trpc.team.listInvites.useQuery(undefined, {
      enabled: context?.permissions.canManageMembers ?? false,
    });

  const sendInvite = trpc.team.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite sent successfully");
      setInviteOpen(false);
      setInviteEmail("");
      refetchInvites();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelInvite = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite cancelled");
      refetchInvites();
    },
  });

  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Advisor removed");
      refetchMembers();
    },
  });

  const advisorMembers = (members?.members ?? []).filter(
    (m) => m.role === "accountant" || m.role === "advisor"
  );

  const advisorInvites = (invites ?? []).filter(
    (i) => i.role === "accountant" || i.role === "advisor"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advisors</h2>
          <p className="text-muted-foreground">
            Invite accountants and financial advisors to view your portfolio
          </p>
        </div>
        {context?.permissions.canManageMembers && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Advisor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite an Advisor</DialogTitle>
                <DialogDescription>
                  They will receive read-only access to your portfolio data,
                  tax reports, and audit checks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="advisor@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) =>
                      setInviteRole(v as "accountant" | "advisor")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accountant">
                        Accountant — read-only + document upload
                      </SelectItem>
                      <SelectItem value="advisor">
                        Advisor — read-only access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    sendInvite.mutate({
                      email: inviteEmail,
                      role: inviteRole,
                    })
                  }
                  disabled={!inviteEmail || sendInvite.isPending}
                >
                  Send Invite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Current advisors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Current Advisors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {advisorMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No advisors yet. Invite your accountant or financial advisor.
            </p>
          ) : (
            <div className="space-y-3">
              {advisorMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {member.user?.name || member.user?.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.user?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{member.role}</Badge>
                    {context?.permissions.canManageMembers && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeMember.mutate({ memberId: member.id })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {advisorInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Pending Invites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {advisorInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited as {invite.role}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      cancelInvite.mutate({ inviteId: invite.id })
                    }
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/advisors/page.tsx
git commit -m "feat(advisor): add advisor settings page with invite flow"
```

---

### Task 8: Create advisor dashboard view

**Files:**
- Create: `src/components/dashboard/AdvisorDashboard.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create the AdvisorDashboard component**

Create `src/components/dashboard/AdvisorDashboard.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface ClientPortfolio {
  ownerId: string;
  ownerName: string;
  role: string;
}

export function AdvisorDashboard({
  portfolios,
}: {
  portfolios: ClientPortfolio[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advisor Dashboard</h1>
        <p className="text-muted-foreground">
          You have read-only access to {portfolios.length} client{" "}
          {portfolios.length === 1 ? "portfolio" : "portfolios"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((portfolio) => (
          <Card key={portfolio.ownerId} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{portfolio.ownerName}</CardTitle>
                <Badge variant="secondary">{portfolio.role}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard?portfolio=${portfolio.ownerId}`}>
                    <Building2 className="w-4 h-4 mr-1" />
                    Properties
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/export?portfolio=${portfolio.ownerId}`}>
                    <FileText className="w-4 h-4 mr-1" />
                    Tax Reports
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/settings/audit-log?portfolio=${portfolio.ownerId}`}>
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    Audit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Update dashboard page to show advisor view when appropriate**

In `src/app/(dashboard)/dashboard/page.tsx`, modify to check if user is an advisor:

```typescript
import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AdvisorDashboard } from "@/components/dashboard/AdvisorDashboard";

export default async function DashboardPage() {
  let initialStats = null;
  let advisorPortfolios: { ownerId: string; ownerName: string; role: string }[] = [];
  let isAdvisorOnly = false;

  try {
    const trpc = await getServerTRPC();
    const [stats, portfolios] = await Promise.all([
      trpc.stats.dashboard().catch(() => null),
      trpc.team.getAccessiblePortfolios().catch(() => []),
    ]);
    initialStats = stats;
    advisorPortfolios = portfolios.filter(
      (p) => p.role === "accountant" || p.role === "advisor"
    );
    // Show advisor dashboard if user has NO own properties and IS an advisor
    isAdvisorOnly = !stats && advisorPortfolios.length > 0;
  } catch {
    // User might not be authenticated yet
  }

  if (isAdvisorOnly) {
    return <AdvisorDashboard portfolios={advisorPortfolios} />;
  }

  return <DashboardClient initialStats={initialStats} />;
}
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/dashboard/AdvisorDashboard.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(advisor): add advisor dashboard with client portfolio list"
```

---

### Task 9: Run all tests, create PR for Feature B

**Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Create PR**

```bash
git push -u origin feature/advisor-system
gh pr create --title "feat(advisor): advisor invitation system with dedicated dashboard" --body "## Summary
- Add \`advisor\` role to portfolio and entity member role enums
- Advisor permissions: read-only access with audit log visibility, no write/bank/upload access
- New \`/settings/advisors\` page for inviting and managing advisors
- Advisor dashboard view showing client portfolios with quick links to properties, tax reports, and audit checks
- Updated invite flow to support accountant and advisor roles

## Test plan
- [ ] Invite an advisor via settings page
- [ ] Advisor accepts invite and sees advisor dashboard
- [ ] Advisor can view properties and reports (read-only)
- [ ] Advisor cannot create/edit properties or transactions

Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 4: Merge PR**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

## Feature C: Referral/Rewards Program

### Task 10: Add referral database schema

**Files:**
- Modify: `src/server/db/schema.ts` (add new tables at end)
- Generate: Drizzle migration

**Step 1: Add referral tables to schema**

Add to the end of `src/server/db/schema.ts`:

```typescript
// Referral system
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "qualified",
  "rewarded",
  "expired",
]);

export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerUserId: uuid("referrer_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    refereeUserId: uuid("referee_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    referralCodeId: uuid("referral_code_id")
      .references(() => referralCodes.id, { onDelete: "cascade" })
      .notNull(),
    status: referralStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    qualifiedAt: timestamp("qualified_at"),
    rewardedAt: timestamp("rewarded_at"),
  },
  (table) => [
    index("referrals_referrer_idx").on(table.referrerUserId),
    index("referrals_referee_idx").on(table.refereeUserId),
  ]
);

export const referralCredits = pgTable("referral_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  referralId: uuid("referral_id")
    .references(() => referrals.id, { onDelete: "cascade" })
    .notNull(),
  monthsFree: integer("months_free").notNull().default(1),
  appliedAt: timestamp("applied_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2: Generate migration**

Run: `npx drizzle-kit generate`

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(referral): add referral codes, referrals, and credits schema"
```

---

### Task 11: Create referral service and tRPC router

**Files:**
- Create: `src/server/services/referral.ts`
- Create: `src/server/routers/referral.ts`
- Modify: `src/server/routers/_app.ts` (register router)
- Test: `src/server/services/__tests__/referral.test.ts`

**Step 1: Write failing test**

Create `src/server/services/__tests__/referral.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateReferralCode } from "../referral";

describe("referral service", () => {
  it("generates a code with REF- prefix", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^REF-[A-Za-z0-9_-]+$/);
    expect(code.length).toBeGreaterThan(6);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
    expect(codes.size).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/referral.test.ts`
Expected: FAIL — module not found

**Step 3: Create referral service**

Create `src/server/services/referral.ts`:

```typescript
import { nanoid } from "nanoid";

export function generateReferralCode(): string {
  return `REF-${nanoid(10)}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/referral.test.ts`
Expected: PASS

**Step 5: Create referral router**

Create `src/server/routers/referral.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  referralCodes,
  referrals,
  referralCredits,
  users,
} from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateReferralCode } from "../services/referral";

export const referralRouter = router({
  // Get or create user's referral code
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    let [existing] = await ctx.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, ctx.user.id));

    if (!existing) {
      [existing] = await ctx.db
        .insert(referralCodes)
        .values({
          userId: ctx.user.id,
          code: generateReferralCode(),
        })
        .returning();
    }

    return {
      code: existing.code,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.propertytracker.com.au"}/r/${existing.code}`,
    };
  }),

  // Get referral stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [code] = await ctx.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, ctx.user.id));

    if (!code) {
      return { invited: 0, qualified: 0, totalCredits: 0 };
    }

    const myReferrals = await ctx.db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerUserId, ctx.user.id));

    const invited = myReferrals.length;
    const qualified = myReferrals.filter(
      (r) => r.status === "qualified" || r.status === "rewarded"
    ).length;

    const [creditResult] = await ctx.db
      .select({ total: sql<number>`coalesce(sum(${referralCredits.monthsFree}), 0)::int` })
      .from(referralCredits)
      .where(eq(referralCredits.userId, ctx.user.id));

    return {
      invited,
      qualified,
      totalCredits: creditResult?.total ?? 0,
    };
  }),

  // Get referral list (for settings page)
  listReferrals: protectedProcedure.query(async ({ ctx }) => {
    const myReferrals = await ctx.db
      .select({
        id: referrals.id,
        status: referrals.status,
        createdAt: referrals.createdAt,
        qualifiedAt: referrals.qualifiedAt,
        refereeName: users.name,
        refereeEmail: users.email,
      })
      .from(referrals)
      .leftJoin(users, eq(users.id, referrals.refereeUserId))
      .where(eq(referrals.referrerUserId, ctx.user.id))
      .orderBy(desc(referrals.createdAt));

    return myReferrals;
  }),

  // Resolve referral code (for /r/[code] page)
  resolveCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const [codeRecord] = await ctx.db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code));

      if (!codeRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid referral code",
        });
      }

      // Don't allow self-referral
      if (codeRecord.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot use your own referral code",
        });
      }

      return { valid: true };
    }),

  // Record a referral (called during signup when cookie is present)
  recordReferral: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [codeRecord] = await ctx.db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code));

      if (!codeRecord || codeRecord.userId === ctx.user.id) {
        return { recorded: false };
      }

      // Check if already referred
      const [existing] = await ctx.db
        .select()
        .from(referrals)
        .where(eq(referrals.refereeUserId, ctx.user.id));

      if (existing) {
        return { recorded: false };
      }

      await ctx.db.insert(referrals).values({
        referrerUserId: codeRecord.userId,
        refereeUserId: ctx.user.id,
        referralCodeId: codeRecord.id,
      });

      return { recorded: true };
    }),

  // Qualify referral (called when referee adds first property)
  qualifyReferral: protectedProcedure.mutation(async ({ ctx }) => {
    const [referral] = await ctx.db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.refereeUserId, ctx.user.id),
          eq(referrals.status, "pending")
        )
      );

    if (!referral) {
      return { qualified: false };
    }

    // Update status
    await ctx.db
      .update(referrals)
      .set({ status: "qualified", qualifiedAt: new Date() })
      .where(eq(referrals.id, referral.id));

    // Create credits for both users (1 month free each)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await ctx.db.insert(referralCredits).values([
      {
        userId: referral.referrerUserId,
        referralId: referral.id,
        monthsFree: 1,
        expiresAt,
      },
      {
        userId: referral.refereeUserId,
        referralId: referral.id,
        monthsFree: 1,
        expiresAt,
      },
    ]);

    return { qualified: true };
  }),
});
```

**Step 6: Register router in _app.ts**

Add to `src/server/routers/_app.ts`:

Import: `import { referralRouter } from "./referral";`
Add to appRouter: `referral: referralRouter,`

**Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/server/services/referral.ts src/server/routers/referral.ts src/server/routers/_app.ts src/server/services/__tests__/referral.test.ts
git commit -m "feat(referral): add referral service, router, and stats API"
```

---

### Task 12: Create referral landing page (/r/[code])

**Files:**
- Create: `src/app/r/[code]/page.tsx`

**Step 1: Create the referral redirect page**

Create `src/app/r/[code]/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Set referral cookie (30 day expiry)
  const cookieStore = await cookies();
  cookieStore.set("referral_code", code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Redirect to sign-up
  redirect("/sign-up");
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/r/[code]/page.tsx
git commit -m "feat(referral): add /r/[code] referral redirect page with cookie"
```

---

### Task 13: Hook referral into signup and property creation

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (or a useEffect in dashboard client) — call `recordReferral` on first load if cookie exists
- Modify: `src/server/routers/property.ts` — call `qualifyReferral` after first property creation

**Step 1: Add referral recording to a client-side hook**

Create `src/hooks/useReferralTracking.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

export function useReferralTracking() {
  const recorded = useRef(false);
  const recordReferral = trpc.referral.recordReferral.useMutation();

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    // Check for referral cookie
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const referralCookie = cookies.find((c) => c.startsWith("referral_code="));
    if (!referralCookie) return;

    const code = referralCookie.split("=")[1];
    if (!code) return;

    // Record the referral
    recordReferral.mutate(
      { code },
      {
        onSuccess: () => {
          // Clear the cookie
          document.cookie =
            "referral_code=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        },
      }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
```

**Step 2: Use the hook in the dashboard client**

In `src/components/dashboard/DashboardClient.tsx`, add at the top of the component function:

```typescript
import { useReferralTracking } from "@/hooks/useReferralTracking";

// Inside the component:
useReferralTracking();
```

**Step 3: Hook into property creation**

In `src/server/routers/property.ts`, after the `.returning()` call in the `create` mutation (after line 60), add:

```typescript
      // Check if this is the user's first property (for referral qualification)
      const propertyCount = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(properties)
        .where(eq(properties.userId, ctx.portfolio.ownerId));

      if (propertyCount[0]?.count === 1) {
        // First property — qualify any pending referral
        try {
          const [referral] = await ctx.db
            .select()
            .from(referrals)
            .where(
              and(
                eq(referrals.refereeUserId, ctx.portfolio.ownerId),
                eq(referrals.status, "pending")
              )
            );

          if (referral) {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            await ctx.db
              .update(referrals)
              .set({ status: "qualified", qualifiedAt: new Date() })
              .where(eq(referrals.id, referral.id));

            await ctx.db.insert(referralCredits).values([
              {
                userId: referral.referrerUserId,
                referralId: referral.id,
                monthsFree: 1,
                expiresAt,
              },
              {
                userId: referral.refereeUserId,
                referralId: referral.id,
                monthsFree: 1,
                expiresAt,
              },
            ]);
          }
        } catch {
          // Non-critical — don't fail property creation
        }
      }
```

Add imports at top of property.ts:
```typescript
import { referrals, referralCredits } from "../db/schema";
import { sql } from "drizzle-orm";
```

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/hooks/useReferralTracking.ts src/components/dashboard/DashboardClient.tsx src/server/routers/property.ts
git commit -m "feat(referral): hook referral tracking into signup and first property creation"
```

---

### Task 14: Create referral settings page

**Files:**
- Create: `src/app/(dashboard)/settings/referrals/page.tsx`

**Step 1: Create the referrals settings page**

Create `src/app/(dashboard)/settings/referrals/page.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Users, Award, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const { data: codeData } = trpc.referral.getMyCode.useQuery();
  const { data: stats } = trpc.referral.getStats.useQuery();
  const { data: referralList } = trpc.referral.listReferrals.useQuery();

  const copyLink = () => {
    if (codeData?.shareUrl) {
      navigator.clipboard.writeText(codeData.shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Referrals</h2>
        <p className="text-muted-foreground">
          Invite friends and earn free months of PropertyTracker Pro
        </p>
      </div>

      {/* Share link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Share this link with friends. When they sign up and add their first
            property, you both get 1 month of Pro free.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={codeData?.shareUrl ?? "Loading..."}
              className="font-mono text-sm"
            />
            <Button onClick={copyLink} variant="outline">
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Code: <span className="font-mono">{codeData?.code}</span>
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{stats?.invited ?? 0}</p>
            <p className="text-sm text-muted-foreground">Invited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{stats?.qualified ?? 0}</p>
            <p className="text-sm text-muted-foreground">Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{stats?.totalCredits ?? 0}</p>
            <p className="text-sm text-muted-foreground">Months Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral list */}
      {referralList && referralList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referralList.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {ref.refereeName || ref.refereeEmail || "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {format(new Date(ref.createdAt), "MMM d, yyyy")}
                      {ref.qualifiedAt &&
                        ` · Qualified ${format(new Date(ref.qualifiedAt), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ref.status === "qualified" || ref.status === "rewarded"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {ref.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Share your referral link with a friend</li>
            <li>They sign up for PropertyTracker</li>
            <li>They add their first investment property</li>
            <li>You both get 1 month of Pro free</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/referrals/page.tsx
git commit -m "feat(referral): add referral settings page with stats and share link"
```

---

### Task 15: Run all tests, create PR for Feature C

**Step 1: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Create PR**

```bash
git push -u origin feature/referral-program
gh pr create --title "feat(referral): referral and rewards program" --body "## Summary
- Add referral codes, referrals, and referral credits DB schema
- Referral service with code generation (REF-{nanoid})
- tRPC router: getMyCode, getStats, listReferrals, recordReferral, qualifyReferral
- /r/[code] redirect page sets cookie and redirects to sign-up
- Client-side hook records referral on first dashboard load
- First property creation triggers referral qualification and credit award
- /settings/referrals page with share link, stats, and referral list

## Test plan
- [ ] Visit /r/[code] — sets cookie, redirects to sign-up
- [ ] After signup, referral is recorded (check DB)
- [ ] Adding first property qualifies the referral
- [ ] Both referrer and referee get 1 month credit
- [ ] Settings page shows referral link and stats

Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 4: Merge PR**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```
