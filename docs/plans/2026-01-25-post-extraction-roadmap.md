# Post-Extraction Roadmap

**Date:** 2026-01-25
**Status:** Approved
**Updated:** 2026-01-25 (added Gemini v2 feedback items)

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

## V0.2 Roadmap Completion (In Progress)

### Phase 2.3 (Remaining): Property Manager Integrations
**Status:** Not started
**Pain:** Duplicate data entry between PM software and tracker
**Effort:** High (OAuth, API mapping, sync logic)

Features:
- PropertyMe OAuth integration
- :Different OAuth integration
- Auto-import: rent receipts, maintenance invoices, lease details
- Tenant information sync
- Two-way sync where APIs allow

### Phase 2.4: React Native Mobile App
**Status:** Not started
**Pain:** No mobile access, can't capture receipts on-the-go
**Effort:** High

Features:
- Dashboard with portfolio summary
- Transaction list with swipe-to-categorize
- Push notification handling
- Document capture via camera
- Property quick view
- Biometric authentication (Face ID, fingerprint)
- Offline transaction categorization with sync

---

## Post-V0.2 Feature Priority

### Tier 1: High Priority (Next after v0.2)

#### 1. Scenario Simulator (Interactive What-If)
**Source:** Gemini v2
**Pain:** Users suffer from "Data Fatigue" - they see data but can't model decisions
**Effort:** Medium
**Value:** High - transforms app from passive to active decision tool

Features:
- Interactive toggles on forecasting page
- "What if interest rates rise by 0.5%?"
- "What if I renovate for $20k - projected ROE?"
- "What if vacancy increases to 4 weeks?"
- Compare scenarios side-by-side
- Save scenarios for future reference

**PMF Signal:** Users open the app *before* making financial decisions.

#### 2. Portfolio Share (PLG Viral Loop)
**Source:** Gemini v2
**Pain:** Can't easily share portfolio performance with brokers/partners
**Effort:** Low-Medium
**Value:** High - free distribution channel

Features:
- One-click shareable report generation
- Beautiful PDF export with key metrics
- Web link with optional expiry
- Redacted mode (hide exact values, show percentages)
- "Powered by PropertyTracker" watermark
- Broker-specific format for loan applications

**Distribution:** Every shared report is a free advertisement.

#### 3. Compliance Calendar
**Source:** Gemini v1
**Pain:** Victorian minimum rental standards, smoke alarm checks, gas safety audits, lease renewals
**Effort:** Medium
**Value:** High differentiator, reduces landlord anxiety

Features:
- State-specific compliance requirements database
- Property-level compliance checklist (14+ minimum standards for VIC)
- Automated reminders (smoke alarm annual check, gas safety every 2 years, lease expiry)
- Compliance audit report for each property
- "Compliance Score" per property

### Tier 2: Medium Priority

#### 4. Equity Milestone Notifications
**Source:** Gemini v2
**Pain:** Users don't know when they've hit refinancing thresholds
**Effort:** Low
**Value:** Medium - engagement driver

Features:
- Push notification: "Your property just hit $100k in usable equity!"
- Configurable milestone thresholds
- Link to refinance options when triggered
- LVR milestone alerts (e.g., "You've dropped below 80% LVR")

#### 5. Broker Portal / Refinance-Ready Report
**Source:** Gemini v1
**Pain:** Gathering documents for loan applications is tedious
**Effort:** Low-Medium
**Value:** Medium-High - distribution channel

Features:
- One-click "Loan Application Pack" export
- Includes: income summary, expense breakdown, property valuations, loan details
- PDF or structured data format
- Shareable link with expiry
- Broker can request updated report from client
- "Mortgage Broker Trojan Horse" - light version for brokers to give clients

#### 6. Climate/Flood Risk Integration
**Source:** Gemini v2
**Pain:** Investors terrified of uninsurable assets
**Effort:** Medium (requires external API)
**Value:** Medium-High - trust builder

Features:
- Flood risk score per property
- Bushfire risk score
- Energy Efficiency (EPC) ratings where available
- Insurance risk indicators
- "Climate Resilience Score"
- Alerts for high-risk properties

### Tier 3: Lower Priority

#### 7. Trust/SMSF Entity Support
**Source:** Gemini v1
**Pain:** Sophisticated investors use trusts, current schema assumes individual ownership
**Effort:** High (schema changes, tax treatment differs)
**Value:** Unlocks high-value segment

Features:
- Entity types: Individual, Joint, Family Trust, Unit Trust, SMSF, Company
- Entity-level reporting and tax position
- Beneficiary/trustee tracking
- Different depreciation rules for SMSF

#### 8. Financial Leak Benchmarking
**Source:** Gemini v1
**Pain:** Am I overpaying for insurance/rates/management?
**Effort:** Medium (requires market data sources)
**Value:** Nice-to-have optimization

Features:
- Compare user's costs against suburb/state averages
- Insurance premium benchmarking
- Property management fee comparison
- "Potential savings" alerts

#### 9. Vector DB Similar Property Alerts
**Source:** Gemini v2
**Pain:** No ML-based property comparisons
**Effort:** High (new infrastructure - Pinecone/Milvus)
**Value:** Low-Medium - nice-to-have

Features:
- "Similar Property" alerts based on portfolio performance
- ML-powered property recommendations
- Suburb performance comparisons

---

## Implementation Order (Full Roadmap)

| Phase | Feature | Est. Complexity | Status |
|-------|---------|-----------------|--------|
| **2.3** | Property Manager Integrations | High | Not started |
| **2.4** | React Native Mobile App | High | Not started |
| **3.1** | Scenario Simulator | Medium | Planned |
| **3.2** | Portfolio Share | Low-Medium | Planned |
| **3.3** | Compliance Calendar | Medium | Planned |
| **3.4** | Equity Milestone Notifications | Low | Planned |
| **3.5** | Broker Portal | Low-Medium | Planned |
| **3.6** | Climate/Flood Risk | Medium | Planned |
| **3.7** | Trust/SMSF Entity Support | High | Planned |
| **3.8** | Financial Leak Benchmarking | Medium | Planned |
| **3.9** | Vector DB Similar Properties | High | Planned |

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
