# Wave 1: Schema Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split monolithic `src/server/db/schema.ts` (3,416 lines) into 17 domain modules under `src/server/db/schema/` with zero external import changes.

**Architecture:** Create a `schema/` directory with domain-specific files. Each file contains tables, relations, and type exports for its domain. A barrel `index.ts` re-exports everything. Cross-domain references use direct imports between domain files. Enums are centralized since they're shared across domains.

**Tech Stack:** Drizzle ORM 0.45.1 (v1 relations API), PostgreSQL, TypeScript

**Design doc:** `docs/plans/2026-02-14-wave1-schema-split-design.md`

---

### Task 1: Create worktree and scaffold directory

**Files:**
- Create: `src/server/db/schema/` (directory)

**Step 1: Create worktree**

```bash
git worktree add ~/worktrees/property-tracker/refactor-wave1 -b feature/refactor-wave1 develop
cp ~/Documents/property-tracker/.env.local ~/worktrees/property-tracker/refactor-wave1/.env.local
cd ~/worktrees/property-tracker/refactor-wave1
```

**Step 2: Create schema directory**

```bash
mkdir -p src/server/db/schema
```

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold schema directory for Wave 1 split"
```

---

### Task 2: Create `_common.ts` — shared imports and vector type

**Files:**
- Create: `src/server/db/schema/_common.ts`

**Step 1: Create the file**

Extract the shared imports and vector custom type from `schema.ts` lines 1-37. Domain files import from here instead of repeating drizzle-orm imports.

```typescript
// src/server/db/schema/_common.ts
// Shared drizzle-orm imports and custom types used by all domain schema files.
// Domain files import from here to avoid repeating drizzle-orm/pg-core imports.

export {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  date,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  integer,
  varchar,
  customType,
  serial,
  real,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export { relations, sql } from "drizzle-orm";

import { customType } from "drizzle-orm/pg-core";

// Custom type for pgvector
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(5)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,0.3,0.4,0.5]" format
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => parseFloat(v));
  },
});
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/server/db/schema/_common.ts
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/db/schema/_common.ts && git commit -m "feat: add shared schema imports (_common.ts)"
```

---

### Task 3: Create `enums.ts` — all 71 enum definitions

**Files:**
- Create: `src/server/db/schema/enums.ts`

**Step 1: Create the file**

Move all `pgEnum` definitions from `schema.ts` (lines 40-505 plus `chatMessageRoleEnum` at line 3013 and billing enums at lines 3310-3379) into `enums.ts`. Import `pgEnum` from `./_common`.

The file should start with:

```typescript
// src/server/db/schema/enums.ts
import { pgEnum } from "./_common";
```

Then contain ALL enum exports verbatim from `schema.ts`:
- `stateEnum` through `ticketUrgencyEnum` (lines 40-505)
- `chatMessageRoleEnum` (line 3013)
- `referralStatusEnum` (line 3311)
- `subscriptionPlanEnum` (line 3366)
- `subscriptionStatusEnum` (line 3373)

Every `export const xxxEnum = pgEnum(...)` line moves here exactly as-is.

**Step 2: Commit**

```bash
git add src/server/db/schema/enums.ts && git commit -m "feat: extract all enums to schema/enums.ts"
```

---

### Task 4: Create `auth.ts` — users, session, account, verification

**Files:**
- Create: `src/server/db/schema/auth.ts`

**Step 1: Create the file**

Tables from schema.ts lines 508-578. Relations from lines 1679-1701. No type exports for auth (users types are in the type export block).

Import what's needed from `_common` and `enums`. Note: `users` table has a forward reference to `properties` via `pendingBankPropertyId` — use `AnyPgColumn` for this.

```typescript
// src/server/db/schema/auth.ts
import {
  pgTable, uuid, text, timestamp, boolean, varchar, index,
  relations, type AnyPgColumn,
} from "./_common";

