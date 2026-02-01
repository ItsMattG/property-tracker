# UI/UX Audit System Design

**Goal:** Comprehensive automated UI/UX audit of PropertyTracker using Playwright, with a demo account showing all edge cases and a detailed written report.

## Scope & Architecture

### What We're Building

1. **Playwright Test Suite** (`e2e/ui-audit/`) - Automated tests that systematically explore every page, clicking all interactive elements, capturing screenshots of all states
2. **Written Report** (`docs/ui-ux-audit-report.md`) - Human-readable findings with categorized issues and recommendations
3. **Demo Account Seed Data** - A dedicated demo user with rich, realistic data to show all UI states

### Test Categories

| Category | What We Test |
|----------|-------------|
| **Dialogs** | Open/close, form validation, confirm dialogs, alert dialogs |
| **Loading States** | Skeleton components, spinners, suspense boundaries |
| **Empty States** | What users see when no data exists |
| **Error States** | API errors, network failures, validation errors |
| **Navigation** | Sidebar, breadcrumbs, tabs, pagination |
| **Forms** | All input types, validation, submit states |
| **Tables** | Sorting, filtering, selection, actions |
| **Charts** | Loading, no data, with data states |
| **Responsive** | Mobile breakpoints for key flows |

### Page Groupings (75 total)

- **Public pages**: Landing, Blog, Changelog, Privacy, Terms (5 pages)
- **Auth pages**: Sign-in, Sign-up (2 pages)
- **Dashboard core**: Dashboard, Properties, Transactions, Banking, Export (5 pages)
- **Property detail**: Property view, Edit, Documents, Compliance, Tasks, Emails (6+ pages)
- **Reports**: Tax, CGT, Portfolio, Scenarios, Compliance, etc. (10+ pages)
- **Settings**: Billing, Team, Integrations, Notifications, etc. (10+ pages)
- **Other**: Entities, Loans, Alerts, etc. (15+ pages)

## Demo Account & Seed Data

### Credentials

```
Email: demo@propertytracker.test
Password: Demo123!Property
Clerk ID: demo_user_permanent_001
Plan: Pro ($14/mo)
```

### Properties (6 total)

1. **Fully populated** - 123 Investment Ave, Sydney NSW 2000 - bank, 100+ transactions, documents, tenant, tasks
2. **Recently purchased** - 45 New St, Melbourne VIC 3000 - minimal data, "getting started" states
3. **Renovating** - 78 Reno Rd, Brisbane QLD 4000 - deductible expenses, no income
4. **Empty lot** - 99 Land St, Perth WA 6000 - land-only tax treatment
5. **Sold property** - 55 Old St, Adelaide SA 5000 - CGT calculation, historical data
6. **Problem property** - 12 Issue Lane, Hobart TAS 7000 - overdue tasks, compliance warnings

### Bank Accounts (4)

- ✅ Connected & synced - Primary offset account
- ✅ Connected & synced - Investment loan account
- ⚠️ **Disconnected** - Old savings (needs reconnection)
- ❌ **Failed sync** - Credit card (shows error state)

### Transactions (150+)

- Mix of categorized (70%) / uncategorized (30%)
- All ATO categories represented
- **Very long descriptions** (200+ chars) - tests text truncation
- **Large amounts** ($999,999.99) - tests formatting
- **Future dated** - tests date validation display
- Bulk uncategorized to test review flow

### Error/Warning States

- Disconnected bank needing reconnection
- Failed sync with error message
- Stale data warning (last sync > 7 days ago)

### Time-based States

- Overdue tasks (3 past due)
- Upcoming compliance deadlines (smoke alarm check due in 3 days)
- Property anniversary (1 year ownership)

### Boundary Cases

- Property with maximum allowed documents (test upload limits)
- Transaction list at 1000+ items (test pagination/performance)
- Entity with long name (50+ chars)
- Very long property address

### Additional Data

