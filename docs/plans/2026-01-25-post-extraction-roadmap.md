# Post-Extraction Roadmap

**Date:** 2026-01-25
**Status:** Approved

## Strategic Positioning

**Target Market:**
- **Primary:** Serious DIY investors with 2-10 properties
- **Secondary:** Accountants serving property investor clients

**Value Proposition:**
> Professional property portfolio management without agency fees. Built for Australian investors who want real-time tax visibility, automated categorization, and forecasting - not just expense tracking.

**Positioning:** Beyond "tracking" into active portfolio optimization and compliance automation.

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

## Feature Priority (Post Smart Document Extraction)

### Priority 1: Compliance Calendar
**Pain:** Victorian minimum rental standards, smoke alarm checks, gas safety audits, lease renewals
**Effort:** Medium
**Value:** High differentiator, reduces landlord anxiety

Features:
- State-specific compliance requirements database
- Property-level compliance checklist (14+ minimum standards for VIC)
- Automated reminders (smoke alarm annual check, gas safety every 2 years, lease expiry)
- Compliance audit report for each property
- "Compliance Score" per property

### Priority 2: Broker Portal / Refinance-Ready Report
**Pain:** Gathering documents for loan applications is tedious
**Effort:** Low-Medium
**Value:** Distribution channel (brokers recommend the app)

Features:
- One-click "Loan Application Pack" export
- Includes: income summary, expense breakdown, property valuations, loan details
- PDF or structured data format
- Shareable link with expiry
- Broker can request updated report from client

### Priority 3: Trust/SMSF Entity Support
**Pain:** Sophisticated investors use trusts, current schema assumes individual ownership
**Effort:** High (schema changes, tax treatment differs)
**Value:** Unlocks high-value segment

Features:
- Entity types: Individual, Joint, Family Trust, Unit Trust, SMSF, Company
- Entity-level reporting and tax position
- Beneficiary/trustee tracking
- Different depreciation rules for SMSF

### Priority 4: Property Manager Integrations
**Pain:** Duplicate data entry between PM software and tracker
**Effort:** High (OAuth, API mapping, sync logic)
**Value:** Automation for managed properties

Features:
- PropertyMe OAuth integration
- :Different OAuth integration
- Auto-import: rent receipts, maintenance invoices, lease details
- Tenant information sync
- Two-way sync where APIs allow

### Priority 5: Financial Leak Benchmarking
**Pain:** Am I overpaying for insurance/rates/management?
**Effort:** Medium (requires market data sources)
**Value:** Nice-to-have optimization

Features:
- Compare user's costs against suburb/state averages
- Insurance premium benchmarking
- Property management fee comparison
- "Potential savings" alerts

---

## Implementation Order

| Phase | Feature | Est. Complexity |
|-------|---------|-----------------|
| 2.4 | Compliance Calendar | Medium |
| 2.5 | Broker Portal / Refinance-Ready Report | Low-Medium |
| 2.6 | Trust/SMSF Entity Support | High |
| 2.7 | Property Manager Integrations | High |
| 2.8 | Financial Leak Benchmarking | Medium |

---

## Distribution Strategy

1. **Trust Intermediaries:** Mortgage brokers (Broker Portal creates referral loop)
2. **Communities:** r/AusFinance, r/AusPropertyChat, PropertyChat forums
3. **SEO:** Target "property tracker Australia", "rental property tax deductions", "Victorian rental compliance"
4. **Accountant Channel:** Team tier with multi-user access

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Free → Pro conversion | >5% |
| Pro monthly churn | <3% |
| Compliance reminders actioned | >70% |
| Broker portal exports/month | Growth indicator |
| NPS | >50 |
