# Vector DB Similar Properties Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build ML-powered property recommendations using pgvector on Supabase, enabling users to discover similar properties from their portfolio, community data, and manually-added listings.

**Architecture:** Structured 5-dimension feature vectors (location cluster, property type, price bracket, yield, growth) stored in PostgreSQL with pgvector extension. Three entry points: property detail page, dashboard widget, and dedicated /discover page. Privacy-controlled community sharing with anonymous/pseudonymous/controlled tiers.

**Tech Stack:** Next.js 16, tRPC, Drizzle ORM, pgvector, Claude API (for listing extraction), Supabase PostgreSQL

**Design Doc:** `docs/plans/2026-01-26-vector-db-similar-properties-design.md`

---

## Phase 1: Core Infrastructure

### Task 1: Enable pgvector Extension

**Files:**
- Create: `supabase/migrations/20260126000001_enable_pgvector.sql`

**Step 1: Create migration file**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 2: Apply migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/20260126000001_enable_pgvector.sql
git commit -m "feat(db): enable pgvector extension"
```

---

### Task 2: Add Schema - Share Level Enum

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/schema-similar-properties.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/db/__tests__/schema-similar-properties.test.ts
import { describe, it, expect } from "vitest";
import { shareLevelEnum } from "../schema";

describe("Similar Properties Schema", () => {
  describe("shareLevelEnum", () => {
    it("has correct values", () => {
      expect(shareLevelEnum.enumValues).toEqual([
        "none",
        "anonymous",
        "pseudonymous",
        "controlled",
      ]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`
Expected: FAIL with "shareLevelEnum is not defined"

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts` after other enums (~line 354):

```typescript
export const shareLevelEnum = pgEnum("share_level", [
  "none",
  "anonymous",
  "pseudonymous",
  "controlled",
]);

export const listingSourceTypeEnum = pgEnum("listing_source_type", [
  "url",
  "text",
  "manual",
]);

export const propertyTypeEnum = pgEnum("property_type", [
  "house",
  "townhouse",
  "unit",
]);
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-similar-properties.test.ts
git commit -m "feat(db): add enums for similar properties feature"
```

---

### Task 3: Add Schema - External Listings Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/schema-similar-properties.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import { externalListings } from "../schema";

describe("externalListings table", () => {
  it("has required columns", () => {
    const columns = Object.keys(externalListings);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("sourceType");
    expect(columns).toContain("extractedData");
    expect(columns).toContain("suburb");
    expect(columns).toContain("state");
    expect(columns).toContain("postcode");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts` after the enums:

```typescript
export const externalListings = pgTable(
  "external_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sourceType: listingSourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    rawInput: text("raw_input"),
    extractedData: jsonb("extracted_data").notNull(),
    suburb: text("suburb").notNull(),
    state: stateEnum("state").notNull(),
    postcode: text("postcode").notNull(),
    propertyType: propertyTypeEnum("property_type").default("house").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }),
    estimatedYield: decimal("estimated_yield", { precision: 5, scale: 2 }),
    estimatedGrowth: decimal("estimated_growth", { precision: 5, scale: 2 }),
    isEstimated: boolean("is_estimated").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("external_listings_user_id_idx").on(table.userId)]
);
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-similar-properties.test.ts
git commit -m "feat(db): add externalListings table"
```

---

### Task 4: Add Schema - Property Vectors Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/schema-similar-properties.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import { propertyVectors } from "../schema";

describe("propertyVectors table", () => {
  it("has required columns", () => {
    const columns = Object.keys(propertyVectors);
    expect(columns).toContain("id");
    expect(columns).toContain("propertyId");
    expect(columns).toContain("externalListingId");
    expect(columns).toContain("userId");
    expect(columns).toContain("vector");
    expect(columns).toContain("isShared");
    expect(columns).toContain("shareLevel");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts`:

```typescript
import { customType } from "drizzle-orm/pg-core";

// Custom type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(5)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,0.3,0.4,0.5]" format
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => parseFloat(v));
  },
});

export const propertyVectors = pgTable(
  "property_vectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    externalListingId: uuid("external_listing_id").references(
      () => externalListings.id,
      { onDelete: "cascade" }
    ),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    vector: vector("vector").notNull(),
    isShared: boolean("is_shared").default(false).notNull(),
    shareLevel: shareLevelEnum("share_level").default("none").notNull(),
    sharedAttributes: jsonb("shared_attributes").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_vectors_user_id_idx").on(table.userId),
    index("property_vectors_property_id_idx").on(table.propertyId),
    index("property_vectors_is_shared_idx").on(table.isShared),
  ]
);
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-similar-properties.test.ts
git commit -m "feat(db): add propertyVectors table with pgvector support"
```

---

### Task 5: Add Schema - Sharing Preferences Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/schema-similar-properties.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
import { sharingPreferences } from "../schema";

describe("sharingPreferences table", () => {
  it("has required columns", () => {
    const columns = Object.keys(sharingPreferences);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("defaultShareLevel");
    expect(columns).toContain("defaultSharedAttributes");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts`:

```typescript
export const sharingPreferences = pgTable("sharing_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  defaultShareLevel: shareLevelEnum("default_share_level").default("none").notNull(),
  defaultSharedAttributes: jsonb("default_shared_attributes")
    .$type<string[]>()
    .default(["suburb", "state", "propertyType", "priceBracket", "yield"])
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/__tests__/schema-similar-properties.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-similar-properties.test.ts
git commit -m "feat(db): add sharingPreferences table"
```

---

### Task 6: Add Schema Relations

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add relations for new tables**

Add to schema.ts relations section:

```typescript
export const externalListingsRelations = relations(externalListings, ({ one }) => ({
  user: one(users, {
    fields: [externalListings.userId],
    references: [users.id],
  }),
}));

export const propertyVectorsRelations = relations(propertyVectors, ({ one }) => ({
  user: one(users, {
    fields: [propertyVectors.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [propertyVectors.propertyId],
    references: [properties.id],
  }),
  externalListing: one(externalListings, {
    fields: [propertyVectors.externalListingId],
    references: [externalListings.id],
  }),
}));

export const sharingPreferencesRelations = relations(sharingPreferences, ({ one }) => ({
  user: one(users, {
    fields: [sharingPreferences.userId],
    references: [users.id],
  }),
}));
```

Also update `propertiesRelations` to include:

```typescript
propertyVector: one(propertyVectors),
```

**Step 2: Run all tests to verify nothing broke**

