# BrickTrack vs TaxTank Property Tank — Side-by-Side Comparison

**Date:** 2026-02-08
**Purpose:** Product roadmap prioritisation — identify where BrickTrack trails, matches, or leads TaxTank to guide what to build next.
**Sources:** Live product walkthroughs of both platforms + full BrickTrack codebase audit.

---

## At a Glance

| Dimension | BrickTrack | TaxTank Property Tank | Verdict |
|-----------|-----------|----------------------|---------|
| **Price** | Free / $19 / $39 | $15/mo (annual only) | BrickTrack has free tier advantage |
| **Properties (Free)** | 1 | N/A (no free tier) | BrickTrack wins |
| **Properties (Paid)** | Unlimited | 5 included, +$2.67/mo each | BrickTrack wins |
| **Tech Stack** | Next.js + Tailwind + shadcn | Angular Material | BrickTrack is 5+ years newer |
| **Visual Design** | Modern (2025-2026) | Dated (2019-2020) | BrickTrack leads |
| **Tax Depth** | Basic (categories + reports) | Deep (depreciation, CGT, MyTax) | TaxTank leads |
| **AI Features** | Categorization + extraction | None in Property Tank | BrickTrack leads |
| **Valuations** | None (PropTrack blocked) | CoreLogic auto-populated | TaxTank leads |
| **Bank Feeds** | Basiq (100+ banks) | Basiq | Parity |
| **Report Count** | 8 | 8 | Parity (different mix) |

---

## 1. Property Management

### Add Property Flow

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Form type | Dedicated page | 2-step modal wizard | Different approach, both work |
| Address autocomplete | Manual entry only | CoreLogic-powered | **BrickTrack trails** |
| Manual address fallback | Always manual | "Add manually" option | N/A |
| Street address | ✓ | ✓ | Parity |
| Unit number | Not captured | ✓ | **BrickTrack trails** |
| Suburb / State / Postcode | ✓ | ✓ | Parity |
| Entity / Portfolio type | Entity dropdown | Portfolio dropdown (5 types) | Parity |
| Purchase price | ✓ | ✓ | Parity |
| Purchase date | ✓ | Contract date + Settlement date | **BrickTrack trails** (no settlement date) |
| Ownership % | Not captured | ✓ | **BrickTrack trails** |
| Market value (step 2) | Not available | CoreLogic auto-populated | **BrickTrack trails** |
| Growth forecast | Not available | Slider (4-10% range) | **BrickTrack trails** |
| Annual forecasts | Not available | Rental income/expenses/interest/depreciation | **BrickTrack trails** |
| "Estimations are fine" copy | N/A | ✓ (reduces anxiety) | Nice UX touch to copy |

**Roadmap implication:** The Add Property flow is BrickTrack's biggest UX gap. TaxTank captures 5 more data points that feed downstream analytics. Priority: add address autocomplete, ownership %, settlement date, and a valuation step.

### Property Detail View

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Key metrics visible | Address, price, date, entity | Market value, equity, tax position, cash position | **BrickTrack trails significantly** |
| Tabbed sections | None (single card) | 5 tabs (Expenses, Income, Depreciation, Equity, Property) | **BrickTrack trails significantly** |
| Property map | None | Australia outline + pin (basic) | **BrickTrack trails** — added to Phase 1 roadmap |
| Property photo | None | None | Parity (both weak) |
| Trend indicators | None | Up/down arrows on each metric | **BrickTrack trails** |
| Transaction history (scoped) | Not on detail page | Accordion per tab (Summary + History) | **BrickTrack trails** |
| Getting started goals | None on detail page | Checklist sidebar (Add Capital Costs, etc.) | **BrickTrack trails** |
| Edit property | Dedicated page | Inline on Property tab | Different approach |
| Active status badge | ✓ (green pill) | Not visible | BrickTrack leads |

