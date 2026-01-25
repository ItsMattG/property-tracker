# Trust/SMSF Entity Support Design

**Date:** 2026-01-26
**Status:** Approved

## Overview

Add proper legal entity management for Trusts and SMSFs with full compliance tracking. Each entity becomes its own portfolio with separate access controls, compliance requirements, and tax treatment.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entity-Portfolio Relationship | Entity equals portfolio | Clear separation, distinct access controls per entity |
| SMSF Compliance Scope | Full (investment + contributions + pensions + audit) | Users need complete compliance visibility |
| Trust Compliance Scope | Distribution + Beneficiary Management | Track deadlines, streaming, beneficiary allocations |
| Migration | None needed | No existing users, build correctly from start |

---

## Data Model

### Core Entity Tables

```sql
entities
- id UUID PRIMARY KEY
- userId UUID (owner)
- type ENUM: personal | trust | smsf | company
- name TEXT (e.g., "Smith Family Trust")
- abn TEXT (optional)
- tfn TEXT (optional)
- createdAt TIMESTAMP
- updatedAt TIMESTAMP

trust_details
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- trusteeType ENUM: individual | corporate
- trusteeName TEXT
- settlementDate DATE
- trustDeedDate DATE

smsf_details
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- fundName TEXT
- fundAbn TEXT
- establishmentDate DATE
- auditorName TEXT
- auditorContact TEXT
- corporateTrusteeId UUID (optional, references entities)

beneficiaries
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- name TEXT
- relationship TEXT
- tfn TEXT (optional)
- isActive BOOLEAN

smsf_members
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- name TEXT
- dateOfBirth DATE
- memberSince DATE
- phase ENUM: accumulation | pension
- currentBalance DECIMAL
```

### Compliance Tables

