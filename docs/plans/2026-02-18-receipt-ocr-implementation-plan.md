# Receipt OCR Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a streamlined receipt scanning UX with mobile camera capture, a dedicated receipts page, free-tier plan gating (5/month), and upgrade the extraction model to Claude Sonnet 4.5.

**Architecture:** Enhances the existing document extraction pipeline (upload → Claude Vision → draft transaction → review). No schema changes — existing `documents` and `documentExtractions` tables cover everything. New UI surfaces the existing backend through a `ReceiptScanner` dialog and `/receipts` history page.

**Tech Stack:** Next.js 16, React 19, tRPC v11, Drizzle ORM v0.45, Anthropic SDK (`@anthropic-ai/sdk`), Supabase Storage, Tailwind v4, Zod v4, Vitest

**Design Doc:** `docs/plans/2026-02-18-receipt-ocr-design.md`

---

## Tech Notes (Context7 Validation)

- **Anthropic Vision API:** `messages.create()` with `type: "image"` content block. Source: `{ type: "base64", media_type: "image/jpeg", data: "..." }`. Model string: `"claude-sonnet-4-5-20250929"`. Max tokens configurable. Response: `content[0].text`.
- **Supabase Storage:** `createSignedUploadUrl(path)` returns `{ signedUrl, token }`. `download(path)` returns `{ data: Blob }`. Bucket: `"documents"`.
- **tRPC v11:** `writeProcedure` for mutations (checks `canWrite`), `protectedProcedure` for reads. Access repos via `ctx.uow.document.*`.
- **Plan Limits:** `PLAN_LIMITS` in `src/server/services/billing/subscription.ts`. Pattern: query subscription, call `getPlanFromSubscription()`, check limit. Throw `FORBIDDEN` when exceeded.
- **Existing Upload Flow:** `documents.getUploadUrl` → client uploads to signed URL → `documents.create` → auto-triggers extraction for JPEG/PNG/PDF.

---

## Task 1: Add `getMonthlyExtractionCount` to Document Repository

**Files:**
- Modify: `src/server/repositories/interfaces/document.repository.interface.ts`
- Modify: `src/server/repositories/document.repository.ts`
- Test: `src/server/repositories/__tests__/document-extraction-count.test.ts`

**Step 1: Write the failing test**

Create `src/server/repositories/__tests__/document-extraction-count.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentRepository } from "../document.repository";

// Mock drizzle
const mockDb = {
  select: vi.fn(),
};

describe("DocumentRepository.getMonthlyExtractionCount", () => {
  let repo: DocumentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DocumentRepository(mockDb as any);
  });

  it("returns count of extractions for current month", async () => {
    const mockFrom = vi.fn().mockReturnThis();
    const mockInnerJoin = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([{ count: 3 }]);

    mockDb.select.mockReturnValue({
      from: mockFrom,
      innerJoin: mockInnerJoin,
    });
    mockInnerJoin.mockReturnValue({ where: mockWhere });

    const count = await repo.getMonthlyExtractionCount("user-1");
    expect(count).toBe(3);
  });

  it("returns 0 when no extractions exist", async () => {
    const mockFrom = vi.fn().mockReturnThis();
    const mockInnerJoin = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);

    mockDb.select.mockReturnValue({
      from: mockFrom,
      innerJoin: mockInnerJoin,
    });
    mockInnerJoin.mockReturnValue({ where: mockWhere });

    const count = await repo.getMonthlyExtractionCount("user-1");
    expect(count).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/repositories/__tests__/document-extraction-count.test.ts`
Expected: FAIL — `getMonthlyExtractionCount` is not a function

**Step 3: Add method to interface**

In `src/server/repositories/interfaces/document.repository.interface.ts`, add to the `IDocumentRepository` interface:

```typescript
/** Count extractions created this calendar month for a user */
getMonthlyExtractionCount(userId: string): Promise<number>;
```

**Step 4: Implement the method**

In `src/server/repositories/document.repository.ts`, add the import and method:

Add to imports:
```typescript
import { eq, and, gte, sql } from "drizzle-orm";
import { documents, documentExtractions } from "../db/schema";
```

