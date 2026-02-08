# TaxTank Property Tank Dashboard — Deep Dive from Live Screenshot

**Date:** 2026-02-09
**Source:** Live TaxTank Property Tank screenshot (2 properties, $700K portfolio)
**Purpose:** Capture dashboard layout, data hierarchy, and UI patterns to inform BrickTrack dashboard redesign

---

## Dashboard Layout (Top to Bottom)

### Header Bar
- **Logo:** "taxtank" (lowercase, bold) with registered trademark
- **FY Selector:** "FY: 24' - 25'" dropdown — always visible in header, accessible from any page
- **Right icons:** Bell (notifications, red badge "2"), Book icon, Help (?), User avatar

### Top Row — 3 Summary Cards (Equal Width)

#### Card 1: Total Portfolio Value
- **Info icon** (tooltip) + **toggle icons** (pie chart / bar chart)
- **Tax position:** -99% with value -$11.00
- **Cash position:** -101% with value -$11.00
- **Investment type label** (light blue badge)
- **LVR donut chart:** Large circular gauge showing 0.00% — clean, visual, immediately communicates leverage

**Takeaway:** Combines 3 key metrics (tax position, cash position, LVR) into one card. The donut chart is a strong visual anchor.

#### Card 2: Borrowing Power
- **"Open report"** link (teal, top right)
- **Net Income Surplus:** $1,083.33
- **Net Surplus Ratio:** 0%
- **Average Interest Rate:** % (empty)
- **Total Market Value:** $700,000.00
- **Total Loan Balance:** $0.00

**Takeaway:** Borrowing power as a first-class dashboard concept. Investors care deeply about "can I borrow more?" — this answers it at a glance.

#### Card 3: Properties Map
- **Australia outline** in light teal/cyan fill
- **Property pins** (dark markers) showing geographic location of each property
- Pins appear to be placed around Sydney/Melbourne area
- Simple, not interactive — just a visual indicator

**Takeaway:** Instantly communicates "I have X properties across Australia." Geographic diversification is visible at a glance. This is a quick win that adds perceived product depth.

---

### Middle Section — Portfolio & Properties

#### Section Header
- **"Portfolio and properties"** heading (left)
- **"Manage Portfolios"** link with gear icon (right)

#### Tab Pills
- **"All properties (2)"** — green/teal filled pill (selected)
- **"Investment Portfolio (2)"** — grey outlined pill

#### Filters (right side)
- **"All active proper..."** dropdown (truncated)
- **"+ Add Property"** button (blue, filled)

---

### Summary + Equity Row (2 Cards Side by Side)

#### Left Card: Summary
| Metric | Value | Trend |
|--------|-------|-------|
| Market value | $700,000.00 | Red down arrow |
| Equity position | $699,523.19 | Red down arrow |
| Tax position | -$11.00 | Green up arrow |
| Cash position | -$11.00 | Red down arrow |

Plus financial breakdown bars:
| Line Item | Amount | Bar Color |
|-----------|--------|-----------|
| Income | -$6.00 | Green |
| Expenses | $0.00 | (no bar) |
| Interest | -$5.00 | Orange/red |
| Depreciation | $0.00 | Blue |

**Takeaway:** 4 key metrics with trend arrows + 4 line items with color-coded bars. Dense but scannable. The up/down arrows with color (green = good, red = bad) are extremely effective.

#### Right Card: Equity Position Chart
- **Line chart** showing equity projection from ~2026 to 2051
- **Y-axis label:** "Current Fin Year"
- **Green dashed line** with circle markers at each data point
- Shows gradual upward trend (compound growth)
- Time horizon: ~25 years

**Takeaway:** The 25-year equity projection is powerful for long-term investors. Creates an emotional "look how rich I'll be" moment. BrickTrack has this built but feature-flagged.

---

### Property Cards (Bottom Section)

#### Card 1: 10 Smith Street
- **Badge:** "BEST PERFORMANCE GROWTH & TAX" (orange/yellow gradient)
- **Three-dot menu** (top right)

| Metric | Value | Trend |
|--------|-------|-------|
| Market value | $350,000 | Red down |
| Cash position | -$11 | Red down |
| Tax position | -$11 | Green up |
| Rental return | 0% | Red down |

| Line Item | Amount |
|-----------|--------|
| Income | -$6.00 |
| Expenses | $0.00 |
| Interest | -$5.00 |
| Depreciation | $0.00 |

#### Card 2: 123 A'beckett Street
- **Badge:** "MONITORING PERFORMANCE" (blue)
- **Three-dot menu** (top right)

| Metric | Value | Trend |
|--------|-------|-------|
| Market value | $350,000 | Red down |
| Cash position | $0 | Red down |
| Tax position | $0 | Red down |
| Rental return | 0% | Red down |