Run: `npm run test:unit`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add relations for similar properties tables"
```

---

### Task 7: Create Database Migration

**Files:**
- Create: `supabase/migrations/20260126000002_similar_properties_tables.sql`

**Step 1: Create migration file**

```sql
-- Create enums
CREATE TYPE share_level AS ENUM ('none', 'anonymous', 'pseudonymous', 'controlled');
CREATE TYPE listing_source_type AS ENUM ('url', 'text', 'manual');
CREATE TYPE property_type AS ENUM ('house', 'townhouse', 'unit');

-- Create external_listings table
CREATE TABLE external_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type listing_source_type NOT NULL,
  source_url TEXT,
  raw_input TEXT,
  extracted_data JSONB NOT NULL,
  suburb TEXT NOT NULL,
  state state NOT NULL,
  postcode TEXT NOT NULL,
  property_type property_type DEFAULT 'house' NOT NULL,
  price DECIMAL(12, 2),
  estimated_yield DECIMAL(5, 2),
  estimated_growth DECIMAL(5, 2),
  is_estimated BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX external_listings_user_id_idx ON external_listings(user_id);

-- Create property_vectors table
CREATE TABLE property_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  external_listing_id UUID REFERENCES external_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vector vector(5) NOT NULL,
  is_shared BOOLEAN DEFAULT false NOT NULL,
  share_level share_level DEFAULT 'none' NOT NULL,
  shared_attributes JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT vector_source_check CHECK (
    (property_id IS NOT NULL AND external_listing_id IS NULL) OR
    (property_id IS NULL AND external_listing_id IS NOT NULL)
  )
);

CREATE INDEX property_vectors_user_id_idx ON property_vectors(user_id);
CREATE INDEX property_vectors_property_id_idx ON property_vectors(property_id);
CREATE INDEX property_vectors_is_shared_idx ON property_vectors(is_shared);

-- Create IVFFlat index for similarity search (optimize for ~10k vectors initially)
CREATE INDEX property_vectors_vector_idx ON property_vectors
  USING ivfflat (vector vector_l2_ops) WITH (lists = 100);

-- Create sharing_preferences table
CREATE TABLE sharing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  default_share_level share_level DEFAULT 'none' NOT NULL,
  default_shared_attributes JSONB DEFAULT '["suburb", "state", "propertyType", "priceBracket", "yield"]' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260126000002_similar_properties_tables.sql
git commit -m "feat(db): add migration for similar properties tables"
```

---

## Phase 2: Vector Generation Service

### Task 8: Create Vector Generation Types

**Files:**
- Create: `src/types/similar-properties.ts`

**Step 1: Create types file**

```typescript
// src/types/similar-properties.ts

export interface PropertyVectorInput {
  state: string;
  suburb: string;
  propertyType: "house" | "townhouse" | "unit";
  currentValue: number;
  grossYield: number;
  capitalGrowthRate: number;
}

export interface SimilarProperty {
  id: string;
  type: "portfolio" | "external" | "community";
  suburb: string;
  state: string;
  propertyType: "house" | "townhouse" | "unit";
  priceBracket: string;
  yield: number | null;
  growth: number | null;
  distance: number;
  similarityScore: number; // 0-100
  isEstimated: boolean;
  // Only for portfolio properties
  propertyId?: string;
  address?: string;
  // Only for external listings
  externalListingId?: string;
  sourceUrl?: string;
}

export interface ExtractedListingData {
  address?: string;
  suburb: string;
  state: string;
  postcode: string;
  price?: number;
  propertyType: "house" | "townhouse" | "unit";
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  landSize?: number;
  estimatedRent?: number;
  features?: string[];
}

export type ShareLevel = "none" | "anonymous" | "pseudonymous" | "controlled";

export interface SharingPreferences {
  defaultShareLevel: ShareLevel;
  defaultSharedAttributes: string[];
}

export const SHAREABLE_ATTRIBUTES = [
  "suburb",
  "state",
  "propertyType",
  "priceBracket",
  "yield",
  "growth",
  "address",
  "purchasePrice",
  "username",
] as const;

export type ShareableAttribute = (typeof SHAREABLE_ATTRIBUTES)[number];
```

**Step 2: Commit**

```bash
git add src/types/similar-properties.ts
git commit -m "feat(types): add similar properties types"
```

---

### Task 9: Create Vector Generation Service - Core Logic

**Files:**
- Create: `src/server/services/vector-generation.ts`
- Test: `src/server/services/__tests__/vector-generation.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/vector-generation.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizePropertyType,
  normalizeLocationCluster,
  normalizePriceBracket,
  normalizeYield,
  normalizeGrowth,
  generatePropertyVector,
} from "../vector-generation";