Add method to `DocumentRepository` class:

```typescript
async getMonthlyExtractionCount(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [result] = await this.db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentExtractions)
    .innerJoin(documents, eq(documentExtractions.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        gte(documentExtractions.createdAt, startOfMonth)
      )
    );

  return result?.count ?? 0;
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/server/repositories/__tests__/document-extraction-count.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/repositories/interfaces/document.repository.interface.ts \
  src/server/repositories/document.repository.ts \
  src/server/repositories/__tests__/document-extraction-count.test.ts
git commit -m "feat: add getMonthlyExtractionCount to document repository"
```

---

## Task 2: Add Plan Gating to `extract` Procedure + Remaining Count Query

**Files:**
- Modify: `src/server/routers/documents/documentExtraction.ts`
- Modify: `src/server/services/billing/subscription.ts` (add `maxReceiptScans` to `PLAN_LIMITS`)
- Test: `src/server/routers/documents/__tests__/documentExtraction-gating.test.ts`

**Step 1: Add `maxReceiptScans` to PLAN_LIMITS**

In `src/server/services/billing/subscription.ts`, add `maxReceiptScans` to each plan:

```typescript
export const PLAN_LIMITS = {
  free: {
    maxProperties: 1,
    maxReceiptScans: 5,  // 5 per month
    bankFeeds: false,
    // ... rest unchanged
  },
  pro: {
    maxProperties: Infinity,
    maxReceiptScans: Infinity,
    // ... rest unchanged
  },
  team: {
    maxProperties: Infinity,
    maxReceiptScans: Infinity,
    // ... rest unchanged
  },
  lifetime: {
    maxProperties: Infinity,
    maxReceiptScans: Infinity,
    // ... rest unchanged
  },
} as const;
```

**Step 2: Write the failing tests**

Create `src/server/routers/documents/__tests__/documentExtraction-gating.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

let currentMockUow: UnitOfWork;

vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

// Mock the extraction service (we don't want real API calls)
vi.mock("../../../services/property-analysis", () => ({
  extractDocument: vi.fn(),
  matchPropertyByAddress: vi.fn(),
}));

function createAuthCtxWithUow(uow: UnitOfWork, plan = "free") {
  currentMockUow = uow;
  const ctx = createMockContext({
    userId: mockUser.id,
    user: mockUser,
    uow,
  });
  // Mock subscription query for plan gating
  ctx.db = {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
      subscriptions: {
        findFirst: vi.fn().mockResolvedValue(
          plan === "free" ? null : { plan, status: "active", currentPeriodEnd: new Date("2027-01-01") }
        ),
      },
    },
  } as ReturnType<typeof createMockContext>["db"];
  return ctx;
}

const mockDocument = {
  id: "doc-1",
  userId: "user-1",
  storagePath: "user-1/prop-1/receipt.jpg",
  fileType: "image/jpeg",
  fileName: "receipt.jpg",
};

describe("documentExtraction plan gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws FORBIDDEN when free user exceeds monthly limit", async () => {
    const uow = createMockUow({
      document: {
        findById: vi.fn().mockResolvedValue(mockDocument),
        findExtractionByDocumentId: vi.fn().mockResolvedValue(null),
        getMonthlyExtractionCount: vi.fn().mockResolvedValue(5), // at limit
      },
    });
    const ctx = createAuthCtxWithUow(uow, "free");
    const caller = createTestCaller(ctx);

    await expect(
      caller.documentExtraction.extract({ documentId: "doc-1" })
    ).rejects.toThrow(TRPCError);
    await expect(
      caller.documentExtraction.extract({ documentId: "doc-1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows extraction when free user is under limit", async () => {
    const mockExtraction = { id: "ext-1", documentId: "doc-1", status: "processing" };
    const uow = createMockUow({
      document: {
        findById: vi.fn().mockResolvedValue(mockDocument),
        findExtractionByDocumentId: vi.fn().mockResolvedValue(null),
        getMonthlyExtractionCount: vi.fn().mockResolvedValue(3), // under limit
        createExtraction: vi.fn().mockResolvedValue(mockExtraction),
      },
    });
    const ctx = createAuthCtxWithUow(uow, "free");
    const caller = createTestCaller(ctx);

    const result = await caller.documentExtraction.extract({ documentId: "doc-1" });
    expect(result.id).toBe("ext-1");
  });

  it("allows extraction for pro user regardless of count", async () => {
    const mockExtraction = { id: "ext-1", documentId: "doc-1", status: "processing" };
    const uow = createMockUow({
      document: {
        findById: vi.fn().mockResolvedValue(mockDocument),
        findExtractionByDocumentId: vi.fn().mockResolvedValue(null),
        getMonthlyExtractionCount: vi.fn().mockResolvedValue(100), // high count
        createExtraction: vi.fn().mockResolvedValue(mockExtraction),
      },
    });
    const ctx = createAuthCtxWithUow(uow, "pro");
    const caller = createTestCaller(ctx);

    const result = await caller.documentExtraction.extract({ documentId: "doc-1" });
    expect(result.id).toBe("ext-1");
  });

  describe("getRemainingScans", () => {
    it("returns remaining count for free user", async () => {
      const uow = createMockUow({
        document: {
          getMonthlyExtractionCount: vi.fn().mockResolvedValue(2),
        },
      });
      const ctx = createAuthCtxWithUow(uow, "free");
      const caller = createTestCaller(ctx);

      const result = await caller.documentExtraction.getRemainingScans();
      expect(result).toEqual({ used: 2, limit: 5, remaining: 3 });
    });

    it("returns unlimited for pro user", async () => {
      const uow = createMockUow({
        document: {
          getMonthlyExtractionCount: vi.fn().mockResolvedValue(50),
        },
      });
      const ctx = createAuthCtxWithUow(uow, "pro");
      const caller = createTestCaller(ctx);

      const result = await caller.documentExtraction.getRemainingScans();
      expect(result).toEqual({ used: 50, limit: null, remaining: null });
    });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/server/routers/documents/__tests__/documentExtraction-gating.test.ts`
