# Vector DB Similar Properties - Design Document

**Date:** 2026-01-26
**Status:** Approved
**Author:** Claude (brainstorming session)

## Overview

ML-powered property recommendations using pgvector on existing Supabase infrastructure. Enables users to discover similar properties from their portfolio, community data, and manually-added listings.

## Use Cases

1. **Investment Discovery** - Find properties matching your best performer's profile
2. **Portfolio Comparison** - Compare properties against your portfolio or community data
3. **Market Research** - Explore what's performing well in target areas

## Scope

**In scope:**
- Internal portfolio comparison
- Manual listing entry (URL paste, text paste, form)
- Community shared data with privacy controls

**Out of scope (deferred due to cost):**
- Domain/REA API integrations

## Technical Approach

### Infrastructure

- **Vector DB:** pgvector extension on existing Supabase PostgreSQL
- **Embedding approach:** Structured feature vectors (not ML embeddings)
- **Vector dimensions:** 5 (expandable later)

### Future ML Upgrade Path

When scale justifies it:
- Replace structured vectors with ML embedding model (OpenAI, Cohere, or local)
- Increase dimensions from 5 to 384/768
- Add unstructured data (property descriptions, features) as embedding input
- Same pgvector storage, just larger vectors

---

## Data Model

### New Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Property similarity vectors
CREATE TABLE property_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  external_listing_id UUID REFERENCES external_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  vector vector(5) NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  share_level TEXT CHECK (share_level IN ('anonymous', 'pseudonymous', 'controlled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Either property_id or external_listing_id must be set
  CONSTRAINT vector_source_check CHECK (
    (property_id IS NOT NULL AND external_listing_id IS NULL) OR
    (property_id IS NULL AND external_listing_id IS NOT NULL)
  )
);

-- Index for similarity search
CREATE INDEX ON property_vectors USING ivfflat (vector vector_l2_ops) WITH (lists = 100);

-- External listings (manually added by users)
CREATE TABLE external_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'text', 'manual')),
  source_url TEXT,
  raw_input TEXT,
  extracted_data JSONB NOT NULL,
  suburb TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User sharing preferences
CREATE TABLE sharing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  default_share_level TEXT DEFAULT 'none' CHECK (default_share_level IN ('none', 'anonymous', 'pseudonymous', 'controlled')),
  default_shared_attributes JSONB DEFAULT '["suburb", "state", "propertyType", "priceBracket", "yield"]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Vector Dimensions

| Index | Attribute | Encoding | Range |
|-------|-----------|----------|-------|
| 0 | Location cluster | State + suburb price tier | 0.0 - 1.0 |
| 1 | Property type | House=0.0, Townhouse=0.5, Unit=1.0 | 0.0 - 1.0 |
| 2 | Price bracket | Market percentile | 0.0 - 1.0 |
| 3 | Gross yield | Yield percentile | 0.0 - 1.0 |
| 4 | Capital growth | Growth percentile | 0.0 - 1.0 |

### Location Cluster Encoding

