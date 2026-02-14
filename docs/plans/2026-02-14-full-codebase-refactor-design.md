# Full Codebase Refactor Design

**Date:** 2026-02-14
**Status:** Approved
**Approach:** Hybrid (Foundation + Reference Domain + Scale)
**Estimated scope:** ~35-42 PRs across ~12-17 sessions

## Objective

Refactor the entire BrickTrack codebase to follow strong software engineering principles without changing external behaviour. Introduce clear separation of concerns, a repository layer, typed domain errors, and reduce duplication across frontend and backend.

## Hard Constraints

- No behavioural changes (inputs/outputs, response shapes, auth checks, permissions, caching semantics, rate limiting, side effects)
- No over-abstraction. Only introduce abstractions that reduce complexity and increase testability
- Maintain existing public APIs and router/procedure signatures
- Prefer type-safe patterns; no `any`, no weakening strictness
- Every PR must pass lint, build, type-check, and all existing tests

## Current State Assessment

### Server Layer
- **57 tRPC routers** (largest: banking 778L, transaction 753L, email 590L)
- **63 service files** (~8,553 lines) — good separation exists but inconsistent
- **92 DB tables** in a single 3,415-line `schema.ts`
- No repository layer — Drizzle queries are mixed between routers and services
- Domain errors thrown as `TRPCError` directly in services (leaks transport concerns)

### Frontend Layer
- **213 components**, **103 pages** (largest: banking/page 666L, TransactionTable 568L)
- **19 modal/dialog forms** with near-identical boilerplate
- Duplicated validation schemas (amount, postcode, suburb regex in 5+ files)
- Duplicated formatting utilities (formatCurrency defined in multiple files)
- Manual Date serialization types repeated across ~15 components
- Pages with 8-11 tRPC hooks inline (banking, transactions, properties)

---

## Target Architecture

```
src/
├── server/
│   ├── db/
│   │   ├── schema/                  # Split by domain (Wave 1)
│   │   │   ├── index.ts             # Barrel re-export
│   │   │   ├── enums.ts
│   │   │   ├── auth.ts
│   │   │   ├── properties.ts
│   │   │   ├── banking.ts
│   │   │   ├── loans.ts
│   │   │   ├── recurring.ts
│   │   │   ├── compliance.ts
│   │   │   ├── documents.ts
│   │   │   ├── scenarios.ts
│   │   │   ├── communication.ts
│   │   │   ├── features.ts
│   │   │   ├── entities.ts
│   │   │   ├── portfolio.ts
│   │   │   ├── property-manager.ts
│   │   │   └── chat.ts
│   │   └── index.ts                 # Drizzle client (unchanged)
│   ├── repositories/                # Data access layer (Wave 2)
│   │   ├── base.ts                  # Base types and DB type alias
│   │   ├── property.repository.ts
│   │   ├── transaction.repository.ts
│   │   ├── bank-account.repository.ts
│   │   ├── loan.repository.ts
│   │   ├── recurring.repository.ts
│   │   ├── document.repository.ts
│   │   ├── compliance.repository.ts
│   │   ├── tax.repository.ts
│   │   ├── email.repository.ts
│   │   ├── portfolio.repository.ts
│   │   ├── chat.repository.ts
│   │   └── scenario.repository.ts
│   ├── services/                    # Business logic (restructured Waves 3-4)
│   │   ├── banking/
│   │   │   ├── bank-account.service.ts
│   │   │   ├── basiq.service.ts
│   │   │   └── connection-alert.service.ts
│   │   ├── transaction/
│   │   │   ├── transaction.service.ts
│   │   │   ├── categorization.service.ts
│   │   │   └── csv-import.service.ts
│   │   ├── property/
│   │   ├── email/
│   │   ├── compliance/
│   │   ├── tax/
│   │   ├── document/
│   │   ├── loan/
│   │   ├── chat/
│   │   ├── portfolio/
│   │   ├── scenario/
│   │   └── recurring/
│   ├── errors/                      # Typed domain errors (Wave 0)
│   │   ├── index.ts
│   │   └── domain-errors.ts
│   ├── integrations/                # External client interfaces (Wave 7)
│   │   ├── ai-client.ts
│   │   ├── basiq-client.ts
│   │   ├── gmail-client.ts
│   │   ├── stripe-client.ts
│   │   └── storage-client.ts
│   ├── routers/                     # Thin orchestration (Waves 3-4)
│   └── middleware/                   # Unchanged
├── lib/
│   ├── validation/                  # Shared Zod schemas (Wave 0)
│   │   ├── index.ts
│   │   ├── common.ts
│   │   ├── property.ts
│   │   └── transaction.ts
│   └── format/                      # Consolidated utilities (Wave 0)
│       ├── index.ts
│       ├── currency.ts
│       └── date.ts
├── components/
│   ├── ui/
│   │   └── mutation-dialog.tsx      # Base dialog pattern (Wave 5)
│   └── [feature]/                   # Split components (Wave 6)
└── app/                             # Split pages (Wave 6)
```