Expected: FAIL — `getRemainingScans` doesn't exist, no plan gating in `extract`

**Step 4: Implement plan gating in extract procedure**

In `src/server/routers/documents/documentExtraction.ts`, add imports:

```typescript
import { subscriptions } from "../../db/schema";
import { getPlanFromSubscription, PLAN_LIMITS } from "../../services/billing/subscription";
```

Add a helper function at the top of the file (after imports):

```typescript
async function getUserPlan(db: typeof import("../../db").db, ownerId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, ownerId),
  });
  return getPlanFromSubscription(
    sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
  );
}
```

In the `extract` mutation, after the existing extraction check (`if (existing) { return existing; }`), add:

```typescript
// Plan gating: check monthly extraction limit
const currentPlan = await getUserPlan(ctx.db, ctx.portfolio.ownerId);
const limit = PLAN_LIMITS[currentPlan].maxReceiptScans;

if (limit !== Infinity) {
  const monthlyCount = await ctx.uow.document.getMonthlyExtractionCount(ctx.portfolio.ownerId);
  if (monthlyCount >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've used all ${limit} receipt scans this month. Upgrade to Pro for unlimited scans.`,
    });
  }
}
```

Add a new `getRemainingScans` query to the router:

```typescript
getRemainingScans: protectedProcedure.query(async ({ ctx }) => {
  const currentPlan = await getUserPlan(ctx.db, ctx.portfolio.ownerId);
  const limit = PLAN_LIMITS[currentPlan].maxReceiptScans;
  const used = await ctx.uow.document.getMonthlyExtractionCount(ctx.portfolio.ownerId);

  if (limit === Infinity) {
    return { used, limit: null, remaining: null };
  }

  return { used, limit, remaining: Math.max(0, limit - used) };
}),
```

**Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/server/routers/documents/__tests__/documentExtraction-gating.test.ts`
Expected: PASS

**Step 6: Run full test suite to check for regressions**

Run: `pnpm vitest run src/server/routers/documents/`
Expected: All existing tests still pass

