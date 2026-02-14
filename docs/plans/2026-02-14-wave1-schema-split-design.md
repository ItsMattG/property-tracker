# Wave 1: Schema Split Design

**Date:** 2026-02-14
**Status:** Approved
**Scope:** Single PR — split monolithic `schema.ts` into domain modules
**Parent:** `docs/plans/2026-02-14-full-codebase-refactor-design.md`

## Objective

Split `src/server/db/schema.ts` (3,415 lines, 92 tables, 71 enums, 73 relations) into ~17 domain module files under `src/server/db/schema/`. Each file contains tables, enums, and relations for its domain. A barrel `index.ts` re-exports everything for zero-impact backwards compatibility.

## Key Decision: v1 Relations API (not defineRelationsPart)

The design doc planned PR 1.2 to use Drizzle's `defineRelationsPart()` API. However, this API only exists in `drizzle-orm@1.0.0-beta.*` — the project uses `0.45.1` (latest stable). Since the v1 `relations()` function works perfectly in split files via barrel re-exports, we keep the existing API and merge PR 1.1 + PR 1.2 into a single PR.

When drizzle-orm v1 goes stable, migration to `defineRelationsPart` can be done as a future cleanup.

## Tech Notes (context7)

- **Drizzle multi-file schema:** `import * as schema from "./schema"` works with barrel re-exports. All tables, enums, and relations are collected via `export *`.
- **Combining schemas:** `drizzle(client, { schema: { ...schema1, ...schema2 } })` pattern confirmed, but barrel re-export is simpler (single `import * as schema`).
- **`defineRelationsPart`:** Available only in 1.0.0-beta — not used.
- **v1 `relations()`:** Each relation definition is independent. Co-locating in domain files and re-exporting via barrel is fully supported.

## File Structure

```
src/server/db/schema/
├── index.ts              # Barrel re-export
├── _common.ts            # Shared drizzle-orm imports + vector custom type
├── enums.ts              # All 71 pgEnum definitions
├── auth.ts               # 4 tables, 3 relations
├── entities.ts           # 12 tables, 12 relations
├── properties.ts         # 6 tables, 6 relations
├── banking.ts            # 5 tables, 5 relations
├── recurring.ts          # 2 tables, 2 relations
├── loans.ts              # 6 tables, 5 relations
├── documents.ts          # 5 tables, 5 relations
├── communication.ts      # 7 tables, ~3 relations
├── tax.ts                # 7 tables, 7 relations
├── scenarios.ts          # 6 tables, 6 relations
├── portfolio.ts          # 10 tables, 10 relations
├── features.ts           # 9 tables, 6 relations
├── notifications.ts      # 4 tables, 4 relations
├── chat.ts               # 3 tables, 3 relations
└── billing.ts            # 6 tables, 0 relations
```

## Domain → Table Mapping

### `_common.ts`
Shared imports re-exported for domain files:
- `pgTable`, `uuid`, `text`, `timestamp`, `decimal`, `date`, `boolean`, `pgEnum`, `index`, `uniqueIndex`, `jsonb`, `integer`, `varchar`, `customType`, `serial`, `real`, `AnyPgColumn` from `drizzle-orm/pg-core`
- `relations`, `sql` from `drizzle-orm`
- Custom `vector` type for pgvector

### `enums.ts`
All 71 `pgEnum` definitions. Centralized because enums are referenced across multiple domains.

### `auth.ts` (4 tables)
- `users`, `session`, `account`, `verification`
- Relations: `usersRelations`, `sessionRelations`, `accountRelations`

### `entities.ts` (12 tables)
- `entities`, `trustDetails`, `smsfDetails`, `entityMembers`, `smsfMembers`
- `smsfContributions`, `smsfPensions`, `smsfComplianceChecks`, `smsfAuditItems`
- `beneficiaries`, `trustDistributions`, `distributionAllocations`
- Relations: 12 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`

### `properties.ts` (6 tables)
- `properties`, `externalListings`, `propertyVectors`
- `propertyValues`, `suburbBenchmarks`, `propertyPerformanceBenchmarks`
- Relations: 6 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `entities` from `./entities`

### `banking.ts` (5 tables)
- `bankAccounts`, `transactions`, `transactionNotes`
- `connectionAlerts`, `anomalyAlerts`
- Relations: 5 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`

### `recurring.ts` (2 tables)
- `recurringTransactions`, `expectedTransactions`
- Relations: 2 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`, `bankAccounts` from `./banking`

### `loans.ts` (6 tables)
- `loans`, `loanComparisons`, `refinanceAlerts`, `rateHistory`
- `brokers`, `loanPacks`
- Relations: 5 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`

