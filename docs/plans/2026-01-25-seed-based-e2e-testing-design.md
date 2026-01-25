# Seed-Based E2E Testing Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Leverage the demo seed data system to write comprehensive E2E tests that verify features display correctly with realistic portfolio data.

## Strategy

### Current State
- Playwright configured with Clerk testing mode
- Existing test fixtures create minimal isolated data per-test
- Demo seed system generates 5-year realistic portfolio

### New Approach
- Use demo seed data for a dedicated test user
- Run tests against seeded state (non-destructive)
- Verify UI correctly displays seeded data
- Seed once in global setup, run all tests, cleanup after

## Seed Data Coverage

The demo profile provides:

| Data Type | Count | Details |
|-----------|-------|---------|
| Properties | 4 | 3 active + 1 sold |
| Loans | 3 | Variable P&I, Fixed I/O (expiring), Variable P&I |
| Transactions | ~200+ | 5 years of rent income + expenses |
| Bank Accounts | 2 | Main + offset |
| Compliance Records | ~12 | With 1 overdue |
| Anomaly Alerts | 2 | Missed rent, unusual expense |
| Refinance Alerts | 1 | For expiring fixed rate |

### Property Details
1. **Paddington NSW** - $850k purchase, $620k loan, variable 6.29%
2. **Brighton VIC** - $720k purchase, $576k loan, fixed 6.45% (expiring in 1 month)
3. **Fortitude Valley QLD** - $550k purchase, $410k loan, variable 6.15%
4. **Newtown NSW** - Sold Oct 2024 for $850k (purchased $680k)

## Test Structure

```
e2e/
├── seeded-features.spec.ts    # Main seed-based tests
├── global-setup.ts            # Modified to run demo seed
└── fixtures/
    └── seed-integration.ts    # Bridge to src/lib/seed
```

## Test Cases

### Portfolio Page
- [ ] Shows 4 property cards
- [ ] Each card displays correct suburb/state
- [ ] Equity summary totals match expected values
- [ ] Sold property shows "Sold" badge

### Transactions Page
- [ ] Lists transactions with categories
- [ ] Filter by property shows only that property's transactions
- [ ] Income transactions show positive amounts
- [ ] Expense transactions show negative amounts

### Loans Page
- [ ] Shows 3 active loans
- [ ] Displays correct interest rates
- [ ] Shows LVR for each loan
- [ ] Refinance alert banner visible for expiring fixed rate

### Dashboard
- [ ] Stats cards show correct property count (4)
- [ ] Shows transaction count
- [ ] Displays alerts count

### Tax Report
- [ ] Can select financial year
- [ ] Generates report with income section
- [ ] Shows expense categories
- [ ] Totals are non-zero

### Compliance Page
- [ ] Shows compliance items
- [ ] Overdue item highlighted/flagged
- [ ] Can filter by property

### Alerts Page
- [ ] Shows anomaly alerts
- [ ] Missed rent alert visible
- [ ] Unusual expense alert visible

## Authentication

Tests use Clerk's testing mode:
1. Global setup creates/uses a test user in Clerk
2. Seed demo data for that user's Clerk ID
3. Tests authenticate using Clerk testing token
4. Same user for all seed-based tests

## Environment Variables

Required in `.env.local`:
```
CLERK_TESTING_TOKEN=<from Clerk dashboard>
E2E_TEST_CLERK_ID=<dedicated test user>
```

## Cleanup Strategy

Options:
1. **Keep seeded data** - Useful for debugging failed tests
2. **Clean after test run** - Fresh state for next run
3. **Clean before seeding** - Ensures consistent starting state

Recommended: Clean before seeding (option 3) to ensure reproducible tests.