- Loans with refinance comparison
- Entity (Trust) with beneficiaries
- Completed + pending tasks
- Support ticket (open)
- Referral code generated

## Playwright Test Structure

### File Organization

```
e2e/
├── ui-audit/
│   ├── fixtures/
│   │   └── demo-account.ts      # Demo user auth + seeding
│   │
│   ├── public/
│   │   ├── landing.audit.ts     # Landing page all states
│   │   ├── blog.audit.ts        # Blog list + articles
│   │   ├── changelog.audit.ts   # Changelog entries
│   │   └── legal.audit.ts       # Privacy, Terms
│   │
│   ├── auth/
│   │   └── auth-flows.audit.ts  # Sign-in, Sign-up, errors
│   │
│   ├── dashboard/
│   │   ├── dashboard.audit.ts   # Main dashboard states
│   │   ├── properties.audit.ts  # List, detail, forms
│   │   ├── transactions.audit.ts# List, review, bulk actions
│   │   ├── banking.audit.ts     # Connections, sync states
│   │   └── export.audit.ts      # Export options, downloads
│   │
│   ├── reports/
│   │   └── reports.audit.ts     # All report pages
│   │
│   ├── settings/
│   │   └── settings.audit.ts    # All settings pages
│   │
│   └── components/
│       ├── dialogs.audit.ts     # All dialog types
│       ├── forms.audit.ts       # Form validation states
│       ├── tables.audit.ts      # Table interactions
│       └── loading.audit.ts     # Skeletons, spinners
```

### Test Pattern

```typescript
test.describe("Dashboard Audit", () => {
  test("captures all dashboard states", async ({ demoPage }) => {
    // 1. Navigate to page
    await demoPage.goto("/dashboard");

    // 2. Capture initial state
    await expect(demoPage).toHaveScreenshot("dashboard-loaded.png");

    // 3. Test each interactive element
    // Click all buttons, open all dialogs, trigger all states

    // 4. Capture each state with descriptive names
    await expect(demoPage).toHaveScreenshot("dashboard-dialog-open.png");

    // 5. Log findings to structured output
    auditLog.add({
      page: "/dashboard",
      element: "Add Property button",
      state: "hover",
      issue: "No hover feedback",
      severity: "minor"
    });
  });
});
```

### Screenshot Naming Convention

```
{page}-{element}-{state}.png

Examples:
- dashboard-loaded.png
- dashboard-stats-loading.png
- properties-list-empty.png
- properties-form-validation-error.png
```

## Written Report Format

Location: `docs/ui-ux-audit-report.md`

### Structure

```markdown
# PropertyTracker UI/UX Audit Report

**Generated:** [date]
**Pages Audited:** 75
**Total Findings:** [X]

## Executive Summary

- Critical issues: [X]
- Major issues: [X]
- Minor issues: [X]
- Suggestions: [X]

## Findings by Severity

### Critical (Blocks user flow)
### Major (Degrades experience)
### Minor (Polish/consistency)
### Suggestions (Nice to have)

## Findings by Page
## Findings by Category
## Screenshots Gallery
## Recommendations
```

### Severity Definitions

| Severity | Definition | Example |
|----------|------------|---------|
| **Critical** | Blocks user from completing task | Form submit does nothing |
| **Major** | Significantly degrades experience | No loading indicator on slow operation |
| **Minor** | Polish/consistency issue | Slightly misaligned text |
| **Suggestion** | Enhancement opportunity | Could add keyboard shortcut |

## Execution

### Running the Audit

```bash
# Run full UI audit
npm run test:ui-audit

# Run specific page group
npm run test:ui-audit -- --grep "Dashboard"

# Generate report from existing audit data
npm run ui-audit:report
```

### Output Files

```
e2e/ui-audit/
├── results/
│   ├── audit-log.json           # Structured findings
│   └── screenshots/             # All captured images
│
docs/
└── ui-ux-audit-report.md        # Generated report
```
