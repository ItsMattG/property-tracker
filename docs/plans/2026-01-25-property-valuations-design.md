# Property Valuations Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Automated and manual property valuations with equity tracking. Users can refresh valuations from external providers (mock initially, CoreLogic/PropTrack later) or enter manual valuations. Portfolio page shows total equity across all properties.

---

## Data Model

```sql
valuationSourceEnum = pgEnum("valuation_source", ["manual", "corelogic", "proptrack", "mock"])

propertyValuations
- id (uuid, pk)
- propertyId (uuid, fk → properties)
- source (valuation_source enum)
- estimatedValue (decimal)
- confidenceLow (decimal, nullable) - lower bound of confidence range
- confidenceHigh (decimal, nullable) - upper bound of confidence range
- valuationDate (date) - when the valuation was made
- notes (text, nullable) - for manual valuations (e.g., "Bank valuation")
- apiResponseId (text, nullable) - external API reference
- createdAt
```

**Key decisions:**
- One table stores all valuations (manual + automated)
- Confidence range is optional (manual valuations won't have it)
- `source` enum includes "mock" for development/testing
- Notes field for manual entries (bank valuation, agent estimate, etc.)
- Properties can have multiple valuations over time for history tracking

**Current value logic:**
- Latest valuation by `valuationDate` is the current value
- If multiple on same date, prefer automated over manual

---

## Valuation Service Architecture

### Provider Interface

```typescript
interface ValuationProvider {
  getValuation(address: string, propertyType: string): Promise<ValuationResult | null>;
  getName(): string;
}

interface ValuationResult {
  estimatedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
  source: string;
}
```

### Implementations

- `MockValuationProvider` - Default, for development and testing
- `CoreLogicProvider` - Future integration
- `PropTrackProvider` - Future integration

### Provider Selection

```typescript
function getValuationProvider(): ValuationProvider {
  if (process.env.VALUATION_PROVIDER === "corelogic") return new CoreLogicProvider();
  if (process.env.VALUATION_PROVIDER === "proptrack") return new PropTrackProvider();
  return new MockValuationProvider();
}
```

### Mock Provider Behavior

- Generates realistic valuations based on property state (Sydney/Melbourne higher than regional)
- Adds ±5-10% confidence range
- Returns consistent values for same address (deterministic hash)
- Simulates occasional API failures for testing error handling

### When Valuations Are Fetched

- On demand: User clicks "Refresh valuation" button
- Manual: User enters valuation themselves
- Future: Monthly cron job for auto-refresh

---

## Router & API Endpoints

### Valuation Router (`/src/server/routers/valuation.ts`)

```typescript
// Get current valuation for a property
getCurrent(propertyId) → { valuation, daysSinceUpdate }

// Get valuation history for a property
getHistory(propertyId, limit?) → ValuationRecord[]

// Refresh valuation from provider (automated)
refresh(propertyId) → ValuationRecord

// Add manual valuation
addManual(propertyId, { value, date, notes }) → ValuationRecord

// Delete a valuation (manual only)
delete(valuationId) → void

// Get portfolio equity summary
getPortfolioEquity() → { totalValue, totalLoans, totalEquity, properties[] }
```

---

## UI Design

### Property Detail Page

Valuation card showing:
- Current value with confidence range
- Source and last updated date
- Refresh button for automated valuation
- Add Manual Valuation button

### Valuation History

Expandable section or modal showing:
- Date, value, source, notes for each valuation
- Delete button for manual valuations only

### Portfolio Page

Equity summary card showing:
- Total portfolio value
- Total loan balances
- Net equity (value - loans)
- Equity percentage

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add valuationSourceEnum, propertyValuations table |
| `/src/server/services/valuation.ts` | Provider interface + mock implementation |
| `/src/server/routers/valuation.ts` | CRUD + refresh endpoints |
| `/src/components/valuation/ValuationCard.tsx` | Current value display |
| `/src/components/valuation/ValuationHistoryModal.tsx` | History list |
| `/src/components/valuation/AddValuationModal.tsx` | Manual entry form |
| `/src/components/portfolio/PortfolioEquityCard.tsx` | Equity summary |

### Modified Files

| File | Change |
|------|--------|
| `/src/server/routers/_app.ts` | Register valuation router |
| `/src/app/(dashboard)/properties/[id]/page.tsx` | Add ValuationCard |
| `/src/app/(dashboard)/portfolio/page.tsx` | Add PortfolioEquityCard |

---

## Environment Variables

```
VALUATION_PROVIDER=mock  # Options: mock, corelogic, proptrack
# Future:
# CORELOGIC_API_KEY=
# PROPTRACK_API_KEY=
```

---

## Future Enhancements

- CoreLogic API integration
- PropTrack API integration
- Monthly auto-refresh cron job
- Valuation alerts (significant value changes)
- Historical equity chart
