# Smart Reminders Calendar — Design

**Beads task:** property-tracker-3ex

**Goal:** Calendar view of key property dates across portfolio with email reminders. Reduces missed deadlines — a common investor pain point.

**V1 Scope:** Manual entry only (no AI extraction). Calendar grid + list view. Dashboard widget. Email notifications via daily cron. Free for all users.

---

## Data Model

**New enum** `reminderTypeEnum`:
```
lease_expiry, insurance_renewal, fixed_rate_expiry, council_rates,
body_corporate, smoke_alarm, pool_safety, tax_return, custom
```

**New table** `property_reminders`:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| propertyId | uuid FK → properties | Required |
| userId | text | Owner scoping |
| reminderType | reminderTypeEnum | From enum above |
| title | text | Auto-generated from type + property, or custom |
| dueDate | date | When the event is due |
| reminderDaysBefore | int[] | Days before due to send email. Default: [30, 7] |
| notes | text? | Optional user notes |
| notifiedAt | timestamp? | Last notification sent |
| completedAt | timestamp? | User marks as done |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |

**Indexes:** `userId`, `propertyId`, `dueDate`, composite `(userId, dueDate)`.

No recurring logic — user creates next year's reminder after completing current one.

---

## Architecture

**Approach chosen:** New `propertyReminders` table + dedicated `reminder` tRPC router. Clean separation from compliance records. Purpose-built schema.

**Rejected alternatives:**
- Extending `complianceRecords` — overloads compliance with non-compliance concepts
- Generic `propertyEvents` table — over-engineered for V1, loses type safety

---

## tRPC Router

New `reminder` router:

| Procedure | Type | Input | Purpose |
|-----------|------|-------|---------|
| `list` | protectedProcedure | `{ propertyId?: string }` | All reminders, optionally per property |
| `getUpcoming` | protectedProcedure | `{ days?: number }` (default 90) | Reminders due within N days, sorted ascending |
| `getByMonth` | protectedProcedure | `{ year: number, month: number }` | Reminders in a calendar month |
| `create` | writeProcedure | `{ propertyId, reminderType, dueDate, title?, notes?, reminderDaysBefore? }` | Create reminder |
| `update` | writeProcedure | `{ id, dueDate?, title?, notes?, reminderDaysBefore? }` | Update reminder |
| `complete` | writeProcedure | `{ id }` | Set completedAt |
| `delete` | writeProcedure | `{ id }` | Delete reminder |

**Repository:** `ReminderRepository` with interface following existing patterns.

---

## UI

### Calendar Page (`/reminders`)

Two-panel view with Calendar/List toggle pills:

**Calendar View (default):**
- Month grid with colored dots on days with reminders
- Dot colors: red = overdue, amber = due within 7 days, blue = future
- Click day → popover with that day's reminders
- Month nav arrows + today button

**List View:**
- Grouped by time horizon: "Overdue", "This Week", "This Month", "Next 3 Months"
- Each row: property name, type icon, title, due date, countdown badge, actions

**Add Reminder dialog:**
- Property selector, type dropdown (auto-fills title), date picker
- Reminder timing: multi-select chips (30d, 14d, 7d, 1d)
- Notes field
- Title auto-generated but editable

**Empty state:** Illustration + "Add your first reminder" CTA.

### Dashboard Widget

Compact "Upcoming Reminders" card showing next 3-5 items with:
- Reminder title, property name, countdown badge
- "View All" link to /reminders
- Shows "No upcoming reminders" when empty

### Sidebar

New nav item "Reminders" with CalendarDays icon, under "Properties & Banking" group.

---

## Email Notifications

**Daily cron** via Vercel cron job → `/api/cron/reminders` API route.

**Logic:**
1. Query reminders where today matches `dueDate - reminderDaysBefore[n]` AND not already notified for this threshold
2. Send email via existing `sendEmailNotification`
3. Update `notifiedAt`
4. Respects user notification preferences (quiet hours, email toggle)

**Email template** (`reminder-due.ts`):
- Subject: "Reminder: {type} due in {N} days — {property address}"
- Body: Property name, reminder type, due date, countdown, CTA link to /reminders
- Uses existing base email template

---

## Feature Flag & Routing

- Feature flag: `reminders: true` (enabled from start)
- Route: `/reminders` added to sidebar nav
- No plan gating — free for all users

---

## Not in V1

- AI document date extraction (future: auto-populate from uploaded leases/insurance)
- Recurring reminders (annual, quarterly templates)
- Push notifications
- In-app notification badges
- State-specific rent increase notice templates
