# Tax Position Calculator - Design Document

**Date:** 2026-01-26
**Status:** Approved
**Author:** Claude + Matthew Gleeson

---

## Overview

A comprehensive tax position calculator that shows users their estimated tax refund or amount owing, with emphasis on how their rental properties contribute to tax savings.

### Goals

- Show users their estimated tax refund/owing for the current financial year
- Highlight the tax savings from rental property losses (the app's value proposition)
- Support what-if exploration with inline editing
- Provide both persistent storage and temporary scenario testing

### Key Decisions

| Decision | Choice |
|----------|--------|
| Scope | Comprehensive (salary, PAYG, Medicare, MLS, HECS, other deductions) |
| Storage | Persistent profile + what-if editing |
| UI Location | Dashboard card + dedicated `/reports/tax-position` page |
| What-if UX | Inline sliders/fields, live updates, reset to saved |
| Taxpayer scope | Single taxpayer (logged-in user only) |
| Tax tables | Hardcoded per FY (last 3-4 years) |
| Other deductions | Single "other deductions" field |
| HECS | Simple toggle (yes/no) |
| MLS | Full calculation (PHI, family status, dependents, partner income) |
| Rental data | Automatic from transactions, with override for what-if |
| Empty state | Guided setup wizard with preview teaser |

---

## Data Model

### New Table: `tax_profiles`

Stores the user's tax information for calculating their position. One profile per user per financial year.

```typescript
export const taxProfiles = pgTable("tax_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  financialYear: integer("financial_year").notNull(), // e.g., 2026 for FY2025-26

  // Income
  grossSalary: decimal("gross_salary", { precision: 12, scale: 2 }),
  paygWithheld: decimal("payg_withheld", { precision: 12, scale: 2 }),
  otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).default("0"),

  // HECS/HELP
  hasHecsDebt: boolean("has_hecs_debt").default(false),

  // Medicare Levy Surcharge
  hasPrivateHealth: boolean("has_private_health").default(false),
  familyStatus: text("family_status").default("single"), // single | couple | family
  dependentChildren: integer("dependent_children").default(0),
  partnerIncome: decimal("partner_income", { precision: 12, scale: 2 }),

  // Metadata
  isComplete: boolean("is_complete").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tax_profiles_user_year_idx").on(table.userId, table.financialYear),
]);
```

**Key Points:**
- `financialYear` allows historical profiles (FY2024, FY2025, etc.)
- `isComplete` tracks whether user has finished setup wizard
- Rental property data is NOT stored here - pulled live from transactions
- Partner income only used for MLS threshold calculation
- Unique constraint on `(userId, financialYear)` ensures one profile per year

---

## Tax Calculation Logic

### Tax Tables Structure

```typescript
interface TaxTable {
  brackets: { min: number; max: number; rate: number; base: number }[];
  medicareLevy: number; // 2%
  mlsThresholds: { single: number; family: number; childAdd: number };
  mlsTiers: { min: number; max: number; rate: number }[];
  hecsRates: { min: number; max: number; rate: number }[];
}

const TAX_TABLES: Record<number, TaxTable> = {
  2026: { /* FY2025-26 rates */ },
  2025: { /* FY2024-25 rates */ },
  2024: { /* FY2023-24 rates */ },
};
```

### Calculation Flow

```
1. Taxable Income
   = Gross Salary + Rental Net Result - Other Deductions

2. Base Tax
   = Apply marginal brackets to taxable income

3. Medicare Levy
   = Taxable Income × 2%

4. Medicare Levy Surcharge (if applicable)
   = Combined Income × MLS rate (1%, 1.25%, or 1.5%)
   (Only if no private health AND income above threshold)

5. HECS Repayment (if applicable)
   = Repayment Income × HECS rate (0% to 10% based on income)

6. Total Tax Liability
   = Base Tax + Medicare Levy + MLS + HECS

7. Refund / Owing
   = PAYG Withheld - Total Tax Liability
   (Positive = refund, Negative = owing)

8. Property Tax Savings
   = |Rental Net Result| × Marginal Tax Rate
```

### Edge Cases

- Negative taxable income → Tax = $0 (loss carried forward, not modeled)
- Rental profit (positive) → Increases tax liability
- No PAYG withheld → Shows amount owing

---

## UI Design

### Dashboard Card

**Location:** Main dashboard alongside existing cards (Properties, Transactions, etc.)

#### State 1: Profile Not Set Up
```
┌─────────────────────────────────┐
│  Tax Position           FY2026 │
│                                 │
│  💰 See your estimated refund   │
│                                 │
│  [Set up in 2 min →]            │
└─────────────────────────────────┘
```

#### State 2: Profile Complete - Refund
```
┌─────────────────────────────────┐
│  Tax Position           FY2026 │
│                                 │
│  Estimated Refund               │
│  $8,542                         │
│                                 │
│  🏠 Properties saved you $4,588 │
│                                 │
│  View details →                 │
└─────────────────────────────────┘
```

#### State 3: Profile Complete - Owing
```
┌─────────────────────────────────┐
│  Tax Position           FY2026 │
│                                 │
│  Estimated Owing                │
│  $2,150                         │
│                                 │
│  🏠 Properties reduced by $4,588│
│                                 │
│  View details →                 │
└─────────────────────────────────┘
```

**Behavior:**
- Auto-detects current FY based on today's date
- Refund shown in green, owing shown in amber/red
- "Properties saved/reduced" always shows the tax benefit
- Click anywhere on card → navigates to `/reports/tax-position`
- Updates in real-time as transactions are categorized

### Tax Position Page

**Route:** `/reports/tax-position`

```
┌──────────────────────────────────────────────────────────────────┐
│  Tax Position                                      FY: [2026 ▼]  │
│  Your estimated tax outcome for the financial year               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  ESTIMATED REFUND                                                │
│  $8,542                                                          │
│                                                                  │
│  🏠 Your rental properties saved you $4,588 in tax               │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────────────────┐
│  YOUR INCOME            │  │  DEDUCTIONS                         │
│                         │  │                                     │
│  Gross salary           │  │  Rental property loss    -$12,400   │
│  $95,000        [Edit]  │  │  Based on transactions [Edit][View] │
│                         │  │                                     │
│  PAYG withheld          │  │  Other deductions         -$2,500   │
│  $22,400        [Edit]  │  │  Work, donations, etc.     [Edit]   │
│                         │  │                                     │
│  ─────────────────────  │  │  ─────────────────────────────────  │
│  Taxable income         │  │  Total deductions        -$14,900   │
│  $80,100                │  │                                     │
└─────────────────────────┘  └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  TAX CALCULATION                                                 │
│                                                                  │
│  Tax on taxable income                              $16,467      │
│  Medicare levy (2%)                                  $1,602      │
│  Medicare Levy Surcharge                                $0       │
│  HECS/HELP repayment                                $2,389       │
│  ────────────────────────────────────────────────────────────    │
│  Total tax liability                               $20,458       │
│  Less: PAYG already paid                          -$22,400       │
│  ────────────────────────────────────────────────────────────    │
│  ESTIMATED REFUND                                   $8,542       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  TAX SETTINGS                                                    │
│                                                                  │
│  ☑ I have a HECS/HELP debt                                      │
│  ☐ I have private hospital cover                                │
│                                                                  │
│  Family status: [Single ▼]                                       │
│  Dependent children: [0]  (shown if Couple/Family)              │
│  Partner's income: [$___] (shown if Couple/Family)              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  ⚠ You have unsaved changes         [Reset] [Save to profile]   │
└──────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- All editable fields update calculation in real-time
- "Unsaved changes" bar appears when any value differs from saved profile
- "Reset" reverts all fields to saved values
- "Save to profile" persists changes
- FY dropdown allows viewing previous years (uses that year's tax tables)
- "View" link on rental property opens tax report breakdown

### Setup Wizard

**Triggered:** First visit to `/reports/tax-position` when no profile exists.

#### Step 1: Gross Salary
```
┌──────────────────────────────────────────────────────────────────┐
│  Let's estimate your tax refund                         Step 1/5 │
│                                                                  │
│  What's your annual gross salary?                                │
│  (Before tax, from your payslip or contract)                     │
│                                                                  │
│  $ [________95,000__________]                                    │
│                                                                  │
│                                           [Skip] [Continue →]    │
└──────────────────────────────────────────────────────────────────┘
```

#### Steps:

1. **Gross Salary** - "What's your annual gross salary?"
2. **PAYG Withheld** - "How much tax has been withheld this FY?"
3. **HECS/HELP** - "Do you have a HECS/HELP debt?" (Yes/No)
4. **Private Health & Family** - PHI toggle, family status, partner income, dependents
5. **Other Deductions** - "Any other tax deductions?"

#### Completion Screen
```
┌──────────────────────────────────────────────────────────────────┐
│  🎉 Your estimated refund                                        │
│                                                                  │
│          $8,542                                                  │
│                                                                  │
│  Your rental properties saved you $4,588 in tax!                 │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│  Gross salary              $95,000                               │
│  Rental loss              -$12,400                               │
│  Tax payable               $20,458                               │
│  PAYG paid                -$22,400                               │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│                                        [View full breakdown →]   │
└──────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- "Skip" on any step uses sensible default ($0 or unchecked)
- Can go back to previous steps
- Profile marked `isComplete: true` on finish
- Rental data pulled automatically (not a wizard step)

### Preview Teaser (Before Setup)

Tax position page shows teaser if profile not complete:

```
┌──────────────────────────────────────────────────────────────────┐
│  Your rental properties show a loss of $12,400                   │
│                                                                  │
│  Based on a 37% tax bracket, this could save you ~$4,588         │
│                                                                  │
│                    [Get your exact estimate →]                   │
│                       Set up in 2 minutes                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### New Files

```
src/server/db/schema.ts                    # Add taxProfiles table
src/lib/tax-tables.ts                      # Hardcoded tax tables per FY
src/server/services/tax-position.ts        # Tax calculation logic
src/server/routers/taxPosition.ts          # tRPC router

src/app/(dashboard)/reports/tax-position/page.tsx
src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx

src/components/tax-position/
  ├── TaxPositionCard.tsx        # Dashboard card
  ├── TaxPositionSummary.tsx     # Hero refund/owing display
  ├── IncomeSection.tsx          # Salary, PAYG inputs
  ├── DeductionsSection.tsx      # Rental + other deductions
  ├── CalculationBreakdown.tsx   # Tax calculation table
  ├── TaxSettings.tsx            # HECS, MLS, family settings
  ├── SetupWizard.tsx            # Step-by-step setup
  └── UnsavedChangesBar.tsx      # Save/reset prompt
```

### tRPC Router Endpoints

```typescript
taxPosition.getProfile        // Get saved profile for FY
taxPosition.saveProfile       // Create/update profile
taxPosition.calculate         // Calculate tax position (accepts overrides)
taxPosition.getPropertyResult // Get rental net result for FY
```

### Key Implementation Notes

1. **Calculation is stateless** - `calculate` endpoint accepts all inputs as parameters, doesn't require saved profile. Enables what-if without saving.

2. **Dashboard card uses cached query** - Invalidate when transactions change or profile updates.

3. **Tax tables in separate file** - `src/lib/tax-tables.ts` for easy annual updates.

4. **Rental data integration** - Reuse `getFinancialYearTransactions` from existing reports service.

5. **FY detection** - July 1 = new FY. Auto-select current FY, allow dropdown for history.

6. **Validation** - Zod schemas for all inputs. Salary/PAYG must be positive. Partner income only required if Couple/Family + no PHI.

---

## Out of Scope (Future Enhancements)

- Partner/household tax calculations
- Entity-specific tax treatment (trusts, companies, SMSF)
- Multiple income sources
- Carry-forward losses modeling
- Integration with myGov/ATO APIs

---

## User Journey

1. User sees "Set up in 2 min" card on dashboard
2. Clicks through 5-step wizard (salary, PAYG, HECS, health, other)
3. Sees refund estimate with property savings highlighted
4. Dashboard now shows live refund estimate
5. Can return to tax position page to explore what-ifs
6. Changes update in real-time, save when ready

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-26 | Claude + Matthew Gleeson | Initial design |
