# BrickTrack Codebase Patterns Reference

> **For Claude agents.** This document covers every pattern, convention, and anti-pattern in the codebase. Read this before implementing any feature. For quick component lookups, see `src/components/ui/CLAUDE.md`. For server/data patterns, see `src/server/CLAUDE.md`.

---

## Tech Stack (Exact Versions)

| Layer | Package | Version |
|-------|---------|---------|
| Framework | Next.js (App Router) | 16.1.4 |
| React | React | 19.2.3 |
| API | tRPC | v11 |
| Data fetching | React Query (TanStack) | v5 |
| ORM | Drizzle ORM | 0.45 |
| Database | PostgreSQL (pgvector) | 16 |
| Auth | Clerk | v6 |
| Styling | Tailwind CSS | v4 |
| UI primitives | shadcn/ui (new-york style) | latest |
| Icons | Lucide React | latest |
| Component variants | class-variance-authority (CVA) | latest |
| Forms | React Hook Form | v7 |
| Validation | Zod | v4 |
| Toasts | Sonner | v2 |
| Charts | Recharts | v3 |
| Payments | Stripe | v20 |
| Storage | Supabase JS | v2 |
| AI (chat) | Vercel AI SDK + @ai-sdk/anthropic | latest |
| AI (categorization) | @anthropic-ai/sdk | latest |
| Monitoring | Sentry + Axiom | latest |
| Analytics | PostHog (DISABLED) | latest |
| E2E testing | Playwright | 1.58.1 |
| Unit testing | Vitest | latest |
| Onboarding | driver.js | latest |

---

## 1. Page Template Pattern

Every dashboard page follows the same 3-state structure. Copy this template:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { PropertyListSkeleton } from "@/components/skeletons";