// Forward reference — resolved at runtime, avoids circular import
import type { } from "./properties"; // Not needed — use AnyPgColumn pattern

export const users = pgTable("users", {
  // ... exact copy from schema.ts lines 508-524
  // pendingBankPropertyId uses (): AnyPgColumn => properties.id
  // BUT since properties isn't available here, we use a lazy reference
});
```

**CRITICAL:** The `users.pendingBankPropertyId` references `properties.id`. Since `properties.ts` imports `users` from `auth.ts`, this would create a circular import. The existing code already handles this with `(): AnyPgColumn => properties.id` — we keep this pattern by importing `properties` lazily:

```typescript
pendingBankPropertyId: uuid("pending_bank_property_id").references(
  (): AnyPgColumn => {
    // Lazy import to break circular dependency
    const { properties } = require("./properties");
    return properties.id;
  },
  { onDelete: "set null" }
),
```

Actually — looking at the original code more carefully, it uses `(): AnyPgColumn => properties.id` which is already a lazy/deferred reference in Drizzle. Drizzle evaluates this callback at migration/query time, not at import time. So we can safely import `properties` at the top level since the callback defers the actual reference resolution. This is how Drizzle handles circular references. So:

```typescript
import { properties } from "./properties";
```

This works because TypeScript/Node resolves the circular dependency — by the time the callback `() => properties.id` executes, both modules are fully loaded. This is the standard Drizzle pattern for cross-file references.

The full file includes:
- `users` (lines 508-524)
- `session` (lines 526-541)
- `account` (lines 543-563)
- `verification` (lines 565-578)
- `usersRelations` (lines 1679-1687) — references `properties`, `bankAccounts`, `transactions`, `entities`, `chatConversations`, `session`, `account`
- `sessionRelations` (lines 1689-1694)
- `accountRelations` (lines 1696-1701)
- Type exports: `User`, `NewUser` (lines 3143-3144)

For `usersRelations`, the many() references to other domain tables need imports from those domain files. Since these are also lazy (Drizzle evaluates at query time), circular imports work fine.

**Step 2: Commit**

```bash
git add src/server/db/schema/auth.ts && git commit -m "feat: extract auth tables to schema/auth.ts"
```

---

### Task 5: Create `entities.ts` — entity/trust/SMSF tables

**Files:**
- Create: `src/server/db/schema/entities.ts`

**Step 1: Create the file**

Tables from schema.ts:
- `entities` (line 580)
- `trustDetails` (line 597)
- `smsfDetails` (line 609)
- `entityMembers` (line 622)
- `smsfMembers` (line 646)
- `smsfContributions` (line 664)
- `smsfPensions` (line 687)
- `smsfComplianceChecks` (line 711)
- `smsfAuditItems` (line 727)
- `beneficiaries` (line 744)
- `trustDistributions` (line 761)
- `distributionAllocations` (line 778)

Relations from lines 1703-1816.

Type exports: `Entity`, `NewEntity`, `TrustDetails`, `NewTrustDetails`, `SmsfDetails`, `NewSmsfDetails`, `EntityMember`, `NewEntityMember`, `SmsfMember`, `NewSmsfMember`, `SmsfContribution`, `NewSmsfContribution`, `SmsfPension`, `NewSmsfPension`, `SmsfComplianceCheck`, `NewSmsfComplianceCheck`, `SmsfAuditItem`, `NewSmsfAuditItem`, `Beneficiary`, `NewBeneficiary`, `TrustDistribution`, `NewTrustDistribution`, `DistributionAllocation`, `NewDistributionAllocation`

Imports needed:
- From `_common`: pgTable, uuid, text, timestamp, decimal, date, boolean, jsonb, index, relations
- From `enums`: entityTypeEnum, trusteeTypeEnum, entityMemberRoleEnum, smsfMemberPhaseEnum, pensionFrequencyEnum, smsfComplianceCheckTypeEnum, smsfComplianceStatusEnum
- From `auth`: users

**Step 2: Commit**

```bash
git add src/server/db/schema/entities.ts && git commit -m "feat: extract entity/trust/SMSF tables to schema/entities.ts"
```

---

### Task 6: Create `properties.ts` — property core tables

**Files:**
- Create: `src/server/db/schema/properties.ts`

**Step 1: Create the file**

Tables:
- `properties` (line 798) — imports `users` from auth, `entities` from entities
- `externalListings` (line 826)
- `propertyVectors` (line 850) — uses `vector` custom type
- `propertyValues` (line 1386)
- `suburbBenchmarks` (line 1478) — no FK references
- `propertyPerformanceBenchmarks` (line 1505)

Relations (lines 1818-1863 + 2041-2050 + 2086-2102):
- `propertiesRelations` — many references to transactions, bankAccounts, loans, propertySales, documents, propertyValues, propertyVector
- `externalListingsRelations`
- `propertyVectorsRelations`
- `sharingPreferencesRelations` — Wait, `sharingPreferences` is in portfolio domain per design. Let me check... The design says portfolio.ts gets sharingPreferences. But the relation is defined right after propertyVectors. We'll put `sharingPreferences` table + relation in `portfolio.ts` as designed.
- `propertyValuesRelations`
- `suburbBenchmarksRelations`
- `propertyPerformanceBenchmarksRelations`

Type exports: `Property`, `NewProperty`, `PropertyValue`, `NewPropertyValue`, `SuburbBenchmark`, `NewSuburbBenchmark`, `PropertyPerformanceBenchmark`, `NewPropertyPerformanceBenchmark`

Imports needed:
- From `_common`: pgTable, uuid, text, timestamp, decimal, date, boolean, jsonb, integer, index, relations, sql
- From `_common`: `vector`
- From `enums`: stateEnum, propertyStatusEnum, listingSourceTypeEnum, propertyTypeEnum, shareLevelEnum, valuationSourceEnum
- From `auth`: users
- From `entities`: entities

Note: `propertiesRelations` references `transactions`, `bankAccounts`, `loans`, `propertySales`, `documents`, `propertyValues`, `propertyVectors` — import these from their respective domain files. Drizzle handles circular refs because `relations()` callback is lazy.

**Step 2: Commit**

```bash
git add src/server/db/schema/properties.ts && git commit -m "feat: extract property tables to schema/properties.ts"
```

---

### Task 7: Create `banking.ts` — bank accounts, transactions, alerts

**Files:**
- Create: `src/server/db/schema/banking.ts`

**Step 1: Create the file**

Tables:
- `bankAccounts` (line 893)
- `transactions` (line 919)
- `transactionNotes` (line 967)
- `connectionAlerts` (line 1412)
- `anomalyAlerts` (line 1437) — references `recurringTransactions` and `expectedTransactions` from recurring.ts

Relations (lines 1865-1904, 2052-2084):
- `bankAccountsRelations`
- `transactionsRelations`
- `transactionNotesRelations`
- `connectionAlertsRelations`
- `anomalyAlertsRelations` — references `recurringTransactions`, `expectedTransactions` from recurring.ts

Type exports: `BankAccount`, `NewBankAccount`, `Transaction`, `NewTransaction`, `ConnectionAlert`, `NewConnectionAlert`, `AnomalyAlert`, `NewAnomalyAlert`

Imports:
- From `enums`: accountTypeEnum, connectionStatusEnum, syncStatusEnum, categoryEnum, transactionTypeEnum, transactionStatusEnum, suggestionStatusEnum, alertTypeEnum, alertStatusEnum, anomalyAlertTypeEnum, anomalySeverityEnum
- From `auth`: users
- From `properties`: properties

**Step 2: Commit**

```bash
git add src/server/db/schema/banking.ts && git commit -m "feat: extract banking tables to schema/banking.ts"
```

---

### Task 8: Create `recurring.ts` — recurring and expected transactions

**Files:**
- Create: `src/server/db/schema/recurring.ts`

**Step 1: Create the file**

Tables:
- `recurringTransactions` (line 1304)
- `expectedTransactions` (line 1353)

Relations (lines 2000-2039):
- `recurringTransactionsRelations`
- `expectedTransactionsRelations`

Type exports: `RecurringTransaction`, `NewRecurringTransaction`, `ExpectedTransaction`, `NewExpectedTransaction`

Imports:
- From `enums`: categoryEnum, transactionTypeEnum, frequencyEnum, expectedStatusEnum
- From `auth`: users
- From `properties`: properties
- From `banking`: bankAccounts, transactions

**Step 2: Commit**

```bash
git add src/server/db/schema/recurring.ts && git commit -m "feat: extract recurring transaction tables to schema/recurring.ts"
```

---

### Task 9: Create `loans.ts` — loans, comparisons, brokers

**Files:**
- Create: `src/server/db/schema/loans.ts`

**Step 1: Create the file**

Tables:
- `loans` (line 987)
- `rateHistory` (line 2515)
- `loanComparisons` (line 2522)
- `refinanceAlerts` (line 2544)
- `brokers` (line 2719)
- `loanPacks` (line 2737)

Relations (lines 1906-1921, 2838-2855, 2911-2927):
- `loansRelations`
- `loanComparisonsRelations`
- `refinanceAlertsRelations`
- `brokersRelations`
- `loanPacksRelations`

Type exports: `Loan`, `NewLoan`, `RateHistory`, `NewRateHistory`, `LoanComparison`, `NewLoanComparison`, `RefinanceAlert`, `NewRefinanceAlert`, `Broker`, `NewBroker`, `LoanPack`, `NewLoanPack`

Imports:
- From `enums`: loanTypeEnum, rateTypeEnum
- From `auth`: users
- From `properties`: properties
- From `banking`: bankAccounts

**Step 2: Commit**

```bash
git add src/server/db/schema/loans.ts && git commit -m "feat: extract loan tables to schema/loans.ts"
```

---

### Task 10: Create `documents.ts` — documents, extractions, property manager

**Files:**
- Create: `src/server/db/schema/documents.ts`

**Step 1: Create the file**

Tables:
- `documents` (line 1041)
- `documentExtractions` (line 1076)
- `propertyManagerConnections` (line 1104)
- `propertyManagerMappings` (line 1121)
- `propertyManagerSyncLogs` (line 1137)

Relations (lines 1934-1998):
- `documentsRelations`
- `documentExtractionsRelations`
- `propertyManagerConnectionsRelations`
- `propertyManagerMappingsRelations`
- `propertyManagerSyncLogsRelations`

Type exports: `Document`, `NewDocument`, `DocumentExtraction`, `NewDocumentExtraction`, `PropertyManagerConnection`, `NewPropertyManagerConnection`, `PropertyManagerMapping`, `NewPropertyManagerMapping`, `PropertyManagerSyncLog`, `NewPropertyManagerSyncLog`

Imports:
- From `enums`: documentCategoryEnum, extractionStatusEnum, documentTypeEnum, propertyManagerProviderEnum, pmConnectionStatusEnum, pmSyncTypeEnum, pmSyncStatusEnum
- From `auth`: users
- From `properties`: properties
- From `banking`: transactions

**Step 2: Commit**

```bash
git add src/server/db/schema/documents.ts && git commit -m "feat: extract document tables to schema/documents.ts"
```

---

### Task 11: Create `communication.ts` — email integration tables

**Files:**
- Create: `src/server/db/schema/communication.ts`

**Step 1: Create the file**

Tables:
- `emailConnections` (line 1229)
- `emailApprovedSenders` (line 1258)
- `senderPropertyHistory` (line 1281)
- `propertyEmails` (line 1151) — note: references `emailConnections` which is defined later in schema.ts. Reorder in the new file so `emailConnections` comes first.
- `propertyEmailAttachments` (line 1179)
- `propertyEmailInvoiceMatches` (line 1194)
- `propertyEmailSenders` (line 1208)

Relations: Most email tables don't have explicit relations defined in the current schema. No relation exports.

Type exports: `EmailConnection`, `NewEmailConnection`, `EmailApprovedSender`, `NewEmailApprovedSender`, `SenderPropertyHistory`, `NewSenderPropertyHistory`, `PropertyEmail`, `NewPropertyEmail`, `PropertyEmailAttachment`, `NewPropertyEmailAttachment`, `PropertyEmailInvoiceMatch`, `NewPropertyEmailInvoiceMatch`, `PropertyEmailSender`, `NewPropertyEmailSender`

Imports:
- From `enums`: emailStatusEnum, emailProviderEnum, emailConnectionStatusEnum, emailSourceEnum, invoiceMatchStatusEnum
- From `auth`: users
- From `properties`: properties
- From `banking`: transactions
- From `documents`: documents

**Step 2: Commit**

```bash
git add src/server/db/schema/communication.ts && git commit -m "feat: extract email/communication tables to schema/communication.ts"
```

---

### Task 12: Create `tax.ts` — tax profiles, depreciation, categorization

**Files:**
- Create: `src/server/db/schema/tax.ts`

**Step 1: Create the file**

Tables:
- `taxProfiles` (line 1532)
- `propertySales` (line 1012)
- `depreciationSchedules` (line 2443)
- `depreciationAssets` (line 2466)
- `taxSuggestions` (line 2487)
- `merchantCategories` (line 2406)
- `categorizationExamples` (line 2426)

Relations (lines 1923-1932, 2857-2909, 2929-2934):
- `propertySalesRelations`
- `taxProfilesRelations`
- `depreciationSchedulesRelations`
- `depreciationAssetsRelations`
- `taxSuggestionsRelations`
- `merchantCategoriesRelations`
- `categorizationExamplesRelations`

Type exports: `TaxProfile`, `NewTaxProfile`, `PropertySale`, `NewPropertySale`, `DepreciationSchedule`, `NewDepreciationSchedule`, `DepreciationAsset`, `NewDepreciationAsset`, `TaxSuggestion`, `NewTaxSuggestion`, `MerchantCategory`, `NewMerchantCategory`, `CategorizationExample`, `NewCategorizationExample`

Imports:
- From `enums`: familyStatusEnum, depreciationCategoryEnum, depreciationMethodEnum, taxSuggestionTypeEnum, taxSuggestionStatusEnum, categoryEnum
- From `auth`: users
- From `properties`: properties
- From `documents`: documents

**Step 2: Commit**

```bash
git add src/server/db/schema/tax.ts && git commit -m "feat: extract tax/depreciation tables to schema/tax.ts"
```

---

### Task 13: Create `scenarios.ts` — forecasts and what-if scenarios

**Files:**
- Create: `src/server/db/schema/scenarios.ts`

**Step 1: Create the file**

Tables:
- `forecastScenarios` (line 2104)
- `cashFlowForecasts` (line 2122)
- `scenarios` (line 2562) — has self-referential `parentScenarioId` using `(): any => scenarios.id`
- `scenarioFactors` (line 2589)
- `scenarioProjections` (line 2610)
- `scenarioSnapshots` (line 2623)

Relations (lines 2150-2171, 2761-2800):
- `forecastScenariosRelations`
- `cashFlowForecastsRelations`
- `scenariosRelations`
- `scenarioFactorsRelations`
- `scenarioProjectionsRelations`
- `scenarioSnapshotsRelations`

Type exports: `ForecastScenario`, `NewForecastScenario`, `CashFlowForecast`, `NewCashFlowForecast`, `Scenario`, `NewScenario`, `ScenarioFactor`, `NewScenarioFactor`, `ScenarioProjection`, `NewScenarioProjection`, `ScenarioSnapshot`, `NewScenarioSnapshot`

Imports:
- From `enums`: scenarioStatusEnum, factorTypeEnum
- From `auth`: users
- From `properties`: properties

**Step 2: Commit**

```bash
git add src/server/db/schema/scenarios.ts && git commit -m "feat: extract scenario tables to schema/scenarios.ts"
```

---

### Task 14: Create `portfolio.ts` — team, sharing, compliance, onboarding, milestones

**Files:**
- Create: `src/server/db/schema/portfolio.ts`

**Step 1: Create the file**

Tables:
- `sharingPreferences` (line 878)
- `portfolioMembers` (line 2301)
- `portfolioInvites` (line 2323)
- `auditLog` (line 2346)
- `portfolioShares` (line 2633)
- `complianceRecords` (line 2646)
- `equityMilestones` (line 2673)
- `milestonePreferences` (line 2695)
- `propertyMilestoneOverrides` (line 2707)
- `userOnboarding` (line 2279)

Relations (lines 1858-1863, 2294-2299, 2366-2404, 2802-2836):
- `sharingPreferencesRelations`
- `userOnboardingRelations`
- `portfolioMembersRelations`
- `portfolioInvitesRelations`
- `auditLogRelations`
- `portfolioSharesRelations`
- `complianceRecordsRelations`
- `milestonePreferencesRelations`
- `propertyMilestoneOverridesRelations`

No relation for `equityMilestones` in the current schema (it's just a table).

Type exports: `PortfolioMember`, `NewPortfolioMember`, `PortfolioInvite`, `NewPortfolioInvite`, `AuditLogEntry`, `NewAuditLogEntry`, `PortfolioShare`, `NewPortfolioShare`, `ComplianceRecord`, `NewComplianceRecord`, `EquityMilestone`, `NewEquityMilestone`, `MilestonePreferences`, `NewMilestonePreferences`, `PropertyMilestoneOverride`, `NewPropertyMilestoneOverride`, `UserOnboarding`, `NewUserOnboarding`

Imports:
- From `enums`: shareLevelEnum, portfolioMemberRoleEnum, inviteStatusEnum, auditActionEnum, privacyModeEnum, milestoneTypeEnum
- From `auth`: users
- From `properties`: properties
- From `documents`: documents

**Step 2: Commit**

```bash
git add src/server/db/schema/portfolio.ts && git commit -m "feat: extract portfolio/team tables to schema/portfolio.ts"
```

---

### Task 15: Create `features.ts` — feedback, changelog, blog, support

**Files:**
- Create: `src/server/db/schema/features.ts`

**Step 1: Create the file**

Tables:
- `featureRequests` (line 1566)
- `featureVotes` (line 1588)
- `featureComments` (line 1605)
- `bugReports` (line 1623)
- `changelogEntries` (line 1648)
- `userChangelogViews` (line 1659)
- `blogPosts` (line 1665)
- `supportTickets` (line 3086)
- `ticketNotes` (line 3112)

Relations (lines 2937-2973, 3131-3140):
- `featureRequestsRelations`
- `featureVotesRelations`
- `featureCommentsRelations`
- `bugReportsRelations`
- `supportTicketsRelations`
- `ticketNotesRelations`

Type exports: `FeatureRequest`, `NewFeatureRequest`, `FeatureVote`, `NewFeatureVote`, `FeatureComment`, `NewFeatureComment`, `BugReport`, `NewBugReport`, `ChangelogEntry`, `NewChangelogEntry`, `UserChangelogView`, `NewUserChangelogView`, `BlogPost`, `NewBlogPost`, `SupportTicket`, `NewSupportTicket`, `TicketNote`, `NewTicketNote`

Imports:
- From `enums`: featureRequestStatusEnum, featureRequestCategoryEnum, bugReportStatusEnum, bugReportSeverityEnum, changelogCategoryEnum, blogCategoryEnum, ticketCategoryEnum, ticketStatusEnum, ticketUrgencyEnum
- From `_common`: sql (for blogPosts tags default)
- From `auth`: users

**Step 2: Commit**

```bash
git add src/server/db/schema/features.ts && git commit -m "feat: extract feedback/support tables to schema/features.ts"
```

---

### Task 16: Create `notifications.ts` — notification preferences, push, logs

**Files:**
- Create: `src/server/db/schema/notifications.ts`

**Step 1: Create the file**

Tables:
- `notificationPreferences` (line 2173)
- `pushSubscriptions` (line 2193)
- `notificationLog` (line 2212)
- `pushTokens` (line 2262)

Relations (lines 2231-2277):
- `notificationPreferencesRelations`
- `pushSubscriptionsRelations`
- `notificationLogRelations`
- `pushTokensRelations`

Type exports: `NotificationPreferences`, `NewNotificationPreferences`, `PushSubscription`, `NewPushSubscription`, `NotificationLogEntry`, `NewNotificationLogEntry`, `PushToken`, `NewPushToken`

Imports:
- From `enums`: notificationTypeEnum, notificationChannelEnum, notificationStatusEnum
- From `auth`: users

**Step 2: Commit**

```bash
git add src/server/db/schema/notifications.ts && git commit -m "feat: extract notification tables to schema/notifications.ts"
```

---

### Task 17: Create `chat.ts` — tasks, chat conversations/messages

**Files:**
- Create: `src/server/db/schema/chat.ts`

**Step 1: Create the file**

Tables:
- `tasks` (line 2976)
- `chatConversations` (line 3018)
- `chatMessages` (line 3034)

Relations (lines 3052-3082):
- `tasksRelations`
- `chatConversationsRelations`
- `chatMessagesRelations`

Type exports: `Task`, `NewTask`

Imports:
- From `enums`: taskStatusEnum, taskPriorityEnum, chatMessageRoleEnum
- From `auth`: users
- From `properties`: properties
- From `entities`: entities

**Step 2: Commit**

```bash
git add src/server/db/schema/chat.ts && git commit -m "feat: extract task/chat tables to schema/chat.ts"
```

---

### Task 18: Create `billing.ts` — referrals, subscriptions, monitoring

**Files:**
- Create: `src/server/db/schema/billing.ts`

**Step 1: Create the file**

Tables:
- `referralCodes` (line 3318)
- `referrals` (line 3327)
- `referralCredits` (line 3351)
- `subscriptions` (line 3381)
- `cronHeartbeats` (line 3399)
- `monitorState` (line 3409)

Relations: None currently defined.

Type exports: None currently defined in schema.ts for these tables.

Imports:
- From `enums`: referralStatusEnum, subscriptionPlanEnum, subscriptionStatusEnum
- From `auth`: users

**Step 2: Commit**

```bash
git add src/server/db/schema/billing.ts && git commit -m "feat: extract billing/monitoring tables to schema/billing.ts"
```

---

### Task 19: Create `index.ts` barrel and delete original `schema.ts`

**Files:**
- Create: `src/server/db/schema/index.ts`
- Delete: `src/server/db/schema.ts`
- Modify: `drizzle.config.ts` (line 7)

**Step 1: Create the barrel**

```typescript
// src/server/db/schema/index.ts
// Barrel re-export — all domain modules.
// External code imports from "@/server/db/schema" unchanged.

