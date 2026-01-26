# Polish, Performance & Technical Debt Improvements

**Date:** 2026-01-26
**Status:** Approved

## Overview

Comprehensive improvement plan covering security, performance, code quality, and polish based on codebase audit findings.

---

## Phase 1: Security Fixes (CRITICAL → HIGH)

### 1.1 Basiq Webhook Signature Verification (CRITICAL)
**File:** `/src/app/api/webhooks/basiq/route.ts`

**Current state:** The `verifyWebhookSignature` function always returns `true`, accepting all webhook requests without validation.

**Fix approach:**
- Implement HMAC-SHA256 signature verification using Basiq's webhook secret
- Add `BASIQ_WEBHOOK_SECRET` to environment variables
- Reject requests with invalid/missing signatures
- Add rate limiting as defense-in-depth

### 1.2 Cron Route Hardening (HIGH)
**Files:** `/src/app/api/cron/*.ts`

**Current state:** Routes verify `CRON_SECRET` header but lack additional protections.

**Fix approach:**
- Add request timestamp validation (reject requests older than 5 minutes)
- Implement constant-time comparison for token verification
- Add IP allowlisting for Vercel cron IPs (optional)

### 1.3 CSV Import Sanitization (MEDIUM)
**File:** `/src/server/services/csv-import.ts`

**Fix approach:**
- Sanitize CSV content to prevent injection attacks
- Escape formula-triggering characters (`=`, `+`, `-`, `@`)
- Validate and limit field lengths

---

## Phase 2: Performance Optimizations (HIGH → MEDIUM)

### 2.1 Cron Job Query Optimization (HIGH)
**File:** `/src/app/api/cron/generate-expected/route.ts`

**Current state:** Sequential queries in a loop pattern - fetches templates, then queries existing transactions per template, then fetches all pending, then all transactions.

**Fix approach:**
- Batch fetch all existing expected transactions upfront with a single query
- Use `Promise.all` for independent operations
- Batch insert generated expected transactions instead of individual inserts
- Filter in SQL rather than in-memory where possible

### 2.2 Database Index Additions (MEDIUM)
**File:** `/src/server/db/schema.ts`

**Missing indexes for common query patterns:**
- `transactions(userId, date)` - filtering by user + date range
- `properties(userId)` - filtering user properties
- `bankAccounts(basiqConnectionId)` - webhook lookups
- `expectedTransactions(userId, status)` - pending transaction queries

### 2.3 Basiq API Retry Logic (MEDIUM)
**File:** `/src/server/services/basiq.ts`

**Current state:** Token caching exists but no retry/backoff for failed requests.

**Fix approach:**
- Add exponential backoff for transient failures (429, 5xx)
- Implement request deduplication for concurrent calls
- Add circuit breaker pattern for sustained failures

### 2.4 API Response Optimization (MEDIUM)
**File:** `/src/server/services/export.ts`

**Fix approach:**
- Add pagination for large transaction exports
- Stream large responses instead of loading all into memory
- Add `select` clauses to fetch only required fields

---

## Phase 3: Code Quality Improvements (HIGH → MEDIUM)

### 3.1 Type Safety - Remove `as any` (HIGH)
**Primary file:** `/src/app/(dashboard)/transactions/page.tsx` (6 instances)
**Total:** 30 instances across codebase

**Fix approach:**
- Create proper discriminated union types for transaction categories
- Define explicit types for filter objects
- Replace `as any` casts with proper type narrowing or generics
- Add strict type definitions for tRPC procedure inputs/outputs

### 3.2 Remove Console Statements (MEDIUM)
**Count:** 81 instances in production code

**Fix approach:**
- Replace with structured logging using a logger utility
- Create `src/lib/logger.ts` with environment-aware logging
- Keep error logging but remove debug `console.log` calls
- Add ESLint rule to prevent future console statements

### 3.3 Complete TODO Items (HIGH)
**Critical TODOs:**
1. `/src/app/api/cron/sync-banks/route.ts` - Bank sync logic (stub or remove)
2. `/src/app/api/cron/generate-expected/route.ts:169` - Email alert queuing

**Fix approach:**
- Implement email alert queuing using existing notification patterns
- Either implement bank sync or convert to explicit "not implemented" response with roadmap note

