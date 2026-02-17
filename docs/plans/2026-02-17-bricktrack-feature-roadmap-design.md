# BrickTrack Feature Roadmap & Competitive Analysis Design Document

**Date:** 2026-02-17
**Status:** Draft - Pending Approval
**Author:** Claude (Brainstorming Session)

---

## Executive Summary

This document captures the results of a comprehensive product research and brainstorming session covering:
- Analysis of **14 direct and adjacent competitors** in the Australian property investment tracking market
- Review of **UI/UX trends** in fintech and proptech for 2025-2026
- Deep dive into **user pain points** from PropertyChat, Reddit (r/AusFinance, r/fiaustralia), OzBargain, and review sites
- Audit of **BrickTrack's current feature completeness** (54 routers, ~350+ procedures, 45+ DB tables)
- Identification of **25 feature opportunities** across 5 priority tiers, plus long-term international expansion

The goal: position BrickTrack as the "Sharesight for property" - the clean, automated, modern portfolio tracker that Australian property investors have been asking for on forums for years.

### Key Market Intelligence

- **BrickTrack has zero market awareness** - not mentioned on any forum, Reddit thread, or review site
- **9 in 10 rental property owners make errors** in their tax returns (ATO data) - this is our core marketing hook
- **$10-20/month is the sweet spot** for individual investors - BrickTrack's $14/month Pro tier is perfectly positioned
- **CompiledSanity spreadsheet** has 15,000+ users on r/AusFinance and OzBargain - these are our directly addressable audience
- **Whirlpool forums confirm** there is "no one stop shop software package that can bring all investment property information together automatically"
- **The Property Accountant's bank feeds only work for loan accounts**, not transaction accounts - BrickTrack's Basiq integration covers all account types
- **Most investors still use spreadsheets** because every app is either too limited, too expensive, or too narrowly focused

---

## Part 1: Competitive Landscape

### 1.1 Market Segments

| Segment | Players | Price Range | BrickTrack Overlap |
|---------|---------|-------------|-------------------|
| **Tax & Finance Tracking** | TaxTank, The Property Accountant, BMT MyBMT | $6-15/month | Direct competitor |
| **Portfolio Management** | Property Dollar, Riseport, Moorr, BrickTrack | Free-$15/month | Direct competitor |
| **Research & Analytics** | Picki, HtAG, Real Estate Investar | $47-149/month | Adjacent |
| **Property Management (Agency)** | PropertyMe, Ailo, ManagedApp, Console | $110-1200+/month | Not competing |
| **Property Management (Service)** | :Different, traditional agents | 5-10% of rent | Not competing |
| **Data & Valuations (B2B)** | PropTrack, CoreLogic | Enterprise pricing | Potential data partner |
| **Bookkeeping & Forecasting** | PropertyDirector, Investment Property Tracker | Varies | Adjacent |
| **Spreadsheets** | CompiledSanity, Excel/Sheets, accountant templates | $0-8 | Primary replacement target |

### 1.2 Direct Competitor Deep Dives

#### TaxTank (taxtank.com.au) - **Closest Competitor**
- **Pricing:** From $6/mo base, Property Tank $15/mo (3 properties), +$3/mo per additional
- **Key Features:** Live bank feeds (CDR), CoreLogic valuations, automated depreciation, CGT calculator, LVR/equity monitoring, claim percentage calculator, multi-structure (SMSF/trusts/co-owners)
- **Strengths:** Tax-focused, affordable, modular pricing, strong SEO/content marketing
- **Weaknesses:** Dated UI, web-only, no AI features, no scenario modeling
- **What BrickTrack can learn:** Their CoreLogic integration and depreciation automation are table stakes. Their modular pricing model is smart.

#### The Property Accountant (thepropertyaccountant.com.au)
- **Pricing:** Opaque - "one platform, one price" (hidden until signup). 3-month free trial.
- **Key Features:** Open Banking (100+ banks), automated expense tracking, tax working papers for accountants, ISO 27001 certified, mobile app
- **Strengths:** Dual focus on investors AND accountants (two-sided platform), strong security credentials
- **Weaknesses:** Pricing not transparent, limited brand recognition
- **What BrickTrack can learn:** The "accountant gateway" model - accountants recommend the tool to clients - is a powerful growth channel.

#### Property Dollar (propertydollar.com.au)
- **Pricing:** Free to download (iOS + Android), freemium model
- **Key Features:** Equity/loans/cash flow tracking, scenario testing (rate changes), reports for accountants, ISO 27001 certified
- **Strengths:** Free native mobile app, clean UX, good for spreadsheet replacement
- **Weaknesses:** Shallow features, 30-year mortgage cap, limited bank integration, no tax reporting depth
- **What BrickTrack can learn:** Their free mobile app is their primary acquisition tool. Having a native app matters.

#### Picki (picki.com.au)
- **Pricing:** $47/mo (Owner), $97/mo (Data)
- **Key Features:** 2M+ property analysis, "R Score" predictive metric, suburb insights, deal sheets, distress notifications
- **Strengths:** Deep analytics, unique scoring, active notifications
- **Weaknesses:** Expensive, research-focused not management-focused
- **What BrickTrack can learn:** Investors will pay $47-97/month for good data and insights. Pricing power exists above $14/month.

#### Real Estate Investar (realestateinvestar.com.au)
- **Pricing:** From $99/mo basic, $149/mo with CoreLogic
- **Key Features:** Cross-platform search, property analyser, portfolio tracker, CoreLogic RP Data, suburb analytics
- **Strengths:** Comprehensive, strong brand, educational resources
- **Weaknesses:** Very expensive, dated interface, portfolio tracker is secondary
- **What BrickTrack can learn:** They charge $99-149/month and have customers. BrickTrack can undercut massively while focusing on the portfolio management they treat as secondary.

#### Riseport (riseport.co) - **Similar Stage Competitor**
- **Pricing:** Early access (pre-revenue?)
- **Key Features:** ROI tracking, portfolio performance analysis, opportunity identification
- **Strengths:** Clean modern positioning, actively seeking user feedback on PropertyChat
- **Weaknesses:** Very early stage, limited features, small user base
- **What BrickTrack can learn:** They're validating the same market. BrickTrack is significantly ahead in features. Speed matters.