| Line Item | Amount |
|-----------|--------|
| Income | $0.00 |
| Expenses | $0.00 |
| Interest | $0.00 |
| Depreciation | $0.00 |

**Takeaway:** Each property card has a **performance badge** (color-coded classification), 4 key metrics with trend arrows, and 4 financial line items. The badges ("Best Performance", "Monitoring Performance") add gamification and help investors quickly identify which properties need attention.

---

## Key Design Patterns to Learn From

### 1. Information Density Done Right
TaxTank packs a lot of data onto one screen without feeling cluttered:
- 3 summary cards (top)
- Portfolio-level summary + equity chart (middle)
- Per-property cards with full financial breakdown (bottom)

**Lesson:** BrickTrack's dashboard is currently sparse. The data exists in the backend — surface it.

### 2. Trend Indicators Everywhere
Every numeric value has a colored arrow (green up = good, red down = bad). This creates:
- Instant visual scanning ("how am I doing?")
- Emotional engagement (green = dopamine, red = attention)

**Lesson:** BrickTrack PR #161 adds trend arrows to property cards. Extend this pattern to the dashboard summary cards.

### 3. Performance Classification Badges
Properties get labeled: "Best Performance Growth & Tax", "Monitoring Performance", etc. This is:
- Gamification that keeps users engaged
- Actionable — tells you which property to focus on
- Differentiating — most trackers don't do this

**Lesson:** BrickTrack could implement this using existing metrics. Color-coded badges based on yield, cash flow, and tax position.

### 4. LVR as Visual (Donut Chart)
The LVR donut chart is the visual centerpiece of card 1. LVR is a critical metric for investors:
- < 80% = safe
- 80-90% = leveraged
- 90%+ = high risk

**Lesson:** BrickTrack calculates LVR already. Show it as a donut/gauge on the portfolio dashboard.

### 5. Borrowing Power as First-Class Concept
Most trackers bury borrowing capacity. TaxTank puts it in the top 3 cards. For growth-minded investors, "can I buy another property?" is the #1 question.

**Lesson:** Add a Borrowing Power card to BrickTrack's portfolio dashboard.

---

## To-Do: Features to Build for BrickTrack

### Priority 1 — Quick Wins

- [ ] **Australia Properties Map** — Show an Australia outline with pins for each property location. Use property address coordinates (geocode from address or postcode centroid). Simple SVG map with marker dots. Not interactive — just visual. This is high perceived value for minimal effort.
- [ ] **Unflag Portfolio Dashboard** — The "one screen" overview is what TaxTank does best. BrickTrack has this built.
- [ ] **Add trend arrows to dashboard stat cards** — Green up / red down on every metric
- [ ] **LVR donut/gauge on portfolio card** — Visual representation of portfolio leverage

### Priority 2 — Medium Effort

- [ ] **Property performance badges** — Classify properties as "Top Performer", "Monitoring", "Underperforming" based on yield, cash flow, tax position
- [ ] **Equity position projection chart** — 25-year compound growth line chart (built, needs unflagging)
- [ ] **Borrowing Power card** — Net income surplus, surplus ratio, total market value vs total loans
- [ ] **FY selector in header bar** — Global dropdown for switching financial year context
- [ ] **Per-property financial breakdown on cards** — Income, Expenses, Interest, Depreciation bars

### Priority 3 — Larger Build

- [ ] **Property portfolio tabs** — Filter by portfolio type (All, Investment, etc.)
- [ ] **"Manage Portfolios" flow** — Create/edit portfolio groupings
- [ ] **Active/inactive property filter** — Dropdown to filter property status

---

## Australia Properties Map — Implementation Notes

### What It Looks Like (from TaxTank)
- Light teal/cyan filled Australia silhouette
- Dark pin markers at approximate property locations
- Static image (not interactive map like Google Maps)
- Fits within a standard dashboard card (~300px wide)

### Implementation Approach
1. **SVG Australia outline** — Use a simplified Australia SVG (widely available, ~5KB)
2. **Geocoding** — Convert property postcode to approximate lat/lng coordinates (Australian postcode centroids are publicly available as a dataset)
3. **Pin placement** — Plot pins on the SVG using coordinate-to-SVG-position mapping
4. **Fallback** — If geocoding fails, don't show the pin (graceful degradation)
5. **No external dependency** — No Google Maps API needed. Pure SVG + data

### Alternative: Leaflet/MapBox (if interactive is desired later)
- Could use react-leaflet with OpenStreetMap tiles
- More effort but allows zoom, click-to-property, satellite view
- Consider as V2 enhancement

### Data Required
- Property address (already captured)
- Postcode → lat/lng lookup (static dataset, ~2,600 Australian postcodes)
- Number of properties at each location (for clustering if many)

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-09 | 1.0 | Claude Code | Initial dashboard deep dive from live screenshot |