**Step 7: Commit**

```bash
git add src/server/services/billing/subscription.ts \
  src/server/routers/documents/documentExtraction.ts \
  src/server/routers/documents/__tests__/documentExtraction-gating.test.ts
git commit -m "feat: add plan gating for receipt scans (5/month free)"
```

---

## Task 3: Upgrade Extraction Model to Claude Sonnet 4.5

**Files:**
- Modify: `src/server/services/property-analysis/document-extraction.ts`

**Step 1: Change the model string**

In `src/server/services/property-analysis/document-extraction.ts`, find both occurrences of `"claude-3-haiku-20240307"` in the `extractDocument` function (lines 181 and 203) and replace with `"claude-sonnet-4-5-20250929"`.

**Step 2: Verify types still compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/property-analysis/document-extraction.ts
git commit -m "feat: upgrade extraction model to claude-sonnet-4-5"
```

---

## Task 4: Create ReceiptScanner Component

**Files:**
- Create: `src/components/documents/ReceiptScanner.tsx`
- Test: `src/components/documents/__tests__/ReceiptScanner.test.tsx`

**Step 1: Write the failing tests**

Create `src/components/documents/__tests__/ReceiptScanner.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReceiptScanner } from "../ReceiptScanner";

// Mock tRPC
vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    documentExtraction: {
      getRemainingScans: {
        useQuery: vi.fn().mockReturnValue({
          data: { used: 2, limit: 5, remaining: 3 },
        }),
      },
      listPendingReviews: {
        useQuery: vi.fn().mockReturnValue({ data: [] }),
      },
    },
    document: {
      getUploadUrl: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
      create: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: vi.fn().mockReturnValue({
      documentExtraction: {
        listPendingReviews: { invalidate: vi.fn() },
        getRemainingScans: { invalidate: vi.fn() },
      },
    }),
  },
}));

