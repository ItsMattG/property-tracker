# Wave Anti-Pattern Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix every CLAUDE.md anti-pattern violation in files changed by wave PRs #230–#239, then add lint rules to prevent regression.

**Architecture:** Category-by-category fixes (one commit each) across repositories, interfaces, and routers. ESLint `no-restricted-syntax` rules added last.

**Tech Stack:** TypeScript 5 strict, Drizzle ORM, tRPC v11, ESLint

**Design doc:** `docs/plans/2026-02-15-wave-anti-pattern-audit-design.md`

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

### Task 1: Fix count(*) in categorization.ts

**Files:**
- Modify: `src/server/routers/categorization.ts:287`

**Step 1: Fix the cast**

In `categorization.ts`, find line ~287:
```typescript
const examples = await ctx.db
  .select({ count: sql<number>`count(*)` })
  .from(categorizationExamples)
```

Replace with:
```typescript
const examples = await ctx.db
  .select({ count: sql<number>`count(*)::int` })
  .from(categorizationExamples)
```

**Step 2: Search for any other uncast count(*) across the codebase**

```bash
grep -rn "count(\*)" src/server/ --include="*.ts" | grep -v "::int"
```

Fix any additional findings the same way.

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add -A && git commit -m "fix: add ::int cast to all count(*) aggregations

Drizzle count(*) returns string without explicit cast.
CLAUDE.md rule: always use sql<number>\`count(*)::int\`"
```

---

## Category 2: `Record<string, unknown>` → `Partial<SchemaType>`

**Rule:** Use `Partial<SchemaType>` for type-safe updates — never `Record<string, unknown>`.

### Task 2: Fix interfaces (5 files)

**Files:**
- Modify: `src/server/repositories/interfaces/compliance.repository.interface.ts:18`
- Modify: `src/server/repositories/interfaces/email.repository.interface.ts:43`
- Modify: `src/server/repositories/interfaces/property.repository.interface.ts:15`
- Modify: `src/server/repositories/interfaces/recurring.repository.interface.ts:36`
- Modify: `src/server/repositories/interfaces/scenario.repository.interface.ts:23`

**Step 1: Fix each interface**

Each interface already imports its schema type. Replace `Record<string, unknown>` with `Partial<SchemaType>` in the update method signature:

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

Expected: 0 errors. The repository implementations accept `Record<string, unknown>` in their `.set()` calls, so `Partial<T>` (which is more specific) will still work because Drizzle's `.set()` accepts partial table types.

### Task 3: Fix repository implementations (5 files)

**Files:**
- Modify: `src/server/repositories/compliance.repository.ts:65`
- Modify: `src/server/repositories/email.repository.ts:193`
- Modify: `src/server/repositories/property.repository.ts:42`
- Modify: `src/server/repositories/recurring.repository.ts:83`
- Modify: `src/server/repositories/scenario.repository.ts:62`

**Step 1: Update each implementation to match interface**

Same pattern — replace `Record<string, unknown>` with `Partial<SchemaType>` in parameter type. The implementations already import their schema types.

**compliance.repository.ts:**
```typescript
// Before:
async update(id: string, userId: string, data: Record<string, unknown>, tx?: DB)
// After:
async update(id: string, userId: string, data: Partial<ComplianceRecord>, tx?: DB)
```

**email.repository.ts:**
```typescript
// Before:
async updateEmail(id: number, userId: string, data: Record<string, unknown>, tx?: DB)
// After:
async updateEmail(id: number, userId: string, data: Partial<PropertyEmail>, tx?: DB)
```

**property.repository.ts:**
```typescript
// Before:
async update(id: string, userId: string, data: Record<string, unknown>, tx?: DB)
// After:
async update(id: string, userId: string, data: Partial<Property>, tx?: DB)
```

**recurring.repository.ts:**
```typescript
// Before:
async update(id: string, userId: string, data: Record<string, unknown>, tx?: DB)
// After:
async update(id: string, userId: string, data: Partial<RecurringTransaction>, tx?: DB)
```

**scenario.repository.ts:**
```typescript
// Before:
async update(id: string, data: Record<string, unknown>, tx?: DB)
// After:
async update(id: string, data: Partial<Scenario>, tx?: DB)
```

**Step 2: Fix callers in routers**

Two routers construct `Record<string, unknown>` objects inline:

**scenario.ts** — line ~105:
```typescript
// Before:
const updates: Record<string, unknown> = { updatedAt: new Date() };
// After:
const updates: Partial<Scenario> = { updatedAt: new Date() };
```
Add import at top: `import type { Scenario } from "../db/schema";`

**recurring.ts** — line ~121:
```typescript
// Before:
const updateData: Record<string, unknown> = { updatedAt: new Date() };
// After:
const updateData: Partial<RecurringTransaction> = { updatedAt: new Date() };
```
Verify `RecurringTransaction` is already imported or add: `import type { RecurringTransaction } from "../db/schema";`

**Step 3: Verify**

```bash
npx tsc --noEmit
```

If type errors appear, they indicate the update objects contain fields not in the schema type — fix by aligning field names.

**Step 4: Commit**

```bash
git add -A && git commit -m "fix: replace Record<string, unknown> with Partial<SchemaType> in repos

5 interfaces + 5 implementations + 2 router callers updated.
CLAUDE.md rule: type-safe updates, never Record<string, unknown>"
```

---

## Category 3: `Promise<unknown>` and weak `unknown` types

**Rule:** No `unknown` in interface method signatures or return types.

### Task 4: Fix chat repository types

**Files:**
- Modify: `src/server/repositories/interfaces/chat.repository.interface.ts:22-23,43-44,46`
- Modify: `src/server/repositories/chat.repository.ts:57-60`

**Step 1: Determine correct types**

Read `src/server/db/schema/chat.ts` to find the `chatMessages` table definition and its column types for `toolCalls` and `toolResults`. These are likely `json` or `jsonb` columns.

The return type of `addMessage` should be the inferred select type from `chatMessages`.

**Step 2: Fix interface**

```typescript
// chat.repository.interface.ts
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
// After — use ChatMessage from schema:
): Promise<ChatMessage>;
```

Add to imports: `ChatMessage` from `../../db/schema`.

**Note:** If `toolCalls`/`toolResults` have a more specific JSON shape, use that. Otherwise `Record<string, unknown>[] | null` is the minimum improvement over bare `unknown`.

**Step 3: Fix implementation**

```typescript
// chat.repository.ts — update addMessage signature to match interface
// Before:
toolCalls?: unknown,
toolResults?: unknown,
// ...
): Promise<unknown> {
// After:
toolCalls?: Record<string, unknown>[] | null,
toolResults?: Record<string, unknown>[] | null,
// ...
): Promise<ChatMessage> {
```

Add `ChatMessage` import from `../db/schema`.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

### Task 5: Fix bank-account interface

**Files:**
- Modify: `src/server/repositories/interfaces/bank-account.repository.interface.ts:6`

**Step 1: Fix type**

```typescript
// Before:
defaultProperty?: unknown;
// After:
defaultProperty?: Property | null;
```

Verify `Property` is imported or add: `import type { Property } from "../../db/schema";`

**Step 2: Verify**

```bash
npx tsc --noEmit
```

### Task 6: Fix scenario interface

**Files:**
- Modify: `src/server/repositories/interfaces/scenario.repository.interface.ts:8`

**Step 1: Fix type**

Read the `scenarios` table in `src/server/db/schema/scenarios.ts` to determine the `snapshot` column type (likely `jsonb`).

```typescript
// Before:
snapshot?: unknown;
// After — use the column's actual type, likely:
snapshot?: Record<string, unknown> | null;
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

### Task 7: Fix user repository

**Files:**
- Modify: `src/server/repositories/user.repository.ts:8,13`
- Modify: `src/server/repositories/interfaces/user.repository.interface.ts` (if it has `any`)

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

Update the interface to match. Remove the `as Promise<any>` cast entirely.

**Step 2: Verify**

```bash
npx tsc --noEmit
```

If callers expect specific fields, may need to narrow types at call sites. Fix any resulting type errors.

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: replace unknown/any types with proper schema types

Chat: toolCalls/toolResults typed, addMessage returns ChatMessage
BankAccount: defaultProperty typed as Property | null
Scenario: snapshot typed as Record
User: findById returns Partial<User> instead of any"
```

---

## Category 4: Sequential awaits for independent queries

**Rule:** Use `Promise.all()` for parallel independent queries.

### Task 8: Fix email.ts sequential awaits

**Files:**
- Modify: `src/server/routers/email.ts`