#### Moorr / MyProperty (moorr.com.au)
- **Key Features:** Net position tracking, cash flow projections, LVR calculation, tax impact projections
- **Strengths:** Built by The Property Couch podcast team (strong community), cash flow focus
- **Weaknesses:** Property module appears to be "coming soon" or in beta, part of broader financial planning app
- **What BrickTrack can learn:** The Property Couch has a massive audience. Community-driven distribution works.

#### BMT MyBMT (bmtqs.com.au)
- **Key Features:** ATO-aligned expense tracker, depreciation integration, receipt upload, "email my accountant" reports
- **Strengths:** Free for BMT clients, trusted brand (Australia's leading depreciation firm), ATO-compliant categories
- **Weaknesses:** Tied to BMT service, basic tracking only
- **What BrickTrack can learn:** The depreciation integration angle is powerful. Partnering with QS firms could drive referrals.

#### PropertyDirector (propertydirector.com.au)
- **Key Features:** Bookkeeping, unlimited properties, 10-year portfolio forecaster (30 years of suburb data), market activity reports (PriceFinder + SQM Research)
- **Strengths:** Forecasting with real historical data, market research integration
- **Weaknesses:** Limited brand recognition, dated UI, opaque pricing
- **What BrickTrack can learn:** Long-term forecasting using real suburb-level historical data is compelling.

#### HtAG Analytics (htag.com.au)
- **Key Features:** 150+ metrics, AI Copilot, heatmaps (GeoDex + StreetLens), portfolio modeling
- **Strengths:** Deepest analytics in market, innovative visualization
- **Weaknesses:** Research-only, no accounting/tax, may be overkill for small investors

#### Investment Property Tracker (investmentpropertytracker.com.au)
- **Key Features:** 30-year cashflow/equity/debt projections, financial reports
- **Strengths:** Simple and focused, long-term projection
- **Weaknesses:** Very limited feature set, small niche player

#### PropPortfolio (propportfolio.com.au) - **New Entrant**
- **Pricing:** $109.99/year (~$9/month). Black Friday 2024 deal on OzBargain with $60 off.
- **Key Features:** Property growth projections, risk assessment, cashflow projections, performance tracking, email notifications for important dates
- **Market reception:** Minimal. When posted on OzBargain (Nov 2024), got only 4 comments. One asked: "Isn't CoreLogic better?" - indicating brand confusion.
- **What BrickTrack can learn:** Even at ~$9/month, a tool with no differentiation gets no traction. You need a clear value prop.

#### PropertyMe (propertyme.com.au) - **Not a Direct Competitor**
- **Pricing:** From $110/mo (100 properties) to $1,232/mo (large agencies)
- **What it is:** Property management software for AGENCIES (trust accounting, inspections, maintenance, tenant portals)
- **Why it matters:** Powers 2/3 of all Australian investment properties. Property managers use PropertyMe, then owner-investors need their OWN tool. BrickTrack fills the investor-side gap.

#### :Different (different.com.au) - **Not a Direct Competitor**
- **What it is:** Tech-enabled property management SERVICE
- **Reputation:** Highly polarized reviews (some love it, many complaints about offshore PMs)
- **Why it matters:** The growing self-management trend means more landlords need tools like BrickTrack.

#### PropTrack (proptrack.com.au) - **Potential Data Partner**
- **What it is:** REA Group's property data platform (B2B only)
- **Key asset:** Automated Valuation Model (AVM) + behavioral data from 12M monthly realestate.com.au users
- **Opportunity:** PropTrack Developer API could power BrickTrack's automated valuations.

### 1.3 Spreadsheet Competitors (The Real Enemy)

The majority of Australian property investors still use spreadsheets:
- **CompiledSanity Personal Finance** ($6-8 one-time) - 15,000+ users on OzBargain/Reddit. Tracks net worth, investments, property. Users request better equity tracking.
- **Excel/Google Sheets** - Custom templates or accountant-provided. Most common tool.
- **Accountant-provided templates** - Custom spreadsheets from tax accountant
- **Paper/notebook** - Surprisingly common among older investors

**Key insight:** The spreadsheet-to-app conversion is BrickTrack's biggest growth opportunity. These users want automation but haven't found an app that's simple enough AND comprehensive enough.

---

## Part 2: User Pain Points & Market Gaps

### 2.1 What Property Investors Say They Want (Forum Research)

From PropertyChat, Reddit (r/AusFinance, r/fiaustralia), OzBargain, Whirlpool, and review sites:

**Key user quotes from forums:**
- *"No one stop shop software package that can bring all investment property information together automatically"* - Whirlpool
- *"Before TaxTank, I had to scramble to find receipts and manually itemize expenses"* - TaxTank user
- *"We have used Xero for my properties but for specific property functionality TaxTank is better and the pricing far outweighs what we were paying"* - TaxTank user
- *"You have to put the time in to update things or it's pretty useless... if you want to do something regularly, it's a time sink"* - CompiledSanity spreadsheet user
- *"Integrating receipt images in an Excel file is just not super convenient and explodes the file size quickly"* - Spreadsheet user
- *"Isn't CoreLogic better? What makes you different?"* - OzBargain user responding to PropPortfolio

**Top 10 requested features:**

1. **"Sharesight but for property"** - The single most-requested concept. Clean, automated, modern portfolio tracker.
2. **Consolidation of fragmented data** - Tracking across multiple property managers, banks, and tax tools
3. **Simple expense tracking that just works** - Many use spreadsheets because apps are too complex or expensive
4. **Real-time tax position** - "How much tax will I owe THIS year?" not just EOFY summaries
5. **Performance comparison** - "Which of my properties is actually my best performer?"
6. **Cash flow forecasting** - "What happens to my cash flow if rates change?"
7. **Receipt/expense capture on the go** - "I'm at Bunnings, I want to snap this receipt"
8. **Accountant-ready exports** - "My accountant keeps asking me for the same reports"
9. **Multi-property cost splitting** - Insurance, strata manager fees across properties
10. **Depreciation schedule integration** - "I have a BMT report, why can't I just upload it?"

### 2.2 Common Pain Points

| Pain Point | Severity | Current Solutions | BrickTrack Opportunity |
|-----------|----------|-------------------|----------------------|
| Spreadsheet fatigue / manual data entry | Critical | Excel, CompiledSanity | Bank feeds + AI categorization (already built) |
| Tax time panic | Critical | Accountant, TaxTank | MyTax export + real-time tax position (partially built) |
| No real-time portfolio visibility | High | Property Dollar, manual checks | Dashboard + automated valuations (needs valuations API) |
| Fragmented tools | High | 3-5 different tools | All-in-one platform (BrickTrack's core value prop) |
| Depreciation tracking | High | BMT MyBMT, manual | Document OCR + auto-apply (infrastructure exists) |
| Receipt tracking burden | High | Shoebox, photos, Dext | Receipt OCR + auto-categorize (document extraction exists) |
| Multi-structure complexity | Medium | Accountant, TaxTank | Entity support (partially built) |
| Debt management / refinancing | Medium | Broker, manual | Loan comparison + refinance alerts (built) |
| No cash flow forecasting | Medium | Spreadsheets | Scenario modeling (built) |
| Cost of professional tools | Medium | Free tools, spreadsheets | $14/month competitive pricing |

### 2.3 DIY Tools Currently Used

1. **Excel/Google Sheets** - Most common (custom templates or downloaded)
2. **CompiledSanity spreadsheet** - Popular on r/AusFinance and OzBargain (~15,000 users)
3. **Xero/MYOB** - General accounting adapted for property (not ideal, $35+/mo)
4. **Paper/notebook** - Surprisingly common among older investors
5. **Accountant-provided spreadsheets** - Custom templates from tax accountant
6. **BMT MyBMT app** - Free for BMT depreciation clients, basic tracking
7. **realestate.com.au / Domain** - Ad-hoc property value checks
8. **Bank apps** - Check rent deposits manually

---

## Part 3: BrickTrack Current State

### 3.1 Feature Completeness Matrix

| Feature Area | Status | Coverage | What Works | What's Missing |
|---|---|---|---|---|
| **Properties** | Complete | 100% | CRUD, valuations, climate risk, similar properties (pgvector), settlement | Automated valuations (CoreLogic/PropTrack API) |
| **Banking** | Complete | 95% | Basiq sync, connection mgmt, alerts | Prod Basiq approval pending |
| **Transactions** | Complete | 100% | Manual + auto entry, AI categorization (Claude), bulk ops, search, CSV export | Categorization rules engine |
| **Loans** | Complete | 100% | CRUD, refinance comparison, rate alerts, offset linking | Market rate data feed |
| **Tax Reporting** | Mostly Done | 85% | Tax position calc, CGT, MyTax export, YoY comparison, optimization tips | Depreciation auto-import, partial deductibility |
| **Reports** | Complete | 90% | Tax, cash flow, portfolio, audit checks, compliance | Accountant export package |
| **Scenarios** | Complete | 100% | What-if modeling, scenario comparison, simulation | - |
| **Analytics** | Complete | 90% | Dashboard, stats, benchmarking, performance comparison | Property scorecard view |
| **Compliance** | Partial | 75% | SMSF/trust rules, entity support, checklist | Calendar enhancement |
| **Cash Flow** | Complete | 85% | Monthly tracking, forecasting, scenarios | Sankey visualization |
| **Budget** | Partial | 30% | Schema ready, basic UI | Transaction routing, full UI |
| **Documents** | Partial | 70% | Upload/browse, OCR extraction started | Production OCR, receipt scanning |
| **AI Chat** | Partial | 40% | Infrastructure (Claude Sonnet), feature-flagged off | Context injection, tool calling, unflag |
| **Email** | Partial | 50% | Archive, search infrastructure | Gmail OAuth, categorization |
| **Team/Sharing** | Partial | 75% | Team members, share links, roles | Accountant portal |
| **Billing** | Complete | 95% | Stripe, trials, plans, referral credits | Invoice details |
| **Onboarding** | Complete | 80% | Wizard, checklist, tours | Progressive disclosure improvements |
| **Mobile** | Not Started | 0% | Mobile auth token system ready | Native app or PWA |

### 3.2 Technical Foundation

- **54 tRPC routers** with ~350+ procedures
- **45+ database tables** across 19 schema domains
- **87 pages** (public + authenticated)
- **900+ unit tests** across 113 test files
- **23 typed repositories** with interfaces
- **8 external integrations** (Basiq, Claude AI, Stripe, Supabase, Clerk, PropTrack partial, Gmail partial, PropertyMe partial)
- **Tech stack:** Next.js 16, React 19, tRPC v11, Drizzle ORM, Tailwind v4, PostgreSQL 16 with pgvector

---

## Part 4: Feature Catalogue (25 Features + International)

### Tier 1: High-Impact Gaps

> Things competitors have that BrickTrack doesn't, or that users are actively asking for.

#### Feature 1: CoreLogic/PropTrack Automated Valuations
**Problem:** Users manually enter property values. TaxTank auto-updates via CoreLogic. Every competitor with traction has this.
**Solution:** Integrate PropTrack Developer API or CoreLogic API to auto-update property values monthly. Schema already supports `valuationSource: corelogic | proptrack`.
**Impact:** Removes biggest manual data entry burden. Users see live equity growth.
**Effort:** Medium (API integration, likely $0.50-2.00/lookup)
**Monetization:** Pro tier feature (justify $14/month)
**Dependencies:** API contract with PropTrack or CoreLogic

#### Feature 2: Depreciation Schedule Import & Auto-Apply
**Problem:** Every AU investor has a depreciation schedule from BMT/Washington Brown/Duo Tax. Nobody handles upload-and-auto-apply well.
**Solution:** Upload PDF depreciation schedule -> OCR extract items -> auto-populate Division 40 (plant & equipment) and Division 43 (capital works) deductions per financial year. `documentExtraction.extractDepreciation()` router exists.
**Impact:** Massive time saver at tax time. Strong Pro conversion driver.
**Effort:** Medium-High (OCR extraction + year-by-year mapping to categories)
**Monetization:** Pro tier feature
**Dependencies:** Claude Vision API for document extraction (already integrated)

#### Feature 3: Receipt/Document OCR (Snap & Categorize)
**Problem:** Receipt tracking is the #1 daily pain point. Users save shoeboxes of receipts until tax time.
**Solution:** Upload/photograph receipt -> OCR extract merchant, amount, date, GST -> auto-suggest category and property -> one-tap confirm to create transaction.
**Impact:** Daily engagement driver. Mobile killer feature.
**Effort:** Medium (Claude Vision API + document extraction infrastructure exists)
**Monetization:** Free tier (1-2/day), unlimited on Pro
**Dependencies:** Document extraction service, mobile-optimized upload

#### Feature 4: "Email My Accountant" Export Package
**Problem:** Every investor hands data to an accountant at EOFY. Currently a manual export/email process.
**Solution:** One-click "Share with Accountant" button that generates a branded PDF report package (income/expense summary, property schedule, depreciation summary, CGT events, loan details) and emails it directly.
**Impact:** Growth channel (accountants recommend the tool to clients). Conversion trigger (Pro feature).
**Effort:** Low-Medium (PDF generation + transactional email)
**Monetization:** Pro tier feature
**Dependencies:** PDF generation library, email sender (infrastructure exists)

#### Feature 5: Claim Percentage Calculator (Partial Use Properties)
**Problem:** Airbnb hosts, home office users, and people who lived in their investment property need to calculate partial deductibility. ATO rules are complex (private use percentage, number of days rented, area-based apportionment).
**Solution:** Per-property "claim percentage" setting with different methods (days-based, area-based, fixed percentage). Auto-apply to all deductions for that property.
**Impact:** Addresses growing Airbnb/mixed-use market. Differentiator vs Property Dollar.
**Effort:** Medium (business logic + UI, no external APIs)
**Monetization:** Pro tier feature
**Dependencies:** Transaction deductibility calculations

---

### Tier 2: Competitive Moat Builders

> Features that are hard for competitors to replicate and create defensible advantages.

#### Feature 6: AI Property Advisor (Upgrade Chat to Agentic)
**Problem:** AI chat infrastructure exists (Claude Sonnet, feature-flagged off) but doesn't understand portfolio context.
**Solution:** Unflag AI assistant. Inject full portfolio context (properties, loans, transactions, tax position) into system prompt. Add tool-calling so AI can execute actions: "categorize all uncategorized transactions from last month", "what's my tax position if I sell Property B?", "which property should I refinance first?"
**Impact:** Major differentiator. No AU competitor has portfolio-aware AI.
**Effort:** Medium (infrastructure exists, need context injection + tool definitions)
**Monetization:** Pro tier feature (limited queries on free)
**Dependencies:** AI chat infrastructure (exists), tRPC procedure access

#### Feature 7: Sankey Cash Flow Diagrams
**Problem:** Users want to visualize "where does my rental income go?" PocketSmith and ProjectionLab use Sankey diagrams to great effect. No AU property tool has this.
**Solution:** Portfolio-level and per-property Sankey diagrams showing: Rental Income -> splits into Mortgage Repayments, Insurance, Maintenance, Management Fees, Council Rates, Water, Strata, Tax, Net Profit. Width of flow = dollar amount.
**Impact:** Marketing "wow factor" + genuine insight into money flow. Screenshot-worthy for social sharing.
**Effort:** Low-Medium (d3-sankey or recharts-sankey, data already available in cash flow calculations)
**Monetization:** Pro tier feature
**Dependencies:** Cash flow data (exists)

#### Feature 8: Smart Categorization Rules Engine
**Problem:** AI categorization is good for unknown merchants, but users want deterministic rules: "Any transaction from 'Body Corporate ABC' = strata_fees for Property A, always."
**Solution:** User-created rules with pattern matching (merchant name contains/equals, amount range, description pattern). Rules take priority over AI suggestions. Learn from user corrections.
**Impact:** Over time, auto-categorization approaches 95%+ accuracy. Reduces daily friction to near-zero.
**Effort:** Medium (rule CRUD UI + matching engine on transaction sync pipeline)
**Monetization:** Free tier (5 rules), unlimited on Pro
**Dependencies:** Transaction sync pipeline (exists)

#### Feature 9: Multi-Property Expense Splitting
**Problem:** Insurance policies covering 3 properties, property manager fees for a portfolio, shared maintenance costs. Landlord Studio is one of the few that handles this.
**Solution:** "Split Transaction" action on any transaction. Options: split evenly, by percentage, by custom amount. Save split templates for recurring shared expenses (e.g., "always split insurance 33/33/34 across Properties A, B, C").
**Impact:** Solves real daily pain point for 3+ property investors (Pro tier target).
**Effort:** Medium (split transaction UI + allocation logic + template system)
**Monetization:** Pro tier feature
**Dependencies:** Transaction system (exists)

#### Feature 10: Property Performance Scorecard
**Problem:** "Which property is my best performer?" is the question investors keep asking on forums. Nobody presents this comparison cleanly.
**Solution:** Per-property scorecard showing: ROI, cash-on-cash return, cap rate, gross yield, net yield, equity growth %, annual cash flow, tax benefit contribution. Side-by-side comparison view. Color-coded performance indicators (green/amber/red).
**Impact:** High engagement (users check regularly). Strong Pro conversion feature.
**Effort:** Low-Medium (data exists in various routers, need unified view + comparison UI)
**Monetization:** Basic view on Free, full comparison on Pro
**Dependencies:** Property, loan, transaction, and valuation data (all exist)

---

### Tier 3: UX/Engagement Improvements

> Polish that drives retention, reduces churn, and improves daily experience.

#### Feature 11: Dark Mode
**Problem:** 82% of mobile users use dark mode (NNGroup). Finance apps that don't support it feel dated.
**Solution:** Implement dark mode using Tailwind v4's `dark:` variant and CSS custom properties. Use dark gray (#121212 or #1E1E1E) not pure black. Default to system preference, allow manual toggle.
**Impact:** Modern feel. Reduces eye strain for evening portfolio checks. Expected feature.
**Effort:** Low (Tailwind v4 dark variant, CSS variable updates)
**Monetization:** Free feature (quality-of-life)
**Dependencies:** Tailwind v4 CSS variables (already in place)

#### Feature 12: Progressive Disclosure Dashboard Redesign
**Problem:** Current dashboard shows many cards. Best-in-class fintech dashboards show 4-5 KPIs prominently then let users drill down.
**Solution:** Tier 1 (always visible): Total portfolio value, monthly cash flow, total equity, gross yield, action items (uncategorized transactions, pending reviews). Tier 2 (one click away): Per-property breakdown, NOI, cap rate, DSCR. Tier 3 (drill-down): Full reports, scenarios, tax position.
**Design principles:** Inverted pyramid. Top-left for most important metric. White space. Max 2 fonts. Card-based with interactive mini-graphs.
**Impact:** Cleaner first impression. Reduces cognitive overload. Better "5-second test" results.
**Effort:** Low-Medium (redesign existing dashboard components)
**Monetization:** Free feature

#### Feature 13: Milestone Celebrations & Progress Tracking
**Problem:** Finance apps with gamification see 47% higher 90-day retention (Netguru research). But gimmicky gamification (badges, streaks) feels wrong for a serious investment tool.
**Solution:** Meaningful milestones only: "Portfolio reached $500K equity", "12 months of positive cash flow", "All FY2026 transactions categorized", "First property added". Celebratory modal + confetti animation. Progress bar toward next milestone on dashboard. Schema already exists: `milestonePreferences`.
**Impact:** Emotional reward + sense of progress. Drives feature discovery.
**Effort:** Low (notifications + UI celebrations, schema exists)
**Monetization:** Free feature

#### Feature 14: Mobile-Optimized Monitoring View
**Problem:** Before investing in a native app, the web app should work beautifully on mobile for the "quick glance" use case: check portfolio value, see today's transactions, approve AI categorizations.
**Solution:** PWA-optimized responsive views for: (1) Portfolio summary card, (2) Recent transactions with swipe-to-categorize, (3) Notification center, (4) Quick transaction entry. Add to homescreen prompt.
**Impact:** Mobile engagement without native app investment.
**Effort:** Low-Medium (responsive optimization of existing pages)
**Monetization:** Free feature

#### Feature 15: Improved Onboarding Flow
**Problem:** First 5 minutes determine conversion. Current onboarding has wizard + checklist but may overwhelm with 54 routers worth of features.
**Solution:** Progressive onboarding: Step 1: Add one property (address autocomplete). Step 2: Connect one bank (Basiq). Step 3: See first insight ("You have $X in rental income this month"). Then gradually reveal features via contextual tooltips and "Discover" section. Empty states that guide action.
**Impact:** Higher activation rate. Lower bounce during trial.
**Effort:** Low-Medium (onboarding infrastructure exists, need UX refinement)
**Monetization:** Free feature (improves conversion)

---

### Tier 4: Growth & Monetization Features

> Features that drive acquisition, justify pricing, and open new revenue channels.

#### Feature 16: Accountant Portal (Team Tier Justification)
**Problem:** Team tier ($29/mo) promises "broker portal & loan packs" but the accountant angle is a stronger growth channel. Accountants manage 10-50 investor clients each.
**Solution:** Accountant role with: client portfolio list, bulk EOFY report generation, cross-client analytics, compliance calendar, branded exports. Accountant receives read-only access to client portfolios via invitation. Client controls what's shared.
**Impact:** B2B growth channel. Each accountant brings 10-50 paying clients.
**Effort:** High (new role type, filtered views, bulk operations, invitation flow)
**Monetization:** Team tier feature ($29/month)
**Dependencies:** Team/sharing infrastructure (partially built)

#### Feature 17: Referral Program Enhancement
**Problem:** Referral infrastructure exists (credits, links, tracking) but needs more visibility and incentive.
**Solution:** "Give a month, get a month" referral program. Prominent share buttons in-app (after positive milestones). Referral dashboard showing pending/completed referrals. Email nudges after 30 days of active use.
**Impact:** Viral growth loop. Low CAC.
**Effort:** Low (marketing + UI visibility, infrastructure exists)
**Monetization:** Acquisition driver

#### Feature 18: Content & Education Hub
**Problem:** TaxTank's blog is their primary acquisition channel (SEO). Property investors actively search for tax tips, investment guides, and calculator tools.
**Solution:** Structured content hub: (1) Tax guides (depreciation, CGT, negative gearing), (2) Investment calculators (rental yield, LVR, borrowing capacity), (3) EOFY checklists, (4) Market commentary. Blog infrastructure already exists.
**Impact:** SEO traffic + trust building + engagement. Long-term acquisition.
**Effort:** Medium (content creation + CMS optimization, blog router exists)
**Monetization:** Acquisition driver (free content -> signup -> convert)

#### Feature 19: Property Market Data Integration
**Problem:** PropertyDirector offers suburb-level vacancy rates, days on market, vendor discounts via PriceFinder/SQM Research. Investors want to know if their suburb is improving or declining.
**Solution:** Per-property and per-suburb market data cards showing: median price trend, days on market, vacancy rate, vendor discount rate, rental yield vs suburb median. Data from PriceFinder, SQM Research, or PropTrack.
**Impact:** Differentiator. Data-driven decision making. Justifies Pro pricing.
**Effort:** High (data provider contracts + integration + regular data updates)
**Monetization:** Pro tier feature
**Dependencies:** Data provider API contract

#### Feature 20: Rental Yield Benchmarking
**Problem:** "Am I getting a good yield?" is a constant question. No tool shows this comparison clearly.
**Solution:** Per-property yield comparison against: suburb median yield, state average, national average, portfolio average. Trend over time. Benchmarking router already exists - extend with real market data.
**Impact:** High engagement. Helps investors optimize rent pricing.
**Effort:** Medium (needs market data source for suburb-level yields)
**Monetization:** Pro tier feature
**Dependencies:** Market data integration or manual suburb data

---

### Tier 5: Long-Term / Big Bets

> High-effort, high-reward features for future phases.

#### Feature 21: Native Mobile App (React Native)
**Problem:** Property Dollar's free mobile app is their main competitive advantage. Mobile monitoring is the #1 engagement pattern.
**Solution:** React Native app sharing tRPC API. Core features: portfolio view, transaction list with categorization, receipt camera, notifications, quick property value check. Mobile auth system already built.
**Impact:** Major acquisition and engagement driver.
**Effort:** Very High (separate codebase, app store submission, ongoing maintenance)
**Monetization:** Free tier app (Pro features gated)
**Timeline:** 3-6 months

#### Feature 22: Self-Management Tools (Tenant/Lease/Maintenance)
**Problem:** Growing segment of self-managing landlords (RentBetter, RealRenta serve this). More investors choosing to self-manage to save 5-10% PM fees.
**Solution:** Lightweight lease tracking (tenant name, lease dates, rent amount, bond), rent received alerts (match transactions to expected rent), maintenance request log, inspection reminders. NOT a full PropertyMe competitor - just enough for self-managers.
**Impact:** Expands addressable market to self-managing landlords.
**Effort:** High (new domain, tenant schema, lease management)
**Monetization:** Pro tier feature
**Timeline:** Phase 2

#### Feature 23: Broker/Mortgage Marketplace
**Problem:** Team tier mentions "broker portal." Investors constantly need refinancing and new loans.
**Solution:** Brokers get read-only portfolio view of opted-in clients. "Request a quote" flow. Broker can see loan details, equity position, property values. Commission-based revenue model.
**Impact:** New revenue stream. Broker partnerships.
**Effort:** Very High (partnerships, compliance, two-sided marketplace)
**Monetization:** Commission on referrals
**Timeline:** Phase 3+

#### Feature 24: Advanced Map Visualization
**Problem:** Interactive property maps with performance indicators are expected in property apps but rarely done well.
**Solution:** Portfolio map view with: color-coded pins (green = positive cash flow, red = negative), click-to-expand property cards with key metrics, suburb-level heat map overlay for performance comparison. Geocoding already supported (latitude/longitude in schema).
**Impact:** Visual engagement. Screenshot-worthy for marketing.
**Effort:** Medium-High (map library integration, geocoding, performance overlay)
**Monetization:** Pro tier feature
**Timeline:** Phase 2

#### Feature 25: Net Worth Tracker
**Problem:** PocketSmith's net worth widget is one of their most popular features. Property investors want to see total financial picture - not just properties.
**Solution:** "What you own" (properties, super, shares, savings, other assets) vs "What you owe" (mortgages, personal loans, credit cards). Auto-populated from bank feeds where possible. Manual entry for other assets. Trend over time.
**Impact:** Broadens value proposition beyond property-only. Daily engagement.
**Effort:** Medium (new schema for non-property assets, dashboard widget)
**Monetization:** Pro tier feature
**Timeline:** Phase 2

---

### Long-Term: International Expansion

> Not immediate priority - capture AU market first. But design with expansion in mind.

#### Feature 26: International Property Market Support

**Phase 1 (Medium effort):** Multi-currency property tracking + exchange rate conversion for portfolio views. No country-specific tax - just income/expense tracking in local currency. Support international addresses.

**Phase 2 (High effort):** NZ + UK support (similar tax systems to AU, English-speaking, large investor populations). Country-specific tax categories and reporting.

**Phase 3 (Very High effort):** Full i18n framework + language support. US market entry (complex tax, but massive TAM).

**Phase 4:** Country-specific bank feed integrations (Plaid for US, TrueLayer for UK).

**Key architectural decisions to make now:**
- Store currency per property (not per portfolio)
- Tax year configuration per portfolio (not hardcoded to July-June)
- Address format abstraction
- Timezone-aware dates on transactions
- Flexible category system (not hardcoded to ATO categories)

**Why wait:** AU market is unserved enough to build a solid business. Expanding internationally before nailing AU risks spreading too thin. But the architecture should not prevent it.

---

## Part 5: UX & Design Recommendations

### 5.1 Dashboard Design

Based on fintech/proptech UX research (Revolut, Altruist, Chime, PocketSmith):

**Primary KPIs (always visible):**
1. Total Portfolio Value (with trend arrow)
2. Monthly Cash Flow (income - expenses - mortgage)
3. Total Equity (market value - outstanding loans)
4. Gross Rental Yield (portfolio average)
5. Action Items count (uncategorized transactions, pending reviews)

**Design principles:**
- Card-based layout with interactive mini-graphs in each card
- Inverted pyramid: crucial info first, details on drill-down
- Max 4-5 primary visualizations
- Top-left position for most important metric
- Consistent color coding: green = income/positive, red = expenses/negative, blue = equity/neutral
- White space for breathing room
- 1-2 font families (sans-serif)

### 5.2 Data Visualization Strategy

| Visualization | Use Case | Priority |
|---|---|---|
| **Sankey diagram** | Cash flow: where rental income goes | P1 |
| **Stacked area chart** | Equity growth over time (principal repayment vs capital appreciation) | P1 |
| **Waterfall chart** | Monthly income to net cash flow breakdown | P2 |
| **Bar chart** | Property-by-property yield/ROI comparison | P1 |
| **Line chart** | Property value trends, rent growth trajectories | Exists |
| **Donut chart** | Portfolio diversification by geography/type (max 5-6 segments) | P2 |
| **Heat map** | Geographic performance comparison on map | P3 |
| **Gauge** | Threshold indicators (DSCR above/below 1.0, LVR limits) | P3 |

### 5.3 Transaction UX (Xero-Inspired)

**Three-layer categorization approach:**
1. **Rule-based matching** (user-defined rules, highest priority)
2. **AI categorization** (Claude Haiku, second priority)
3. **Manual with smart defaults** (pre-select most likely category)

**Reconciliation flow:**
- Auto-matched transactions: one-click "Confirm" button
- Partial matches: suggest options, user selects
- New transactions: AI suggests category + property, user confirms with single tap
- Target: 80-95% auto-match on day one

### 5.4 Mobile Strategy

**Mobile-first for monitoring, desktop-first for analysis:**
- **Mobile use cases:** Portfolio value check, recent transactions, approve categorizations, receipt camera, notifications
- **Desktop use cases:** Reports, tax calculations, scenario modeling, bulk operations, settings
- **Short-term:** PWA optimization with "Add to homescreen"
- **Long-term:** React Native app

### 5.5 Dark Mode Implementation

- Use Tailwind v4 `dark:` variant with CSS custom properties
- Background: `#121212` or `#1E1E1E` (not pure black)
- Cards: `#1E1E1E` or `#2D2D2D`
- Text: `#E0E0E0` primary, `#A0A0A0` secondary
- Charts: Adjust color palette for dark backgrounds
- Default to system preference, manual toggle in settings

---

## Part 6: Prioritization Matrix

### Impact/Effort Grid

| Priority | Feature | Acquisition | Conversion | Moat | Effort | Target |
|----------|---------|-------------|------------|------|--------|--------|
| **P0** | #3 Receipt/Document OCR | Med | High | Med | Med | Q1 2026 |
| **P0** | #8 Categorization Rules Engine | Low | High | High | Med | Q1 2026 |
| **P0** | #11 Dark Mode | Med | Low | Low | Low | Q1 2026 |
| **P0** | #13 Milestone Celebrations | Low | Med | Low | Low | Q1 2026 |
| **P1** | #10 Property Performance Scorecard | Med | High | Med | Low-Med | Q1 2026 |
| **P1** | #4 Email My Accountant | High | Med | Med | Low-Med | Q1 2026 |
| **P1** | #7 Sankey Cash Flow Diagrams | High | Med | Med | Low-Med | Q1-Q2 2026 |
| **P1** | #6 AI Property Advisor | High | High | High | Med | Q2 2026 |
| **P1** | #15 Improved Onboarding | Med | High | Low | Low-Med | Q1-Q2 2026 |
| **P1** | #12 Dashboard Redesign | Med | Med | Low | Low-Med | Q2 2026 |
| **P2** | #1 Automated Valuations | High | High | Med | Med | Q2 2026 |
| **P2** | #2 Depreciation Import | Med | High | High | Med-High | Q2 2026 |
| **P2** | #9 Expense Splitting | Low | Med | Med | Med | Q2-Q3 2026 |
| **P2** | #5 Claim % Calculator | Med | Med | Med | Med | Q2-Q3 2026 |
| **P2** | #14 Mobile-Optimized Views | Med | Med | Low | Low-Med | Q2 2026 |
| **P2** | #25 Net Worth Tracker | Med | Med | Med | Med | Q3 2026 |
| **P3** | #16 Accountant Portal | High | Med | High | High | Q3-Q4 2026 |
| **P3** | #17 Referral Enhancement | Med | Low | Low | Low | Q2 2026 |
| **P3** | #18 Content Hub | High | Low | Med | Med | Ongoing |
| **P3** | #19 Market Data | Med | Med | Med | High | Q3-Q4 2026 |
| **P3** | #20 Rental Yield Benchmarking | Med | High | Med | Med | Q3 2026 |
| **P3** | #24 Map Visualization | Med | Low | Med | Med-High | Q3-Q4 2026 |
| **P4** | #21 Native Mobile App | High | High | Med | Very High | 2027 |
| **P4** | #22 Self-Management Tools | Med | Med | Med | High | 2027 |
| **P4** | #23 Broker Marketplace | Med | Med | High | Very High | 2027+ |
| **P5** | #26 International Expansion | Very High | High | Very High | Very High | 2027+ |

### Suggested Execution Order

**Wave A (Now - April 2026): Foundation Polish**
- Dark Mode (#11)
- Milestone Celebrations (#13)
- Categorization Rules Engine (#8)
- Property Performance Scorecard (#10)
- Referral Enhancement (#17)

**Wave B (April - July 2026): Core Differentiators**
- Receipt/Document OCR (#3)
- Email My Accountant (#4)
- Sankey Cash Flow Diagrams (#7)
- AI Property Advisor (#6)
- Improved Onboarding (#15)
- Dashboard Redesign (#12)
- Mobile-Optimized Views (#14)

**Wave C (July - October 2026): Premium Features**
- Automated Valuations (#1)
- Depreciation Import (#2)
- Expense Splitting (#9)
- Claim % Calculator (#5)
- Rental Yield Benchmarking (#20)
- Net Worth Tracker (#25)

**Wave D (October 2026 - March 2027): Growth Engine**
- Accountant Portal (#16)
- Content Hub (#18)
- Market Data Integration (#19)
- Map Visualization (#24)

**Wave E (2027+): Big Bets**
- Native Mobile App (#21)
- Self-Management Tools (#22)
- Broker Marketplace (#23)
- International Expansion (#26)

---

## Part 7: Strategic Recommendations

### 7.1 Positioning
**"The Sharesight of Property"** - Clean, automated, modern portfolio tracking for Australian property investors. Bank feeds + AI categorization + tax-ready reports.

### 7.2 Pricing Validation
Current pricing ($0/14/29 per month) is competitive:
- TaxTank: $15/month for 3 properties
- The Property Accountant: Opaque
- Property Dollar: Free (limited)
- Picki: $47-97/month
- Real Estate Investar: $99-149/month

**Recommendation:** $14/month Pro tier is well-positioned against TaxTank's $15/month. The lifetime deal ($249) provides good early revenue. Consider adding a $24/month "Pro+" tier with advanced features (AI advisor, market data, automated valuations) once those features are built.

### 7.3 Growth Channels (Priority Order)
1. **SEO/Content** - Blog + calculator tools (TaxTank's playbook)
2. **Accountant referrals** - Accountant portal as B2B channel
3. **User referrals** - Enhanced referral program
4. **PropertyChat/Reddit** - Community engagement (Riseport's approach)
5. **BMT/QS partnerships** - Depreciation schedule upload as acquisition hook
6. **App store presence** - PWA first, then native (Property Dollar's playbook)

### 7.4 Key Technical Decisions
1. **Design with international expansion in mind** - currency per property, flexible tax years, address abstraction
2. **API-first for mobile** - tRPC already serves this well
3. **Invest in OCR/AI** - Claude Vision is the foundation for receipt scanning, depreciation import, and document extraction
4. **Sankey/advanced charts** - Consider d3.js or recharts-sankey for the cash flow visualization
5. **Progressive disclosure** - Restructure dashboard around 3-tier KPI hierarchy

---

## Sources

### Competitor Sites
- [TaxTank](https://taxtank.com.au/) | [Pricing](https://taxtank.com.au/pricing/)
- [The Property Accountant](https://thepropertyaccountant.com.au/)
- [PropertyMe](https://www.propertyme.com.au/) | [Pricing](https://www.propertyme.com.au/pricing-2025)
- [Property Dollar](https://propertydollar.com.au/)
- [Picki](https://picki.com.au/)
- [Real Estate Investar](https://info.realestateinvestar.com.au/)
- [Riseport](https://www.riseport.co/)
- [PropertyDirector](https://www.propertydirector.com.au/)
- [PropTrack](https://www.proptrack.com.au/)
- [:Different](https://different.com.au/)
- [BMT MyBMT](https://www.bmtqs.com.au/)
- [HtAG Analytics](https://htag.com.au/)
- [Investment Property Tracker](https://investmentpropertytracker.com.au/)
- [Moorr](https://moorr.com.au/)

### Market Research
- [Top 10 Best Real Estate Investment Software Australia 2026](https://www.pmva.com.au/best-real-estate-investment-software/)
- [Top 4 Property Accounting Software Solutions in Australia](https://thepropertyaccountant.com.au/blogs/property-accounting-software)
- [Top 5 Investment Property Apps in Australia 2025](https://trackmytrail.com.au/investment-property-apps-australia/)
- [Top 5 Property Accounting Software In Australia 2025](https://taxtank.com.au/2025/10/10/top-5-property-accounting-software/)
- [Top 10 Property Investment Tools in Australia 2025](https://www.starinvestment.com.au/property-investment-tools-australia-2025)
- [PropertyChat - Self Manage Property Software with Bank Feed](https://www.propertychat.com.au/community/threads/self-manage-property-software-with-bank-feed.84558/)
- [PropertyChat - Property Investor tracking tool/spreadsheet](https://www.propertychat.com.au/community/threads/property-investor-tracking-tool-spreadsheet.32518/)
- [PropertyChat - Feedback on Riseport](https://www.propertychat.com.au/community/threads/feedback-on-riseport-property-portfolio-tracking-platform.81769/)
- [Stessa Features & Pricing](https://www.softwareadvice.com/property/stessa-profile/)
- [CompiledSanity Personal Finance on OzBargain](https://www.ozbargain.com.au/node/917669)

### UX Research
- [Buildium - 12 Proptech Trends 2026](https://www.buildium.com/blog/proptech-trends-to-know/)
- [Eleken - Fintech UX Best Practices 2026](https://www.eleken.co/blog-posts/fintech-ux-best-practices)
- [Merge Rocks - Fintech Dashboard Design](https://merge.rocks/blog/fintech-dashboard-design-or-how-to-make-data-look-pretty)
- [NNGroup - Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [PocketSmith - Sankey Diagram](https://www.pocketsmith.com/blog/using-pocketsmith-s-sankey-diagram-to-visualize-my-money-flows/)
- [Sharesight Features](https://www.sharesight.com/features/)
- [GoodData - Real Estate Dashboard Examples](https://www.gooddata.com/blog/real-estate-dashboard-examples-that-drive-smarter-decisions/)
- [ProjectionLab - Cash Flow Sankey](https://projectionlab.com/cash-flow)
- [Netguru - Fintech Gamification Guide 2025](https://www.netguru.com/blog/fintech-gamification)
- [Klippa - AI Agents for Document Data Extraction](https://www.klippa.com/en/blog/information/ai-agents-for-document-data-extraction/)
- [AlterSquare - Dark Mode Trends 2025](https://www.altersquare.io/dark-mode-design-trends-for-2025-should-your-startup-adopt-it/)

### Investor Pain Points
- [Empower Wealth - Common complaints from property investors](https://empowerwealth.com.au/blog/common-complaints-from-property-investors/)
- [Michael Yardney - 11 Common complaints from property investors](https://medium.com/@michaelyardney/11-common-complaints-i-hear-from-property-investors-metropole-property-strategists-5147c165e053)
- [Baselane - 6 Key Pain Points for Private Landlords](https://www.baselane.com/resources/pain-points-for-private-landords)

### Forum & Community Sources
- [PropertyChat - Self Manage Property Software with Bank Feed](https://www.propertychat.com.au/community/threads/self-manage-property-software-with-bank-feed.84558/)
- [PropertyChat - Property Investor Tracking Tool/Spreadsheet](https://www.propertychat.com.au/community/threads/property-investor-tracking-tool-spreadsheet.32518/)
- [PropertyChat - Portfolio Tracking Software](https://www.propertychat.com.au/community/threads/portfolio-tracking-software.53183/)
- [PropertyChat - Free Property Management Software](https://www.propertychat.com.au/community/threads/free-property-management-software.80271/)
- [PropertyChat - Tool for Self Manage Property](https://www.propertychat.com.au/community/threads/tool-for-self-manage-property.82263/)
- [PropertyChat - Feedback on Riseport](https://www.propertychat.com.au/community/threads/feedback-on-riseport-property-portfolio-tracking-platform.81769/)
- [Whirlpool - Best Software for Deductible Expense Tracking](https://forums.whirlpool.net.au/archive/9m01kyx4)
- [Whirlpool - Software to Calculate Cost of Investment Property](https://forums.whirlpool.net.au/archive/974pj08z)
- [OzBargain - CompiledSanity Personal Finance](https://www.ozbargain.com.au/node/917669)
- [OzBargain - PropPortfolio Black Friday Deal](https://www.ozbargain.com.au/node/881242)
- [CompiledSanity Property Guide](https://guide.cspersonalfinance.io/investments/property)
- [AllAboutPlanners - Investment Property Spreadsheets](https://allaboutplanners.com.au/the-excel-spreadsheets-i-use-to-manage-my-investment-property-income-expenses-tax-deductions-the-loan-etc/)
- [Finder - Property Investment Tax Spreadsheet](https://www.finder.com.au/property-investment/investment-property-tax-spreadsheet)
