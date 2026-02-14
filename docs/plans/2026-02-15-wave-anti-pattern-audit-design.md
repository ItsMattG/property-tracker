# Wave Anti-Pattern Audit — Design

**Goal:** Audit all files changed by wave PRs #230-#239 for CLAUDE.md anti-pattern violations. Fix every instance. Add lint rules to prevent regression.

**Trigger:** During Wave 3.1, a `count(*)` without `::int` cast was copied from pre-existing code rather than following CLAUDE.md. Rule: never perpetuate pre-existing anti-patterns.

## Scope

58 server files changed across waves 0-3.1:

### Repository layer (18 files)
- `repositories/base.ts`
- `repositories/bank-account.repository.ts`
- `repositories/chat.repository.ts`
- `repositories/compliance.repository.ts`
- `repositories/document.repository.ts`
- `repositories/email.repository.ts`
- `repositories/loan.repository.ts`
- `repositories/portfolio.repository.ts`
- `repositories/property.repository.ts`
- `repositories/recurring.repository.ts`
- `repositories/scenario.repository.ts`
- `repositories/transaction.repository.ts`
- `repositories/unit-of-work.ts`
- `repositories/user.repository.ts`
- `repositories/__tests__/property.repository.test.ts`
- `repositories/interfaces/*.ts` (14 interface files)

### Routers (16 files)
- `routers/banking.ts`
- `routers/categorization.ts`
- `routers/chat.ts`
- `routers/compliance.ts`
- `routers/dashboard.ts`
- `routers/documents.ts`
- `routers/email.ts`
- `routers/loan.ts`
- `routers/portfolio.ts`
- `routers/portfolio-helpers.ts`
- `routers/property.ts`
- `routers/recurring.ts`
- `routers/scenario.ts`
- `routers/transaction.ts`
- `routers/user.ts`
- `routers/__tests__/*.ts` (4 test files)

### Services (2 files)
- `services/chat.ts`
- `services/__tests__/chat.test.ts`

### Infrastructure (1 file)
- `trpc.ts`

## Anti-Pattern Categories

### Category 1: `count(*)` without `::int` cast
**Rule:** `sql<number>\`count(*)::int\`` — never `count(*)` alone (returns string)
**Detection:** `grep 'count(\*)' without '::int'`
**Known:** categorization.ts:287, taxOptimization.ts:47, tax-optimization.ts:313

### Category 2: `Record<string, unknown>` in update signatures
**Rule:** Use `Partial<SchemaType>` for type-safe updates
**Detection:** `grep 'Record<string, unknown>'` in repo files
**Known:** 10 instances across 5 repos + 5 interfaces (property, compliance, recurring, scenario, email)

### Category 3: `Promise<unknown>` return types
**Rule:** All repo methods should return typed results
**Detection:** `grep 'Promise<unknown>'`
**Known:** chat.repository.ts addMessage returns `Promise<unknown>`

### Category 4: Sequential awaits for independent queries
**Rule:** Use `Promise.all()` for parallel independent queries
**Detection:** Manual read — consecutive `await` on independent operations

### Category 5: Loops with individual queries
**Rule:** Use `inArray()` for bulk operations
**Detection:** Manual read — `for` loops containing `await` DB calls

### Category 6: Missing `.returning()` on insert/update
**Rule:** Always use `.returning()` — don't do separate select after write
**Detection:** Manual read of all insert/update calls

### Category 7: Missing user scoping
**Rule:** Always filter by `ctx.portfolio.ownerId` or `userId`
**Detection:** Manual read — queries without user filter

### Category 8: Weak types in interfaces
**Rule:** No `unknown` in interface method signatures or return types
**Detection:** `grep 'unknown'` in interface files

## Deliverables

1. **Audit report** — every anti-pattern instance documented with file:line
2. **Fixes** — one commit per anti-pattern category
3. **Lint rules** — ESLint `no-restricted-syntax` rules to catch categories 1-3 going forward
4. **Full validation** — tsc, lint, build, unit tests pass after all fixes

## Approach

1. Create worktree from develop
2. Read every file end-to-end, documenting all anti-pattern instances
3. Fix category by category (one commit each)
4. Add ESLint rules for automated detection
5. Full validation
6. PR to develop