**Step 1: Identify sequential patterns**

In `acceptMatch` and `rejectMatch` procedures (~lines 203-222, 230-245), there are sequential queries that fetch a match and then verify email ownership. These are independent and can run in parallel.

```typescript
// Before (acceptMatch ~lines 203-218):
const [match] = await ctx.db
  .select({ ... })
  .from(propertyEmailInvoiceMatches)
  .where(eq(propertyEmailInvoiceMatches.id, input.matchId));

const [email] = await ctx.db
  .select({ userId: propertyEmails.userId })
  .from(propertyEmails)
  .where(eq(propertyEmails.id, match.emailId));

// After:
const [[match], [email]] = await Promise.all([
  ctx.db
    .select({ ... })
    .from(propertyEmailInvoiceMatches)
    .where(eq(propertyEmailInvoiceMatches.id, input.matchId)),
  // Note: we need match.emailId for the second query, so these are NOT independent
]);
```

**Important:** If the second query depends on the first (needs `match.emailId`), they CANNOT be parallelized. Read the code carefully before changing. Only parallelize truly independent queries.

**Step 2: Verify**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add -A && git commit -m "perf: parallelize independent queries in email router

Use Promise.all() for queries that don't depend on each other.
CLAUDE.md rule: Promise.all() for parallel independent queries"
```

---

## Category 5: Remaining direct `ctx.db` calls that should use `ctx.uow`

**Rule:** Use repository methods for all DB operations. Only keep `ctx.db` for cross-domain queries documented with a comment.

### Task 9: Audit and migrate email.ts ctx.db calls

**Files:**
- Modify: `src/server/routers/email.ts`
- Possibly modify: `src/server/repositories/interfaces/email.repository.interface.ts`
- Possibly modify: `src/server/repositories/email.repository.ts`

**Step 1: Read email.ts end-to-end**

Identify all `ctx.db` calls. For each one, determine:
1. Can it be replaced by an existing `ctx.uow.email.*` method?
2. Does a new method need to be added to IEmailRepository?
3. Is it a cross-domain query that should stay inline (with a comment)?

Known instances (approximate lines):
- Line ~98: select from propertyEmails → should use existing repo method
- Line ~179: select from propertyEmailSenders → may need new repo method
- Line ~203-218: select from propertyEmailInvoiceMatches + propertyEmails
- Line ~230-245: same pattern for rejectMatch
- Line ~272: select from propertyEmails for ownership check
- Line ~328: select from propertyEmails for ownership check

**Step 2: Add missing repo methods if needed**

If the email repository doesn't have methods for sender lookup or match lookup, add them.

**Step 3: Migrate calls**

Replace each `ctx.db` call with the appropriate `ctx.uow.email.*` call.

**Step 4: Clean up imports**

Remove unused schema table imports and drizzle-orm imports from email.ts.

**Step 5: Verify**

```bash
npx tsc --noEmit
```

### Task 10: Audit and migrate documents.ts ctx.db calls

**Files:**
- Modify: `src/server/routers/documents.ts`

**Step 1: Identify ctx.db calls**

Known instances:
- Line ~48: `ctx.db.query.transactions.findFirst` → use `ctx.uow.transactions.findById()`
- Line ~125: same pattern → use `ctx.uow.transactions.findById()`
- Line ~177: `db.query.properties.findMany` inside background closure — this is in an async fire-and-forget with its own `db` reference. Mark with a comment explaining why it can't use UoW.

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

Remove `transactions` from schema imports and `eq, and` from drizzle-orm imports if no longer needed.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: migrate remaining ctx.db calls to ctx.uow repos

email.ts: all queries now use ctx.uow.email.*
documents.ts: transaction lookups use ctx.uow.transactions.*
CLAUDE.md rule: use repository methods for all DB operations"
```

---

## Category 6: ESLint rules to prevent regression

### Task 11: Add no-restricted-syntax rules

**Files:**
- Modify: `eslint.config.mjs` (or `.eslintrc.*` — check which format the project uses)

**Step 1: Determine ESLint config format**

```bash
ls eslint.config.* .eslintrc.* 2>/dev/null
```

**Step 2: Add rules**

Add `no-restricted-syntax` rules for the patterns we fixed:

