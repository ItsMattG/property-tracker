# Settlement Statement Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload a settlement statement PDF after adding a property, extract purchase price, stamp duty, legal fees, and adjustments via AI, and auto-create capital cost base transactions for CGT.

**Architecture:** Add a settlement-specific extraction service that uses the existing Anthropic Claude API integration to parse settlement statement PDFs. After property creation, redirect to a settlement upload page that lets users upload the PDF, review extracted line items, and confirm creation of capital cost transactions. The CGT cost base (already calculated from capital category transactions) automatically reflects the new data.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, Anthropic SDK (Claude Haiku), Supabase Storage, React, shadcn/ui

---

### Task 1: Settlement Extraction Service

Create a dedicated settlement statement extraction service that builds a settlement-specific prompt and parses the AI response into structured data.

**Files:**
- Create: `src/server/services/settlement-extract.ts`
- Test: `src/server/services/__tests__/settlement-extract.test.ts`

**Step 1: Write the failing tests**

Create `src/server/services/__tests__/settlement-extract.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  SETTLEMENT_EXTRACTION_PROMPT,
  parseSettlementResponse,
  type SettlementExtractedData,
} from "../settlement-extract";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
  })),
}));

describe("settlement-extract", () => {
  describe("SETTLEMENT_EXTRACTION_PROMPT", () => {
    it("includes settlement statement context", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("settlement statement");
    });

    it("requests stamp duty extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("stampDuty");
    });

    it("requests legal fees extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("legalFees");
    });

    it("requests purchase price extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("purchasePrice");
    });

    it("requests settlement date extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("settlementDate");
    });
  });

  describe("parseSettlementResponse", () => {
    it("parses a valid settlement JSON response", () => {
      const response = JSON.stringify({
        purchasePrice: 750000,
        settlementDate: "2025-06-15",
        stampDuty: 29490,
        legalFees: 1850,
        titleSearchFees: 150,
        registrationFees: 350,
        adjustments: [
          { description: "Council rates adjustment", amount: -432.50, type: "credit" },
          { description: "Water rates adjustment", amount: -185.20, type: "credit" },
        ],
        propertyAddress: "123 Main St, Richmond VIC 3121",
        buyerName: "John Smith",
        confidence: 0.92,
      });

      const result = parseSettlementResponse(response);
      expect(result.purchasePrice).toBe(750000);
      expect(result.stampDuty).toBe(29490);
      expect(result.legalFees).toBe(1850);
      expect(result.settlementDate).toBe("2025-06-15");
      expect(result.adjustments).toHaveLength(2);
      expect(result.confidence).toBe(0.92);
    });

    it("handles response with surrounding text", () => {
      const response = `Here is the extracted data:
      {"purchasePrice": 500000, "stampDuty": 17990, "legalFees": 1200, "confidence": 0.85}
      That's the result.`;

      const result = parseSettlementResponse(response);
      expect(result.purchasePrice).toBe(500000);
      expect(result.stampDuty).toBe(17990);
    });

    it("returns defaults for unparseable response", () => {
      const result = parseSettlementResponse("This is not JSON");
      expect(result.purchasePrice).toBeNull();
      expect(result.stampDuty).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.error).toBeDefined();
    });

    it("handles missing optional fields gracefully", () => {
      const response = JSON.stringify({
        purchasePrice: 600000,
        stampDuty: 21000,
        confidence: 0.7,
      });

      const result = parseSettlementResponse(response);
      expect(result.purchasePrice).toBe(600000);
      expect(result.legalFees).toBeNull();
      expect(result.adjustments).toBeNull();
      expect(result.settlementDate).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/settlement-extract.test.ts`
Expected: FAIL — module `../settlement-extract` not found

**Step 3: Write the implementation**

Create `src/server/services/settlement-extract.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getDocumentContent, getMediaType } from "./document-extraction";

export interface SettlementAdjustment {
  description: string;
  amount: number;
  type: "debit" | "credit";
}

export interface SettlementExtractedData {
  purchasePrice: number | null;
  settlementDate: string | null;
  stampDuty: number | null;
  legalFees: number | null;
  titleSearchFees: number | null;
  registrationFees: number | null;
  adjustments: SettlementAdjustment[] | null;
  propertyAddress: string | null;
  buyerName: string | null;
  confidence: number;
  error?: string;
}

export const SETTLEMENT_EXTRACTION_PROMPT = `You are extracting data from an Australian property settlement statement (also called a settlement adjustment sheet or vendor's statement of adjustments).

Extract the following fields and return ONLY valid JSON:
{
  "purchasePrice": 750000,
  "settlementDate": "YYYY-MM-DD",
  "stampDuty": 29490,
  "legalFees": 1850,
  "titleSearchFees": 150,
  "registrationFees": 350,
  "adjustments": [
    {"description": "Council rates adjustment", "amount": -432.50, "type": "credit"},
    {"description": "Water rates adjustment", "amount": -185.20, "type": "credit"}
  ],
  "propertyAddress": "123 Main St, Richmond VIC 3121",
  "buyerName": "Buyer name if visible",
  "confidence": 0.0-1.0
}

Rules:
- purchasePrice is the contract/purchase price (the big number at the top)
- stampDuty is often listed as "Transfer Duty" or "Stamp Duty" — a state government charge
- legalFees includes solicitor/conveyancer fees
- titleSearchFees and registrationFees are often listed as disbursements
- adjustments are rate apportionments (council rates, water rates, strata levies, land tax)
  - credits to buyer (seller owes buyer) should have negative amounts and type "credit"
  - debits to buyer (buyer owes seller) should have positive amounts and type "debit"
- Amounts should be numbers without currency symbols
- Dates in YYYY-MM-DD format
- If a field cannot be determined, use null
- confidence should reflect how readable and complete the extraction is`;

// Lazy initialization
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export function parseSettlementResponse(response: string): SettlementExtractedData {
  const defaults: SettlementExtractedData = {
    purchasePrice: null,
    settlementDate: null,
    stampDuty: null,
    legalFees: null,
    titleSearchFees: null,
    registrationFees: null,
    adjustments: null,
    propertyAddress: null,
    buyerName: null,
    confidence: 0,
    error: "Failed to parse settlement response",
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return defaults;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      purchasePrice: typeof parsed.purchasePrice === "number" ? parsed.purchasePrice : null,
      settlementDate: parsed.settlementDate || null,
      stampDuty: typeof parsed.stampDuty === "number" ? parsed.stampDuty : null,
      legalFees: typeof parsed.legalFees === "number" ? parsed.legalFees : null,
      titleSearchFees: typeof parsed.titleSearchFees === "number" ? parsed.titleSearchFees : null,
      registrationFees: typeof parsed.registrationFees === "number" ? parsed.registrationFees : null,
      adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : null,
      propertyAddress: parsed.propertyAddress || null,
      buyerName: parsed.buyerName || null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch {
    return defaults;
  }
}

export async function extractSettlement(
  storagePath: string,
  fileType: string
): Promise<{ success: boolean; data: SettlementExtractedData | null; error?: string }> {
  try {
    const base64Content = await getDocumentContent(storagePath);

    const content =
      fileType === "application/pdf"
        ? [
            { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Content } },
            { type: "text" as const, text: SETTLEMENT_EXTRACTION_PROMPT },
          ]
        : [
            { type: "image" as const, source: { type: "base64" as const, media_type: getMediaType(fileType), data: base64Content } },
            { type: "text" as const, text: SETTLEMENT_EXTRACTION_PROMPT },
          ];

    const message = await getAnthropic().messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    });

    const textContent = message.content[0];
    if (textContent.type !== "text") {
      return { success: false, data: null, error: "Unexpected response type" };
    }

    const data = parseSettlementResponse(textContent.text);
    if (data.error) {
      return { success: false, data, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/settlement-extract.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/server/services/settlement-extract.ts src/server/services/__tests__/settlement-extract.test.ts
git commit -m "feat(settlement): add settlement statement extraction service with tests"
```

---

### Task 2: Settlement Router

Create a tRPC router with procedures for extracting a settlement statement and confirming the extracted data as transactions.

**Files:**
- Create: `src/server/routers/settlement.ts`
- Modify: `src/server/routers/_app.ts` (add settlement router)

**Step 1: Write the settlement router**

Create `src/server/routers/settlement.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, writeProcedure, protectedProcedure } from "../trpc";
import { properties, documents, transactions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { extractSettlement } from "../services/settlement-extract";
import { supabaseAdmin } from "@/lib/supabase/server";

export const settlementRouter = router({
  /**
   * Extract settlement data from an uploaded document
   */
  extract: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        storagePath: z.string().min(1),
        fileType: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const result = await extractSettlement(input.storagePath, input.fileType);

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to extract settlement data",
        });
      }

      return result.data;
    }),

  /**
   * Confirm extracted settlement data — creates capital cost transactions
   */
  confirm: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        purchasePrice: z.number().positive().optional(),
        settlementDate: z.string().optional(),
        items: z.array(
          z.object({
            category: z.enum([
              "stamp_duty",
              "conveyancing",
              "buyers_agent_fees",
              "initial_repairs",
            ]),
            description: z.string().min(1),
            amount: z.number().positive(),
            date: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, purchasePrice, settlementDate, items } = input;

      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Update purchase price and date if extracted
      if (purchasePrice || settlementDate) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (purchasePrice) updates.purchasePrice = String(purchasePrice);
        if (settlementDate) updates.purchaseDate = settlementDate;

        await ctx.db
          .update(properties)
          .set(updates)
          .where(eq(properties.id, propertyId));
      }

      // Create capital cost transactions
      const created = [];
      for (const item of items) {
        const [tx] = await ctx.db
          .insert(transactions)
          .values({
            userId: ctx.portfolio.ownerId,
            propertyId,
            date: item.date,
            description: item.description,
            amount: String(item.amount * -1), // Capital costs stored as negative
            category: item.category,
            transactionType: "expense",
            status: "confirmed",
          })
          .returning();
        created.push(tx);
      }

      return { created: created.length, transactions: created };
    }),

  /**
   * Get settlement documents for a property
   */
  getForProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const docs = await ctx.db.query.documents.findMany({
        where: and(
          eq(documents.propertyId, input.propertyId),
          eq(documents.userId, ctx.portfolio.ownerId),
          eq(documents.category, "contract")
        ),
        orderBy: (d, { desc }) => [desc(d.createdAt)],
      });

      return docs;
    }),
});
```

**Step 2: Register the router in `_app.ts`**

Add the settlement router import and registration to `src/server/routers/_app.ts`.

Find the existing imports and add:
```typescript
import { settlementRouter } from "./settlement";
```

Find the router definition and add:
```typescript
settlement: settlementRouter,
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/settlement.ts src/server/routers/_app.ts
git commit -m "feat(settlement): add settlement router with extract and confirm procedures"
```

---

### Task 3: Settlement Upload Component

Create a React component that handles the settlement upload flow: upload PDF → show extracted data → let user review/edit → confirm to create transactions.

**Files:**
- Create: `src/components/settlement/SettlementUpload.tsx`

**Step 1: Write the component**

Create `src/components/settlement/SettlementUpload.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";
import type { SettlementExtractedData } from "@/server/services/settlement-extract";

