# Wave Anti-Pattern Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix every CLAUDE.md anti-pattern violation in files changed by wave PRs #230, #232, #233, #234, #236, #238, #239. Update rules files to prevent regression.

**Architecture:** Category-by-category fixes (one commit each). Update CLAUDE.md/rules last.

**Tech Stack:** TypeScript 5 strict, Drizzle ORM, tRPC v11, ESLint

**Design doc:** `docs/plans/2026-02-15-wave-anti-pattern-audit-design.md`

---

## Scope — Files Changed by Wave PRs Only

**Repositories (PR 233, 234, 236, 238, 239):**
- `src/server/repositories/base.ts`
- `src/server/repositories/bank-account.repository.ts`
- `src/server/repositories/chat.repository.ts`
- `src/server/repositories/compliance.repository.ts`
- `src/server/repositories/document.repository.ts`
- `src/server/repositories/email.repository.ts`
- `src/server/repositories/loan.repository.ts`
- `src/server/repositories/portfolio.repository.ts`
- `src/server/repositories/property.repository.ts`
- `src/server/repositories/recurring.repository.ts`
- `src/server/repositories/scenario.repository.ts`
- `src/server/repositories/transaction.repository.ts`
- `src/server/repositories/unit-of-work.ts`
- `src/server/repositories/user.repository.ts`
- `src/server/repositories/__tests__/property.repository.test.ts`
- `src/server/repositories/interfaces/*.ts` (14 interface files)

**Routers (PR 230, 234, 236, 238, 239):**
- `src/server/routers/banking.ts`
- `src/server/routers/categorization.ts`
- `src/server/routers/cgt.ts`
- `src/server/routers/chat.ts`
- `src/server/routers/compliance.ts`
- `src/server/routers/documents.ts`
- `src/server/routers/email.ts`
- `src/server/routers/loan.ts`
- `src/server/routers/loanComparison.ts`
- `src/server/routers/notification.ts`
- `src/server/routers/portfolio.ts`
- `src/server/routers/property.ts`
- `src/server/routers/propertyValue.ts`
- `src/server/routers/recurring.ts`
- `src/server/routers/scenario.ts`
- `src/server/routers/transaction.ts`
- `src/server/routers/user.ts`
- `src/server/routers/__tests__/property.test.ts`
- `src/server/routers/__tests__/recurring.test.ts`

**Services (PR 230, 238, 239):**
- `src/server/services/chat.ts`
- `src/server/services/__tests__/chat.test.ts`
- `src/server/services/basiq.ts`
- `src/server/services/csv-import.ts`
- `src/server/services/depreciation-extract.ts`
- `src/server/services/document-extraction.ts`
- `src/server/services/gmail-token.ts`
- `src/server/services/loanPack.ts`
- `src/server/services/property-manager/propertyme.ts`
- `src/server/services/recurring.ts`
- `src/server/services/tax-optimization.ts`
- `src/server/services/tax-position.ts`
- `src/server/services/valuation.ts`

**Infrastructure (PR 232, 233):**
- `src/server/trpc.ts`
- `src/server/db/schema/*.ts` (all domain files)
- `src/server/errors/domain-errors.ts`
- `drizzle.config.ts`

**NOT in scope** (not touched by wave PRs):
- `src/server/routers/taxOptimization.ts` — has `count(*)` without `::int` at line 47 but was NOT changed by any wave PR. Leave for future wave.
- `src/server/routers/task.ts`, `smsfCompliance.ts`, `forecast.ts`, `settlement.ts`, `trustCompliance.ts`, `similarProperties.ts` — have `Record<string, unknown>` but were NOT changed by any wave PR.

---

## Setup

### Task 0: Create worktree

**Step 1: Create worktree from develop**

```bash
git worktree add ~/worktrees/property-tracker/anti-pattern-audit -b fix/wave-anti-pattern-audit develop
cp ~/Documents/property-tracker/.env.local ~/worktrees/property-tracker/anti-pattern-audit/.env.local
cd ~/worktrees/property-tracker/anti-pattern-audit
npm install
```

**Step 2: Verify clean baseline**

```bash
npx tsc --noEmit
```

