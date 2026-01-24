# Polish & UX Design (Phase 1)

**Date:** 2026-01-24
**Status:** Approved
**Scope:** Onboarding + Navigation Improvements

## Overview

Improve new user experience with onboarding wizard and setup checklist. Enhance navigation with quick-add button, breadcrumbs, and property selector. Mobile responsiveness and transaction workflow deferred to Phase 2.

---

## Data Model

### New Table: userOnboarding

```sql
userOnboarding
- id: uuid primary key
- userId: uuid references users(id) unique
- wizardDismissedAt: timestamp nullable
- checklistDismissedAt: timestamp nullable
- completedSteps: text[] (array of step IDs)
- createdAt: timestamp
- updatedAt: timestamp
```

**Step IDs:**
- `add_property` - User has at least one property
- `connect_bank` - User has at least one bank account
- `categorize_10` - User has categorized 10+ transactions
- `setup_recurring` - User has at least one recurring transaction
- `add_property_value` - User has added a property value estimate

Progress derived by querying actual data counts.

---

## Onboarding Wizard

### Trigger Logic

- On dashboard load, check if `wizardDismissedAt` is null
- If null and user has 0 properties → show wizard
- Wizard slides in from right (~400px wide panel with overlay)

### Wizard Steps

1. **Welcome** - Brief intro, "Let's set up your portfolio in 3 steps"
2. **Add Property** - Simplified form (address, purchase price, date), or "Skip"
3. **Connect Bank** - Explains Basiq, button to start connection, or "Skip"
4. **Done** - Success message, "View Dashboard" button

### Behavior

- Each step has "Skip" and "Continue" buttons
- Completing a step marks it in `completedSteps` array
- Clicking "Skip" or completing all steps sets `wizardDismissedAt`
- Wizard never shows again once dismissed
- If user leaves mid-wizard, resumes at last incomplete step

### Simplified Property Form

Essential fields only:
- Address, suburb, state, postcode
- Purchase price, purchase date
- Entity name defaults to "Personal"

Other fields can be edited later on full property page.

---

## Dashboard Checklist Widget

### Display Logic

- Show if `checklistDismissedAt` is null AND at least one step incomplete
- Positioned as first card in dashboard grid (before stats cards)

### Checklist Items

| Step | Check Condition | Action Link |
|------|-----------------|-------------|
| Add a property | `properties.count > 0` | /properties/new |
| Connect your bank | `bankAccounts.count > 0` | /banking/connect |
| Categorize 10 transactions | `categorized.count >= 10` | /transactions |
| Set up recurring transaction | `recurringTransactions.count > 0` | /properties |
| Add property value estimate | `propertyValues.count > 0` | /portfolio |

### UI

- Card title: "Setup Progress" with "X of 5 complete"
- Progress bar at top
- Each item: checkbox (filled if complete), label, arrow link
- Completed items have strikethrough styling
- "Dismiss" link at bottom sets `checklistDismissedAt`

### Query Efficiency

Single tRPC query `onboarding.getProgress` returns all counts in one call, cached for 1 minute.

---

## Quick Add Button

### Location

Header bar, right side, before user menu.

### UI

- Circular button with "+" icon
- Dropdown menu on click:
  - "Add Property" → /properties/new
  - "Add Transaction" → opens AddTransactionDialog modal
  - "Add Loan" → /loans/new

### AddTransactionDialog

Modal for manual transaction entry:
- Fields: date, description, amount, property, category, type
- Used for cash transactions or when bank not connected

### Keyboard Shortcut

- `Cmd/Ctrl + K` opens quick-add dropdown
- Shows shortcut hint in dropdown: "⌘K"

### Responsive

- Button remains in header on mobile
- Dropdown full-width on small screens

---

## Breadcrumbs

### Routes

Shown on property detail pages:
- `/properties/[id]` → Properties > 123 Main St, Sydney
- `/properties/[id]/capital` → Properties > 123 Main St > Capital Gains
- `/properties/[id]/recurring` → Properties > 123 Main St > Recurring
- `/properties/[id]/documents` → Properties > 123 Main St > Documents

### Implementation

- `Breadcrumb` component reads current route and property context
- Each segment is clickable link
- Subtle styling: muted text, "/" separators
- Placed below header, above page title

---

## Property Selector

### Trigger

When on any `/properties/[id]/*` route.

### UI

- Header shows current property name with chevron dropdown
- Dropdown lists all user's properties (suburb, state format)
- Selecting property navigates to same sub-route on new property

### Example

On `/properties/abc/capital`, selecting property "xyz" navigates to `/properties/xyz/capital`.

### Query

Uses existing `property.list` query (already cached).

---

## Testing

### Unit Tests

- `onboarding.getProgress` - correct counts and completion status
- `onboarding.dismissWizard` - sets timestamp
- `onboarding.dismissChecklist` - sets timestamp
- Each step's completion condition

### Component Tests

- OnboardingWizard - step navigation, skip, form submission
- SetupChecklist - correct state rendering, dismiss
- QuickAddButton - dropdown, keyboard shortcut
- PropertySelector - correct routes, navigation
- Breadcrumb - correct segments per route

### Integration Tests

- New user: wizard appears → add property → wizard advances
- Returning user: checklist shows → complete steps → updates
- Property navigation: switch via selector, verify URL change

---

## Components Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| OnboardingWizard | Slide-out panel | Guide new users through setup |
| SetupChecklist | Dashboard card | Track setup progress |
| QuickAddButton | Header | Fast access to create actions |
| AddTransactionDialog | Modal | Manual transaction entry |
| Breadcrumb | Below header | Navigate property sub-pages |
| PropertySelector | Header | Switch between properties |

---

## Future Work (Phase 2)

- Mobile responsiveness (collapsible sidebar, bottom nav)
- Transaction review workflow (keyboard shortcuts, swipe gestures)
- Batch categorization suggestions