// Mock sonner
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("ReceiptScanner", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it("renders dialog when open", () => {
    render(<ReceiptScanner {...defaultProps} />);
    expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
  });

  it("shows remaining scan count for free tier", () => {
    render(<ReceiptScanner {...defaultProps} />);
    expect(screen.getByText(/3 scans remaining/i)).toBeInTheDocument();
  });

  it("shows file input with camera capture", () => {
    render(<ReceiptScanner {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/heic,application/pdf");
  });

  it("renders nothing when closed", () => {
    render(<ReceiptScanner {...defaultProps} open={false} />);
    expect(screen.queryByText("Scan Receipt")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when dialog closes", () => {
    const onOpenChange = vi.fn();
    render(<ReceiptScanner {...defaultProps} onOpenChange={onOpenChange} />);
    // Dialog close button
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/documents/__tests__/ReceiptScanner.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement ReceiptScanner component**

Create `src/components/documents/ReceiptScanner.tsx`:

```tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Camera, Loader2, FileCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ExtractionReviewCard } from "./ExtractionReviewCard";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,application/pdf";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type ScanState = "idle" | "uploading" | "processing" | "review" | "done";

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional property ID to associate the receipt with */
  propertyId?: string;
}

export function ReceiptScanner({ open, onOpenChange, propertyId }: ReceiptScannerProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: scanQuota } = trpc.documentExtraction.getRemainingScans.useQuery(
    undefined,
    { enabled: open }
  );

  const getUploadUrl = trpc.document.getUploadUrl.useMutation();
  const createDocument = trpc.document.create.useMutation();

  const confirmMutation = trpc.documentExtraction.confirmTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction created from receipt");
      utils.documentExtraction.listPendingReviews.invalidate();
      utils.documentExtraction.getRemainingScans.invalidate();
      utils.transaction.list.invalidate();
      setScanState("done");
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 1500);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.documentExtraction.discardExtraction.useMutation({
    onSuccess: () => {
      toast.success("Receipt discarded");
      utils.documentExtraction.listPendingReviews.invalidate();
      onOpenChange(false);
      resetState();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const resetState = useCallback(() => {
    setScanState("idle");
    setUploadProgress(0);
    setExtractionId(null);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 10MB");
      return;
    }

    try {
      // Upload phase
      setScanState("uploading");
      setUploadProgress(20);

      const { signedUrl, storagePath, token } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type as "image/jpeg" | "image/png" | "image/heic" | "application/pdf",
        fileSize: file.size,
        propertyId,
      });

      setUploadProgress(40);

      // Upload to Supabase
      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setUploadProgress(60);

      // Create document record (auto-triggers extraction)
      const document = await createDocument.mutateAsync({
        storagePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        propertyId,
        category: "receipt",
      });

      setUploadProgress(80);

      // Poll for extraction completion
      setScanState("processing");
      setUploadProgress(100);

      // Poll extraction status
      await pollExtraction(document.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
      resetState();
    }
  }, [getUploadUrl, createDocument, propertyId, resetState]);

  const pollExtraction = useCallback(async (documentId: string) => {
    const maxAttempts = 30; // 30 seconds max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const extraction = await utils.documentExtraction.getExtraction.fetch({ documentId });

      if (extraction?.status === "completed") {
        setExtractionId(extraction.id);
        setScanState("review");
        utils.documentExtraction.getRemainingScans.invalidate();
        return;
      }

      if (extraction?.status === "failed") {
        toast.error("Extraction failed. The receipt may be unreadable.");
        resetState();
        return;
      }
    }

    toast.error("Extraction timed out. Check the Review page later.");
    resetState();
  }, [utils, resetState]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const { data: pendingReviews } = trpc.documentExtraction.listPendingReviews.useQuery(
    undefined,
    { enabled: scanState === "review" && !!extractionId }
  );

  const currentExtraction = pendingReviews?.find((e) => e.id === extractionId);

  const isAtLimit = scanQuota?.remaining === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Receipt</DialogTitle>
          <DialogDescription>
            Upload or photograph a receipt to automatically extract transaction details.
          </DialogDescription>
        </DialogHeader>

        {scanState === "idle" && (
          <div className="space-y-4">
            {/* Scan quota indicator */}
            {scanQuota && scanQuota.limit !== null && (
              <div className="text-sm text-muted-foreground text-center">
                {scanQuota.remaining} scans remaining this month ({scanQuota.used}/{scanQuota.limit})
              </div>
            )}

            {isAtLimit ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">
                  You&apos;ve used all {scanQuota?.limit} free scans this month.
                </p>
                <Button asChild>
                  <a href="/settings/billing">Upgrade to Pro for unlimited scans</a>
                </Button>
              </div>
            ) : (
              <>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    "hover:border-primary hover:bg-primary/5"
                  )}
                >
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop a receipt here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, HEIC, or PDF up to 10MB
                  </p>
                </div>

                {/* Hidden file input with camera capture */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  capture="environment"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {/* Mobile camera button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
              </>
            )}
          </div>
        )}

        {(scanState === "uploading" || scanState === "processing") && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">
              {scanState === "uploading" ? "Uploading receipt..." : "Extracting details..."}
            </p>
            <Progress value={uploadProgress} className="max-w-xs mx-auto" />
          </div>
        )}

        {scanState === "review" && currentExtraction && (
          <ExtractionReviewCard
            extraction={currentExtraction}
            onConfirm={(updates) =>
              confirmMutation.mutate({ extractionId: currentExtraction.id, ...updates })
            }
            onDiscard={() =>
              discardMutation.mutate({ extractionId: currentExtraction.id })
            }
          />
        )}

        {scanState === "done" && (
          <div className="py-8 text-center space-y-2">
            <FileCheck className="w-8 h-8 mx-auto text-success" />
            <p className="text-sm font-medium">Transaction created!</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/documents/__tests__/ReceiptScanner.test.tsx`
Expected: PASS

**Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/documents/ReceiptScanner.tsx \
  src/components/documents/__tests__/ReceiptScanner.test.tsx
git commit -m "feat: add ReceiptScanner dialog with camera capture and plan gating"
```

---

## Task 5: Add "Scan Receipt" Button to Transactions Page

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`

**Step 1: Add import and state**

At top of `src/app/(dashboard)/transactions/page.tsx`, add:

```typescript
import { ReceiptScanner } from "@/components/documents/ReceiptScanner";
import { Camera } from "lucide-react";
```

Inside the component, add state:

```typescript
const [showReceiptScanner, setShowReceiptScanner] = useState(false);
```

**Step 2: Add the button to the page header**

Find the header area where other action buttons (Import CSV, Download, etc.) are rendered. Add before or after the existing buttons:

```tsx
<Button variant="outline" onClick={() => setShowReceiptScanner(true)}>
  <Camera className="w-4 h-4 mr-2" />
  Scan Receipt
</Button>
```

**Step 3: Add the ReceiptScanner dialog**

At the bottom of the component's JSX (before the closing fragment/div), add:

```tsx
<ReceiptScanner
  open={showReceiptScanner}
  onOpenChange={setShowReceiptScanner}
/>
```

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/transactions/page.tsx"
git commit -m "feat: add Scan Receipt button to transactions page"
```

---

## Task 6: Create /receipts Page

**Files:**
- Create: `src/app/(dashboard)/receipts/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (add nav link)

**Step 1: Create the receipts page**

Create `src/app/(dashboard)/receipts/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Camera, FileText, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ReceiptScanner } from "@/components/documents/ReceiptScanner";
import { ExtractionReviewCard } from "@/components/documents/ExtractionReviewCard";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ReceiptsPage() {
  const [showScanner, setShowScanner] = useState(false);

  const utils = trpc.useUtils();

  const { data: pendingReviews, isLoading: loadingPending } =
    trpc.documentExtraction.listPendingReviews.useQuery();

  const { data: scanQuota } =
    trpc.documentExtraction.getRemainingScans.useQuery();

  const { data: receiptDocs, isLoading: loadingHistory } =
    trpc.document.list.useQuery({ category: "receipt" });

  const confirmMutation = trpc.documentExtraction.confirmTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction created");
      utils.documentExtraction.listPendingReviews.invalidate();
      utils.documentExtraction.getRemainingScans.invalidate();
      utils.transaction.list.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.documentExtraction.discardExtraction.useMutation({
    onSuccess: () => {
      toast.success("Receipt discarded");
      utils.documentExtraction.listPendingReviews.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Receipts</h2>
          <p className="text-muted-foreground">
            Scan receipts to automatically create transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {scanQuota && scanQuota.limit !== null && (
            <span className="text-sm text-muted-foreground">
              {scanQuota.remaining}/{scanQuota.limit} scans left
            </span>
          )}
          <Button onClick={() => setShowScanner(true)}>
            <Camera className="w-4 h-4 mr-2" />
            Scan Receipt
          </Button>
        </div>
      </div>

      {/* Pending reviews */}
      {pendingReviews && pendingReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Review ({pendingReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingReviews.map((extraction) => (
              <ExtractionReviewCard
                key={extraction.id}
                extraction={extraction}
                onConfirm={(updates) =>
                  confirmMutation.mutate({ extractionId: extraction.id, ...updates })
                }
                onDiscard={() =>
                  discardMutation.mutate({ extractionId: extraction.id })
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* History table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receipt History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory || loadingPending ? (
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
          ) : receiptDocs && receiptDocs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {doc.fileName}
                    </TableCell>
                    <TableCell>{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Scanned</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No receipts scanned yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                Scan a receipt to automatically extract transaction details.
              </p>
              <Button className="mt-4" onClick={() => setShowScanner(true)}>
                Scan your first receipt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ReceiptScanner open={showScanner} onOpenChange={setShowScanner} />
    </div>
  );
}
```

**Step 2: Add document.list category filter support**

The current `document.list` procedure only filters by `propertyId` and `transactionId`. We need to add `category` filter support.

In `src/server/repositories/interfaces/document.repository.interface.ts`, update `DocumentFilters`:

```typescript
export interface DocumentFilters {
  propertyId?: string;
  transactionId?: string;
  category?: string;
}
```

In `src/server/repositories/document.repository.ts`, update `findByOwner` to handle `category` filter. Add `category` to the where clause logic:

```typescript
async findByOwner(userId: string, filters?: DocumentFilters): Promise<Document[]> {
  const conditions = [eq(documents.userId, userId)];

  if (filters?.propertyId) {
    conditions.push(eq(documents.propertyId, filters.propertyId));
  }
  if (filters?.transactionId) {
    conditions.push(eq(documents.transactionId, filters.transactionId));
  }
  if (filters?.category) {
    conditions.push(eq(documents.category, filters.category as typeof documents.category.enumValues[number]));
  }

  return this.db.query.documents.findMany({
    where: and(...conditions),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
}
```

In `src/server/routers/documents/documents.ts`, update the `list` procedure input to accept `category`:

```typescript
list: protectedProcedure
  .input(
    z.object({
      propertyId: z.string().uuid().optional(),
      transactionId: z.string().uuid().optional(),
      category: z.enum(["receipt", "contract", "depreciation", "lease", "other"]).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const docs = await ctx.uow.document.findByOwner(ctx.portfolio.ownerId, {
      propertyId: input.propertyId,
      transactionId: input.transactionId,
      category: input.category,
    });
    // ... rest unchanged
  }),
```

**Step 3: Add Receipts link to Sidebar**

In `src/components/layout/Sidebar.tsx`, find the "Properties & Banking" section items array (around line 57). Add after the "Review" entry:

```typescript
{ href: "/receipts", label: "Receipts", icon: Receipt },
```

Add `Receipt` to the lucide-react imports at the top of the file.

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/receipts/page.tsx" \
  src/components/layout/Sidebar.tsx \
  src/server/repositories/interfaces/document.repository.interface.ts \
  src/server/repositories/document.repository.ts \
  src/server/routers/documents/documents.ts
git commit -m "feat: add receipts page with history table and sidebar navigation"
```

---

## Task 7: Integration Testing & Cleanup

**Step 1: Run the full unit test suite**

Run: `pnpm vitest run`
Expected: All tests pass (existing + new)

**Step 2: Type check entire project**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Lint changed files**

Run: `pnpm eslint src/components/documents/ReceiptScanner.tsx src/app/\(dashboard\)/receipts/page.tsx`
Expected: No errors

**Step 4: Manual smoke test checklist**

If dev server is running:
- [ ] Navigate to `/transactions` — "Scan Receipt" button visible in header
- [ ] Click "Scan Receipt" — dialog opens with dropzone and camera button
- [ ] Navigate to `/receipts` — page loads with empty state
- [ ] Sidebar shows "Receipts" link under "Properties & Banking"
- [ ] Free user sees "X scans remaining" counter

**Step 5: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: integration cleanup for receipt OCR feature"
```

---

## Execution Notes

### Branch Strategy
Single branch: `feature/receipt-ocr` off `develop`

### Test Commands
- Single test file: `pnpm vitest run <path>`
- All unit tests: `pnpm vitest run`
- Type check: `npx tsc --noEmit`

### Schema Changes
**None required.** This feature uses existing `documents` and `documentExtractions` tables.

### Key Existing Files Reference

| File | Purpose |
|------|---------|
| `src/server/routers/documents/documentExtraction.ts` | Extraction procedures (extract, confirm, discard) |
| `src/server/routers/documents/documents.ts` | Upload flow (getUploadUrl, create, list) |
| `src/server/services/property-analysis/document-extraction.ts` | Claude Vision extraction service |
| `src/server/repositories/document.repository.ts` | Document data access |
| `src/components/documents/ExtractionReviewCard.tsx` | Existing review card (reused) |
| `src/server/services/billing/subscription.ts` | Plan limits (add maxReceiptScans) |
| `src/components/layout/Sidebar.tsx` | Navigation sidebar |

### Pre-PR Checklist
1. All unit tests pass: `pnpm vitest run`
2. Type check passes: `npx tsc --noEmit`
3. No lint errors on changed files
4. No anti-patterns (check `.claude/rules/anti-patterns.md`)
5. `writeProcedure` used for all mutations
6. Queries scoped by `ctx.portfolio.ownerId`
