# Wave 2: Repository Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all Drizzle database queries from routers and services into class-based repositories with typed interfaces, coordinated by a Unit of Work injected into the tRPC context.

**Architecture:** 12 domain repositories behind interfaces, a BaseRepository abstract class, and a UnitOfWork that lazily instantiates repositories and manages transaction boundaries. UoW injected into tRPC context as `ctx.uow`.

**Tech Stack:** Drizzle ORM (postgres-js driver), TypeScript, tRPC v11, Vitest

**Design Doc:** `docs/plans/2026-02-14-wave2-repository-layer-design.md`

---

## PR 2.1: Foundation — Base Types, Interfaces, UoW, Context Integration

**Branch:** `feature/refactor-wave2-pr1` from `develop`

### Task 1: Create base repository infrastructure

**Files:**
- Create: `src/server/repositories/base.ts`

**Step 1: Create the base file**

```typescript
// src/server/repositories/base.ts
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";

/** Database client type — works for both main db and transaction tx */
export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Base repository — provides shared infrastructure for all repositories.
 * Subclasses access this.db for queries and this.resolve(tx) for
 * transaction-aware write operations.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: DB) {}

  /** Use the provided transaction or fall back to the default db client */
  protected resolve(tx?: DB): DB {
    return tx ?? this.db;
  }
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/server/repositories/base.ts
git commit -m "feat: add BaseRepository and DB type alias"
```

---

### Task 2: Create repository interface files

**Files:**
- Create: `src/server/repositories/interfaces/index.ts`
- Create: `src/server/repositories/interfaces/property.repository.interface.ts`
- Create: `src/server/repositories/interfaces/bank-account.repository.interface.ts`
- Create: `src/server/repositories/interfaces/transaction.repository.interface.ts`
- Create: `src/server/repositories/interfaces/loan.repository.interface.ts`
- Create: `src/server/repositories/interfaces/recurring.repository.interface.ts`
- Create: `src/server/repositories/interfaces/document.repository.interface.ts`
- Create: `src/server/repositories/interfaces/compliance.repository.interface.ts`
- Create: `src/server/repositories/interfaces/email.repository.interface.ts`
- Create: `src/server/repositories/interfaces/chat.repository.interface.ts`
- Create: `src/server/repositories/interfaces/portfolio.repository.interface.ts`
- Create: `src/server/repositories/interfaces/scenario.repository.interface.ts`
- Create: `src/server/repositories/interfaces/user.repository.interface.ts`

**Step 1: Create all interface files**

Each interface imports domain types from `../../db/schema` and `DB` from `../base`. Each write method accepts optional `tx?: DB` for transaction support.

**Important:** The exact method signatures will be refined when implementing each concrete repository (PRs 2.2-2.4). For now, define the interface contracts based on the query catalog in the design doc. The interfaces capture the **public API** — method names, parameter types, and return types. Drizzle internals (`eq`, `and`, etc.) never appear in interfaces.

When building each interface, **read the corresponding router file(s)** to extract the exact query patterns and return types. Each unique query pattern in a router becomes a method on the interface.

**Naming conventions:**
- `findByOwner(userId)` — list all for a user
- `findById(id, userId)` — single item scoped to user
- `findWith*()` — includes related data (joins)
- `create(data, tx?)` / `update(id, userId, data, tx?)` / `delete(id, userId, tx?)` — mutations
- `get*()` — computed/aggregated data (e.g., `getAggregates`)
- `count*()` — count queries

**Step 2: Create barrel export**

```typescript
// src/server/repositories/interfaces/index.ts
export type { IPropertyRepository } from "./property.repository.interface";
export type { IBankAccountRepository } from "./bank-account.repository.interface";
export type { ITransactionRepository } from "./transaction.repository.interface";
export type { ILoanRepository } from "./loan.repository.interface";
export type { IRecurringRepository } from "./recurring.repository.interface";
export type { IDocumentRepository } from "./document.repository.interface";
export type { IComplianceRepository } from "./compliance.repository.interface";
export type { IEmailRepository } from "./email.repository.interface";
export type { IChatRepository } from "./chat.repository.interface";
export type { IPortfolioRepository } from "./portfolio.repository.interface";
export type { IScenarioRepository } from "./scenario.repository.interface";
export type { IUserRepository } from "./user.repository.interface";
```

