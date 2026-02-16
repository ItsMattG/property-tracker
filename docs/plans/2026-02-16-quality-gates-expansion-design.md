# Quality Gates & Anti-Patterns Expansion — Design

**Date:** 2026-02-16
**Goal:** Comprehensive expansion of hooks, anti-patterns docs, scoped CLAUDE.md files, and agent memory to catch more bugs, improve AI-generated code quality, and harden production.

---

## Section 1: Hook Expansions

### New checks in `check-anti-patterns.sh` (8 additions → total 17)

| # | Check | Regex | Reason |
|---|-------|-------|--------|
| 10 | `getServerSideProps` | `getServerSideProps` | Doesn't exist in App Router |
| 11 | `size={` on Lucide icons | `<[A-Z]\w+.*size=\{` in tsx | Should use Tailwind classes |
| 12 | `import * as` from lucide | `import \* as.*lucide` | Kills tree-shaking |
| 13 | `.nonempty()` on Zod | `\.nonempty()` | Deprecated in Zod v4, use `.min(1)` |
| 14 | `console.log` in non-test files | `console\.log` | Use `logger` from `@/lib/logger` |
| 15 | Sequential awaits (heuristic) | Two `await` on consecutive lines | Should be `Promise.all` if independent |
| 16 | `toast("...", { type:` | `toast\(.*type:` | Use `toast.success/error/warning` directly |
| 17 | Missing `::int` on SQL COUNT | `count\(\*\)` without `::int` | Returns string without cast |

### New hook: `check-env-leaks.sh` (PostToolUse, Edit/Write)

Scans for hardcoded secrets/keys:
- `sk_live_`, `sk_test_`, `pk_live_`, `pk_test_` (Stripe keys)
- `Bearer [a-zA-Z0-9]{20,}` (hardcoded auth tokens)
- `password\s*=\s*["'][^"']+["']` (hardcoded passwords)
- `NEXT_PUBLIC_` values hardcoded instead of `process.env.`

Advisory only (exit 0). Skips `.env*`, `*.test.*`, `*.spec.*` files.

### New hook: `validate-commit-msg.sh` (PreToolUse, Bash)

When command matches `git commit`:
- Extracts commit message
- Validates starts with: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `ci:`, `perf:`, `build:`
- Blocks (exit 2) with message suggesting correct format
- Skips merge commits and `--amend`

---

## Section 2: Anti-Patterns Documentation Additions

### New section: Sentry v10

| DO | DON'T |
|----|-------|
| `Sentry.captureException(error)` for unexpected errors | `console.error` for production error tracking |
| `Sentry.setUser({ id })` in auth context | Log PII (email, name) in Sentry breadcrumbs |
| `Sentry.withScope(scope => { scope.setTag(...) })` for context | Capture expected/handled errors (404, validation) |
| Use `global-error.tsx` for React error boundary reporting | Silent swallowing of errors in catch blocks |

### New section: Structured Logging / Axiom

| DO | DON'T |
|----|-------|
| `logger.info("message", { context })` from `@/lib/logger` | `console.log` in server code |
| `logger.error("message", error, { context })` | `console.error(error)` without structured context |
| `logger.child({ domain: "banking" })` for domain-scoped logs | Create custom logger instances |
| Include `requestId`, `userId` in log context | Log sensitive data (passwords, tokens, card numbers) |

### New section: Upstash Rate Limiting

| DO | DON'T |
|----|-------|
| Use middleware from `src/server/middleware/rate-limit.ts` | Build custom rate limiting |
| Apply to public/expensive endpoints (AI, bulk exports, auth) | Rate limit every tRPC procedure (overhead) |
| Return `TOO_MANY_REQUESTS` with `Retry-After` | Silently drop rate-limited requests |
| Sliding window algorithm | Fixed window (burst-prone) |

### New section: Error Boundaries

| DO | DON'T |
|----|-------|
| Wrap route segments with `error.tsx` | Let all errors bubble to global handler |
| Show "retry" action in error UI | Show raw error messages to users |
| Report to Sentry in error boundary | Swallow errors silently |
| `<ErrorBoundary>` component for client-side granular recovery | Single global error boundary only |

### New section: Security Patterns

| DO | DON'T |
|----|-------|
| Always scope queries by `ctx.portfolio.ownerId` | Trust client-sent user IDs |
| `stripe.webhooks.constructEvent()` for webhook verification | Process unverified webhook payloads |
| Validate file uploads server-side (type, size, extension) | Trust client-side validation alone |
| `writeProcedure` for mutations | `protectedProcedure` for state-changing ops without `canWrite` check |
| Sanitize AI-generated content before rendering | `dangerouslySetInnerHTML` with unsanitized content |

---

## Section 3: Scoped CLAUDE.md Additions

### `src/server/CLAUDE.md` — New "Observability" section

Covers: logger usage, Sentry patterns, rate limiting middleware. See Section 2 for the DO/DON'T tables — this section provides the "how to use" guidance:
- `logger` import and method reference (debug/info/warn/error/child)
- `setLogContext` in tRPC middleware auto-sets requestId/userId
- Sentry auto-capture via global-error.tsx + tRPC error formatter
- Rate limit middleware import and application pattern

### `src/server/CLAUDE.md` — New "Unit Testing Conventions" section

