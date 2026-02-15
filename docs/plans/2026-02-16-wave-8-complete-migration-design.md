# Wave 8 — Complete Single-Domain Migration Design

## Goal

Migrate all remaining single-domain `ctx.db` usages to `ctx.uow` repository methods. After this wave, every remaining `ctx.db` in routers will be a documented cross-domain aggregation.

## Architecture

Add methods to 3 existing repositories (ComplianceRepository, LoanRepository, BankAccountRepository) and create 1 new repository (TaxRepository). Migrate 9 router files. One repository per domain — no micro-repos per table.

## Scope

### New Repository: TaxRepository

**Tables covered:** taxProfiles, taxSuggestions, depreciationSchedules, depreciationAssets

**Methods (~12):**
- `findProfileByUserAndYear(userId, financialYear)` → `TaxProfile | null`
- `createProfile(data)` → `TaxProfile`
- `updateProfile(id, userId, data)` → `TaxProfile | null`
- `findSuggestions(userId, financialYear, status)` → `TaxSuggestionWithProperty[]`
- `countSuggestionsByStatus(userId, status)` → `number`
- `updateSuggestionStatus(id, userId, status)` → `TaxSuggestion | null`
- `actionSuggestionsByPropertyAndType(userId, propertyId, type)` → `void`
- `findSchedulesByUser(userId, opts?)` → `DepreciationScheduleWithRelations[]`
- `createSchedule(data)` → `DepreciationSchedule`
- `deleteSchedule(id, userId)` → `void`
- `createAssets(assets)` → `DepreciationAsset[]`

### Extend ComplianceRepository

**New methods (~10) for trust compliance:**
- `findBeneficiaries(entityId)` → `Beneficiary[]`
- `findBeneficiaryById(id)` → `Beneficiary | null`
- `createBeneficiary(data)` → `Beneficiary`
- `updateBeneficiary(id, data)` → `Beneficiary`
- `findTrustDistributions(entityId)` → `TrustDistributionWithAllocations[]`
- `findTrustDistributionById(id)` → `TrustDistributionWithAllocations | null`
- `findTrustDistributionByYear(entityId, year)` → `TrustDistribution | null`
- `createTrustDistribution(data)` → `TrustDistribution`
- `createDistributionAllocations(data[])` → `DistributionAllocation[]`
- `createTrustDetails(data)` → `TrustDetails`

**Entity queries in entity.ts** touch entities/entityMembers/trustDetails/smsfDetails — these belong to ComplianceRepository since entities are a compliance concept.

### Extend LoanRepository

**New methods (~16) for broker, loanPack, loanComparison, refinanceAlerts:**

Broker:
- `listBrokersWithStats(userId)` → `BrokerWithPackStats[]`
- `findBrokerById(id, userId)` → `Broker | null`
- `findBrokerPacks(brokerId)` → `LoanPack[]`
- `createBroker(data)` → `Broker`
- `updateBroker(id, userId, data)` → `Broker`
- `deleteBroker(id, userId)` → `void`

LoanPack:
- `createLoanPack(data)` → `LoanPack`
- `findLoanPacksByOwner(userId)` → `LoanPackWithBroker[]`
- `deleteLoanPack(id, userId)` → `void`
- `findLoanPackByToken(token)` → `LoanPack | null`
- `incrementLoanPackAccess(id)` → `LoanPack`

LoanComparison:
- `createComparison(data)` → `LoanComparison`
- `findComparisonsByOwner(userId, loanId?)` → `LoanComparisonWithRelations[]`
- `deleteComparison(id, userId)` → `void`

RefinanceAlert:
- `findRefinanceAlert(loanId)` → `RefinanceAlert | null`
- `upsertRefinanceAlert(loanId, data)` → `RefinanceAlert`

### Extend BankAccountRepository

**New methods (~7) for anomaly alerts and merchant categories:**

AnomalyAlerts:
- `findAnomalyAlerts(userId, opts?)` → `AnomalyAlertWithRelations[]`
- `findAnomalyAlertById(id, userId)` → `AnomalyAlert | null`
- `getAnomalyAlertCounts(userId, status)` → `{ total, critical, warning, info }`
- `updateAnomalyAlertStatus(id, userId, data)` → `AnomalyAlert`
- `bulkUpdateAnomalyAlertStatus(ids, userId, data)` → `number`
- `createAnomalyAlerts(alerts)` → `AnomalyAlert[]`

MerchantStats:
- `findMerchantCategories(userId, opts?)` → `MerchantCategory[]`
- `countCategorizationExamples(userId)` → `number`

### Router Migrations

| Router | From | To |
|--------|------|-----|
| compliance/trustCompliance | 12 ctx.db | ctx.uow.compliance |
| compliance/entity | ~10 ctx.db | ctx.uow.compliance (1 property check stays cross-domain) |
| lending/loanComparison | 7 ctx.db | ctx.uow.loan |
| lending/broker | 7 ctx.db | ctx.uow.loan |
| lending/loanPack | 4 ctx.db | ctx.uow.loan |
| banking/anomaly | 5 ctx.db | ctx.uow.bankAccount |
| banking/categorization | 3 ctx.db | ctx.uow.bankAccount |
| banking/banking | 1 ctx.db | ctx.uow.bankAccount |
| tax/taxPosition | 5 ctx.db | ctx.uow.tax (2 transaction queries stay cross-domain) |
| tax/taxOptimization | 6 ctx.db | ctx.uow.tax (1 document query stays cross-domain) |

### Out of Scope (cross-domain, kept with comments)

- analytics/* (dashboard, reports, benchmarking) — multi-domain aggregation
- lending/cashFlowCalendar — 6-domain calendar view
- documents/documentExtraction — cross-domain extraction logic
- portfolio/share — multi-domain snapshot
- scenario/scenario — portfolio state aggregation
- banking/recurring — transaction-recurring reconciliation
- user/mobileAuth — publicProcedure, no ctx.uow
- banking/banking service functions (getKnownMerchants, getHistoricalAverage) — service layer, not router

## Verification

- `npx tsc --noEmit` — 0 errors
- `npx next lint` — 0 new warnings
- `npm run test:unit` — all pass
- All remaining ctx.db usages in routers have cross-domain comments