**Step 3: Type-check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/server/repositories/interfaces/
git commit -m "feat: add repository interface contracts for all 12 domains"
```

---

### Task 3: Create Unit of Work

**Files:**
- Create: `src/server/repositories/unit-of-work.ts`

**Step 1: Build UoW with lazy repository getters**

The UoW class:
- Takes `DB` in constructor
- Has a lazy getter per repository domain (returns interface type, instantiates concrete class)
- Has `transaction<T>(callback)` method that creates a new UoW wrapping the `tx`
- Imports concrete repository classes (these will be stub files initially, replaced in PRs 2.2-2.4)

```typescript
// src/server/repositories/unit-of-work.ts
import type { DB } from "./base";
import type {
  IPropertyRepository,
  IBankAccountRepository,
  ITransactionRepository,
  ILoanRepository,
  IRecurringRepository,
  IDocumentRepository,
  IComplianceRepository,
  IEmailRepository,
  IChatRepository,
  IPortfolioRepository,
  IScenarioRepository,
  IUserRepository,
} from "./interfaces";

// Concrete imports — added as each repository is implemented in PRs 2.2-2.4
// import { PropertyRepository } from "./property.repository";
// ... etc

export class UnitOfWork {
  // Private backing fields for lazy instantiation
  private _property?: IPropertyRepository;
  private _bankAccount?: IBankAccountRepository;
  private _transaction?: ITransactionRepository;
  private _loan?: ILoanRepository;
  private _recurring?: IRecurringRepository;
  private _document?: IDocumentRepository;
  private _compliance?: IComplianceRepository;
  private _email?: IEmailRepository;
  private _chat?: IChatRepository;
  private _portfolio?: IPortfolioRepository;
  private _scenario?: IScenarioRepository;
  private _user?: IUserRepository;

  constructor(private readonly db: DB) {}

  // Getters are uncommented as concrete implementations are added in PRs 2.2-2.4
  // get property(): IPropertyRepository {
  //   return (this._property ??= new PropertyRepository(this.db));
  // }

  /** Execute callback in a transaction — all repositories inside share the tx */
  async transaction<T>(callback: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return callback(new UnitOfWork(tx));
    });
  }
}
```

**Note:** The getters start commented out. Each PR (2.2, 2.3, 2.4) uncomments the relevant getters as it adds the concrete repository. This keeps UoW compiling without stub implementations.

**Step 2: Type-check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/server/repositories/unit-of-work.ts
git commit -m "feat: add Unit of Work with transaction support"
```

---

### Task 4: Inject UoW into tRPC context

**Files:**
- Modify: `src/server/trpc.ts` (line ~122, inside protectedProcedure middleware chain)

**Step 1: Read the current trpc.ts**

Read `src/server/trpc.ts` to find the exact location of the protectedProcedure definition.

The protectedProcedure chains middleware. Find the final `.use()` that resolves `ctx.user` and `ctx.portfolio`. The UoW should be created in that same middleware's `next()` call so it's available to all procedures.

**Step 2: Add UoW to context**

At the top of `trpc.ts`, add:
```typescript
import { UnitOfWork } from "./repositories/unit-of-work";
```

Inside the protectedProcedure's auth middleware, where it calls `next({ ctx: { ... } })`, add `uow`:
```typescript
return next({
  ctx: {
    ...ctx,
    user: dbUser,
    portfolio: { ownerId, role, ...permissions },
    uow: new UnitOfWork(ctx.db),
  },
});
```

**Important:** The `uow` uses `ctx.db` which is the same Drizzle instance already in context. This is a pure addition — no existing context fields change.