Expected: 0 errors (develop should be clean after PR #239 merge).

---

## Category 1: `count(*)` without `::int` cast

**Rule:** `sql<number>\`count(*)::int\`` — never `count(*)` alone (returns string).

### Task 1: Fix count(*) in wave PR files

**Files:**
- Modify: `src/server/routers/categorization.ts:287` (PR 239)
- Modify: `src/server/services/tax-optimization.ts:313` (PR 230)

**Step 1: Fix categorization.ts line ~287**

```typescript
// Before:
.select({ count: sql<number>`count(*)` })
// After:
.select({ count: sql<number>`count(*)::int` })
```

**Step 2: Fix tax-optimization.ts line ~313**

```typescript
// Before:
.select({ count: sql<number>`count(*)` })
// After:
.select({ count: sql<number>`count(*)::int` })
```

**Step 3: Verify no other uncast count(*) in wave PR files**

```bash
grep -rn "count(\*)" src/server/routers/categorization.ts src/server/services/tax-optimization.ts --include="*.ts" | grep -v "::int"
```

Should return empty.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/server/routers/categorization.ts src/server/services/tax-optimization.ts
git commit -m "fix: add ::int cast to count(*) in categorization + tax-optimization

Drizzle count(*) returns string without explicit cast.
CLAUDE.md rule: always use sql<number>\`count(*)::int\`"
```

---

## Category 2: `Record<string, unknown>` → `Partial<SchemaType>`

**Rule:** Use `Partial<SchemaType>` for type-safe updates — never `Record<string, unknown>`.

### Task 2: Fix interfaces (5 files)

**Files (all from PR 233):**
- Modify: `src/server/repositories/interfaces/compliance.repository.interface.ts:18`
- Modify: `src/server/repositories/interfaces/email.repository.interface.ts:43`
- Modify: `src/server/repositories/interfaces/property.repository.interface.ts:15`
- Modify: `src/server/repositories/interfaces/recurring.repository.interface.ts:36`
- Modify: `src/server/repositories/interfaces/scenario.repository.interface.ts:23`

**Step 1: Fix each interface**

Each interface already imports its schema type. Replace `Record<string, unknown>` with `Partial<SchemaType>`:

**compliance.repository.interface.ts** — line ~18:
```typescript
// Before:
update(id: string, userId: string, data: Record<string, unknown>, tx?: DB): Promise<ComplianceRecord>;
// After:
update(id: string, userId: string, data: Partial<ComplianceRecord>, tx?: DB): Promise<ComplianceRecord>;
```

**email.repository.interface.ts** — line ~43:
```typescript
// Before:
updateEmail(id: number, userId: string, data: Record<string, unknown>, tx?: DB): Promise<void>;
// After:
updateEmail(id: number, userId: string, data: Partial<PropertyEmail>, tx?: DB): Promise<void>;
```

**property.repository.interface.ts** — line ~15:
```typescript
// Before:
update(id: string, userId: string, data: Record<string, unknown>, tx?: DB): Promise<Property | null>;
// After:
update(id: string, userId: string, data: Partial<Property>, tx?: DB): Promise<Property | null>;
```

**recurring.repository.interface.ts** — line ~36:
```typescript
// Before:
update(id: string, userId: string, data: Record<string, unknown>, tx?: DB): Promise<RecurringTransaction>;
// After:
update(id: string, userId: string, data: Partial<RecurringTransaction>, tx?: DB): Promise<RecurringTransaction>;
```

**scenario.repository.interface.ts** — line ~23:
```typescript
// Before:
update(id: string, data: Record<string, unknown>, tx?: DB): Promise<Scenario>;
// After:
update(id: string, data: Partial<Scenario>, tx?: DB): Promise<Scenario>;
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

### Task 3: Fix repository implementations + router callers

**Files (PR 234, 238, 239):**
- Modify: `src/server/repositories/compliance.repository.ts:64`
- Modify: `src/server/repositories/email.repository.ts:193`
- Modify: `src/server/repositories/property.repository.ts:42`
- Modify: `src/server/repositories/recurring.repository.ts:83`
- Modify: `src/server/repositories/scenario.repository.ts:62`

**Router callers (PR 230, 238, 239):**
- Modify: `src/server/routers/scenario.ts:105`
- Modify: `src/server/routers/recurring.ts:121`
- Modify: `src/server/routers/property.ts:185`
- Modify: `src/server/routers/compliance.ts:246`

**Step 1: Fix each repo implementation**

Replace `Record<string, unknown>` with `Partial<SchemaType>` in parameter type (same as interface):

- `compliance.repository.ts`: `data: Partial<ComplianceRecord>`
- `email.repository.ts`: `data: Partial<PropertyEmail>`
- `property.repository.ts`: `data: Partial<Property>`
- `recurring.repository.ts`: `data: Partial<RecurringTransaction>`
- `scenario.repository.ts`: `data: Partial<Scenario>`

**Step 2: Fix router callers**

**scenario.ts** — line ~105:
```typescript
// Before:
const updates: Record<string, unknown> = { updatedAt: new Date() };
// After:
const updates: Partial<Scenario> = { updatedAt: new Date() };
```
Add import: `import type { Scenario } from "../db/schema";`

**recurring.ts** — line ~121:
```typescript
// Before:
const updateData: Record<string, unknown> = { updatedAt: new Date() };
// After:
const updateData: Partial<RecurringTransaction> = { updatedAt: new Date() };
```
Add `RecurringTransaction` to existing schema import if not already there.

**property.ts** — line ~185:
```typescript
// Before:
const updateData: Record<string, unknown> = { ... };
// After:
const updateData: Partial<Property> = { ... };
```
Verify `Property` is imported from `../db/schema`.

**compliance.ts** — line ~246:
```typescript
// Before:
const updates: Record<string, unknown> = { updatedAt: new Date() };
// After:
const updates: Partial<ComplianceRecord> = { updatedAt: new Date() };
```
Add import: `import type { ComplianceRecord } from "../db/schema";`

**Step 3: Verify**

```bash
npx tsc --noEmit
```

If type errors appear, the update objects may contain fields not in the schema type. Fix by using `typeof table.$inferInsert` instead of the select type, or by aligning field names.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: replace Record<string, unknown> with Partial<SchemaType>

5 interfaces + 5 repo implementations + 4 router callers updated.
CLAUDE.md rule: type-safe updates, never Record<string, unknown>"
```

---

## Category 3: `Promise<unknown>`, `Promise<any>`, and weak `unknown` types

**Rule:** No `unknown` or `any` in interface method signatures or return types.

### Task 4: Fix chat repository types (PR 238, 239)

**Files:**
- Modify: `src/server/repositories/interfaces/chat.repository.interface.ts:22-23,43-44,46`
- Modify: `src/server/repositories/chat.repository.ts:57-60`

**Step 1: Determine correct types**

Read `src/server/db/schema/chat.ts` to find the `chatMessages` table definition. Look at `toolCalls` and `toolResults` column types (likely `json` or `jsonb`). Get the inferred select type name (likely `ChatMessage` or use `typeof chatMessages.$inferSelect`).

**Step 2: Fix interface**

```typescript
// chat.repository.interface.ts
// Add to imports:
import type { ChatMessage } from "../../db/schema";

// Before (lines 22-23, inside ConversationWithMessages):
toolCalls: unknown;
toolResults: unknown;
// After:
toolCalls: Record<string, unknown>[] | null;
toolResults: Record<string, unknown>[] | null;

// Before (lines 43-44, addMessage params):
toolCalls?: unknown,
toolResults?: unknown,
// After:
toolCalls?: Record<string, unknown>[] | null,
toolResults?: Record<string, unknown>[] | null,

// Before (line 46, return type):
): Promise<unknown>;
// After:
): Promise<ChatMessage>;
```

**Note:** If `toolCalls`/`toolResults` columns are typed more specifically in schema, use that type. `Record<string, unknown>[] | null` is the minimum improvement over bare `unknown`. Check schema first.

**Step 3: Fix implementation**

```typescript
// chat.repository.ts — match interface signatures
// Add ChatMessage to imports from "../db/schema"
// Update addMessage signature to match interface
```

**Step 4: Verify**

```bash
npx tsc --noEmit
```

### Task 5: Fix bank-account interface (PR 233)

**Files:**
- Modify: `src/server/repositories/interfaces/bank-account.repository.interface.ts:6`

**Step 1: Fix type**

```typescript
// Before:
defaultProperty?: unknown;
// After:
defaultProperty?: Property | null;
```

Add import: `import type { Property } from "../../db/schema";`

**Step 2: Verify**

```bash
npx tsc --noEmit
```

### Task 6: Fix scenario interface (PR 233)

**Files:**
- Modify: `src/server/repositories/interfaces/scenario.repository.interface.ts:8`

**Step 1: Determine correct type**

Read `src/server/db/schema/scenarios.ts` to find the `snapshot` column type.

```typescript
// Before:
snapshot?: unknown;
// After — use the column's actual type:
snapshot?: Record<string, unknown> | null;
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

### Task 7: Fix user repository (PR 238, 239)

**Files:**
- Modify: `src/server/repositories/user.repository.ts:8,13`
- Modify: `src/server/repositories/interfaces/user.repository.interface.ts` (match implementation)

**Step 1: Fix return type**

```typescript
// user.repository.ts
// Before:
async findById(id: string, columns?: Partial<Record<keyof User, true>>): Promise<any> {
  if (columns) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
      columns,
    }) as Promise<any>;
  }
