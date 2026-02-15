# Wave 2: Repository Layer Design

**Date:** 2026-02-14
**Status:** Approved
**Parent:** `docs/plans/2026-02-14-full-codebase-refactor-design.md`
**Pattern:** Class-based repositories with interfaces, Unit of Work, dependency injection via tRPC context

## Objective

Introduce a repository layer that encapsulates all Drizzle database queries behind typed interfaces, following the Repository Pattern and Unit of Work pattern. Routers and services depend on abstractions (interfaces), not concrete Drizzle queries. This enables testability, enforces separation of concerns, and hides persistence implementation details from business logic.

## Design Principles

1. **Interface Segregation (ISP)** — Each domain gets its own interface with only the methods that domain needs. No generic `IRepository<T>` with unused methods.
2. **Dependency Inversion (DIP)** — Business logic depends on `IPropertyRepository`, never on `PropertyRepository` directly.
3. **Persistence encapsulation** — No `eq()`, `and()`, `inArray()` in method signatures. Callers pass plain values; repositories construct queries internally.
4. **Transaction safety (Unit of Work)** — Write operations accept optional `tx?: DB`. The `UnitOfWork` class coordinates transaction boundaries, ensuring all repositories in a transaction share the same connection.
5. **Domain-specific naming** — `findWithActiveAlerts`, `getAggregates`, `findWithLatestValuation` instead of generic `findAll/findOne`.

## Tech Notes (context7 Research)

### Drizzle ORM
- **Transaction type**: `db.transaction(async (tx) => { ... })` — `tx` has the same type as `db` (`PostgresJsDatabase<typeof schema>`), so our `DB` type alias works for both.
- **Nested transactions**: Supported as savepoints — `tx.transaction(async (tx2) => { ... })`.
- **Relational queries**: `db.query.tableName.findMany/findFirst()` with `.with()` for joins. Available inside transactions via `tx.query.*`.
- **Prepared statements**: Disabled in this codebase (`prepare: false`) for serverless compatibility. Not relevant for repository layer.
- **No prescribed repository pattern**: Drizzle docs don't opine on architecture — the repository pattern is our design choice, not a Drizzle recommendation.

### TypeScript
- `DB` type alias uses `PostgresJsDatabase<typeof schema>` — preserves full type inference on `.query`, `.insert()`, etc.
- `protected readonly db` in base class — subclasses access directly, callers can't.
- Optional `tx?: DB` parameter on write methods — caller controls atomicity.

### Repository Pattern (Industry Research)
- **Sentry (Atomic Repositories)**: Repositories accept optional transaction parameter. UoW coordinates atomicity. Anti-pattern: each repository managing its own transactions.
- **LogRocket**: Contract-first approach — define interfaces before implementations. Generic `RepositoryInterface<T>` only when all domains share identical CRUD.
- **Khalil Stemmler (DDD)**: Repositories are facades to persistence. Domain-specific method names, not generic CRUD. Calling code never sees ORM internals.

## Architecture

### Foundation Layer

```typescript
// src/server/repositories/base.ts

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";

/** Database client type — works for both main db and transaction tx */
export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Base repository — shared infrastructure for all repositories.
 * Subclasses access this.db for queries and this.resolve(tx) for
 * transaction-aware operations.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: DB) {}

  /** Use the provided transaction or fall back to the default db client */
  protected resolve(tx?: DB): DB {
    return tx ?? this.db;
  }
}
```

### Unit of Work

```typescript
// src/server/repositories/unit-of-work.ts

/**
 * Coordinates repository access and transaction boundaries.
 * Lazily instantiates repositories — only ones used per request are created.
 * In a transaction, a new UoW wraps the tx so all repositories share it.
 */
export class UnitOfWork {
  private _property?: PropertyRepository;
  private _bankAccount?: BankAccountRepository;
  private _transaction?: TransactionRepository;
  private _loan?: LoanRepository;
  private _recurring?: RecurringRepository;
  private _document?: DocumentRepository;
  private _compliance?: ComplianceRepository;
  private _email?: EmailRepository;
  private _chat?: ChatRepository;
  private _portfolio?: PortfolioRepository;
  private _scenario?: ScenarioRepository;
  private _user?: UserRepository;

  constructor(private readonly db: DB) {}

  get property(): IPropertyRepository {
    return (this._property ??= new PropertyRepository(this.db));
  }

  get bankAccount(): IBankAccountRepository {
    return (this._bankAccount ??= new BankAccountRepository(this.db));
  }

  // ... lazy getters for each repository (return interface type)

  /** Execute callback in a transaction — all repositories inside share the tx */
  async transaction<T>(callback: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return callback(new UnitOfWork(tx));
    });
  }
}
```

### tRPC Context Integration

```typescript
// In src/server/trpc.ts — added to protectedProcedure middleware

import { UnitOfWork } from "./repositories/unit-of-work";

// Inside existing middleware chain:
const uow = new UnitOfWork(ctx.db);
return next({ ctx: { ...ctx, uow } });
```

