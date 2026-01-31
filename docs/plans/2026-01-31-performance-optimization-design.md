# Performance Optimization Design

**Date:** 2026-01-31
**Status:** Approved
**Goal:** Improve page load performance across all pages (production and development)

---

## Problem Statement

The PropertyTracker app feels sluggish across all pages, both in production (Vercel) and local development. This points to fundamental architecture issues rather than hosting problems.

## Root Causes Identified

1. **`force-dynamic` on root layout** — Every page server-renders on every request, disabling all caching and static generation
2. **Waterfall API calls** — Dashboard fires 4+ independent queries; sidebar fires 2 queries on every navigation
3. **Heavy dependencies in main bundle** — recharts (~400KB), xlsx (~400KB), jspdf (~300KB) ship to all pages
4. **No prefetching strategy** — Navigation feels slow without prefetch hints

---

## Solution Design

### 1. Caching Strategy

**Changes:**

| File | Current | Target |
|------|---------|--------|
| `src/app/layout.tsx` | `force-dynamic` | Remove entirely |
| `src/app/(dashboard)/layout.tsx` | `force-dynamic` | Keep (auth required) |
| `src/app/page.tsx` | `revalidate = 3600` | Works once root fixed |
| `src/app/blog/[slug]/page.tsx` | None | Add `revalidate = 86400` |
| `src/app/changelog/page.tsx` | None | Add `revalidate = 3600` |

**Implementation:**
- Remove line 52 from `src/app/layout.tsx`
- Verify dashboard layout retains `force-dynamic`
- Add revalidate exports to public pages
- Consider `unstable_cache` for expensive per-user queries

**Expected Impact:**
- Public pages: ~50-200ms (edge cached) vs 500ms+ (server rendered)
- Reduced server load

---

### 2. Data Loading Optimization

**Dashboard consolidation:**

Create `trpc.dashboard.getInitialData()` returning:
```typescript
{
  stats: DashboardStats,
  alerts: Alert[],
  onboarding: OnboardingProgress,
  properties: Property[]
}
```

Pass to `DashboardClient` as `initialData` — eliminates client-side refetch.

**Sidebar optimization:**

| Query | Current Behavior | Target |
|-------|------------------|--------|
| `getPendingCount` | Every page load | Dashboard only |
| `getActive` | Every page load | `staleTime: Infinity`, invalidate on switch |

**Prefetching:**
- Enable `<Link prefetch>` for common paths
- Add hover prefetch for property list → property detail

**Expected Impact:**
- Dashboard: 4+ round-trips → 1
- Navigation: 2 fewer queries per page

---

### 3. Bundle Size Reduction

**Dynamic imports:**

| Component/Lib | Used On | Strategy |
|---------------|---------|----------|
| `recharts` | Dashboard charts, reports | `dynamic(() => import(...))` with skeleton |
| `ChatPanel` | Dashboard layout | Lazy load on first open |
| `xlsx` | Export page | Move to API route (server-side) |
| `jspdf` | PDF export | Move to API route (server-side) |

**Implementation pattern:**
```tsx
const RechartsChart = dynamic(
  () => import('@/components/charts/RechartsChart'),
  { loading: () => <ChartSkeleton /> }
)
```

**Verification:**
- Add `@next/bundle-analyzer` to devDependencies
- Run `ANALYZE=true npm run build` before/after

**Expected Impact:**
- Initial JS: ~1MB+ → ~400KB (estimate)
- Faster Time to Interactive

---

### 4. Quick Wins

**Images:**
- Audit all `<Image>` usage for proper `width`/`height`
- Limit `priority` to above-the-fold only
- Add `placeholder="blur"` for hero images

**Fonts:**
- Verify `next/font` config includes `display: 'swap'`

**Database:**
- Add indexes for: `properties.userId`, `transactions.propertyId`, `transactions.userId`
- Review tRPC procedures for N+1 patterns

**Monitoring:**
- Add Vercel Speed Insights or manual Web Vitals tracking
- Track LCP, FID, CLS over time

---

## Measurement Plan

**Before starting, capture:**
1. Lighthouse scores (mobile + desktop) for `/`, `/dashboard`, `/properties`
2. `next build` output showing route sizes
3. Network waterfall screenshots for dashboard load

**After each phase:**
- Re-run measurements
- Compare bundle sizes
- Document improvements

---

## Implementation Order

1. **Caching Strategy** — Biggest impact, lowest risk
2. **Bundle Size** — High impact, moderate effort
3. **Data Loading** — Moderate impact, requires tRPC changes
4. **Quick Wins** — Polish, can be done incrementally

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Removing `force-dynamic` breaks auth | Dashboard layout retains it; test auth flows |
| Dynamic imports cause layout shift | Use skeleton loaders matching component size |
| Consolidated query too large | Monitor response size; split if >50KB |
| ISR shows stale data | Choose appropriate revalidate times; add manual revalidation for critical updates |

---

## Success Criteria

- [ ] Lighthouse Performance score > 80 on mobile for `/dashboard`
- [ ] Initial JS bundle < 500KB
- [ ] Time to Interactive < 3s on 3G throttled
- [ ] No regressions in functionality