```sql
smsf_contributions
- id UUID PRIMARY KEY
- entityId UUID REFERENCES entities
- memberId UUID REFERENCES smsf_members
- financialYear TEXT (e.g., "2025-26")
- concessional DECIMAL
- nonConcessional DECIMAL
- totalSuperBalance DECIMAL (at June 30 prior year)

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
- checkType ENUM: in_house_asset | related_party | lrba | arm_length
- status ENUM: compliant | warning | breach
- details JSONB
- checkedAt TIMESTAMP

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

### Schema Changes

- `properties.entityId` replaces direct user ownership
- `entity_members` table for access control (mirrors current portfolioMembers)

---

## Compliance Rules Engine

| Entity | Check | Frequency | Alert Threshold |
|--------|-------|-----------|-----------------|
| SMSF | In-house assets < 15% | On property value change | >12% warning, >15% breach |
| SMSF | Minimum pension drawn | Monthly | Behind schedule warning |
| SMSF | Contribution caps | On contribution entry | >90% of cap warning |
| SMSF | Arm's length transactions | On transaction entry | Related party flagged |
| Trust | Distribution resolution | June annually | June 15 reminder, June 28 urgent |

### SMSF Contribution Caps (2025-26)

| Cap Type | Under 75 | 75+ |
|----------|----------|-----|
| Concessional | $30,000 | $30,000 |
| Non-concessional | $120,000 | $120,000 |
| Bring-forward (3yr) | $360,000 | N/A |

### SMSF Minimum Pension Factors

| Age | Factor |
|-----|--------|
| Under 65 | 4% |
| 65-74 | 5% |
| 75-79 | 6% |
| 80-84 | 7% |
| 85-89 | 9% |
| 90-94 | 11% |
| 95+ | 14% |

---

## UI Design

### Navigation

- Top-level entity switcher in header (dropdown)
- Current entity shown with type badge (Personal, Trust, SMSF, Company)
- Quick-switch between entities

### New Pages

| Route | Purpose |
|-------|---------|
| `/entities` | List all entities user can access |
| `/entities/new` | Create new entity wizard |
| `/entities/[id]/settings` | Entity details, ABN/TFN, trustee info |
| `/entities/[id]/compliance` | Compliance dashboard for Trust/SMSF |
| `/entities/[id]/members` | SMSF members or Trust beneficiaries |
| `/entities/[id]/distributions` | Trust distribution history and entry |
| `/entities/[id]/contributions` | SMSF contribution tracking |

### Entity Creation Wizard

1. Select type (Personal/Trust/SMSF/Company)
2. Enter name and optional ABN/TFN
3. Type-specific details (trustee for Trust, fund details for SMSF)
4. Add members/beneficiaries (optional, can do later)
5. Done → redirect to new entity dashboard

### Compliance Dashboard Widgets

**SMSF:**
- Contribution caps progress bars (concessional/non-concessional per member)
- Pension drawdown status (amount drawn vs minimum required)
- In-house asset percentage gauge (with 15% limit line)
- Upcoming audit checklist with completion status

**Trust:**
- Days until distribution deadline (June 30)
- Beneficiary list with YTD allocations
- Resolution status (recorded/pending)
- Distribution history summary

---

## API Design

### entityRouter

| Procedure | Input | Output |
|-----------|-------|--------|
| `list` | - | All entities user can access |
| `get` | `{ entityId }` | Entity with type-specific details |
| `create` | `{ type, name, abn?, details }` | Created entity |
| `update` | `{ entityId, ... }` | Updated entity |
| `delete` | `{ entityId }` | Success (only if no properties) |
| `switch` | `{ entityId }` | Sets active entity in session |
| `getMembers` | `{ entityId }` | Entity members with roles |
| `inviteMember` | `{ entityId, email, role }` | Pending invite |

### smsfComplianceRouter

| Procedure | Input | Output |
|-----------|-------|--------|
| `getDashboard` | `{ entityId }` | Full compliance status |
| `getMembers` | `{ entityId }` | SMSF members list |
| `addMember` | `{ entityId, name, dob, ... }` | Created member |
| `updateMember` | `{ memberId, ... }` | Updated member |
| `addContribution` | `{ entityId, memberId, type, amount, date }` | Updated caps status |
| `getContributions` | `{ entityId, year }` | Contributions by member |
| `recordPension` | `{ entityId, memberId, amount, date }` | Updated drawdown |
| `getPensionStatus` | `{ entityId, year }` | Drawdown vs minimum |
| `runComplianceCheck` | `{ entityId }` | All check results |
| `getAuditChecklist` | `{ entityId, year }` | Checklist items with status |
| `updateChecklistItem` | `{ itemId, completed }` | Updated item |

### trustComplianceRouter

| Procedure | Input | Output |
|-----------|-------|--------|
| `getDashboard` | `{ entityId }` | Distribution status, deadlines |
| `getBeneficiaries` | `{ entityId }` | Beneficiary list |
| `addBeneficiary` | `{ entityId, name, relationship, tfn? }` | Created beneficiary |
| `updateBeneficiary` | `{ beneficiaryId, ... }` | Updated beneficiary |
| `createDistribution` | `{ entityId, year, resolutionDate, allocations[] }` | Distribution record |
| `getDistributions` | `{ entityId }` | Distribution history |
| `getDistribution` | `{ distributionId }` | Single distribution with allocations |

### Context Changes

- `ctx.entity` becomes primary scope (replaces `ctx.portfolio`)
- All existing routers updated to filter by `entityId`
- Session stores `activeEntityId`

---

## Implementation Notes

### Phase 1: Core Entity Infrastructure
- Entity schema and CRUD
- Entity switcher UI
- Migrate properties to entityId
- Update all routers for entity context

### Phase 2: SMSF Compliance
- Member management
- Contribution tracking with cap warnings
- Pension drawdown tracking
- Compliance checks engine
- Audit checklist

### Phase 3: Trust Compliance
- Beneficiary management
- Distribution recording
- Deadline reminders
- Streaming support (CGT, franking)

### Phase 4: Reporting
- Entity-specific tax reports
- SMSF annual return data export
- Trust distribution statements

---

## Out of Scope

- Automated ATO lodgement
- SMSF rollover processing
- Trust deed generation
- Corporate trustee management (beyond basic linking)
- Member insurance tracking