type CapitalCategory =
  | "stamp_duty"
  | "conveyancing"
  | "buyers_agent_fees"
  | "initial_repairs";

interface CostItem {
  category: CapitalCategory;
  description: string;
  amount: number;
  date: string;
}

const CATEGORY_LABELS: Record<CapitalCategory, string> = {
  stamp_duty: "Stamp Duty",
  conveyancing: "Conveyancing / Legal Fees",
  buyers_agent_fees: "Buyer's Agent Fees",
  initial_repairs: "Initial Repairs",
};

interface SettlementUploadProps {
  propertyId: string;
  purchaseDate: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function SettlementUpload({
  propertyId,
  purchaseDate,
  onComplete,
  onSkip,
}: SettlementUploadProps) {
  const [step, setStep] = useState<"upload" | "extracting" | "review">("upload");
  const [extractedData, setExtractedData] = useState<SettlementExtractedData | null>(null);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [settlementDate, setSettlementDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();
  const extractMutation = trpc.settlement.extract.useMutation();
  const confirmMutation = trpc.settlement.confirm.useMutation();

  const handleUpload = async (file: File) => {
    setError(null);
    setStep("extracting");

    try {
      // Get signed upload URL
      const { signedUrl, storagePath, token } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/heic",
        fileSize: file.size,
        propertyId,
      });

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(storagePath, token, file);

      if (uploadError) throw new Error(uploadError.message);

      // Create document record
      await createDocument.mutateAsync({
        storagePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        propertyId,
        category: "contract",
      });

      // Extract settlement data
      const data = await extractMutation.mutateAsync({
        propertyId,
        storagePath,
        fileType: file.type,
      });

      setExtractedData(data);

      // Pre-populate review form from extracted data
      if (data.purchasePrice) setPurchasePrice(String(data.purchasePrice));
      if (data.settlementDate) setSettlementDate(data.settlementDate);

      const items: CostItem[] = [];
      const date = data.settlementDate || purchaseDate;

      if (data.stampDuty) {
        items.push({
          category: "stamp_duty",
          description: "Stamp Duty (Transfer Duty)",
          amount: data.stampDuty,
          date,
        });
      }
      if (data.legalFees) {
        items.push({
          category: "conveyancing",
          description: "Conveyancing / Legal Fees",
          amount: data.legalFees,
          date,
        });
      }
      if (data.titleSearchFees) {
        items.push({
          category: "conveyancing",
          description: "Title Search Fees",
          amount: data.titleSearchFees,
          date,
        });
      }
      if (data.registrationFees) {
        items.push({
          category: "conveyancing",
          description: "Registration Fees",
          amount: data.registrationFees,
          date,
        });
      }

      setCostItems(items);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process settlement statement");
      setStep("upload");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && handleUpload(files[0]),
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    disabled: step !== "upload",
  });

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync({
        propertyId,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        settlementDate: settlementDate || undefined,
        items: costItems,
      });
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settlement data");
    }
  };

  const addItem = () => {
    setCostItems([
      ...costItems,
      {
        category: "conveyancing",
        description: "",
        amount: 0,
        date: settlementDate || purchaseDate,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setCostItems(costItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<CostItem>) => {
    setCostItems(
      costItems.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  if (step === "extracting") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            Extracting settlement data...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === "review" && extractedData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Settlement Data</CardTitle>
              <CardDescription>
                Verify the extracted data and confirm to add acquisition costs to your cost base.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {Math.round(extractedData.confidence * 100)}% confident
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Purchase details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Price ($)</Label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Purchase price"
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement Date</Label>
              <Input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
              />
            </div>
          </div>

          {/* Cost items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Acquisition Costs</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {costItems.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No acquisition costs extracted. Click &quot;Add Item&quot; to add manually.
              </p>
            )}

            {costItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    placeholder="Description"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.amount || ""}
                    onChange={(e) =>
                      updateItem(index, { amount: Number(e.target.value) })
                    }
                    placeholder="Amount"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {costItems.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Total Acquisition Costs</span>
                <span className="text-sm font-semibold">
                  ${costItems.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm & Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Upload step
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement Statement</CardTitle>
        <CardDescription>
          Upload your settlement statement to automatically extract stamp duty, legal fees, and other acquisition costs for your CGT cost base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive && "border-primary bg-primary/5",
            !isDragActive && "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive
                  ? "Drop settlement statement here"
                  : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG, or PNG (max 10MB)
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onSkip}>
            Skip — I&apos;ll add costs manually later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/settlement/SettlementUpload.tsx
git commit -m "feat(settlement): add SettlementUpload component with extract and review flow"
```

---

### Task 4: Post-Creation Settlement Prompt Page

After creating a property, redirect to a settlement upload page instead of going straight to `/properties`. This page lets the user upload their settlement statement or skip.

**Files:**
- Modify: `src/app/(dashboard)/properties/new/page.tsx`
- Create: `src/app/(dashboard)/properties/[id]/settlement/page.tsx`

**Step 1: Create the settlement page**

Create `src/app/(dashboard)/properties/[id]/settlement/page.tsx`:

```typescript
"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { SettlementUpload } from "@/components/settlement/SettlementUpload";

export default function PropertySettlementPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery({
    id: propertyId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold">Property not found</h2>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/properties")}
        >
          Back to Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/properties/${propertyId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Property
          </a>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          {property.address}, {property.suburb}
        </h1>
        <p className="text-muted-foreground mt-1">
          Add your settlement statement to build your CGT cost base
        </p>
      </div>

      <SettlementUpload
        propertyId={propertyId}
        purchaseDate={property.purchaseDate}
        onComplete={() => router.push(`/properties/${propertyId}`)}
        onSkip={() => router.push(`/properties/${propertyId}`)}
      />
    </div>
  );
}
```

**Step 2: Update the new property page to redirect to settlement**

Modify `src/app/(dashboard)/properties/new/page.tsx`:

Change the `onSuccess` callback in `createProperty` mutation from:
```typescript
onSuccess: () => {
  router.push("/properties");
},
```

To:
```typescript
onSuccess: (property) => {
  router.push(`/properties/${property.id}/settlement`);
},
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/settlement/page.tsx src/app/\(dashboard\)/properties/new/page.tsx
git commit -m "feat(settlement): add post-creation settlement upload page and redirect"
```

---

### Task 5: Add Settlement Link to Property Detail Page

Add a link on the property detail page to access the settlement upload, for users who skipped it during creation or want to update it.

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/layout.tsx`

**Step 1: Read the current layout**

Read `src/app/(dashboard)/properties/[id]/layout.tsx` to understand the navigation structure.

**Step 2: Add a "Settlement" nav item**

Add a navigation link for "Settlement" alongside existing items like "Documents". The exact implementation depends on the current nav structure — add it as a tab or sidebar link:

```typescript
{ label: "Settlement", href: `/properties/${propertyId}/settlement` },
```

This should go after the "Documents" link in the navigation array.

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/layout.tsx
git commit -m "feat(settlement): add settlement nav link to property detail page"
```

---

### Task 6: Integration Tests

Write integration-style tests for the settlement extraction and confirmation flow.

**Files:**
- Modify: `src/server/services/__tests__/settlement-extract.test.ts` (add edge cases)

**Step 1: Add edge case tests**

Add these tests to the existing settlement-extract test file:

```typescript
describe("parseSettlementResponse edge cases", () => {
  it("handles zero values correctly", () => {
    const response = JSON.stringify({
      purchasePrice: 0,
      stampDuty: 0,
      confidence: 0.5,
    });

    const result = parseSettlementResponse(response);
    // Zero is a valid number, should be preserved
    expect(result.purchasePrice).toBe(0);
    expect(result.stampDuty).toBe(0);
  });

  it("handles string values where numbers expected", () => {
    const response = JSON.stringify({
      purchasePrice: "750000",
      stampDuty: "not a number",
      confidence: 0.5,
    });

    const result = parseSettlementResponse(response);
    // String "750000" is not typeof number
    expect(result.purchasePrice).toBeNull();
    expect(result.stampDuty).toBeNull();
  });

  it("handles very large numbers", () => {
    const response = JSON.stringify({
      purchasePrice: 15000000,
      stampDuty: 825000,
      legalFees: 5000,
      confidence: 0.95,
    });

    const result = parseSettlementResponse(response);
    expect(result.purchasePrice).toBe(15000000);
    expect(result.stampDuty).toBe(825000);
  });

  it("handles adjustments with mixed types", () => {
    const response = JSON.stringify({
      purchasePrice: 600000,
      adjustments: [
        { description: "Council rates", amount: -500, type: "credit" },
        { description: "Strata levies", amount: 200, type: "debit" },
      ],
      confidence: 0.88,
    });

    const result = parseSettlementResponse(response);
    expect(result.adjustments).toHaveLength(2);
    expect(result.adjustments![0].amount).toBe(-500);
    expect(result.adjustments![1].type).toBe("debit");
  });
});
```

**Step 2: Run all tests**

Run: `npx vitest run src/server/services/__tests__/settlement-extract.test.ts`
Expected: PASS (all 12 tests)

**Step 3: Commit**

```bash
git add src/server/services/__tests__/settlement-extract.test.ts
git commit -m "test(settlement): add edge case tests for settlement extraction"
```

---

### Task 7: Final Verification

Run the full test suite and typecheck to verify nothing is broken.

**Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new settlement tests)

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit if any fixes needed**

If any fixes were required, commit them with an appropriate message.

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Settlement extraction service | `settlement-extract.ts`, test | — |
| 2 | Settlement tRPC router | `settlement.ts` | `_app.ts` |
| 3 | SettlementUpload component | `SettlementUpload.tsx` | — |
| 4 | Post-creation settlement page | `settlement/page.tsx` | `new/page.tsx` |
| 5 | Property nav link | — | `[id]/layout.tsx` |
| 6 | Edge case tests | — | test file |
| 7 | Final verification | — | — |

**Total new tests:** ~12 (8 initial + 4 edge cases)

**How CGT integration works:** Capital cost transactions (stamp_duty, conveyancing categories) are created as regular transactions. The existing `cgt.ts` service's `calculateCostBase()` already filters for `CAPITAL_CATEGORIES` and adds them to the purchase price. No CGT code changes needed — it just works.
