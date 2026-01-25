# Compliance Calendar Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Property compliance tracking with automated reminders for recurring inspections across all Australian states. Reduces landlord anxiety about missing smoke alarm checks, gas safety audits, and other state-specific requirements.

## Scope

**Included (Phase 1):**
- Recurring inspections: smoke alarms, gas safety, electrical safety, pool safety
- Lease expiry tracking
- All Australian states (VIC, NSW, QLD, SA, WA, TAS, NT, ACT)

**Excluded (Future):**
- Property standards checklists (VIC's 14+ minimum standards)
- One-time compliance items

## Data Model

### Static Config (not a database table)

```typescript
// src/lib/compliance-requirements.ts

type ComplianceRequirement = {
  id: string;
  name: string;
  description: string;
  frequencyMonths: number;
  legislationUrl?: string;
};

type StateRequirements = Record<State, ComplianceRequirement[]>;
```

### Database Table

```
complianceRecords
├── id (uuid, primary key)
├── propertyId (uuid, FK to properties)
├── userId (uuid, FK to users)
├── requirementId (string, references config id)
├── completedAt (date, when check was done)
├── nextDueAt (date, calculated: completedAt + frequency)
├── notes (text, optional)
├── documentId (uuid, optional FK to documents)
├── createdAt (timestamp)
└── updatedAt (timestamp)
```

## Compliance Requirements by State

| Requirement | VIC | NSW | QLD | SA | WA | TAS | NT | ACT |
|------------|-----|-----|-----|----|----|-----|----|----|
| Smoke Alarm (annual) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gas Safety (2yr) | ✓ | - | - | - | - | - | - | - |
| Electrical Safety (2yr) | ✓ | - | ✓ | - | - | - | - | - |
| Pool Safety | 3yr | 3yr | 1yr | - | 4yr | - | - | - |

*Frequencies and requirements based on current legislation. Config can be updated as laws change.*

## API Endpoints

### compliance.getPropertyCompliance
- **Input:** `{ propertyId }`
- **Output:** Array of `{ requirement, lastRecord, nextDueAt, status }`
- Returns all applicable requirements for property's state with current status

### compliance.getPortfolioCompliance
- **Input:** none
- **Output:** `{ summary, upcomingItems, overdueItems }`
- Portfolio-wide view with counts by status

### compliance.recordCompletion
- **Input:** `{ propertyId, requirementId, completedAt, notes?, documentId? }`
- **Output:** `{ record, nextDueAt }`
- Creates compliance record, calculates next due date

### compliance.getHistory
- **Input:** `{ propertyId, requirementId }`
- **Output:** Array of past records

### compliance.updateRecord
- **Input:** `{ recordId, completedAt?, notes?, documentId? }`

### compliance.deleteRecord
- **Input:** `{ recordId }`

## Status Calculation

Status derived from `nextDueAt` relative to today:
- **compliant:** > 30 days until due
- **upcoming:** ≤ 30 days until due
- **due_soon:** ≤ 7 days until due
- **overdue:** past due date

## UI Components

### Dedicated Compliance Page (`/reports/compliance`)
- Summary cards: Total, Compliant, Due Soon, Overdue
- Filter by property, status, requirement type
- Table: Property | Requirement | Last Check | Next Due | Status | Actions
- Quick "Mark Complete" action

### Property Compliance Section
- Collapsible section on property detail page
- Shows requirements for property's state
- Record completion inline
- View history link

### Record Completion Modal
- Date picker (defaults to today)
- Optional notes textarea
- Optional document attachment
- Submit creates record

## Reminders & Notifications

### Escalating Schedule
- **30 days before:** "Upcoming: [Property] smoke alarm check due [date]"
- **7 days before:** "Due soon: [Property] smoke alarm check due in 7 days"
- **On due date:** "Due today: [Property] smoke alarm check"
- **Overdue:** Shown in UI only (no notification spam)

### Implementation
- Daily cron job scans `complianceRecords.nextDueAt`
- Uses existing `notifyUser()` function for push + email
- New notification type: `compliance_reminder`
- New preference: `complianceReminders` boolean
- Respects quiet hours

## File Structure

```
src/lib/compliance-requirements.ts              - Static config per state
src/server/db/schema.ts                         - Add complianceRecords table
src/server/routers/compliance.ts                - CRUD + portfolio queries
src/server/services/compliance.ts               - Status calculation, due dates

src/app/(dashboard)/reports/compliance/page.tsx - Portfolio compliance page
src/components/compliance/ComplianceTable.tsx
src/components/compliance/RecordCompletionModal.tsx
src/components/compliance/ComplianceStatusBadge.tsx
src/components/compliance/PropertyComplianceSection.tsx

src/app/api/cron/compliance-reminders/route.ts  - Daily reminder cron
```

## Technical Decisions

- **Static config:** Requirements defined in TypeScript, not database. Simple, version-controlled, rarely changes.
- **Simple recording:** Date entry with optional document. Low friction for DIY landlords.
- **Calculated status:** Derived from dates, not stored. Always accurate.
- **Existing notification system:** Reuses push/email infrastructure.
