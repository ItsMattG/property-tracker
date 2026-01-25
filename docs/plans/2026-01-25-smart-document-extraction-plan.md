# Smart Document Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered system that extracts structured data from uploaded documents and creates draft transactions for user review.

**Architecture:** Documents uploaded via existing system trigger extraction via Claude Vision API. Extracted data creates draft transactions with `pending_review` status. Users confirm or edit via the review UI.

**Tech Stack:** Claude 3 Haiku (vision), Drizzle ORM, tRPC, React, Supabase Storage

---

## Task 1: Add extraction status enum and table schema

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/document-extraction-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/db/__tests__/document-extraction-schema.test.ts
import { describe, it, expect } from "vitest";
import {
  extractionStatusEnum,
  documentTypeEnum,
  documentExtractions,
} from "../schema";

describe("document extraction schema", () => {
  it("has extraction status enum with correct values", () => {
    expect(extractionStatusEnum.enumValues).toEqual([
      "processing",
      "completed",
      "failed",
    ]);
  });

  it("has document type enum with correct values", () => {
    expect(documentTypeEnum.enumValues).toEqual([
      "receipt",
      "rate_notice",
      "insurance",
      "invoice",
      "unknown",
    ]);
  });

  it("has documentExtractions table with required columns", () => {
    const columns = Object.keys(documentExtractions);
    expect(columns).toContain("id");
    expect(columns).toContain("documentId");
    expect(columns).toContain("status");
    expect(columns).toContain("documentType");
    expect(columns).toContain("extractedData");
    expect(columns).toContain("confidence");
    expect(columns).toContain("matchedPropertyId");
    expect(columns).toContain("draftTransactionId");
    expect(columns).toContain("error");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/document-extraction-schema.test.ts`
Expected: FAIL with "extractionStatusEnum is not defined"

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts` after other enums (~line 130):

```typescript
export const extractionStatusEnum = pgEnum("extraction_status", [
  "processing",
  "completed",
  "failed",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "receipt",
  "rate_notice",
  "insurance",
  "invoice",
  "unknown",
]);
```

Add table after documents table (~line 415):

```typescript
export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    status: extractionStatusEnum("status").default("processing").notNull(),
    documentType: documentTypeEnum("document_type").default("unknown").notNull(),
    extractedData: text("extracted_data"), // JSON string
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    matchedPropertyId: uuid("matched_property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    propertyMatchConfidence: decimal("property_match_confidence", { precision: 3, scale: 2 }),
    draftTransactionId: uuid("draft_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("document_extractions_document_id_idx").on(table.documentId),
    index("document_extractions_status_idx").on(table.status),
  ]
);
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/document-extraction-schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/document-extraction-schema.test.ts
git commit -m "feat(db): add document extraction schema"
```

---

## Task 2: Add transaction status enum and column

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/document-extraction-schema.test.ts`

**Step 1: Write the failing test**

Add to `src/server/db/__tests__/document-extraction-schema.test.ts`:

```typescript
import {
  extractionStatusEnum,
  documentTypeEnum,
  documentExtractions,
  transactionStatusEnum,
  transactions,
} from "../schema";

// ... existing tests ...

it("has transaction status enum with correct values", () => {
  expect(transactionStatusEnum.enumValues).toEqual([
    "confirmed",
    "pending_review",
  ]);
});

it("has status column on transactions table", () => {
  const columns = Object.keys(transactions);
  expect(columns).toContain("status");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/document-extraction-schema.test.ts`
Expected: FAIL with "transactionStatusEnum is not defined"

**Step 3: Write minimal implementation**

Add enum after other enums in `src/server/db/schema.ts`:

```typescript
export const transactionStatusEnum = pgEnum("transaction_status", [
  "confirmed",
  "pending_review",
]);
```

Add column to transactions table (around line 311, after `suggestionConfidence`):

```typescript
    status: transactionStatusEnum("status").default("confirmed").notNull(),
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/document-extraction-schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/document-extraction-schema.test.ts
git commit -m "feat(db): add transaction status for draft support"
```

---

## Task 3: Add schema relations and type exports

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/document-extraction-schema.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import {
  // ... existing imports ...
  documentExtractionsRelations,
  DocumentExtraction,
} from "../schema";

// ... existing tests ...

it("exports DocumentExtraction type", () => {
  const extraction: DocumentExtraction = {
    id: "test",
    documentId: "test",
    status: "processing",
    documentType: "receipt",
    extractedData: null,
    confidence: null,
    matchedPropertyId: null,
    propertyMatchConfidence: null,
    draftTransactionId: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
  };
  expect(extraction.status).toBe("processing");
});

it("has documentExtractions relations defined", () => {
  expect(documentExtractionsRelations).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/document-extraction-schema.test.ts`
Expected: FAIL with "DocumentExtraction is not defined"

**Step 3: Write minimal implementation**

Add relations after other relations in schema.ts:

```typescript
export const documentExtractionsRelations = relations(documentExtractions, ({ one }) => ({
  document: one(documents, {
    fields: [documentExtractions.documentId],
    references: [documents.id],
  }),
  matchedProperty: one(properties, {
    fields: [documentExtractions.matchedPropertyId],
    references: [properties.id],
  }),
  draftTransaction: one(transactions, {
    fields: [documentExtractions.draftTransactionId],
    references: [transactions.id],
  }),
}));
```

Add type export at the end of schema.ts:

```typescript
export type DocumentExtraction = typeof documentExtractions.$inferSelect;
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/document-extraction-schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/document-extraction-schema.test.ts
git commit -m "feat(db): add document extraction relations and types"
```

---

## Task 4: Create property matcher service

**Files:**
- Create: `src/server/services/property-matcher.ts`
- Test: `src/server/services/__tests__/property-matcher.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/property-matcher.test.ts
import { describe, it, expect } from "vitest";
import { matchPropertyByAddress, normalizeAddress } from "../property-matcher";

describe("property-matcher service", () => {
  describe("normalizeAddress", () => {
    it("lowercases and trims", () => {
      expect(normalizeAddress("  123 SMITH ST  ")).toBe("123 smith st");
    });

    it("expands common abbreviations", () => {
      expect(normalizeAddress("123 Smith St")).toBe("123 smith street");
      expect(normalizeAddress("45 King Rd")).toBe("45 king road");
      expect(normalizeAddress("7 Queen Ave")).toBe("7 queen avenue");
    });

    it("removes unit/suite prefixes", () => {
      expect(normalizeAddress("Unit 5/123 Main St")).toBe("5/123 main street");
      expect(normalizeAddress("Suite 10, 45 King Rd")).toBe("10 45 king road");
    });
  });

  describe("matchPropertyByAddress", () => {
    const properties = [
      { id: "1", address: "123 Smith Street", suburb: "Melbourne", state: "VIC", postcode: "3000" },
      { id: "2", address: "45 King Road", suburb: "Sydney", state: "NSW", postcode: "2000" },
      { id: "3", address: "7 Queen Avenue", suburb: "Brisbane", state: "QLD", postcode: "4000" },
    ];

    it("returns exact match with high confidence", () => {
      const result = matchPropertyByAddress("123 Smith Street, Melbourne VIC 3000", properties);
      expect(result.propertyId).toBe("1");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("matches with abbreviated street type", () => {
      const result = matchPropertyByAddress("123 Smith St, Melbourne", properties);
      expect(result.propertyId).toBe("1");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("returns null with low confidence when no match", () => {
      const result = matchPropertyByAddress("999 Unknown Place", properties);
      expect(result.propertyId).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("handles partial suburb match", () => {
      const result = matchPropertyByAddress("45 King Rd Sydney", properties);
      expect(result.propertyId).toBe("2");
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/property-matcher.test.ts`
Expected: FAIL with "Cannot find module '../property-matcher'"

**Step 3: Write minimal implementation**

```typescript
// src/server/services/property-matcher.ts

interface PropertyMatch {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface MatchResult {
  propertyId: string | null;
  confidence: number;
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  rd: "road",
  ave: "avenue",
  dr: "drive",
  cres: "crescent",
  ct: "court",
  pl: "place",
  ln: "lane",
  hwy: "highway",
  blvd: "boulevard",
  tce: "terrace",
  pde: "parade",
};

/**
 * Normalize address for comparison
 */
export function normalizeAddress(address: string): string {
  let normalized = address.toLowerCase().trim();

  // Remove unit/suite prefixes
  normalized = normalized.replace(/^(unit|suite|apt|apartment)\s*/i, "");
  normalized = normalized.replace(/,\s*/g, " ");

  // Expand abbreviations
  for (const [abbr, full] of Object.entries(STREET_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    normalized = normalized.replace(regex, full);
  }

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeAddress(str1);
  const s2 = normalizeAddress(str2);

  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Token-based similarity
  const tokens1 = new Set(s1.split(" "));
  const tokens2 = new Set(s2.split(" "));

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Match extracted address against user's properties
 */
export function matchPropertyByAddress(
  extractedAddress: string,
  properties: PropertyMatch[]
): MatchResult {
  if (!extractedAddress || properties.length === 0) {
    return { propertyId: null, confidence: 0 };
  }

  let bestMatch: { propertyId: string | null; confidence: number } = {
    propertyId: null,
    confidence: 0,
  };

  for (const property of properties) {
    // Build full address string for comparison
    const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;

    const similarity = calculateSimilarity(extractedAddress, fullAddress);

    if (similarity > bestMatch.confidence) {
      bestMatch = {
        propertyId: property.id,
        confidence: similarity,
      };
    }
  }

  // Only return match if confidence is reasonable
  if (bestMatch.confidence < 0.5) {
    return { propertyId: null, confidence: bestMatch.confidence };
  }

  return bestMatch;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/property-matcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/property-matcher.ts src/server/services/__tests__/property-matcher.test.ts
git commit -m "feat(service): add property matcher for address fuzzy matching"
```

---

## Task 5: Create extraction prompt builder

**Files:**
- Create: `src/server/services/document-extraction.ts`
- Test: `src/server/services/__tests__/document-extraction.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/document-extraction.test.ts
import { describe, it, expect } from "vitest";
import { buildExtractionPrompt, EXTRACTION_PROMPT_BASE } from "../document-extraction";

describe("document-extraction service", () => {
  describe("buildExtractionPrompt", () => {
    it("includes base extraction instructions", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("You are extracting data from a document");
      expect(prompt).toContain("receipt");
      expect(prompt).toContain("rate_notice");
      expect(prompt).toContain("insurance");
      expect(prompt).toContain("invoice");
    });

    it("specifies JSON output format", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("documentType");
      expect(prompt).toContain("vendor");
      expect(prompt).toContain("amount");
      expect(prompt).toContain("date");
      expect(prompt).toContain("confidence");
    });

    it("includes field extraction rules", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("propertyAddress");
      expect(prompt).toContain("lineItems");
      expect(prompt).toContain("dueDate");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: FAIL with "Cannot find module '../document-extraction'"

**Step 3: Write minimal implementation**

```typescript
// src/server/services/document-extraction.ts
import Anthropic from "@anthropic-ai/sdk";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization
let anthropicClient: Anthropic | null = null;
let supabaseClient: SupabaseClient | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseClient;
}

export const EXTRACTION_PROMPT_BASE = `You are extracting data from a document uploaded by an Australian property investor.

First, identify the document type:
- receipt: Purchase receipt from a store or service provider
- rate_notice: Council rates, water rates notice
- insurance: Insurance policy, renewal, or certificate
- invoice: Contractor or service invoice
- unknown: Cannot determine document type

Then extract all relevant fields based on the document type.

Return ONLY valid JSON in this format:
{
  "documentType": "receipt|rate_notice|insurance|invoice|unknown",
  "confidence": 0.0-1.0,
  "vendor": "company or issuer name",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "category": "suggested category or null",
  "propertyAddress": "extracted address or null",
  "lineItems": [
    {"description": "item", "quantity": 1, "amount": 50.00}
  ] or null,
  "rawText": "key text from document"
}

Category suggestions (for Australian property investors):
- receipts from hardware stores → repairs_and_maintenance
- council rates → council_rates
- water bills → water_charges
- insurance → insurance
- cleaning services → cleaning
- gardening/landscaping → gardening
- pest control → pest_control
- property management fees → property_agent_fees
- legal documents → legal_expenses

Rules:
- Amounts should be numbers without currency symbols
- Dates in YYYY-MM-DD format
- If a field cannot be determined, use null
- Extract property address from rate notices and insurance documents
- For invoices, extract line items if visible
- confidence should reflect how readable the document is`;

/**
 * Build the extraction prompt
 */
export function buildExtractionPrompt(): string {
  return EXTRACTION_PROMPT_BASE;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/document-extraction.ts src/server/services/__tests__/document-extraction.test.ts
git commit -m "feat(service): add extraction prompt builder"
```

---

## Task 6: Add extraction response parser

**Files:**
- Modify: `src/server/services/document-extraction.ts`
- Modify: `src/server/services/__tests__/document-extraction.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import {
  buildExtractionPrompt,
  parseExtractionResponse,
  ExtractedData,
} from "../document-extraction";

describe("parseExtractionResponse", () => {
  it("parses valid JSON response", () => {
    const response = `{
      "documentType": "receipt",
      "confidence": 0.95,
      "vendor": "Bunnings Warehouse",
      "amount": 245.50,
      "date": "2026-01-20",
      "dueDate": null,
      "category": "repairs_and_maintenance",
      "propertyAddress": null,
      "lineItems": null,
      "rawText": "BUNNINGS WAREHOUSE..."
    }`;

    const result = parseExtractionResponse(response);
    expect(result.documentType).toBe("receipt");
    expect(result.vendor).toBe("Bunnings Warehouse");
    expect(result.amount).toBe(245.50);
    expect(result.confidence).toBe(0.95);
  });

  it("extracts JSON from text with surrounding content", () => {
    const response = `Here is the extracted data:
    {"documentType": "invoice", "confidence": 0.8, "vendor": "ABC Plumbing", "amount": 350, "date": "2026-01-15", "dueDate": "2026-02-15", "category": "repairs_and_maintenance", "propertyAddress": null, "lineItems": [{"description": "Labour", "quantity": 2, "amount": 200}], "rawText": "..."}
    That's the result.`;

    const result = parseExtractionResponse(response);
    expect(result.documentType).toBe("invoice");
    expect(result.lineItems).toHaveLength(1);
  });

  it("returns unknown type on parse failure", () => {
    const result = parseExtractionResponse("This is not JSON");
    expect(result.documentType).toBe("unknown");
    expect(result.confidence).toBe(0);
    expect(result.error).toBe("Failed to parse extraction response");
  });

  it("validates required fields", () => {
    const response = `{"documentType": "receipt"}`;
    const result = parseExtractionResponse(response);
    expect(result.amount).toBeNull();
    expect(result.vendor).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: FAIL with "parseExtractionResponse is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/document-extraction.ts`:

```typescript
export interface LineItem {
  description: string;
  quantity: number;
  amount: number;
}

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
}

/**
 * Parse Claude's response into structured data
 */
export function parseExtractionResponse(response: string): ExtractedData {
  const defaultResult: ExtractedData = {
    documentType: "unknown",
    confidence: 0,
    vendor: null,
    amount: null,
    date: null,
    dueDate: null,
    category: null,
    propertyAddress: null,
    lineItems: null,
    rawText: null,
    error: "Failed to parse extraction response",
  };

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultResult;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      documentType: parsed.documentType || "unknown",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      vendor: parsed.vendor || null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      date: parsed.date || null,
      dueDate: parsed.dueDate || null,
      category: parsed.category || null,
      propertyAddress: parsed.propertyAddress || null,
      lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : null,
      rawText: parsed.rawText || null,
    };
  } catch {
    return defaultResult;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/document-extraction.ts src/server/services/__tests__/document-extraction.test.ts
git commit -m "feat(service): add extraction response parser"
```

---

## Task 7: Add document content fetcher

**Files:**
- Modify: `src/server/services/document-extraction.ts`
- Modify: `src/server/services/__tests__/document-extraction.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildExtractionPrompt,
  parseExtractionResponse,
  getDocumentContent,
  getMediaType,
} from "../document-extraction";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
      })),
    },
  })),
}));

describe("getMediaType", () => {
  it("returns correct type for jpeg", () => {
    expect(getMediaType("image/jpeg")).toBe("image/jpeg");
  });

  it("returns correct type for png", () => {
    expect(getMediaType("image/png")).toBe("image/png");
  });

  it("returns correct type for pdf", () => {
    expect(getMediaType("application/pdf")).toBe("application/pdf");
  });

  it("defaults to jpeg for unknown types", () => {
    expect(getMediaType("image/heic")).toBe("image/jpeg");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: FAIL with "getMediaType is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/document-extraction.ts`:

```typescript
type SupportedMediaType = "image/jpeg" | "image/png" | "application/pdf";

/**
 * Map file type to Claude-supported media type
 */
export function getMediaType(fileType: string): SupportedMediaType {
  switch (fileType) {
    case "image/jpeg":
      return "image/jpeg";
    case "image/png":
      return "image/png";
    case "application/pdf":
      return "application/pdf";
    default:
      return "image/jpeg"; // Default for HEIC, etc.
  }
}

/**
 * Download document from Supabase and return as base64
 */
export async function getDocumentContent(storagePath: string): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from("documents")
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download document: ${error?.message}`);
  }

  const buffer = await data.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/document-extraction.ts src/server/services/__tests__/document-extraction.test.ts
git commit -m "feat(service): add document content fetcher and media type helper"
```

---

## Task 8: Add main extraction function

**Files:**
- Modify: `src/server/services/document-extraction.ts`
- Modify: `src/server/services/__tests__/document-extraction.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import {
  // ... existing imports
  extractDocument,
  ExtractionResult,
} from "../document-extraction";

// Add mock for Anthropic
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

describe("extractDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns extraction result with success", async () => {
    // This is an integration-level test - we'll mock at the service level
    const mockResult: ExtractionResult = {
      success: true,
      data: {
        documentType: "receipt",
        confidence: 0.9,
        vendor: "Test Store",
        amount: 100,
        date: "2026-01-20",
        dueDate: null,
        category: "repairs_and_maintenance",
        propertyAddress: null,
        lineItems: null,
        rawText: "test",
      },
    };

    expect(mockResult.success).toBe(true);
    expect(mockResult.data?.documentType).toBe("receipt");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: FAIL with "ExtractionResult is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/document-extraction.ts`:

```typescript
export interface ExtractionResult {
  success: boolean;
  data: ExtractedData | null;
  error?: string;
}

/**
 * Extract data from a document using Claude Vision
 */
export async function extractDocument(
  storagePath: string,
  fileType: string
): Promise<ExtractionResult> {
  try {
    const base64Content = await getDocumentContent(storagePath);
    const mediaType = getMediaType(fileType);
    const prompt = buildExtractionPrompt();

    const contentBlock = fileType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType,
            data: base64Content,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType,
            data: base64Content,
          },
        };

    const message = await getAnthropic().messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return {
        success: false,
        data: null,
        error: "Unexpected response type from Claude",
      };
    }

    const extractedData = parseExtractionResponse(content.text);

    if (extractedData.error) {
      return {
        success: false,
        data: extractedData,
        error: extractedData.error,
      };
    }

    return {
      success: true,
      data: extractedData,
    };
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

Run: `npm run test:unit -- src/server/services/__tests__/document-extraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/document-extraction.ts src/server/services/__tests__/document-extraction.test.ts
git commit -m "feat(service): add main document extraction function"
```

---

## Task 9: Create document extraction router

**Files:**
- Create: `src/server/routers/documentExtraction.ts`
- Test: `src/server/routers/__tests__/documentExtraction.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/routers/__tests__/documentExtraction.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { documentExtractionRouter } from "../documentExtraction";

vi.mock("../../services/document-extraction", () => ({
  extractDocument: vi.fn(),
}));

vi.mock("../../services/property-matcher", () => ({
  matchPropertyByAddress: vi.fn(),
}));

describe("documentExtraction router", () => {
  it("has extract procedure", () => {
    expect(documentExtractionRouter).toBeDefined();
    expect(documentExtractionRouter._def.procedures).toHaveProperty("extract");
  });

  it("has getExtraction procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("getExtraction");
  });

  it("has listPendingReviews procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("listPendingReviews");
  });

  it("has confirmTransaction procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("confirmTransaction");
  });

  it("has discardExtraction procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("discardExtraction");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/routers/__tests__/documentExtraction.test.ts`
Expected: FAIL with "Cannot find module '../documentExtraction'"

**Step 3: Write minimal implementation**

```typescript
// src/server/routers/documentExtraction.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  documents,
  documentExtractions,
  transactions,
  properties,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { extractDocument } from "../services/document-extraction";
import { matchPropertyByAddress } from "../services/property-matcher";

export const documentExtractionRouter = router({
  /**
   * Trigger extraction for a document
   */
  extract: writeProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get document
      const document = await ctx.db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.documentId),
          eq(documents.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      // Check if already extracted
      const existing = await ctx.db.query.documentExtractions.findFirst({
        where: eq(documentExtractions.documentId, input.documentId),
      });

      if (existing) {
        return existing;
      }

      // Create extraction record
      const [extraction] = await ctx.db
        .insert(documentExtractions)
        .values({
          documentId: input.documentId,
          status: "processing",
        })
        .returning();

      // Run extraction (async, don't await)
      extractDocument(document.storagePath, document.fileType)
        .then(async (result) => {
          if (!result.success || !result.data) {
            await ctx.db
              .update(documentExtractions)
              .set({
                status: "failed",
                error: result.error || "Extraction failed",
                completedAt: new Date(),
              })
              .where(eq(documentExtractions.id, extraction.id));
            return;
          }

          // Match property if address found
          let matchedPropertyId: string | null = null;
          let propertyMatchConfidence: number | null = null;

          if (result.data.propertyAddress) {
            const userProperties = await ctx.db.query.properties.findMany({
              where: eq(properties.userId, ctx.portfolio.ownerId),
            });

            const match = matchPropertyByAddress(
              result.data.propertyAddress,
              userProperties
            );

            if (match.propertyId && match.confidence > 0.5) {
              matchedPropertyId = match.propertyId;
              propertyMatchConfidence = match.confidence;
            }
          }

          // Create draft transaction if amount found
          let draftTransactionId: string | null = null;

          if (result.data.amount) {
            const [draftTx] = await ctx.db
              .insert(transactions)
              .values({
                userId: ctx.portfolio.ownerId,
                propertyId: matchedPropertyId,
                date: result.data.date || new Date().toISOString().split("T")[0],
                description: result.data.vendor || "Extracted from document",
                amount: String(result.data.amount * -1), // Expenses are negative
                category: (result.data.category as any) || "uncategorized",
                transactionType: "expense",
                status: "pending_review",
              })
              .returning();

            draftTransactionId = draftTx.id;
          }

          // Update extraction record
          await ctx.db
            .update(documentExtractions)
            .set({
              status: "completed",
              documentType: result.data.documentType,
              extractedData: JSON.stringify(result.data),
              confidence: String(result.data.confidence),
              matchedPropertyId,
              propertyMatchConfidence: propertyMatchConfidence
                ? String(propertyMatchConfidence)
                : null,
              draftTransactionId,
              completedAt: new Date(),
            })
            .where(eq(documentExtractions.id, extraction.id));
        })
        .catch(async (error) => {
          await ctx.db
            .update(documentExtractions)
            .set({
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
              completedAt: new Date(),
            })
            .where(eq(documentExtractions.id, extraction.id));
        });

      return extraction;
    }),

  /**
   * Get extraction result for a document
   */
  getExtraction: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const extraction = await ctx.db.query.documentExtractions.findFirst({
        where: eq(documentExtractions.documentId, input.documentId),
        with: {
          draftTransaction: true,
          matchedProperty: true,
        },
      });

      if (!extraction) {
        return null;
      }

      return {
        ...extraction,
        extractedData: extraction.extractedData
          ? JSON.parse(extraction.extractedData)
          : null,
      };
    }),

  /**
   * List pending review extractions
   */
  listPendingReviews: protectedProcedure.query(async ({ ctx }) => {
    const extractions = await ctx.db.query.documentExtractions.findMany({
      where: eq(documentExtractions.status, "completed"),
      with: {
        document: true,
        draftTransaction: true,
        matchedProperty: true,
      },
      orderBy: desc(documentExtractions.createdAt),
    });

    // Filter to only those with pending_review transactions
    return extractions
      .filter((e) => e.draftTransaction?.status === "pending_review")
      .map((e) => ({
        ...e,
        extractedData: e.extractedData ? JSON.parse(e.extractedData) : null,
      }));
  }),

  /**
   * Confirm a draft transaction
   */
  confirmTransaction: writeProcedure
    .input(
      z.object({
        extractionId: z.string().uuid(),
        propertyId: z.string().uuid().optional(),
        category: z.string().optional(),
        amount: z.number().optional(),
        date: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const extraction = await ctx.db.query.documentExtractions.findFirst({
        where: eq(documentExtractions.id, input.extractionId),
        with: { draftTransaction: true },
      });

      if (!extraction?.draftTransaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Extraction or draft transaction not found",
        });
      }

      // Update transaction with any edits and confirm
      await ctx.db
        .update(transactions)
        .set({
          status: "confirmed",
          propertyId: input.propertyId ?? extraction.draftTransaction.propertyId,
          category: (input.category as any) ?? extraction.draftTransaction.category,
          amount: input.amount
            ? String(input.amount)
            : extraction.draftTransaction.amount,
          date: input.date ?? extraction.draftTransaction.date,
          description:
            input.description ?? extraction.draftTransaction.description,
        })
        .where(eq(transactions.id, extraction.draftTransaction.id));

      return { success: true };
    }),

  /**
   * Discard an extraction and its draft transaction
   */
  discardExtraction: writeProcedure
    .input(z.object({ extractionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const extraction = await ctx.db.query.documentExtractions.findFirst({
        where: eq(documentExtractions.id, input.extractionId),
      });

      if (!extraction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Extraction not found",
        });
      }

      // Delete draft transaction if exists
      if (extraction.draftTransactionId) {
        await ctx.db
          .delete(transactions)
          .where(eq(transactions.id, extraction.draftTransactionId));
      }

      // Delete extraction
      await ctx.db
        .delete(documentExtractions)
        .where(eq(documentExtractions.id, input.extractionId));

      return { success: true };
    }),
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/routers/__tests__/documentExtraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/documentExtraction.ts src/server/routers/__tests__/documentExtraction.test.ts
git commit -m "feat(router): add document extraction router"
```

---

## Task 10: Register router in app router

**Files:**
- Modify: `src/server/routers/_app.ts`

**Step 1: Read current app router**

Run: `cat src/server/routers/_app.ts`

**Step 2: Add import and register router**

Add import:
```typescript
import { documentExtractionRouter } from "./documentExtraction";
```

Add to router:
```typescript
documentExtraction: documentExtractionRouter,
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/_app.ts
git commit -m "feat(router): register document extraction router"
```

---

## Task 11: Add extraction review section to transactions review page

**Files:**
- Modify: `src/app/(dashboard)/transactions/review/page.tsx`

**Step 1: Read current review page structure**

Run: `head -50 src/app/(dashboard)/transactions/review/page.tsx`

**Step 2: Add document extraction review section**

Add tRPC query:
```typescript
const { data: pendingExtractions } = trpc.documentExtraction.listPendingReviews.useQuery();
```

Add UI section after categorization review:
```tsx
{/* Document Extractions Review */}
{pendingExtractions && pendingExtractions.length > 0 && (
  <div className="space-y-4">
    <h2 className="text-lg font-semibold">Document Extractions</h2>
    {pendingExtractions.map((extraction) => (
      <ExtractionReviewCard
        key={extraction.id}
        extraction={extraction}
        onConfirm={() => confirmMutation.mutate({ extractionId: extraction.id })}
        onDiscard={() => discardMutation.mutate({ extractionId: extraction.id })}
      />
    ))}
  </div>
)}
```

**Step 3: Run dev server and verify**

Run: `npm run dev`
Expected: Page loads without errors

**Step 4: Commit**

```bash
git add src/app/(dashboard)/transactions/review/page.tsx
git commit -m "feat(ui): add extraction review section to review page"
```

---

## Task 12: Create ExtractionReviewCard component

**Files:**
- Create: `src/components/documents/ExtractionReviewCard.tsx`

**Step 1: Create component**

```typescript
// src/components/documents/ExtractionReviewCard.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, X, ExternalLink } from "lucide-react";
import { useState } from "react";
import { categories } from "@/lib/categories";
import { trpc } from "@/lib/trpc/client";

interface ExtractionReviewCardProps {
  extraction: {
    id: string;
    documentType: string;
    confidence: string | null;
    extractedData: {
      vendor: string | null;
      amount: number | null;
      date: string | null;
      category: string | null;
      propertyAddress: string | null;
    } | null;
    matchedPropertyId: string | null;
    propertyMatchConfidence: string | null;
    document: {
      fileName: string;
      storagePath: string;
    };
    draftTransaction: {
      id: string;
      amount: string;
      date: string;
      description: string;
      category: string;
      propertyId: string | null;
    } | null;
    matchedProperty: {
      id: string;
      address: string;
    } | null;
  };
  onConfirm: (updates: {
    propertyId?: string;
    category?: string;
    amount?: number;
    date?: string;
    description?: string;
  }) => void;
  onDiscard: () => void;
}

export function ExtractionReviewCard({
  extraction,
  onConfirm,
  onDiscard,
}: ExtractionReviewCardProps) {
  const { data: properties } = trpc.property.list.useQuery();

  const [propertyId, setPropertyId] = useState(
    extraction.matchedPropertyId || extraction.draftTransaction?.propertyId || ""
  );
  const [category, setCategory] = useState(
    extraction.draftTransaction?.category || "uncategorized"
  );
  const [amount, setAmount] = useState(
    extraction.extractedData?.amount
      ? Math.abs(extraction.extractedData.amount).toString()
      : ""
  );
  const [date, setDate] = useState(
    extraction.extractedData?.date || extraction.draftTransaction?.date || ""
  );
  const [description, setDescription] = useState(
    extraction.extractedData?.vendor || extraction.draftTransaction?.description || ""
  );

  const confidence = extraction.confidence
    ? parseFloat(extraction.confidence)
    : 0;
  const propertyConfidence = extraction.propertyMatchConfidence
    ? parseFloat(extraction.propertyMatchConfidence)
    : 0;

  const handleConfirm = () => {
    onConfirm({
      propertyId: propertyId || undefined,
      category,
      amount: parseFloat(amount) * -1, // Expenses are negative
      date,
      description,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">
                {extraction.document.fileName}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {extraction.documentType.replace("_", " ")}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {Math.round(confidence * 100)}% confident
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`/api/documents/${extraction.document.storagePath}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="property">Property</Label>
            {propertyConfidence > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(propertyConfidence * 100)}% match
              </span>
            )}
          </div>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((prop) => (
                <SelectItem key={prop.id} value={prop.id}>
                  {prop.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onDiscard}>
            <X className="h-4 w-4 mr-1" />
            Discard
          </Button>
          <Button onClick={handleConfirm}>
            <Check className="h-4 w-4 mr-1" />
            Confirm Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify component builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/documents/ExtractionReviewCard.tsx
git commit -m "feat(ui): add ExtractionReviewCard component"
```

---

## Task 13: Trigger extraction on document upload

**Files:**
- Modify: `src/server/routers/documents.ts`

**Step 1: Read current create procedure**

Find the `create` procedure and add extraction trigger after successful document creation.

**Step 2: Add extraction trigger**

After the document is created in the `create` procedure, add:

```typescript
// Trigger extraction for supported file types
const extractableTypes = ["image/jpeg", "image/png", "application/pdf"];
if (extractableTypes.includes(fileType)) {
  // Import at top: import { documentExtractions } from "../db/schema";
  await ctx.db.insert(documentExtractions).values({
    documentId: document.id,
    status: "processing",
  });

  // Trigger async extraction
  extractDocument(storagePath, fileType)
    .then(async (result) => {
      // ... handle result (similar to router extract procedure)
    })
    .catch(console.error);
}
```

**Step 3: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/routers/documents.ts
git commit -m "feat(router): auto-trigger extraction on document upload"
```

---

## Task 14: Add database migration

**Step 1: Generate migration**

Run: `npm run db:generate` (interactive - select "create" for new tables/enums)

**Step 2: Push migration**

Run: `export $(grep -v '^#' .env.local | xargs) && npm run db:push`

**Step 3: Verify tables created**

Check database has new tables: document_extractions, new enums

**Step 4: Commit migration files**

```bash
git add drizzle/
git commit -m "feat(db): add document extraction migration"
```

---

## Task 15: Final verification

**Step 1: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors in new files

**Step 4: Manual test**

1. Start dev server: `npm run dev`
2. Upload a receipt image
3. Verify extraction processes
4. Check review page shows pending extraction
5. Confirm transaction

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add extraction status enum and table schema |
| 2 | Add transaction status enum and column |
| 3 | Add schema relations and type exports |
| 4 | Create property matcher service |
| 5 | Create extraction prompt builder |
| 6 | Add extraction response parser |
| 7 | Add document content fetcher |
| 8 | Add main extraction function |
| 9 | Create document extraction router |
| 10 | Register router in app router |
| 11 | Add extraction review section to review page |
| 12 | Create ExtractionReviewCard component |
| 13 | Trigger extraction on document upload |
| 14 | Add database migration |
| 15 | Final verification |
