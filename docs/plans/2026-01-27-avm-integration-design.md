# Phase 7.1: AVM Integration Design

**Date:** 2026-01-27
**Status:** Approved

## Overview

Automated property valuation (AVM) system with mock data provider, monthly cron updates, and a dedicated Valuation tab per property. Designed with a pluggable provider interface so a real API (CoreLogic, PropTrack, Domain) can be swapped in later.

## Decisions

- **Mock data first** — no external API key yet. Realistic trend simulation.
- **Full dashboard widget** — dedicated Valuation tab with chart, growth stats, current value card.
- **Auto for all active properties** — monthly cron fetches valuations for every active property.
- **No new tables** — existing `propertyValues` table has all needed columns.

## Architecture

Three components:

1. **Enhanced Mock Valuation Provider** — realistic trend simulator in `valuation.ts`
2. **Monthly Valuation Cron** — `/api/cron/valuations` runs on 1st of each month
3. **Valuation UI** — new tab on property detail page

## Component 1: Mock Valuation Provider

**File:** `src/server/services/valuation.ts` (enhance existing)

**Algorithm:**
- Inputs: `purchasePrice`, `purchaseDate`, `currentDate`, `propertyId`
- Monthly compound growth: `baseRate = 0.06 / 12` (6% annual)
- Deterministic noise per month: seeded hash of `propertyId + monthIndex` gives ±0.2% monthly variance
- Formula: `value = purchasePrice * product(1 + baseRate + noise_i)` for each month i
- Confidence band: `low = value * 0.92`, `high = value * 1.08`

**Backfill method** — `backfillHistory(propertyId)`:
- Generates monthly valuations from `purchaseDate` to today
- Batch-inserts into `propertyValues` with `source = 'mock'`
- Skips months that already have a valuation record
- Called on first cron run or when viewing Valuation tab with no data

## Component 2: Monthly Valuation Cron

**File:** `src/app/api/cron/valuations/route.ts`

**Flow:**
1. Verify cron auth via `verifyCronRequest()`
2. Query all properties with `status = 'active'`
3. For each property:
   - If zero valuations exist, call `backfillHistory()`
   - Check if valuation exists for current month (skip if so)
   - Call `getValuation(property)` and insert `propertyValues` row
4. Log results via Axiom structured logger
5. Per-property try/catch — one failure doesn't block others

**Schedule:** 1st of each month via Vercel Cron config.

## Component 3: Valuation UI

**Location:** New "Valuation" tab on property detail page

### Current Value Card
- Estimated value (large number)
- Confidence range
- Month-over-month change ($ and %, green/red badge)
- Source and last updated date

### Capital Growth Summary (stat cards row)
- Total Capital Gain ($ and %)
- Annualized Growth Rate
- Equity Position (currentValue - loanBalance, if loan data exists)
- LVR (loanBalance / currentValue, if loan data exists)

### Historical Value Chart (Recharts)
- Line chart: monthly estimates from purchase to present
- Shaded confidence band (low to high)
- Horizontal dashed line: purchase price reference
- Tooltip with exact values on hover

## TRPC Router

Add to existing `propertyValue` router:
- `getLatestValuation(propertyId)` — most recent valuation
- `getValuationHistory(propertyId)` — all valuations ordered by date
- `getCapitalGrowthStats(propertyId)` — computed growth metrics (total gain, annualized %, equity, LVR)
- `triggerBackfill(propertyId)` — manually trigger history backfill

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/server/services/valuation.ts` | Modify | Enhanced mock provider with trend simulation + backfill |
| `src/server/routers/propertyValue.ts` | Modify | New TRPC procedures |
| `src/app/api/cron/valuations/route.ts` | Create | Monthly valuation cron |
| `src/app/(dashboard)/properties/[id]/valuation/page.tsx` | Create | Valuation tab page |
| `src/components/property/valuation-card.tsx` | Create | Current value card component |
| `src/components/property/capital-growth-stats.tsx` | Create | Growth stats row component |
| `src/components/property/valuation-chart.tsx` | Create | Historical chart component |
| `vercel.json` | Modify | Add cron schedule |

## Future: Real Provider Integration

When a real API key is available:
1. Implement new class (e.g., `CoreLogicProvider`) implementing `ValuationProvider`
2. Switch provider via environment variable
3. Gate by subscription tier if needed
4. Historical backfill would come from the real API instead of simulation
