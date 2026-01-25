# Seed Data System Design

**Date:** 2026-01-25
**Status:** Implemented

## Overview

A unified seed data system supporting three modes:
- **Demo**: Realistic 5-year Australian property portfolio for sales demos
- **Dev**: Obvious fake data for local development
- **Test**: Modular fixtures for E2E and integration tests

Data is linked to a configurable Clerk ID - no fake auth needed.

## Architecture

```
src/lib/seed/
├── index.ts              # Main entry, mode selection
├── profiles/
│   ├── demo.ts           # Realistic 5-year demo data
│   ├── dev.ts            # Fake but coherent dev data
│   └── test.ts           # Minimal deterministic test fixtures
├── generators/
│   ├── properties.ts     # Property generation logic
│   ├── transactions.ts   # Transaction generation with patterns
│   ├── loans.ts          # Loan and refinance data
│   ├── alerts.ts         # Problem states (anomalies, missed rent)
│   └── compliance.ts     # Compliance records and reminders
├── data/
│   ├── addresses.ts      # Real AU addresses for demo mode
│   ├── merchants.ts      # Realistic merchant names
│   └── banks.ts          # Australian bank names
└── api.ts                # API endpoint handler
```

## Profiles Summary

| Profile | Properties | Transactions | Time Span | Data Style |
|---------|-----------|--------------|-----------|------------|
| `demo`  | 4 (1 sold) | ~600 | 5 years | Realistic AU addresses, real banks |
| `dev`   | 2 | ~100 | 1 year | Obviously fake ("123 Test St") |
| `test`  | Per-fixture | ~10-20 | As needed | Deterministic, minimal |

## Demo Profile Data

### Properties

| # | Address | Purchase | Price | Status | Purpose |
|---|---------|----------|-------|--------|---------|
| 1 | 42 Oxford Street, Paddington NSW 2021 | Jan 2020 | $850,000 | Active | Main rental, long history |
| 2 | 15 Beach Road, Brighton VIC 3186 | Mar 2021 | $720,000 | Active | Multi-state portfolio |
| 3 | 8 James Street, Fortitude Valley QLD 4006 | Jun 2022 | $550,000 | Active | Recent purchase, climate risk |
| 4 | 23 King Street, Newtown NSW 2042 | Feb 2020 | $680,000 | Sold Oct 2024 | CGT demo |

### Transaction Patterns (per active property)

- Monthly: rent income ($2,500-3,500/month)
- Quarterly: water rates, council rates
- Annual: insurance, land tax, property management fees
- Sporadic: repairs, maintenance, cleaning between tenants
- One vacancy period per property (1-2 months gap)

### Loans

| Property | Amount | Type | Lender | Rate | Notes |
|----------|--------|------|--------|------|-------|
| 1 | $680,000 | P&I | CBA | 6.29% | Offset with $45,000 |
| 2 | $576,000 | IO | ANZ | 6.45% | Fixed expiring soon |
| 3 | $440,000 | P&I | Westpac | 6.15% | - |

### Problem States (Demo Selling Points)

- 1 missed rent payment (Property 2) - anomaly alert
- 1 unusual expense ($4,500 plumber) - flagged
- Property 2 fixed rate expiring in 30 days - refinance alert
- 1 overdue compliance item (smoke alarm check, Property 1)

## Dev Profile Data

| Property | Address | Purchase | Price |
|----------|---------|----------|-------|
| 1 | 123 Test Street, Testville NSW 2000 | Jan 2024 | $500,000 |
| 2 | 456 Dev Avenue, Mocktown VIC 3000 | Jun 2024 | $400,000 |

- ~100 transactions over 12 months
- Bank: "Dev Bank Australia"
- Loan: "Test Lender" @ 6.00%
- One of each alert type
- Predictable UUIDs (deterministic)

## Test Profile Fixtures

Modular functions for E2E/integration tests:

```typescript
// Individual seeders
await seedTestProperty({ address: "E2E Property 1" });
await seedTestLoan(propertyId, { loanType: "interest_only" });
await seedTestTransactions(propertyId, { count: 10, category: "rental_income" });
await seedAnomalyAlert(propertyId, { type: "missed_rent" });
await seedComplianceRecord(propertyId, { requirementId: "smoke_alarms", overdue: true });

// Composite fixtures
await seedMinimalPortfolio();       // 1 property, 1 loan, 5 transactions
await seedMultiPropertyPortfolio(); // 3 properties for list/filter tests
await seedCGTScenario();            // Sold property with cost base items
await seedAnomalyScenario();        // Property with various alert types
await seedComplianceScenario();     // Properties with due/overdue items
```

## CLI Interface

```bash
# Seed demo data
npm run seed:demo -- --clerk-id=user_2abc123

# Seed dev data
npm run seed:dev -- --clerk-id=user_2abc123

# Clean up seeded data
npm run seed:clean -- --clerk-id=user_2abc123

# Options
npm run seed:demo -- --clerk-id=user_2abc123 --skip-transactions --properties-only
```

## API Endpoint

`POST /api/seed` (dev environment only)

```typescript
// Request
{
  "mode": "demo" | "dev",
  "options": {
    "clean": true  // Delete existing data first
  }
}

// Response
{
  "success": true,
  "summary": {
    "properties": 4,
    "transactions": 623,
    "loans": 3,
    "alerts": 4
  }
}
```

Uses currently authenticated user's Clerk ID.

## Safety Guards

- API only available when `NODE_ENV !== 'production'`
- Requires authentication
- `--force` flag to overwrite existing data
- All operations logged

## Cleanup

```typescript
cleanupSeedData(userId)
```

Deletes in foreign key order:
1. Transactions, alerts, compliance records
2. Loans, bank accounts
3. Properties
4. User-level data (preferences, onboarding)

## Implementation Notes

- All generators use deterministic seeding for reproducibility
- Transactions spread realistically across dates (not bunched)
- Climate risk auto-calculated from postcodes
- Property values seeded with historical growth (~5% annually)
