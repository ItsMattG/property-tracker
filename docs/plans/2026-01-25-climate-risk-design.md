# Climate/Flood Risk Integration Design

**Date:** 2026-01-25
**Status:** Approved
**Feature:** 3.6 from Post-Extraction Roadmap

## Overview

Add climate risk assessment to properties showing flood and bushfire risk levels. Helps users understand insurance risk exposure across their portfolio.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data Source | Static postcode lookup | No API costs, reliable, sufficient granularity |
| Display | Cards + Detail + Dashboard | Quick scanning and detailed view |
| Rating System | Low/Medium/High/Extreme | Matches insurance language, easy to understand |
| Fetch Timing | On property creation | Risk data rarely changes, store once |
| Alerts | None | Passive display only, avoids alarm fatigue |

## Architecture

### Data Model

Add `climateRisk` JSONB column to `properties` table:

```typescript
type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

interface ClimateRisk {
  floodRisk: RiskLevel;
  bushfireRisk: RiskLevel;
  overallRisk: RiskLevel;
  fetchedAt: string; // ISO date
}
```

### Risk Data Source

Static TypeScript map with postcode-level risk data:
- ~500 known high-risk postcodes from public government flood/bushfire mapping
- Postcodes not in map default to "low" risk
- Stored in `src/server/data/climate-risk-data.ts`

### Service Layer

New `src/server/services/climate-risk.ts`:

```typescript
function getClimateRisk(postcode: string): ClimateRisk;
function calculateOverallRisk(flood: RiskLevel, bushfire: RiskLevel): RiskLevel;
```

### Data Flow

1. User adds/updates property with postcode
2. Service looks up postcode in risk data map
3. Risk scores stored on property record
4. UI displays from stored data

## UI Components

### Property Card Badge

- Colored badge on property cards (dashboard, property list)
- Shows overall risk level
- Only displayed for Medium+ risk (Low = no badge)

### Property Detail Section

New "Climate Risk" card on property detail page:
- Flood Risk: [Badge]
- Bushfire Risk: [Badge]
- Overall Risk: [Badge]
- Explanation text with data source
- Refresh button for manual re-fetch

### Portfolio Risk Summary (Dashboard Widget)

- "Climate Exposure" card on dashboard
- "2 of 5 properties in elevated risk zones"
- Breakdown by risk type
- Only shown if any properties have Medium+ risk

### Color Scheme

| Risk | Background | Text |
|------|------------|------|
| Low | `bg-green-100` | `text-green-800` |
| Medium | `bg-yellow-100` | `text-yellow-800` |
| High | `bg-orange-100` | `text-orange-800` |
| Extreme | `bg-red-100` | `text-red-800` |

## Implementation

### Risk Data Seed

Initial seed with known high-risk Australian postcodes:
- **Flood-prone:** Brisbane river areas, Hawkesbury-Nepean (NSW), Melbourne's west, Townsville
- **Bushfire-prone:** Blue Mountains, Dandenong Ranges, Adelaide Hills, parts of WA

### Overall Risk Calculation

```typescript
function calculateOverallRisk(flood: RiskLevel, bushfire: RiskLevel): RiskLevel {
  const levels: RiskLevel[] = ['low', 'medium', 'high', 'extreme'];
  return levels[Math.max(levels.indexOf(flood), levels.indexOf(bushfire))];
}
```

### Integration Points

- Hook into `property.create` mutation
- Hook into `property.update` mutation (when postcode changes)
- Backfill existing properties via migration script

### Migration

1. Add `climate_risk` JSONB column to properties table
2. Run backfill to populate existing properties

## Edge Cases

| Case | Handling |
|------|----------|
| Unknown postcode | Return "low" risk (fail safe) |
| Invalid postcode format | Return "low" risk, log warning |
| Property without postcode | Don't display risk section |
| Existing properties | Backfill on migration |

## Testing

- Unit tests for risk lookup and calculation
- Test known high-risk postcodes
- Test unknown postcodes default to low
- Test overall risk calculation logic

## Out of Scope

- Real-time API integration
- Insurance cost correlation
- Historical flood event data
- Property-level (vs postcode-level) precision
