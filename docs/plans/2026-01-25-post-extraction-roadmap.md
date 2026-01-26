# Post-Extraction Roadmap

**Date:** 2026-01-25
**Status:** ✅ COMPLETE (except Vector DB)
**Updated:** 2026-01-26 (all features implemented)

## Strategic Positioning

**Target Market:**
- **Primary:** Serious DIY investors with 2-10 properties
- **Secondary:** Accountants serving property investor clients

**Value Proposition:**
> Professional property portfolio management without agency fees. Built for Australian investors who want real-time tax visibility, automated categorization, and forecasting - not just expense tracking.

**Evolved Positioning (from Gemini v2):**
> "We don't just track your assets; we optimize your wealth."

Move from "Property Tracker" (passive data) to "Investment Engine" (active insights). Users should open the app *before* making financial decisions, not just after.

---

## Monetization Model

| Tier | Price | Properties | Features |
|------|-------|------------|----------|
| **Free** | $0 | 1-2 | Manual entry, basic reports, compliance reminders, document storage |
| **Pro** | $19/month | Up to 10 | + Bank feeds, AI categorization, document extraction, forecasting, anomaly detection, loan comparison |
| **Team** | $39/month | Unlimited | + Multi-user access, accountant export, priority support |

**Gate triggers:**
- Free → Pro: "I want automation" (bank feeds, AI categorization)
- Pro → Team: "I need to share with my accountant" or "I have 10+ properties"

---

## V0.2 Roadmap Completion ✅ COMPLETE

### Phase 2.3: Property Manager Integrations ✅
**Status:** Complete
**Pain:** Duplicate data entry between PM software and tracker

Features implemented:
- ✅ PropertyMe OAuth integration
- ⏸️ :Different OAuth integration (deferred - no public API available)
- ✅ Auto-import: rent receipts, maintenance invoices, lease details
- ✅ Tenant information sync
- ✅ Property mapping UI

