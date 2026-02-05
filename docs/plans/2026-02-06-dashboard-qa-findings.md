# Dashboard QA Findings Report

**Date:** 2026-02-06
**Reviewer:** Claude Code (Automated Code Review + QA)
**Scope:** All 21 dashboard feature areas

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| Major | 18 |
| Minor | ~40 |
| Cosmetic | ~15 |

---

## Critical Issues

### C1. CGT "View Sale Details" links to 404
**Area:** CGT Report
**File:** `src/app/(dashboard)/reports/cgt/page.tsx:123`
**Description:** The "View Sale Details" link points to `/reports/cgt/${property.id}`, but no page exists at that route. Clicking it for any sold property gives a 404.

### C2. Scenarios page crashes on malformed JSON
**Area:** Forecast / Scenarios
**File:** `src/app/(dashboard)/reports/scenarios/page.tsx:167` and `scenarios/[id]/page.tsx:72-77`
**Description:** `JSON.parse(scenario.projection.summaryMetrics)` is called without try-catch. Malformed JSON crashes the entire page.

### C3. Missing `/loans/[id]/edit` route — Edit button 404s
**Area:** Loans
**File:** `src/app/(dashboard)/loans/page.tsx:52`
**Description:** `handleEdit` navigates to `/loans/${id}/edit` but no page exists at that path.

### C4. Missing `/entities/[id]` detail page — Entity cards 404
**Area:** Entities
**File:** `src/app/(dashboard)/entities/page.tsx:96`
**Description:** Entity cards link to `/entities/${entity.id}` but no `entities/[id]/page.tsx` exists.

---

## Major Issues

### M1. Tax Position wizard never auto-triggers
**Area:** Tax Position
**File:** `src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx:121`
**Description:** Checks `profile === null` but Drizzle `findFirst` returns `undefined` when no row exists. The wizard auto-display condition is never met.

### M2. PAYG withheld $0 discarded silently
**Area:** Tax Position
**File:** `TaxPositionContent.tsx:171-173`
**Description:** `parseFloat("0") || undefined` sends `undefined` instead of `0` for a legitimate zero PAYG value.

### M3. Vacancy factor "Add" button non-functional
**Area:** Scenarios
**File:** `src/app/(dashboard)/reports/scenarios/new/page.tsx:212-226`
**Description:** Vacancy section's "Add" button has no `onClick` handler. Vacancy factors can never be added.

### M4. Sell Property DOM query is unreliable
**Area:** Scenarios
**File:** `scenarios/new/page.tsx:417-424`
**Description:** Uses `document.querySelector("[data-state=checked]")` to read Radix Select values — unreliable anti-pattern that likely returns `undefined`.

### M5. MyTax PDF page overflow
**Area:** MyTax Export
**File:** `src/lib/mytax-pdf.ts:140-150`
**Description:** No page overflow protection within property sections. Properties with many line items render off-page.

### M6. RecordSaleDialog preview only updates on blur
**Area:** CGT Report
**File:** `src/components/cgt/RecordSaleDialog.tsx:86-120`
**Description:** Preview not calculated reactively — only on field blur. User gets no feedback before clicking "Record Sale" if they don't tab out first.

### M7. No email inbox → detail navigation
**Area:** Emails
**File:** `src/app/(dashboard)/emails/page.tsx`
**Description:** Email cards only mark as read on click — no link/navigation to `/emails/[id]`. The detail page exists but is unreachable from the inbox UI.

### M8. Silent failure on attachment download
**Area:** Emails
**File:** `emails/[id]/page.tsx:51-53`
**Description:** Download error handler is empty — swallows all errors silently.

### M9. Entity router uses protectedProcedure for mutations
**Area:** Entities
**File:** `src/server/routers/entity.ts:108,159,195`
**Description:** `create`, `update`, `delete` use `protectedProcedure` instead of `writeProcedure`. Users with read-only portfolio access can bypass write checks.

### M10. Division by zero in SMSF compliance
**Area:** Entities
**File:** `entities/[id]/compliance/page.tsx:152`
**Description:** `(completed / total) * 100` produces NaN if `total` is 0. Same risk on pension drawdown progress bars.

### M11. Kanban badge shows unfiltered counts
**Area:** Tasks
**File:** `src/app/(dashboard)/tasks/page.tsx:289-290`
**Description:** Column badge uses global unfiltered count while cards are filtered by priority/property. Misleading when filters active.

### M12. Gmail "Connect" button ignores disabled state
**Area:** Settings — Email Connections
**File:** `settings/email-connections/page.tsx:223-228`
**Description:** `Button asChild` with `disabled` wrapping an `<a>` tag — the anchor is always clickable regardless of disabled prop.

