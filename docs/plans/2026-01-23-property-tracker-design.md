# PropertyTracker Australia - Product Design Document

**Date:** 2026-01-23
**Author:** Matthew Gleeson
**Status:** Draft - Ready for Implementation

---

## Executive Summary

PropertyTracker is a SaaS platform for Australian property investors to track rental income, expenses, depreciation, and portfolio performance—replacing spreadsheets with automated bank feeds, ATO-compliant tax reports, and real-time dashboards.

**Target Market:** 2M+ Australian property investors, focusing on DIY investors managing 1-5 properties who currently use spreadsheets.

**Business Model:** Freemium SaaS, $15/month Pro tier with bank feed integration and tax reports.

**Competitive Advantage:**
- Purpose-built for Australian tax system (ATO categories, depreciation rules, financial year)
- Unique metrics like "Who Pays" breakdown (Taxman/Tenant/You) and "Cash Required in Offset to Break Even"
- Founded by a multi-property investor who built this for themselves first

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Feature Specification](#feature-specification)
4. [Data Model](#data-model)
5. [Technical Architecture](#technical-architecture)
6. [Third-Party Integrations](#third-party-integrations)
7. [Monetization Strategy](#monetization-strategy)
8. [Implementation Phases](#implementation-phases)
9. [Risk Assessment](#risk-assessment)
10. [Success Metrics](#success-metrics)

---

## Problem Statement

### The Pain

Australian property investors face significant friction in tracking their investments:

1. **Manual Data Entry Hell** - Every expense, rent payment, and mortgage deduction must be manually entered into spreadsheets
2. **Tax Time Chaos** - Scrambling to categorize a year's worth of transactions for accountants in May-June
3. **No Real-Time Visibility** - No quick way to see cash flow position across all properties
4. **Depreciation Complexity** - Keeping depreciation schedules accurate and knowing what's left to claim
5. **Document Chaos** - Receipts in email, photos on phone, PDFs scattered, leases in drawers
6. **Multi-Entity Complexity** - Different ownership structures (personal, trust, SMSF) make consolidated views difficult

### Current Solutions Fall Short

| Solution | Problem |
|----------|---------|
| Spreadsheets | Manual entry, formulas break, no automation |
| Generic accounting (Xero/MYOB) | Not property-specific, no portfolio metrics |
| Property management software | Focused on tenant management, not investor analytics |
| Existing AU tools (TaxTank, PropertyDirector) | Limited automation, dated UX, expensive |

### Market Opportunity

- 2.2M+ Australians own investment properties
- ~300K own multiple properties (serious investors)
- Growing trend toward self-managed portfolios
- Increasing complexity with trust structures and SMSF investments

---

## Solution Overview

PropertyTracker is an all-in-one property investment dashboard featuring:

### Core Value Propositions

1. **Automated Bank Feeds** - Connect Australian bank accounts via Open Banking, auto-import and categorize transactions by property
2. **ATO-Aligned Tax Reports** - One-click generation of rental property schedules for accountants
3. **Portfolio Dashboard** - Real-time view of equity, yield, LVR, cash flow across all properties
4. **Depreciation Tracking** - Automatic amortization of borrowing costs, Division 43/40 schedules
5. **Document Storage** - All receipts, leases, and reports in one searchable place
6. **Smart Reminders** - Never miss insurance renewals, lease expiries, or compliance dates

### Unique Differentiators

Metrics no competitor offers:

- **"Who Pays" Breakdown** - Visualize what percentage of costs are covered by Taxman (deductions), Tenant (rent), and You (out of pocket)
- **Useable Equity at Multiple LVRs** - See available equity at 80% and 88% LVR thresholds
- **Cash Required in Offset to Break Even** - Know exactly how much cash in offset would make each property cash-flow neutral
- **True Profit vs True Cash** - Distinguish between accounting profit and actual cash flow

---

## Feature Specification

### Phase 1: MVP (Weeks 1-8)

#### 1.1 Property Setup

**Property Profile:**
- Address (Google Places autocomplete)
- Property type: House, Unit, Townhouse, Commercial
- Bedrooms, bathrooms, car spaces, land size
- Year built
- Purchase date, purchase price
- Settlement date, date available for rent

**Ownership Structure:**
- Entity type: Personal, Trust, SMSF, Company
- Entity name (for trusts/companies)
- Multiple investors with percentage splits
- Each investor linked to their tax profile

**Acquisition Costs (Capital):**
- Stamp duty
- Conveyancing fees
- Buyer's agent fees
- Pre-purchase inspections
- Trust setup costs
- Transfer fees, title insurance
- Auto-calculates total cost base for CGT

**Borrowing Expenses:**
- LMI (auto-amortizes over 5 years per ATO rules)
- Mortgage registration fee (auto-amortizes)
- Valuation fee, settlement fee, documentation fee
- Solicitor fees
- Shows annual deductible amount and remaining balance

#### 1.2 Loan Tracking

- Lender, loan type (P&I, Interest-only, Fixed, Variable)
- Original amount, current balance, interest rate
- Fixed rate expiry date
- Repayment amount, frequency, due date
- Offset account linked with balance
- Calculated: LVR, weekly interest cost, interest saved from offset

#### 1.3 Transaction Ledger

**Bank Feed Integration (Basiq):**
- Connect Australian bank accounts
- Auto-import transactions daily
- Smart matching: mortgage account transactions → auto-assign to property
- Rule engine for auto-categorization

**Manual Entry:**
- Quick-add for cash expenses
- Receipt photo upload
- Bulk CSV import for historical data

**Transaction Fields:**
- Date, description, amount
- Property assignment
- ATO-aligned category and sub-category
- Type: Income, Expense, Capital
- Flags: Deductible, Capitalised, Verified
- Split transaction support

**ATO-Aligned Categories:**

*Income:*
- Rental income
- Bond retained
- Insurance payout

*Expenses (Deductible):*
- Advertising for tenants
- Body corporate fees
- Borrowing expenses
- Cleaning
- Council rates
- Depreciation
- Gardening/lawn mowing
- Insurance
- Interest on loans
- Land tax
- Legal expenses
- Pest control
- Property agent fees
- Repairs & maintenance
- Capital works deductions
- Stationery & postage
- Travel expenses
- Water charges
- Sundry rental expenses

*Capital (CGT):*
- Stamp duty
- Conveyancing
- Buyer's agent
- Initial repairs
- Renovations
- Legal (purchase)

#### 1.4 Dashboard - Portfolio Overview

**Key Numbers Strip:**
- Total Assets (sum of current values)
- Net Assets (equity)
- Total Debt
- Weekly Rent (gross)
- Weekly Costs
- True Weekly Cash Flow
- Useable Equity @ 80% LVR
- Useable Equity @ 88% LVR

**Per-Property Cards:**
- Address + thumbnail
- Current value vs purchase price (growth $, growth %)
- Loan balance, equity, LVR
- Weekly rent, weekly costs, weekly cash flow
- Yield on purchase, yield on value
- Status indicator (positive = green, negative = red)

**"Who Pays" Visualization:**
- Pie chart: Taxman %, Tenant %, You %

#### 1.5 Dashboard - Per-Property Detail

**Summary Tab:**
- All metrics from portfolio view, expanded
- Capital ROI, On Debt ROI
- Estimated tax on sale

**Transactions Tab:**
- Filterable transaction list
- Month/quarter/year/financial year views
- Category breakdown chart

**Income Statement:**
- Rental income
- Less: All expense categories
- = Net rental income (loss)
- Tax deduction value

**Cash Flow View:**
- Monthly bar chart: income vs expenses
- Running cash position

---

### Phase 2: Tax & Compliance (Months 3-5)

#### 2.1 Depreciation Tracker

**Borrowing Costs (Auto-Amortized):**
- 5-year spread per ATO rules
- Year-by-year breakdown
- Remaining deductible balance
- Refinance scenario (immediate write-off)

**Division 43 (Building Allowance):**
- Construction date determines rate (2.5% post-1987)
- Original construction cost
- Annual deduction calculation
- Cumulative claimed amount

**Division 40 (Plant & Equipment):**
- Asset list with effective lives
- Prime cost or Diminishing value method
- Low-value pool option
- QS report upload and storage

#### 2.2 Tax Reports

**EOFY Rental Property Report:**
- One-click PDF generation
- ATO Rental Schedule format
- Income, expenses by category
- Depreciation schedule attached
- Ownership split calculations

**Accountant Export:**
- CSV of categorized transactions
- PDF summary report
- Document pack (receipts/invoices as ZIP)

#### 2.3 Tax Position Calculator

**Inputs:**
- Annual taxable income
- PAYG withheld
- Other deductions
- Property net results (auto-populated)
- Private health insurance status

**Calculations:**
- Total taxable income estimate
- Income tax (current ATO brackets)
- Medicare levy and surcharge
- Estimated refund/owing
- Real-time updates as transactions added

#### 2.4 Important Dates & Reminders

**Automated Tracking:**
- Lease expiry
- Insurance renewal
- Fixed rate expiry
- Valuation due
- Smoke alarm check (QLD)
- Gas/electrical safety (VIC)

**Features:**
- Calendar view
- Email/push notifications (30/7/1 days)
- Dashboard alerts for overdue items

#### 2.5 Document Storage

**Per-Property:**
- Settlement statement, contract
- Depreciation schedule (QS report)
- Insurance policies
- Lease agreements
- Inspection reports
- Rates notices

**Features:**
- Upload PDF, images, Word docs
- Auto-categorize by type
- Link to transactions
- Expiry tracking
- Full-text search

---

### Phase 3: Forecasting & Advanced (Months 6-8)

#### 3.1 Property Valuation Tracking

- Valuation history with source/type
- Growth % calculations
- Valuation timeline chart
- Future: CoreLogic AVM integration

#### 3.2 Scenario Modeler

**Property Forecast (10-year projection):**
- Value, loan balance, equity
- Useable equity at 80%/88%
- Weekly rent, cash flow

**Adjustable Assumptions:**
- Capital growth rate (slider 0-15%)
- Rent growth rate (slider 0-10%)
- Interest rate scenarios
- Vacancy rate
- Expense inflation

**Milestone Markers:**
- "Cash flow positive in: Year X"
- "Enough equity for deposit in: Year X"
- "LVR below 80% in: Year X"

#### 3.3 Portfolio Scenario Planning

**What-If Analysis:**
- Interest rate changes impact
- Sell property impact
- Buy new property simulation

**Cash Required in Offset:**
- Per-property break-even calculation
- Formula: Annual Loss ÷ Interest Rate = Required Offset Balance

#### 3.4 Receipt OCR & Smart Capture

- Mobile receipt photo capture
- OCR extraction (date, amount, vendor)
- AI category suggestion
- Email forwarding for auto-processing

#### 3.5 Capital Works Tracker

- Renovation project tracking
- Budget vs actual
- Capital vs repair categorization
- CGT cost base impact

#### 3.6 Rent Roll (Light)

- Tenant and lease tracking
- Expected vs actual rent
- Vacancy period tracking
- Rent review calculator

#### 3.7 Multi-Entity Support

- Personal, Trust, SMSF, Company entities
- Per-entity dashboard views
- Cross-entity portfolio consolidation

---

## Data Model

### Core Entities

```
USER
├── id (UUID)
├── email (unique)
├── password_hash
├── name
├── timezone (default: Australia/Sydney)
├── financial_year_start (default: 7)
├── stripe_customer_id
├── subscription_status (free/pro/cancelled)
└── subscription_ends_at

ENTITY
├── id (UUID)
├── user_id (FK)
├── name
├── type (personal/trust/smsf/company)
├── abn
├── tfn (encrypted)
└── tax_rate

PROPERTY
├── id (UUID)
├── user_id (FK)
├── entity_id (FK)
├── address_line_1, suburb, state, postcode
├── property_type (house/unit/townhouse/commercial)
├── bedrooms, bathrooms, car_spaces
├── land_size_sqm, building_size_sqm
├── year_built
├── purchase_date, purchase_price
├── settlement_date, available_for_rent
├── status (active/sold/settling)
├── sold_date, sold_price
├── current_value
└── image_url

PROPERTY_OWNERSHIP
├── id (UUID)
├── property_id (FK)
├── entity_id (FK)
└── ownership_percentage

LOAN
├── id (UUID)
├── property_id (FK)
├── lender
├── loan_type (p_and_i/interest_only)
├── rate_type (fixed/variable)
├── original_amount, current_balance
├── interest_rate
├── fixed_rate_expiry
├── repayment_amount, repayment_frequency
├── offset_account_id (FK)
└── offset_balance

BANK_ACCOUNT
├── id (UUID)
├── user_id (FK)
├── basiq_account_id
├── institution
├── account_name, account_number_masked
├── account_type (transaction/savings/mortgage/offset/credit)
├── default_property_id (FK)
├── is_connected
└── last_synced_at

TRANSACTION
├── id (UUID)
├── user_id (FK)
├── property_id (FK)
├── bank_account_id (FK)
├── basiq_transaction_id
├── date
├── description_raw, description_clean
├── amount
├── type (income/expense/capital/transfer)
├── category_id (FK)
├── subcategory
├── is_deductible, is_capitalised, is_verified
├── is_split, parent_transaction_id (FK)
├── document_id (FK)
├── notes
└── financial_year

CATEGORY
├── id (UUID)
├── name
├── type (income/expense/capital)
├── ato_code
├── is_system
├── user_id (for custom)
└── display_order

CATEGORIZATION_RULE
├── id (UUID)
├── user_id (FK)
├── match_type (contains/starts_with/exact/regex)
├── match_value
├── property_id (FK)
├── category_id (FK)
├── priority
└── is_active

ACQUISITION_COST
├── id (UUID)
├── property_id (FK)
├── category
├── description
├── amount
├── date_paid
└── document_id (FK)

BORROWING_EXPENSE
├── id (UUID)
├── property_id (FK)
├── loan_id (FK)
├── category
├── description
├── total_amount
├── date_incurred
├── amortization_years (default: 5)
├── annual_deduction
├── start_year
└── document_id (FK)

DEPRECIATION_SCHEDULE
├── id (UUID)
├── property_id (FK)
├── division (div_43/div_40)
├── asset_name
├── category
├── original_value
├── effective_life_years
├── method (prime_cost/diminishing_value)
├── date_acquired
├── opening_written_down
├── annual_deduction
├── is_low_value_pool
└── qs_report_id (FK)

DEPRECIATION_CLAIM
├── id (UUID)
├── depreciation_schedule_id (FK)
├── financial_year
├── amount_claimed
└── closing_written_down

DOCUMENT
├── id (UUID)
├── user_id (FK)
├── property_id (FK)
├── type
├── name
├── file_url
├── file_size_bytes
├── mime_type
├── expiry_date
└── ocr_extracted_data (JSONB)

VALUATION
├── id (UUID)
├── property_id (FK)
├── date
├── amount
├── source (bank/aps/corelogic/owner/sale)
├── type (full/desktop/avm/estimate)
├── notes
└── document_id (FK)

REMINDER
├── id (UUID)
├── user_id (FK)
├── property_id (FK)
├── type
├── title
├── due_date
├── recurrence (none/annual/quarterly/monthly)
├── remind_days_before (INT[])
├── is_completed
└── completed_at

RENTAL_INCOME
├── id (UUID)
├── property_id (FK)
├── tenant_name
├── lease_start, lease_end
├── weekly_rent
├── payment_frequency
├── bond_amount, bond_lodgement_ref
├── status (active/expired/terminated)
└── notes
```

---

## Technical Architecture

### Tech Stack

| Layer | Technology | Reasoning |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router) | SSR, API routes, Vercel deployment |
| UI Components | shadcn/ui + Tailwind | Copy-paste components, no lock-in |
| State | TanStack Query + Zustand | Server state + minimal client state |
| Forms | React Hook Form + Zod | Type-safe validation |
| Charts | Recharts | React-native friendly |
| Mobile | React Native + Expo | Share logic with web |
| Backend | tRPC | End-to-end type safety |
| Runtime | Node.js 20 | Mature ecosystem |
| Database | PostgreSQL (Supabase) | Managed, AU region |
| ORM | Drizzle ORM | Type-safe, lightweight |
| Cache | Upstash Redis | Serverless |
| File Storage | Cloudflare R2 | S3-compatible, no egress fees |
| Email | Resend | Developer-friendly |
| Payments | Stripe | Industry standard |
| Auth | Clerk or Supabase Auth | Managed auth |
| Hosting | Vercel + Supabase | Simple, auto-scaling |
| Monitoring | Sentry + Axiom | Errors + logs |

### High-Level Architecture

```
CLIENTS (Web, iOS, Android)
         │
         ▼
    API GATEWAY (Cloudflare/Vercel Edge)
         │
         ▼
    BACKEND API (Node.js + tRPC)
         │
    ┌────┼────┬─────────┐
    ▼    ▼    ▼         ▼
PostgreSQL  Redis  Cloudflare R2  External APIs
(Supabase) (Upstash) (Documents)  (Basiq, Stripe, etc.)
```

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, signup
│   ├── (dashboard)/       # Authenticated routes
│   │   ├── properties/
│   │   ├── transactions/
│   │   ├── reports/
│   │   ├── banking/
│   │   ├── documents/
│   │   ├── reminders/
│   │   └── settings/
│   └── api/trpc/          # tRPC API routes
├── components/
│   ├── ui/                # shadcn components
│   ├── forms/
│   ├── dashboard/
│   └── charts/
├── lib/
│   ├── trpc/
│   ├── utils/
│   └── validators/
├── server/
│   ├── routers/           # tRPC routers
│   ├── services/          # Business logic
│   ├── jobs/              # Background jobs
│   └── db/                # Schema, migrations
└── types/
```

---

## Third-Party Integrations

### 1. Basiq (Bank Feeds) - CRITICAL

- **Purpose:** Connect Australian bank accounts, import transactions
- **Coverage:** 150+ institutions including Big 4, Firstmac, ING
- **Pricing:** Free (10 connections), $99/mo (100), $499/mo (1000)
- **Integration:** OAuth flow, webhook for real-time updates

### 2. Stripe (Payments)

- **Purpose:** Subscription billing
- **Pricing:** 1.75% + $0.30 per transaction
- **Features:** Checkout, webhooks, customer portal

### 3. Resend (Email)

- **Purpose:** Transactional emails, reminders
- **Pricing:** Free up to 3,000/month
- **Templates:** Welcome, reminders, tax reports, payment failed

### 4. Cloudflare R2 (Storage)

- **Purpose:** Documents, receipts, PDFs
- **Pricing:** $0.015/GB/month, FREE egress
- **Features:** S3-compatible, signed URLs

### 5. Google Places API

- **Purpose:** Address autocomplete
- **Pricing:** $2.83/1K requests

### 6. PDF Generation

- **Library:** @react-pdf/renderer
- **Purpose:** Tax reports, portfolio summaries

### 7. OCR (Phase 3)

- **Service:** Mindee
- **Purpose:** Receipt data extraction
- **Pricing:** $0.10/page

### Integration Costs

| Service | At Launch | 100 Users | 1,000 Users |
|---------|-----------|-----------|-------------|
| Basiq | $0 | $99 | $499 |
| Stripe | ~$0 | ~$45 | ~$450 |
| Resend | $0 | $0 | $20 |
| R2 | ~$1 | ~$5 | ~$30 |
| Supabase | $0 | $25 | $25 |
| Vercel | $0 | $20 | $20 |
| **Total** | **~$1** | **~$199** | **~$1,074** |

---

## Monetization Strategy

### Pricing Tiers

| Feature | Free | Pro ($15/mo) | Pro Annual ($144/yr) |
|---------|------|--------------|----------------------|
| Properties | 1 | Unlimited | Unlimited |
| Manual transactions | ✓ | ✓ | ✓ |
| Bank feed integration | ✗ | ✓ | ✓ |
| Auto-categorization | ✗ | ✓ | ✓ |
| Dashboard & metrics | Basic | Full | Full |
| Tax reports | ✗ | ✓ | ✓ |
| Depreciation tracking | ✗ | ✓ | ✓ |
| Document storage | 100MB | 5GB | 5GB |
| Reminders | 3 active | Unlimited | Unlimited |

### Conversion Strategy

**Upgrade Triggers:**
1. Add second property → paywall
2. Click "Connect Bank" → paywall
3. Click "Generate Tax Report" → paywall
4. Tax season (April-June) → email campaign
5. After 30 manual transactions → "Save time" prompt

**Trial:** 14-day Pro trial, no credit card required

### Revenue Projections

**Year 1 (Conservative):**
- End of Year 1: ~170 Pro users
- MRR: ~$2,600
- ARR: ~$31,000

**Year 2 (With Traction):**
- Potential: $120K-200K ARR

### Additional Revenue Streams (Future)

- Depreciation schedule referrals (QS firms): $50-100/referral
- Accountant referrals: $50-100/referral
- Mortgage broker referrals: Higher value, compliance-heavy

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-8)

**Goal:** Launch chargeable product with core value proposition

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1-2 | Foundation | Auth, user accounts, UI shell, property CRUD |
| 3-4 | Banking | Basiq integration, account connection, transaction import |
| 5-6 | Core Features | Transaction categorization, rules engine, basic dashboard |
| 7-8 | Polish & Launch | Stripe billing, CSV export, bug fixes, launch |

**Launch Checklist:**
- [ ] User can sign up and log in
- [ ] User can add properties with acquisition costs
- [ ] User can connect bank accounts (Basiq)
- [ ] Transactions auto-import and can be categorized
- [ ] Basic dashboard shows portfolio metrics
- [ ] Stripe subscription working
- [ ] CSV export functional

### Phase 2: Tax & Compliance (Months 3-5)

| Month | Focus | Deliverables |
|-------|-------|--------------|
| 3 | Depreciation | Borrowing expense amortization, Division 43/40 tracking |
| 4 | Tax Reports | EOFY report generation, accountant export |
| 5 | Reminders | Calendar, notifications, document storage |

**Target:** Launch tax features before May (EOFY rush)

### Phase 3: Forecasting & Advanced (Months 6-8)

| Month | Focus | Deliverables |
|-------|-------|--------------|
| 6 | Valuations | Valuation history, scenario modeler |
| 7 | Advanced | Receipt OCR, capital works tracker |
| 8 | Polish | Multi-entity views, rent roll, mobile app improvements |

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Basiq integration complexity | Medium | High | Start integration early, have CSV fallback |
| Bank feed reliability | Medium | Medium | Show sync status, manual entry always available |
| Data security breach | Low | Critical | Encryption, audit logs, security review |
| Scalability issues | Low | Medium | Start with managed services, monitor early |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low conversion rate | Medium | High | Validate with landing page before building |
| High CAC | Medium | High | Focus on SEO/content, referral program |
| Competitor response | Medium | Medium | Move fast, build community, unique features |
| Regulatory changes | Low | Medium | Stay updated on ATO rules, flexible architecture |
| Scope creep | High | Medium | Strict phase boundaries, launch ugly and iterate |

### Mitigation Priorities

1. **Validate before building** - Landing page + waitlist first
2. **Launch early** - 8-week MVP, charge from day one
3. **Talk to users** - Call every early customer
4. **Monitor metrics** - Track conversion, churn, NPS weekly

---

## Success Metrics

### North Star Metric

**Monthly Active Paying Users (MAPU)** - Users who logged in at least once and have active Pro subscription

### Phase 1 Success Criteria (Week 8)

- [ ] 10 paying customers
- [ ] <5% critical bug rate
- [ ] Bank sync working for Big 4 banks
- [ ] NPS > 30 from beta users

### Phase 2 Success Criteria (Month 5)

- [ ] 50 paying customers
- [ ] Tax report generation working
- [ ] <3% monthly churn
- [ ] 2+ organic signups per week

### Phase 3 Success Criteria (Month 8)

- [ ] 100 paying customers
- [ ] $1,500+ MRR
- [ ] Mobile app launched
- [ ] 3+ five-star reviews

### Long-Term Goals

| Timeframe | Target |
|-----------|--------|
| Year 1 | 150 paying users, $30K ARR |
| Year 2 | 500 paying users, $100K ARR |
| Year 3 | 1,500 paying users, $300K ARR, passive income achieved |

---

## Appendix A: Competitor Analysis

### Australian Competitors

| Product | Strengths | Weaknesses | Pricing |
|---------|-----------|------------|---------|
| TaxTank | AU tax focus, audit-ready | Tax-only, no portfolio analytics | ~$15/mo |
| PropertyDirector | Bookkeeping + forecaster | Dated UI, enterprise-focused | Subscription |
| Investment Property Tracker | 30-year projections | Limited automation | ~$10/mo |
| PropVA | AI document processing | New, unproven | Unknown |
| POSH/Supertech | Deep analysis | Desktop software, dated | One-time |

### International (Feature Inspiration)

| Product | Key Features |
|---------|--------------|
| Landlord Studio | Bank feeds, receipt OCR, Xero integration |
| Stessa | Free tier, 20+ reports, integrated banking |

### Differentiation Opportunities

Features no competitor offers:
- "Who Pays" breakdown (Taxman/Tenant/You)
- Useable Equity at 80% AND 88% LVR
- Cash Required in Offset to Break Even
- True Profit vs True Cash distinction
- Multi-entity portfolio consolidation

---

## Appendix B: ATO Compliance Notes

### Financial Year

Australian financial year: July 1 - June 30

### Depreciation Rules

**Borrowing Expenses:**
- Amortized over 5 years or loan term (whichever is shorter)
- If loan refinanced, remaining balance deductible immediately

**Division 43 (Building):**
- 2.5% for buildings constructed after 15 September 1987
- Based on original construction cost

**Division 40 (Plant & Equipment):**
- Effective life set by ATO
- Prime cost or Diminishing value method
- Low-value pool for items <$1,000

### Rental Property Deductions

All expense categories aligned with ATO Rental Properties guide and Individual Tax Return Schedule.

---

## Appendix C: User Personas

### Primary: "DIY Dave"

- **Demographics:** 35-50, owns 2-4 properties, manages own portfolio
- **Current tools:** Spreadsheets, bank statements, shoebox of receipts
- **Pain points:** Manual data entry, tax time panic, no real-time visibility
- **Goals:** Save time, maximize deductions, grow portfolio
- **Quote:** "I spend hours every month on spreadsheets. There has to be a better way."

### Secondary: "Trust Tanya"

- **Demographics:** 40-55, owns 3-6 properties across trust structures
- **Current tools:** Accountant handles most things, PropertyMe for management
- **Pain points:** No consolidated view, complex ownership splits
- **Goals:** See full portfolio picture, optimize across entities
- **Quote:** "I have properties in my name, a family trust, and SMSF. I can never see the full picture."

### Tertiary: "New Investor Nick"

- **Demographics:** 28-35, just bought first investment property
- **Current tools:** Nothing yet, overwhelmed by options
- **Pain points:** Doesn't know what to track, scared of tax mistakes
- **Goals:** Get organized from day one, learn as they go
- **Quote:** "I just settled on my first IP. What do I need to track?"

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-23 | 1.0 | Initial design document |

---

*This document serves as the source of truth for PropertyTracker development. Update as decisions are made and requirements evolve.*