### `documents.ts` (5 tables)
- `documents`, `documentExtractions`
- `propertyManagerConnections`, `propertyManagerMappings`, `propertyManagerSyncLogs`
- Relations: 5 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`

### `communication.ts` (7 tables)
- `emailConnections`, `emailApprovedSenders`, `senderPropertyHistory`
- `propertyEmails`, `propertyEmailAttachments`, `propertyEmailInvoiceMatches`, `propertyEmailSenders`
- Relations: ~3 relation definitions (some email tables lack relations currently)
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`, `transactions` from `./banking`

### `tax.ts` (7 tables)
- `taxProfiles`, `propertySales`, `depreciationSchedules`, `depreciationAssets`
- `taxSuggestions`, `merchantCategories`, `categorizationExamples`
- Relations: 7 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`, `documents` from `./documents`

### `scenarios.ts` (6 tables)
- `forecastScenarios`, `cashFlowForecasts`
- `scenarios`, `scenarioFactors`, `scenarioProjections`, `scenarioSnapshots`
- Relations: 6 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`

### `portfolio.ts` (10 tables)
- `portfolioMembers`, `portfolioInvites`, `portfolioShares`
- `sharingPreferences`, `milestonePreferences`
- `equityMilestones`, `propertyMilestoneOverrides`
- `complianceRecords`, `auditLog`, `userOnboarding`
- Relations: 10 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`

### `features.ts` (9 tables)
- `featureRequests`, `featureVotes`, `featureComments`, `bugReports`
- `changelogEntries`, `userChangelogViews`, `blogPosts`
- `supportTickets`, `ticketNotes`
- Relations: 6 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`

### `notifications.ts` (4 tables)
- `notificationPreferences`, `pushSubscriptions`, `notificationLog`, `pushTokens`
- Relations: 4 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`

### `chat.ts` (3 tables)
- `tasks`, `chatConversations`, `chatMessages`
- Relations: 3 corresponding relation definitions
- Cross-domain imports: `users` from `./auth`, `properties` from `./properties`, `entities` from `./entities`

### `billing.ts` (6 tables)
- `referralCodes`, `referrals`, `referralCredits`, `subscriptions`
- `cronHeartbeats`, `monitorState`
- Relations: none currently defined
- Cross-domain imports: `users` from `./auth`

## Cross-Domain Dependency Graph

```
enums.ts (no deps)
  ↓
auth.ts (enums)
  ↓
entities.ts (enums, auth)
  ↓
properties.ts (enums, auth, entities)
  ↓
banking.ts (enums, auth, properties)
  ↓
recurring.ts (enums, auth, properties, banking)
loans.ts (enums, auth, properties)
documents.ts (enums, auth, properties)
communication.ts (enums, auth, properties, banking)
tax.ts (enums, auth, properties, documents)
scenarios.ts (enums, auth, properties)
portfolio.ts (enums, auth, properties)
features.ts (enums, auth)
notifications.ts (enums, auth)
chat.ts (enums, auth, properties, entities)
billing.ts (enums, auth)
```

No circular dependencies.

## Implementation Strategy

1. Create `src/server/db/schema/` directory
2. Create `_common.ts` with shared imports and vector type
3. Create `enums.ts` with all 71 enum definitions
4. Create each domain file — move tables, relations, and local imports
5. Create `index.ts` barrel that re-exports everything
6. Delete original `schema.ts`
7. Update `db/index.ts` import path (only change: `"./schema"` stays the same since `schema/index.ts` resolves automatically)
8. Verify: lint, build, type-check, all tests pass

## Backwards Compatibility

- **Zero import changes** outside `src/server/db/` — barrel re-export means `import { users } from "@/server/db/schema"` still works
- **`db/index.ts`** — `import * as schema from "./schema"` resolves to `./schema/index.ts` automatically
- **All export names** — identical to current schema.ts
- **No behavioural changes** — pure file reorganization

## Behaviour Preservation Checklist

- [ ] All existing tests pass (unit + E2E)
- [ ] tRPC procedure input/output types unchanged
- [ ] All 92 table exports accessible via `@/server/db/schema`
- [ ] All 73 relation definitions accessible via schema
- [ ] All 71 enum exports accessible via `@/server/db/schema`
- [ ] `db.query.*` relational queries work unchanged
- [ ] Lint + build + type-check pass
- [ ] No new `any` types introduced