### 3.4 Refactor Large Components (MEDIUM)
**Files exceeding 300 lines:**
- `MakeRecurringDialog.tsx` (441 lines)
- `SetupWizard.tsx` (439 lines)
- `OnboardingWizard.tsx` (331 lines)
- `RecordSaleDialog.tsx` (331 lines)

**Fix approach:**
- Extract form sections into sub-components
- Create shared wizard step components
- Move complex logic into custom hooks
- Target: No component file exceeds 250 lines

### 3.5 Standardize Error Handling (MEDIUM)
**Fix approach:**
- Create `AppError` class hierarchy with error codes
- Standardize error responses across API routes
- Add error context for debugging while keeping user messages friendly
- Create error boundary components for React

---

## Phase 4: Polish & UX Improvements (MEDIUM → LOW)

### 4.1 Loading States (MEDIUM)
**Current state:** 195 instances of `isLoading/isPending` but inconsistent skeleton/spinner usage.

**Fix approach:**
- Create reusable skeleton components: `TransactionSkeleton`, `PropertyCardSkeleton`, `TableSkeleton`
- Add Suspense boundaries with fallbacks for route segments
- Ensure all tRPC mutations disable submit buttons during pending state
- Add timeout indicators for operations exceeding 5 seconds

### 4.2 Accessibility Improvements (MEDIUM)
**Current state:** Only 14 ARIA attributes across 84 interactive components.

**Fix approach:**
- Add `role="dialog"` and `aria-labelledby` to all dialog components
- Add `aria-invalid` and `aria-describedby` to form fields with errors
- Add keyboard navigation to wizard components (step indicators)
- Ensure focus management when dialogs open/close
- Add skip links for main content areas

### 4.3 Error Message Improvements (MEDIUM)
**Current state:** Generic messages like "Unknown error" and "Webhook processing failed".

**Fix approach:**
- Create user-friendly error message mappings
- Add actionable context: "Failed to sync transactions. Check your bank connection in Settings."
- Include error codes for support reference
- Add retry buttons where appropriate

### 4.4 Form Validation Context (LOW)
**Fix approach:**
- Enhance validation messages with specific failure reasons
- For CSV import: specify row/column of parse failures
- For amount fields: show expected format examples
- Add inline validation hints before submission

### 4.5 UI Consistency (LOW)
**Fix approach:**
- Standardize date formatting across components (use single `formatDate` utility)
- Standardize amount formatting (use single `formatCurrency` utility)
- Audit and unify spacing/padding in card components

---

## Implementation Order

| Task | Phase | Priority | Est. Files |
|------|-------|----------|------------|
| Webhook signature verification | 1.1 | CRITICAL | 1 |
| Cron route hardening | 1.2 | HIGH | 3 |
| CSV import sanitization | 1.3 | MEDIUM | 1 |
| Cron query optimization | 2.1 | HIGH | 1 |
| Database indexes | 2.2 | MEDIUM | 1 |
| Basiq retry logic | 2.3 | MEDIUM | 1 |
| API response optimization | 2.4 | MEDIUM | 1 |
| Remove `as any` | 3.1 | HIGH | 5-10 |
| Remove console statements | 3.2 | MEDIUM | 20+ |
| Complete TODOs | 3.3 | HIGH | 2 |
| Refactor large components | 3.4 | MEDIUM | 4 |
| Standardize error handling | 3.5 | MEDIUM | 10+ |
| Loading states | 4.1 | MEDIUM | 10+ |
| Accessibility | 4.2 | MEDIUM | 15+ |
| Error messages | 4.3 | MEDIUM | 10+ |
| Validation context | 4.4 | LOW | 5 |
| UI consistency | 4.5 | LOW | 10+ |

---

## Success Criteria

- [ ] All webhook requests validated with HMAC signature
- [ ] Cron routes protected with timestamp validation
- [ ] Zero `as any` type assertions in codebase
- [ ] Zero `console.log` statements in production code
- [ ] All components under 250 lines
- [ ] All dialogs have proper ARIA attributes
- [ ] All tRPC mutations show loading state
- [ ] All error messages are user-actionable
