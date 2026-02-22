# AI Document Scanner — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dedicated documents hub page with batch upload, smarter extraction (GST, renewal dates, ABN, duplicate detection), and confidence-based bulk actions.

**Architecture:** Incremental enhancement of existing Claude Sonnet vision extraction + Supabase storage + draft transaction workflow. No new DB tables or schema migrations — new extracted fields stored in existing `extractedData` JSON blob. New `/documents` page composes existing `ExtractionReviewCard` with new `BatchUploadZone` and `DocumentHistory` components.

**Tech Stack:** Next.js 16 (App Router), React 19, tRPC v11, Drizzle ORM, Supabase Storage, Anthropic SDK (Claude Sonnet 4.5), react-dropzone, shadcn/ui

---

### Task 1: Enhanced Extraction Prompt + ExtractedData Interface

**Files:**
- Modify: `src/server/services/property-analysis/document-extraction.ts`

**Step 1: Update ExtractedData interface**

Add four new optional fields to the `ExtractedData` interface:

```typescript
export interface ExtractedData {
  documentType: "receipt" | "rate_notice" | "insurance" | "invoice" | "unknown";
  confidence: number;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  dueDate: string | null;
  category: string | null;
  propertyAddress: string | null;
  lineItems: LineItem[] | null;
  rawText: string | null;
  error?: string;
  // New fields
  gstAmount: number | null;
  renewalDate: string | null;
  referenceNumber: string | null;
  abn: string | null;
}
```

**Step 2: Update EXTRACTION_PROMPT_BASE**

Add to the JSON schema section in the prompt:

```
  "gstAmount": 12.34 or null,
  "renewalDate": "YYYY-MM-DD or null",
  "referenceNumber": "policy or reference number or null",
  "abn": "vendor ABN (11 digits) or null",
```

Add extraction rules:

```
- Extract GST amount if shown separately on receipts/invoices (common in Australia)
- For insurance documents, extract renewal/expiry date as renewalDate
- Extract policy number or reference number from insurance, rates notices
- Extract vendor ABN (11-digit Australian Business Number) if shown on invoices/receipts
```

**Step 3: Update parseExtractionResponse**

Add the four new fields to both the `defaultResult` object (all `null`) and the parsing logic:

```typescript
gstAmount: typeof parsed.gstAmount === "number" ? parsed.gstAmount : null,
renewalDate: parsed.renewalDate || null,
referenceNumber: parsed.referenceNumber || null,
abn: parsed.abn || null,
```

**Step 4: Run tests**

Run: `npx vitest run src/server/services/property-analysis/ --reporter=verbose`
Expected: Existing tests pass (if any). The parseExtractionResponse changes are backward-compatible.

**Step 5: Commit**

```bash
git add src/server/services/property-analysis/document-extraction.ts
git commit -m "feat: enhance extraction prompt with GST, renewal date, ABN, reference number"
```

---

### Task 2: Duplicate Detection

**Files:**
- Create: `src/server/services/property-analysis/duplicate-detection.ts`
- Create: `src/server/services/property-analysis/__tests__/duplicate-detection.test.ts`
- Modify: `src/server/services/property-analysis/index.ts` (barrel export)

**Step 1: Write the failing tests**

