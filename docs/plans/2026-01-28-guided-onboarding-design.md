# Guided Onboarding Flow - Design

**Date:** 2026-01-28
**Status:** Approved
**Phase:** 7.2 (V0.3 Roadmap)

---

## Overview

Two-part onboarding system: an enhanced full-screen wizard for new users plus contextual page tours powered by Driver.js. Builds on the existing `OnboardingWizard`, `SetupChecklist`, and `onboarding` service infrastructure.

---

## Part 1: Enhanced Wizard

Full-screen modal replacing the current sidebar `OnboardingWizard`. Same trigger: shows when `!wizardDismissedAt && propertyCount === 0`.

### Step 1 — Welcome

- Headline: "Welcome to PropertyTracker"
- Value prop: "Track your properties, automate expenses, and optimize your tax position."
- CTA: "Get Started"

### Step 2 — Add Your First Property

- Inline form with essential fields: address (autocomplete), purchase price, purchase date, property type.
- Submits via existing `property.create` tRPC mutation.
- "Skip for now" link below the form.
- Success confirmation auto-advances after 1.5s.

### Step 3 — Connect Your Bank

- Explanation card: what Basiq is, security reassurance (bank-level encryption, read-only access), what they get (automatic transaction imports).
- CTA: "Connect Bank" — redirects to `/banking/connect`. The banking page tour auto-launches on arrival.
- "Skip for now" link.
- On return to `/dashboard`, wizard detects bank connection and advances to step 4.

### Step 4 — You're All Set

- Summary with checkmarks for completed steps, dashes for skipped.
- Preview of remaining checklist items (categorize transactions, set up recurring, add property value).
- CTA: "Go to Dashboard"
- Dismisses wizard, dashboard shows `SetupChecklist` card.

### Progress Bar

Horizontal progress indicator across the top of the wizard showing current step out of 4.

---

## Part 2: Contextual Page Tours

5 tours using Driver.js (~5kb, MIT license). Each tour is 3-6 highlight steps with concise copy.

### Trigger Model

- **First visit**: Auto-launches after 500ms delay (let page render). "Skip tour" and "Don't show tours again" options.
- **On demand**: Persistent "?" help button in the page header re-triggers the current page's tour.

### Dashboard Tour

1. Sidebar navigation — "Navigate between properties, banking, transactions, and reports"
2. Portfolio summary card — "Your total portfolio value and equity at a glance"
3. Setup checklist — "Track your progress here. Complete all steps to get the most out of PropertyTracker"
4. Quick actions — "Add properties, record expenses, or view reports from here"

### Add Property Tour (`/properties/new`)

1. Address field — "Start typing to search. We'll auto-fill suburb, state, and postcode"
2. Purchase details — "Used for capital gains calculations and equity tracking"
3. Property type selector — "This determines which compliance rules and tax categories apply"

### Banking Tour (`/banking/connect`)

1. Basiq connect button — "Securely connect your bank. Read-only access, bank-level encryption"
2. Linked accounts list — "Your connected accounts appear here. Transactions sync automatically"
3. Sender allowlist (if visible) — "Allow emails from your property manager to auto-match invoices"

### Transactions Tour (`/transactions`)

1. Transaction list — "Imported transactions from your connected banks appear here"
2. Category dropdown — "Categorize each transaction for accurate tax reporting"
3. Bulk actions toolbar — "Select multiple transactions to categorize or assign in bulk"
4. Filters — "Filter by property, category, date range, or status"

### Portfolio Tour (`/portfolio`)

1. Property cards — "Each property shows current value, equity, and growth"
2. AVM estimates — "Automated valuations update monthly from market data"
3. Total portfolio summary — "Your combined portfolio value, debt, and equity position"

---

## Technical Implementation

### Database Changes

Add two columns to `user_onboarding` table:

- `completedTours TEXT[]` — array of completed tour IDs (e.g., `["dashboard", "transactions"]`)
- `toursDisabled BOOLEAN DEFAULT false` — global opt-out flag

### New Files

```
src/config/tours/
  dashboard.ts
  add-property.ts
  banking.ts
  transactions.ts
  portfolio.ts

src/hooks/useTour.ts
src/components/onboarding/HelpButton.tsx
src/components/onboarding/EnhancedWizard.tsx
```

### Tour Definition Format

Each tour file exports:

```ts
export const dashboardTour = {
  id: "dashboard",
  steps: [
    { element: "#sidebar-nav", title: "Navigation", description: "Navigate between..." },
    // ...
  ],
};
```

### `useTour` Hook

- Input: tour ID
- Returns: `{ startTour, isTourComplete }`
- On mount: checks `completedTours` and `toursDisabled` via tRPC query
- If not complete and not disabled: auto-launches after 500ms
- On finish/skip: calls `onboarding.completeTour` mutation
- "Don't show tours again" calls `onboarding.disableTours` mutation

### tRPC Additions (existing `onboarding` router)

- `onboarding.completeTour` — adds tour ID to `completedTours` array
- `onboarding.disableTours` — sets `toursDisabled = true`
- `onboarding.resetTours` — clears `completedTours`, sets `toursDisabled = false` (for help button)

### Help Button

- Added to dashboard layout header
- Uses `usePathname()` to determine current page, maps to tour ID
- Only visible on the 5 tour-enabled pages
- Clicking calls `startTour()` regardless of prior completion

---

## Integration & Edge Cases

### Wizard ↔ Tour Handoff

- Wizard step 3 "Connect Bank" redirects to `/banking/connect` where the banking tour auto-launches.
- On return to dashboard, wizard checks bank count. If > 0, advances to step 4. If 0, shows step 3 with "Skip".
- Dashboard tour does NOT auto-launch while wizard is open. Triggers after wizard dismissal on next dashboard visit.

### Replacing Existing Components

- `EnhancedWizard` replaces `OnboardingWizard` in the dashboard page. Same trigger condition.
- `SetupChecklist` stays unchanged. Wizard hands off to it.
- Existing `onboarding.dismissWizard` and `onboarding.dismissChecklist` mutations unchanged.

### Edge Cases

- **User already has properties** (team invite): Skip wizard, show checklist + tours only.
- **Wizard dismissed mid-flow**: Treated as dismissed. Checklist picks up remaining steps.
- **Navigation away during step 2**: No data loss (form not submitted until save). Wizard re-shows on next dashboard visit.
- **Mobile**: Driver.js works on mobile. Use `popoverOffset: 10` for spacing. No mobile-specific tour changes.
- **Pages without tours**: Help button hidden. Only shows on 5 tour-enabled pages.

---

## Dependencies

- **Driver.js** — `npm install driver.js` (~5kb, MIT)
- No other new dependencies. Uses existing shadcn/ui, tRPC, and Drizzle ORM infrastructure.
