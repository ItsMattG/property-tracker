# Component Patterns

> Loaded when working in `src/components/`. For UI component API reference see `src/components/ui/CLAUDE.md`. For page-level patterns see `src/app/CLAUDE.md`.

## tRPC Data Fetching (Client-Side)

```tsx
import { trpc } from "@/lib/trpc/client";

// Queries
const { data, isLoading } = trpc.property.list.useQuery();
const { data } = trpc.transaction.list.useQuery({ propertyId, category, limit: PAGE_SIZE, offset });
const { data } = trpc.stats.dashboard.useQuery(undefined, { initialData, staleTime: 60_000 });
```

**Defaults** (Provider.tsx): staleTime 30s, gcTime 5min, refetchOnWindowFocus false, retry 1.

### Mutations

```tsx
const utils = trpc.useUtils();

// Simple: invalidate cache
const deleteMutation = trpc.property.delete.useMutation({
  onSuccess: () => { toast.success("Deleted"); utils.property.list.invalidate(); },
  onError: (error) => toast.error(getErrorMessage(error)),
});

// Create + redirect: pre-populate cache to avoid race condition
const createMutation = trpc.property.create.useMutation({
  onSuccess: (property) => {
    utils.property.get.setData({ id: property.id }, property);
    utils.property.list.invalidate();
    router.push(`/properties/${property.id}/settlement`);
  },
});
```

### Optimistic Updates

Pattern: `onMutate` (cancel → save previous → setData) → `onError` (rollback) → `onSettled` (invalidate).

```tsx
const update = trpc.transaction.updateCategory.useMutation({
  onMutate: async (newData) => {
    await utils.transaction.list.cancel();
    const previous = utils.transaction.list.getData(queryKey);
    utils.transaction.list.setData(queryKey, (old) =>
      old ? { ...old, transactions: old.transactions.map((t) =>
        t.id === newData.id ? { ...t, category: newData.category } : t) } : old
    );
    return { previous, queryKey };
  },
  onError: (err, _, ctx) => {
    if (ctx?.previous) utils.transaction.list.setData(ctx.queryKey, ctx.previous);
    toast.error(getErrorMessage(err));
  },
  onSettled: () => utils.transaction.list.invalidate(),
});
```

### Prefetching & Pagination

```tsx
// Prefetch on sidebar hover
utils.stats.dashboard.prefetch();

// Pagination
const [page, setPage] = useState(1);
const { data } = trpc.transaction.list.useQuery({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
<Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
```

## Form Patterns

**Stack:** react-hook-form v7 + @hookform/resolvers + zod v4 + shadcn Form.

```tsx
const mySchema = z.object({
  name: z.string().min(1, "Required"),
  state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"], { error: "Required" }),
});
type MyFormValues = z.infer<typeof mySchema>;

const form = useForm<MyFormValues>({ resolver: zodResolver(mySchema), defaultValues: { name: "" } });

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <FormField control={form.control} name="name" render={({ field }) => (
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl><Input {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
  </form>
</Form>
```

**Grid layouts in forms:** `<div className="grid grid-cols-2 gap-4">` for side-by-side fields.

## Toast Patterns

Sonner v2. Toaster in root layout with `richColors`. Custom colors in `globals.css`.

```tsx
import { toast } from "sonner";
toast.success("Property created");
toast.error(getErrorMessage(error));                            // Always use getErrorMessage
toast.info("Message", { action: { label: "Upgrade", onClick: () => router.push("/settings/billing") } });
```

## Modal & Dialog Patterns

### Dialog (forms, info)
```tsx
<Dialog open={showModal} onOpenChange={setShowModal}>
  <DialogContent>
    <DialogHeader><DialogTitle>Title</DialogTitle><DialogDescription>Desc</DialogDescription></DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
      <Button onClick={handleSubmit}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### AlertDialog (destructive confirmations)
```tsx
<AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>Cannot undo.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Sheet (slide-over)
```tsx
<Sheet open={open} onOpenChange={onClose}>
  <SheetContent side="right"><SheetHeader><SheetTitle>Title</SheetTitle></SheetHeader></SheetContent>
</Sheet>
```

**State:** `useState<boolean>` or `useState<Item | null>` (non-null = open).

## Loading States

See `src/components/ui/CLAUDE.md` for full skeleton component table. Key pattern:

```tsx
<Button disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
```

## Styling System

- **No `tailwind.config.ts`** — v4 uses CSS-first `@theme inline` in `globals.css`
- Design tokens: CSS variables (`--color-primary`, `--bg-primary`)
- 5 themes in `src/styles/themes.css` (Forest, Clean, Dark, Friendly, Bold)
- **Fonts:** Geist Sans + Geist Mono (`next/font/google`)

```tsx
import { cn } from "@/lib/utils";
<div className={cn("base", isActive && "active", className)} />
```

### Animations
```tsx
// Stagger entrance
<div className="animate-card-entrance" style={{ '--stagger-index': i } as React.CSSProperties} />
// Hover lift
<Card className="interactive-card cursor-pointer" />
```

## Component Composition

### CVA (class-variance-authority)
```tsx
const myVariants = cva("base", {
  variants: { variant: { default: "...", destructive: "..." }, size: { default: "...", sm: "..." } },
  defaultVariants: { variant: "default", size: "default" },
});

function MyComponent({ className, variant, size, ...props }: React.ComponentProps<"div"> & VariantProps<typeof myVariants>) {
  return <div className={cn(myVariants({ variant, size }), className)} {...props} />;
}
export { MyComponent, myVariants }; // Always export variants alongside component
```

### Key Conventions
- **Radix wrapping:** `data-slot="x-name"` on every wrapper, `cn()` for className, spread `{...props}`
- **asChild:** `<Button asChild><Link href="...">...</Link></Button>`
- **Compound components:** Named export block at bottom: `export { Card, CardHeader, ... }`

## Plan Gating (Client-Side)

```tsx
const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery();
// Show UpgradePrompt when limits reached
<UpgradePrompt feature="Email Integration" description="Connect Gmail..." plan="pro" />
```

## Error States (Inline)

```tsx
<ErrorState message="Failed to load" onRetry={() => refetch()} />
toast.error(getErrorMessage(error));
```

## Accessibility

| DO | DON'T |
|----|-------|
| Semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`) | `<div onClick>` for interactive elements |
| `aria-label` on icon-only buttons | Rely on visual-only context |
| `aria-live="polite"` for async status updates | Custom notification without aria-live |
| Keyboard-navigable: all interactive elements focusable | `tabIndex` hacks or skip links without reason |
| `sr-only` class for screen-reader-only text | `display: none` for content that should be announced |
| Test with `npm run test:a11y` before merge | Assume Radix handles everything |