### Phase 2.4: React Native Mobile App ✅
**Status:** Complete (PR #18)
**Pain:** No mobile access, can't capture receipts on-the-go

Features implemented:
- ✅ Dashboard with portfolio summary
- ✅ Transaction list with swipe-to-categorize
- ✅ Push notification handling
- ✅ Document capture via camera
- ✅ Property quick view
- ✅ JWT-based mobile authentication
- ✅ Detox E2E tests (PR #19)

---

## Post-V0.2 Feature Priority ✅ ALL COMPLETE (except Vector DB)

### Tier 1: High Priority ✅

#### 1. Scenario Simulator (Interactive What-If) ✅
**Status:** Complete (PR #20)
**Source:** Gemini v2

Features implemented:
- ✅ Interactive toggles on forecasting page
- ✅ Interest rate change modeling
- ✅ Renovation ROE projections
- ✅ Vacancy rate adjustments
- ✅ Buy/sell property factors with CGT
- ✅ Tax profile integration
- ✅ Save scenarios for future reference

#### 2. Portfolio Share (PLG Viral Loop) ✅
**Status:** Complete (PR #21)
**Source:** Gemini v2

Features implemented:
- ✅ One-click shareable report generation
- ✅ Web link with optional expiry
- ✅ Manage shares page
- ✅ Revoke access functionality

#### 3. Compliance Calendar ✅
**Status:** Complete (PR #8)
**Source:** Gemini v1

Features implemented:
- ✅ State-specific compliance requirements database
- ✅ Property-level compliance checklist
- ✅ Automated reminders (daily cron job)
- ✅ Compliance audit report for each property
- ✅ Record completion modal

### Tier 2: Medium Priority ✅

#### 4. Equity Milestone Notifications ✅
**Status:** Complete (PR #22)
**Source:** Gemini v2

Features implemented:
- ✅ Configurable milestone thresholds
- ✅ LVR milestone alerts
- ✅ User-customizable settings

#### 5. Broker Portal / Refinance-Ready Report ✅
**Status:** Complete
**Source:** Gemini v1

Features implemented:
- ✅ One-click "Loan Application Pack" export
- ✅ Income summary, expense breakdown, property valuations, loan details
- ✅ Broker management (CRUD)
- ✅ Broker detail page with pack history
- ✅ PDF export

#### 6. Climate/Flood Risk Integration ✅
**Status:** Complete
**Source:** Gemini v2

Features implemented:
- ✅ Flood risk score per property
- ✅ Bushfire risk score
- ✅ Climate Resilience Score
- ✅ ClimateRiskCard component on property detail
- ✅ ClimateRiskSummary on dashboard
- ✅ Backfill script for existing properties

### Tier 3: Lower Priority ✅ (mostly complete)

#### 7. Trust/SMSF Entity Support ✅
**Status:** Complete (PR #14 Phase 1, PR #15 Phase 2)
**Source:** Gemini v1

Features implemented:
- ✅ Entity types: Individual, Joint, Family Trust, Unit Trust, SMSF, Company
- ✅ Entity-level reporting
- ✅ Beneficiary/trustee tracking
- ✅ Entity switcher in sidebar
- ✅ SMSF compliance tracking
- ✅ Trust compliance tracking

#### 8. Financial Leak Benchmarking ✅
**Status:** Complete (PR #13)
**Source:** Gemini v1

Features implemented:
- ✅ Compare user's costs against suburb/state averages
- ✅ Insurance premium benchmarking
- ✅ Property management fee comparison
- ✅ "Potential savings" alerts
- ✅ BenchmarkCard and SavingsWidget components

#### 9. Property Performance Benchmarking ✅
**Status:** Complete (PR #16)
**Note:** Added beyond original roadmap

Features implemented:
- ✅ Suburb benchmark data
- ✅ Performance benchmarking calculations
- ✅ PerformanceCard component

#### 10. Tax Position Calculator ✅
**Status:** Complete (PR #23)
**Note:** Added beyond original roadmap

Features implemented:
- ✅ Real-time tax position calculation
- ✅ Depreciation tracking
- ✅ Deduction summaries

#### 11. Vector DB Similar Property Alerts ⏸️
**Status:** Not started (deferred)
**Source:** Gemini v2
**Reason:** Requires new infrastructure (Pinecone/Milvus), low priority

Features planned:
- "Similar Property" alerts based on portfolio performance
- ML-powered property recommendations
- Suburb performance comparisons

---

## Implementation Order (Full Roadmap)

| Phase | Feature | Est. Complexity | Status | PR |
|-------|---------|-----------------|--------|-----|
| **2.3** | Property Manager Integrations | High | ✅ Complete | - |
| **2.4** | React Native Mobile App | High | ✅ Complete | #18, #19 |
| **3.1** | Scenario Simulator | Medium | ✅ Complete | #20 |
| **3.2** | Portfolio Share | Low-Medium | ✅ Complete | #21 |
| **3.3** | Compliance Calendar | Medium | ✅ Complete | #8 |
| **3.4** | Equity Milestone Notifications | Low | ✅ Complete | #22 |
| **3.5** | Broker Portal | Low-Medium | ✅ Complete | - |
| **3.6** | Climate/Flood Risk | Medium | ✅ Complete | - |
| **3.7** | Trust/SMSF Entity Support | High | ✅ Complete | #14, #15 |
| **3.8** | Financial Leak Benchmarking | Medium | ✅ Complete | #13 |
| **3.9** | Property Performance Benchmarking | Medium | ✅ Complete | #16 |
| **3.10** | Tax Position Calculator | Medium | ✅ Complete | #23 |
| **3.11** | Vector DB Similar Properties | High | ⏸️ Deferred | - |

---

## Distribution Strategy

1. **Product-Led Growth:** Portfolio Share feature = viral loop with watermark
2. **Broker Trojan Horse:** Light dashboard for brokers to give clients
3. **Trust Intermediaries:** Mortgage brokers (Broker Portal creates referral loop)
4. **Communities:** r/AusFinance, r/AusPropertyChat, PropertyChat forums
5. **SEO:** Target "property tracker Australia", "rental property tax deductions", "Victorian rental compliance"
6. **Accountant Channel:** Team tier with multi-user access

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Free → Pro conversion | >5% |
| Pro monthly churn | <3% |
| Compliance reminders actioned | >70% |
| Portfolio shares generated/month | Growth indicator |
| Scenario simulations run/user | >2/month |
| Broker portal exports/month | Growth indicator |
| NPS | >50 |