export * from "./enums";
export * from "./auth";
export * from "./entities";
export * from "./properties";
export * from "./banking";
export * from "./recurring";
export * from "./loans";
export * from "./documents";
export * from "./communication";
export * from "./tax";
export * from "./scenarios";
export * from "./portfolio";
export * from "./features";
export * from "./notifications";
export * from "./chat";
export * from "./billing";
```

Note: `_common.ts` is NOT re-exported from the barrel. It's an internal helper for domain files only.

**Step 2: Delete original schema.ts**

```bash
rm src/server/db/schema.ts
```

**Step 3: Update drizzle.config.ts**

Change line 7 from:
```typescript
schema: "./src/server/db/schema.ts",
```
to:
```typescript
schema: "./src/server/db/schema",
```

This tells drizzle-kit to look at the `schema/` directory (resolves to `schema/index.ts`).

**Step 4: Verify `db/index.ts` needs no changes**

The existing `import * as schema from "./schema"` resolves to `./schema/index.ts` automatically — no change needed.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: barrel re-export + delete monolithic schema.ts"
```

---

### Task 20: Full verification

**Step 1: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If there are errors, they'll be import resolution issues — fix the domain file imports.

**Step 2: Lint**

```bash
npm run lint
```

Expected: Pass (or only pre-existing warnings).