// After:
async findById(id: string, columns?: Partial<Record<keyof User, true>>): Promise<Partial<User> | undefined> {
  if (columns) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
      columns,
    });
  }
```

Remove the `as Promise<any>` cast entirely. Update the interface to match.

**Step 2: Verify**

```bash
npx tsc --noEmit
```

If callers expect specific fields, may need to narrow types at call sites. Fix any resulting type errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: replace unknown/any types with proper schema types

Chat: toolCalls/toolResults typed, addMessage returns ChatMessage
BankAccount: defaultProperty typed as Property | null
Scenario: snapshot typed properly
User: findById returns Partial<User> instead of any"
```

---

## Category 4: Remaining direct `ctx.db` calls that should use `ctx.uow`

**Rule:** Routers that already use `ctx.uow` for some queries should use it consistently. Keep `ctx.db` only for cross-domain queries (with a comment explaining why).

### Task 8: Migrate email.ts ctx.db calls (PR 238, 239)

**Files:**
- Modify: `src/server/routers/email.ts`
- Possibly modify: `src/server/repositories/interfaces/email.repository.interface.ts`
- Possibly modify: `src/server/repositories/email.repository.ts`

**Step 1: Read email.ts end-to-end**

Identify ALL `ctx.db` calls. For each one, determine:
1. Can it use an existing `ctx.uow.email.*` method?
2. Does a new repo method need to be added?
3. Is it a cross-domain query that should stay inline (with a comment)?