### M13. "Add Sender" button non-functional
**Area:** Settings — Email Connections
**File:** `settings/email-connections/page.tsx:246-249`
**Description:** Button has no onClick, dialog, or link. Users told to add senders but UI provides no way to do so.

### M14. Export uses alert() for errors
**Area:** Export
**File:** `src/app/(dashboard)/export/page.tsx:68-69`
**Description:** Uses browser `alert()` instead of toast, inconsistent with rest of app.

### M15. AI Chat has no error handling
**Area:** AI Chat
**File:** `src/components/chat/ChatPanel.tsx`
**Description:** `useChat` hook used without `onError` callback. Failed API calls produce no user feedback.

### M16. 4 settings pages missing from sidebar navigation
**Area:** Sidebar
**File:** `src/components/layout/Sidebar.tsx:73-84`
**Description:** `/settings/billing`, `/settings/integrations`, `/settings/advisors`, `/settings/referrals` have no sidebar entries. Only reachable via direct URL.

### M17. Hardcoded 300-month term in loan comparison
**Area:** Loans
**File:** `loans/[id]/compare/page.tsx:36`
**Description:** Always uses 300 months (25 years) for remaining term calculation, regardless of actual loan term.

### M18. LoanCard shows bare comma when no property
**Area:** Loans
**File:** `src/components/loans/LoanCard.tsx:58`
**Description:** `{loan.property?.address}, {loan.property?.suburb}` renders `, ` when property is null.

---

## Minor Issues (Abbreviated)

| Area | Description |
|------|-------------|
| Dashboard | Sequential alert dismissal (N+1 mutations, partial rollback issue) |
| Dashboard | Advisor fallback heuristic fragile when data fetch fails |
| Dashboard | Widgets render below error state (mixed UX) |
| Dashboard | TopPerformerMatchesWidget picks first property, not actual top performer |
| Portfolio | CSV export memory leak (no URL.revokeObjectURL) |
| Portfolio | CSV export doesn't escape commas in addresses |
| Portfolio | Negative equity always shows green text |
| Portfolio | EmptyState uses window.location.href instead of router |
| Properties | Compliance "Last Completed" date uses 30-day months (drift) |
| Properties | Edit success redirects to list instead of detail page |
| Properties | PropertyCard Edit dropdown is a no-op (onEdit never provided) |
| Properties | Various mutations missing onError handlers (emails, tasks, new) |
| Properties | Browser confirm() used for regenerate address |
| Discover | Price filter fires query on every keystroke (no debounce) |
| Discover | No error state for failed query |
| Discover | Discovery cards less detailed than saved listings |
| Tax Position | Hardcoded fallback year 2026 |
| Tax Position | Input placeholder with commas but type="number" |
| Tax Position | formatCurrency duplicated across 4 files |
| Scenarios | Factor config displayed as raw JSON |
| Scenarios | Factor sections read DOM values instead of React state |
| MyTax | Checklist state may not reset on FY switch |
| MyTax | Depreciation shows "(0 txns)" which is confusing |
| Export | Unused date-fns imports |
| Export | CSV address fields not escaped |
| Chat | Tool call results silently dropped in UI |
| Chat | No try-catch on request body parsing |
| Emails | No pagination (limit 50, cursor unused) |
| Emails | Thread grouping can interleave with other threads |
| Tasks | localStorage hydration mismatch risk |
| Tasks | No pagination (limit 100) |
| Entities | No edit/delete for beneficiaries or SMSF members |
| Entities | TFN transmitted unmasked from server |
| Settings | Audit log flashes "no access" during load |
| Settings | Quiet hours fires mutation on every keystroke (no debounce) |
| Sidebar | Active state uses exact match (nested routes don't highlight parent) |
| Sidebar | Support Admin link visible to all users |
| Sidebar | PortfolioSwitcher hidden when collapsed |
| Sidebar | No mobile responsive behavior |

---

## Recommended Priority for Fixes

**Immediate (Critical — user-facing breakage):**
1. C1: Add CGT sale details page or fix link
2. C2: Wrap JSON.parse in try-catch on scenarios pages
3. C3: Create loans edit page or fix navigation
4. C4: Create entity detail page or fix link

**High (Major — functionality gaps):**
1. M1: Fix wizard trigger (undefined vs null)
2. M9: Entity router write access bypass
3. M7: Add email inbox → detail navigation
4. M16: Add missing settings pages to sidebar
5. M3: Fix vacancy factor add button
6. M12-M13: Fix email connections page buttons

**Medium (Major — UX issues):**
1. M2: Handle zero PAYG correctly
2. M5: Fix MyTax PDF page overflow
3. M6: Make CGT preview reactive
4. M11: Fix kanban badge counts
5. M14: Replace alert() with toast
6. M15: Add chat error handling
7. M17-M18: Fix loan display issues