## Repository Interfaces

### Property Domain

```typescript
export interface IPropertyRepository {
  findByOwner(userId: string, opts?: { excludeLocked?: boolean }): Promise<Property[]>;
  findById(id: string, userId: string): Promise<Property | null>;
  create(data: NewProperty, tx?: DB): Promise<Property>;
  update(id: string, userId: string, data: Partial<NewProperty>, tx?: DB): Promise<Property>;
  delete(id: string, userId: string, tx?: DB): Promise<void>;
  countByOwner(userId: string): Promise<number>;
  findWithLatestValuation(id: string, userId: string): Promise<PropertyWithValuation | null>;
}
```

### Banking Domain

```typescript
export interface IBankAccountRepository {
  findByOwner(userId: string): Promise<BankAccountWithRelations[]>;
  findById(id: string, userId: string): Promise<BankAccount | null>;
  create(data: NewBankAccount, tx?: DB): Promise<BankAccount>;
  update(id: string, userId: string, data: Partial<NewBankAccount>, tx?: DB): Promise<BankAccount>;
  delete(id: string, userId: string, tx?: DB): Promise<void>;
  findWithActiveAlerts(userId: string): Promise<BankAccountWithAlerts[]>;
}
```

### Transaction Domain

```typescript
export interface ITransactionRepository {
  findByOwner(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;
  findById(id: string, userId: string): Promise<Transaction | null>;
  create(data: NewTransaction, tx?: DB): Promise<Transaction>;
  createMany(data: NewTransaction[], tx?: DB): Promise<Transaction[]>;
  update(id: string, userId: string, data: Partial<NewTransaction>, tx?: DB): Promise<Transaction>;
  updateMany(ids: string[], userId: string, data: Partial<NewTransaction>, tx?: DB): Promise<void>;
  delete(id: string, userId: string, tx?: DB): Promise<void>;
  deleteMany(ids: string[], userId: string, tx?: DB): Promise<void>;
  getAggregates(userId: string, bankAccountId: string): Promise<TransactionAggregates>;
}
```

### Remaining Domains

| Interface | Key Methods | Tables |
|---|---|---|
| `ILoanRepository` | findByOwner, findById, create, update, delete, findWithComparisons | loans, refinanceAlerts, loanPacks, loanComparisons |
| `IRecurringRepository` | findByOwner, findById, create, update, delete, findExpected | recurringTransactions, expectedTransactions |
| `IDocumentRepository` | findByOwner, findById, create, delete, findExtractions | documents, documentExtractions, depreciationAssets, settlementStatements |
| `IComplianceRepository` | findRecords, findTaxProfile, createRecord, updateRecord, findCgtCalculations | complianceRecords, taxProfiles, cgtCalculations, cgtCostBases, cgtDisposals, taxSuggestions |
| `IEmailRepository` | findConnections, findEmails, createEmail, linkAttachment | emailConnections, propertyEmails, propertyEmailAttachments |
| `IChatRepository` | findConversations, findConversationById, createConversation, addMessage, deleteConversation | chatConversations, chatMessages |
| `IPortfolioRepository` | findMembers, findInvites, createInvite, updateMember, removeMember, logAuditEntry | portfolios, portfolioMembers, portfolioInvites, auditLog |
| `IScenarioRepository` | findByOwner, findById, create, update, delete, findProjections | scenarios, scenarioFactors, scenarioProjections |
| `IUserRepository` | findById, findSubscription, updateUser | users, subscriptions |

## Concrete Implementation Example

```typescript
// src/server/repositories/property.repository.ts

import { eq, and, desc, sql } from "drizzle-orm";
import { properties } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IPropertyRepository } from "./interfaces/property.repository.interface";
import type { Property, NewProperty, PropertyWithValuation } from "../db/schema";

export class PropertyRepository extends BaseRepository implements IPropertyRepository {

  async findByOwner(userId: string, opts?: { excludeLocked?: boolean }): Promise<Property[]> {
    const conditions = [eq(properties.userId, userId)];
    if (opts?.excludeLocked) {
      conditions.push(eq(properties.locked, false));
    }
    return this.db.query.properties.findMany({
      where: and(...conditions),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  async findById(id: string, userId: string): Promise<Property | null> {
    const result = await this.db.query.properties.findFirst({
      where: and(eq(properties.id, id), eq(properties.userId, userId)),
    });
    return result ?? null;
  }

  async create(data: NewProperty, tx?: DB): Promise<Property> {
    const db = this.resolve(tx);
    const [result] = await db.insert(properties).values(data).returning();
    return result;
  }

  async update(id: string, userId: string, data: Partial<NewProperty>, tx?: DB): Promise<Property> {
    const db = this.resolve(tx);
    const [result] = await db
      .update(properties)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();
    return result;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const db = this.resolve(tx);
    await db.delete(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
  }

  async countByOwner(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.userId, userId));
    return result.count;
  }

  async findWithLatestValuation(id: string, userId: string): Promise<PropertyWithValuation | null> {
    const result = await this.db.query.properties.findFirst({
      where: and(eq(properties.id, id), eq(properties.userId, userId)),
      with: {
        values: {
          orderBy: (v, { desc }) => [desc(v.valuationDate)],
          limit: 1,
        },
      },
    });
    return result ?? null;
  }
}
```