Known instances:
- Line ~98: select from propertyEmails
- Line ~179: select from propertyEmailSenders
- Line ~203-218: select from propertyEmailInvoiceMatches + propertyEmails
- Line ~230-245: same pattern for rejectMatch
- Line ~272: select from propertyEmails
- Line ~328: select from propertyEmails

**Step 2: Add missing repo methods if needed**

Add methods to IEmailRepository and EmailRepository for any lookups not already covered.

**Step 3: Migrate calls and clean up imports**

Replace each `ctx.db` call with `ctx.uow.email.*`. Remove unused schema + drizzle-orm imports.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

### Task 9: Migrate documents.ts ctx.db calls (PR 238, 239)

**Files:**
- Modify: `src/server/routers/documents.ts`

**Step 1: Identify ctx.db calls**

- Line ~48: `ctx.db.query.transactions.findFirst` → use `ctx.uow.transactions.findById()`
- Line ~125: same pattern → use `ctx.uow.transactions.findById()`
- Line ~177: `db.query.properties.findMany` inside background closure — add comment explaining this runs outside request context so can't use UoW

**Step 2: Migrate lines ~48 and ~125**

```typescript
// Before:
const transaction = await ctx.db.query.transactions.findFirst({
  where: and(
    eq(transactions.id, transactionId),
    eq(transactions.userId, ctx.portfolio.ownerId)
  ),
});
// After:
const transaction = await ctx.uow.transactions.findById(transactionId, ctx.portfolio.ownerId);
```

**Step 3: Clean up imports**

Remove `transactions` from schema imports and drizzle-orm imports if no longer needed.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: migrate remaining ctx.db calls to ctx.uow in email + documents