**Step 3: Build**

```bash
npm run build
```

Expected: Success.

**Step 4: Run unit tests**

```bash
npm run test:unit
```

Expected: All existing tests pass.

**Step 5: Spin up DB and run E2E**

```bash
docker compose down && docker compose up -d
until docker compose exec db pg_isready -U postgres 2>/dev/null; do sleep 1; done
docker compose exec db psql -U postgres -c "CREATE DATABASE bricktrack;" 2>/dev/null || true
npx drizzle-kit push
npm run test:e2e
```

Expected: All E2E tests pass.

**Step 6: Commit any fixes**

If any tests failed, fix and re-run. Commit fixes.

---

### Task 21: Create PR and review

**Step 1: Push and create PR**

```bash
git push -u origin feature/refactor-wave1
gh pr create --base develop --title "refactor: Wave 1 — split schema.ts into domain modules" --body "$(cat <<'EOF'
## Summary
- Split monolithic `schema.ts` (3,416 lines) into 17 domain module files under `src/server/db/schema/`
- Each domain file contains tables, relations, and type exports
- Barrel `index.ts` re-exports everything — zero import changes outside `src/server/db/`
- Updated `drizzle.config.ts` schema path

## Files
- `_common.ts` — shared drizzle-orm imports + vector type
- `enums.ts` — all 71 enum definitions
- `auth.ts`, `entities.ts`, `properties.ts`, `banking.ts`, `recurring.ts`, `loans.ts`, `documents.ts`, `communication.ts`, `tax.ts`, `scenarios.ts`, `portfolio.ts`, `features.ts`, `notifications.ts`, `chat.ts`, `billing.ts`
- `index.ts` — barrel re-export

## Test plan
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:e2e` passes
- [ ] No import changes in any file outside `src/server/db/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 2: Run code review**

Use `/code-review` on the PR.

**Step 3: Wait for CI**

```bash
gh pr checks --watch
```

**Step 4: Merge**

```bash
gh pr merge --squash
```

**Step 5: Cleanup worktree**

```bash
cd ~/Documents/property-tracker
git worktree remove ~/worktrees/property-tracker/refactor-wave1
```

---

## Execution Notes

- **No TDD for this wave** — this is a pure mechanical file split with no new behavior. Validation is: does it still compile and pass all existing tests?
- **Circular imports** — Drizzle's `relations()` and FK `.references()` callbacks are lazy (evaluated at query/migration time). Cross-file imports between domain files work because by the time callbacks execute, all modules are loaded.
- **The `users` table `pendingBankPropertyId`** references `properties.id` while `properties` references `users.id`. This is a genuine circular reference handled by Drizzle's `AnyPgColumn` type + lazy callback. Works fine across files.
- **Order within domain files** — tables that are referenced by other tables in the same file should be defined first (e.g., `emailConnections` before `propertyEmails` in communication.ts).