Uses `suburbBenchmarks` table to classify suburbs:
- **Tiers:** Budget (<$500k), Mid ($500k-$1M), Premium ($1M-$2M), Luxury (>$2M)
- **States:** 8 (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
- **Total clusters:** ~32, normalized to 0-1 range

---

## Vector Generation

```typescript
interface PropertyVectorInput {
  state: string;
  suburb: string;
  propertyType: 'house' | 'townhouse' | 'unit';
  currentValue: number;
  grossYield: number;
  capitalGrowthRate: number;
}

function generatePropertyVector(input: PropertyVectorInput): number[] {
  return [
    normalizeLocationCluster(input.state, input.suburb),
    normalizePropertyType(input.propertyType),
    normalizePriceBracket(input.currentValue),
    normalizeYield(input.grossYield),
    normalizeGrowth(input.capitalGrowthRate),
  ];
}

function normalizePropertyType(type: string): number {
  switch (type) {
    case 'house': return 0.0;
    case 'townhouse': return 0.5;
    case 'unit': return 1.0;
    default: return 0.5;
  }
}

// Other normalize functions use percentile ranking against all properties
```

### Re-vectorization Triggers

- Property value updated
- New valuation added
- Transactions change yield calculation
- Nightly batch job (catch-all)

---

## Similarity Search

### Algorithm

```sql
-- Find 10 most similar properties to a given vector
SELECT
  p.*,
  pv.vector <-> $1 AS distance,
  1 - (pv.vector <-> $1) AS similarity_score
FROM property_vectors pv
LEFT JOIN properties p ON p.id = pv.property_id
LEFT JOIN external_listings el ON el.id = pv.external_listing_id
WHERE pv.is_shared = true
  OR pv.user_id = $2  -- always include user's own properties
ORDER BY pv.vector <-> $1  -- L2 distance
LIMIT 10;
```

### Similarity Thresholds

| Distance | Interpretation |
|----------|----------------|
| < 0.3 | Highly similar |
| 0.3 - 0.6 | Somewhat similar |
| > 0.6 | Not similar |

---

## Manual Listing Extraction

### Input Detection Flow

```
User Input
    │
    ├─► Contains URL? ──► Fetch page ──► Claude extraction
    │
    ├─► Text content? ──► Claude extraction directly
    │
    └─► Extraction fails? ──► Manual form fallback
```

### Claude Extraction Prompt

```
Extract property details from this listing:

Required fields:
- Address (street, suburb, state, postcode)
- Asking price or price range
- Property type (house/unit/townhouse)

Optional fields:
- Bedrooms, bathrooms, parking
- Land size (if house)
- Estimated weekly rental (if mentioned)
- Key features

Return as JSON. Use null for fields that cannot be determined.

Listing content:
{content}
```

### Yield/Growth Estimation

For external listings without rental data:
- Pull suburb median yield from `suburbBenchmarks`
- Pull suburb growth rate from `suburbBenchmarks`
- Mark with `isEstimated: true` flag

---

## UI Components

### 1. Property Detail Page - Similar Properties Section

```
┌─────────────────────────────────────────────────┐
│ Similar Properties                    [See All →]│
├─────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Suburb  │ │ Suburb  │ │ Suburb  │            │
│ │ $XXXk   │ │ $XXXk   │ │ $XXXk   │            │
│ │ X.X%    │ │ X.X%    │ │ X.X%    │            │
│ │ yield   │ │ yield   │ │ yield   │            │
│ │ 92% sim │ │ 87% sim │ │ 81% sim │            │
│ └─────────┘ └─────────┘ └─────────┘            │
└─────────────────────────────────────────────────┘
```

### 2. Dashboard Widget - Top Performer Matches

```
┌─────────────────────────────────────────────────┐
│ Properties like your top performer              │
│ (123 Main St - 8.2% yield)                      │
├─────────────────────────────────────────────────┤
│ • Suburb A, VIC - 7.9% yield - 94% match       │
│ • Suburb B, NSW - 8.1% yield - 89% match       │
│ • Suburb C, QLD - 7.6% yield - 85% match       │
│                              [Explore More →]   │
└─────────────────────────────────────────────────┘
```

### 3. Discovery Page (`/discover`)

**Layout:**
- Left sidebar: Filters (state, price range, yield range, property type)
- Main area: Results grid with similarity scores
- Top bar: Toggle "My portfolio" / "Community" / "Both"
- Action button: "Add Listing to Compare"

### 4. Add Listing Modal

**Tabs:**
1. Paste URL (primary)
2. Paste Text
3. Manual Form

**Flow:**
1. User pastes content
2. "Extract" button → loading state
3. Preview extracted data
4. Edit if needed
5. "Save & Compare" button

---

## Privacy & Sharing

### Global Settings (`/settings/sharing`)

```
┌─────────────────────────────────────────────────┐
│ Community Sharing Preferences                   │
├─────────────────────────────────────────────────┤
│ Default sharing level:                          │
│ ○ Don't share my properties                     │
│ ○ Anonymous (suburb only, no identity)          │
│ ○ Pseudonymous (property ID visible)            │
│ ● Controlled (I choose what's visible)          │
│                                                 │
│ When "Controlled", share these by default:      │
│ ☑ Suburb & State     ☑ Property type           │
│ ☑ Price bracket      ☑ Gross yield             │
│ ☐ Exact address      ☐ Capital growth          │
│ ☐ Purchase price     ☐ My username             │
└─────────────────────────────────────────────────┘
```

### Per-Property Override

On property detail page:
```
┌─────────────────────────────────────┐
│ Sharing: Using defaults [Change]    │
│ Status: Shared anonymously ✓        │
└─────────────────────────────────────┘
```

### Share Level Visibility

| Level | Visible to others |
|-------|-------------------|
| Anonymous | Suburb, state, property type, yield range, growth range |
| Pseudonymous | Above + property ID (trackable over time) |
| Controlled | User-selected fields only |

### Data Protection Rules

- Exact addresses **never** shared (suburb only)
- Purchase prices shown as "price bracket" by default
- No PII (names, emails) in community data
- Users can delete shared data anytime

---

## API Routes

### tRPC Router: `similarProperties`

```typescript
export const similarPropertiesRouter = createTRPCRouter({
  // Vector management
  generateVector: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(/* ... */),

  getVector: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(/* ... */),

  // Similarity search
  findSimilar: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      limit: z.number().default(10),
      includeExternal: z.boolean().default(true),
      includeCommunity: z.boolean().default(true),
    }))
    .query(/* ... */),

  findSimilarToVector: protectedProcedure
    .input(z.object({
      vector: z.array(z.number()).length(5),
      limit: z.number().default(10),
    }))
    .query(/* ... */),

  // External listings
  extractListing: protectedProcedure
    .input(z.object({
      content: z.string(),
      sourceType: z.enum(['url', 'text']),
    }))
    .mutation(/* ... */),

  saveExternalListing: protectedProcedure
    .input(z.object({
      sourceType: z.enum(['url', 'text', 'manual']),
      sourceUrl: z.string().optional(),
      rawInput: z.string().optional(),
      extractedData: z.object({
        address: z.string().optional(),
        suburb: z.string(),
        state: z.string(),
        postcode: z.string(),
        price: z.number().optional(),
        propertyType: z.enum(['house', 'townhouse', 'unit']),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        landSize: z.number().optional(),
        estimatedRent: z.number().optional(),
      }),
    }))
    .mutation(/* ... */),

  listExternalListings: protectedProcedure
    .query(/* ... */),

  deleteExternalListing: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(/* ... */),

  // Sharing preferences
  getSharingPreferences: protectedProcedure
    .query(/* ... */),

  updateSharingPreferences: protectedProcedure
    .input(z.object({
      defaultShareLevel: z.enum(['none', 'anonymous', 'pseudonymous', 'controlled']),
      defaultSharedAttributes: z.array(z.string()),
    }))
    .mutation(/* ... */),

  setPropertyShareLevel: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      shareLevel: z.enum(['none', 'anonymous', 'pseudonymous', 'controlled']).nullable(),
      sharedAttributes: z.array(z.string()).optional(),
    }))
    .mutation(/* ... */),

  // Discovery
  discoverProperties: protectedProcedure
    .input(z.object({
      filters: z.object({
        states: z.array(z.string()).optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        yieldMin: z.number().optional(),
        yieldMax: z.number().optional(),
        propertyTypes: z.array(z.enum(['house', 'townhouse', 'unit'])).optional(),
      }),
      source: z.enum(['portfolio', 'community', 'both']).default('both'),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(/* ... */),
});
```

---

## Background Jobs

### Nightly Vector Regeneration

```typescript
// Cron: 0 2 * * * (2am daily)
async function regenerateAllVectors() {
  const properties = await db.query.properties.findMany({
    where: eq(properties.status, 'active'),
  });

  for (const property of properties) {
    const vector = await generatePropertyVector(property);
    await upsertPropertyVector(property.id, vector);
  }
}
```

### External Listing Cleanup (Optional)

```typescript
// Cron: 0 3 * * 0 (3am Sundays)
// Delete external listings older than 90 days
async function cleanupOldListings() {
  await db.delete(externalListings)
    .where(lt(externalListings.createdAt, subDays(new Date(), 90)));
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- Enable pgvector extension
- Create database tables
- Implement vector generation logic
- Basic similarity search

### Phase 2: Internal Portfolio
- Property detail "Similar Properties" section
- Dashboard widget
- Vector regeneration job

### Phase 3: External Listings
- Add Listing modal (URL/text/form)
- Claude extraction integration
- External listing management

### Phase 4: Community Layer
- Sharing preferences UI
- Per-property sharing controls
- Discovery page with community data

### Phase 5: Polish
- Similarity explanations ("similar because...")
- Performance optimization
- Analytics/tracking

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Properties with vectors | 100% of active properties |
| External listings added/user/month | >2 |
| Community opt-in rate | >30% |
| Discovery page visits/week | Growth indicator |
| Similar property clicks | Engagement indicator |

---

## Open Questions (Resolved)

1. ~~Vector DB choice~~ → pgvector on Supabase
2. ~~ML vs structured vectors~~ → Structured (upgrade path noted)
3. ~~Privacy model~~ → Tiered with user control
4. ~~External data sources~~ → Manual entry only (no API integrations)
