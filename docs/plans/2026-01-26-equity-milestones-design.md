# Equity Milestone Notifications - Design

**Date:** 2026-01-26
**Status:** Approved

## Overview

Notify users when properties hit equity milestones (LVR thresholds or equity amounts). Supports global user preferences with per-property overrides.

## Milestones

**Default LVR Thresholds** (lower = more equity):
- 80% - No LMI territory
- 60% - Strong equity position
- 40% - Significant wealth
- 20% - Nearly paid off

**Default Equity Amounts:**
- $100,000
- $250,000
- $500,000
- $1,000,000

Users can customize thresholds globally and override per-property.

---

## Data Model

### Table: `equity_milestones`
Records achieved milestones.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Primary key |
| propertyId | uuid (FK) | Reference to properties |
| userId | uuid (FK) | Reference to users |
| milestoneType | enum | 'lvr' or 'equity_amount' |
| milestoneValue | decimal | Threshold that was crossed |
| equityAtAchievement | decimal | Equity at time of achievement |
| lvrAtAchievement | decimal | LVR at time of achievement |
| achievedAt | timestamp | When milestone was achieved |

### Table: `milestone_preferences`
User's global milestone settings.

| Column | Type | Description |
|--------|------|-------------|
| userId | uuid (PK, FK) | Reference to users |
| lvrThresholds | jsonb | Array of LVR thresholds, default [80, 60, 40, 20] |
| equityThresholds | jsonb | Array of equity amounts, default [100000, 250000, 500000, 1000000] |
| enabled | boolean | Global enable/disable, default true |

### Table: `property_milestone_overrides`
Per-property overrides (nullable fields inherit from global).

| Column | Type | Description |
|--------|------|-------------|
| propertyId | uuid (PK, FK) | Reference to properties |
| lvrThresholds | jsonb | Override LVR thresholds, null = use global |
| equityThresholds | jsonb | Override equity amounts, null = use global |
| enabled | boolean | Override enabled, null = use global |

### Resolution Logic
Property override → Global preference → System defaults

---

## Detection Logic

Daily cron job at `/api/cron/equity-milestones`:

1. Get all active properties with latest valuation + total loan balance
2. For each property:
   - Calculate: `equity = latestValue - totalLoanBalance`
   - Calculate: `LVR = (totalLoanBalance / latestValue) × 100`
   - Resolve thresholds using resolution logic
   - Skip if disabled at any level
3. For each threshold not yet recorded in `equity_milestones`:
   - LVR milestone: triggered when LVR drops **below** threshold
   - Equity milestone: triggered when equity rises **above** threshold
4. Record milestone + send notification (push/email per user notification prefs)

### Edge Cases
- Property with no valuation → skip
- Property with no loans → 0% LVR, full equity value
- Negative equity → no milestones triggered
- Milestone already recorded → skip (idempotent)

---

## User Interface

### 1. Settings Page - Global Preferences
- Toggle: "Enable equity milestone notifications"
- LVR thresholds: Multi-select chips (80%, 60%, 40%, 20%) + "Add custom" input
- Equity thresholds: Multi-select chips ($100k, $250k, $500k, $1M) + "Add custom" input
- Reset to defaults button

### 2. Property Detail Page - Overrides + History
- "Milestones" card showing achieved milestones with dates
- Expandable "Customize" section:
  - "Use global settings" toggle (default: on)
  - When off: same threshold controls as Settings page
  - "Disable for this property" option

### 3. Notifications
- **Push:** "🎉 123 Main St hit 60% LVR - you now have 40% equity!"
- **Email:** Styled HTML with property details and "View Property" CTA
- Links to property detail page

---

## Testing

### Unit Tests
- Threshold resolution: property override → global → defaults
- LVR milestone detection (triggers when LVR drops below)
- Equity milestone detection (triggers when equity rises above)
- Edge cases: no valuation, no loans, negative equity, disabled
- Notification message formatting

### Integration Tests
- Cron endpoint with auth header validation
- Full flow: property data → milestone detection → DB insert → notification

---

## Error Handling

- Cron requires `CRON_SECRET` bearer token (401 if missing)
- Individual property failures logged but don't stop batch
- Notification failures logged to `notification_log` with status `failed`
- Returns summary: `{ propertiesChecked, newMilestones, notificationsSent }`