describe("Vector Generation Service", () => {
  describe("normalizePropertyType", () => {
    it("returns 0.0 for house", () => {
      expect(normalizePropertyType("house")).toBe(0.0);
    });

    it("returns 0.5 for townhouse", () => {
      expect(normalizePropertyType("townhouse")).toBe(0.5);
    });

    it("returns 1.0 for unit", () => {
      expect(normalizePropertyType("unit")).toBe(1.0);
    });

    it("returns 0.5 for unknown types", () => {
      expect(normalizePropertyType("apartment")).toBe(0.5);
    });
  });

  describe("normalizeLocationCluster", () => {
    it("returns value between 0 and 1", () => {
      const result = normalizeLocationCluster("NSW", 800000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("returns higher value for premium suburbs", () => {
      const budget = normalizeLocationCluster("NSW", 400000);
      const premium = normalizeLocationCluster("NSW", 1500000);
      expect(premium).toBeGreaterThan(budget);
    });
  });

  describe("normalizePriceBracket", () => {
    it("returns 0.0 for very low prices", () => {
      expect(normalizePriceBracket(100000)).toBe(0.0);
    });

    it("returns 1.0 for very high prices", () => {
      expect(normalizePriceBracket(5000000)).toBe(1.0);
    });

    it("returns value in middle range for typical prices", () => {
      const result = normalizePriceBracket(800000);
      expect(result).toBeGreaterThan(0.3);
      expect(result).toBeLessThan(0.7);
    });
  });

  describe("normalizeYield", () => {
    it("normalizes yields to 0-1 range", () => {
      expect(normalizeYield(0)).toBe(0);
      expect(normalizeYield(5)).toBeCloseTo(0.5, 1);
      expect(normalizeYield(10)).toBe(1.0);
    });
  });

  describe("normalizeGrowth", () => {
    it("normalizes growth to 0-1 range", () => {
      expect(normalizeGrowth(-10)).toBe(0);
      expect(normalizeGrowth(0)).toBeCloseTo(0.5, 1);
      expect(normalizeGrowth(10)).toBe(1.0);
    });
  });

  describe("generatePropertyVector", () => {
    it("returns array of 5 numbers", () => {
      const vector = generatePropertyVector({
        state: "NSW",
        suburb: "Sydney",
        propertyType: "house",
        currentValue: 1000000,
        grossYield: 4.5,
        capitalGrowthRate: 5.0,
      });

      expect(vector).toHaveLength(5);
      vector.forEach((v) => {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/vector-generation.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/server/services/vector-generation.ts
import type { PropertyVectorInput } from "@/types/similar-properties";

// State encoding: ordered by typical property prices
const STATE_ORDER = ["TAS", "SA", "NT", "WA", "QLD", "VIC", "ACT", "NSW"];

// Price tier thresholds
const PRICE_TIERS = {
  budget: 500000,
  mid: 1000000,
  premium: 2000000,
};

export function normalizePropertyType(type: string): number {
  switch (type.toLowerCase()) {
    case "house":
      return 0.0;
    case "townhouse":
      return 0.5;
    case "unit":
    case "apartment":
      return 1.0;
    default:
      return 0.5;
  }
}

export function normalizeLocationCluster(
  state: string,
  medianPrice: number
): number {
  // State component (0-0.5)
  const stateIndex = STATE_ORDER.indexOf(state.toUpperCase());
  const stateComponent = stateIndex >= 0 ? (stateIndex / (STATE_ORDER.length - 1)) * 0.5 : 0.25;

  // Price tier component (0-0.5)
  let tierComponent: number;
  if (medianPrice < PRICE_TIERS.budget) {
    tierComponent = 0.0;
  } else if (medianPrice < PRICE_TIERS.mid) {
    tierComponent = 0.15;
  } else if (medianPrice < PRICE_TIERS.premium) {
    tierComponent = 0.35;
  } else {
    tierComponent = 0.5;
  }

  return Math.min(1, stateComponent + tierComponent);
}

export function normalizePriceBracket(price: number): number {
  // Log scale normalization for price (handles wide range)
  // $100k -> 0, $5M -> 1
  const minLog = Math.log10(100000);
  const maxLog = Math.log10(5000000);
  const priceLog = Math.log10(Math.max(100000, Math.min(5000000, price)));

  return (priceLog - minLog) / (maxLog - minLog);
}

export function normalizeYield(yieldPercent: number): number {
  // Yields typically range 0-10%, normalize to 0-1
  return Math.min(1, Math.max(0, yieldPercent / 10));
}

export function normalizeGrowth(growthPercent: number): number {
  // Growth typically ranges -10% to +10%, normalize to 0-1
  // 0% growth = 0.5
  return Math.min(1, Math.max(0, (growthPercent + 10) / 20));
}

export function generatePropertyVector(input: PropertyVectorInput): number[] {
  return [
    normalizeLocationCluster(input.state, input.currentValue),
    normalizePropertyType(input.propertyType),
    normalizePriceBracket(input.currentValue),
    normalizeYield(input.grossYield),
    normalizeGrowth(input.capitalGrowthRate),
  ];
}

export function calculateSimilarityScore(distance: number): number {
  // Convert L2 distance to similarity percentage
  // Distance 0 = 100% similar, Distance 2 (max for normalized vectors) = 0%
  const maxDistance = Math.sqrt(5); // Max possible distance for 5D unit vectors
  const similarity = Math.max(0, 1 - distance / maxDistance);
  return Math.round(similarity * 100);
}

export function getPriceBracketLabel(price: number): string {
  if (price < 400000) return "Under $400k";
  if (price < 700000) return "$400k-$700k";
  if (price < 1000000) return "$700k-$1M";
  if (price < 1500000) return "$1M-$1.5M";
  if (price < 2000000) return "$1.5M-$2M";
  return "Over $2M";
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/vector-generation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/vector-generation.ts src/server/services/__tests__/vector-generation.test.ts
git commit -m "feat(service): add vector generation service"
```

---

### Task 10: Create Listing Extraction Service

**Files:**
- Create: `src/server/services/listing-extraction.ts`
- Test: `src/server/services/__tests__/listing-extraction.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/listing-extraction.test.ts
import { describe, it, expect } from "vitest";
import { detectInputType, buildExtractionPrompt } from "../listing-extraction";

describe("Listing Extraction Service", () => {
  describe("detectInputType", () => {
    it("detects Domain URLs", () => {
      expect(detectInputType("https://www.domain.com.au/123-main-st")).toBe("url");
    });

    it("detects REA URLs", () => {
      expect(detectInputType("https://www.realestate.com.au/property-house")).toBe("url");
    });

    it("detects text content", () => {
      expect(detectInputType("3 bedroom house in Sydney for $800,000")).toBe("text");
    });
  });

  describe("buildExtractionPrompt", () => {
    it("returns non-empty prompt", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("includes required fields", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("suburb");
      expect(prompt).toContain("state");
      expect(prompt).toContain("postcode");
      expect(prompt).toContain("propertyType");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/services/__tests__/listing-extraction.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/server/services/listing-extraction.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedListingData } from "@/types/similar-properties";

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export function detectInputType(input: string): "url" | "text" {
  const urlPatterns = [
    /domain\.com\.au/i,
    /realestate\.com\.au/i,
    /^https?:\/\//i,
  ];

  return urlPatterns.some((pattern) => pattern.test(input)) ? "url" : "text";
}

export function buildExtractionPrompt(): string {
  return `You are extracting property listing data from Australian real estate content.

Extract the following fields:

Required fields:
- suburb: The suburb name (e.g., "Richmond")
- state: Australian state abbreviation (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
- postcode: 4-digit Australian postcode
- propertyType: One of "house", "townhouse", or "unit"

Optional fields:
- address: Full street address if available
- price: Asking price as a number (no currency symbols)
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms
- parking: Number of car spaces
- landSize: Land size in square meters
- estimatedRent: Weekly rental estimate if mentioned
- features: Array of key features

Return ONLY valid JSON in this format:
{
  "suburb": "Richmond",
  "state": "VIC",
  "postcode": "3121",
  "propertyType": "house",
  "address": "123 Main Street",
  "price": 850000,
  "bedrooms": 3,
  "bathrooms": 2,
  "parking": 1,
  "landSize": 450,
  "estimatedRent": 650,
  "features": ["renovated kitchen", "garden"]
}

Rules:
- Use null for fields that cannot be determined
- Price should be a number without currency symbols or commas
- For price ranges, use the midpoint
- propertyType "apartment" should be normalized to "unit"
- If state cannot be determined from suburb, make best guess from context`;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedListingData | null;
  error?: string;
}

export async function extractListingData(
  content: string,
  sourceType: "url" | "text"
): Promise<ExtractionResult> {
  try {
    const anthropic = getAnthropic();
    const prompt = buildExtractionPrompt();

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nListing content:\n${content}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, data: null, error: "No JSON found in response" };
    }

    const data = JSON.parse(jsonMatch[0]) as ExtractedListingData;

    // Validate required fields
    if (!data.suburb || !data.state || !data.postcode || !data.propertyType) {
      return { success: false, data: null, error: "Missing required fields" };
    }

    // Normalize property type
    if ((data.propertyType as string) === "apartment") {
      data.propertyType = "unit";
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Extraction failed",
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/services/__tests__/listing-extraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/listing-extraction.ts src/server/services/__tests__/listing-extraction.test.ts
git commit -m "feat(service): add listing extraction service"
```

---

## Phase 3: tRPC Router

### Task 11: Create Similar Properties Router - Basic Structure

**Files:**
- Create: `src/server/routers/similarProperties.ts`
- Test: `src/server/routers/__tests__/similarProperties.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/routers/__tests__/similarProperties.test.ts
import { describe, it, expect } from "vitest";
import { similarPropertiesRouter } from "../similarProperties";

describe("Similar Properties router", () => {
  it("exports similarPropertiesRouter", () => {
    expect(similarPropertiesRouter).toBeDefined();
  });

  it("has generateVector procedure", () => {
    expect(similarPropertiesRouter.generateVector).toBeDefined();
  });

  it("has findSimilar procedure", () => {
    expect(similarPropertiesRouter.findSimilar).toBeDefined();
  });

  it("has extractListing procedure", () => {
    expect(similarPropertiesRouter.extractListing).toBeDefined();
  });

  it("has saveExternalListing procedure", () => {
    expect(similarPropertiesRouter.saveExternalListing).toBeDefined();
  });

  it("has listExternalListings procedure", () => {
    expect(similarPropertiesRouter.listExternalListings).toBeDefined();
  });

  it("has getSharingPreferences procedure", () => {
    expect(similarPropertiesRouter.getSharingPreferences).toBeDefined();
  });

  it("has updateSharingPreferences procedure", () => {
    expect(similarPropertiesRouter.updateSharingPreferences).toBeDefined();
  });

  it("has discoverProperties procedure", () => {
    expect(similarPropertiesRouter.discoverProperties).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/routers/__tests__/similarProperties.test.ts`

**Step 3: Write minimal implementation**

```typescript
// src/server/routers/similarProperties.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, and, or, sql } from "drizzle-orm";
import {
  properties,
  propertyVectors,
  externalListings,
  sharingPreferences,
  propertyValues,
  transactions,
  suburbBenchmarks,
} from "../db/schema";
import {
  generatePropertyVector,
  calculateSimilarityScore,
  getPriceBracketLabel,
} from "../services/vector-generation";
import {
  extractListingData,
  detectInputType,
} from "../services/listing-extraction";
import type { SimilarProperty } from "@/types/similar-properties";

export const similarPropertiesRouter = router({
  generateVector: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
        with: {
          propertyValues: {
            orderBy: (v, { desc }) => [desc(v.valueDate)],
            limit: 1,
          },
        },
      });

      if (!property) {
        throw new Error("Property not found");
      }

      // Calculate yield from transactions
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      const rentTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          eq(transactions.category, "rental_income")
        ),
      });

      const annualRent = rentTransactions.reduce(
        (sum, t) => sum + Math.abs(parseFloat(t.amount)),
        0
      );

      const currentValue = property.propertyValues?.[0]?.estimatedValue
        ? parseFloat(property.propertyValues[0].estimatedValue)
        : parseFloat(property.purchasePrice);

      const grossYield = currentValue > 0 ? (annualRent / currentValue) * 100 : 0;

      // Get suburb growth rate
      const benchmark = await ctx.db.query.suburbBenchmarks.findFirst({
        where: and(
          eq(suburbBenchmarks.suburb, property.suburb),
          eq(suburbBenchmarks.state, property.state)
        ),
      });

      const capitalGrowthRate = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : 3.0; // Default 3%

      const vector = generatePropertyVector({
        state: property.state,
        suburb: property.suburb,
        propertyType: "house", // TODO: Add propertyType to properties table
        currentValue,
        grossYield,
        capitalGrowthRate,
      });

      // Upsert vector
      const existing = await ctx.db.query.propertyVectors.findFirst({
        where: eq(propertyVectors.propertyId, input.propertyId),
      });

      if (existing) {
        await ctx.db
          .update(propertyVectors)
          .set({ vector, updatedAt: new Date() })
          .where(eq(propertyVectors.id, existing.id));
      } else {
        await ctx.db.insert(propertyVectors).values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          vector,
        });
      }

      return { success: true, vector };
    }),

  findSimilar: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        limit: z.number().default(10),
        includeCommunity: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }): Promise<SimilarProperty[]> => {
      const propertyVector = await ctx.db.query.propertyVectors.findFirst({
        where: eq(propertyVectors.propertyId, input.propertyId),
      });

      if (!propertyVector) {
        return [];
      }

      const vectorStr = `[${propertyVector.vector.join(",")}]`;

      // Raw SQL for vector similarity search
      const results = await ctx.db.execute(sql`
        SELECT
          pv.id,
          pv.property_id,
          pv.external_listing_id,
          pv.user_id,
          pv.vector <-> ${vectorStr}::vector AS distance,
          p.suburb as property_suburb,
          p.state as property_state,
          p.address as property_address,
          el.suburb as listing_suburb,
          el.state as listing_state,
          el.property_type as listing_type,
          el.price as listing_price,
          el.source_url as listing_url
        FROM property_vectors pv
        LEFT JOIN properties p ON p.id = pv.property_id
        LEFT JOIN external_listings el ON el.id = pv.external_listing_id
        WHERE pv.id != ${propertyVector.id}
          AND (
            pv.user_id = ${ctx.portfolio.ownerId}
            OR (${input.includeCommunity} AND pv.is_shared = true)
          )
        ORDER BY pv.vector <-> ${vectorStr}::vector
        LIMIT ${input.limit}
      `);

      return (results.rows as Array<Record<string, unknown>>).map((row) => {
        const isPortfolio = row.property_id && row.user_id === ctx.portfolio.ownerId;
        const isExternal = !!row.external_listing_id;

        return {
          id: row.id as string,
          type: isPortfolio ? "portfolio" : isExternal ? "external" : "community",
          suburb: (row.property_suburb || row.listing_suburb) as string,
          state: (row.property_state || row.listing_state) as string,
          propertyType: (row.listing_type || "house") as "house" | "townhouse" | "unit",
          priceBracket: getPriceBracketLabel(Number(row.listing_price) || 0),
          yield: null,
          growth: null,
          distance: Number(row.distance),
          similarityScore: calculateSimilarityScore(Number(row.distance)),
          isEstimated: false,
          propertyId: row.property_id as string | undefined,
          address: row.property_address as string | undefined,
          externalListingId: row.external_listing_id as string | undefined,
          sourceUrl: row.listing_url as string | undefined,
        };
      });
    }),

  extractListing: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        sourceType: z.enum(["url", "text"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const detectedType = input.sourceType || detectInputType(input.content);
      const result = await extractListingData(input.content, detectedType);
      return result;
    }),

  saveExternalListing: protectedProcedure
    .input(
      z.object({
        sourceType: z.enum(["url", "text", "manual"]),
        sourceUrl: z.string().optional(),
        rawInput: z.string().optional(),
        extractedData: z.object({
          address: z.string().optional(),
          suburb: z.string(),
          state: z.string(),
          postcode: z.string(),
          price: z.number().optional(),
          propertyType: z.enum(["house", "townhouse", "unit"]),
          bedrooms: z.number().optional(),
          bathrooms: z.number().optional(),
          landSize: z.number().optional(),
          estimatedRent: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get suburb benchmark for yield/growth estimates
      const benchmark = await ctx.db.query.suburbBenchmarks.findFirst({
        where: and(
          eq(suburbBenchmarks.suburb, input.extractedData.suburb),
          eq(suburbBenchmarks.state, input.extractedData.state)
        ),
      });

      const estimatedYield = benchmark?.rentalYield
        ? parseFloat(benchmark.rentalYield)
        : null;
      const estimatedGrowth = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : null;

      const [listing] = await ctx.db
        .insert(externalListings)
        .values({
          userId: ctx.portfolio.ownerId,
          sourceType: input.sourceType,
          sourceUrl: input.sourceUrl,
          rawInput: input.rawInput,
          extractedData: input.extractedData,
          suburb: input.extractedData.suburb,
          state: input.extractedData.state as "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT",
          postcode: input.extractedData.postcode,
          propertyType: input.extractedData.propertyType,
          price: input.extractedData.price?.toString(),
          estimatedYield: estimatedYield?.toString(),
          estimatedGrowth: estimatedGrowth?.toString(),
          isEstimated: !input.extractedData.price,
        })
        .returning();

      // Generate vector for the listing
      const vector = generatePropertyVector({
        state: input.extractedData.state,
        suburb: input.extractedData.suburb,
        propertyType: input.extractedData.propertyType,
        currentValue: input.extractedData.price || 0,
        grossYield: estimatedYield || 0,
        capitalGrowthRate: estimatedGrowth || 0,
      });

      await ctx.db.insert(propertyVectors).values({
        externalListingId: listing.id,
        userId: ctx.portfolio.ownerId,
        vector,
      });

      return listing;
    }),

  listExternalListings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.externalListings.findMany({
      where: eq(externalListings.userId, ctx.portfolio.ownerId),
      orderBy: (el, { desc }) => [desc(el.createdAt)],
    });
  }),

  deleteExternalListing: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(externalListings)
        .where(
          and(
            eq(externalListings.id, input.id),
            eq(externalListings.userId, ctx.portfolio.ownerId)
          )
        );
      return { success: true };
    }),

  getSharingPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.sharingPreferences.findFirst({
      where: eq(sharingPreferences.userId, ctx.portfolio.ownerId),
    });

    return (
      prefs || {
        defaultShareLevel: "none",
        defaultSharedAttributes: ["suburb", "state", "propertyType", "priceBracket", "yield"],
      }
    );
  }),

  updateSharingPreferences: protectedProcedure
    .input(
      z.object({
        defaultShareLevel: z.enum(["none", "anonymous", "pseudonymous", "controlled"]),
        defaultSharedAttributes: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.sharingPreferences.findFirst({
        where: eq(sharingPreferences.userId, ctx.portfolio.ownerId),
      });

      if (existing) {
        await ctx.db
          .update(sharingPreferences)
          .set({
            defaultShareLevel: input.defaultShareLevel,
            defaultSharedAttributes: input.defaultSharedAttributes,
            updatedAt: new Date(),
          })
          .where(eq(sharingPreferences.id, existing.id));
      } else {
        await ctx.db.insert(sharingPreferences).values({
          userId: ctx.portfolio.ownerId,
          defaultShareLevel: input.defaultShareLevel,
          defaultSharedAttributes: input.defaultSharedAttributes,
        });
      }

      return { success: true };
    }),

  setPropertyShareLevel: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        shareLevel: z.enum(["none", "anonymous", "pseudonymous", "controlled"]),
        sharedAttributes: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.db.query.propertyVectors.findFirst({
        where: and(
          eq(propertyVectors.propertyId, input.propertyId),
          eq(propertyVectors.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!pv) {
        throw new Error("Property vector not found");
      }

      await ctx.db
        .update(propertyVectors)
        .set({
          isShared: input.shareLevel !== "none",
          shareLevel: input.shareLevel,
          sharedAttributes: input.sharedAttributes,
          updatedAt: new Date(),
        })
        .where(eq(propertyVectors.id, pv.id));

      return { success: true };
    }),

  discoverProperties: protectedProcedure
    .input(
      z.object({
        filters: z
          .object({
            states: z.array(z.string()).optional(),
            priceMin: z.number().optional(),
            priceMax: z.number().optional(),
            yieldMin: z.number().optional(),
            yieldMax: z.number().optional(),
            propertyTypes: z.array(z.enum(["house", "townhouse", "unit"])).optional(),
          })
          .optional(),
        source: z.enum(["portfolio", "community", "both"]).default("both"),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // For now, return community shared properties
      // TODO: Add filtering logic
      const results = await ctx.db.query.propertyVectors.findMany({
        where: or(
          eq(propertyVectors.userId, ctx.portfolio.ownerId),
          eq(propertyVectors.isShared, true)
        ),
        limit: input.limit,
        offset: input.offset,
        with: {
          property: true,
          externalListing: true,
        },
      });

      return results.map((pv) => ({
        id: pv.id,
        type: pv.property ? "portfolio" : "external",
        suburb: pv.property?.suburb || pv.externalListing?.suburb || "",
        state: pv.property?.state || pv.externalListing?.state || "",
        isShared: pv.isShared,
        shareLevel: pv.shareLevel,
      }));
    }),
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/routers/__tests__/similarProperties.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/similarProperties.ts src/server/routers/__tests__/similarProperties.test.ts
git commit -m "feat(router): add similarProperties tRPC router"
```

---

### Task 12: Register Router in App Router

**Files:**
- Modify: `src/server/routers/_app.ts`

**Step 1: Add import and register router**

Add import:
```typescript
import { similarPropertiesRouter } from "./similarProperties";
```

Add to appRouter:
```typescript
similarProperties: similarPropertiesRouter,
```

**Step 2: Run all tests**

Run: `npm run test:unit`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/server/routers/_app.ts
git commit -m "feat(router): register similarProperties router"
```

---

## Phase 4: UI Components

### Task 13: Create Similar Property Card Component

**Files:**
- Create: `src/components/similar-properties/SimilarPropertyCard.tsx`

**Step 1: Create component**

```tsx
// src/components/similar-properties/SimilarPropertyCard.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, TrendingUp, ExternalLink } from "lucide-react";
import type { SimilarProperty } from "@/types/similar-properties";

interface SimilarPropertyCardProps {
  property: SimilarProperty;
  onClick?: () => void;
}

export function SimilarPropertyCard({ property, onClick }: SimilarPropertyCardProps) {
  const getBadgeVariant = (type: SimilarProperty["type"]) => {
    switch (type) {
      case "portfolio":
        return "default";
      case "external":
        return "secondary";
      case "community":
        return "outline";
    }
  };

  const getTypeLabel = (type: SimilarProperty["type"]) => {
    switch (type) {
      case "portfolio":
        return "Your Portfolio";
      case "external":
        return "External Listing";
      case "community":
        return "Community";
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm font-medium">
                <MapPin className="w-3 h-3" />
                {property.suburb}, {property.state}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {property.propertyType}
              </div>
            </div>
          </div>
          <Badge variant={getBadgeVariant(property.type)} className="text-xs">
            {getTypeLabel(property.type)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Price:</span>
            <span className="ml-1 font-medium">{property.priceBracket}</span>
          </div>
          {property.yield && (
            <div>
              <span className="text-muted-foreground">Yield:</span>
              <span className="ml-1 font-medium">{property.yield.toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <span className="font-semibold text-green-600">
              {property.similarityScore}% match
            </span>
          </div>
          {property.sourceUrl && (
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/similar-properties/SimilarPropertyCard.tsx
git commit -m "feat(ui): add SimilarPropertyCard component"
```

---

### Task 14: Create Similar Properties Section Component

**Files:**
- Create: `src/components/similar-properties/SimilarPropertiesSection.tsx`

**Step 1: Create component**

```tsx
// src/components/similar-properties/SimilarPropertiesSection.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { SimilarPropertyCard } from "./SimilarPropertyCard";

interface SimilarPropertiesSectionProps {
  propertyId: string;
}

export function SimilarPropertiesSection({ propertyId }: SimilarPropertiesSectionProps) {
  const { data: similarProperties, isLoading, refetch } = trpc.similarProperties.findSimilar.useQuery(
    { propertyId, limit: 3 },
    { enabled: !!propertyId }
  );

  const generateVectorMutation = trpc.similarProperties.generateVector.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Similar Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!similarProperties || similarProperties.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Similar Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              No similar properties found yet.
            </p>
            <Button
              variant="outline"
              onClick={() => generateVectorMutation.mutate({ propertyId })}
              disabled={generateVectorMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generateVectorMutation.isPending ? "animate-spin" : ""}`} />
              Generate Recommendations
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Similar Properties</CardTitle>
        <Link href="/discover">
          <Button variant="ghost" size="sm">
            See All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {similarProperties.map((property) => (
            <SimilarPropertyCard
              key={property.id}
              property={property}
              onClick={() => {
                if (property.propertyId) {
                  window.location.href = `/properties/${property.propertyId}`;
                } else if (property.sourceUrl) {
                  window.open(property.sourceUrl, "_blank");
                }
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/similar-properties/SimilarPropertiesSection.tsx
git commit -m "feat(ui): add SimilarPropertiesSection component"
```

---

### Task 15: Create Add Listing Modal Component

**Files:**
- Create: `src/components/similar-properties/AddListingModal.tsx`

**Step 1: Create component**

```tsx
// src/components/similar-properties/AddListingModal.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Link as LinkIcon, FileText, Edit } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { ExtractedListingData } from "@/types/similar-properties";

interface AddListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const PROPERTY_TYPES = ["house", "townhouse", "unit"] as const;

export function AddListingModal({ open, onOpenChange, onSuccess }: AddListingModalProps) {
  const [tab, setTab] = useState<"url" | "text" | "manual">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedListingData | null>(null);
  const [manualData, setManualData] = useState<Partial<ExtractedListingData>>({
    propertyType: "house",
  });

  const extractMutation = trpc.similarProperties.extractListing.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setExtractedData(result.data);
      }
    },
  });

  const saveMutation = trpc.similarProperties.saveExternalListing.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
  });

  const resetForm = () => {
    setUrlInput("");
    setTextInput("");
    setExtractedData(null);
    setManualData({ propertyType: "house" });
  };

  const handleExtract = () => {
    const content = tab === "url" ? urlInput : textInput;
    extractMutation.mutate({ content, sourceType: tab });
  };

  const handleSave = () => {
    const data = extractedData || (manualData as ExtractedListingData);
    if (!data.suburb || !data.state || !data.postcode || !data.propertyType) {
      return;
    }

    saveMutation.mutate({
      sourceType: tab,
      sourceUrl: tab === "url" ? urlInput : undefined,
      rawInput: tab === "text" ? textInput : undefined,
      extractedData: {
        address: data.address,
        suburb: data.suburb,
        state: data.state,
        postcode: data.postcode,
        price: data.price,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        landSize: data.landSize,
        estimatedRent: data.estimatedRent,
      },
    });
  };

  const renderExtractedPreview = () => {
    if (!extractedData) return null;

    return (
      <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
        <h4 className="font-medium">Extracted Data</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {extractedData.address && (
            <div>
              <span className="text-muted-foreground">Address:</span> {extractedData.address}
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Suburb:</span> {extractedData.suburb}
          </div>
          <div>
            <span className="text-muted-foreground">State:</span> {extractedData.state}
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span> {extractedData.propertyType}
          </div>
          {extractedData.price && (
            <div>
              <span className="text-muted-foreground">Price:</span> ${extractedData.price.toLocaleString()}
            </div>
          )}
          {extractedData.bedrooms && (
            <div>
              <span className="text-muted-foreground">Beds:</span> {extractedData.bedrooms}
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full mt-4">
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Save & Compare
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Listing to Compare</DialogTitle>
          <DialogDescription>
            Paste a listing URL, text, or enter details manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url">
              <LinkIcon className="w-4 h-4 mr-2" />
              URL
            </TabsTrigger>
            <TabsTrigger value="text">
              <FileText className="w-4 h-4 mr-2" />
              Text
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Edit className="w-4 h-4 mr-2" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <div>
              <Label htmlFor="url">Listing URL</Label>
              <Input
                id="url"
                placeholder="https://www.domain.com.au/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
            <Button
              onClick={handleExtract}
              disabled={!urlInput || extractMutation.isPending}
              className="w-full"
            >
              {extractMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Extract Details
            </Button>
            {renderExtractedPreview()}
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div>
              <Label htmlFor="text">Listing Text</Label>
              <Textarea
                id="text"
                placeholder="Paste listing description here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={6}
              />
            </div>
            <Button
              onClick={handleExtract}
              disabled={!textInput || extractMutation.isPending}
              className="w-full"
            >
              {extractMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Extract Details
            </Button>
            {renderExtractedPreview()}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="suburb">Suburb *</Label>
                <Input
                  id="suburb"
                  value={manualData.suburb || ""}
                  onChange={(e) => setManualData({ ...manualData, suburb: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Select
                  value={manualData.state}
                  onValueChange={(v) => setManualData({ ...manualData, state: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="postcode">Postcode *</Label>
                <Input
                  id="postcode"
                  value={manualData.postcode || ""}
                  onChange={(e) => setManualData({ ...manualData, postcode: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="propertyType">Property Type *</Label>
                <Select
                  value={manualData.propertyType}
                  onValueChange={(v) =>
                    setManualData({ ...manualData, propertyType: v as typeof PROPERTY_TYPES[number] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  value={manualData.price || ""}
                  onChange={(e) => setManualData({ ...manualData, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={manualData.bedrooms || ""}
                  onChange={(e) => setManualData({ ...manualData, bedrooms: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={
                !manualData.suburb ||
                !manualData.state ||
                !manualData.postcode ||
                saveMutation.isPending
              }
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save & Compare
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/similar-properties/AddListingModal.tsx
git commit -m "feat(ui): add AddListingModal component"
```

---

### Task 16: Create Dashboard Widget Component

**Files:**
- Create: `src/components/similar-properties/TopPerformerMatchesWidget.tsx`

**Step 1: Create component**

```tsx
// src/components/similar-properties/TopPerformerMatchesWidget.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowRight, Target } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

export function TopPerformerMatchesWidget() {
  // Get user's properties to find top performer
  const { data: properties, isLoading: propertiesLoading } = trpc.property.list.useQuery();

  // Find the property with highest yield (simplified - could use performance score)
  const topPerformer = properties?.reduce((top, current) => {
    // This is simplified - in production, use actual yield calculation
    return top; // Return first property for now
  }, properties?.[0]);

  const { data: similarProperties, isLoading: similarLoading } =
    trpc.similarProperties.findSimilar.useQuery(
      { propertyId: topPerformer?.id || "", limit: 3 },
      { enabled: !!topPerformer?.id }
    );

  if (propertiesLoading || similarLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Top Performer Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (!topPerformer || !similarProperties || similarProperties.length === 0) {
    return null; // Don't show widget if no data
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5" />
          Properties like your top performer
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {topPerformer.address}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {similarProperties.map((property) => (
            <div
              key={property.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="font-medium">
                    {property.suburb}, {property.state}
                  </span>
                  {property.yield && (
                    <span className="text-muted-foreground ml-2">
                      {property.yield.toFixed(1)}% yield
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-600">
                  {property.similarityScore}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/discover">
          <Button variant="ghost" size="sm" className="w-full mt-4">
            Explore More <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/similar-properties/TopPerformerMatchesWidget.tsx
git commit -m "feat(ui): add TopPerformerMatchesWidget component"
```

---

### Task 17: Create Component Index

**Files:**
- Create: `src/components/similar-properties/index.ts`

**Step 1: Create index file**

```typescript
// src/components/similar-properties/index.ts
export { SimilarPropertyCard } from "./SimilarPropertyCard";
export { SimilarPropertiesSection } from "./SimilarPropertiesSection";
export { AddListingModal } from "./AddListingModal";
export { TopPerformerMatchesWidget } from "./TopPerformerMatchesWidget";
```

**Step 2: Commit**

```bash
git add src/components/similar-properties/index.ts
git commit -m "feat(ui): add similar-properties component index"
```

---

## Phase 5: Discovery Page

### Task 18: Create Discovery Page

**Files:**
- Create: `src/app/(dashboard)/discover/page.tsx`

**Step 1: Create page**

```tsx
// src/app/(dashboard)/discover/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { SimilarPropertyCard, AddListingModal } from "@/components/similar-properties";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const PROPERTY_TYPES = ["house", "townhouse", "unit"] as const;

export default function DiscoverPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [source, setSource] = useState<"portfolio" | "community" | "both">("both");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    states: [] as string[],
    priceMin: undefined as number | undefined,
    priceMax: undefined as number | undefined,
    propertyTypes: [] as typeof PROPERTY_TYPES[number][],
  });

  const { data: properties, isLoading, refetch } = trpc.similarProperties.discoverProperties.useQuery({
    source,
    filters: {
      states: filters.states.length > 0 ? filters.states : undefined,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      propertyTypes: filters.propertyTypes.length > 0 ? filters.propertyTypes : undefined,
    },
    limit: 20,
  });

  const { data: externalListings } = trpc.similarProperties.listExternalListings.useQuery();

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Discover Properties</h1>
          <p className="text-muted-foreground">
            Find similar properties from your portfolio and the community
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Listing
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <Card className="w-64 h-fit shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">States</Label>
              <div className="space-y-2 mt-2">
                {STATES.map((state) => (
                  <div key={state} className="flex items-center space-x-2">
                    <Checkbox
                      id={state}
                      checked={filters.states.includes(state)}
                      onCheckedChange={(checked) => {
                        setFilters({
                          ...filters,
                          states: checked
                            ? [...filters.states, state]
                            : filters.states.filter((s) => s !== state),
                        });
                      }}
                    />
                    <Label htmlFor={state} className="text-sm font-normal">
                      {state}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm">Price Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.priceMin || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, priceMin: Number(e.target.value) || undefined })
                  }
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.priceMax || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, priceMax: Number(e.target.value) || undefined })
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Property Type</Label>
              <div className="space-y-2 mt-2">
                {PROPERTY_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={filters.propertyTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        setFilters({
                          ...filters,
                          propertyTypes: checked
                            ? [...filters.propertyTypes, type]
                            : filters.propertyTypes.filter((t) => t !== type),
                        });
                      }}
                    />
                    <Label htmlFor={type} className="text-sm font-normal capitalize">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <Tabs value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <TabsList>
                <TabsTrigger value="portfolio">My Portfolio</TabsTrigger>
                <TabsTrigger value="community">Community</TabsTrigger>
                <TabsTrigger value="both">Both</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* External Listings */}
          {externalListings && externalListings.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Your Saved Listings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {externalListings.map((listing) => (
                  <SimilarPropertyCard
                    key={listing.id}
                    property={{
                      id: listing.id,
                      type: "external",
                      suburb: listing.suburb,
                      state: listing.state,
                      propertyType: listing.propertyType as "house" | "townhouse" | "unit",
                      priceBracket: listing.price
                        ? `$${Number(listing.price).toLocaleString()}`
                        : "Unknown",
                      yield: listing.estimatedYield ? Number(listing.estimatedYield) : null,
                      growth: listing.estimatedGrowth ? Number(listing.estimatedGrowth) : null,
                      distance: 0,
                      similarityScore: 100,
                      isEstimated: listing.isEstimated,
                      externalListingId: listing.id,
                      sourceUrl: listing.sourceUrl || undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Discovery Results */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Discover</h2>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : properties && properties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property) => (
                  <Card key={property.id} className="p-4">
                    <div className="text-sm">
                      <span className="font-medium">
                        {property.suburb}, {property.state}
                      </span>
                      <span className="ml-2 text-muted-foreground capitalize">
                        {property.type}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No properties found. Try adjusting your filters.
              </div>
            )}
          </div>
        </div>
      </div>

      <AddListingModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/discover/page.tsx
git commit -m "feat(page): add discover page"
```

---

## Phase 6: Background Jobs

### Task 19: Create Vector Regeneration Cron Job

**Files:**
- Create: `src/app/api/cron/vector-regeneration/route.ts`

**Step 1: Create cron route**

```typescript
// src/app/api/cron/vector-regeneration/route.ts
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { properties, propertyVectors, propertyValues, transactions, suburbBenchmarks } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generatePropertyVector } from "@/server/services/vector-generation";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let vectorsGenerated = 0;
    let vectorsUpdated = 0;

    // Get all active properties
    const allProperties = await db.query.properties.findMany({
      where: eq(properties.status, "active"),
    });

    for (const property of allProperties) {
      // Get latest valuation
      const latestValue = await db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, property.id),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const currentValue = latestValue?.estimatedValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property.purchasePrice);

      // Calculate annual rent
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      const rentTransactions = await db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, property.id),
          eq(transactions.category, "rental_income")
        ),
      });

      const annualRent = rentTransactions.reduce(
        (sum, t) => sum + Math.abs(parseFloat(t.amount)),
        0
      );

      const grossYield = currentValue > 0 ? (annualRent / currentValue) * 100 : 0;

      // Get suburb benchmark for growth
      const benchmark = await db.query.suburbBenchmarks.findFirst({
        where: and(
          eq(suburbBenchmarks.suburb, property.suburb),
          eq(suburbBenchmarks.state, property.state)
        ),
      });

      const capitalGrowthRate = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : 3.0;

      const vector = generatePropertyVector({
        state: property.state,
        suburb: property.suburb,
        propertyType: "house", // TODO: Add to properties table
        currentValue,
        grossYield,
        capitalGrowthRate,
      });

      // Check if vector exists
      const existing = await db.query.propertyVectors.findFirst({
        where: eq(propertyVectors.propertyId, property.id),
      });

      if (existing) {
        await db
          .update(propertyVectors)
          .set({ vector, updatedAt: new Date() })
          .where(eq(propertyVectors.id, existing.id));
        vectorsUpdated++;
      } else {
        await db.insert(propertyVectors).values({
          propertyId: property.id,
          userId: property.userId,
          vector,
        });
        vectorsGenerated++;
      }
    }

    return NextResponse.json({
      success: true,
      propertiesProcessed: allProperties.length,
      vectorsGenerated,
      vectorsUpdated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Vector regeneration cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/vector-regeneration/route.ts
git commit -m "feat(cron): add vector regeneration job"
```

---

## Phase 7: Integration & Polish

### Task 20: Add Similar Properties to Property Detail Page

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx` (or equivalent property detail page)

**Step 1: Import and add SimilarPropertiesSection**

Add import:
```typescript
import { SimilarPropertiesSection } from "@/components/similar-properties";
```

Add component to page (at bottom of property detail):
```tsx
<SimilarPropertiesSection propertyId={property.id} />
```

**Step 2: Run all tests**

Run: `npm run test:unit`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/page.tsx
git commit -m "feat(page): add similar properties section to property detail"
```

---

### Task 21: Add Dashboard Widget

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx` (or equivalent dashboard page)

**Step 1: Import and add TopPerformerMatchesWidget**

Add import:
```typescript
import { TopPerformerMatchesWidget } from "@/components/similar-properties";
```

Add component to dashboard grid:
```tsx
<TopPerformerMatchesWidget />
```

**Step 2: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): add top performer matches widget"
```

---

### Task 22: Add Navigation Link

**Files:**
- Modify: Sidebar navigation component

**Step 1: Add Discover link to navigation**

Add link to sidebar navigation:
```tsx
{
  href: "/discover",
  label: "Discover",
  icon: Search, // or appropriate icon
}
```

**Step 2: Commit**

```bash
git add [sidebar-file]
git commit -m "feat(nav): add discover page to navigation"
```

---

### Task 23: Final Test & Lint

**Step 1: Run all tests**

Run: `npm run test:unit`
Expected: All tests PASS

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit any fixes if needed**

---

## Summary

This plan implements Vector DB Similar Properties in 23 tasks across 7 phases:

1. **Core Infrastructure** (Tasks 1-7): Database schema, migrations, pgvector setup
2. **Vector Generation Service** (Tasks 8-10): Types, vector generation, listing extraction
3. **tRPC Router** (Tasks 11-12): API endpoints for similarity search
4. **UI Components** (Tasks 13-17): Cards, sections, modals, widgets
5. **Discovery Page** (Task 18): Full discovery page with filters
6. **Background Jobs** (Task 19): Nightly vector regeneration
7. **Integration & Polish** (Tasks 20-23): Integrate into existing pages

Each task is bite-sized (2-5 minutes) with TDD approach and frequent commits.
