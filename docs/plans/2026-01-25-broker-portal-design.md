# Broker Portal - Loan Application Pack Design

## Overview

One-click portfolio report generation with shareable links for mortgage brokers.

**User Flow:**
1. User clicks "Generate Loan Pack" from dashboard
2. System creates a snapshot of current portfolio data
3. User gets a shareable link (valid 7 days by default)
4. Broker opens link → sees web view with all data
5. Broker can download PDF version

## Data Model

```sql
CREATE TABLE loan_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(32) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  snapshot_data JSONB NOT NULL
);

CREATE INDEX loan_packs_user_id_idx ON loan_packs(user_id);
CREATE INDEX loan_packs_token_idx ON loan_packs(token);
CREATE INDEX loan_packs_expires_at_idx ON loan_packs(expires_at);
```

The snapshot approach means the report shows data as of generation time, not live data. This is intentional - brokers need a stable document.

## Snapshot Data Structure

```typescript
interface LoanPackSnapshot {
  generatedAt: string;
  userName: string;

  portfolio: {
    properties: Array<{
      address: string;
      suburb: string;
      state: string;
      postcode: string;
      purchasePrice: number;
      purchaseDate: string;
      currentValue: number;
      valuationDate: string;
      valuationSource: string;
      loans: Array<{
        lender: string;
        balance: number;
        rate: number;
        type: string;
      }>;
      lvr: number;
      equity: number;
    }>;
    totals: {
      totalValue: number;
      totalDebt: number;
      totalEquity: number;
      avgLvr: number;
    };
  };

  income: {
    monthlyRent: number;
    annualRent: number;
    byProperty: Array<{
      address: string;
      monthlyRent: number;
    }>;
  };

  expenses: {
    categories: Array<{
      name: string;
      monthlyAvg: number;
      annual: number;
    }>;
    totalMonthly: number;
    totalAnnual: number;
  };

  compliance: {
    items: Array<{
      property: string;
      type: string;
      status: string;
      dueDate: string | null;
    }>;
    summary: {
      compliant: number;
      overdue: number;
      upcoming: number;
    };
  };

  milestones: Array<{
    property: string;
    type: "lvr" | "equity_amount";
    value: number;
    achievedAt: string;
  }>;

  cashFlow: {
    monthlyNet: number;
    annualNet: number;
  };
}
```

## Routes & UI

### Generation (authenticated)

- Button on dashboard: "Generate Loan Pack"
- Modal to confirm + set expiry (default 7 days, options: 3/7/14/30 days)
- Shows link after generation with copy button
- Page at `/settings/loan-packs` to manage active packs (revoke, see access count)

### Public View (unauthenticated)

- Route: `/share/loan-pack/[token]`
- Clean, professional layout - no app navigation
- Sections:
  1. Portfolio Summary (totals)
  2. Properties (with valuations/loans per property)
  3. Income
  4. Expenses by category
  5. Compliance status
  6. Milestones achieved
  7. Cash Flow summary
- Header shows: "Generated for [User Name] on [Date]" + "Expires [Date]"
- "Download PDF" button in header
- Mobile-responsive

### PDF Generation

- Use `@react-pdf/renderer`
- Same sections as web view
- Filename: `loan-pack-YYYY-MM-DD.pdf`

### Expired/Invalid Link

- Friendly error page: "This report has expired or doesn't exist"
- No login prompt

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/trpc/loanPack.create` | Required | Generate snapshot, return token |
| GET | `/api/trpc/loanPack.list` | Required | List user's active packs |
| DELETE | `/api/trpc/loanPack.revoke` | Required | Invalidate a pack early |
| GET | `/api/loan-pack/[token]` | Public | Return snapshot JSON (or 404) |
| GET | `/api/loan-pack/[token]/pdf` | Public | Generate and stream PDF |

## Security

- Token: 32-char cryptographically random string
- No auth required for public routes (token IS the auth)
- Rate limit public endpoints (10 req/min per IP)
- Snapshot contains no sensitive IDs (user_id, property_id stripped from public view)
- Access count tracked for user visibility
- Default expiry: 7 days (configurable: 3/7/14/30)

## Snapshot Generation

Single service function `generateLoanPackSnapshot(userId)`:
- Queries all relevant tables in transaction for consistency
- Properties with latest valuations
- Loans per property
- Income from rent transactions
- Expenses by category
- Compliance records
- Equity milestones
- Calculates totals and cash flow

## Implementation Tasks

1. Database schema - `loan_packs` table
2. Snapshot generation service
3. tRPC procedures (create, list, revoke)
4. Public API routes for token access
5. Public web view page
6. PDF generation
7. Dashboard button + generation modal
8. Management page at `/settings/loan-packs`
