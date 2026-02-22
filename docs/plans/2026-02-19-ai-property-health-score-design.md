# AI Property Health Score & Insights — Design

**Beads task:** property-tracker-z23

**Goal:** Add LLM-generated natural language insights per property and portfolio. Leverages existing scorecard metrics + property data to produce actionable recommendations like "Insurance on Property A is 40% above portfolio average — consider shopping around."

**V1 Scope:** On-demand generation with 24h cache. Claude 3.5 Haiku for cost efficiency. Dashboard widget (top 3 insights) + expanded section on scorecard page. Free for all users.

---

## Data Model

**New table** `portfolio_insights`:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| userId | text FK → users | One active cache per user |
| insights | jsonb | Array of PortfolioInsight objects |
| generatedAt | timestamp | When LLM was called |
| expiresAt | timestamp | generatedAt + 24h |
| modelUsed | text | e.g. "claude-3-5-haiku-20241022" |
| inputTokens | int | Cost tracking |
| outputTokens | int | Cost tracking |
| createdAt | timestamp | Auto-set |

**Insight object shape:**

```typescript
interface PortfolioInsight {
  propertyId: string | null;  // null = portfolio-level
  category: "yield" | "expense" | "loan" | "concentration" | "compliance" | "growth" | "general";
  severity: "positive" | "info" | "warning" | "critical";
  title: string;              // Short headline
  body: string;               // 1-2 sentence explanation with actionable advice
}
```

**Index:** `userId` (one active row per user, upsert on regenerate).

---

## Architecture

**Approach:** On-demand generation with DB cache. No cron. Re-generate via user action.

**Rejected alternatives:**
- Daily cron — higher API cost, generates for inactive users
- Real-time streaming — highest cost, unnecessary latency for cached-friendly content
- Separate health score — scorecard already has a 0-100 score, adding another creates confusion

---

## tRPC Procedures

New procedures in `portfolio` router:

| Procedure | Type | Purpose |
|-----------|------|---------|
| `getInsights` | protectedProcedure | Returns cached insights if fresh (<24h), otherwise `{ stale: true, insights: null }` |
| `generateInsights` | writeProcedure | Gathers portfolio data, calls Haiku, caches, returns insights |

**`generateInsights` flow:**
1. Rate-limit check: max 1 generation per user per hour
2. Fetch properties, loans, transactions (12mo), valuations, scorecard metrics, suburb benchmarks via `Promise.all`
3. Build structured prompt with all data
4. Call Claude 3.5 Haiku with JSON output mode
5. Validate response with Zod schema
6. Upsert into `portfolio_insights` (replace existing row for user)
7. Return insights array

**Prompt structure:**
- System: "You are a property investment analyst. Analyze the portfolio data and return 8-15 actionable insights as JSON."
- Defines output schema, categories, severity levels, and example insights
- User: Structured portfolio data (properties, metrics, loans, transactions, benchmarks)
- No PII beyond property addresses (no emails, names, bank details)

**Rate limiting:** 1 generation per user per hour. Return `TRPCError TOO_MANY_REQUESTS` if exceeded.

---

## UI

### Dashboard Widget

Compact "AI Insights" card:
- Sparkles icon + "AI Insights" title + "View All" link to scorecard
- Shows top 3 insights (highest severity first: critical > warning > info > positive)
- Each row: severity dot + title + truncated body
- Stale/no insights state: "Generate Insights" button
- Loading state: shimmer skeleton while generating
- Footer: "Last updated 3h ago" timestamp

### Scorecard Page — Insights Section

Below existing scorecard grid:
- Full list of all insights grouped: portfolio-level first, then per-property
- Each insight: severity badge + title + full body text
- "Refresh Insights" button in section header (disabled with cooldown indicator if <1h since last generation)
- Collapsible per-property groups

### Severity Colors

| Severity | Color | Example |
|----------|-------|---------|
| critical | red | "Property B running negative cash flow for 6 months" |
| warning | amber | "Insurance 40% above portfolio average" |
| info | blue | "Portfolio concentrated in one suburb" |
| positive | green | "Property A yield 2% above median — strong performer" |

### Disclaimer

Every render includes: "AI-generated insights — verify with your financial advisor."

---

## LLM Details

**Model:** Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
- Fast, cheap (~$0.001/call)
- Already used for transaction categorization
- Sufficient for structured data → text insights

**Output format:** JSON array validated with Zod before caching. Malformed responses → empty array + error log.

**Token tracking:** `inputTokens` and `outputTokens` stored per generation for cost monitoring.

---

## Feature Flag & Routing

- Feature flag: `aiInsights: true`
- No new route — widget on dashboard, section on existing scorecard page
- No plan gating — free for all users

---

## Testing

Unit tests (6 cases):
1. `getInsights` returns cached insights when fresh
2. `getInsights` returns stale flag when expired/missing
3. `generateInsights` calls Haiku and caches result
4. `generateInsights` rate-limits to 1/hr per user
5. Prompt builder includes all data categories
6. Response parser handles malformed LLM output gracefully

---

## Not in V1

- Per-property detail page with insight history
- Insight trends over time
- Push notifications for critical insights
- User feedback on insight quality (thumbs up/down)
- Sonnet model option for deeper analysis
