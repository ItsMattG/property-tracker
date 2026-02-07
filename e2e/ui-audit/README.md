# UI/UX Audit System

Automated UI/UX audit for BrickTrack using Playwright. Captures screenshots of all page states and logs findings for review.

## Quick Start

```bash
# Run full audit and generate report
npm run ui-audit:full

# Run only specific sections
npm run test:ui-audit:public      # Landing, Privacy, Terms
npm run test:ui-audit:dashboard   # Dashboard, Properties, Transactions, Banking
npm run test:ui-audit:reports     # All report pages
npm run test:ui-audit:settings    # All settings pages

# Generate report from existing results
npm run ui-audit:report
```

## Prerequisites

### 1. Demo Account

A demo account must exist with email/password authentication.

Set environment variables in `.env.local`:

```bash
E2E_USER_EMAIL=demo@propertytracker.test
E2E_USER_PASSWORD=Demo123!Property
```

### 2. Seed Data (Optional but Recommended)

For comprehensive testing, seed the demo account with edge case data:

```bash
npm run seed:demo -- --email=demo@propertytracker.test --clean
```

This creates properties, bank accounts (including error states), transactions, and other test data.

## What Gets Tested

### Pages Covered

| Category | Pages |
|----------|-------|
| **Public** | Landing, Privacy Policy, Terms of Service |
| **Auth** | Sign-in, Sign-up flows |
| **Dashboard** | Main dashboard, Properties, Transactions, Banking, Export |
| **Reports** | Tax, CGT, Portfolio, Scenarios, Tax Position, YoY Comparison, Audit Checks, MyTax |
| **Settings** | Billing, Team, Integrations, Notifications, Mobile, Refinance Alerts, Advisors, Referrals, Support |
| **Components** | Dialogs, Loading states, Empty states, Error states |

### States Captured

- Page loaded state
- Loading/skeleton states
- Empty states (when no data)
- Error states (from seeded error conditions)
- Mobile responsiveness (375px viewport)
- Dialog open/close states
- Form validation states
- Navigation states

## Output

### Screenshots

All captured screenshots are stored in:

```
e2e/ui-audit/results/screenshots/
```

Naming convention: `{page}-{state}.png`

Examples:
- `dashboard-loaded.png`
- `properties-mobile.png`
- `transactions-filters-open.png`

### Audit Log

Findings are logged to:

```
e2e/ui-audit/results/audit-log.json
```

Each finding includes:
- `page`: URL path
- `element`: UI element name
- `state`: When the issue was observed
- `issue`: Description of the problem
- `severity`: critical | major | minor | suggestion

### Report

Generated markdown report at:

```
docs/ui-ux-audit-report.md
```

## Finding Severities

| Severity | Definition | Example |
|----------|------------|---------|
| **Critical** | Blocks user from completing task | Form submit does nothing |
| **Major** | Significantly degrades experience | No loading indicator on slow operation |
| **Minor** | Polish/consistency issue | Slightly misaligned text, missing label |
| **Suggestion** | Enhancement opportunity | Could add keyboard shortcut |

## Extending the Audit

### Adding New Pages

Create a new test file in the appropriate directory:

```typescript
// e2e/ui-audit/dashboard/new-page.audit.ts
import { test, expect } from "../fixtures/demo-account";

test.describe("New Page Audit", () => {
  test("captures all states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/new-page");
    await page.waitForLoadState("networkidle");
    await captureState("loaded");

    // Add checks and capture states...
    if (!(await someElement.isVisible())) {
      addFinding({
        element: "Some element",
        state: "loaded",
        issue: "Element not visible",
        severity: "major",
      });
    }
  });
});
```

### Custom Findings

Use `addFinding()` to log issues:

```typescript
addFinding({
  element: "Submit button",
  state: "form-submitted",
  issue: "No loading state during submission",
  severity: "major",
});
```

### Screenshot Capture

Use `captureState()` to take screenshots:

```typescript
await captureState("loaded");           // dashboard-loaded.png
await captureState("filters-open");     // dashboard-filters-open.png
await captureState("mobile");           // dashboard-mobile.png
```

## Troubleshooting

### Tests fail to authenticate

1. Verify demo account credentials in `.env.local`
2. Ensure BetterAuth is properly configured
3. Check that the demo account exists in the database

### No screenshots generated

1. Check `e2e/ui-audit/results/screenshots/` directory exists
2. Verify write permissions
3. Check test output for errors

### Empty audit log

1. Tests must call `addFinding()` to log issues
2. Findings are only written when tests complete successfully
3. Check for test failures in Playwright output