email.ts: queries now use ctx.uow.email.*
documents.ts: transaction lookups use ctx.uow.transactions.*"
```

---

## Category 5: Scan remaining PR 230 files for anti-patterns

PR 230 touched many service and router files. These need scanning for the same categories.

### Task 10: Audit and fix PR 230 services + routers

**Files to scan (PR 230 — read each end-to-end):**
- `src/server/services/basiq.ts`
- `src/server/services/csv-import.ts`
- `src/server/services/depreciation-extract.ts`
- `src/server/services/document-extraction.ts`
- `src/server/services/gmail-token.ts`
- `src/server/services/loanPack.ts`
- `src/server/services/property-manager/propertyme.ts`
- `src/server/services/recurring.ts`
- `src/server/services/tax-position.ts`
- `src/server/services/valuation.ts`
- `src/server/routers/cgt.ts`
- `src/server/routers/loanComparison.ts`
- `src/server/routers/notification.ts`
- `src/server/routers/propertyValue.ts`

**Step 1: Read each file, check for:**
- `count(*)` without `::int`
- `Record<string, unknown>`
- `Promise<unknown>` / `Promise<any>` / bare `unknown` types
- Sequential awaits for independent queries (should be `Promise.all`)
- Loops with individual DB queries (should use `inArray`)

**Step 2: Fix any findings**

Apply the same patterns from previous tasks.

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit** (if any changes)

```bash
git add -A
git commit -m "fix: anti-pattern fixes in PR 230 services + routers"
```

---

## Category 6: Update CLAUDE.md and rules files

### Task 11: Strengthen anti-patterns.md

**Files:**
- Modify: `.claude/rules/anti-patterns.md`

**Step 1: Add Repository Layer section**

Add a new section after the Drizzle section:

```markdown
## Repository Layer

| DO | DON'T |
|----|-------|
| `Partial<SchemaType>` for update data params | `Record<string, unknown>` (bypasses type safety) |
| Typed return values (`Promise<User \| null>`) | `Promise<unknown>` or `Promise<any>` |
| Proper relation types (`Property \| null`) | `unknown` for relation fields in interfaces |
| `ctx.uow.repo.method()` in routers | Direct `ctx.db` when a repo method exists |
| Comment explaining why for cross-domain `ctx.db` | Mixing `ctx.uow` and `ctx.db` without explanation |
```

**Step 2: Verify the file is well-formed**

Read the file back, ensure markdown renders correctly.

### Task 12: Update src/server/CLAUDE.md

**Files:**
- Modify: `src/server/CLAUDE.md`

**Step 1: Add Repository Pattern section**

Add after the "Router Template" section:

```markdown
## Repository Pattern

Routers access data via `ctx.uow` (Unit of Work), not `ctx.db` directly.

```typescript
// Good — typed, testable
const property = await ctx.uow.property.findById(id, ctx.portfolio.ownerId);
await ctx.uow.property.update(id, ctx.portfolio.ownerId, { name: input.name });

// Bad — bypasses repository layer
const property = await ctx.db.query.properties.findFirst({ ... });
```

**When `ctx.db` is acceptable:**
- Cross-domain queries touching tables from multiple repositories (add a comment explaining why)
- Background closures where UoW is not available

**Interface rules:**
- Update methods: `data: Partial<SchemaType>` — never `Record<string, unknown>`
- Return types: always typed — never `Promise<unknown>` or `Promise<any>`
- Relation fields: always typed — never `unknown`
```

**Step 2: Update the Key Anti-Patterns table**

Add these rows to the existing table:

```markdown
| `Partial<SchemaType>` for repo updates | `Record<string, unknown>` (not type-safe) |
| `ctx.uow.repo.method()` in routers | `ctx.db` when repo method exists |
| Typed return values on repo methods | `Promise<unknown>` or `Promise<any>` |
```

**Step 3: Update the stale reference**

The CLAUDE.md still references `src/server/db/schema.ts` as "~3300 lines, 80+ tables". After PR 232 split this into domain files. Update to:

```markdown
| `src/server/db/schema/index.ts` | Barrel re-export of domain schema modules |
| `src/server/db/schema/*.ts` | Domain-split schema (auth, banking, properties, etc.) |
```

**Step 4: Commit**

```bash
git add .claude/rules/anti-patterns.md src/server/CLAUDE.md
git commit -m "docs: add repository layer rules to CLAUDE.md and anti-patterns.md

Prevents Record<string, unknown>, Promise<unknown>, bare unknown types,
and undocumented ctx.db usage in routers."
```

---

## Category 7: Lint / CI check for automated enforcement

### Task 13: Add CI anti-pattern check script

**Files:**
- Create: `scripts/check-anti-patterns.sh`

**Step 1: Create the script**

```bash
#!/bin/bash
set -e
echo "Checking for anti-patterns in server code..."
FAIL=0

# count(*) without ::int
if grep -rn 'count(\*)' src/server/ --include="*.ts" | grep -v '::int' | grep -v 'node_modules' | grep -v 'CLAUDE.md'; then
  echo "ERROR: Found count(*) without ::int cast"
  FAIL=1
fi

