# PropertyTracker Australia - Product Design Document v2

**Date:** 2026-01-23
**Author:** Matthew Gleeson
**Status:** Revised - Staged Release Plan
**Version:** 2.0

---

## Executive Summary

PropertyTracker is a SaaS tool that eliminates tax-time chaos for Australian property investors.

**The Promise:** In 30 minutes per month, get accountant-ready rental statements from your bank feeds.

**Target Market:** Self-managed investors with 2-6 properties who personally reconcile transactions and send reports to an accountant. Not the 2M+ "investor" market—the ~30-50K who actively track their own portfolios and would pay to save time.

**Business Model:** Freemium SaaS. Free tier validates product-market fit. $10-15/month Pro tier unlocks bank feeds and tax reports.

**Release Strategy:** Ship early, ship often. Five staged releases over 6 months, each adding value and validating demand before building more.

| Release | Timeline | Core Delivery |
|---------|----------|---------------|
| v0.1 | Week 4 | Bank feed → Categorize → CSV Export (free beta) |
| v0.5 | Week 8 | Basic dashboard + Stripe billing ($10/mo) |
| v1.0 | Week 12 | Tax reports + Depreciation ($15/mo) |
| v1.5 | Week 18 | Documents + Reminders + Multi-entity |
| v2.0 | Week 24 | Forecasting + OCR + Full vision |

