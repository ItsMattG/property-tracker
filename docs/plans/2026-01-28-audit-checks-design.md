# Audit Checks / Data Validation — Design

**Date:** 2026-01-28
**Phase:** 9.2
**Status:** Final

## Overview

Automated audit checks that catch errors and missed deductions for a selected financial year. Covers both tax readiness and data quality. Computed in-memory on demand (no new DB tables). Presented as a dedicated report page with per-property audit scores.

## Audit Check Types

### Tax Readiness

1. **Missing Key Expenses** — For each property, flag if any of the 6 key expenses (council rates, insurance, water charges, land tax, body corporate, repairs & maintenance) recorded $0 this year but had a non-zero amount in the prior year. Severity: warning.

2. **Uncategorized Transactions** — Transactions still marked "uncategorized" that are assigned to a property. Severity: warning.

3. **Loan Interest Missing** — If a property has a loan, check that interest_on_loans is recorded for the year. Flag if missing entirely. Severity: warning.

4. **Commonly Missed Deductions** — Suggest deductible categories the user has never claimed but are commonly used (pest_control, gardening, stationery_and_postage). Severity: info.

### Data Quality

5. **Unassigned Transactions** — Expense transactions with no property allocated. Severity: info.

6. **Large Unverified Transactions** — Transactions over $1,000 that haven't been verified. Severity: info.

7. **No Rental Income** — Properties with zero rental income for the year. Severity: warning.

## Architecture

### Service

`src/server/services/audit-checks.ts`

Pure functions per check type (exported for unit testing):
- `checkMissingKeyExpenses(propertyTotals, priorYearTotals) → AuditCheckResult[]`
- `checkUncategorizedTransactions(transactions) → AuditCheckResult[]`
- `checkLoanInterestMissing(properties, propertyTotals) → AuditCheckResult[]`
- `checkMissedDeductions(allCategoryTotals) → AuditCheckResult[]`
- `checkUnassignedTransactions(transactions) → AuditCheckResult`
- `checkLargeUnverified(transactions) → AuditCheckResult`
- `checkNoRentalIncome(properties, propertyIncomeTotals) → AuditCheckResult[]`

Orchestrator:
- `buildAuditReport(userId, year) → AuditReport`
  1. Fetch transactions for current and prior FY in parallel
  2. Fetch properties with loans
  3. Group transactions by property and category
  4. Run all 7 checks
  5. Compute per-property and portfolio scores

### Types

```typescript
interface AuditCheckResult {
  checkType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  propertyId: string | null; // null = portfolio-wide
  affectedCount: number;
}

interface AuditPropertyScore {
  propertyId: string;
  address: string;
  score: number;
  checks: AuditCheckResult[];
  passedCount: number;
  totalChecks: number;
}

interface AuditReport {
  year: number;
  yearLabel: string;
  portfolioScore: number;
  properties: AuditPropertyScore[];
  portfolioChecks: AuditCheckResult[]; // portfolio-wide checks
  summary: { info: number; warning: number; critical: number };
}
```

### Scoring

Start at 100 per property. Deduct per failed check:
- critical: -20
- warning: -10
- info: -5

Floor at 0. Portfolio score = average of property scores.

### tRPC Router

`src/server/routers/auditChecks.ts`
- `getReport({ year: number })` → `AuditReport`

### UI

`src/components/reports/AuditChecksContent.tsx`
- Year selector (reuses `reports.getAvailableYears`)
- Portfolio score badge: green (≥80), amber (≥50), red (<50)
- Summary row: counts by severity
- Per-property collapsible cards showing score + check results
- Each check: severity icon, title, message, affected count

`src/app/(dashboard)/reports/audit-checks/page.tsx`
- Standard report page wrapper with Suspense

Reports hub card added to `/reports/page.tsx`.

## Tech Stack

TypeScript, Vitest, tRPC, Drizzle ORM, Next.js App Router, shadcn/ui (Table, Card, Collapsible, Badge, Select), Lucide icons.
