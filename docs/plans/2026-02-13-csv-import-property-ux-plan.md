# CSV Import Property Assignment UX — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make property selection optional in CSV import, allow inline property creation from the preview step, and auto-assign newly created properties to matching unmatched rows.

**Architecture:** Modify PreviewStep to treat null propertyId as a warning (not error). Add a QuickCreatePropertyDialog triggered from a "+ Create property" option in the per-row property dropdown. After creation, re-run matchProperty() on all unmatched rows and auto-assign.

**Tech Stack:** React, tRPC, shadcn/ui (Dialog, Select, Input, Button), Zod, sonner (toast)

---

### Task 1: Change null propertyId from error to warning in PreviewStep

**Files:**
- Modify: `src/components/transactions/import/PreviewStep.tsx:154-163` (buildPreviewRow status logic)
- Modify: `src/components/transactions/import/PreviewStep.tsx:177-194` (recalculateStatus)

**Step 1: Update `buildPreviewRow` status logic**

In `src/components/transactions/import/PreviewStep.tsx`, change lines 154-163. The `hasErrors` check currently includes `!resolvedPropertyId`. Remove that condition so missing property is a warning, not an error.

Change:
```typescript
const hasErrors =
  !row.date || !row.description || !row.amount || !resolvedPropertyId;
```

To:
```typescript
const hasErrors = !row.date || !row.description || !row.amount;
```

**Step 2: Update `recalculateStatus` the same way**

In the same file, lines 185-186. Change:
```typescript
const hasErrors =
  !row.date || !row.description || !row.amount || !row.resolvedPropertyId;
```

To:
```typescript
const hasErrors = !row.date || !row.description || !row.amount;
```

**Step 3: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/components/transactions/import/PreviewStep.tsx
git commit -m "fix: treat missing property as warning not error in CSV import preview"
```

---

### Task 2: Add "+ Create property" option to the property dropdown

**Files:**
- Modify: `src/components/transactions/import/PreviewStep.tsx:373-394` (property Select cell)

**Step 1: Add imports**

At the top of PreviewStep.tsx, add `SelectSeparator` to the Select imports (line 23), and add `Plus` to lucide-react imports (line 28):

Change line 19-24:
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

To:
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

Change line 28:
```typescript
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
```

To:
```typescript
import { AlertCircle, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
```

**Step 2: Add state for create dialog**

Inside the `PreviewStep` component, after the existing `useState` calls (around line 231), add:

```typescript
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [createDialogRowIndex, setCreateDialogRowIndex] = useState<number | null>(null);
```

**Step 3: Add the `onPropertyCreated` callback**

After `updateRow` (around line 243), add:

```typescript
const onPropertyCreated = useCallback(
  (newProperty: Property) => {
    // Auto-assign to all unmatched rows whose raw CSV property text matches
    setRows((prev) =>
      prev.map((row, idx) => {
        if (row.resolvedPropertyId) return row; // already assigned

        // Force-assign to the row that triggered the dialog
        if (idx === createDialogRowIndex) {
          return recalculateStatus({ ...row, resolvedPropertyId: newProperty.id });
        }

        // Try matching the new property against the row's raw property text
        const matched = matchProperty(row.property, [newProperty], "");
        if (matched) {
          return recalculateStatus({ ...row, resolvedPropertyId: matched });
        }

        return row;
      })
    );
    setCreateDialogRowIndex(null);
  },
  [createDialogRowIndex]
);
```

**Step 4: Update the property Select to include "+ Create property"**

Replace the property `<Select>` block (lines 375-394) with:

```typescript
<Select
  value={row.resolvedPropertyId ?? "__unassigned__"}
  onValueChange={(val) => {
    if (val === "__create_new__") {
      setCreateDialogRowIndex(idx);
      setCreateDialogOpen(true);
      return;
    }
    if (val === "__unassigned__") {
      updateRow(idx, { resolvedPropertyId: null });
      return;
    }
    updateRow(idx, { resolvedPropertyId: val });
  }}
>
  <SelectTrigger
    size="sm"
    className={cn(
      "h-7 text-xs w-[140px]",
      !row.resolvedPropertyId && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
    )}
  >
    <SelectValue placeholder="Unassigned" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="__unassigned__" className="text-xs text-muted-foreground italic">
      Unassigned
    </SelectItem>
    {properties.map((p) => (
      <SelectItem key={p.id} value={p.id} className="text-xs">
        {p.address}
      </SelectItem>
    ))}
    <SelectSeparator />
    <SelectItem value="__create_new__" className="text-xs text-primary">
      <Plus className="size-3 mr-1 inline" />
      Create property
    </SelectItem>
  </SelectContent>
</Select>
```

**Step 5: Add `cn` import if not already present**

Check if `cn` is imported. If not, add:
```typescript
import { cn } from "@/lib/utils";
```

**Step 6: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors (the dialog component doesn't exist yet, so don't render it yet)

**Step 7: Commit**

```
git add src/components/transactions/import/PreviewStep.tsx
git commit -m "feat: add create property option to CSV import property dropdown"
```

---

### Task 3: Create QuickCreatePropertyDialog component

**Files:**
- Create: `src/components/transactions/import/QuickCreatePropertyDialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/transactions/import/QuickCreatePropertyDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

interface QuickCreatePropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (property: { id: string; address: string; suburb: string }) => void;
  /** Pre-fill address from CSV property text */
  prefillAddress?: string;
}