**Kill Criteria:** If v0.1 doesn't ship in 4 weeks, or v0.5 doesn't get 20 paying users, stop and reassess.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Target Market](#target-market)
3. [Solution Overview](#solution-overview)
4. [Release Plan](#release-plan)
5. [Feature Specification](#feature-specification)
6. [Data Model](#data-model)
7. [Technical Architecture](#technical-architecture)
8. [Third-Party Integrations](#third-party-integrations)
9. [Monetization Strategy](#monetization-strategy)
10. [Risk Assessment](#risk-assessment)
11. [Success Metrics](#success-metrics)
12. [Legal & Compliance](#legal--compliance)

---

## Problem Statement

### The Core Pain

Australian property investors who self-manage their portfolios face a recurring nightmare: **tax time**.

Every May-June, they scramble to:
- Export 12 months of bank transactions
- Manually categorize hundreds of line items
- Split expenses across properties
- Calculate depreciation deductions
- Compile everything into a format their accountant can use

This takes 10-20 hours per property, per year. Most do it in a panic the week before their accountant appointment.

### What People Do Today (The "Good Enough" Solutions)

| Solution | Why It's Used | Why It's Not Great |
|----------|---------------|-------------------|
| **Spreadsheets** | Free, flexible, familiar | Manual entry, formulas break, no automation |
| **Bank statements + shoebox** | Zero effort during year | Massive pain at tax time |
| **Accountant does everything** | Hands-off | Expensive ($500-1000/property), no visibility |
| **Xero/MYOB** | Already using for business | Not property-specific, overkill for rentals |
| **TaxTank/competitors** | Purpose-built | Limited automation, dated UX, trust issues |

### Why Now?

1. **Open Banking maturity** - Basiq and Frollo now support 150+ AU institutions reliably
2. **Growing portfolios** - Investors who bought in 2015-2020 now have 3-5 properties
3. **DIY trend** - More investors self-managing to save property management fees
4. **ATO scrutiny** - Increased audits on rental deductions make accuracy critical

### The Job To Be Done

> "When tax time approaches, I want to generate an accountant-ready export from my bank transactions, so I can stop dreading May and get my maximum refund without errors."

---

## Target Market

### Primary Target (The Wedge)

**Self-managed multi-property investors who:**
- Own 2-6 investment properties
- Personally reconcile transactions (not fully outsourced to property manager)
- Send reports to an accountant at EOFY
- Currently use spreadsheets or bank statement exports
- Tech-comfortable (use online banking, apps)
- Value their time at >$50/hour

**Estimated size:** 30,000-50,000 Australians

**Not targeting (yet):**
- Single property owners (pain not acute enough)
- Fully managed portfolios (property manager handles everything)
- Large portfolios 10+ properties (need enterprise features)
- Accountants directly (different product)

### User Persona: "DIY Dave"

- **Demographics:** 38, software engineer, lives in Melbourne
- **Portfolio:** 3 properties (VIC, QLD) worth $1.8M, $1.4M debt
- **Current process:** Spreadsheet updated monthly, 15 hours at tax time
- **Pain quote:** "I know I'm missing deductions. I just don't have time to dig through every transaction."
- **Switching trigger:** "If it connects to my bank and spits out what my accountant needs, I'm in."

### Persona: "Trust Tanya"

- **Demographics:** 47, business owner, Sydney
- **Portfolio:** 5 properties across personal name and family trust
- **Current process:** Accountant does most of it, $4K/year in fees
- **Pain quote:** "I have no idea how my portfolio is actually performing until my accountant tells me."
- **Switching trigger:** "I want visibility during the year, not just at tax time."

---

## Solution Overview

### The Core Loop

```
Connect Bank → Auto-Import Transactions → Assign to Property →
Categorize (ATO rules) → Review & Verify → Export for Accountant
```

That's it. Everything else is enhancement.

### Value Propositions (Ranked by Switching Power)

**Tier 1: Reasons People Switch**
1. **Massive time savings** - Auto-matching reduces manual work by 80%
2. **Accountant acceptance** - Export format accountants love
3. **Trust + accuracy** - Bank-feed source of truth, not manual entry

**Tier 2: Reasons People Stay (Stickiness)**
4. **Document vault** - All receipts and leases in one place
5. **Reminders** - Never miss insurance renewal or lease expiry
6. **Historical data** - Years of records, too painful to migrate away

**Tier 3: Nice-to-Have Insights (Post-PMF)**
7. **Portfolio dashboard** - Equity, yield, cash flow metrics
8. **"Who Pays" breakdown** - Visualize Taxman/Tenant/You split
9. **Scenario modeling** - 10-year projections
10. **Offset calculators** - Cash required to break even

*Tier 3 features don't drive switching. They're polish after the core works.*

---

## Release Plan

### v0.1: The Wedge (Week 1-4)

**Ship date:** 4 weeks from start
**Users:** 10 free beta users (hand-picked)
**Price:** Free

**Scope (MUST ship):**
- [ ] User auth (Clerk - do not build custom)
- [ ] Add property (address, purchase price, entity name - minimal)
- [ ] Connect bank account (Basiq - single flow)
- [ ] Transaction list view
- [ ] Auto-assign transactions to property (based on linked account)
- [ ] Category dropdown (ATO categories, hardcoded list)
- [ ] Manual category override
- [ ] CSV export (ATO-format columns)

**Explicitly NOT included:**
- Dashboard metrics
- Loans/LVR/equity calculations
- Depreciation
- Documents
- Reminders
- Stripe billing
- Mobile app
- Any "insights"

**Success criteria (must hit ALL):**
- [ ] Shipped in 4 weeks
- [ ] 10 users connect bank accounts
- [ ] 5 users generate export
- [ ] 2 accountants review export and say "usable"
- [ ] <3 critical bugs reported

**Kill criteria:** If you can't ship this in 4 weeks, stop. The full vision is impossible.

---

### v0.5: First Revenue (Week 5-8)

**Ship date:** Week 8
**Users:** 50 total (40 free, 10 paid)
**Price:** $10/month (early adopter pricing)

**Scope (add to v0.1):**
- [ ] Loan tracking (lender, balance, rate, repayment)
- [ ] Basic dashboard:
  - Per-property: rent in, expenses out, net cash flow
  - Portfolio totals
- [ ] Categorization rules engine ("contains X → category Y")
- [ ] Stripe integration (checkout, billing portal)
- [ ] Paywall: Free = 1 property, manual only. Pro = unlimited, bank feeds
- [ ] Transaction split (one payment → multiple categories)

**Success criteria:**
- [ ] 20 paying users ($200 MRR)
- [ ] <10% refund/chargeback rate
- [ ] 1 organic signup (you didn't directly tell them)
- [ ] Average time: bank connect → first export < 30 minutes

**Go/no-go:** If you can't get 20 paying users, the market isn't there. Pivot or quit.

---

### v1.0: Tax Season Ready (Week 9-12)

**Ship date:** Week 12 (target: before April 1)
**Users:** 100 total
**Price:** $15/month

**Scope (add to v0.5):**
- [ ] Depreciation tracking:
  - Borrowing expense auto-amortization (5-year spread)
  - Division 43: upload QS report, enter annual deduction
  - Division 40: asset list with effective lives (manual entry)
- [ ] EOFY Tax Report (PDF):
  - Rental income summary
  - Expenses by ATO category
  - Depreciation schedule
  - Net rental income/loss
  - Ownership split calculations
- [ ] Tax position calculator:
  - Estimate refund/owing based on salary + property results
  - BIG DISCLAIMERS (see Legal section)
- [ ] Accountant export pack:
  - PDF summary
  - CSV transactions
  - Receipts ZIP (if uploaded)

**Success criteria:**
- [ ] 50 paying users ($750 MRR)
- [ ] 30 EOFY reports generated
- [ ] 3 accountant testimonials ("this saved me time")
- [ ] Zero "your calculation is wrong" complaints unresolved

---

### v1.5: Stickiness (Week 13-18)

**Ship date:** Week 18
**Users:** 200 total
**Price:** $15/month

**Scope (add to v1.0):**
- [ ] Document storage:
  - Upload receipts, leases, QS reports, insurance
  - Link documents to transactions
  - Per-property and general folders
- [ ] Reminder system:
  - Lease expiry, insurance renewal, fixed rate expiry
  - Email notifications (30/7/1 days before)
  - Dashboard alerts
- [ ] Multi-entity support:
  - Personal, Trust, SMSF, Company entities
  - Per-entity dashboard views
  - Ownership percentage splits
- [ ] Valuation tracking:
  - Record valuations with date/source
  - Growth % calculations
- [ ] Mobile app (React Native):
  - View dashboard
  - Quick-add transaction
  - Receipt photo upload

**Success criteria:**
- [ ] 100 paying users ($1,500 MRR)
- [ ] 50% of users upload at least one document
- [ ] <5% monthly churn
- [ ] Mobile app: 50 installs

---

### v2.0: Full Vision (Week 19-24)

**Ship date:** Week 24
**Users:** 300+ total
**Price:** $20/month (or tiered)

**Scope (add to v1.5):**
- [ ] Scenario modeler:
  - 10-year property projections
  - Adjustable assumptions (growth, rent, rates)
  - Milestone markers (cash flow positive, equity for deposit)
- [ ] Receipt OCR:
  - Photo → extracted date/amount/vendor
  - AI category suggestion
- [ ] Capital works tracker:
  - Renovation projects
  - Budget vs actual
  - CGT cost base impact
- [ ] Advanced portfolio insights:
  - "Who Pays" breakdown (Taxman/Tenant/You)
  - Useable equity at 80%/88% LVR
  - Cash required in offset to break even
  - True profit vs true cash
  - Yield on purchase vs yield on value
- [ ] Rent roll (light):
  - Tenant tracking
  - Lease dates
  - Rent received vs expected
- [ ] What-if analysis:
  - Interest rate change impact
  - Sell property simulation
  - Buy new property modeling

**Success criteria:**
- [ ] 200 paying users ($3,000+ MRR)
- [ ] Feature usage: >30% use scenario modeler
- [ ] NPS > 40
- [ ] 1 press mention or notable review

---

## Feature Specification

### Feature Priority Matrix

Every feature is tagged:

| Tag | Meaning | Release |
|-----|---------|---------|
| **MUST** | Ship doesn't happen without it | As specified |
| **SHOULD** | Important but can slip 1 release | As specified |
| **COULD** | Nice to have, cut if behind | Next release |
| **WON'T** | Explicitly not building (yet) | v2.0+ or never |

---

### v0.1 Features (Detailed)

#### Authentication [MUST]

**Implementation:** Clerk (hosted auth)
- Email/password signup
- Google OAuth
- Magic link option
- No custom auth code

**Why Clerk:**
- 2-hour integration vs 2-week custom build
- Handles password reset, MFA, session management
- $0 up to 10K MAU

---

#### Property Setup [MUST]

**Fields (v0.1 - minimal):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| address | string | Yes | Free text (no Google Places yet) |
| suburb | string | Yes | |
| state | enum | Yes | NSW/VIC/QLD/SA/WA/TAS/NT/ACT |
| postcode | string | Yes | |
| purchase_price | decimal | Yes | |
| purchase_date | date | Yes | |
| entity_name | string | No | "Personal" if blank |

**Not in v0.1:**
- Property type, bedrooms, bathrooms
- Settlement date, available for rent date
- Acquisition costs breakdown
- Ownership percentages
- Images

---

#### Bank Connection [MUST]

**Flow:**
1. User clicks "Connect Bank"
2. Redirect to Basiq consent UI
3. User selects bank, logs in
4. Redirect back with success/failure
5. Fetch accounts, store references
6. Initial transaction sync (90 days back)

**Account linking:**
- After connection, user assigns each account to a property (or "unassigned")
- Mortgage accounts auto-suggest the property
- Transaction accounts can be shared across properties

**Sync schedule:**
- Manual "Sync Now" button in v0.1
- Daily auto-sync in v0.5+

---

#### Transaction List [MUST]

**Display:**
- Date, description, amount, property, category, verified status
- Sortable by date (default: newest first)
- Filterable by: property, category, date range, verified/unverified

**Categorization:**
- Dropdown with ATO categories (see Appendix)
- "Uncategorized" default for new transactions
- Bulk select + categorize

**Verification:**
- Checkbox to mark "verified"
- Verified = won't change, included in exports
- Unverified = needs review

---

#### ATO Categories [MUST]

Hardcoded in v0.1. User-custom categories in v1.0+.

**Income:**
- Rental income
- Other rental income

**Expenses (Deductible):**
- Advertising for tenants
- Body corporate fees
- Borrowing expenses
- Cleaning
- Council rates
- Gardening/lawn mowing
- Insurance
- Interest on loans
- Land tax
- Legal expenses
- Pest control
- Property agent fees
- Repairs and maintenance
- Capital works deductions
- Stationery and postage
- Travel expenses
- Water charges
- Sundry rental expenses

**Capital (Not Deductible - CGT):**
- Stamp duty
- Conveyancing
- Buyer's agent fees
- Initial repairs/renovations

**Other:**
- Transfer (between own accounts)
- Personal (not property related)
- Uncategorized

---

#### CSV Export [MUST]

**Format:**

```csv
Date,Description,Amount,Property,Category,Type,Deductible,Notes
2025-07-15,RENTAL DEPOSIT,1700.00,12 Spencer Ave Kirwan,Rental income,Income,No,
2025-07-18,WESTPAC MORTGAGE,-2500.00,12 Spencer Ave Kirwan,Interest on loans,Expense,Yes,
2025-07-20,COUNCIL RATES,-607.00,12 Spencer Ave Kirwan,Council rates,Expense,Yes,
```

**Columns:**
- Date (YYYY-MM-DD)
- Description (raw from bank)
- Amount (positive = income, negative = expense)
- Property (full address)
- Category (ATO category name)
- Type (Income/Expense/Capital/Transfer/Personal)
- Deductible (Yes/No)
- Notes (user-entered)

**Filters applied:**
- Date range (default: current financial year)
- Property (default: all)
- Exclude: Transfer, Personal categories

---

### v0.5 Features (Detailed)

#### Loan Tracking [MUST]

**Fields:**

| Field | Type | Required |
|-------|------|----------|
| property_id | FK | Yes |
| lender | string | Yes |
| loan_type | enum | Yes (P&I / Interest-only) |
| rate_type | enum | Yes (Fixed / Variable) |
| original_amount | decimal | Yes |
| current_balance | decimal | Yes |
| interest_rate | decimal | Yes (e.g., 0.0689) |
| fixed_rate_expiry | date | No |
| repayment_amount | decimal | Yes |
| repayment_frequency | enum | Yes (Weekly/Fortnightly/Monthly) |

**Calculated fields:**
- LVR = current_balance / property.current_value
- Weekly interest = current_balance * interest_rate / 52

---

#### Basic Dashboard [MUST]

**Portfolio Summary (top of page):**
- Total properties: count
- Total value: sum of purchase prices (valuations in v1.5)
- Total debt: sum of loan balances
- Total equity: value - debt
- Monthly rent: sum of rental income (last 30 days)
- Monthly expenses: sum of expenses (last 30 days)
- Net cash flow: rent - expenses

**Per-Property Cards:**
- Address
- Purchase price
- Loan balance
- Net cash flow (this month)
- Status: green (positive) / red (negative)

**No charts in v0.5.** Numbers only. Charts in v1.0.

---

#### Categorization Rules [SHOULD]

**Rule structure:**

| Field | Type | Example |
|-------|------|---------|
| match_type | enum | contains / starts_with / exact |
| match_value | string | "COUNCIL" |
| category_id | FK | Council rates |
| property_id | FK | (optional - specific property) |
| priority | int | Higher = checked first |

**Behavior:**
- Rules run on new transactions
- User can create from transaction: "Always categorize like this"
- Rules don't override manually-set categories

---

#### Stripe Billing [MUST]

**Products:**
- Free: $0/month, 1 property, no bank feeds
- Pro Monthly: $10/month
- Pro Annual: $100/year (2 months free)

**Paywall triggers:**
- Add second property → upgrade prompt
- Click "Connect Bank" on free → upgrade prompt
- Generate tax report → upgrade prompt (v1.0)

**Implementation:**
- Stripe Checkout for signup
- Stripe Customer Portal for management
- Webhooks for subscription status

---

### v1.0 Features (Detailed)

#### Depreciation Tracking [MUST]

**Borrowing Expenses (auto-calculated):**

User enters:
- Expense type (LMI, Mortgage registration, Valuation fee, etc.)
- Total amount
- Date incurred

System calculates:
- Amortization period: 5 years (or loan term if shorter)
- Annual deduction: total / 5
- Per-year breakdown: Year 1, Year 2... Year 5
- Remaining balance

**Division 43 (Building):**

User enters:
- Construction completion date
- Original construction cost
- OR uploads QS report and enters annual deduction amount

System calculates:
- Rate: 2.5% (post-Sep 1987) or 4% (certain dates)
- Annual deduction
- Cumulative claimed

**Division 40 (Plant & Equipment):**

User enters:
- Asset name (Hot water system, Carpet, Blinds, etc.)
- Original cost
- Date acquired
- Effective life (years) - suggest from ATO table
- Method: Prime cost or Diminishing value

System calculates:
- Annual depreciation
- Remaining written-down value

**Note:** Complex QS schedules with 50+ assets → recommend "upload total annual figure" rather than itemizing each asset. Full asset tracking is v2.0.

---

#### Tax Report PDF [MUST]

**Format matches ATO Rental Schedule:**

```
════════════════════════════════════════════════════════════
        RENTAL PROPERTY STATEMENT - FY 2025-26
════════════════════════════════════════════════════════════

Property: 12 Spencer Avenue, Kirwan QLD 4817
Entity: Matthew Gleeson (Personal)
Ownership: 100%

────────────────────────────────────────────────────────────
INCOME
────────────────────────────────────────────────────────────
Rental income                                    $20,400.00
Other rental income                                   $0.00
                                                ───────────
GROSS RENTAL INCOME                              $20,400.00

────────────────────────────────────────────────────────────
EXPENSES
────────────────────────────────────────────────────────────
Advertising for tenants                               $0.00
Body corporate fees                                   $0.00
Borrowing expenses                               $1,806.32
Cleaning                                              $0.00
Council rates                                    $2,427.00
Insurance                                        $2,736.96
Interest on loans                                $9,912.69
Property agent fees                              $1,197.90
Repairs and maintenance                            $422.03
Water charges                                         $0.00
Sundry rental expenses                                $0.00
                                                ───────────
TOTAL EXPENSES                                  $18,502.90

────────────────────────────────────────────────────────────
DEPRECIATION
────────────────────────────────────────────────────────────
Division 43 - Capital works                      $4,372.00
Division 40 - Plant & equipment                      $0.00
Borrowing costs (amortised)                      $1,806.32
                                                ───────────
TOTAL DEPRECIATION                               $6,178.32

────────────────────────────────────────────────────────────
SUMMARY
────────────────────────────────────────────────────────────
Gross rental income                              $20,400.00
Less: Total expenses                            $18,502.90
Less: Depreciation                               $6,178.32
                                                ───────────
NET RENTAL INCOME (LOSS)                        ($4,281.22)

Your share (100%):                              ($4,281.22)

════════════════════════════════════════════════════════════
⚠️  DISCLAIMER: This report is for informational purposes
    only and does not constitute tax advice. Please consult
    a registered tax agent for your tax return.
════════════════════════════════════════════════════════════

Generated by PropertyTracker | propertytracker.com.au
Report ID: RPT-2026-0001 | Generated: 2026-07-01 09:15:23
```

---

#### Tax Position Calculator [SHOULD]

**Inputs:**
- Annual salary (gross)
- PAYG withheld (from payslips)
- Other income
- Other deductions (work-related)
- Property net results (auto-populated)
- Private health insurance (Yes/No - for Medicare Levy Surcharge)

**Outputs:**
- Estimated taxable income
- Estimated income tax
- Medicare levy
- Medicare levy surcharge (if applicable)
- Total tax
- Less: PAYG withheld
- **Estimated refund / (amount owing)**

**CRITICAL: Disclaimers**
- "ESTIMATE ONLY"
- "Not tax advice"
- "Consult a registered tax agent"
- "Does not account for all deductions or offsets"
- Displayed prominently, cannot be dismissed

---

### v1.5+ Features

Detailed specifications for v1.5 and v2.0 features are in Appendix B. They follow the same pattern but are lower priority until v1.0 success criteria are met.

---

## Data Model

### Core Entities (v0.1)

```
USER
├── id: UUID (PK)
├── clerk_id: STRING (from Clerk)
├── email: STRING (unique)
├── name: STRING
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

PROPERTY
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── address: STRING
├── suburb: STRING
├── state: ENUM
├── postcode: STRING
├── purchase_price: DECIMAL
├── purchase_date: DATE
├── entity_name: STRING (default: "Personal")
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

BANK_ACCOUNT
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── basiq_account_id: STRING
├── institution: STRING
├── account_name: STRING
├── account_number_masked: STRING
├── account_type: ENUM
├── default_property_id: UUID (FK → Property, nullable)
├── is_connected: BOOLEAN
├── last_synced_at: TIMESTAMP
└── created_at: TIMESTAMP

TRANSACTION
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── bank_account_id: UUID (FK → BankAccount)
├── basiq_transaction_id: STRING (for dedup)
├── property_id: UUID (FK → Property, nullable)
├── date: DATE
├── description: STRING
├── amount: DECIMAL
├── category: ENUM (ATO categories)
├── is_verified: BOOLEAN (default: false)
├── notes: TEXT (nullable)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP
```

### Added in v0.5

```
LOAN
├── id: UUID (PK)
├── property_id: UUID (FK → Property)
├── lender: STRING
├── loan_type: ENUM (p_and_i, interest_only)
├── rate_type: ENUM (fixed, variable)
├── original_amount: DECIMAL
├── current_balance: DECIMAL
├── interest_rate: DECIMAL
├── fixed_rate_expiry: DATE (nullable)
├── repayment_amount: DECIMAL
├── repayment_frequency: ENUM
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

CATEGORIZATION_RULE
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── match_type: ENUM (contains, starts_with, exact)
├── match_value: STRING
├── category: ENUM
├── property_id: UUID (FK, nullable)
├── priority: INT
├── is_active: BOOLEAN
└── created_at: TIMESTAMP

SUBSCRIPTION
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── stripe_customer_id: STRING
├── stripe_subscription_id: STRING
├── plan: ENUM (free, pro_monthly, pro_annual)
├── status: ENUM (active, cancelled, past_due)
├── current_period_end: TIMESTAMP
└── created_at: TIMESTAMP
```

### Added in v1.0

```
BORROWING_EXPENSE
├── id: UUID (PK)
├── property_id: UUID (FK → Property)
├── expense_type: ENUM (lmi, mortgage_reg, valuation, etc.)
├── description: STRING
├── total_amount: DECIMAL
├── date_incurred: DATE
├── amortization_years: INT (default: 5)
├── created_at: TIMESTAMP
└── (annual_deduction calculated: total_amount / amortization_years)

DEPRECIATION_SCHEDULE
├── id: UUID (PK)
├── property_id: UUID (FK → Property)
├── division: ENUM (div_43, div_40)
├── asset_name: STRING
├── original_value: DECIMAL
├── effective_life_years: DECIMAL
├── method: ENUM (prime_cost, diminishing_value)
├── date_acquired: DATE
├── annual_deduction: DECIMAL
└── created_at: TIMESTAMP

TAX_PROFILE
├── id: UUID (PK)
├── user_id: UUID (FK → User)
├── financial_year: INT
├── gross_salary: DECIMAL
├── payg_withheld: DECIMAL
├── other_income: DECIMAL
├── other_deductions: DECIMAL
├── has_private_health: BOOLEAN
└── updated_at: TIMESTAMP
```

### Added in v1.5+

See Appendix C for Document, Reminder, Valuation, Entity, RentalIncome entities.

---

## Technical Architecture

### Tech Stack

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Frontend | Next.js 14 | SSR, API routes, Vercel deploy |
| UI | shadcn/ui + Tailwind | Fast, no lock-in |
| State | TanStack Query | Server state caching |
| Forms | React Hook Form + Zod | Type-safe validation |
| Auth | Clerk | Don't build auth |
| Backend | tRPC | End-to-end types |
| Database | PostgreSQL (Supabase) | Managed, AU region |
| ORM | Drizzle | Lightweight, type-safe |
| File Storage | Cloudflare R2 | No egress fees |
| Email | Resend | Simple, cheap |
| Payments | Stripe | Industry standard |
| Bank Feeds | Basiq | AU Open Banking |
| Hosting | Vercel | Zero-config deploy |
| Monitoring | Sentry | Error tracking |

### Project Structure (v0.1)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard
│   │   ├── properties/
│   │   │   ├── page.tsx          # List
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   ├── transactions/
│   │   │   └── page.tsx
│   │   ├── banking/
│   │   │   ├── page.tsx          # Connected accounts
│   │   │   └── connect/
│   │   └── export/
│   │       └── page.tsx
│   └── api/
│       └── trpc/[trpc]/
├── components/
│   ├── ui/                       # shadcn
│   ├── properties/
│   ├── transactions/
│   └── banking/
├── server/
│   ├── routers/
│   │   ├── property.ts
│   │   ├── transaction.ts
│   │   └── banking.ts
│   ├── services/
│   │   └── basiq.ts
│   └── db/
│       ├── schema.ts
│       └── index.ts
└── lib/
    ├── utils.ts
    └── categories.ts             # ATO category list
```

---

## Third-Party Integrations

### Basiq (Bank Feeds)

**Pricing:**
- Starter (free): 10 connections, 1K API calls/month
- Growth ($99/mo): 100 connections
- Scale ($499/mo): 1,000 connections

**Integration complexity:** Medium
- OAuth consent flow
- Webhook handling for real-time updates
- Error handling for connection failures

**Fallback:** CSV import if Basiq fails or user doesn't trust bank connection.

### Stripe (Payments)

**Pricing:** 1.75% + $0.30 per transaction

**Integration complexity:** Low
- Checkout for signups
- Customer Portal for management
- Webhooks for status updates

### Clerk (Auth)

**Pricing:** Free up to 10K MAU

**Integration complexity:** Very Low
- Drop-in components
- Pre-built flows

### Resend (Email)

**Pricing:** Free up to 3K/month

**Emails needed:**
- Welcome
- Bank connected
- Reconnect required
- Export ready
- Payment failed

### Cloudflare R2 (Storage)

**Pricing:** $0.015/GB/month, free egress

**Use:** Document storage (v1.5), receipt images, generated PDFs

---

## Monetization Strategy

### Pricing

| Plan | Price | Properties | Bank Feeds | Tax Reports |
|------|-------|------------|------------|-------------|
| Free | $0 | 1 | No | No |
| Pro Monthly | $15/mo | Unlimited | Yes | Yes |
| Pro Annual | $144/yr | Unlimited | Yes | Yes |

**Early adopter pricing (v0.5):** $10/month to reduce friction.

### Conversion Triggers

1. **Add second property** → "Upgrade to Pro for unlimited properties"
2. **Click Connect Bank** → "Bank feeds are a Pro feature"
3. **Click Generate Tax Report** → "Tax reports are a Pro feature"
4. **After 30 manual transactions** → "Save time with automatic bank imports"
5. **April-June** → Email campaign for tax season

### Revenue Projections (Conservative)

| Release | Week | Paying Users | MRR |
|---------|------|--------------|-----|
| v0.1 | 4 | 0 | $0 |
| v0.5 | 8 | 20 | $200 |
| v1.0 | 12 | 50 | $750 |
| v1.5 | 18 | 100 | $1,500 |
| v2.0 | 24 | 200 | $3,000 |

**Year 1 total:** ~$15K revenue
**Year 2 (with traction):** $50-100K ARR possible

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Basiq integration delays | Medium | High | Start week 1, have CSV fallback |
| Bank connection failures | Medium | Medium | Clear error messages, manual entry always works |
| Calculation errors | Medium | High | Unit tests for all financial calcs, disclaimers |
| Data breach | Low | Critical | Use managed services, encrypt sensitive fields, audit logs |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Trust barrier** | High | High | Start with beta users who know you, testimonials, security page |
| **Low conversion** | Medium | High | Validate with landing page first, talk to users |
| **Churn seasonality** | High | Medium | EOFY signups cancel in August; focus on stickiness features |
| **Support overload** | Medium | High | Track tickets per user, build self-serve help, set expectations |
| **Accountant rejection** | Medium | High | Test export with 3 accountants before v1.0 |
| **Tax accuracy disputes** | Medium | High | Disclaimers everywhere, "estimates only" language |
| **Competitor response** | Low | Medium | Move fast, build community, unique positioning |
| **Scope creep** | High | Medium | Strict release gates, kill criteria |

### Mitigation Priorities

1. **Validate before building** - Landing page + 15 user interviews before v0.1
2. **Test with accountants** - 3 accountants review export before v1.0
3. **Disclaimers everywhere** - Legal review of all tax-related language
4. **Support tracking** - If >2 tickets/user/month, product is broken
5. **Kill criteria** - If milestones not hit, stop and reassess

---

## Success Metrics

### North Star Metric

**Monthly Active Paying Users (MAPU)** who completed at least one export.

### Per-Release Metrics

#### v0.1 (Week 4)
- [ ] Shipped on time
- [ ] 10 users connected banks
- [ ] 5 users exported CSV
- [ ] 2 accountants said export is usable
- [ ] <3 critical bugs

#### v0.5 (Week 8)
- [ ] 20 paying users
- [ ] <10% refund rate
- [ ] Time to first export: <30 minutes
- [ ] 1 organic signup

#### v1.0 (Week 12)
- [ ] 50 paying users
- [ ] 30 tax reports generated
- [ ] 3 accountant testimonials
- [ ] Zero unresolved calculation disputes

#### v1.5 (Week 18)
- [ ] 100 paying users
- [ ] <5% monthly churn
- [ ] 50% users uploaded a document

#### v2.0 (Week 24)
- [ ] 200 paying users
- [ ] $3,000 MRR
- [ ] NPS > 40

### Ongoing Metrics (Post-Launch)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Monthly churn | <5% | >8% |
| Support tickets/user | <1/month | >2/month |
| Time to first export | <30 min | >60 min |
| Bank sync success rate | >95% | <90% |
| % transactions auto-categorized | >60% | <40% |

---

## Legal & Compliance

### Tax Disclaimer Requirements

**Every page with calculations must display:**

> ⚠️ **Not Tax Advice**
>
> PropertyTracker provides estimates for informational purposes only. These calculations do not constitute tax, legal, or financial advice. Tax laws are complex and individual circumstances vary.
>
> Always consult a registered tax agent before lodging your tax return.

**Tax report PDF must include:**
- "ESTIMATE ONLY" watermark or header
- Disclaimer in footer of every page
- "Consult a registered tax agent" prominently displayed

**Tax position calculator must:**
- Show disclaimer before displaying results
- Include "This is an estimate" in the output
- Not use language like "you will receive" or "you owe"—use "estimated"

### Data Privacy

**Privacy Policy must cover:**
- What data is collected (bank transactions, property details)
- How data is used (calculations, reports)
- Third-party sharing (Basiq for bank feeds, Stripe for payments)
- Data retention (how long, deletion on request)
- Australian Privacy Principles compliance

**User rights:**
- Export all data (JSON/CSV)
- Delete account and all data
- Revoke bank connections

### Financial Services

**PropertyTracker does NOT:**
- Provide financial advice
- Recommend investments
- Manage money or assets
- Require AFSL (Australian Financial Services License)

**It DOES:**
- Aggregate and display user's own data
- Calculate metrics based on user inputs
- Generate reports for user's accountant

*Note: Confirm with lawyer before launch that no licensing required.*

---

## Appendices

### Appendix A: ATO Category Reference

**Income Categories:**
| Category | ATO Label | Description |
|----------|-----------|-------------|
| rental_income | Gross rent | Rent received from tenants |
| other_rental_income | Other rental income | Insurance payouts, bond retained |

**Expense Categories:**
| Category | ATO Label | Deductible |
|----------|-----------|------------|
| advertising | Advertising for tenants | Yes |
| body_corporate | Body corporate fees | Yes |
| borrowing | Borrowing expenses | Yes (amortised) |
| cleaning | Cleaning | Yes |
| council_rates | Council rates | Yes |
| depreciation_building | Capital works deductions | Yes |
| depreciation_plant | Decline in value | Yes |
| gardening | Gardening and lawn mowing | Yes |
| insurance | Insurance | Yes |
| interest | Interest on loans | Yes |
| land_tax | Land tax | Yes |
| legal | Legal expenses | Depends |
| pest_control | Pest control | Yes |
| property_agent | Property agent fees | Yes |
| repairs | Repairs and maintenance | Yes |
| stationery | Stationery, telephone, postage | Yes |
| travel | Travel expenses | Limited |
| water | Water charges | Yes |
| sundry | Sundry rental expenses | Yes |

**Capital Categories (Not Deductible):**
| Category | Description | CGT Impact |
|----------|-------------|------------|
| stamp_duty | Transfer duty | Adds to cost base |
| conveyancing | Legal/settlement costs | Adds to cost base |
| buyers_agent | Buyer's agent fees | Adds to cost base |
| initial_repairs | Pre-rental repairs | Adds to cost base |
| renovations | Capital improvements | Adds to cost base |

### Appendix B: v1.5+ Feature Specifications

*[Detailed specs for Documents, Reminders, Multi-entity, Valuations, Scenario Modeler, OCR, Capital Works, Rent Roll - same format as above but lower priority]*

### Appendix C: Full Data Model (All Releases)

*[Complete entity definitions for all releases including Document, Reminder, Valuation, Entity, PropertyOwnership, RentalIncome, Renovation, ForecastScenario]*

### Appendix D: Competitor Deep Dive

| Competitor | Strengths | Weaknesses | Pricing | Switching Cost |
|------------|-----------|------------|---------|----------------|
| TaxTank | AU tax focus, audit-ready | No portfolio analytics, basic UI | ~$15/mo | Low (no historical data lock) |
| PropertyDirector | Forecasting, established | Dated UX, expensive | ~$20/mo | Medium |
| Spreadsheets | Free, flexible | Manual, error-prone | $0 | High (years of data) |
| Accountant | Hands-off | Expensive, no visibility | $500-1000/property | Low |

**Key switching cost insight:**
The biggest barrier isn't competitors—it's the user's existing spreadsheet with years of data. V0.5 must include CSV import to enable migration.

### Appendix E: User Interview Script

**Goal:** Validate willingness to pay for bank feed → accountant export

**Questions:**
1. "How many investment properties do you have?"
2. "Walk me through how you tracked expenses last financial year."
3. "How long did tax preparation take?"
4. "What was the most frustrating part?"
5. "If a tool connected to your bank and gave you an accountant-ready export, would you pay $15/month for it?"
6. "What would make you NOT use it?" (trust, accuracy, effort concerns)

**Do NOT pitch features. Listen.**

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-23 | 1.0 | Initial design document |
| 2026-01-23 | 2.0 | Revised: staged releases, narrowed scope, added risks, legal section |

---

## Next Steps

1. **This week:** Run 15 user interviews using Appendix E script
2. **This week:** Contact 3 property accountants, show proposed export format
3. **Week 1:** Landing page live, start collecting waitlist
4. **Week 1-4:** Build v0.1 (wedge)
5. **Week 4:** Ship to 10 beta users, gather feedback
6. **Week 5-8:** Build v0.5, launch Stripe billing

**Kill criteria reminder:** If v0.1 doesn't ship in 4 weeks, or v0.5 doesn't get 20 paying users, stop and reassess the business.

---

*This is a living document. Update as you learn from users.*
