# Wave 4 — Router Subdirectory Organization (Design)

**Date:** 2026-02-15
**Status:** Approved
**Scope:** Reorganize 57 flat router files into 12 domain subdirectories

## Goal

Organize `src/server/routers/` from a flat directory of 57 files into 12 domain subdirectories, matching the service layer structure established in Waves 3.1-3.4.

## Problem

All 57 routers sit in a single flat directory. The service layer (`src/server/services/`) is already organized into 12 domain subdirectories. The mismatch makes navigation harder and obscures domain boundaries.

## Approach

Each domain directory gets:
- Router files moved in (e.g., `routers/property.ts` → `routers/property/property.ts`)
- An `index.ts` barrel with explicit named re-exports (no `export *`)
- Tests move alongside: `routers/__tests__/property.test.ts` → `routers/property/__tests__/property.test.ts`

`_app.ts` imports change from `./property` to `./property` (resolves to barrel). The tRPC path names (`appRouter.property`) stay identical. **Zero client-side changes.**

## Directory Mapping

| Directory | Files | Service Alignment |
|-----------|-------|-------------------|
| `property/` | property, propertyValue, propertyManager, cgt, settlement, rentalYield, similarProperties (7) | `services/property-analysis/`, `services/property-manager/` |
| `banking/` | banking, transaction, categorization, recurring, anomaly, auditChecks (6) | `services/banking/`, `services/transaction/` |
| `lending/` | loan, loanComparison, loanPack, forecast, cashFlowCalendar (5) | `services/lending/` |
| `tax/` | taxPosition, taxForecast, taxOptimization, mytax, yoyComparison (5) | `services/tax/` |
| `analytics/` | stats, benchmarking, performanceBenchmarking, dashboard, reports (5) | `services/analytics/` |
| `compliance/` | compliance, smsfCompliance, trustCompliance, entity (4) | `services/compliance/` |
| `communication/` | email, emailConnection, emailSender, chat, notification (5) | `services/email/`, `services/chat/`, `services/notification/` |
| `portfolio/` | portfolio, team, share, portfolio-helpers (4) | — |
| `documents/` | documents, documentExtraction (2) | — |
| `scenario/` | scenario (1) | `services/scenario/` |
| `user/` | user, mobileAuth, billing, onboarding, milestonePreferences, referral, activity (7) | — |
| `feedback/` | feedback, supportTickets, changelog, blog, task (5) | — |

**Remaining in root:** `_app.ts` (root router registration)

## Anti-Pattern Audit on Move

Per CLAUDE.md: "When moving code, audit it." Each file moved gets a light scan for:
- `Record<string, unknown>` → `Partial<SchemaType>`
- `await import()` → static import
- Sequential `await` → `Promise.all` for independent queries

Full cleanup is deferred to Wave 5.

## Execution Strategy

Each subdirectory is one commit: create directory, move files + tests, create barrel, update `_app.ts` imports. Pure file moves + import path updates — no behavior changes.

## Verification

- `npx tsc --noEmit` after each batch
- `npm run lint` at end
- `npx vitest run` at end
- `npm run build` at end

## Tech Notes (context7)

- **tRPC v11**: Router organization is project-level — tRPC is agnostic about file structure. Barrel re-exports work transparently since `_app.ts` only cares about the exported router object, not the file path.
- **Next.js 16**: No impact — routers are server-side only, not imported by client components.
- **TypeScript**: Path aliases (`@/server/routers/...`) used in test files will need updating if tests import routers directly (most use `createTestCaller` which goes through `_app.ts`).
