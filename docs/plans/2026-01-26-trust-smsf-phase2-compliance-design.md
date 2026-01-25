# Trust/SMSF Phase 2 Compliance Design

**Date:** 2026-01-26
**Status:** Approved

## Overview

Add SMSF and Trust compliance tracking on top of Phase 1 entity infrastructure. Includes member/beneficiary management, contribution caps, pension drawdowns, distribution recording, and deadline reminders.

## Database Schema

### SMSF Tables

```sql
smsf_members
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- name TEXT
- dateOfBirth DATE
- memberSince DATE
- phase ENUM: accumulation | pension
- currentBalance DECIMAL

smsf_contributions
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- memberId UUID REFERENCES smsf_members
- financialYear TEXT (e.g., "2025-26")
- concessional DECIMAL
- nonConcessional DECIMAL
- totalSuperBalance DECIMAL (at prior June 30)

smsf_pensions
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- memberId UUID REFERENCES smsf_members
- financialYear TEXT
- minimumRequired DECIMAL
- amountDrawn DECIMAL
- frequency ENUM: monthly | quarterly | annual

smsf_compliance_checks
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- financialYear TEXT
- checkType ENUM: in_house_asset | related_party | arm_length
- status ENUM: compliant | warning | breach
- details JSONB
- checkedAt TIMESTAMP

smsf_audit_items
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- financialYear TEXT
- item TEXT
- completed BOOLEAN
- completedAt TIMESTAMP
```

### Trust Tables

```sql
beneficiaries
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- name TEXT
- relationship TEXT
- tfn TEXT (optional)
- isActive BOOLEAN

trust_distributions
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- financialYear TEXT
- resolutionDate DATE
- totalAmount DECIMAL
- capitalGainsComponent DECIMAL
- frankingCreditsComponent DECIMAL

distribution_allocations
- id UUID PRIMARY KEY
- distributionId UUID REFERENCES trust_distributions
- beneficiaryId UUID REFERENCES beneficiaries
- amount DECIMAL
- capitalGains DECIMAL
- frankingCredits DECIMAL
```

## Compliance Rules

### SMSF Rules

| Check | Trigger | Logic |
|-------|---------|-------|
| Contribution caps | On entry | Concessional: warn >$27k, breach >$30k. Non-concessional: warn >$108k, breach >$120k |
| Pension minimum | Monthly | Age-based factor (4%-14%) × opening balance. Warn if behind pro-rata |
| In-house assets | On property value change | Warn >12%, breach >15% |
| Related party | On transaction | Flag if counterparty matches member/related entity |

### SMSF Pension Minimum Factors

| Age | Factor |
|-----|--------|
| Under 65 | 4% |
| 65-74 | 5% |
| 75-79 | 6% |
| 80-84 | 7% |
| 85-89 | 9% |
| 90-94 | 11% |
| 95+ | 14% |

### Trust Rules

| Check | Trigger | Logic |
|-------|---------|-------|
| Distribution deadline | Daily in June | Warn June 15, urgent June 25, overdue July 1 |
| Resolution recorded | On June 30 | Check if distribution exists for current FY |

## API Design

### smsfComplianceRouter

| Procedure | Input | Output |
|-----------|-------|--------|
| getMembers | { entityId } | Members list |
| addMember | { entityId, name, dob, phase, balance } | Created member |
| updateMember | { memberId, ... } | Updated member |
| addContribution | { entityId, memberId, year, concessional?, nonConcessional? } | Cap status |
| getContributions | { entityId, year } | Contributions by member |
| recordPension | { entityId, memberId, amount, date } | Drawdown status |
| getPensionStatus | { entityId, year } | Drawdown vs minimum |
| runComplianceCheck | { entityId } | All check results |
| getAuditChecklist | { entityId, year } | Checklist items |
| updateChecklistItem | { itemId, completed } | Updated item |

### trustComplianceRouter

| Procedure | Input | Output |
|-----------|-------|--------|
| getBeneficiaries | { entityId } | Beneficiaries list |
| addBeneficiary | { entityId, name, relationship, tfn? } | Created beneficiary |
| updateBeneficiary | { beneficiaryId, ... } | Updated beneficiary |
| createDistribution | { entityId, year, resolutionDate, allocations[] } | Distribution record |
| getDistributions | { entityId } | Distribution history |
| getDistribution | { distributionId } | Distribution with allocations |
| getDeadlineStatus | { entityId } | Days remaining, status |

## UI Design

### Routes

| Route | Purpose |
|-------|---------|
| /entities/[id]/compliance | Compliance dashboard |
| /entities/[id]/members | SMSF members |
| /entities/[id]/contributions | Contribution tracking |
| /entities/[id]/pensions | Pension drawdowns |
| /entities/[id]/beneficiaries | Trust beneficiaries |
| /entities/[id]/distributions | Distribution history |

### SMSF Dashboard Widgets

- Contribution Caps - Progress bars per member
- Pension Status - Drawn vs minimum required
- In-House Assets - Gauge with 15% limit
- Audit Checklist - Completion status

### Trust Dashboard Widgets

- Distribution Deadline - Days countdown
- Resolution Status - Recorded/Pending badge
- Beneficiary Summary - YTD allocations
- Distribution History - Past years table

### Shared Components

- ComplianceAlert - Warning/breach banner
- FinancialYearSelector - Year dropdown

## Alert Integration

| Event | Type | Message |
|-------|------|---------|
| Contribution >90% cap | warning | "Member X approaching concessional cap" |
| Contribution exceeds cap | critical | "Member X exceeded cap" |
| Pension behind schedule | warning | "Pension drawdown behind" |
| In-house >12% | warning | "Approaching 15% limit" |
| In-house >15% | critical | "In-house asset breach" |
| June 15 | info | "Distribution deadline in 15 days" |
| June 25 | warning | "Distribution deadline in 5 days" |
| July 1 no resolution | critical | "Distribution deadline missed" |

## Testing Strategy

- Unit tests: compliance calculations (caps, minimums, percentages)
- Integration tests: API procedures
- E2E tests: member → contribution → warning flow, beneficiary → distribution flow