export function QuickCreatePropertyDialog({
  open,
  onOpenChange,
  onCreated,
  prefillAddress,
}: QuickCreatePropertyDialogProps) {
  const [address, setAddress] = useState(prefillAddress ?? "");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [error, setError] = useState("");

  const createProperty = trpc.property.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Property "${data.address}" created`);
      onCreated({ id: data.id, address: data.address, suburb: data.suburb });
      onOpenChange(false);
      // Reset form
      setAddress("");
      setSuburb("");
      setState("");
      setPostcode("");
      setPurchasePrice("");
      setContractDate("");
      setError("");
    },
    onError: (err) => {
      setError(err.message || "Failed to create property");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    createProperty.mutate({
      address,
      suburb,
      state: state as (typeof STATES)[number],
      postcode,
      purchasePrice,
      contractDate,
    });
  };

  const isValid =
    address.length > 0 &&
    suburb.length > 0 &&
    state.length > 0 &&
    /^\d{4}$/.test(postcode) &&
    /^\d+\.?\d*$/.test(purchasePrice) &&
    contractDate.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Add Property</DialogTitle>
          <DialogDescription>
            Create a property to assign imported transactions to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qcp-address" className="text-xs">Address</Label>
            <Input
              id="qcp-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="qcp-suburb" className="text-xs">Suburb</Label>
              <Input
                id="qcp-suburb"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder="Richmond"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcp-state" className="text-xs">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="qcp-state" className="h-8 text-sm">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="qcp-postcode" className="text-xs">Postcode</Label>
              <Input
                id="qcp-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="3121"
                maxLength={4}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qcp-price" className="text-xs">Purchase Price</Label>
              <Input
                id="qcp-price"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="750000"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qcp-date" className="text-xs">Contract Date</Label>
            <Input
              id="qcp-date"
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="sm"
            disabled={!isValid || createProperty.isPending}
          >
            {createProperty.isPending ? "Creating..." : "Create Property"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```
git add src/components/transactions/import/QuickCreatePropertyDialog.tsx
git commit -m "feat: add QuickCreatePropertyDialog for inline property creation"
```

---

### Task 4: Wire QuickCreatePropertyDialog into PreviewStep

**Files:**
- Modify: `src/components/transactions/import/PreviewStep.tsx`

**Step 1: Import the dialog and add local properties state**

Add import at the top of PreviewStep.tsx:
```typescript
import { QuickCreatePropertyDialog } from "./QuickCreatePropertyDialog";
```

**Step 2: Add local properties state**

The component currently receives `properties` as a prop but never updates it locally. We need a local copy that grows when new properties are created.

Inside the `PreviewStep` component, after the existing `useState` for `rows` (line 229), add:

```typescript
const [localProperties, setLocalProperties] = useState<Property[]>(properties);
```

Then update the `onPropertyCreated` callback to also add to local properties:

```typescript
const onPropertyCreated = useCallback(
  (newProperty: Property) => {
    setLocalProperties((prev) => [...prev, newProperty]);

    setRows((prev) =>
      prev.map((row, idx) => {
        if (row.resolvedPropertyId) return row;

        if (idx === createDialogRowIndex) {
          return recalculateStatus({ ...row, resolvedPropertyId: newProperty.id });
        }

        const matched = matchProperty(row.property, [newProperty], "");
        if (matched) {
          return recalculateStatus({ ...row, resolvedPropertyId: matched });
        }

        return row;
      })
    );

    setCreateDialogRowIndex(null);
  },
  [createDialogRowIndex]
);
```

**Step 3: Replace `properties` with `localProperties` in the dropdown**

In the property Select `<SelectContent>`, change:
```typescript
{properties.map((p) => (
```
To:
```typescript
{localProperties.map((p) => (
```

**Step 4: Add the dialog render**

Right before the closing `</div>` of the component's return (before line 504), add:

```typescript
{/* Quick create property dialog */}
<QuickCreatePropertyDialog
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
  onCreated={onPropertyCreated}
  prefillAddress={
    createDialogRowIndex !== null
      ? rows[createDialogRowIndex]?.property ?? undefined
      : undefined
  }
/>
```

**Step 5: Count unassigned rows for a warning banner**

After `stats` useMemo (around line 255), add:

```typescript
const unassignedCount = useMemo(
  () => rows.filter((r) => !r.resolvedPropertyId && r.status !== "error").length,
  [rows]
);
```

Then in the JSX, after the stats badges div and before the preview table div, add:

```typescript
{unassignedCount > 0 && (
  <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
    <p className="text-xs text-yellow-700 dark:text-yellow-400">
      {unassignedCount} row{unassignedCount !== 1 ? "s" : ""} {unassignedCount !== 1 ? "have" : "has"} no property assigned — {unassignedCount !== 1 ? "these" : "this"} transaction{unassignedCount !== 1 ? "s" : ""} will be unassigned.
    </p>
  </div>
)}
```

**Step 6: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```
git add src/components/transactions/import/PreviewStep.tsx
git commit -m "feat: wire up QuickCreatePropertyDialog in CSV import preview"
```

---

### Task 5: Manual verification with Playwright

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Use Playwright MCP to verify**

1. Navigate to the app and log in
2. Go to `/transactions`
3. Click "Import CSV"
4. Upload a CSV file without selecting a fallback property
5. Click "Continue to Column Mapping"
6. Map columns and proceed to preview
7. Verify: rows without matched properties show yellow warning (not red error)
8. Verify: the property dropdown shows "Unassigned" with amber border
9. Verify: the dropdown includes "+ Create property" at the bottom
10. Click "+ Create property" — the quick-create dialog should open
11. Fill in property details and submit
12. Verify: the new property appears in all property dropdowns
13. Verify: matching rows are auto-assigned to the new property
14. Verify: the import button is enabled and counts include previously-unassigned rows

**Step 3: Take screenshots for verification**

**Step 4: Commit any final fixes if needed**

---

### Task 6: Final verification and push

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

**Step 2: Run lint**

```bash
npm run lint
```

**Step 3: Push to develop**

```bash
git push origin develop
```