- Test file location: `src/server/repositories/__tests__/property.test.ts`
- Mock UoW: `createMockUow()` from `@/server/test-utils`
- Mock structure: `vi.mocked(uow.propertyRepo.findById).mockResolvedValue(mockProperty)`
- Test naming: describe behavior, not implementation
- Arrange-Act-Assert with blank line separation
- What to test: repos (query building, filtering), routers (auth, validation, business logic), services (transformation, errors)
- What NOT to test: Drizzle internals, third-party libs, simple pass-throughs

### `src/components/CLAUDE.md` — New "Accessibility" section

| DO | DON'T |
|----|-------|
| Semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`) | `<div onClick>` for interactive elements |
| `aria-label` on icon-only buttons | Rely on visual-only context |
| `aria-live="polite"` for async status updates | Custom notification without aria-live |
| Keyboard-navigable: all interactive elements focusable | Skip/tab-index hacks |
| `sr-only` class for screen-reader-only text | `display: none` for announced content |
| Test with `test:a11y` script before merge | Assume Radix handles everything |

### `src/lib/CLAUDE.md` — New "Logging" section

Logger method reference table (debug/info/warn/error/child) with "when to use" guidance. Note that all logs auto-ship to Axiom in production.

### Root `CLAUDE.md` — New "Commit Conventions" section

Format: `<type>: <description>` (lowercase, imperative mood, no period)

Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`, `perf`, `ci`, `build`

### Root `CLAUDE.md` — New "Security Principles" section

| Rule | Enforcement |
|------|-------------|
| All mutations require `writeProcedure` or higher | Code review |
| All queries scoped by `ctx.portfolio.ownerId` | Anti-pattern hook + review |
| Webhook payloads verified cryptographically | Stripe: `constructEvent()` |
| File uploads validated server-side | Supabase signed URLs |
| No secrets in code | `check-env-leaks.sh` hook |
| AI content sanitized before render | Code review |
| Rate limiting on public/expensive endpoints | Upstash middleware |

---

## Section 4: Agent Memory Improvements

### `code-reviewer/MEMORY.md` — Pre-populate

**Common Patterns Found:**
- console.log in server code (should use logger)
- Missing error boundaries on route segments
- Sequential awaits for independent queries
- Hardcoded colors instead of CSS variables
- Missing aria-label on icon-only buttons
- toast.error(error.message) instead of toast.error(getErrorMessage(error))

**Manual Review Checklist (can't be regex-matched):**
1. New files: appropriate "use client" directive?
2. New mutations: uses writeProcedure (not protectedProcedure)?
3. New queries: scoped by ctx.portfolio.ownerId?
4. New components: keyboard-navigable, semantic HTML?
5. New API routes: rate-limited if public/expensive?
6. Error handling: uses getErrorMessage, not raw .message?
7. Logging: uses logger, not console.log?
8. Sequential awaits: independent queries should use Promise.all?
9. Insert/update: uses .returning() if return value needed?
10. Bulk operations: uses inArray, not loop?

### `test-writer/MEMORY.md` — Pre-populate

**Learned Preferences:**
- Test behavior over implementation details
- Descriptive test names: "returns null when property not found"
- Nested describe blocks grouped by method/feature
- Always test error/edge cases, not just happy path
- Repositories: test query filters, empty results, null returns
- Routers: test authorization (wrong user = FORBIDDEN), validation (bad input = BAD_REQUEST)

---

## Section 5: E2E Error Monitoring

### Add to `e2e/CLAUDE.md` — Error Monitoring subsection

Every E2E test MUST include page error capture:
```ts
const errors: string[] = [];
page.on("pageerror", (err) => errors.push(err.message));
// ... test body ...
expect(errors).toEqual([]);
```

Catches: uncaught exceptions, unhandled promise rejections, React hydration errors.

---

## Section 6: P2/P3 Items (Future)

| # | Item | Where | Priority |
|---|------|-------|----------|
| 1 | Performance budgets (bundle size, LCP < 2.5s) | Root CLAUDE.md | P2 |
| 2 | Feature flag lifecycle (add → rollout → remove) | `src/config/CLAUDE.md` (new) | P2 |
| 3 | Data seeding guide | Root CLAUDE.md | P2 |
| 4 | CI/CD pipeline docs | `.github/CLAUDE.md` (new) | P2 |
| 5 | Repository registry table (all 23 repos) | `src/server/CLAUDE.md` | P2 |
| 6 | Migration guide for deprecated patterns | `anti-patterns.md` | P3 |
| 7 | i18n strategy | `src/lib/CLAUDE.md` | P3 |
| 8 | API deprecation strategy | `src/server/CLAUDE.md` | P3 |
| 9 | Mobile/responsive breakpoint guide | `src/components/CLAUDE.md` | P3 |

These are deferred — implement when they become pain points.

---

## Approach

All changes are documentation and shell scripts — no app code changes. Implement P0 + P1 in a single PR.

**Files to create:**
- `.claude/hooks/check-env-leaks.sh`
- `.claude/hooks/validate-commit-msg.sh`

**Files to modify:**
- `.claude/hooks/check-anti-patterns.sh` (add 8 checks)
- `.claude/settings.json` (register new hooks)
- `.claude/rules/anti-patterns.md` (add 5 sections)
- `src/server/CLAUDE.md` (add Observability + Unit Testing)
- `src/components/CLAUDE.md` (add Accessibility)
- `src/lib/CLAUDE.md` (add Logging)
- `CLAUDE.md` (add Commit Conventions + Security Principles)
- `e2e/CLAUDE.md` (add Error Monitoring)
- `.claude/agent-memory/code-reviewer/MEMORY.md` (pre-populate)
- `.claude/agent-memory/test-writer/MEMORY.md` (pre-populate)