# Record<string, unknown> in repository files
if grep -rn 'Record<string, unknown>' src/server/repositories/ --include="*.ts"; then
  echo "ERROR: Found Record<string, unknown> in repositories — use Partial<SchemaType>"
  FAIL=1
fi

# Promise<unknown> in repository files
if grep -rn 'Promise<unknown>' src/server/repositories/ --include="*.ts"; then
  echo "ERROR: Found Promise<unknown> in repositories — use proper return types"
  FAIL=1
fi

# Promise<any> in repository files
if grep -rn 'Promise<any>' src/server/repositories/ --include="*.ts"; then
  echo "ERROR: Found Promise<any> in repositories — use proper return types"
  FAIL=1
fi

if [ $FAIL -eq 1 ]; then
  echo "Anti-pattern check FAILED"
  exit 1
fi

echo "No anti-patterns found."
```

**Step 2: Make executable**

```bash
chmod +x scripts/check-anti-patterns.sh
```

**Step 3: Test it**

```bash
./scripts/check-anti-patterns.sh
```

Should pass (all patterns fixed in earlier tasks).

**Step 4: Commit**

```bash
git add scripts/check-anti-patterns.sh
git commit -m "chore: add CI anti-pattern check script

Automated grep checks for count(*) without ::int, Record<string, unknown>,
Promise<unknown>, and Promise<any> in repository files."
```

---

## Final Validation

### Task 14: Full validation and PR

**Step 1: Type check**

```bash
npx tsc --noEmit
```

**Step 2: Lint**

```bash
npx next lint
```

**Step 3: Build**

```bash
npm run build
```

**Step 4: Unit tests**

```bash
npm run test:unit
```

**Step 5: Run anti-pattern check**

```bash
./scripts/check-anti-patterns.sh
```

**Step 6: Verify no anti-patterns remain in wave PR files**

```bash
# count(*) without ::int in wave files
grep -rn "count(\*)" src/server/routers/categorization.ts src/server/services/tax-optimization.ts | grep -v "::int"
# Record<string, unknown> in repos
grep -rn "Record<string, unknown>" src/server/repositories/ --include="*.ts"
# Promise<unknown> / Promise<any> in repos
grep -rn "Promise<unknown>\|Promise<any>" src/server/repositories/ --include="*.ts"
# unknown in interfaces
grep -n "\bunknown\b" src/server/repositories/interfaces/*.ts | grep -v "Record<string, unknown>"
```

All should return empty.

**Step 7: Create PR**

```bash
gh pr create --base develop --title "fix: wave anti-pattern audit — type safety + rules update" --body "$(cat <<'EOF'
## Summary
- Fix `count(*)` without `::int` cast in categorization.ts + tax-optimization.ts
- Replace `Record<string, unknown>` with `Partial<SchemaType>` in 5 repo interfaces, 5 repo implementations, 4 router callers
- Replace `Promise<unknown>` / `Promise<any>` / bare `unknown` types with proper schema types in chat, bank-account, scenario, user repos
- Migrate remaining `ctx.db` calls to `ctx.uow` in email.ts + documents.ts
- Add Repository Layer rules to `.claude/rules/anti-patterns.md` and `src/server/CLAUDE.md`
- Add `scripts/check-anti-patterns.sh` for CI enforcement
- Scan and fix all PR 230 service + router files

Covers files changed by PRs: #230, #232, #233, #234, #236, #238, #239

## Test plan
- [ ] `tsc --noEmit` passes
- [ ] `next lint` passes
- [ ] `npm run build` passes
- [ ] Unit tests pass
- [ ] `./scripts/check-anti-patterns.sh` passes
- [ ] Manual grep for anti-patterns returns empty

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Tech Notes

**Drizzle `Partial<T>` in `.set()`:** Drizzle's `.set()` accepts any object whose keys are column names. `Partial<T>` (where T is the inferred select type) is compatible. If type errors occur, try `Partial<typeof table.$inferInsert>` instead.

**`count(*)::int`:** PostgreSQL `count()` returns `bigint`, serialized as string by the pg driver. The `::int` cast converts it to a JS number. Without the cast, `sql<number>` lies about the runtime type.

**Out-of-scope anti-patterns:** Files not touched by wave PRs (taxOptimization.ts, task.ts, smsfCompliance.ts, forecast.ts, settlement.ts, trustCompliance.ts, similarProperties.ts) still have anti-patterns. These will be fixed when those files are touched by future waves.
