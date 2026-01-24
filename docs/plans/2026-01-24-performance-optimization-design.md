# Performance Optimization Design

## Goal

Improve application performance through data caching, optimistic UI updates, React Server Components, and lazy loading.

## Architecture

Configure React Query with sensible caching defaults, add optimistic updates for common mutations, convert key pages to use server-side data fetching with client hydration, and lazy load heavy components like charts.

## 1. Data Caching Strategy

### QueryClient Configuration

Update `src/lib/trpc/Provider.tsx` with caching defaults:

```typescript
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // Data fresh for 30 seconds
      gcTime: 5 * 60 * 1000,      // Keep in cache 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1,                    // Only retry once on failure
    },
  },
}));
```

### Query-Specific Overrides

| Data Type | staleTime | Rationale |
|-----------|-----------|-----------|
| Dashboard stats | 60s | Summary data, okay to be slightly stale |
| Property/Transaction lists | 30s | Core data, moderate freshness |
| Alerts | 10s | Time-sensitive, refetch more often |
| User preferences | 5min | Rarely changes |

## 2. Optimistic UI Updates

### Mutations to Optimize

1. **transaction.updateCategory** - Most frequent action when reviewing transactions
2. **transaction.toggleVerified** - Quick checkbox toggle
3. **banking.dismissAlert** - Remove alert banner immediately

### Pattern

```typescript
const updateCategory = trpc.transaction.updateCategory.useMutation({
  onMutate: async (newData) => {
    await utils.transaction.list.cancel();
    const previous = utils.transaction.list.getData();

    utils.transaction.list.setData(undefined, (old) => ({
      ...old,
      transactions: old.transactions.map((t) =>
        t.id === newData.id ? { ...t, category: newData.category } : t
      ),
    }));

    return { previous };
  },
  onError: (err, newData, context) => {
    utils.transaction.list.setData(undefined, context.previous);
    toast.error("Failed to update category");
  },
  onSettled: () => {
    utils.transaction.list.invalidate();
  },
});
```

### Files to Modify

- `src/app/(dashboard)/transactions/page.tsx` - updateCategory, toggleVerified
- `src/app/(dashboard)/dashboard/page.tsx` - dismissAlert

## 3. React Server Components

### Server-Side tRPC Caller

Create `src/lib/trpc/server.ts`:

```typescript
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

const createCaller = createCallerFactory(appRouter);

export async function getServerCaller() {
  const { userId } = await auth();
  return createCaller({ db, clerkId: userId });
}
```

### Pages to Convert

| Page | Benefit | Change |
|------|---------|--------|
| Dashboard | High - first page users see | Prefetch stats, pass as initialData |
| Properties list | Medium - simple list | Prefetch properties server-side |
| Transactions | Low - needs client interactivity | Keep client-side |

### Pattern

```typescript
// page.tsx (Server Component)
export default async function DashboardPage() {
  const caller = await getServerCaller();
  const stats = await caller.stats.dashboard();

  return <DashboardClient initialStats={stats} />;
}

// DashboardClient.tsx ("use client")
export function DashboardClient({ initialStats }) {
  const { data: stats } = trpc.stats.dashboard.useQuery(undefined, {
    initialData: initialStats,
  });
  // ... rest of component
}
```

## 4. Lazy Loading

### Components to Lazy Load

| Component | Size Impact | When Loaded |
|-----------|-------------|-------------|
| Recharts (EquityDonutChart, CashFlowBarChart) | ~45kb gzipped | Portfolio/Reports pages |
| ImportCSVDialog | ~15kb (xlsx lib) | When user clicks import |
| OnboardingWizard | ~8kb | Only for new users |

### Pattern

```typescript
import dynamic from "next/dynamic";

const EquityDonutChart = dynamic(
  () => import("@/components/portfolio/EquityDonutChart").then(m => ({ default: m.EquityDonutChart })),
  {
    loading: () => <div className="h-64 bg-muted animate-pulse rounded" />,
    ssr: false
  }
);
```

### Files to Modify

- `src/app/(dashboard)/portfolio/page.tsx` - Lazy load charts
- `src/app/(dashboard)/reports/portfolio/page.tsx` - Lazy load CashFlowChart
- `src/app/(dashboard)/transactions/page.tsx` - Lazy load ImportCSVDialog

## Summary

| Area | Files | Impact |
|------|-------|--------|
| Data Caching | Provider.tsx | Fewer refetches, smoother navigation |
| Optimistic Updates | transactions/page.tsx, dashboard/page.tsx | Instant feedback on actions |
| React Server Components | trpc/server.ts, dashboard, properties | Faster initial load |
| Lazy Loading | portfolio, reports, transactions pages | Smaller initial bundle |