## Router Migration Pattern

### Before (inline Drizzle queries)

```typescript
list: protectedProcedure.query(async ({ ctx }) => {
  let currentPlan = "free";
  try {
    const sub = await ctx.db.query.subscriptions?.findFirst({
      where: eq(subscriptions.userId, ctx.portfolio.ownerId),
    });
    currentPlan = getPlanFromSubscription(sub ? { ... } : null);
  } catch { currentPlan = "pro"; }

  if (currentPlan === "free") {
    return ctx.db.query.properties.findMany({
      where: and(eq(properties.userId, ctx.portfolio.ownerId), eq(properties.locked, false)),
      orderBy: (properties, { desc }) => [desc(properties.createdAt)],
    });
  }
  return ctx.db.query.properties.findMany({
    where: eq(properties.userId, ctx.portfolio.ownerId),
    orderBy: (properties, { desc }) => [desc(properties.createdAt)],
  });
}),
```

### After (repository delegation)

```typescript
list: protectedProcedure.query(async ({ ctx }) => {
  const currentPlan = await getPlan(ctx);
  return ctx.uow.property.findByOwner(
    ctx.portfolio.ownerId,
    { excludeLocked: currentPlan === "free" }
  );
}),
```

## File Structure

```
src/server/repositories/
├── base.ts                              # DB type, BaseRepository class
├── unit-of-work.ts                      # UnitOfWork coordinator
├── interfaces/
│   ├── index.ts                         # Barrel export
│   ├── property.repository.interface.ts
│   ├── bank-account.repository.interface.ts
│   ├── transaction.repository.interface.ts
│   ├── loan.repository.interface.ts
│   ├── recurring.repository.interface.ts
│   ├── document.repository.interface.ts
│   ├── compliance.repository.interface.ts
│   ├── email.repository.interface.ts
│   ├── chat.repository.interface.ts
│   ├── portfolio.repository.interface.ts
│   ├── scenario.repository.interface.ts
│   └── user.repository.interface.ts
├── property.repository.ts
├── bank-account.repository.ts
├── transaction.repository.ts
├── loan.repository.ts
├── recurring.repository.ts
├── document.repository.ts
├── compliance.repository.ts
├── email.repository.ts
├── chat.repository.ts
├── portfolio.repository.ts
├── scenario.repository.ts
└── user.repository.ts
```

## PR Breakdown

| PR | Scope | Files | Risk |
|---|---|---|---|
| **2.1** | Base types, UoW, all interfaces, tRPC context integration | ~16 new files, 1 modified | Low — purely additive |
| **2.2** | PropertyRepository + migrate property.ts router | 2 new, 1 modified | Medium — validates pattern |
| **2.3** | BankAccountRepository + TransactionRepository + migrate banking.ts + transaction.ts | 4 new, 2 modified | Medium-High — largest routers |
| **2.4** | All remaining repositories + migrate remaining routers/services | 18 new, ~25 modified | Medium — mechanical, pattern established |

## Behaviour Preservation Checklist

For every PR:
- [ ] All existing tests pass (unit + E2E)
- [ ] tRPC procedure input/output types unchanged
- [ ] Auth checks and permission gates unchanged
- [ ] Error codes returned to clients unchanged
- [ ] No new `any` types introduced
- [ ] Lint + build + type-check pass
- [ ] Side effects unchanged (notifications, emails, Stripe webhooks)

## Query Catalog Summary

Total queries to extract: ~360 across 56 routers + 12 in services.

| Domain | Router Queries | Service Queries | Repository Methods |
|---|---|---|---|
| Property | 72+ | 0 | 7 |
| Banking | 20+ | 0 | 6 |
| Transaction | 30+ | 2 | 9 |
| Loan | 18+ | 0 | 6 |
| Recurring | 8+ | 3 | 6 |
| Document | 17+ | 0 | 5 |
| Compliance/Tax | 50+ | 4 | 5+ |
| Email | 5+ | 3 | 4 |
| Chat | 3+ | 6 | 5 |
| Portfolio/Team | 35+ | 0 | 6 |
| Scenario | 13+ | 0 | 6 |
| User (cross-cutting) | 12+ | 0 | 3 |
| Other (stats, tasks, etc.) | 45+ | 0 | Deferred to Wave 4 |

## References

- [Atomic Repositories in Clean Architecture and TypeScript | Sentry](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/)
- [Exploring the Repository Pattern with TypeScript and Node | LogRocket](https://blog.logrocket.com/exploring-repository-pattern-typescript-node/)
- [Implementing DTOs, Mappers & the Repository Pattern | Khalil Stemmler](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions)