**Step 3: Verify full test suite still passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/trpc.ts
git commit -m "feat: inject UnitOfWork into tRPC protected context"
```

---

### Task 5: Create PR for foundation

**Step 1: Push and create PR**

```bash
git push -u origin feature/refactor-wave2-pr1
gh pr create --base develop --title "refactor: Wave 2.1 — repository layer foundation" --body "..."
```

**Step 2: Run code review**

Use `/code-review` on the PR.

**Step 3: Verify CI passes**

Run: `gh pr checks --watch`

**Step 4: Merge**

```bash
gh pr merge --squash
```

---

## PR 2.2: Property Repository (Reference Implementation)

**Branch:** `feature/refactor-wave2-pr2` from `develop` (after PR 2.1 merged)

This is the reference implementation. Every subsequent repository follows this exact pattern.

### Task 6: Write PropertyRepository tests

**Files:**
- Create: `src/server/repositories/__tests__/property.repository.test.ts`

**Step 1: Write the failing tests**

Test the PropertyRepository class in isolation using the real DB. Tests should:
- Create a PropertyRepository instance with the test db
- Test `findByOwner` returns properties for a user
- Test `findByOwner` with `excludeLocked: true` filters locked properties
- Test `findById` returns a single property
- Test `findById` returns null for non-existent property
- Test `create` inserts and returns a property
- Test `update` modifies and returns the property
- Test `delete` removes the property
- Test `countByOwner` returns correct count

**Important:** These are integration tests against the real database. Follow the existing test patterns in `src/server/` — check for existing test utilities, DB setup/teardown helpers, and test user creation patterns.

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/repositories/__tests__/property.repository.test.ts 2>&1 | tail -20`
Expected: FAIL — PropertyRepository class doesn't exist yet

**Step 3: Commit failing tests**

```bash
git add src/server/repositories/__tests__/property.repository.test.ts
git commit -m "test: add PropertyRepository integration tests (red)"
```

---

### Task 7: Implement PropertyRepository

**Files:**
- Create: `src/server/repositories/property.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts` (uncomment property getter)

**Step 1: Read the property router**

Read `src/server/routers/property.ts` fully. Extract every `ctx.db.query.*`, `ctx.db.insert()`, `ctx.db.update()`, `ctx.db.delete()`, and `ctx.db.select()` call. Each unique query pattern becomes a method on PropertyRepository.

**Step 2: Implement the repository class**

```typescript
// src/server/repositories/property.repository.ts
import { eq, and, desc, sql } from "drizzle-orm";
import { properties, propertyValues, equityMilestones } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IPropertyRepository } from "./interfaces/property.repository.interface";
// Import relevant types from schema

export class PropertyRepository extends BaseRepository implements IPropertyRepository {
  // Implement each method from the interface
  // Every method encapsulates Drizzle query construction
  // Write methods accept optional tx?: DB and use this.resolve(tx)
}
```

**Step 3: Uncomment UoW getter**

