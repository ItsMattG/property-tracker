# Property Benchmarking Design

**Date:** 2026-01-26
**Status:** Approved

## Goal

Enable users to benchmark their properties against similar ones and identify underperformers. Compare yield, growth, and expenses against suburb averages and similar property cohorts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PropertyTracker                          │
├─────────────────────────────────────────────────────────────┤
│  External Data Layer                                        │
│    └── Domain API → suburb_benchmarks table                 │
├─────────────────────────────────────────────────────────────┤
│  Benchmarking Service                                       │
│    ├── findSimilarCohort(property) → weighted scoring       │
│    ├── calculatePercentiles(property, cohort)               │
│    └── detectUnderperformers(portfolio)                     │
├─────────────────────────────────────────────────────────────┤
│  UI Integration                                             │
│    ├── Property Detail → Benchmark Card                     │
│    ├── Portfolio → Performance Tab                          │
│    └── Alerts → Underperformer notifications                │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### suburb_benchmarks table

```sql
CREATE TABLE suburb_benchmarks (
  id UUID PRIMARY KEY,
  suburb TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT NOT NULL,
  property_type TEXT NOT NULL, -- 'house', 'unit', 'townhouse'
  bedrooms INTEGER, -- null = all bedrooms aggregate

  -- Rental metrics
  median_rent DECIMAL(10,2),
  rental_yield DECIMAL(5,2), -- percentage
  vacancy_rate DECIMAL(5,2), -- percentage
  days_on_market INTEGER,

  -- Sales metrics
  median_price DECIMAL(12,2),
  price_growth_1yr DECIMAL(5,2), -- percentage
  price_growth_5yr DECIMAL(5,2), -- percentage

  -- Metadata
  sample_size INTEGER,
  data_source TEXT, -- 'domain', 'corelogic', etc.
  period_start DATE,
  period_end DATE,
  fetched_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(suburb, state, property_type, bedrooms, period_end)
);
```

### property_benchmarks table

```sql
CREATE TABLE property_benchmarks (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Percentile rankings (0-100)
  yield_percentile INTEGER,
  growth_percentile INTEGER,
  expense_percentile INTEGER,
  vacancy_percentile INTEGER,

  -- Overall score
  performance_score INTEGER, -- 0-100

  -- Comparison context
  cohort_size INTEGER,
  cohort_description TEXT, -- "3-bed houses in Richmond VIC"
  suburb_benchmark_id UUID REFERENCES suburb_benchmarks(id),

  -- Insights
  insights JSONB, -- array of {type, message, severity}

  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(property_id)
);
```

## External API Integration

**Domain API** (primary source):
- `/suburbPerformanceStatistics` - median rent, yield, vacancy
- `/salesResults` - median price, days on market
- Rate limited: cache aggressively

**Refresh strategy:**
- Weekly cron job updates suburb benchmarks
- Property benchmarks recalculate on:
  - Property data change (rent, purchase price update)
  - New transaction categorized
  - Suburb benchmark update

## Similarity Scoring

### Cohort Selection

Weighted scoring to find comparison cohort:

| Factor | Weight | Scoring |
|--------|--------|---------|
| Location | 50% | Same suburb=100%, adjacent=70%, same LGA=40% |
| Property type | 30% | Same type=100%, different=0% |
| Bedrooms | 20% | Exact=100%, ±1=60%, ±2=20% |

Minimum cohort size: 10 properties. If insufficient, expand location radius.

### Percentile Calculation

For each metric, calculate where user's property falls:

```typescript
function calculatePercentile(userValue: number, benchmarkMedian: number): number {
  // Simplified: compare to median
  // >median = above 50th percentile, scaled by distance
  const ratio = userValue / benchmarkMedian;
  if (ratio >= 1.2) return 90; // 20%+ above median
  if (ratio >= 1.1) return 75;
  if (ratio >= 1.0) return 55;
  if (ratio >= 0.9) return 40;
  if (ratio >= 0.8) return 25;
  return 10; // 20%+ below median
}
```

### Performance Score

Weighted combination:
- Yield percentile: 40%
- Growth percentile: 30%
- Expense percentile: 20% (inverted - lower is better)
- Vacancy percentile: 10% (inverted)

### Underperformer Detection

Flag property as underperforming if ANY:
- Yield below 25th percentile
- Expenses above 75th percentile
- Vacancy 2x suburb average

## Insights Generation

Generate actionable insights based on metrics:

| Condition | Insight |
|-----------|---------|
| Rent < 85% of median | "Rent is X% below market. Consider rent review at next lease renewal." |
| Expenses > 120% of typical | "Operating expenses are high. Review insurance and management fees." |
| Vacancy > 2x suburb | "High vacancy compared to suburb average. Check property presentation or agent performance." |
| Yield > 110% of median | "Strong yield performance - top quartile for similar properties." |

## UI Integration

### Property Detail - Benchmark Card

```
┌─────────────────────────────────────────────┐
│ Performance Score: 73/100        [Good]     │
│ Compared to 24 similar 3-bed houses in      │
│ Richmond VIC                                │
├─────────────────────────────────────────────┤
│ Rental Yield    ████████░░  78th percentile │
│ Capital Growth  ██████░░░░  62nd percentile │
│ Expenses        ██████████  45th percentile │
│                 (lower is better)           │
├─────────────────────────────────────────────┤
│ 💡 Insight: Your rent is 8% below market    │
│    median. Consider reviewing at renewal.   │
└─────────────────────────────────────────────┘
```

### Portfolio - Performance Tab

Table view with columns:
- Property address
- Performance score (color-coded)
- Yield vs market
- Key insight

Sorted by performance score ascending (worst first) to highlight action items.

### Alerts

- **Immediate:** Property drops to underperforming status
- **Monthly:** Portfolio performance digest email
- **Market shift:** Suburb benchmark changes significantly (>10%)

## API Endpoints

```typescript
// Get benchmark for single property
trpc.benchmarking.getPropertyBenchmark({ propertyId })

// Get all benchmarks for portfolio
trpc.benchmarking.getPortfolioBenchmarks()

// Get underperformers only
trpc.benchmarking.getUnderperformers()

// Trigger recalculation
trpc.benchmarking.recalculate({ propertyId })

// Get suburb benchmark data
trpc.benchmarking.getSuburbBenchmark({ suburb, state, propertyType })
```

## Future Evolution

### Phase 2: Aggregated User Data
- Opt-in anonymized expense sharing
- "Properties like yours spend $X on insurance"
- Requires critical mass (~100 properties per cohort)

### Phase 3: Vector Embeddings
- Use pgvector extension (stays in Postgres)
- Embed: location, attributes, financials, performance history
- Enable nuanced similarity queries
- Power "recommended suburbs" feature

## Testing

| Layer | Approach |
|-------|----------|
| Percentile calculation | Unit tests with known distributions |
| Similarity scoring | Unit tests with mock properties |
| Insight generation | Unit tests covering all conditions |
| API integration | Mock Domain API responses |
| UI components | Component tests for benchmark card |

## Environment Variables

```
DOMAIN_API_KEY=your_api_key
DOMAIN_API_URL=https://api.domain.com.au/v1
```