**Roadmap implication:** Property detail is the weakest page in BrickTrack. Users who add a property land on a near-empty page. Priority: add financial metrics + tabbed sections (PR #161 addresses cards, but detail page needs similar treatment).

### Property Card (List View)

| Feature | BrickTrack (Current) | BrickTrack (PR #161) | TaxTank |
|---------|---------------------|---------------------|---------|
| Property name | ✓ | ✓ | ✓ |
| Address | ✓ | ✓ | ✓ |
| Purchase price | ✓ | Fallback only | Not shown directly |
| Market value | - | ✓ (from metrics) | ✓ |
| Equity | - | ✓ | ✓ |
| LVR | - | ✓ (color-coded) | - |
| Cash flow | - | ✓ (monthly, +/-) | ✓ (cash position) |
| Tax position | - | - | ✓ |
| Rental yield | - | ✓ (gross) | ✓ (rental return %) |
| Trend arrows | - | ✓ (up/down icons) | ✓ (up/down arrows) |
| Entity badge | ✓ | ✓ | Portfolio type |
| Expand/collapse | - | - | ✓ (accordion detail) |
| Line items | - | - | Income, Expenses, Interest, Depreciation |

**Roadmap implication:** PR #161 closes most of the card gap. Remaining: add tax position metric and consider expand/collapse for inline detail.

---

## 2. Transaction Management

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Add transaction form | Dedicated page | Modal dialog | Different approach (BrickTrack's is better for complex entry) |
| Category count | 27 (4 groups) | 37+ (3 groups) | **BrickTrack trails** (10 fewer categories) |
| ATO alignment | Good | Excellent (deeply mapped) | **BrickTrack trails slightly** |
| CSV import | ✓ | Via bank feeds | BrickTrack leads |
| Receipt upload | Not available | Drag-and-drop (png/pdf/doc) | **BrickTrack trails** |
| Bank feed source | Basiq (100+ banks) | Basiq | Parity |
| Transaction verification | ✓ (checkbox column) | ✓ | Parity |
| Filtering | Property, Category, Status, Date range | Similar | Parity |
| Reconciliation tab | ✓ | ✓ (via bank feeds) | Parity |
| Notes field | ✓ (optional) | ✓ (description) | Parity |
| AI auto-categorization | ✓ (dedicated Review page + confidence) | Not available | **BrickTrack leads significantly** |
| Bulk categorization | ✓ (bulkUpdateCategory) | Manual per-transaction | **BrickTrack leads** |

### Missing Categories (BrickTrack vs TaxTank)

BrickTrack is missing these TaxTank categories that investors commonly need:
- Body Corporate Special Levy (separate from fees)
- Landlord Insurance (separate from general Insurance)
- Letting Fees / Inspection Fees / Tribunal Fees / Platform Fees (separate from Property Agent Fees)
- Electrical / Plumbing / AC-specific Repairs
- Keys & Locks, Smoke Alarm Service
- Telephone/Mobile, Internet (separate from Stationery & Postage)
- Water Tank (separate from Water Charges)
- Depreciation Schedule (as expense type)
- Loan Drawdown
- Funds over (Adjustment)
- Rent not paid out (Held by agent)
- Landlord Reimbursement

**Roadmap implication:** AI categorization is a genuine differentiator — double down. But expand the category taxonomy to match ATO depth, especially for granular expense types that accountants expect.

---

## 3. Tax & Reporting

### Reports Comparison

| Report Type | BrickTrack | TaxTank | Notes |
|------------|-----------|---------|-------|
| **Tax Report** | ✓ ATO-compliant | ✓ Property Schedule | Parity |
| **MyTax Export** | ✓ Interactive checklist | ✓ MyTax coded | Parity |
| **CGT Report** | ✓ Cost base + 50% discount | ✓ Net capital gains + concessions | Parity |
| **Portfolio Dashboard** | ✓ (feature-flagged) | ✓ (Portfolio overview) | Parity if unflagged |
| **Cash Flow Forecast** | ✓ 12-month + scenarios | Not available | **BrickTrack leads** |
| **Year-over-Year** | ✓ Expense comparison | In reports only (not dedicated) | **BrickTrack leads** |
| **Audit Checks** | ✓ Per-property scoring | Not available | **BrickTrack leads** |
| **Accountant Export** | ✓ Complete package | Not dedicated | **BrickTrack leads** |
| **Depreciation Report** | Not available | ✓ Div 40 + Div 43 | **BrickTrack trails** |
| **Low Value Pool** | Not available | ✓ $301-$1,000 assets | **BrickTrack trails** |
| **Borrowing Power** | Not available | ✓ Net surplus + ratio | **BrickTrack trails** |
| **Net Asset** | Not available | ✓ Cross-tank | **BrickTrack trails** |
| **Income & Expense** | In portfolio dashboard | ✓ Prior year comparison | Parity |
| **Transactions Report** | ✓ (transaction list) | ✓ Per-category detail | Parity |

**Score: BrickTrack 8, TaxTank 8** — same count but different strengths. BrickTrack is stronger on investor analytics (forecast, YoY, audit). TaxTank is stronger on tax compliance (depreciation, low value pool, borrowing power).

### Depreciation

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Depreciation UI | Not built | Full page with method toggle | **BrickTrack trails significantly** |
| Div 40 (plant & equipment) | Not available | ✓ Diminishing Value / Prime Cost | **BrickTrack trails** |
| Div 43 (capital works) | Not available | Implicit through method | **BrickTrack trails** |
| Prior/Current/Next year claims | Not available | ✓ | **BrickTrack trails** |
| Depreciation schedule upload | Settlement extraction covers some | ✓ | Partial |

**Roadmap implication:** Depreciation is the #1 missing tax feature. Australian property investors claim ~$2.5B in depreciation annually. This is table stakes for a tax-focused product.

### Tax Position

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Tax position summary | ✓ (dedicated page) | ✓ (dashboard card) | Parity |
| Cash position | Not visible | ✓ (dashboard card) | **BrickTrack trails** |
| FY selector | Not available | ✓ (top bar dropdown) | **BrickTrack trails** |
| Tax + Cash % change | Not visible | ✓ (trend indicators) | **BrickTrack trails** |

---

## 4. Valuations & Equity

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Market valuation source | PropTrack (blocked on API) | CoreLogic (active) | **BrickTrack trails** |
| Auto-populated values | Not available | ✓ (step 2 of add property) | **BrickTrack trails** |
| Manual value entry | Built but flagged | ✓ ("Add Market Values" button) | **BrickTrack trails** (unflag to fix) |
| Growth forecast | Not available | Slider (4-10% range) | **BrickTrack trails** |
| Equity position | Built but flagged | ✓ (key metric on detail page) | **BrickTrack trails** (unflag to fix) |
| Equity forecast chart | Not available | 25-year projection (2025-2051) | **BrickTrack trails** |
| LVR calculation | Built (metrics query) | LVR donut chart on dashboard | Parity if unflagged |
| Valuation history | Built but flagged | ✓ (searchable accordion) | **BrickTrack trails** (unflag to fix) |

**Roadmap implication:** Much of this is built and feature-flagged off. Unflagging Property Valuation would immediately close 3-4 gaps. The PropTrack API key remains the blocker for automated valuations.

---

## 5. Integrations & Data

| Integration | BrickTrack | TaxTank | Notes |
|------------|-----------|---------|-------|
| **Bank feeds** | Basiq (100+ banks) | Basiq | Parity |
| **Property valuations** | PropTrack (blocked) | CoreLogic (active) | **TaxTank leads** |
| **Shares/Crypto** | Not applicable | Sharesight integration | TaxTank is multi-asset |
| **Email forwarding** | Gmail OAuth (active) | Not in Property Tank | **BrickTrack leads** |
| **Live chat** | Not available | Intercom widget | **TaxTank leads** (support UX) |
| **Advisor booking** | Built but flagged | Brevo (meet.brevo.com) | TaxTank leads (active) |
| **Property manager** | PropertyMe sync (available) | Not available | **BrickTrack leads** |
| **Analytics** | PostHog | Not visible | BrickTrack has product analytics |
| **Document extraction** | AI-powered (settlement) | Not available | **BrickTrack leads** |

---

## 6. Onboarding & Empty States

| Feature | BrickTrack | TaxTank | Gap |
|---------|-----------|---------|-----|
| Welcome modal | ✓ (3-step: Add property, Connect bank, Ready) | Not observed | **BrickTrack leads** |
| Setup progress checklist | ✓ (5 steps, dismissible) | ✓ (3 goals, dismissible) | Parity |
| Guided tour | Not available | ✓ ("Start Tour" button) | **BrickTrack trails** |
| Banking empty state | ✓ (illustration + CTA) | N/A (bank feeds section) | Good |
| Loans empty state | ✓ (illustration + CTA) | N/A | Good |
| Properties empty state | Skeleton cards (misleading) | Not observed | **BrickTrack issue** — skeletons suggest loading, not empty |
| Transaction empty state | Not observed | "No transactions" text | Both weak |
| "Estimations are fine" copy | Not used | ✓ (reduces data entry anxiety) | Nice UX to adopt |

**Roadmap implication:** Fix the properties empty state (show illustration + CTA, not skeleton cards). Consider adding a guided tour for first-time users.

---

## 7. Pricing Comparison

| Aspect | BrickTrack | TaxTank |
|--------|-----------|---------|
| Free tier | ✓ (1 property, basic tracking) | 14-day free trial only |
| Lowest paid | $19/mo (unlimited properties) | $15/mo annual ($180/yr for 5 properties) |
| Per-property cost | $0 (unlimited on Pro) | $2.67/mo per extra property |
| 10-property cost | $19/mo | $15 + (5 x $2.67) = $28.35/mo |
| 20-property cost | $19/mo | $15 + (15 x $2.67) = $55.05/mo |
| Team/multi-user | $39/mo (5 members) | No team plan (individual only) |
| Annual discount | Not observed | Required (no monthly billing) |
| Multi-product discount | N/A | 5-20% across tanks |

**Pricing advantage:** BrickTrack is dramatically cheaper for portfolios of 5+ properties. The unlimited model is a significant competitive moat against TaxTank's per-property pricing. This should be a headline marketing message.

---

## 8. Design & UX Comparison

| Aspect | BrickTrack | TaxTank |
|--------|-----------|---------|
| **Framework** | Next.js + Tailwind + shadcn (2025) | Angular Material (2019) |
| **Primary color** | Forest green (#16a34a) | Teal/Cyan (#00BCD4) |
| **Card style** | White + subtle border | White + shadow |
| **Form pattern** | Dedicated pages with breadcrumbs | Modal dialogs over page |
| **Icon set** | Lucide (modern, consistent) | Material Icons (dated) |
| **Loading states** | Skeleton shimmer | Basic spinners |
| **Empty states** | Illustrated (Banking, Loans) | Text-only ("No transactions") |
| **Navigation** | Collapsible sidebar | Fixed sidebar (icon + label) |
| **Data density** | Low (sparse, breathing room) | High (accordions, packed) |
| **Information disclosure** | Pages + breadcrumbs | Accordions + expandable |
| **Mobile readiness** | Better (collapsible sidebar) | Worse (fixed sidebar) |
| **Accessibility** | shadcn/Radix (built-in a11y) | Angular Material (decent) |

**Design verdict:** BrickTrack's design is objectively more modern and polished. The risk is that it currently feels *too* sparse — empty pages with few metrics create a "where's the data?" impression. TaxTank's density, while dated, makes users feel the product is *working* for them. The fix isn't to copy TaxTank's density — it's to populate BrickTrack's clean layouts with real financial data.

---

## 9. Feature Flag Audit — What to Unlock

These features are **built in the backend** but hidden behind feature flags. Ranked by competitive impact:

### Must Unlock (Closes Critical Gaps)

| Feature Flag | What It Enables | Competitive Impact |
|-------------|-----------------|-------------------|
| `valuation` | Property value tracking, market value entry | Closes gap vs TaxTank CoreLogic |
| `portfolio` | Portfolio dashboard with aggregated metrics | Delivers "one screen" promise from landing page |
| `documents` | Document upload per property | Closes receipt/document gap |
| `notifications` | Alert system for users | Engagement loop (TaxTank has notification bell) |
| `mytaxExport` | MyTax report generation | Report card is already visible, just needs to work |

### Should Unlock (Strengthens Position)

| Feature Flag | What It Enables | Competitive Impact |
|-------------|-----------------|-------------------|
| `forecast` | Cash Flow Forecast report | Already on reports page, high value |
| `climateRisk` | Climate/flood risk data per property | Unique differentiator, no competitor has this |
| `milestones` | Equity milestones + celebrations | Engagement/retention feature |
| `similarProperties` | Comparable property analysis | Investor-grade insight |
| `performanceBenchmark` | Portfolio benchmarking | "How am I doing vs market" |

### Can Wait (Nice-to-Have)

| Feature Flag | What It Enables | Why It Can Wait |
|-------------|-----------------|-----------------|
| `aiAssistant` | AI chat | Needs polish, not core flow |
| `brokerPortal` | Broker loan packs + sharing | Team-tier only |
| `advisors` | Advisor network | Team-tier only |
| `referrals` | Referral program | Growth, not product |
| `mobileApp` | Mobile auth + devices | Responsive web first |
| `loanPacks` | PDF generation + sharing | Niche use case |
| `team` / `auditLog` | Team features | Team-tier, lower priority |

---

## 10. Prioritised Roadmap Recommendations

Based on this comparison, here's the recommended build order:

### Phase 1: Close Critical Gaps (Immediate)
1. **Unflag Property Valuation** — let users enter/track market values
2. **Unflag Portfolio Dashboard** — deliver the "one screen" promise
3. **Enrich Property Detail page** — add financial metrics, tabs, transaction history
4. **Fix Properties empty state** — illustration + CTA instead of skeleton cards
5. **Add address autocomplete** — Google Places or similar
6. **Australia Properties Map** — SVG Australia outline with property location pins on dashboard/portfolio (high perceived value, low effort). See `2026-02-09-taxtank-dashboard-deep-dive.md` for implementation notes

### Phase 2: Deepen Tax Compliance (Next 2-4 Weeks)
6. **Build Depreciation UI** — Div 40/Div 43 with method toggle (table stakes)
7. **Add ownership percentage** — per-property field
8. **Add settlement date** — separate from purchase date (CGT relevant)
9. **Expand transaction categories** — add the 10 missing ATO categories
10. **Add FY selector** — top bar dropdown for year switching

### Phase 3: Double Down on Differentiators (Next 1-2 Months)
11. **Unflag Climate Risk** — unique feature no competitor has
12. **Unflag Cash Flow Forecast** — scenario modeling is powerful
13. **Add receipt upload** — on transactions (drag-and-drop)
14. **Build "Who Pays" breakdown** — Taxman % / Tenant % / You % (signature metric)
15. **Build useable equity calculator** — 80% and 88% LVR analysis

### Phase 4: Growth & Retention
16. **Unflag notifications** — engagement loop
17. **Unflag milestones** — equity milestone celebrations
18. **Add guided tour** — first-time user walkthrough
19. **Unflag AI chat** — when polished
20. **PropTrack AVM** — when API key secured

---

## 11. Summary: Where We Stand

```
                    TRAILS          PARITY          LEADS
                    ──────          ──────          ─────
Valuations          ████░░
Depreciation        ████░░
Add Property depth  ███░░░
Property detail     ████░░
Category depth      ██░░░░
Receipt upload      ██░░░░
FY selector         █░░░░░
Ownership %         █░░░░░

Bank feeds                          ████░░
Report count                        ████░░
Entity support                      ████░░
Tax position                        ███░░░
Onboarding                          ████░░

Visual design                                       ████░░
AI categorization                                   █████░
Settlement extract                                  ████░░
Cash flow forecast                                  ████░░
Audit checks                                        ███░░░
YoY comparison                                      ███░░░
Pricing model                                       █████░
Email forwarding                                    ███░░░
Accountant export                                   ███░░░
Modern tech stack                                   █████░
```

**Bottom line:** BrickTrack leads on design, AI, pricing, and investor analytics. TaxTank leads on tax compliance depth, valuations, and property detail richness. The critical insight is that much of what BrickTrack trails on is **already built and feature-flagged off** — the fastest wins come from unflagging existing features, not building new ones.

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-08 | 1.0 | Claude Code | Initial comparison from dual product walkthroughs |
