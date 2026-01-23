# PropertyTracker - Complete Feature Specification

**Date:** 2026-01-23
**Version:** 1.0
**Status:** Full Product Vision (All Features)

---

## Document Purpose

This document contains the **complete feature specification** for PropertyTracker, covering every feature, edge case, and future consideration. This is the "full vision" reference document—not scoped to MVP or any specific release.

Use this document to:
- Understand the complete product scope
- Plan feature prioritization
- Identify dependencies between features
- Ensure nothing is forgotten during development

---

## Table of Contents

1. [User Management](#1-user-management)
2. [Properties](#2-properties)
3. [Transactions](#3-transactions)
4. [Banking & Basiq Integration](#4-banking--basiq-integration)
5. [Loans](#5-loans)
6. [Depreciation](#6-depreciation)
7. [Tax & Reports](#7-tax--reports)
8. [Documents](#8-documents)
9. [Reminders](#9-reminders)
10. [Dashboard & Analytics](#10-dashboard--analytics)
11. [Multi-Entity Support](#11-multi-entity-support)
12. [Forecasting & Scenarios](#12-forecasting--scenarios)
13. [Rental & Tenant Management](#13-rental--tenant-management)
14. [Contacts](#14-contacts)
15. [Mobile App](#15-mobile-app)
16. [Settings & Configuration](#16-settings--configuration)
17. [Security & Compliance](#17-security--compliance)
18. [Error Handling & Edge Cases](#18-error-handling--edge-cases)
19. [Growth & Viral Features](#19-growth--viral-features)
20. [Admin & Internal Tools](#20-admin--internal-tools)
21. [Future & Advanced Features](#21-future--advanced-features)

---

## Feature Priority Key

Each feature is tagged with a priority:

| Priority | Meaning | Typical Release |
|----------|---------|-----------------|
| **P0** | Critical - Product doesn't work without it | v0.1 |
| **P1** | Important - Core value proposition | v0.5 - v1.0 |
| **P2** | Expected - Users will expect this | v1.0 - v1.5 |
| **P3** | Nice-to-have - Enhances experience | v1.5 - v2.0 |
| **P4** | Future - Long-term roadmap | v2.0+ |
| **P5** | Maybe Never - Consider carefully | Backlog |

---

## 1. User Management

### 1.1 Authentication

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| AUTH-001 | Email/password signup | Standard email + password registration | P0 |
| AUTH-002 | Google OAuth | Sign in with Google | P0 |
| AUTH-003 | Apple OAuth | Sign in with Apple (required for iOS) | P2 |
| AUTH-004 | Magic link login | Passwordless email login | P3 |
| AUTH-005 | Password reset | Forgot password flow | P0 |
| AUTH-006 | Email verification | Confirm email ownership | P0 |
| AUTH-007 | MFA / 2FA (TOTP) | Authenticator app support | P2 |
| AUTH-008 | MFA / 2FA (SMS) | SMS code verification | P3 |
| AUTH-009 | Biometric login (mobile) | Face ID / Touch ID | P2 |
| AUTH-010 | Session timeout | Auto-logout after inactivity | P2 |
| AUTH-011 | Session management | View and revoke active sessions | P3 |
| AUTH-012 | Login history | Audit log of login attempts | P3 |
| AUTH-013 | Suspicious login alerts | Notification on new device/location | P3 |
| AUTH-014 | Account lockout | Lock after failed attempts | P2 |

**Implementation Notes:**
- AUTH-001 through AUTH-006 handled by Clerk
- MFA should be optional but encouraged for finance app
- Session timeout default: 30 minutes inactive, configurable

### 1.2 User Profile

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROF-001 | Display name | User's full name | P0 |
| PROF-002 | Email address | Primary email (from auth) | P0 |
| PROF-003 | Phone number | For SMS notifications | P3 |
| PROF-004 | Profile photo | Avatar image | P4 |
| PROF-005 | Timezone | For date/time display | P1 |
| PROF-006 | Date format preference | DD/MM/YYYY vs MM/DD/YYYY | P3 |
| PROF-007 | Currency display format | $1,234.56 vs $1234.56 | P4 |
| PROF-008 | Financial year start month | Default: July (Australian FY) | P1 |

### 1.3 Notification Preferences

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| NOTIF-001 | Master email toggle | Enable/disable all emails | P2 |
| NOTIF-002 | Reminder emails | Enable/disable reminder notifications | P2 |
| NOTIF-003 | Marketing emails | Opt-in/out for promotional content | P2 |
| NOTIF-004 | Weekly summary email | Portfolio snapshot every week | P3 |
| NOTIF-005 | Monthly summary email | Detailed monthly report | P3 |
| NOTIF-006 | Push notifications (mobile) | Enable/disable push | P2 |
| NOTIF-007 | SMS notifications | For critical alerts only | P4 |
| NOTIF-008 | Notification frequency | Immediate / daily digest / weekly | P3 |
| NOTIF-009 | Per-reminder-type settings | Configure each reminder type | P3 |

### 1.4 Account Management

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ACCT-001 | Change email | With verification of new email | P2 |
| ACCT-002 | Change password | Via Clerk | P0 |
| ACCT-003 | Delete account | With confirmation, deletes all data | P2 |
| ACCT-004 | Export all data | Download all user data as JSON/CSV | P2 |
| ACCT-005 | Account freeze | Temporarily disable account | P4 |
| ACCT-006 | Cancellation survey | Collect reasons when leaving | P3 |
| ACCT-007 | Reactivate account | Within X days of cancellation | P4 |

---

## 2. Properties

### 2.1 Property CRUD Operations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-001 | Add property | Create new property record | P0 |
| PROP-002 | Edit property | Modify any property field | P1 |
| PROP-003 | Delete property | Remove property (soft delete) | P2 |
| PROP-004 | Archive property | Hide from active view, keep data | P3 |
| PROP-005 | Restore archived property | Unarchive | P3 |
| PROP-006 | Duplicate property | Copy settings for similar property | P4 |
| PROP-007 | Property ordering | Custom sort order | P3 |
| PROP-008 | Property grouping | Group by state, entity, etc. | P4 |
| PROP-009 | Bulk property import | CSV import multiple properties | P4 |

### 2.2 Property Basic Details

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-010 | Street address | Line 1 of address | P0 |
| PROP-011 | Address line 2 | Unit number, etc. | P1 |
| PROP-012 | Suburb | | P0 |
| PROP-013 | State | NSW/VIC/QLD/SA/WA/TAS/NT/ACT | P0 |
| PROP-014 | Postcode | Australian postcode | P0 |
| PROP-015 | Address autocomplete | Google Places integration | P2 |
| PROP-016 | Property type | House/Unit/Townhouse/Commercial | P1 |
| PROP-017 | Bedrooms | Number of bedrooms | P1 |
| PROP-018 | Bathrooms | Number of bathrooms | P1 |
| PROP-019 | Car spaces (garage) | Enclosed parking | P2 |
| PROP-020 | Car spaces (carport) | Covered parking | P3 |
| PROP-021 | Land size (sqm) | Total land area | P2 |
| PROP-022 | Building size (sqm) | Internal floor area | P2 |
| PROP-023 | Year built | Construction year | P1 |
| PROP-024 | Construction type | Brick, timber frame, etc. | P3 |
| PROP-025 | Roof type | Metal, tile, etc. | P4 |
| PROP-026 | Pool/spa | Boolean + type | P3 |
| PROP-027 | Granny flat / dual occupancy | Secondary dwelling | P3 |
| PROP-028 | Zoning | Residential/commercial/mixed | P3 |
| PROP-029 | Strata/freehold | Title type | P2 |
| PROP-030 | Lot/plan number | Legal description | P3 |
| PROP-031 | Property notes | Free-form notes field | P2 |

### 2.3 Purchase Details

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-040 | Purchase price | Amount paid | P0 |
| PROP-041 | Purchase date | Contract date | P0 |
| PROP-042 | Settlement date | When ownership transferred | P1 |
| PROP-043 | Available for rent date | When first available for tenants | P1 |
| PROP-044 | Purchase type | Auction/private sale/off-market | P3 |
| PROP-045 | Deposit amount | Initial deposit paid | P3 |
| PROP-046 | Deposit date | When deposit paid | P3 |
| PROP-047 | Finance approval date | When loan approved | P3 |
| PROP-048 | First rental date | When first tenant moved in | P2 |
| PROP-049 | Days vacant before first rent | Calculated field | P3 |

### 2.4 Acquisition Costs (Capital)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-050 | Stamp duty | State transfer duty | P1 |
| PROP-051 | Conveyancing/legal fees | Settlement costs | P1 |
| PROP-052 | Buyer's agent fee | If used buyer's agent | P1 |
| PROP-053 | Building inspection | Pre-purchase inspection | P1 |
| PROP-054 | Pest inspection | Timber pest report | P1 |
| PROP-055 | Strata report | For units/townhouses | P2 |
| PROP-056 | Survey/title search | Title verification | P2 |
| PROP-057 | Transfer fees | Land titles office | P1 |
| PROP-058 | Title insurance | If purchased | P2 |
| PROP-059 | Trust setup costs | If purchased in trust | P2 |
| PROP-060 | FIRB fees | Foreign investment approval | P4 |
| PROP-061 | GST (commercial) | For commercial properties | P3 |
| PROP-062 | Other acquisition costs | Miscellaneous | P2 |
| PROP-063 | Stamp duty calculator | Auto-calculate by state | P3 |
| PROP-064 | Total cost base calculation | Sum for CGT purposes | P1 |

### 2.5 Property Status & Lifecycle

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-070 | Status: Active | Currently held, income-producing | P0 |
| PROP-071 | Status: Sold | Property has been sold | P1 |
| PROP-072 | Status: Settling | Between contract and settlement | P2 |
| PROP-073 | Status: Under offer | Selling in progress | P3 |
| PROP-074 | Status: Listed for sale | On market | P3 |
| PROP-075 | Status: Vacant | Between tenants | P2 |
| PROP-076 | Status: Being renovated | Major works in progress | P3 |
| PROP-077 | Status history | Track status changes over time | P3 |

### 2.6 Sale Details

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-080 | Sale price | Amount sold for | P1 |
| PROP-081 | Sale date | Contract date | P1 |
| PROP-082 | Sale settlement date | When buyer takes ownership | P2 |
| PROP-083 | Agent commission | Selling agent fee | P1 |
| PROP-084 | Marketing costs | Advertising, photography | P2 |
| PROP-085 | Auction fees | If sold at auction | P2 |
| PROP-086 | Legal fees (sale) | Conveyancing for sale | P2 |
| PROP-087 | Styling/staging costs | If property styled | P3 |
| PROP-088 | Repairs for sale | Pre-sale repairs | P3 |
| PROP-089 | CGT calculation | Capital gain/loss calculation | P2 |
| PROP-090 | CGT discount eligibility | >12 months ownership check | P2 |
| PROP-091 | Cost base summary | All capital costs for CGT | P2 |
| PROP-092 | Net proceeds calculation | Sale price minus all costs | P2 |

### 2.7 Property Images

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| PROP-100 | Primary image | Thumbnail for property cards | P3 |
| PROP-101 | Image gallery | Multiple property photos | P4 |
| PROP-102 | Upload from device | File picker | P3 |
| PROP-103 | Camera capture (mobile) | Take photo directly | P3 |
| PROP-104 | Image reorder | Drag to reorder | P4 |
| PROP-105 | Image delete | Remove image | P3 |
| PROP-106 | Street view integration | Google Street View embed | P4 |
| PROP-107 | Floorplan upload | Floor plan document | P4 |

---

## 3. Transactions

### 3.1 Transaction Sources

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TXN-001 | Bank feed import | Automatic via Basiq | P0 |
| TXN-002 | Manual entry | Add transaction manually | P0 |
| TXN-003 | CSV import | Bulk historical import | P1 |
| TXN-004 | Receipt OCR | Create from receipt photo | P2 |
| TXN-005 | Email forwarding | Auto-import from forwarded emails | P3 |
| TXN-006 | Recurring transaction | Auto-create periodic transactions | P3 |
| TXN-007 | Duplicate detection | Prevent double-entry | P1 |
| TXN-008 | API import | From accounting software | P4 |

### 3.2 Transaction Fields

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TXN-010 | Date | Transaction date | P0 |
| TXN-011 | Description (raw) | Original from bank | P0 |
| TXN-012 | Description (clean) | User-edited description | P1 |
| TXN-013 | Amount | Positive=income, negative=expense | P0 |
| TXN-014 | Property assignment | Which property this belongs to | P0 |
| TXN-015 | Category | ATO-aligned category | P0 |
| TXN-016 | Subcategory | User-defined subcategory | P2 |
| TXN-017 | Type | Income/Expense/Capital/Transfer | P0 |
| TXN-018 | Is deductible | Tax deductible flag | P1 |
| TXN-019 | Is capitalised | Adds to cost base | P1 |
| TXN-020 | Is verified | User has confirmed | P1 |
| TXN-021 | Notes | Free-form notes | P1 |
| TXN-022 | Receipt/document link | Attached proof | P1 |
| TXN-023 | Financial year | Which FY this belongs to | P0 |
| TXN-024 | GST component | For commercial properties | P3 |
| TXN-025 | Payment method | Cash/card/transfer | P3 |
| TXN-026 | Vendor/payee | Who was paid | P2 |
| TXN-027 | Reference number | Invoice/receipt number | P3 |
| TXN-028 | Reimbursable flag | Tenant should repay | P3 |

### 3.3 Transaction Operations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TXN-030 | Create transaction | Add new | P0 |
| TXN-031 | Edit transaction | Modify any field | P1 |
| TXN-032 | Delete transaction | Remove (soft delete) | P1 |
| TXN-033 | Split transaction | One payment → multiple categories | P1 |
| TXN-034 | Unsplit transaction | Revert split | P2 |
| TXN-035 | Merge transactions | Combine duplicates | P3 |
| TXN-036 | Bulk edit | Change field for multiple | P2 |
| TXN-037 | Bulk delete | Delete multiple | P2 |
| TXN-038 | Bulk categorize | Assign category to multiple | P1 |
| TXN-039 | Undo/redo | Revert recent changes | P3 |
| TXN-040 | Transaction history | Audit log of changes | P3 |

### 3.4 Transaction Views & Filters

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TXN-050 | List view | Table of transactions | P0 |
| TXN-051 | Calendar view | Transactions by day | P4 |
| TXN-052 | Filter by property | Show one property only | P0 |
| TXN-053 | Filter by category | Show one category only | P1 |
| TXN-054 | Filter by date range | Custom date range | P0 |
| TXN-055 | Filter by financial year | Quick FY selection | P0 |
| TXN-056 | Filter by verified status | Verified/unverified | P1 |
| TXN-057 | Filter by type | Income/expense/capital | P1 |
| TXN-058 | Filter by amount range | Min/max amount | P3 |
| TXN-059 | Search by description | Full-text search | P1 |
| TXN-060 | Uncategorized queue | Show items needing review | P1 |
| TXN-061 | Recently imported | Last sync batch | P2 |
| TXN-062 | Anomaly detection | Flag unusual transactions | P4 |
| TXN-063 | Sort options | Date, amount, category | P1 |
| TXN-064 | Pagination | For large transaction lists | P1 |

### 3.5 Categorization

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TXN-070 | Manual category selection | Dropdown selection | P0 |
| TXN-071 | Category search | Type to filter categories | P1 |
| TXN-072 | Keyboard shortcuts | Press key for category | P4 |
| TXN-073 | Auto-categorization rules | Rules engine | P1 |
| TXN-074 | AI-suggested category | ML-based suggestion | P4 |
| TXN-075 | Learn from corrections | Improve over time | P4 |
| TXN-076 | Category confidence score | Show certainty % | P4 |
| TXN-077 | Quick rule creation | "Always categorize like this" | P2 |
| TXN-078 | Rule priority ordering | Higher = checked first | P2 |
| TXN-079 | Rule testing/preview | See what rule matches | P3 |
| TXN-080 | Custom categories | User-defined beyond ATO | P3 |
| TXN-081 | Category aliases | Multiple names → same category | P4 |

### 3.6 Split Transactions

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TXN-090 | Split by amount | Specify dollar amounts | P1 |
| TXN-091 | Split by percentage | Specify percentages | P2 |
| TXN-092 | Split across properties | Shared expense | P2 |
| TXN-093 | Split across categories | Different expense types | P1 |
| TXN-094 | Split templates | Save common splits | P4 |
| TXN-095 | Shared expense allocation | Phone bill X% property | P3 |

### 3.7 ATO Categories

**Income Categories:**
| Code | Name | Description |
|------|------|-------------|
| INC-RENT | Rental income | Rent received from tenants |
| INC-OTHER | Other rental income | Insurance payouts, bond retained |

**Expense Categories (Deductible):**
| Code | Name | Deductible |
|------|------|------------|
| EXP-ADVERT | Advertising for tenants | Yes |
| EXP-BODY | Body corporate fees | Yes |
| EXP-BORROW | Borrowing expenses | Yes (amortised) |
| EXP-CLEAN | Cleaning | Yes |
| EXP-COUNCIL | Council rates | Yes |
| EXP-GARDEN | Gardening/lawn mowing | Yes |
| EXP-INSURE | Insurance | Yes |
| EXP-INTEREST | Interest on loans | Yes |
| EXP-LAND | Land tax | Yes |
| EXP-LEGAL | Legal expenses | Depends |
| EXP-PEST | Pest control | Yes |
| EXP-AGENT | Property agent fees | Yes |
| EXP-REPAIR | Repairs and maintenance | Yes |
| EXP-CAPWORKS | Capital works deductions | Yes |
| EXP-STATION | Stationery/phone/postage | Yes |
| EXP-TRAVEL | Travel expenses | Limited |
| EXP-WATER | Water charges | Yes |
| EXP-SUNDRY | Sundry rental expenses | Yes |
| EXP-DEPREC43 | Depreciation - Div 43 | Yes |
| EXP-DEPREC40 | Depreciation - Div 40 | Yes |

**Capital Categories (Not Deductible - CGT):**
| Code | Name | CGT Impact |
|------|------|------------|
| CAP-STAMP | Stamp duty | Adds to cost base |
| CAP-CONVEY | Conveyancing | Adds to cost base |
| CAP-BUYER | Buyer's agent fees | Adds to cost base |
| CAP-REPAIR | Initial repairs | Adds to cost base |
| CAP-RENO | Renovations | Adds to cost base |

**Other Categories:**
| Code | Name | Description |
|------|------|-------------|
| OTH-TRANSFER | Transfer | Between own accounts |
| OTH-PERSONAL | Personal | Not property related |
| OTH-UNCAT | Uncategorized | Needs review |

---

## 4. Banking & Basiq Integration

### 4.1 Bank Connection

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| BANK-001 | Connect bank account | Basiq OAuth flow | P0 |
| BANK-002 | Multiple bank connections | Connect several banks | P0 |
| BANK-003 | View connected accounts | List all accounts | P0 |
| BANK-004 | Disconnect account | Remove connection | P1 |
| BANK-005 | Reconnect expired | Re-auth when token expires | P1 |
| BANK-006 | Connection status indicator | Green/yellow/red status | P1 |
| BANK-007 | Last sync timestamp | When last synced | P1 |
| BANK-008 | Manual sync trigger | "Sync Now" button | P1 |
| BANK-009 | Auto-sync scheduling | Daily/hourly frequency | P2 |
| BANK-010 | Sync history log | When syncs happened | P3 |
| BANK-011 | Sync error handling | Clear error messages | P1 |
| BANK-012 | Bank logos/branding | Visual identification | P3 |
| BANK-013 | Bank search | Find bank in list | P1 |

### 4.2 Account Types

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| BANK-020 | Transaction account | Everyday account | P0 |
| BANK-021 | Savings account | Interest-bearing | P0 |
| BANK-022 | Mortgage account | Home loan | P0 |
| BANK-023 | Offset account | Mortgage offset | P1 |
| BANK-024 | Credit card | Credit facility | P1 |
| BANK-025 | Line of credit | LOC/redraw | P2 |
| BANK-026 | Account balance display | Show current balance | P2 |
| BANK-027 | Account balance history | Balance over time | P4 |

### 4.3 Account-Property Linking

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| BANK-030 | Default property per account | Auto-assign transactions | P0 |
| BANK-031 | Multiple properties per account | Shared expense account | P2 |
| BANK-032 | No property (personal) | Personal accounts | P1 |
| BANK-033 | Change default property | Reassign account | P1 |
| BANK-034 | Smart account detection | Guess property from name | P3 |

### 4.4 Transaction Import

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| BANK-040 | Initial historical import | 90 days on connect | P0 |
| BANK-041 | Ongoing daily sync | Automatic updates | P0 |
| BANK-042 | Custom date range import | Import specific period | P3 |
| BANK-043 | Duplicate prevention | Check basiq_transaction_id | P0 |
| BANK-044 | Import preview | Show before importing | P3 |
| BANK-045 | Selective import | Choose transactions | P4 |
| BANK-046 | Import progress indicator | Progress bar | P2 |
| BANK-047 | Historical limit handling | How far back available | P2 |
| BANK-048 | Rate limit handling | Basiq API limits | P2 |
| BANK-049 | Webhook real-time updates | Instant transaction sync | P3 |

### 4.5 CSV Import (Fallback)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| BANK-050 | Upload CSV file | File picker | P1 |
| BANK-051 | Column mapping | Map CSV to fields | P1 |
| BANK-052 | Date format detection | DD/MM/YYYY etc. | P1 |
| BANK-053 | Amount format handling | Negatives, brackets | P1 |
| BANK-054 | Preview before import | Show what will import | P1 |
| BANK-055 | Import validation | Error on bad rows | P1 |
| BANK-056 | Partial import | Skip bad, import good | P2 |
| BANK-057 | Import templates | Save mapping per bank | P3 |
| BANK-058 | Sample CSV download | Show expected format | P2 |

---

## 5. Loans

### 5.1 Loan Details

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| LOAN-001 | Lender name | Bank/institution | P0 |
| LOAN-002 | Loan account number | Masked for display | P2 |
| LOAN-003 | Loan type | P&I / Interest-only | P0 |
| LOAN-004 | Rate type | Fixed / Variable | P0 |
| LOAN-005 | Original loan amount | Initial borrowed | P0 |
| LOAN-006 | Current balance | Outstanding amount | P0 |
| LOAN-007 | Interest rate | Current rate | P0 |
| LOAN-008 | Fixed rate expiry | When fixed period ends | P1 |
| LOAN-009 | Loan term (years) | 25, 30 years | P2 |
| LOAN-010 | Loan start date | When loan commenced | P2 |
| LOAN-011 | Maturity date | When fully paid | P3 |
| LOAN-012 | Repayment amount | Regular payment | P0 |
| LOAN-013 | Repayment frequency | Weekly/fortnightly/monthly | P0 |
| LOAN-014 | Repayment day | Day of week/month | P1 |
| LOAN-015 | Interest-only period end | When IO expires | P2 |
| LOAN-016 | Split loan support | Fixed + variable portions | P3 |
| LOAN-017 | Redraw available | Available redraw | P3 |
| LOAN-018 | Redraw balance | Amount redrawn | P3 |

### 5.2 Offset Account

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| LOAN-020 | Link offset account | Connect offset to loan | P1 |
| LOAN-021 | Offset balance | Current offset balance | P1 |
| LOAN-022 | Interest saved calculation | Show savings from offset | P1 |
| LOAN-023 | Multiple offset accounts | Some loans allow this | P3 |
| LOAN-024 | Offset vs redraw comparison | Which is better | P4 |

### 5.3 Loan Operations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| LOAN-030 | Add loan | Create loan record | P0 |
| LOAN-031 | Edit loan | Modify details | P1 |
| LOAN-032 | Delete loan | Remove loan | P2 |
| LOAN-033 | Multiple loans per property | Top-up, second mortgage | P2 |
| LOAN-034 | Refinance tracking | Old → new loan | P2 |
| LOAN-035 | Rate change history | Track rate changes | P3 |
| LOAN-036 | Loan balance history | Balance over time | P3 |
| LOAN-037 | Auto-update from bank feed | Sync balance | P3 |
| LOAN-038 | Rate negotiation reminder | Last checked date + next check due | P2 |
| LOAN-039 | Historical rate comparison | What you were paying vs now | P3 |
| LOAN-040 | Equity release tracking | Date + amount of equity strip/top-up | P2 |
| LOAN-041 | New loan amount after top-up | Track balance changes from releases | P2 |

### 5.4 Loan Calculations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| LOAN-040 | LVR calculation | Balance / value | P0 |
| LOAN-041 | Weekly interest cost | Balance × rate / 52 | P0 |
| LOAN-042 | Monthly interest cost | Balance × rate / 12 | P1 |
| LOAN-043 | Annual interest cost | Balance × rate | P1 |
| LOAN-044 | Principal vs interest split | How much is principal | P2 |
| LOAN-045 | Remaining term | Years/months left | P2 |
| LOAN-046 | Projected payoff date | At current repayments | P2 |
| LOAN-047 | Extra repayment impact | Pay $X more, save Y years | P3 |

### 5.5 Equity Calculations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| LOAN-050 | Equity (value - loan) | Basic equity | P0 |
| LOAN-051 | Useable equity @ 80% LVR | Available at 80% | P1 |
| LOAN-052 | Useable equity @ 88% LVR | Available at 88% (with LMI) | P1 |
| LOAN-053 | Useable equity @ 90% LVR | Higher risk threshold | P3 |
| LOAN-054 | Custom LVR threshold | User-defined | P3 |
| LOAN-055 | Equity release simulation | "If I release $50K..." | P2 |
| LOAN-056 | Portfolio total useable equity | Across all properties | P1 |

---

## 6. Depreciation

### 6.1 Borrowing Expenses (Amortised)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DEP-001 | Add borrowing expense | Create record | P1 |
| DEP-002 | Expense type selection | LMI, mortgage reg, etc. | P1 |
| DEP-003 | Total amount | Full expense amount | P1 |
| DEP-004 | Date incurred | When expense paid | P1 |
| DEP-005 | Amortization period | Default 5 years | P1 |
| DEP-006 | Annual deduction calculation | Auto: total / years | P1 |
| DEP-007 | Year-by-year breakdown | Show each year | P1 |
| DEP-008 | Remaining balance | Unclaimed amount | P1 |
| DEP-009 | Refinance write-off | Immediate deduction on refi | P2 |
| DEP-010 | Linked document | Attach invoice | P2 |
| DEP-011 | Edit borrowing expense | Modify | P2 |
| DEP-012 | Delete borrowing expense | Remove | P2 |

**Borrowing Expense Types:**
- LMI (Lenders Mortgage Insurance)
- Mortgage registration fee
- Valuation fee
- Settlement fee
- Documentation fee
- Solicitor/legal fee
- Title search fee
- Loan establishment fee
- Other borrowing cost

### 6.2 Division 43 (Building/Capital Works)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DEP-020 | Construction completion date | When building finished | P1 |
| DEP-021 | Original construction cost | Building cost | P1 |
| DEP-022 | Depreciation rate | 2.5% or 4% based on date | P1 |
| DEP-023 | Annual deduction | Auto-calculated | P1 |
| DEP-024 | Cumulative claimed | Total claimed to date | P1 |
| DEP-025 | Remaining to claim | What's left | P2 |
| DEP-026 | QS report upload | Store depreciation schedule | P1 |
| DEP-027 | QS report data extraction | Parse values from PDF | P4 |
| DEP-028 | Building vs renovation split | Different start dates | P3 |
| DEP-029 | Edit Division 43 | Modify | P2 |
| DEP-030 | Delete Division 43 | Remove | P2 |

### 6.3 Division 40 (Plant & Equipment)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DEP-040 | Asset list | All depreciable items | P1 |
| DEP-041 | Asset name | Description | P1 |
| DEP-042 | Asset category | Hot water, carpet, etc. | P2 |
| DEP-043 | Original cost | Purchase price | P1 |
| DEP-044 | Date acquired | When purchased | P1 |
| DEP-045 | Effective life (years) | ATO standard | P1 |
| DEP-046 | ATO effective life lookup | Auto-suggest | P3 |
| DEP-047 | Depreciation method | Prime cost / Diminishing | P1 |
| DEP-048 | Annual depreciation | Calculated | P1 |
| DEP-049 | Written-down value | Remaining value | P1 |
| DEP-050 | Low-value pool | <$1,000 items | P2 |
| DEP-051 | Instant asset write-off | Eligible items | P3 |
| DEP-052 | Asset disposed | Sold/scrapped | P3 |
| DEP-053 | Replacement asset tracking | Old → new | P4 |
| DEP-054 | Bulk asset import | From QS report | P3 |
| DEP-055 | Edit asset | Modify | P2 |
| DEP-056 | Delete asset | Remove | P2 |

**Common Division 40 Assets:**
- Hot water system
- Carpet
- Blinds/curtains
- Air conditioning
- Dishwasher
- Oven/cooktop
- Rangehood
- Smoke alarms
- Light fittings
- Ceiling fans
- Garage door motor
- Pool equipment

### 6.4 Depreciation Reports

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DEP-060 | Summary by property | All depreciation for property | P2 |
| DEP-061 | Summary by year | Annual breakdown | P2 |
| DEP-062 | Depreciation forecast | Next 5-10 years | P3 |
| DEP-063 | Depreciation schedule PDF | Accountant export | P2 |
| DEP-064 | Compare to QS report | Validate accuracy | P4 |

---

## 7. Tax & Reports

### 7.1 Tax Position Calculator

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TAX-001 | Gross salary input | Employment income | P1 |
| TAX-002 | PAYG withheld | Tax already paid | P1 |
| TAX-003 | Other income | Interest, dividends, etc. | P2 |
| TAX-004 | Other deductions | Work-related, donations | P2 |
| TAX-005 | Property net results | Auto from transactions | P1 |
| TAX-006 | Medicare levy calculation | 2% standard | P1 |
| TAX-007 | Medicare levy surcharge | Based on income + health | P2 |
| TAX-008 | Private health status | For MLS calculation | P2 |
| TAX-009 | HECS/HELP debt | Affects repayment | P3 |
| TAX-010 | Multiple income sources | Job 1, Job 2, etc. | P3 |
| TAX-011 | Spouse income (for MLS) | Surcharge calculation | P3 |
| TAX-012 | Estimated refund/owing | Final calculation | P1 |
| TAX-013 | Tax bracket indicator | Show marginal rate | P2 |
| TAX-014 | Tax optimization tips | "You could claim X" | P4 |
| TAX-015 | Real-time updates | Recalculate as data changes | P1 |

### 7.2 Tax Year Management

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TAX-020 | Current financial year | Active FY | P0 |
| TAX-021 | Historical years | View past FYs | P2 |
| TAX-022 | Year-end rollover | Close year, start new | P3 |
| TAX-023 | Year comparison | This year vs last | P3 |
| TAX-024 | Carry-forward losses | Track rental losses | P3 |
| TAX-025 | FY quick switcher | Easy year selection | P1 |

### 7.3 EOFY Tax Report

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TAX-030 | Generate PDF report | One-click generation | P1 |
| TAX-031 | ATO schedule format | Match official format | P1 |
| TAX-032 | Per-property report | Individual property | P1 |
| TAX-033 | All properties summary | Combined view | P2 |
| TAX-034 | Ownership split display | Show percentage share | P1 |
| TAX-035 | Income breakdown | By category | P1 |
| TAX-036 | Expense breakdown | By category | P1 |
| TAX-037 | Depreciation breakdown | Div 43 + Div 40 + borrowing | P1 |
| TAX-038 | Net result calculation | Income - expenses - depreciation | P1 |
| TAX-039 | Report history | Past generated reports | P3 |
| TAX-040 | Report versioning | If regenerated | P4 |
| TAX-041 | Email report | Send to self/accountant | P2 |
| TAX-042 | Branded report | Custom logo | P5 |
| TAX-043 | Tax disclaimers | Legal requirements | P0 |

### 7.4 Accountant Export

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TAX-050 | CSV transaction export | Categorized transactions | P1 |
| TAX-051 | PDF summary export | Report document | P1 |
| TAX-052 | Receipts ZIP export | All documents | P2 |
| TAX-053 | Xero format export | Direct import | P4 |
| TAX-054 | MYOB format export | Direct import | P4 |
| TAX-055 | Custom export mapping | Map to accountant format | P4 |
| TAX-056 | Accountant portal | Read-only access | P4 |
| TAX-057 | Export audit trail | Log what was exported | P3 |
| TAX-058 | Scheduled export | Auto-send periodically | P4 |

### 7.5 Other Reports

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| TAX-060 | Income statement | Revenue - expenses | P1 |
| TAX-061 | Cash flow report | Money in/out | P1 |
| TAX-062 | Portfolio summary | All properties overview | P1 |
| TAX-063 | Profit & loss | Formal P&L | P3 |
| TAX-064 | Balance sheet | Assets vs liabilities | P4 |
| TAX-065 | CGT report | Capital gains summary | P2 |
| TAX-066 | Rental yield report | Detailed yield analysis | P3 |
| TAX-067 | Expense analysis | Where money goes | P2 |
| TAX-068 | Year-over-year comparison | Multi-year trends | P3 |
| TAX-069 | Custom report builder | Select columns/filters | P5 |
| TAX-070 | Scheduled reports | Auto-email monthly | P4 |

---

## 8. Documents

### 8.1 Document Types

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DOC-001 | Receipt/invoice | Expense proof | P1 |
| DOC-002 | Lease agreement | Tenancy contract | P1 |
| DOC-003 | Insurance policy | Building/landlord | P1 |
| DOC-004 | Inspection report | Routine/entry/exit | P2 |
| DOC-005 | Settlement statement | Purchase settlement | P2 |
| DOC-006 | QS depreciation report | Quantity surveyor | P1 |
| DOC-007 | Rates notice | Council rates | P2 |
| DOC-008 | Tax return | Historical returns | P3 |
| DOC-009 | Contract of sale | Purchase contract | P2 |
| DOC-010 | Bank statement | Historical statements | P3 |
| DOC-011 | Loan documents | Mortgage papers | P2 |
| DOC-012 | Valuation report | Property valuation | P2 |
| DOC-013 | Condition report | Entry/exit condition | P2 |
| DOC-014 | Custom document type | User-defined | P3 |

### 8.2 Document Operations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DOC-020 | Upload single file | File picker | P1 |
| DOC-021 | Upload multiple files | Batch upload | P2 |
| DOC-022 | Camera capture (mobile) | Take photo | P2 |
| DOC-023 | Email forwarding | Auto-import | P3 |
| DOC-024 | Download document | Save to device | P1 |
| DOC-025 | Delete document | Remove | P1 |
| DOC-026 | Rename document | Change name | P2 |
| DOC-027 | Move document | Property to property | P2 |
| DOC-028 | Preview in-app | View without download | P2 |
| DOC-029 | PDF annotation | Highlight, notes | P5 |

### 8.3 Document Organization

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DOC-030 | Per-property folders | Organized by property | P1 |
| DOC-031 | General folder | Not property-specific | P1 |
| DOC-032 | Custom folders | User-created | P3 |
| DOC-033 | Auto-categorization | Detect document type | P4 |
| DOC-034 | Tags | Custom labels | P3 |
| DOC-035 | Search documents | By name | P1 |
| DOC-036 | Full-text search (OCR) | Search within content | P4 |
| DOC-037 | Sort by date/name/type | Sorting options | P2 |
| DOC-038 | Filter by type | Document type filter | P2 |

### 8.4 Document Metadata

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DOC-040 | Upload date | When added | P1 |
| DOC-041 | Document date | Actual date of document | P2 |
| DOC-042 | Expiry date | For insurance, leases | P1 |
| DOC-043 | File size | Storage used | P2 |
| DOC-044 | File type/MIME | PDF, image, etc. | P1 |
| DOC-045 | Linked transaction | Receipt → expense | P1 |
| DOC-046 | Linked reminder | Insurance → renewal | P2 |
| DOC-047 | Notes | Document notes | P2 |
| DOC-048 | Report tracking with due dates | Per-property report inventory (QS, land val, etc.) | P2 |

### 8.5 OCR & Extraction

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DOC-050 | Receipt OCR | Extract data from photo | P2 |
| DOC-051 | Extract date | OCR date field | P2 |
| DOC-052 | Extract amount | OCR amount | P2 |
| DOC-053 | Extract vendor | OCR vendor name | P2 |
| DOC-054 | Extract line items | Individual items | P4 |
| DOC-055 | Extract ABN | Vendor ABN | P4 |
| DOC-056 | Invoice vs receipt detection | Document type | P4 |
| DOC-057 | Handwritten support | Handwritten receipts | P5 |
| DOC-058 | Manual OCR correction | Fix errors | P2 |
| DOC-059 | OCR confidence score | Show certainty | P3 |

---

## 9. Reminders

### 9.1 Reminder Types

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| REM-001 | Lease expiry | When lease ends | P1 |
| REM-002 | Insurance renewal | Policy renewal date | P1 |
| REM-003 | Fixed rate expiry | Loan rate expiry | P1 |
| REM-004 | Valuation due | When to revalue | P2 |
| REM-005 | Smoke alarm check | QLD annual requirement | P2 |
| REM-006 | Gas safety check | VIC biannual | P2 |
| REM-007 | Electrical safety check | VIC requirement | P2 |
| REM-008 | Pool compliance | Pool fence inspection | P3 |
| REM-009 | Body corporate meeting | Strata meetings | P3 |
| REM-010 | Rent review date | Annual review | P2 |
| REM-011 | Tenant inspection | Routine inspection | P2 |
| REM-012 | Tax lodgement deadline | October 31 | P2 |
| REM-013 | Custom reminder | User-defined | P1 |

### 9.2 Reminder Settings

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| REM-020 | Due date | When due | P0 |
| REM-021 | Recurrence | None/monthly/quarterly/annual | P1 |
| REM-022 | Remind days before | 30, 7, 1 days | P1 |
| REM-023 | Custom intervals | e.g., 60, 14, 3 days | P3 |
| REM-024 | Assigned property | Which property | P1 |
| REM-025 | Reminder notes | Description | P2 |
| REM-026 | Linked document | Attach related doc | P2 |
| REM-027 | Linked contact | Related person | P3 |

### 9.3 Reminder Notifications

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| REM-030 | Email notification | Send email | P1 |
| REM-031 | Push notification | Mobile push | P2 |
| REM-032 | SMS notification | Text message | P4 |
| REM-033 | In-app notification | Dashboard alert | P1 |
| REM-034 | Snooze reminder | Delay notification | P2 |
| REM-035 | Dismiss reminder | Stop notifications | P2 |
| REM-036 | Per-type preferences | Configure each type | P3 |

### 9.4 Reminder Management

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| REM-040 | Create reminder | Add new | P1 |
| REM-041 | Edit reminder | Modify | P1 |
| REM-042 | Delete reminder | Remove | P1 |
| REM-043 | Mark complete | Done | P1 |
| REM-044 | Calendar view | Monthly calendar | P1 |
| REM-045 | List view | Upcoming list | P1 |
| REM-046 | Filter by property | Property filter | P2 |
| REM-047 | Filter by type | Reminder type filter | P2 |
| REM-048 | Overdue highlight | Show past-due | P1 |
| REM-049 | Bulk complete | Complete multiple | P3 |

### 9.5 Smart Reminders

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| REM-050 | Auto from insurance txn | Detect → create | P3 |
| REM-051 | Auto from lease document | Extract expiry | P3 |
| REM-052 | Compliance calendar | State requirements | P3 |
| REM-053 | Suggested reminders | "You might need X" | P4 |

---

## 10. Dashboard & Analytics

### 10.1 Portfolio Dashboard

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DASH-001 | Total properties count | Number owned | P0 |
| DASH-002 | Total value | Sum of values | P0 |
| DASH-003 | Total debt | Sum of loans | P0 |
| DASH-004 | Total equity | Value - debt | P0 |
| DASH-005 | Monthly rent | Rental income | P0 |
| DASH-006 | Monthly expenses | Outgoings | P0 |
| DASH-007 | Net cash flow | Rent - expenses | P0 |
| DASH-008 | Useable equity display | Available equity | P1 |
| DASH-009 | Gross yield | Rent / value | P2 |
| DASH-010 | Net yield | (Rent - expenses) / value | P2 |
| DASH-011 | Cash-on-cash return | Cash flow / invested | P3 |
| DASH-012 | Total ROI | Including growth | P3 |
| DASH-013 | Debt-to-equity ratio | Debt / equity | P3 |
| DASH-014 | Average LVR | Portfolio LVR | P2 |
| DASH-015 | Portfolio growth | Value change | P2 |

### 10.2 Property Cards

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DASH-020 | Address display | Property address | P0 |
| DASH-021 | Thumbnail image | Property photo | P3 |
| DASH-022 | Purchase price | Original cost | P0 |
| DASH-023 | Current value | Latest valuation | P0 |
| DASH-024 | Growth % | Value change | P0 |
| DASH-025 | Loan balance | Outstanding debt | P0 |
| DASH-026 | Equity | Value - loan | P0 |
| DASH-027 | LVR | Loan / value | P0 |
| DASH-028 | Weekly rent | Income | P0 |
| DASH-029 | Weekly expenses | Outgoings | P1 |
| DASH-030 | Cash flow | Rent - expenses | P0 |
| DASH-031 | Status indicator | Green/red | P0 |
| DASH-032 | Yield display | Return rate | P2 |
| DASH-033 | Quick actions | Edit, add txn | P2 |

### 10.3 Charts & Visualizations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DASH-040 | Cash flow bar chart | Monthly view | P1 |
| DASH-041 | Income vs expenses chart | Comparison | P2 |
| DASH-042 | "Who Pays" pie chart | Taxman/Tenant/You | P1 |
| DASH-043 | Equity growth line chart | Over time | P3 |
| DASH-044 | Portfolio value line chart | Over time | P3 |
| DASH-045 | Debt reduction chart | Loan paydown | P3 |
| DASH-046 | Expense breakdown pie | By category | P2 |
| DASH-047 | Income breakdown | By property | P2 |
| DASH-048 | LVR trend chart | Over time | P3 |
| DASH-049 | Yield trend chart | Over time | P3 |
| DASH-050 | Property comparison chart | Side by side | P3 |

### 10.4 Insights & Alerts

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DASH-060 | Cash flow indicator | Positive/negative | P0 |
| DASH-061 | Low cash flow alert | Below threshold | P3 |
| DASH-062 | High vacancy alert | No rent X weeks | P3 |
| DASH-063 | Rate rise impact | If rates increase | P3 |
| DASH-064 | Insurance expiring alert | Dashboard warning | P2 |
| DASH-065 | Rent below market | Suggest review | P4 |
| DASH-066 | Unusual expense alert | Spike detection | P4 |
| DASH-067 | Tax position summary | Refund estimate | P2 |

### 10.5 "Who Pays" Calculation

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| DASH-070 | Tenant % | Rent / costs | P1 |
| DASH-071 | Taxman % | Deductions × rate | P1 |
| DASH-072 | You % | Remainder | P1 |
| DASH-073 | Interactive breakdown | Click for detail | P3 |
| DASH-074 | What-if tax rate | Different scenarios | P4 |

---

## 11. Multi-Entity Support

### 11.1 Entity Types

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ENT-001 | Personal (individual) | Own name | P0 |
| ENT-002 | Family trust | Discretionary trust | P1 |
| ENT-003 | Unit trust | Fixed entitlements | P3 |
| ENT-004 | Hybrid trust | Mixed | P4 |
| ENT-005 | SMSF | Self-managed super | P2 |
| ENT-006 | Company | Pty Ltd | P2 |
| ENT-007 | Partnership | Two+ individuals | P3 |
| ENT-008 | Joint personal | Joint tenants | P2 |

### 11.2 Entity Details

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ENT-010 | Entity name | Legal name | P0 |
| ENT-011 | Entity type | From above list | P0 |
| ENT-012 | ABN | Business number | P2 |
| ENT-013 | TFN | Tax file number (encrypted) | P2 |
| ENT-014 | Tax rate | Marginal rate | P1 |
| ENT-015 | Trustee details | For trusts | P3 |
| ENT-016 | Beneficiaries | For trusts | P4 |
| ENT-017 | Directors | For companies | P4 |
| ENT-018 | SMSF members | For super funds | P3 |
| ENT-019 | Registered address | Official address | P3 |
| ENT-020 | Contact person | Primary contact | P3 |

### 11.3 Ownership Structures

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ENT-030 | Single owner (100%) | One entity | P0 |
| ENT-031 | Joint ownership (50/50) | Equal split | P1 |
| ENT-032 | Custom percentage split | Any ratio | P1 |
| ENT-033 | Tenants in common | Different shares | P2 |
| ENT-034 | Joint tenants | Equal, survivorship | P2 |
| ENT-035 | Change ownership | Transfer between entities | P3 |
| ENT-036 | Ownership history | Track changes | P4 |
| ENT-037 | Ownership-adjusted calculations | All metrics show user's share based on % | P1 |
| ENT-038 | Portfolio totals by ownership | Sum only user's portion across entities | P1 |

### 11.4 Entity Views

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ENT-040 | Dashboard per entity | Filtered view | P1 |
| ENT-041 | Filter by entity | Entity filter | P1 |
| ENT-042 | All entities combined | Consolidated view | P1 |
| ENT-043 | Entity comparison | Side by side | P3 |
| ENT-044 | Entity-specific reports | Tax per entity | P2 |
| ENT-045 | Entity quick switcher | In navigation | P2 |

### 11.5 Trust-Specific Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ENT-050 | Trust deed storage | Upload deed | P3 |
| ENT-051 | Distribution tracking | Annual distributions | P4 |
| ENT-052 | Beneficiary income split | Allocation | P4 |
| ENT-053 | Trust minute templates | Distribution resolution | P5 |
| ENT-054 | SMSF compliance | Arm's length | P4 |

---

## 12. Forecasting & Scenarios

### 12.1 Property Projections

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-001 | Value forecast | X years out | P2 |
| FORE-002 | Loan balance projection | Paydown schedule | P2 |
| FORE-003 | Equity projection | Future equity | P2 |
| FORE-004 | Rent forecast | Future rent | P2 |
| FORE-005 | Cash flow projection | Future cash flow | P2 |
| FORE-006 | Cumulative cash flow | Total over period | P3 |
| FORE-007 | Break-even point | When positive | P2 |

### 12.2 Adjustable Assumptions

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-010 | Capital growth rate | % per year | P2 |
| FORE-011 | Rent growth rate | % per year | P2 |
| FORE-012 | Interest rate assumption | Current or future | P2 |
| FORE-013 | Vacancy rate | % of time vacant | P2 |
| FORE-014 | Expense inflation | % increase | P2 |
| FORE-015 | Loan repayment changes | IO → P&I | P3 |
| FORE-016 | Rent increase timing | When increases occur | P3 |
| FORE-017 | Major expense assumptions | Roof in year 10 | P4 |

### 12.3 Milestone Markers

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-020 | Cash flow positive date | When breaks even | P2 |
| FORE-021 | Equity for deposit date | When $100K available | P2 |
| FORE-022 | LVR below 80% date | Threshold date | P2 |
| FORE-023 | Loan payoff date | When fully paid | P3 |
| FORE-024 | Net worth milestone | When hits $X | P3 |
| FORE-025 | Passive income milestone | When income > $X | P3 |

### 12.4 What-If Scenarios

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-030 | Interest rate change | Impact analysis | P2 |
| FORE-031 | Sell property | Portfolio impact | P2 |
| FORE-032 | Buy new property | Addition modeling | P2 |
| FORE-033 | Refinance scenario | New terms | P3 |
| FORE-034 | Renovate scenario | Spend → value increase | P3 |
| FORE-035 | Change to P&I | IO expiry impact | P3 |
| FORE-036 | Rent increase | Higher rent scenario | P3 |
| FORE-037 | Major repair | Unexpected expense | P3 |
| FORE-038 | Save scenarios | Keep multiple | P3 |
| FORE-039 | Scenario comparison | Side by side | P3 |

### 12.5 Cash in Offset Calculator

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-040 | Break-even calculation | Cash needed | P1 |
| FORE-041 | Per-property breakdown | Each property | P1 |
| FORE-042 | Interactive slider | "If I put $X..." | P3 |
| FORE-043 | Portfolio total | All properties | P2 |
| FORE-044 | Offset expense breakdown | Show each expense component in break-even calc | P2 |

### 12.6 Per-Property Forecasting

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-055 | Per-property forecast view | Individual property projection page | P2 |
| FORE-056 | Custom growth rate per property | Set different growth assumptions per property | P2 |
| FORE-057 | Equity for deposit milestone | "Enough for $X deposit?" notification | P3 |

### 12.7 Portfolio Scenarios

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FORE-050 | Total portfolio projection | Combined view | P3 |
| FORE-051 | Retirement modeling | When can retire | P4 |
| FORE-052 | Debt-free date | When all paid | P3 |
| FORE-053 | Wealth accumulation | Net worth over time | P3 |

---

## 13. Rental & Tenant Management

### 13.1 Tenant Information

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| RENT-001 | Tenant name | Full name | P1 |
| RENT-002 | Tenant email | Contact email | P2 |
| RENT-003 | Tenant phone | Contact phone | P2 |
| RENT-004 | Lease start date | When started | P1 |
| RENT-005 | Lease end date | When ends | P1 |
| RENT-006 | Weekly rent | Amount | P1 |
| RENT-007 | Payment frequency | Weekly/fortnightly/monthly | P1 |
| RENT-008 | Bond amount | Security deposit | P1 |
| RENT-009 | Bond lodgement reference | RTA reference | P2 |
| RENT-010 | Tenant history | Past tenants | P3 |
| RENT-011 | Tenant notes | Free notes | P2 |
| RENT-012 | Tenant rating | Good/bad | P4 |

### 13.2 Rent Tracking

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| RENT-020 | Expected rent | What should be paid | P1 |
| RENT-021 | Actual rent received | From transactions | P1 |
| RENT-022 | Rent arrears | Late payments | P2 |
| RENT-023 | Rent ledger | Payment history | P2 |
| RENT-024 | Vacancy tracking | Between tenants | P1 |
| RENT-025 | Days vacant | Count | P2 |
| RENT-026 | Vacancy cost | Lost rent | P2 |

### 13.3 Lease Management

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| RENT-030 | Current lease record | Active lease | P1 |
| RENT-031 | Lease history | Past leases | P2 |
| RENT-032 | Rent review date | Annual review | P2 |
| RENT-033 | Rent increase tracking | Old → new | P2 |
| RENT-034 | CPI calculator | CPI + X% | P3 |
| RENT-035 | Target rent increase % | Desired increase at review (e.g., +8%) | P3 |
| RENT-036 | Market rent comparison | Is rent fair? | P4 |
| RENT-036 | Lease document link | Attached lease | P1 |
| RENT-037 | Lease renewal reminder | Auto-create | P1 |

### 13.4 Property Manager

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| RENT-040 | Property manager name | PM contact | P2 |
| RENT-041 | PM company | Agency name | P2 |
| RENT-042 | PM phone | Contact number | P2 |
| RENT-043 | PM email | Contact email | P2 |
| RENT-044 | PM fee percentage | Management fee | P2 |
| RENT-045 | PM fee tracking | From transactions | P2 |
| RENT-046 | Self-managed flag | No PM | P2 |

---

## 14. Contacts

### 14.1 Contact Management

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| CONT-001 | Contact list | All contacts | P3 |
| CONT-002 | Contact type | PM/accountant/broker/tradesperson | P3 |
| CONT-003 | Contact per property | Linked contacts | P3 |
| CONT-004 | Contact name | Full name | P3 |
| CONT-005 | Contact phone | Phone number | P3 |
| CONT-006 | Contact email | Email address | P3 |
| CONT-007 | Contact company | Business name | P3 |
| CONT-008 | Contact address | Location | P4 |
| CONT-009 | Contact notes | Free notes | P3 |
| CONT-010 | Contact history | Past interactions | P5 |
| CONT-011 | Quick call/email | Tap to contact | P4 |

### 14.2 Contact Types

| Type | Description |
|------|-------------|
| Property Manager | Rental management |
| Accountant | Tax/financial |
| Mortgage Broker | Loan services |
| Conveyancer | Legal/settlement |
| Building Inspector | Property inspections |
| Pest Inspector | Pest reports |
| Electrician | Electrical work |
| Plumber | Plumbing work |
| Handyman | General repairs |
| Gardener | Lawn/garden |
| Cleaner | Cleaning services |
| Insurance Agent | Insurance policies |
| Quantity Surveyor | Depreciation |
| Real Estate Agent | Buying/selling |

---

## 15. Mobile App

### 15.1 Core Mobile Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| MOB-001 | View dashboard | Portfolio overview | P2 |
| MOB-002 | View properties | Property list | P2 |
| MOB-003 | View transactions | Transaction list | P2 |
| MOB-004 | Add transaction | Quick add | P2 |
| MOB-005 | Categorize transaction | Set category | P2 |
| MOB-006 | Receipt photo capture | Camera capture | P2 |
| MOB-007 | Offline mode | View cached data | P4 |
| MOB-008 | Offline entry | Sync when online | P4 |

### 15.2 Mobile-Specific Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| MOB-010 | Biometric login | Face ID / Touch ID | P2 |
| MOB-011 | Push notifications | Reminders, alerts | P2 |
| MOB-012 | Camera integration | Document capture | P2 |
| MOB-013 | Location services | Mileage tracking | P5 |
| MOB-014 | Home screen widget | Quick view | P4 |
| MOB-015 | Apple Watch app | Glanceable data | P5 |
| MOB-016 | Siri shortcuts | Voice commands | P5 |

### 15.3 Platform Support

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| MOB-020 | iOS app | iPhone support | P2 |
| MOB-021 | Android app | Android support | P2 |
| MOB-022 | Tablet optimization | iPad layout | P4 |
| MOB-023 | Web responsive | Mobile browser | P1 |

---

## 16. Settings & Configuration

### 16.1 Account Settings

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SET-001 | Profile settings | Name, email, etc. | P1 |
| SET-002 | Password change | Security | P0 |
| SET-003 | MFA settings | Enable/disable | P2 |
| SET-004 | Notification preferences | Email, push | P2 |
| SET-005 | Timezone setting | Display times | P1 |
| SET-006 | Date format | DD/MM/YYYY | P3 |
| SET-007 | Currency format | Display format | P4 |
| SET-008 | Financial year start | July default | P1 |

### 16.2 Category Settings

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SET-010 | View categories | List all | P1 |
| SET-011 | Add custom category | User-defined | P3 |
| SET-012 | Edit category | Rename | P3 |
| SET-013 | Hide category | Remove from list | P3 |
| SET-014 | Category order | Custom sort | P4 |
| SET-015 | Category merge | Combine two | P5 |

### 16.3 Rule Settings

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SET-020 | View rules | List all | P1 |
| SET-021 | Add rule | Create new | P1 |
| SET-022 | Edit rule | Modify | P2 |
| SET-023 | Delete rule | Remove | P2 |
| SET-024 | Rule priority | Ordering | P2 |
| SET-025 | Test rule | Preview matches | P3 |
| SET-026 | Bulk rule import | From file | P5 |
| SET-027 | Export rules | Save to file | P4 |

### 16.4 Billing Settings

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SET-030 | Current plan display | Show plan | P0 |
| SET-031 | Upgrade plan | To higher tier | P0 |
| SET-032 | Downgrade plan | To lower tier | P2 |
| SET-033 | Cancel subscription | End service | P1 |
| SET-034 | View invoices | Past payments | P2 |
| SET-035 | Update payment method | Change card | P1 |
| SET-036 | Billing history | All transactions | P2 |
| SET-037 | Apply coupon | Promo codes | P2 |
| SET-038 | Annual/monthly toggle | Switch billing | P2 |

### 16.5 Data Management

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SET-040 | Export all data | JSON/CSV | P2 |
| SET-041 | Import data | From backup | P4 |
| SET-042 | Delete all data | Account deletion | P2 |
| SET-043 | Backup settings | Auto-export | P5 |
| SET-044 | Data retention info | How long kept | P2 |

### 16.6 Integration Settings

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SET-050 | Connected banks | Manage connections | P0 |
| SET-051 | Disconnect bank | Remove connection | P1 |
| SET-052 | Xero connection | Link Xero | P4 |
| SET-053 | MYOB connection | Link MYOB | P5 |
| SET-054 | API access | API keys | P5 |
| SET-055 | Webhooks | External notifications | P5 |

---

## 17. Security & Compliance

### 17.1 Authentication Security

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SEC-001 | Password requirements | Strength rules | P0 |
| SEC-002 | MFA support | TOTP, SMS | P2 |
| SEC-003 | Session timeout | Auto-logout | P2 |
| SEC-004 | Session management | View/revoke | P3 |
| SEC-005 | Login alerts | New device notification | P3 |
| SEC-006 | IP allowlisting | Enterprise | P5 |
| SEC-007 | SSO (SAML) | Enterprise | P5 |

### 17.2 Data Security

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SEC-010 | Encryption at rest | Database encryption | P0 |
| SEC-011 | Encryption in transit | HTTPS | P0 |
| SEC-012 | TFN encryption | Field-level | P1 |
| SEC-013 | Sensitive field encryption | Other PII | P2 |
| SEC-014 | Data masking | Account numbers | P2 |
| SEC-015 | Audit logging | Change tracking | P2 |
| SEC-016 | Access logs | View tracking | P3 |

### 17.3 Privacy Compliance

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SEC-020 | Privacy policy | Legal document | P0 |
| SEC-021 | Terms of service | Legal document | P0 |
| SEC-022 | Cookie consent | If using cookies | P1 |
| SEC-023 | Data deletion request | User right | P1 |
| SEC-024 | Data export request | User right | P1 |
| SEC-025 | Data processing agreement | Enterprise | P5 |
| SEC-026 | Consent management | Track consents | P3 |

### 17.4 Financial Compliance

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SEC-030 | Tax disclaimers | On all calculations | P0 |
| SEC-031 | "Not financial advice" | Legal disclaimer | P0 |
| SEC-032 | AFSL confirmation | Not required | P0 |
| SEC-033 | ATO category alignment | Tax compliance | P0 |
| SEC-034 | Audit trail | For accountants | P2 |
| SEC-035 | Data accuracy disclaimer | Bank feed accuracy | P1 |

### 17.5 Infrastructure Security

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| SEC-040 | DDoS protection | Via CDN | P0 |
| SEC-041 | Rate limiting | API protection | P0 |
| SEC-042 | Input validation | Zod schemas | P0 |
| SEC-043 | SQL injection prevention | Via ORM | P0 |
| SEC-044 | XSS prevention | React default | P0 |
| SEC-045 | CSRF protection | Token validation | P1 |
| SEC-046 | Penetration testing | Security audit | P3 |
| SEC-047 | Vulnerability scanning | Automated | P3 |
| SEC-048 | Bug bounty program | Crowdsourced | P5 |

---

## 18. Error Handling & Edge Cases

### 18.1 Bank Connection Errors

| ID | Case | Handling | Priority |
|----|------|----------|----------|
| ERR-001 | Connection failed | Error message + retry | P0 |
| ERR-002 | Connection expired | Re-auth prompt | P0 |
| ERR-003 | Bank unavailable | Temporary error message | P1 |
| ERR-004 | Bank not supported | Show unsupported message | P1 |
| ERR-005 | Consent revoked | Prompt to reconnect | P1 |
| ERR-006 | Basiq API down | Fallback message | P1 |
| ERR-007 | Rate limited | Retry with backoff | P2 |
| ERR-008 | Partial sync failure | Show partial results | P2 |

### 18.2 Transaction Edge Cases

| ID | Case | Handling | Priority |
|----|------|----------|----------|
| ERR-010 | Duplicate transaction | Detect + prompt merge | P1 |
| ERR-011 | Future date | Warning, allow | P2 |
| ERR-012 | Pre-purchase date | Warning, allow | P2 |
| ERR-013 | Zero amount | Allow | P2 |
| ERR-014 | Very large amount | Confirmation prompt | P3 |
| ERR-015 | Foreign currency | Not supported message | P3 |
| ERR-016 | Pending transaction | Show as pending | P2 |
| ERR-017 | Reversed transaction | Match to original | P3 |
| ERR-018 | Orphaned transaction | Keep in general | P2 |

### 18.3 Data Validation

| ID | Case | Handling | Priority |
|----|------|----------|----------|
| ERR-020 | Invalid date format | Show format hint | P0 |
| ERR-021 | Negative where shouldn't | Reject with message | P1 |
| ERR-022 | Missing required field | Highlight field | P0 |
| ERR-023 | Duplicate address | Warning, allow | P2 |
| ERR-024 | Invalid postcode | Validation error | P1 |
| ERR-025 | Future purchase date | Warning, allow | P2 |
| ERR-026 | Negative equity | Show in red | P1 |
| ERR-027 | Illogical values | Warning message | P2 |

### 18.4 Calculation Edge Cases

| ID | Case | Handling | Priority |
|----|------|----------|----------|
| ERR-030 | Division by zero | Show "N/A" | P0 |
| ERR-031 | Negative equity | Display as negative | P1 |
| ERR-032 | No transactions | Show empty state | P0 |
| ERR-033 | Incomplete year | Pro-rata or note | P2 |
| ERR-034 | Leap year | Correct daily calc | P3 |
| ERR-035 | Part-year ownership | Partial calculations | P2 |

### 18.5 UI/UX Edge Cases

| ID | Case | Handling | Priority |
|----|------|----------|----------|
| ERR-040 | Empty states | Helpful message + action | P0 |
| ERR-041 | Loading states | Skeleton/spinner | P0 |
| ERR-042 | Error states | Friendly message | P0 |
| ERR-043 | Offline state | Cached data + message | P3 |
| ERR-044 | Session expired | Re-login prompt | P1 |
| ERR-045 | Long text truncation | Ellipsis + tooltip | P1 |
| ERR-046 | Many properties | Pagination | P1 |
| ERR-047 | Many transactions | Pagination | P1 |
| ERR-048 | Screen reader | Accessibility support | P3 |

---

## 19. Growth & Viral Features

### 19.1 Referral Program

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| GROW-001 | Referral link | Unique per user | P3 |
| GROW-002 | Referral tracking | Who referred who | P3 |
| GROW-003 | Referrer reward | $10 credit | P3 |
| GROW-004 | Referee reward | $10 off first month | P3 |
| GROW-005 | Referral dashboard | Track referrals | P3 |
| GROW-006 | Referral leaderboard | Gamification | P5 |
| GROW-007 | Referral email templates | Easy sharing | P3 |

### 19.2 Sharing Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| GROW-010 | Share with accountant | Read-only link | P3 |
| GROW-011 | Share with partner | Limited access | P3 |
| GROW-012 | Embeddable widgets | External display | P5 |
| GROW-013 | Public portfolio page | Optional showcase | P5 |
| GROW-014 | Social sharing | Share milestones | P5 |

### 19.3 Content & Education

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| GROW-020 | Blog | SEO content | P2 |
| GROW-021 | Help center | FAQs, guides | P1 |
| GROW-022 | Video tutorials | How-to videos | P3 |
| GROW-023 | In-app tips | Contextual help | P2 |
| GROW-024 | Onboarding tour | First-time guide | P1 |
| GROW-025 | Webinars | Live training | P4 |
| GROW-026 | Newsletter | Email updates | P3 |

### 19.4 Community

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| GROW-030 | User forum | Discussion board | P5 |
| GROW-031 | Feature requests | Voting system | P3 |
| GROW-032 | Facebook group | Community | P4 |
| GROW-033 | Discord/Slack | Chat community | P5 |
| GROW-034 | User feedback | Collection mechanism | P2 |

---

## 20. Admin & Internal Tools

### 20.1 Admin Dashboard

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ADMIN-001 | User count | Total users | P2 |
| ADMIN-002 | Active users | DAU, MAU | P2 |
| ADMIN-003 | Revenue metrics | MRR, ARR | P2 |
| ADMIN-004 | Churn rate | Cancellation rate | P2 |
| ADMIN-005 | User list | Search, filter | P2 |
| ADMIN-006 | User detail view | Individual data | P2 |
| ADMIN-007 | Impersonate user | Debug issues | P3 |

### 20.2 Support Tools

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ADMIN-010 | Support tickets | Or external tool | P3 |
| ADMIN-011 | In-app chat | Intercom etc. | P3 |
| ADMIN-012 | User activity log | Actions taken | P3 |
| ADMIN-013 | Error log viewer | Debug errors | P2 |
| ADMIN-014 | Feedback viewer | User feedback | P2 |

### 20.3 Operations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| ADMIN-020 | System status page | Uptime, incidents | P3 |
| ADMIN-021 | Basiq status | Bank feed health | P2 |
| ADMIN-022 | Email delivery | Tracking | P3 |
| ADMIN-023 | Performance monitoring | Sentry | P1 |
| ADMIN-024 | Database backups | Via Supabase | P0 |
| ADMIN-025 | Backup restoration | Test regularly | P2 |

---

## 21. Future & Advanced Features

### 21.1 Integrations

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FUT-001 | Xero two-way sync | Accounting integration | P4 |
| FUT-002 | MYOB sync | Accounting integration | P5 |
| FUT-003 | QuickBooks sync | Accounting integration | P5 |
| FUT-004 | PropertyMe API | PM integration | P4 |
| FUT-005 | CoreLogic API | Automated valuations | P4 |
| FUT-006 | Domain/REA API | Market data | P5 |
| FUT-007 | Zapier integration | Connect anything | P4 |
| FUT-008 | Open API | Developer access | P4 |

### 21.2 Advanced Analytics

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FUT-010 | AI insights | "You could save $X" | P4 |
| FUT-011 | Benchmark comparison | vs average investor | P4 |
| FUT-012 | Market data integration | Local trends | P5 |
| FUT-013 | Predictive analytics | ML forecasting | P5 |
| FUT-014 | Anomaly detection | Pattern recognition | P4 |

### 21.3 Multi-User / Team

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FUT-020 | Invite accountant | Read-only access | P3 |
| FUT-021 | Invite partner | Limited access | P3 |
| FUT-022 | Team account | Multiple users | P4 |
| FUT-023 | Role-based access | Admin/viewer/editor | P4 |
| FUT-024 | Accountant portal | Multi-client management | P5 |

### 21.4 Enterprise Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FUT-030 | SSO/SAML | Enterprise auth | P5 |
| FUT-031 | Custom branding | White-label | P5 |
| FUT-032 | SLA guarantee | Uptime commitment | P5 |
| FUT-033 | Dedicated support | Premium support | P5 |
| FUT-034 | Bulk user management | Admin tools | P5 |

### 21.5 Marketplace

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FUT-040 | QS report ordering | Partner with MCG, BMT | P3 |
| FUT-041 | Insurance comparison | Quote comparison | P4 |
| FUT-042 | Mortgage broker referral | Loan services | P4 |
| FUT-043 | Accountant finder | Find accountant | P4 |
| FUT-044 | Service directory | Trades, services | P5 |

---

## Appendix A: Feature Count Summary

| Section | Total Features | P0-P1 | P2-P3 | P4-P5 |
|---------|---------------|-------|-------|-------|
| 1. User Management | 39 | 10 | 18 | 11 |
| 2. Properties | 107 | 28 | 52 | 27 |
| 3. Transactions | 95 | 32 | 44 | 19 |
| 4. Banking | 58 | 22 | 26 | 10 |
| 5. Loans | 61 | 20 | 32 | 9 | *(+4: rate negotiation, equity release tracking)*
| 6. Depreciation | 64 | 24 | 30 | 10 |
| 7. Tax & Reports | 70 | 24 | 30 | 16 |
| 8. Documents | 60 | 18 | 29 | 13 | *(+1: report tracking)*
| 9. Reminders | 53 | 20 | 26 | 7 |
| 10. Dashboard | 67 | 22 | 32 | 13 |
| 11. Multi-Entity | 56 | 16 | 26 | 14 | *(+2: ownership-adjusted calcs)*
| 12. Forecasting | 57 | 8 | 40 | 9 | *(+4: per-property forecast, offset breakdown)*
| 13. Rental/Tenant | 47 | 16 | 25 | 6 | *(+1: target rent increase)*
| 14. Contacts | 14 | 0 | 10 | 4 |
| 15. Mobile | 23 | 4 | 12 | 7 |
| 16. Settings | 55 | 16 | 28 | 11 |
| 17. Security | 48 | 20 | 18 | 10 |
| 18. Error Handling | 48 | 18 | 24 | 6 |
| 19. Growth | 34 | 4 | 18 | 12 |
| 20. Admin | 25 | 6 | 14 | 5 |
| 21. Future | 44 | 0 | 10 | 34 |
| **TOTAL** | **1,165** | **328** | **564** | **273** |

*Updated 2026-01-23: Added 12 features discovered from spreadsheet audit*

---

## Appendix B: Release Mapping

### v0.1 (Week 4) - P0 Features Only
~50 core features to launch wedge

### v0.5 (Week 8) - Add P1 Core Features
~100 features total

### v1.0 (Week 12) - Add P1 Complete + P2 Core
~200 features total

### v1.5 (Week 18) - Add P2 Complete + P3 Core
~400 features total

### v2.0 (Week 24) - Add P3 Complete + P4 Core
~600 features total

### v3.0+ - Remaining P4 + P5
Full 1,153 feature product

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-23 | 1.0 | Matthew Gleeson | Initial complete feature specification |
| 2026-01-23 | 1.1 | Matthew Gleeson | Added 12 features from spreadsheet audit: per-property forecasting (FORE-055-057), offset expense breakdown (FORE-044), ownership-adjusted calculations (ENT-037-038), target rent increase (RENT-035), rate negotiation tracking (LOAN-038-041), report tracking (DOC-048) |

---

*This document is the source of truth for all PropertyTracker features. Reference this when planning releases and ensuring completeness.*
