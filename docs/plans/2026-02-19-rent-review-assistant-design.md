# Rent Review Assistant — Design

**Beads task:** property-tracker-71b

**Goal:** Compare actual rent against market rent per property, flag underperformers, show state-specific rent increase notice rules. Pluggable provider pattern for future API integration (PropTrack/CoreLogic), starting with manual market rent input.

**V1 Scope:** Manual market rent input per property. Rent gap analysis with status badges. State-specific notice period info cards. Property detail card + portfolio summary widget. Provider interface ready for API swap-in.

---

## Data Model

**New table** `rent_reviews`:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| propertyId | uuid FK → properties | One active review per property |
| userId | text FK → users | Owner scoping |
| marketRentWeekly | decimal | Current market rent (weekly, AUD) |
| dataSource | text | "manual" / "proptrack" / "corelogic" |
| lastReviewedAt | timestamp | When user last reviewed/updated |
| nextReviewDate | date | Suggested next review (12mo from last increase) |
| notes | text | Optional user notes |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |

**Index:** `propertyId` (unique — one review per property), `userId`.

**Derived data (calculated on query, not stored):**
- `actualRentWeekly` — last 12 months of `rental_income` transactions / 52
- `rentGapPercent` — `(marketRent - actualRent) / marketRent * 100`
- `annualUplift` — `(marketRent - actualRent) * 52`
- `status` — "below_market" (>10% gap), "at_market" (±10%), "above_market" (>10% over)

**State notice period data** — static config, not a DB table:

```typescript
interface RentIncreaseRule {
  noticeDays: number;
  maxFrequency: string;
  fixedTermRule: string;
}

const RENT_INCREASE_RULES: Record<string, RentIncreaseRule> = {
  NSW: { noticeDays: 60, maxFrequency: "12 months", fixedTermRule: "Only at end of fixed term" },
  VIC: { noticeDays: 60, maxFrequency: "12 months", fixedTermRule: "Only at end of fixed term" },
  QLD: { noticeDays: 60, maxFrequency: "12 months", fixedTermRule: "Only at end of fixed term" },
  SA:  { noticeDays: 60, maxFrequency: "12 months", fixedTermRule: "As per agreement" },
  WA:  { noticeDays: 60, maxFrequency: "6 months", fixedTermRule: "Only if agreement allows" },
  TAS: { noticeDays: 60, maxFrequency: "12 months", fixedTermRule: "Only at end of fixed term" },
  NT:  { noticeDays: 30, maxFrequency: "6 months", fixedTermRule: "Only at end of fixed term" },
  ACT: { noticeDays: 56, maxFrequency: "12 months", fixedTermRule: "Only at end of fixed term" },
};
```

---

## Architecture

**Approach:** New `rentReview` router with dedicated repository. Pluggable `RentDataProvider` interface for market rent sourcing. Manual input for V1, API providers later.

**Rejected alternatives:**
- Extending `performanceBenchmarking` — couples rent review to suburb-level benchmarks, can't support per-property manual input
- AI-estimated rent — accuracy concerns for financial decisions, unnecessary cost

---

## tRPC Procedures

New `rentReview` router:

| Procedure | Type | Purpose |
|-----------|------|---------|
| `getForProperty` | protectedProcedure | Returns rent review + calculated gap, status, notice period rules |
| `setMarketRent` | writeProcedure | Creates/updates market rent for a property |
| `getPortfolioSummary` | protectedProcedure | All properties with rent gap analysis, sorted by largest gap |

**`getForProperty` flow:**
1. Fetch rent review row for property (market rent, data source, notes)
2. Fetch last 12 months of `rental_income` transactions for the property
3. Calculate `actualRentWeekly = totalIncome / 52`
4. Calculate gap %, status, annual uplift
5. Look up state notice rules from static config
6. Return combined result

**`setMarketRent` flow:**
1. Validate input (propertyId, marketRentWeekly, notes optional)
2. Upsert `rent_reviews` row (set `lastReviewedAt` to now, `nextReviewDate` to +12 months)
3. Return updated review

**`getPortfolioSummary` flow:**
1. Fetch all properties + rent reviews + 12 months rental income (via Promise.all)
2. Calculate gap for each property with market rent set
3. Sort by gap descending (biggest underperformers first)
4. Return array with status flags

---

## Provider Pattern

`src/server/services/rent-data/provider.ts`:

```typescript
interface RentDataProvider {
  getMedianRent(suburb: string, state: string, propertyType?: string): Promise<number | null>;
}
```

- V1: `ManualProvider` returns null (user inputs manually)
- Future: `PropTrackProvider`, `CoreLogicProvider` implementations
- Called optionally to pre-fill market rent when user first opens rent review

---

## UI

### Property Detail — Rent Review Card

Placed on property detail page near PerformanceCard/BenchmarkCard.

**No market rent set:**
- "Set Market Rent" prompt with input field + Save button
- Helper text: "Enter the current market rent for similar properties in {suburb}"

**Market rent set:**
- Key metrics row: Actual Rent ($/wk) | Market Rent ($/wk) | Gap (%)
- Status badge: "Below Market" (amber/red), "At Market" (green), "Above Market" (blue)
- Annual uplift callout: "Potential $X,XXX/yr additional income" (if below market)
- Notice period info card: state-specific rules
- Next review date + last updated timestamp
- Edit button to update market rent

### Portfolio Summary Widget

Dashboard card showing rent review status across all properties:

- Property rows: address | actual vs market | gap % | status badge
- Sorted by biggest gap first
- Empty state: "Set market rents on your properties to see rent review insights"
- Only shows properties with market rent set

### Status Colors

| Status | Color | Threshold |
|--------|-------|-----------|
| Below market (critical) | Red | Gap > 20% |
| Below market (warning) | Amber | Gap 10-20% |
| At market | Green | Gap ±10% |
| Above market | Blue | Gap > 10% over |

---

## Testing

Unit tests (6 cases):
1. `getForProperty` returns correct gap calculation when market rent is set
2. `getForProperty` returns null review when no market rent set
3. `setMarketRent` creates new rent review row
4. `setMarketRent` updates existing rent review row
5. `getPortfolioSummary` returns properties sorted by gap descending
6. All 8 states/territories have notice period rules defined

---

## Not in V1

- PropTrack/CoreLogic API integration (provider pattern ready)
- Downloadable rent increase notice letter templates
- Rent history tracking over time
- Automated rent review reminders/notifications
- Tenant lease term awareness (fixed vs periodic)
- Rent CPI/market trend charts