---

## Wave Plan

### Wave 0: Shared Infrastructure (3 PRs, ~1 session)

**PR 0.1 — Shared Validation Schemas**
- Create `src/lib/validation/common.ts`: amount, postcode, suburb, email, phone, ABN patterns
- Create `src/lib/validation/property.ts`: property create/edit schemas (shared server+client)
- Create `src/lib/validation/transaction.ts`: transaction schemas
- Update 11+ form files to import from here

**PR 0.2 — Utility Consolidation**
- Create `src/lib/format/currency.ts`: formatCurrency, formatCompactCurrency, parseCurrencyInput
- Create `src/lib/format/date.ts`: date serialization helpers (toSerializable, fromSerialized)
- Remove duplicated formatCurrency from banking/page.tsx and other components
- Eliminate repeated `Omit<T, 'createdAt'> & { createdAt: Date | string }` types

**PR 0.3 — Typed Domain Errors**
- Create `src/server/errors/domain-errors.ts`
- Base class: `DomainError` with `code`, `message`, `cause`
- Subclasses: `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `ExternalServiceError`
- Mapper: `domainErrorToTrpcError()` for consistent error translation in routers

### Wave 1: Schema Split (2 PRs, ~1 session)

**PR 1.1 — Split schema.ts into domain modules**
- Create `src/server/db/schema/` directory with 15 domain files + barrel index
- `index.ts` re-exports everything for backwards compatibility (zero import changes)
- Domain files: auth, properties, banking, loans, recurring, compliance, documents, scenarios, communication, features, entities, portfolio, property-manager, chat, enums

**PR 1.2 — Co-locate relations**
- Move relation definitions into their respective domain schema files
- Each module exports tables + relations together

### Wave 2: Repository Layer (4 PRs, ~1-2 sessions)

**PR 2.1 — Base repository types**
- Create `src/server/repositories/base.ts`
- Define `DB` type alias, base `Repository` interface
- `db` passed as explicit first parameter (serverless-compatible, testable)

**PR 2.2 — Property repository (reference)**
- Create `property.repository.ts`
- Methods: findById, findByOwner, create, update, delete, findWithLatestValuation, countByOwner

**PR 2.3 — Banking/Transaction repositories**
- Create `bank-account.repository.ts` and `transaction.repository.ts`
- Extract all Drizzle queries from banking.ts and transaction.ts routers

**PR 2.4 — Remaining repositories**
- loan, recurring, document, compliance, tax, email, portfolio, chat, scenario repositories

### Wave 3: Reference Domain — Banking/Transactions (6 PRs, ~2-3 sessions)

**PR 3.1 — Extract repository queries from banking + transaction routers**

**PR 3.2 — Restructure banking services**
- Create `services/banking/` directory
- `bank-account.service.ts`: account lifecycle
- `connection-alert.service.ts`: alert logic
- Keep `basiq.ts` as-is

**PR 3.3 — Restructure transaction services**
- Create `services/transaction/` directory
- `transaction.service.ts`: CRUD, filtering, bulk
- `categorization.service.ts`: Claude integration
- `csv-import.service.ts`: cleaned up

**PR 3.4 — Thin banking router**
- Every procedure body → 1-10 lines
- Input validation → service call → response

**PR 3.5 — Thin transaction router**
- Same pattern

**PR 3.6 — Frontend: banking hooks + component splits**
- Custom hooks: `useBankAccounts()`, `useBankSync()`, `useConnectionAlerts()`
- Split `banking/page.tsx` (666L) → BankAccountList, BankAccountCard, SyncControls, AccountEditor
- Split `TransactionTable.tsx` (568L) → TransactionRow, TransactionFilters, BulkActionBar + useTransactionTable hook

### Wave 4: Remaining Server Domains (8-12 PRs, ~3-4 sessions)

Apply Wave 3 template to each domain:

| Domain | Router(s) | Repository | Service dir | PRs |
|--------|-----------|------------|-------------|-----|
| Property | property.ts, propertyValue.ts | property.repository.ts | services/property/ | 1-2 |
| Email/Gmail | email.ts (590L), emailConnection.ts | email.repository.ts | services/email/ | 1-2 |
| Compliance/Tax | compliance.ts (422L), cgt.ts, taxOptimization.ts, taxPosition.ts | compliance.repository.ts, tax.repository.ts | services/compliance/, services/tax/ | 2 |
| Documents | documents.ts (436L), documentExtraction.ts | document.repository.ts | services/document/ | 1 |
| Recurring | recurring.ts (508L) | recurring.repository.ts | services/recurring/ | 1 |
| Loans | loan.ts, loanComparison.ts, loanPack.ts | loan.repository.ts | services/loan/ | 1 |
| Chat/AI | chat.ts | chat.repository.ts | services/chat/ | 1 |
| Team/Portfolio | team.ts (420L), portfolio.ts, share.ts | portfolio.repository.ts | services/portfolio/ | 1 |
| Scenarios | scenario.ts, forecast.ts | scenario.repository.ts | services/scenario/ | 1 |

**Pattern per domain:**
1. Extract Drizzle queries → repository
2. Restructure services into `services/<domain>/`
3. Thin router — procedures become 1-10 line orchestrators
4. Replace `throw new TRPCError(...)` in services with domain errors
5. Router catches domain errors → maps to tRPC errors

### Wave 5: Frontend Infrastructure (4 PRs, ~1-2 sessions)

**PR 5.1 — MutationDialog base component**
- `src/components/ui/mutation-dialog.tsx`
- Composable: dialog state, form reset on close, mutation error display, loading state
- Opt-in pattern — complex dialogs keep custom implementations

**PR 5.2 — Custom hook extraction for heavy pages**
- `useBankingPage()` (from banking/page.tsx, 11 hooks)
- `useTransactionPage()` (from transactions/page.tsx, 9 hooks)
- `usePropertyDetail(id)` (from properties/[id]/page.tsx, 8 hooks)

**PR 5.3 — Table infrastructure hooks**
- `useColumnVisibility(storageKey, defaultColumns)`
- `useBulkSelection<T>(items)`
- `useTableFilters(filterConfig)`

**PR 5.4 — Date serialization cleanup**
- Verify superjson transformer handles Dates correctly
- Remove all manual serialization types across ~15 components

### Wave 6: Large Component/Page Splits (5-8 PRs, ~2-3 sessions)

Split files over 400 lines by responsibility:

| File | Lines | Split into |
|------|-------|-----------|
| banking/page.tsx | 666 | BankAccountList, BankAccountCard, SyncControls, AccountEditor |
| TaxPositionContent.tsx | 645 | TaxSummaryCards, DeductionBreakdown, TaxActionItems |
| scenarios/new/page.tsx | 619 | ScenarioForm, ScenarioFactorInputs, ScenarioPreview |
| TransactionTable.tsx | 568 | TransactionRow, TransactionFilters, BulkActionBar + hook |
| reconcile/page.tsx | 512 | ReconciliationList, MatchSuggestions, ReconcileActions |
| EnhancedWizard.tsx | 479 | WizardStep, WizardProgress, per-step components |
| MakeRecurringDialog.tsx | 448 | RecurringPatternForm, RecurringPreview, RecurringScheduleConfig |
| DashboardClient.tsx | 461 | Extract widget orchestration hook |
| SetupWizard.tsx | 439 | SetupStep, per-step components |

### Wave 7: Cross-cutting Quality (3 PRs, ~1 session)

**PR 7.1 — Error handling standardization**
- Audit all routers+services for consistent domain error → tRPC error mapping
- External service failures wrapped in ExternalServiceError

**PR 7.2 — Integration abstraction**
- Create interfaces in `src/server/integrations/` for: AIClient, BasiqClient, GmailClient, StripeClient, StorageClient
- Production implementations wrap existing SDKs
- Test implementations return deterministic fixtures

**PR 7.3 — Type safety audit**
- Eliminate all `any` types
- Replace with generics or `unknown` + type guards
- Add explicit return types to tRPC procedure outputs

---

## Behaviour Preservation Checklist

For every PR, verify:
- [ ] All existing tests pass (unit + E2E)
- [ ] tRPC procedure input/output types unchanged
- [ ] Auth checks and permission gates unchanged
- [ ] Rate limiting behaviour unchanged
- [ ] Caching semantics unchanged (React Query staleTime, invalidation patterns)
- [ ] Streaming/abort handling unchanged (AI chat, document extraction)
- [ ] Error codes returned to clients unchanged
- [ ] Side effects unchanged (notifications, emails, Stripe webhooks)
- [ ] No new `any` types introduced
- [ ] Lint + build + type-check pass

## Session Execution Strategy

Each session:
1. Pick the next wave/PR from this plan
2. Create worktree: `git worktree add ~/worktrees/property-tracker/refactor-wave-X-pr-Y`
3. Implement the refactor
4. Run full test suite
5. Create PR targeting `develop`
6. Run code review
7. Merge and clean up worktree

Sessions can stop after any wave. The codebase is always in a better state than before.