```javascript
// In the server files override section:
{
  files: ["src/server/**/*.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "TaggedTemplateExpression[tag.property.name='sql'] TemplateLiteral[quasis.0.value.raw=/count\\(\\*\\)(?!::int)/]",
        message: "Use count(*)::int — bare count(*) returns string in Drizzle. See CLAUDE.md."
      },
      {
        selector: "TSTypeReference[typeName.name='Record'][typeParameters.params.0.type='TSStringKeyword'][typeParameters.params.1.type='TSUnknownKeyword']",
        message: "Use Partial<SchemaType> instead of Record<string, unknown>. See CLAUDE.md."
      },
    ],
  },
}
```

**Note:** The `count(*)` AST selector may not work perfectly on tagged template literals. Test it. If AST-based detection is unreliable, create a simple custom rule or just rely on grep in CI.

**Alternative (simpler):** Add a CI script that greps for the patterns:

```bash
# scripts/check-anti-patterns.sh
#!/bin/bash
set -e
echo "Checking for anti-patterns..."

# count(*) without ::int
if grep -rn "count(\*)" src/server/ --include="*.ts" | grep -v "::int" | grep -v "node_modules"; then
  echo "ERROR: Found count(*) without ::int cast"
  exit 1
fi

# Record<string, unknown> in repo/interface files
if grep -rn "Record<string, unknown>" src/server/repositories/ --include="*.ts"; then
  echo "ERROR: Found Record<string, unknown> in repositories"
  exit 1
fi

echo "No anti-patterns found."
```

**Step 3: Verify the rules work**

Temporarily introduce a violation and confirm lint catches it:
```bash
npx eslint src/server/ --max-warnings 0
```

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: add lint rules to catch CLAUDE.md anti-patterns

Prevents count(*) without ::int and Record<string, unknown> in repos.
Automated enforcement of Drizzle best practices."
```

---

## Final Validation

### Task 12: Full validation and PR

**Step 1: Full type check**

```bash
npx tsc --noEmit
```

**Step 2: Lint**

```bash
npx eslint src/server/ --max-warnings 0
```

**Step 3: Build**

```bash
npm run build
```

**Step 4: Run unit tests**

```bash
npm run test:unit
```

**Step 5: Verify no anti-patterns remain**

```bash
# count(*) without ::int
grep -rn "count(\*)" src/server/ --include="*.ts" | grep -v "::int" | grep -v node_modules
# Record<string, unknown> in repos
grep -rn "Record<string, unknown>" src/server/repositories/ --include="*.ts"
# Promise<unknown> in repos
grep -rn "Promise<unknown>" src/server/repositories/ --include="*.ts"
# Promise<any> in repos
grep -rn "Promise<any>" src/server/repositories/ --include="*.ts"
```

All should return empty.

**Step 6: Create PR**

```bash
gh pr create --base develop --title "fix: wave anti-pattern audit — type safety + lint rules" --body "$(cat <<'EOF'
## Summary
- Fix `count(*)` without `::int` cast (returns string without it)
- Replace all `Record<string, unknown>` with `Partial<SchemaType>` in 5 repos + 5 interfaces
- Replace `Promise<unknown>` / `Promise<any>` / bare `unknown` types with proper schema types
- Parallelize independent sequential queries
- Migrate remaining direct `ctx.db` calls to `ctx.uow` repository methods
- Add ESLint/CI rules to prevent regression

## Test plan
- [ ] `tsc --noEmit` passes
- [ ] `eslint src/server/` passes
- [ ] `npm run build` passes
- [ ] Unit tests pass
- [ ] grep for anti-patterns returns empty

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Tech Notes

**Drizzle `Partial<T>` in `.set()`:** Drizzle's `.set()` method accepts any object whose keys are column names and values are the column types. `Partial<T>` (where T is the inferred select type from the table) is compatible because select types have the same key/value shape. If a type error occurs, use `typeof table.$inferInsert` as the partial base instead of the select type.

**`count(*)::int`:** PostgreSQL `count()` returns `bigint`, which the pg driver serializes as a string. The `::int` cast converts it to a 4-byte integer that the driver returns as a JavaScript number. Without the cast, `sql<number>` lies about the runtime type.

**ESLint AST selectors for tagged templates:** The `no-restricted-syntax` rule can match AST nodes, but tagged template literal content lives in `quasis[].value.raw` which has limited regex support in selectors. A grep-based CI check may be more reliable.