```typescript
// src/server/services/property-analysis/__tests__/duplicate-detection.test.ts
import { describe, it, expect } from "vitest";
import { findPotentialDuplicate } from "../duplicate-detection";

const mockTransactions = [
  {
    id: "tx-1",
    date: "2026-01-15",
    amount: "-150.00",
    description: "Bunnings Warehouse",
    status: "confirmed",
  },
  {
    id: "tx-2",
    date: "2026-02-01",
    amount: "-250.00",
    description: "ABC Plumbing",
    status: "confirmed",
  },
];

describe("findPotentialDuplicate", () => {
  it("finds exact match on amount + date + vendor", () => {
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-15", vendor: "Bunnings Warehouse" },
      mockTransactions
    );
    expect(result).toBe("tx-1");
  });

  it("finds match within 7-day window", () => {
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-18", vendor: "Bunnings" },
      mockTransactions
    );
    expect(result).toBe("tx-1");
  });

  it("returns null when no match", () => {
    const result = findPotentialDuplicate(
      { amount: 999, date: "2026-01-15", vendor: "Unknown" },
      mockTransactions
    );
    expect(result).toBeNull();
  });

  it("returns null when date outside 7-day window", () => {
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-25", vendor: "Bunnings" },
      mockTransactions
    );
    expect(result).toBeNull();
  });

  it("matches vendor name fuzzily (substring)", () => {
    const result = findPotentialDuplicate(
      { amount: 250, date: "2026-02-01", vendor: "ABC Plumbing Services" },
      mockTransactions
    );
    expect(result).toBe("tx-2");
  });

  it("skips pending_review transactions", () => {
    const txWithPending = [
      ...mockTransactions,
      { id: "tx-3", date: "2026-01-15", amount: "-150.00", description: "Bunnings", status: "pending_review" },
    ];
    const result = findPotentialDuplicate(
      { amount: 150, date: "2026-01-15", vendor: "Bunnings" },
      txWithPending
    );
    expect(result).toBe("tx-1"); // Matches tx-1, not tx-3
  });

  it("returns null when amount is null", () => {
    const result = findPotentialDuplicate(
      { amount: null, date: "2026-01-15", vendor: "Bunnings" },
      mockTransactions
    );
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/property-analysis/__tests__/duplicate-detection.test.ts --reporter=verbose`
Expected: FAIL — module not found

**Step 3: Implement duplicate detection**

```typescript
// src/server/services/property-analysis/duplicate-detection.ts

interface ExtractionCandidate {
  amount: number | null;
  date: string | null;
  vendor: string | null;
}

interface TransactionRow {
  id: string;
  date: string;
  amount: string;
  description: string;
  status: string;
}

const WINDOW_DAYS = 7;

function daysApart(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function vendorMatch(extracted: string, existing: string): boolean {
  const a = extracted.toLowerCase().trim();
  const b = existing.toLowerCase().trim();
  return a.includes(b) || b.includes(a);
}

/**
 * Find a potential duplicate transaction for an extraction result.
 * Returns the transaction ID if a duplicate is found, null otherwise.
 *
 * Matching criteria: same absolute amount + date within 7 days + vendor fuzzy match.
 * Skips pending_review transactions (those are other draft extractions).
 */
export function findPotentialDuplicate(
  candidate: ExtractionCandidate,
  transactions: TransactionRow[]
): string | null {
  if (!candidate.amount || !candidate.date) return null;

  const candidateAmount = Math.abs(candidate.amount);

  for (const tx of transactions) {
    if (tx.status === "pending_review") continue;

    const txAmount = Math.abs(parseFloat(tx.amount));
    if (Math.abs(txAmount - candidateAmount) > 0.01) continue;

    if (daysApart(candidate.date, tx.date) > WINDOW_DAYS) continue;

    if (candidate.vendor && tx.description) {
      if (!vendorMatch(candidate.vendor, tx.description)) continue;
    }

    return tx.id;
  }

  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/property-analysis/__tests__/duplicate-detection.test.ts --reporter=verbose`
Expected: 7 tests PASS

**Step 5: Add barrel export**

In `src/server/services/property-analysis/index.ts`, add:
```typescript
export { findPotentialDuplicate } from "./duplicate-detection";
```

**Step 6: Commit**

```bash
git add src/server/services/property-analysis/duplicate-detection.ts \
  src/server/services/property-analysis/__tests__/duplicate-detection.test.ts \
  src/server/services/property-analysis/index.ts
git commit -m "feat: add duplicate transaction detection for document extraction"
```

---

### Task 3: Integrate Duplicate Detection Into Extraction Flow