export default function MyPage() {
  const { data: items, isLoading } = trpc.myRouter.list.useQuery();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Page Title</h2>
          <p className="text-muted-foreground">Description text</p>
        </div>
        <Button asChild>
          <Link href="/my-route/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Link>
        </Button>
      </div>

      {/* 3-state render: loading / data / empty */}
      {isLoading ? (
        <PropertyListSkeleton count={3} />
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={item.id} className="animate-card-entrance" style={{ '--stagger-index': i } as React.CSSProperties}>
              <ItemCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No items yet</h3>
          <p className="text-muted-foreground max-w-sm mt-2">Description of what to do</p>
          <Button asChild className="mt-4">
            <Link href="/my-route/new">Add your first item</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Server component pages** (rare — only `/dashboard`): Fetch data with `getServerTRPC()`, pass as `initialData`:
```tsx
// page.tsx (server component, NO "use client")
import { getServerTRPC } from "@/lib/trpc/server";
import { MyClient } from "./MyClient";

export default async function MyPage() {
  const trpc = await getServerTRPC();
  const data = await trpc.myRouter.getData().catch(() => null);
  return <MyClient initialData={data} />;
}
```

**Suspense boundary pages** (for report pages):
```tsx
import { Suspense } from "react";
import { MyContent } from "./MyContent";

export const dynamic = "force-dynamic";

function MyLoading() {
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Title</h2></div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={<MyLoading />}>
      <MyContent />
    </Suspense>
  );
}
```

---

## 2. tRPC Data Fetching

### Queries

```tsx
import { trpc } from "@/lib/trpc/client";

// Basic query
const { data, isLoading, error } = trpc.property.list.useQuery();

// Query with input
const { data } = trpc.transaction.list.useQuery({
  propertyId: filters.propertyId,
  category: filters.category,
  limit: PAGE_SIZE,
  offset,
});

// With SSR initialData
const { data } = trpc.stats.dashboard.useQuery(undefined, {
  initialData: initialData?.stats,
  staleTime: 60_000,
});
```

**Default query options** (set in `Provider.tsx`): staleTime 30s, gcTime 5min, refetchOnWindowFocus false, retry 1.

### Mutations

```tsx
const utils = trpc.useUtils();

// Simple mutation with cache invalidation
const deleteMutation = trpc.property.delete.useMutation({
  onSuccess: () => {
    toast.success("Property deleted");
    utils.property.list.invalidate();
  },
  onError: (error) => toast.error(getErrorMessage(error)),
});

// Mutation with cache pre-population (use after create + redirect)
const createMutation = trpc.property.create.useMutation({
  onSuccess: (property) => {
    utils.property.get.setData({ id: property.id }, property);
    utils.property.list.invalidate();
    router.push(`/properties/${property.id}/settlement`);
  },
});
```

### Optimistic Updates

Full pattern (used for transaction category, verification toggle, alert dismissal):

```tsx
const updateCategory = trpc.transaction.updateCategory.useMutation({
  onMutate: async (newData) => {
    await utils.transaction.list.cancel();
    const queryKey = { propertyId: filters.propertyId /* ... */ };
    const previous = utils.transaction.list.getData(queryKey);
    utils.transaction.list.setData(queryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        transactions: old.transactions.map((t) =>
          t.id === newData.id ? { ...t, category: newData.category } : t
        ),
      };
    });
    return { previous, queryKey };
  },
  onError: (error, _newData, context) => {
    if (context?.previous) {
      utils.transaction.list.setData(context.queryKey, context.previous);
    }
    toast.error(getErrorMessage(error));
  },
  onSettled: () => utils.transaction.list.invalidate(),
});
```

### Prefetching (sidebar hover)

```tsx
const utils = trpc.useUtils();
const handlePrefetch = (href: string) => {
  if (href === "/dashboard") {
    utils.stats.dashboard.prefetch();
    utils.property.list.prefetch();
  }
};
```

### Pagination

```tsx
const [page, setPage] = useState(1);
const offset = (page - 1) * PAGE_SIZE;
const { data } = trpc.transaction.list.useQuery({ limit: PAGE_SIZE, offset });
// ...
<Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
```

---

## 3. Form Patterns

**Stack:** `react-hook-form` v7 + `@hookform/resolvers` + `zod` v4 + shadcn Form components.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const mySchema = z.object({
  name: z.string().min(1, "Name is required"),
  state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"], { error: "State is required" }),
  amount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
});

type MyFormValues = z.infer<typeof mySchema>;

export function MyForm({ onSubmit, isLoading }: { onSubmit: (values: MyFormValues) => void; isLoading: boolean }) {
  const form = useForm<MyFormValues>({
    resolver: zodResolver(mySchema),
    defaultValues: { name: "", state: undefined, amount: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input placeholder="Enter name" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="state" render={({ field }) => (
          <FormItem>
            <FormLabel>State</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
              <SelectContent>
                {["NSW", "VIC", "QLD"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  );
}
```

**Grid layouts in forms:** `<div className="grid grid-cols-2 gap-4">` for side-by-side fields.

---

## 4. Toast / Notification System

**Library:** Sonner v2. Toaster rendered in root layout with `richColors`.

```tsx
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

// Success
toast.success("Property created");

// Error (always use getErrorMessage for tRPC errors)
toast.error(getErrorMessage(error));

// Info with action
toast.info("Reminder: Only your first property stays active after your trial", {
  action: {
    label: "Upgrade",
    onClick: () => router.push("/settings/billing"),
  },
  duration: 5000,
});
```

**Custom toast colors** are defined in `globals.css` (green success, red error, amber warning, blue info) with light/dark variants.

**Error message extraction** (`src/lib/errors.ts`):
```tsx
import { getErrorMessage } from "@/lib/errors";
// Handles TRPCClientError, Error, string, unknown → returns string
```

---

## 5. Loading States & Skeletons

### Available Skeletons

| Component | Import | Props |
|-----------|--------|-------|
| `Skeleton` | `@/components/ui/skeleton` | Base building block (`animate-pulse rounded-md bg-muted`) |
| `DataSkeleton` | `@/components/ui/data-skeleton` | `variant="card"\|"list"\|"table"`, `count` |
| `ChartSkeleton` | `@/components/ui/chart-skeleton` | `height` |
| `PropertyListSkeleton` | `@/components/skeletons` | `count` |
| `TransactionTableSkeleton` | `@/components/skeletons` | — |
| `LoanCardSkeleton` | `@/components/skeletons` | — |

### Button Loading Pattern
```tsx
<Button type="submit" disabled={isLoading}>
  {isLoading ? "Saving..." : "Save Property"}
</Button>
```

### Inline Skeleton for Suspense
```tsx
<div className="h-64 bg-muted animate-pulse rounded-lg" />
```

---

## 6. Modal & Dialog Patterns

### Dialog (forms, info)
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

<Dialog open={showModal} onOpenChange={setShowModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
      <Button onClick={handleSubmit}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### AlertDialog (destructive confirmations)
```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

<AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete item?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Sheet (slide-over panel)
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

<Sheet open={open} onOpenChange={onClose}>
  <SheetContent side="right">
    <SheetHeader><SheetTitle>Panel Title</SheetTitle></SheetHeader>
    {/* content */}
  </SheetContent>
</Sheet>
```

**State pattern:** Always `useState<boolean>` or `useState<Item | null>` (non-null = open).

---

## 7. Styling System

### Tailwind v4 Configuration
- **No `tailwind.config.ts`** — Tailwind v4 uses CSS-first config via `@theme inline` in `globals.css`
- Design tokens are CSS variables: `--color-primary`, `--bg-primary`, `--text-primary`, etc.
- 5 themes defined in `src/styles/themes.css` (Forest, Clean, Dark, Friendly, Bold)

### cn() Utility
```tsx
import { cn } from "@/lib/utils";
// Merges Tailwind classes with conflict resolution
<div className={cn("base-class", isActive && "active-class", className)} />
```

### Card Animation (stagger)
```tsx
{items.map((item, i) => (
  <div key={item.id} className="animate-card-entrance" style={{ '--stagger-index': i } as React.CSSProperties}>
    <Card>{/* ... */}</Card>
  </div>
))}
```

### Interactive Card (hover)
```tsx
<Card className="interactive-card cursor-pointer">
  {/* translateY(-1px) + shadow on hover */}
</Card>
```

### Responsive Grid Patterns
```
grid-cols-1 md:grid-cols-2 lg:grid-cols-3  → Properties, portfolio cards
grid-cols-1 md:grid-cols-2 lg:grid-cols-4  → Dashboard stats, compliance
grid-cols-1 md:grid-cols-3                  → Reports hub
grid-cols-1 md:grid-cols-2                  → Loans, tax
grid-cols-1 lg:grid-cols-2                  → Property detail, secondary widgets
```

All grids use `gap-4` or `gap-6`. Always mobile-first single-column.

### Fonts
Geist Sans + Geist Mono (`next/font/google`).

---

## 8. Component Composition Patterns

### CVA (class-variance-authority)
Components with visual variants use CVA. The pattern:
```tsx
import { cva, type VariantProps } from "class-variance-authority";

const myVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
});

function MyComponent({ className, variant, size, ...props }: React.ComponentProps<"div"> & VariantProps<typeof myVariants>) {
  return <div className={cn(myVariants({ variant, size }), className)} {...props} />;
}

export { MyComponent, myVariants };
```

Always export the variants object alongside the component.

### Radix UI Wrapping (shadcn/ui pattern)
Modern components use plain functions with `React.ComponentProps`:
```tsx
function DialogContent({ className, children, showCloseButton = true, ...props }:
  React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn("...", className)} {...props}>
        {children}
        {showCloseButton && <DialogPrimitive.Close>...</DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
```

Key conventions:
- Every wrapper adds `data-slot="x-name"` for CSS targeting
- `className` extracted, passed through `cn()` with base styles, rest spread with `{...props}`
- Complex content components compose Portal + Overlay + Content internally
- Named export block at bottom of file

### asChild Pattern
Makes a component render as its child element (via Radix `Slot`):
```tsx
// Button as Link
<Button asChild><Link href="/new"><Plus className="w-4 h-4 mr-2" />Add</Link></Button>

// Dropdown trigger as Button
<DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><MoreVertical /></Button></DropdownMenuTrigger>

// DialogDescription as div (for complex content)
<DialogDescription asChild><div className="space-y-4">...</div></DialogDescription>
```

### forwardRef — DO NOT USE
Only 3 legacy files use `React.forwardRef` (alert, tooltip, progress). React 19 passes ref as a regular prop. Use plain function components with `React.ComponentProps`.

### Compound Components
Multiple related components in one file, exported as a named block:
```tsx
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
```

### Type Patterns
- UI components: inline types in function signature (`React.ComponentProps<"div">`)
- App components: file-local `interface` (NOT exported)
- Never export prop interfaces from UI components

---

## 9. Error Handling

### 3 Layers

**Layer 1 — Global error page** (`src/app/global-error.tsx`):
Reports to Sentry, shows "Something went wrong" with reset button.

**Layer 2 — ErrorBoundary** (`src/components/ErrorBoundary.tsx`):
Class component with Card + AlertTriangle fallback. Accepts optional `fallback` prop. Exists but NOT currently rendered anywhere.

**Layer 3 — Inline error states:**
```tsx
import { ErrorState } from "@/components/ui/error-state";
<ErrorState message="Failed to load" onRetry={() => refetch()} />

// Or toast
toast.error(getErrorMessage(error));
```

### API Error Sanitization
In `src/app/api/trpc/[trpc]/route.ts`:
- Known TRPCError codes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND) pass through
- INTERNAL_SERVER_ERROR: generates error ID, logs full details, returns sanitized message

---

## 10. Authentication

### Middleware (`src/middleware.ts`)
```tsx
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
const isPublicRoute = createRouteMatcher(["/", "/blog(.*)", "/sign-in(.*)", ...]);
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) await auth.protect();
});
```

### Server-side auth (tRPC context)
```tsx
const authResult = await auth(); // Clerk async — MUST await in v6
const clerkId = authResult.userId;
```

### Client-side
```tsx
import { UserButton } from "@clerk/nextjs";
<UserButton afterSignOutUrl="/" />
```

### Protected routes
All non-public routes require auth via middleware. tRPC `protectedProcedure` resolves user + portfolio context.

---

## 11. File Uploads

**Stack:** `react-dropzone` + Supabase Storage (signed URLs).

**Flow:**
1. User drops file via `useDropzone` (accepts JPEG, PNG, HEIC, PDF; max 10MB)
2. `trpc.documents.getUploadUrl.useMutation()` → signed URL + storage path + token
3. Upload to Supabase: `supabase.storage.from("documents").uploadToSignedUrl(storagePath, token, file)`
4. Create record: `trpc.documents.create.useMutation()`

**Supabase client:** Use `getSupabase()` from `@/lib/supabase/client` (lazy init, prevents crashes when env vars missing locally).

---

## 12. Navigation

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Collapsible (16px vs 256px), `Cmd+\` shortcut
- State persisted in localStorage (`sidebar-collapsed`, `sidebar-sections`)
- Grouped sections: Properties & Banking, Reports & Tax, Communication
- Active link: `border-l-2 border-primary bg-primary/5 text-primary font-semibold`
- Prefetch on hover
- Feature-flag gating: items with `featureFlag` prop hidden when flag is false

### Header (`src/components/layout/Header.tsx`)
Auto-generates breadcrumbs from pathname. Right side: HelpButton, FeedbackButton, AlertBadge, WhatsNewButton, QuickAddButton, UserButton.

### Breadcrumbs (`src/components/layout/Breadcrumb.tsx`)
```tsx
<Breadcrumb items={[{ label: "Properties", href: "/properties" }, { label: "Details" }]} />
```

### Feature Flags (`src/config/feature-flags.ts`)
Simple boolean object. Used in:
- Sidebar (hide nav items)
- Middleware (redirect gated routes to `/dashboard`)
- Components (conditional render: `featureFlags.loans && <MenuItem />`)

---

## 13. Utility Functions

### Date Formatting (`src/lib/utils.ts`)
| Function | Output | Example |
|----------|--------|---------|
| `formatDate(date)` | "15 Jan 2024" | Long format |
| `formatDateShort(date)` | "15/01/24" | Short AU format |
| `formatDateISO(date)` | "2024-01-15" | ISO format |
| `formatRelativeDate(date)` | "Today" / "3 days ago" | Relative |

All accept `Date | string`, use Australian locale (`en-AU`).

### Currency (`src/lib/utils.ts`)
```tsx
import { formatCurrency } from "@/lib/utils";
formatCurrency(1234) // "$1,234" (AUD, no decimals)
```

### Class Merging (`src/lib/utils.ts`)
```tsx
import { cn } from "@/lib/utils";
cn("base", isActive && "active", className) // twMerge + clsx
```

### Error Messages (`src/lib/errors.ts`)
```tsx
import { getErrorMessage } from "@/lib/errors";
// Handles TRPCClientError, Error, string, unknown
```

---

## 14. Context Providers

**Provider tree (outermost → innermost):**
1. `ClerkProvider` — auth
2. `TRPCProvider` — tRPC + React Query (staleTime 30s, gcTime 5min)
3. `PostHogProvider` — DISABLED (no-op wrapper)
4. `ChatProvider` — chat panel open/close (`useChatPanel()`)
5. `SidebarProvider` — sidebar collapsed/expanded + Cmd+\ (`useSidebar()`)

### Custom Hooks
| Hook | Import | Purpose |
|------|--------|---------|
| `useSidebar()` | `@/components/layout/SidebarProvider` | Sidebar collapsed state |
| `useChatPanel()` | `@/components/chat/ChatProvider` | Chat panel open/close |
| `useTour({ tourId })` | `@/hooks/useTour` | driver.js guided tours |
| `usePushSubscription()` | `@/hooks/usePushSubscription` | Web Push subscription |
| `useReferralTracking()` | `@/hooks/useReferralTracking` | Referral cookie tracking |
| `useSidebarState()` | `@/lib/hooks/useSidebarState` | localStorage sidebar state |

---

## 15. Plan / Subscription Gating

### Server-side
Use `proProcedure` or `teamProcedure` instead of `protectedProcedure`:
```tsx
export const myRouter = router({
  proFeature: proProcedure.query(async ({ ctx }) => { /* ... */ }),
  teamFeature: teamProcedure.mutation(async ({ ctx, input }) => { /* ... */ }),
});
```
These automatically check subscription status and throw `FORBIDDEN` if insufficient.

### Client-side
```tsx
const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery();
if (trialStatus?.isOnTrial && trialStatus.propertyCount >= 2) {
  // Show upgrade prompt
}
```

### UpgradePrompt Component
```tsx
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
<UpgradePrompt feature="Email Integration" description="Connect Gmail..." plan="pro" />
```

---

## 16. Onboarding Tours

```tsx
import { useTour } from "@/hooks/useTour";

export default function MyPage() {
  useTour({ tourId: "my-feature" });
  // ...
}
```

Target elements with `data-tour` attributes:
```tsx
<div data-tour="my-step">...</div>
```

Tour configs in `src/config/tours/`. Existing tours: dashboard, add-property, banking, transactions, portfolio.

---

## 17. AI Integrations

### Chat (Vercel AI SDK)
- Route: `src/app/api/chat/route.ts`
- Model: `claude-sonnet-4-20250514` via `@ai-sdk/anthropic`
- Uses `streamText` + `createUIMessageStreamResponse`
- Gated behind `featureFlags.aiAssistant` (currently false)

### Categorization (Anthropic SDK)
- Service: `src/server/services/categorization.ts`
- Model: `claude-3-haiku-20240307` for cost
- Two-tier: merchant memory first, Claude API fallback
- Direct `@anthropic-ai/sdk` usage (not Vercel AI SDK)

---

## 18. Export Patterns

### CSV Export
```tsx
// Client-side blob download
const response = await fetch(`/api/export/csv?type=transactions&propertyId=${id}`);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "transactions.csv";
a.click();
URL.revokeObjectURL(url);
```

### PDF/Excel
```tsx
import { generateTaxReportPDF, generateTransactionsExcel } from "@/lib/export-utils";
const blob = await generateTaxReportPDF(data);
```

---

## Anti-Patterns: Do This, Not That

### Next.js 16 / React 19

| DO | DON'T |
|----|-------|
| `React.ComponentProps<"div">` | `React.forwardRef<HTMLDivElement, Props>` |
| `const result = await auth()` | `const { userId } = auth()` (v6 is async) |
| `export const dynamic = "force-dynamic"` on dashboard pages | Use `getServerSideProps` (doesn't exist in App Router) |
| `"use client"` for any page with hooks/interactivity | Assume all components are server components |
| Plain function components | Class components (except ErrorBoundary) |

### tRPC v11 / React Query v5

| DO | DON'T |
|----|-------|
| `trpc.useUtils()` | `trpc.useContext()` (deprecated in v11) |
| `utils.property.list.invalidate()` | `queryClient.invalidateQueries()` directly |
| `utils.property.get.setData({ id }, data)` after create+redirect | Rely on refetch after redirect (race condition) |
| `await utils.transaction.list.cancel()` before optimistic update | Skip cancel (stale queries overwrite optimistic) |
| Import `trpc` from `@/lib/trpc/client` | Create new tRPC client instances |

### Drizzle ORM v0.45

| DO | DON'T |
|----|-------|
| `ctx.db.query.properties.findMany({ where, with })` | Raw SQL for simple queries |
| `.returning()` on insert/update | Separate select after insert |
| `inArray(col, ids)` for bulk operations | Loop with individual queries |
| `Promise.all([query1, query2])` for parallel queries | Sequential await for independent queries |
| `sql<number>\`count(*)::int\`` for aggregations | `sql\`count(*)\`` (returns string without cast) |
| `eq(properties.userId, ctx.portfolio.ownerId)` (always scope by user) | Query without user ID filter |

### Clerk v6

| DO | DON'T |
|----|-------|
| `const { userId } = await auth()` | `const { userId } = auth()` (must await) |
| `createRouteMatcher(["/", "/blog(.*)"])` | Manual pathname checks in middleware |
| `<UserButton afterSignOutUrl="/" />` | Custom sign-out logic |

### Tailwind CSS v4

| DO | DON'T |
|----|-------|
| `@theme inline { }` in CSS for config | `tailwind.config.ts` (doesn't exist, v4 is CSS-first) |
| CSS variables: `var(--color-primary)` | Hardcoded colors in components |
| `cn("base", conditional && "extra", className)` | String concatenation for classes |

### Zod v4

| DO | DON'T |
|----|-------|
| `z.enum([...], { error: "message" })` | `z.enum([...]).describe("message")` |
| `z.string().min(1, "Required")` | `z.string().nonempty()` |
| Define schema next to form component | Separate schema files for forms |
| `z.infer<typeof schema>` for types | Manually duplicate types |

### Sonner v2

| DO | DON'T |
|----|-------|
| `toast.success("Done")` | `toast("Done", { type: "success" })` |
| `toast.error(getErrorMessage(error))` | `toast.error(error.message)` (may throw) |
| Use `action: { label, onClick }` for CTA toasts | Custom toast components |

### Stripe v20

| DO | DON'T |
|----|-------|
| Verify webhooks with `stripe.webhooks.constructEvent()` | Trust webhook payloads without verification |
| Use idempotency keys for mutations | Retry without idempotency |
| Check `event.type` exhaustively | Assume webhook event structure |

### Recharts v3

| DO | DON'T |
|----|-------|
| Always wrap in `<ResponsiveContainer>` | Set fixed width/height on chart |
| Use CSS variable chart colors from globals.css | Hardcode hex colors |

### Playwright

| DO | DON'T |
|----|-------|
| `page.getByRole("button", { name: "Save" })` | `page.locator("#save-btn")` |
| `await expect(page.getByText("Success")).toBeVisible()` | `await page.waitForSelector(".success")` |
| `page.on('pageerror', ...)` to catch uncaught exceptions | Ignore page errors in tests |
| Use `authenticatedPage` fixture from `e2e/fixtures/auth.ts` | Manual Clerk login in each test |

### Lucide Icons

| DO | DON'T |
|----|-------|
| `import { Plus, Building2 } from "lucide-react"` | `import * as Icons from "lucide-react"` (kills tree-shaking) |
| `<Plus className="w-4 h-4" />` | `<Plus size={16} />` (use Tailwind classes) |

### General Conventions

| DO | DON'T |
|----|-------|
| `handleX` for internal handlers, `onX` for callback props | Mix naming conventions |
| `key={item.id}` for dynamic lists | `key={index}` for dynamic data |
| `key={i}` only for static/non-reorderable lists | `key={item.id}` for skeleton placeholders |
| `"use client"` only when component needs hooks/interactivity | `"use client"` on every file |
| Event handler naming: `const handleDelete = () => {}` | `const deleteHandler = () => {}` |

### Import Ordering
```tsx
"use client";                                    // 1. Directive
import { useState } from "react";                // 2. React
import Link from "next/link";                    // 3. Next.js
import { Plus } from "lucide-react";             // 4. Third-party
import { Button } from "@/components/ui/button"; // 5. Internal UI
import { MyCard } from "@/components/my/MyCard";  // 6. Internal app
import { trpc } from "@/lib/trpc/client";        // 7. Internal lib
import { MyHelper } from "./MyHelper";            // 8. Relative
```

Not enforced by lint, but follow this general grouping: directive → framework → libs → internal → relative.
