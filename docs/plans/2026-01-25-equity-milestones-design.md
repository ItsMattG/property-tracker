# Equity Milestone Notifications - Design

## Overview
Celebrate when properties hit equity milestones. Notify users via push + email when LVR or equity thresholds are crossed.

## Milestones

**LVR Thresholds** (lower = more equity):
- 80% - No LMI territory
- 60% - Strong equity position
- 40% - Significant wealth
- 20% - Nearly paid off

**Equity Amounts**:
- $100,000
- $250,000
- $500,000
- $1,000,000

## Data Model

New table: `equity_milestones`
- `id` (uuid, PK)
- `propertyId` (uuid, FK to properties)
- `userId` (uuid, FK to users)
- `milestoneType` (enum: 'lvr' | 'equity_amount')
- `milestoneValue` (decimal - threshold crossed)
- `equityAtAchievement` (decimal)
- `lvrAtAchievement` (decimal)
- `achievedAt` (timestamp)

## Detection

Daily cron job `/api/cron/equity-milestones`:
1. Get properties with valuations and loans
2. Calculate: equity = latestValue - totalLoanBalance
3. Calculate: LVR = (totalLoanBalance / latestValue) × 100
4. Check thresholds not yet in `equity_milestones`
5. Record + notify for new milestones

## Notifications

Uses existing notification infrastructure:
- Push (respects quiet hours)
- Email
- Controlled by user's `notificationPreferences`

Example messages:
- LVR: "Your property at 123 Main St has reached 60% LVR - you now have 40% equity!"
- Equity: "Congratulations! 123 Main St has crossed $250,000 in equity!"

## UI

Property detail page: Add "Milestones Achieved" section showing history with dates.