**Files:**
- Modify: `src/server/routers/documents/documents.ts` (the `create` mutation's async extraction closure)
- Modify: `src/server/routers/documents/documentExtraction.ts` (the `extract` mutation's async extraction closure)

**Step 1: Update documents.ts create mutation**

In the async extraction closure (line ~152), after the extraction result is obtained and before the draft transaction is created (line ~186), add duplicate detection:

```typescript
// After result.data is available, before creating draft transaction
import { findPotentialDuplicate } from "../../services/property-analysis";

// ...inside the async closure, after line ~183:
let duplicateOf: string | null = null;
if (result.data.amount) {
  // Cross-domain: checks existing transactions for duplicate detection
  const existingTxs = await db.query.transactions.findMany({
    where: eq(transactions.userId, ownerId),
    columns: { id: true, date: true, amount: true, description: true, status: true },
  });
  duplicateOf = findPotentialDuplicate(
    { amount: result.data.amount, date: result.data.date, vendor: result.data.vendor },
    existingTxs
  );
}
```

Then include `duplicateOf` in the extractedData JSON:

```typescript
// When updating extraction with results, include duplicateOf
const enrichedData = { ...result.data, duplicateOf };
await db.update(documentExtractions).set({
  // ...existing fields
  extractedData: JSON.stringify(enrichedData),
  // ...rest
});
```

**Step 2: Apply same change to documentExtraction.ts extract mutation**

Same pattern in the `extract` mutation's async closure (line ~67). Add duplicate detection before draft transaction creation.

**Step 3: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/routers/documents/documents.ts \
  src/server/routers/documents/documentExtraction.ts
git commit -m "feat: integrate duplicate detection into extraction flow"
```

---

### Task 4: BatchUploadZone Component

**Files:**
- Create: `src/components/documents/BatchUploadZone.tsx`
- Modify: `src/components/documents/index.ts` (add export)

**Step 1: Implement BatchUploadZone**

This component handles multi-file upload with concurrent upload limit and per-file status tracking. Reuses the existing `getUploadUrl` → Supabase upload → `documents.create` flow.

```typescript
// src/components/documents/BatchUploadZone.tsx
"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Image, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const ALLOWED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "application/pdf": [".pdf"],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const MAX_CONCURRENT = 3;

type FileStatus = "queued" | "uploading" | "extracting" | "done" | "failed" | "quota_exceeded";

interface TrackedFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  documentId: string | null;
  error: string | null;
  extractedPreview: { amount: number | null; category: string | null } | null;
}

interface BatchUploadZoneProps {
  remainingScans: number | null; // null = unlimited
  onBatchComplete?: () => void;
}

export function BatchUploadZone({ remainingScans, onBatchComplete }: BatchUploadZoneProps) {
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const activeUploads = useRef(0);

  const utils = trpc.useUtils();
  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();

  const updateFile = useCallback((id: string, updates: Partial<TrackedFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const processFile = useCallback(async (tracked: TrackedFile, scanIndex: number) => {
    // Check if this file exceeds quota
    if (remainingScans !== null && scanIndex >= remainingScans) {
      updateFile(tracked.id, { status: "quota_exceeded", error: "Scan quota exceeded" });
      return;
    }

    updateFile(tracked.id, { status: "uploading", progress: 20 });

    try {
      const { signedUrl, storagePath, token } = await getUploadUrl.mutateAsync({
        fileName: tracked.file.name,
        fileType: tracked.file.type as "image/jpeg" | "image/png" | "image/heic" | "application/pdf",
        fileSize: tracked.file.size,
      });

      updateFile(tracked.id, { progress: 50 });

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(storagePath, token, tracked.file);

      if (uploadError) throw new Error(uploadError.message);

      updateFile(tracked.id, { progress: 70 });

      const document = await createDocument.mutateAsync({
        storagePath,
        fileName: tracked.file.name,
        fileType: tracked.file.type,
        fileSize: tracked.file.size,
        category: "receipt",
      });

      updateFile(tracked.id, { status: "extracting", progress: 80, documentId: document.id });

      // Poll for extraction
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const extraction = await utils.documentExtraction.getExtraction.fetch({ documentId: document.id });

        if (extraction?.status === "completed") {
          updateFile(tracked.id, {
            status: "done",
            progress: 100,
            extractedPreview: {
              amount: extraction.extractedData?.amount ?? null,
              category: extraction.extractedData?.category ?? null,
            },
          });
          return;
        }

        if (extraction?.status === "failed") {
          updateFile(tracked.id, { status: "failed", error: "Extraction failed", progress: 100 });
          return;
        }
      }

      updateFile(tracked.id, { status: "failed", error: "Extraction timed out", progress: 100 });
    } catch (error) {
      updateFile(tracked.id, { status: "failed", error: getErrorMessage(error), progress: 100 });
    }
  }, [getUploadUrl, createDocument, utils, updateFile, remainingScans]);

  const processBatch = useCallback(async (trackedFiles: TrackedFile[]) => {
    setIsProcessing(true);
    const queue = [...trackedFiles];
    let scanIndex = 0;

    const processNext = async (): Promise<void> => {
      const next = queue.shift();
      if (!next) return;

      activeUploads.current++;
      await processFile(next, scanIndex++);
      activeUploads.current--;

      await processNext();
    };

    // Start up to MAX_CONCURRENT parallel workers
    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT, queue.length) },
      () => processNext()
    );
    await Promise.all(workers);

    setIsProcessing(false);
    utils.documentExtraction.listPendingReviews.invalidate();
    utils.documentExtraction.getRemainingScans.invalidate();
    onBatchComplete?.();
  }, [processFile, utils, onBatchComplete]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const trackedFiles: TrackedFile[] = acceptedFiles.slice(0, MAX_FILES).map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      status: "queued" as const,
      progress: 0,
      documentId: null,
      error: null,
      extractedPreview: null,
    }));

    setFiles(trackedFiles);
    processBatch(trackedFiles);
  }, [processBatch]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    disabled: isProcessing,
    onDropRejected: (rejections) => {
      const errors = rejections.map((r) => `${r.file.name}: ${r.errors[0].message}`);
      toast.error(errors.join("\n"));
    },
  });

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "queued": return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "uploading": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "extracting": return <Loader2 className="h-4 w-4 animate-spin text-amber-500" />;
      case "done": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "quota_exceeded": return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: FileStatus) => {
    switch (status) {
      case "queued": return "Queued";
      case "uploading": return "Uploading...";
      case "extracting": return "Extracting...";
      case "done": return "Ready for review";
      case "failed": return "Failed";
      case "quota_exceeded": return "Upgrade to scan";
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          isProcessing && "opacity-50 cursor-not-allowed",
          !isDragActive && !isProcessing && "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop files here" : "Drag & drop up to 10 files, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, HEIC, or PDF (max 10MB each)
        </p>
        {remainingScans !== null && (
          <p className="text-xs text-muted-foreground mt-2">
            {remainingScans} scans remaining this month
          </p>
        )}
      </div>

      {/* Per-file status cards */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {getStatusIcon(f.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {getStatusLabel(f.status)}
                  </span>
                  {f.status === "done" && f.extractedPreview?.amount && (
                    <Badge variant="secondary" className="text-xs">
                      ${Math.abs(f.extractedPreview.amount).toFixed(2)}
                    </Badge>
                  )}
                  {f.status === "done" && f.extractedPreview?.category && (
                    <Badge variant="outline" className="text-xs">
                      {f.extractedPreview.category.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {f.error && f.status === "failed" && (
                    <span className="text-xs text-destructive">{f.error}</span>
                  )}
                  {f.status === "quota_exceeded" && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                      <a href="/settings/billing">Upgrade</a>
                    </Button>
                  )}
                </div>
                {(f.status === "uploading" || f.status === "extracting") && (
                  <Progress value={f.progress} className="mt-1.5 h-1" />
                )}
              </div>
              {(f.status === "done" || f.status === "failed" || f.status === "quota_exceeded") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeFile(f.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update barrel export**

In `src/components/documents/index.ts`, add:
```typescript
export { BatchUploadZone } from "./BatchUploadZone";
```

**Step 3: Commit**

```bash
git add src/components/documents/BatchUploadZone.tsx src/components/documents/index.ts
git commit -m "feat: add BatchUploadZone component for multi-file upload"
```

---

### Task 5: PendingReviews Component with Confidence Badges + Confirm All

**Files:**
- Create: `src/components/documents/PendingReviews.tsx`
- Modify: `src/components/documents/index.ts` (add export)

**Step 1: Implement PendingReviews**

This component lists pending extractions with confidence badges and a "Confirm All" bulk action for high-confidence items (>=0.85). Reuses `ExtractionReviewCard` for expandable inline review.

```typescript
// src/components/documents/PendingReviews.tsx
"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ExtractionReviewCard } from "./ExtractionReviewCard";
import { formatCurrency } from "@/lib/format";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) {
    return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">High confidence</Badge>;
  }
  if (confidence >= 0.5) {
    return <Badge variant="secondary">Review needed</Badge>;
  }
  return (
    <Badge variant="destructive" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Low confidence
    </Badge>
  );
}

function DuplicateWarning({ transactionId }: { transactionId: string }) {
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
      Possible duplicate
    </Badge>
  );
}

export function PendingReviews() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: reviews, isLoading } = trpc.documentExtraction.listPendingReviews.useQuery();

  const confirmMutation = trpc.documentExtraction.confirmTransaction.useMutation({
    onSuccess: () => {
      utils.documentExtraction.listPendingReviews.invalidate();
      utils.transaction.list.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.documentExtraction.discardExtraction.useMutation({
    onSuccess: () => {
      utils.documentExtraction.listPendingReviews.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading || !reviews) return null;
  if (reviews.length === 0) return null;

  const highConfidence = reviews.filter(
    (r) => r.confidence && parseFloat(r.confidence) >= 0.85
  );

  const handleConfirmAll = async () => {
    let confirmed = 0;
    for (const review of highConfidence) {
      try {
        await confirmMutation.mutateAsync({ extractionId: review.id });
        confirmed++;
      } catch {
        // Continue confirming the rest
      }
    }
    toast.success(`Confirmed ${confirmed} transaction${confirmed !== 1 ? "s" : ""}`);
    utils.documentExtraction.getRemainingScans.invalidate();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Pending Reviews ({reviews.length})
          </CardTitle>
          {highConfidence.length > 0 && (
            <Button
              size="sm"
              onClick={handleConfirmAll}
              disabled={confirmMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirm All High Confidence ({highConfidence.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {reviews.map((review) => {
          const confidence = review.confidence ? parseFloat(review.confidence) : 0;
          const data = review.extractedData;
          const duplicateOf = data?.duplicateOf;
          const isExpanded = expandedId === review.id;

          return (
            <div key={review.id} className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : review.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {data?.vendor || review.document?.fileName || "Unknown"}
                    </span>
                    {data?.amount && (
                      <span className="text-sm font-mono">
                        {formatCurrency(Math.abs(data.amount))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ConfidenceBadge confidence={confidence} />
                    {data?.category && (
                      <Badge variant="outline" className="text-xs">
                        {data.category.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {duplicateOf && <DuplicateWarning transactionId={duplicateOf} />}
                  </div>
                </div>
                {data?.date && (
                  <span className="text-xs text-muted-foreground shrink-0">{data.date}</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <ExtractionReviewCard
                    extraction={review}
                    onConfirm={(updates) =>
                      confirmMutation.mutate({ extractionId: review.id, ...updates })
                    }
                    onDiscard={() =>
                      discardMutation.mutate({ extractionId: review.id })
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update barrel export**

```typescript
export { PendingReviews } from "./PendingReviews";
```

**Step 3: Commit**

```bash
git add src/components/documents/PendingReviews.tsx src/components/documents/index.ts
git commit -m "feat: add PendingReviews component with confidence badges and bulk confirm"
```

---

### Task 6: DocumentHistory Component

**Files:**
- Create: `src/components/documents/DocumentHistory.tsx`
- Modify: `src/components/documents/index.ts` (add export)

**Step 1: Implement DocumentHistory**

Paginated table of all documents with filters (property, category, document type). Reuses existing `documents.list` query with added filter params.

```typescript
// src/components/documents/DocumentHistory.tsx
"use client";

import { useState } from "react";
import { FileText, Image, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { PropertySelect } from "@/components/properties/PropertySelect";
import { formatDate } from "@/lib/format";

const DOCUMENT_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "receipt", label: "Receipt" },
  { value: "contract", label: "Contract" },
  { value: "depreciation", label: "Depreciation" },
  { value: "lease", label: "Lease" },
  { value: "other", label: "Other" },
] as const;

export function DocumentHistory() {
  const [propertyId, setPropertyId] = useState<string>("");
  const [category, setCategory] = useState<string>("all");

  const { data: documents, isLoading } = trpc.documents.list.useQuery({
    propertyId: propertyId || undefined,
    category: category !== "all" ? (category as "receipt" | "contract" | "depreciation" | "lease" | "other") : undefined,
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4 text-muted-foreground" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Document History</CardTitle>
          <div className="flex items-center gap-2">
            <PropertySelect
              value={propertyId}
              onValueChange={setPropertyId}
              placeholder="All Properties"
              allowClear
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : !documents || documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No documents found. Upload some files to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(doc.fileType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(doc.createdAt)}
                  </p>
                </div>
                {doc.category && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {doc.category}
                  </Badge>
                )}
                {doc.signedUrl && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update barrel export**

```typescript
export { DocumentHistory } from "./DocumentHistory";
```

**Step 3: Commit**

```bash
git add src/components/documents/DocumentHistory.tsx src/components/documents/index.ts
git commit -m "feat: add DocumentHistory component with filters"
```

---

### Task 7: Documents Hub Page (`/documents`)

**Files:**
- Create: `src/app/(dashboard)/documents/page.tsx`

**Step 1: Create page**

```typescript
// src/app/(dashboard)/documents/page.tsx
import { DocumentsPageContent } from "./DocumentsPageContent";

export const metadata = {
  title: "Documents | BrickTrack",
};

export default function DocumentsPage() {
  return <DocumentsPageContent />;
}
```

**Step 2: Create page content component**

- Create: `src/app/(dashboard)/documents/DocumentsPageContent.tsx`

```typescript
// src/app/(dashboard)/documents/DocumentsPageContent.tsx
"use client";

import { FileText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { BatchUploadZone } from "@/components/documents/BatchUploadZone";
import { PendingReviews } from "@/components/documents/PendingReviews";
import { DocumentHistory } from "@/components/documents/DocumentHistory";

export function DocumentsPageContent() {
  const { data: scanQuota } = trpc.documentExtraction.getRemainingScans.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Upload receipts and documents to automatically extract transaction details
          </p>
        </div>
      </div>

      <BatchUploadZone
        remainingScans={scanQuota?.remaining ?? null}
        onBatchComplete={() => {}}
      />

      <PendingReviews />

      <DocumentHistory />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/documents/page.tsx \
  src/app/\(dashboard\)/documents/DocumentsPageContent.tsx
git commit -m "feat: add /documents hub page"
```

---

### Task 8: Sidebar Navigation + Pending Review Badge

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add Documents to sidebar navigation**

In `Sidebar.tsx`, add `FileText` to the lucide imports (already imported on line 24). Add "Documents" item to the "Properties & Banking" group, after "Receipts":

```typescript
// In navGroups[0].items, after the Receipts entry:
{ href: "/documents", label: "Documents", icon: FileText, showBadge: true },
```

**Step 2: Add pending review count badge**

The sidebar already has badge rendering logic for items with `showBadge: true`. Find the existing badge query (used for Transactions Review) and add a similar query for documents.

Look for the existing `pendingReviewCount` pattern in the sidebar. If a general badge approach exists, hook into it. If not, add a query:

```typescript
const { data: pendingReviews } = trpc.documentExtraction.listPendingReviews.useQuery();
const documentBadgeCount = pendingReviews?.length ?? 0;
```

Then render the badge count next to the "Documents" nav item when `documentBadgeCount > 0`.

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add Documents to sidebar with pending review badge"
```

---

### Task 9: Verification & Cleanup

**Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 3: Visual verification checklist (manual on dev server)**

- [ ] `/documents` page loads with upload zone, pending reviews, document history
- [ ] Drag & drop single file → uploads + extracts → shows in pending reviews
- [ ] Multi-file drop (3+ files) → concurrent upload with per-file status cards
- [ ] Confidence badges show correctly (green for >=0.85, yellow for <0.5)
- [ ] "Confirm All" button appears for high-confidence items, confirms them
- [ ] Sidebar shows "Documents" with badge count
- [ ] Document history shows all uploaded documents with filters

**Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup and polish documents hub"
```