In `src/server/repositories/unit-of-work.ts`:
- Add import: `import { PropertyRepository } from "./property.repository";`
- Uncomment the `get property()` getter

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/repositories/__tests__/property.repository.test.ts 2>&1 | tail -20`
Expected: All tests PASS

**Step 5: Type-check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 6: Commit**

```bash
git add src/server/repositories/property.repository.ts src/server/repositories/unit-of-work.ts
git commit -m "feat: implement PropertyRepository"
```

---

### Task 8: Migrate property router to use repository

**Files:**
- Modify: `src/server/routers/property.ts` (292 lines — all 7 procedures)

**Step 1: Read the property router again**

Read `src/server/routers/property.ts` in full. For each procedure, identify:
1. The inline Drizzle query
2. The equivalent repository method to replace it with
3. Any business logic that stays in the router (plan checks, service calls, error throwing)

**Migration pattern per procedure:**

```
BEFORE: const result = await ctx.db.query.properties.findMany({ where: eq(...), ... });
AFTER:  const result = await ctx.uow.property.findByOwner(ctx.portfolio.ownerId, opts);
```

**Important rules:**
- Business logic (plan checking, referral qualification, climate risk) STAYS in the router — repositories are pure data access
- Error throwing (`TRPCError`) stays in the router — repositories return null/empty, routers decide what's an error
- `ctx.portfolio.ownerId` is passed to repository methods as `userId` parameter
- Remove unused Drizzle imports (`eq`, `and`, `desc`, `sql`) from the router as they move into the repository

**Step 2: Migrate each procedure**

Go through each of the 7 procedures:
1. `list` (lines 24-54) → `ctx.uow.property.findByOwner(ownerId, { excludeLocked })`
2. `get` (lines 56-95) → `ctx.uow.property.findById(id, ownerId)` + keep plan-gating logic
3. `create` (lines 96-204) → `ctx.uow.property.countByOwner(ownerId)` + `ctx.uow.property.create(data)` + keep plan limit check, referral logic
4. `update` (lines 205-240) → `ctx.uow.property.update(id, ownerId, data)` + keep climate risk call
5. `delete` (lines 241-251) → `ctx.uow.property.delete(id, ownerId)`
6. `getMilestones` (lines 253-267) → new method or keep inline (decide based on complexity)
7. `refreshClimateRisk` (lines 268-292) → `ctx.uow.property.update(id, ownerId, { climateRisk })` + keep service call

**Step 3: Run full test suite**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Run E2E tests**

Run: `npm run test:e2e 2>&1 | tail -30`
Expected: All E2E tests pass (behaviour unchanged)

**Step 5: Commit**

```bash
git add src/server/routers/property.ts
git commit -m "refactor: migrate property router to use PropertyRepository"
```

---

### Task 9: Create PR for property repository

**Step 1: Push and create PR**

```bash
git push -u origin feature/refactor-wave2-pr2
gh pr create --base develop --title "refactor: Wave 2.2 — PropertyRepository (reference implementation)" --body "..."
```

**Step 2: Run code review, wait for CI, merge**

---

## PR 2.3: Banking & Transaction Repositories

**Branch:** `feature/refactor-wave2-pr3` from `develop` (after PR 2.2 merged)

These are the two largest routers (778L + 754L). Follow the exact same pattern as PR 2.2.

### Task 10: Write BankAccountRepository tests

Same pattern as Task 6. Test all methods defined in `IBankAccountRepository`.

### Task 11: Write TransactionRepository tests

Same pattern as Task 6. Test all methods defined in `ITransactionRepository`.

Pay special attention to:
- Paginated queries with filters (`TransactionFilters` type)
- Bulk operations (`createMany`, `updateMany`, `deleteMany`)
- Aggregation queries (`getAggregates`)

### Task 12: Implement BankAccountRepository

**Files:**
- Create: `src/server/repositories/bank-account.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts` (uncomment bankAccount getter)

Read `src/server/routers/banking.ts` (778 lines). Extract all Drizzle queries. The most complex procedure is `syncAccount` (lines 132-413) — its queries go into the repository, but Basiq API calls and anomaly detection logic stay in the router/service layer.

### Task 13: Implement TransactionRepository

**Files:**
- Create: `src/server/repositories/transaction.repository.ts`
- Modify: `src/server/repositories/unit-of-work.ts` (uncomment transaction getter)

Read `src/server/routers/transaction.ts` (754 lines). Key patterns to extract:
- Paginated list with dynamic filters (lines 42-105)
- Category-based update logic — the category→isDeductible→transactionType mapping is repeated 4 times. Extract the **query** to the repository, keep the **business logic** (category mapping) in the router or a small helper.
- CSV import batch inserts
- Transaction notes CRUD

### Task 14: Migrate banking router

**Files:**
- Modify: `src/server/routers/banking.ts`

Migrate all 13 procedures. For `syncAccount` (the most complex):
- Basiq API calls → stay in router (external service integration)
- Anomaly detection → stays in router (business logic calling services)
- DB inserts/updates/selects → move to `ctx.uow.bankAccount.*` and `ctx.uow.transaction.*`

### Task 15: Migrate transaction router

**Files:**
- Modify: `src/server/routers/transaction.ts`

Migrate all 17 procedures.

### Task 16: Run full validation

Run: `npx tsc --noEmit`, `npm run test:unit`, `npm run test:e2e`
All must pass.

### Task 17: Create PR, review, merge

---

## PR 2.4: Remaining Repositories

**Branch:** `feature/refactor-wave2-pr4` from `develop` (after PR 2.3 merged)

Pattern is established. Implement all remaining repositories mechanically.

### Task 18: Implement remaining repository classes

For each domain, follow the same pattern:
1. Read the router(s) and service(s) to extract queries
2. Write tests
3. Implement the repository class extending BaseRepository, implementing the interface
4. Uncomment the UoW getter
5. Migrate the router(s) and service(s) to use `ctx.uow.*`

**Domains in implementation order** (simplest first):

| Order | Repository | Router(s) to migrate | Service(s) to migrate | Estimated Methods |
|---|---|---|---|---|
| 1 | ChatRepository | chat.ts | services/chat.ts | 5 |
| 2 | UserRepository | user.ts, billing.ts (subscription queries only) | — | 3 |
| 3 | EmailRepository | email.ts, emailConnection.ts | services/gmail-sync.ts, services/email-processing.ts | 4-6 |
| 4 | LoanRepository | loan.ts, loanComparison.ts, loanPack.ts | — | 6 |
| 5 | RecurringRepository | recurring.ts | services/recurring.ts | 6 |
| 6 | DocumentRepository | documents.ts, documentExtraction.ts | — | 5-7 |
| 7 | PortfolioRepository | portfolio.ts, team.ts, share.ts | — | 6-8 |
| 8 | ScenarioRepository | scenario.ts, forecast.ts | services/scenario/*.ts | 6 |
| 9 | ComplianceRepository | compliance.ts, cgt.ts, taxOptimization.ts, taxPosition.ts, smsfCompliance.ts, trustCompliance.ts | services/compliance/*.ts, services/tax/*.ts | 8-12 |

**For ChatRepository specifically** — the existing `src/server/services/chat.ts` already has the exact methods we need. The migration is:
1. Create `ChatRepository` class with the same methods
2. Change from global `db` import to `this.db` (injected via BaseRepository)
3. Update `src/server/routers/chat.ts` and any callers to use `ctx.uow.chat.*`
4. Delete or deprecate the old `services/chat.ts` functions (they're replaced by the repository)

### Task 19: Migrate service files that have direct DB access

These services import the global `db` and should be migrated to either:
- **Become part of a repository** (if they're pure data access like `services/chat.ts`)
- **Accept a UoW/repository parameter** (if they mix business logic with DB access)

Services with direct DB access:
- `services/chat.ts` (6 queries) → becomes `ChatRepository`
- `services/categorization.ts` (2 queries) → accept repository parameter
- `services/tax-optimization.ts` (4 queries) → accept repository parameter
- `services/recurring.ts` (3 queries) → accept repository parameter or use RecurringRepository
- `services/gmail-sync.ts` (queries) → accept repository parameter
- `services/email-processing.ts` (queries) → accept repository parameter

### Task 20: Run full validation

Run: `npx tsc --noEmit`, `npm run test:unit`, `npm run test:e2e`
All must pass.

### Task 21: Create PR, review, merge

---

## Validation Checklist (Every PR)

Before creating each PR, verify:
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npx next lint` — no lint errors
- [ ] `npm run test:unit` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] No new `any` types introduced
- [ ] All tRPC procedure input/output types unchanged
- [ ] No Drizzle imports (`eq`, `and`, etc.) leak into router files that have been fully migrated
- [ ] All write operations accept `tx?: DB` parameter
- [ ] UoW getters return interface types, not concrete class types

## Key Decisions

1. **UoW getters start commented out** — uncommented as each concrete repository is implemented. This avoids import errors for files that don't exist yet.
2. **Interfaces may be refined** during implementation — if a router needs a query pattern not covered by the initial interface, add the method to the interface and implement it. The interfaces in PR 2.1 are starting contracts, not final.
3. **Business logic stays in routers** — repositories are pure data access. Plan checks, referral logic, service calls, error throwing all stay where they are.
4. **Services with DB access** — pure data access services become repositories. Mixed services accept repository parameters instead of importing global `db`.
5. **One commit per logical step** — test, implement, migrate. Not one giant commit per PR.
