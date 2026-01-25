# Broker Portal Enhancement Design

**Date:** 2026-01-26
**Status:** Approved

## Overview

Enhance the existing Loan Packs feature into a full Broker Portal with contact management, pack association, and access history tracking.

## Goals

1. **Broker CRM** - Save broker contacts, track which packs sent to whom
2. **Better discoverability** - Move from Settings to Reports menu
3. **Relationship tracking** - See access history per broker
4. **Foundation for growth** - Data model supports future "Trojan Horse" broker onboarding

## Data Model

### New Table: `brokers`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | text | Owner (foreign key) |
| name | text | Broker's full name (required) |
| email | text | Email address (optional) |
| phone | text | Phone number (optional) |
| company | text | Brokerage company name (optional) |
| notes | text | Free-form notes (optional) |
| createdAt | timestamp | When added |
| updatedAt | timestamp | Last modified |

### Modified Table: `loan_packs`

Add column:

| Column | Type | Description |
|--------|------|-------------|
| brokerId | uuid | Optional link to broker contact (nullable) |

### Relationships

- User has many Brokers
- Broker has many LoanPacks
- LoanPack optionally belongs to one Broker

## UI Structure

### Navigation

- Add "Broker Portal" to Reports menu
- Remove "Loan Packs" from Settings menu

### Routes

| Route | Description |
|-------|-------------|
| `/reports/brokers` | Broker Portal main page |
| `/reports/brokers/[id]` | Broker detail with pack history |

### Main Page (`/reports/brokers`)

```
┌─────────────────────────────────────────────────────┐
│ Broker Portal                      [+ Add Broker]   │
│ Manage your mortgage broker contacts and loan packs │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────┐ ┌─────────────────┐            │
│ │ John Smith      │ │ Sarah Chen      │            │
│ │ ABC Finance     │ │ XYZ Mortgages   │            │
│ │ 3 packs sent    │ │ 1 pack sent     │            │
│ │ Last: Jan 20    │ │ Last: Jan 15    │            │
│ │ [Send Pack] [⋮] │ │ [Send Pack] [⋮] │            │
│ └─────────────────┘ └─────────────────┘            │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ + Add your first broker contact                 ││
│ │   or generate a pack without a broker           ││
│ │                      [Generate Standalone Pack] ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

Features:
- Cards show broker summary with quick "Send Pack" action
- Clicking card opens broker detail
- "Generate Standalone Pack" for one-off shares
- Overflow menu (⋮) has Edit and Delete

### Broker Detail Page (`/reports/brokers/[id]`)

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Broker Portal                             │
├─────────────────────────────────────────────────────┤
│ John Smith                           [Edit] [Delete]│
│ ABC Finance                                         │
│ john@abcfinance.com.au • 0412 345 678              │
│                                                     │
│ Notes: Helped with 123 Main St refinance. Good     │
│ rates on investment properties.                     │
├─────────────────────────────────────────────────────┤
│ Loan Packs                          [+ Send Pack]   │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐│
│ │ Jan 20, 2026           Active • Expires Feb 20  ││
│ │ 3 views • Last viewed Jan 22                    ││
│ │                      [Copy Link] [Open] [Revoke]││
│ └─────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────┐│
│ │ Dec 15, 2025                           Expired  ││
│ │ 7 views                                         ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

Features:
- Full contact details at top
- Editable notes for relationship context
- Chronological list of packs sent to this broker
- Status badges: Active, Expired, Revoked
- View count and last accessed timestamp

## Forms

### Add/Edit Broker Modal

Fields:
- Name (required)
- Company (optional)
- Email (optional)
- Phone (optional)
- Notes (optional)

### Generate Pack Modal (updated)

Fields:
- Send to broker (optional dropdown)
- Expires in (3-30 days)

## API Routes

### New `brokerRouter`

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | query | Get all brokers with pack counts |
| `get` | query | Get single broker with pack history |
| `create` | mutation | Add new broker |
| `update` | mutation | Edit broker |
| `delete` | mutation | Remove broker (packs become unassociated) |

### Updated `loanPackRouter`

| Change | Description |
|--------|-------------|
| `create` | Add optional `brokerId` parameter |
| `list` | Include broker name in response |

## Migration Strategy

1. Create `brokers` table
2. Add `brokerId` column to `loan_packs` (nullable)
3. Existing loan packs remain with `brokerId = null`
4. Remove old Settings page route after new page is live

## Out of Scope (Future)

- Broker-invites-client flow ("Trojan Horse")
- Broker login/portal
- Document request workflow
- Email notifications to brokers
