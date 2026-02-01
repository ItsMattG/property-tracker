# UI/UX Comprehensive Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 15 identified UI/UX inconsistencies to create a polished, accessible, and consistent user experience.

**Architecture:** Standardize patterns across the codebase: replace browser `confirm()` with AlertDialog, add ARIA labels to interactive elements, ensure consistent loading/error feedback on all mutations, and add missing form field descriptions.

**Tech Stack:** React, TypeScript, Radix UI (AlertDialog), Sonner (toasts), Lucide icons, tRPC mutations

---

## Summary of Issues to Fix

| Priority | Issue | Files Affected |
|----------|-------|----------------|
| Critical | Browser `confirm()` dialogs | properties/page.tsx, loans/page.tsx |
| High | Missing ARIA labels | PortfolioSwitcher, PortfolioToolbar, buttons |
| High | Inconsistent error handling | AddTransactionDialog, loans/page.tsx |
| Medium | Missing loading spinners | LoanForm, alerts dismiss |
| Medium | Missing form descriptions | LoanForm, AddPropertyValueDialog |
| Low | Inconsistent skeleton loading | Various pages |

---

### Task 1: Replace browser confirm() with AlertDialog on Properties page

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx:25-45`

**Step 1: Read the current implementation**

Review the properties page to understand the current delete flow.

**Step 2: Add AlertDialog imports**

Add to imports section:
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
```

**Step 3: Add state for delete confirmation**

Add state to track which property is being deleted:
```typescript
const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
const propertyToDelete = properties?.find(p => p.id === deletePropertyId);
```

**Step 4: Replace confirm() with AlertDialog**

Replace the browser confirm with AlertDialog in the PropertyCard delete action. Wrap the delete button:
```typescript
<AlertDialog open={deletePropertyId === property.id} onOpenChange={(open) => !open && setDeletePropertyId(null)}>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" onClick={() => setDeletePropertyId(property.id)}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete property?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete "{property.address}" and all associated transactions. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => {
          deleteProperty.mutate({ id: property.id });
          setDeletePropertyId(null);
        }}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 5: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/properties/page.tsx
git commit -m "fix(ui): replace browser confirm with AlertDialog on properties page"
```

---

### Task 2: Replace browser confirm() with AlertDialog on Loans page

**Files:**
- Modify: `src/app/(dashboard)/loans/page.tsx:20-35`

**Step 1: Read the current implementation**

Review the loans page delete handler.

**Step 2: Add AlertDialog imports and state**

Add imports:
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
```

Add state:
```typescript
const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
```

**Step 3: Replace confirm() with AlertDialog**

Replace the handleDelete function and wrap the delete button with AlertDialog similar to Task 1.

**Step 4: Update error handling to use getErrorMessage**

Replace `error.message || "Failed to delete"` with:
```typescript
import { getErrorMessage } from "@/lib/errors";

onError: (error) => {
  toast.error(getErrorMessage(error));
}
```

**Step 5: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/loans/page.tsx
git commit -m "fix(ui): replace browser confirm with AlertDialog on loans page"
```

---

### Task 3: Add ARIA labels to PortfolioSwitcher dropdown

**Files:**
- Modify: `src/components/layout/PortfolioSwitcher.tsx`

**Step 1: Read the current implementation**

Review the PortfolioSwitcher component.

**Step 2: Add aria-label to the dropdown trigger**

```typescript
<DropdownMenuTrigger asChild>
  <Button
    variant="outline"
    className="w-full justify-between"
    aria-label={`Switch portfolio. Current: ${activePortfolio?.name || 'Select portfolio'}`}
  >
    ...
  </Button>
</DropdownMenuTrigger>
```

**Step 3: Add aria-label to dropdown menu**

```typescript
<DropdownMenuContent className="w-56" aria-label="Portfolio options">
```

**Step 4: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/layout/PortfolioSwitcher.tsx
git commit -m "fix(a11y): add ARIA labels to PortfolioSwitcher dropdown"
```

---

### Task 4: Add ARIA labels to PortfolioToolbar view toggle buttons

**Files:**
- Modify: `src/components/portfolio/PortfolioToolbar.tsx:48-68`

**Step 1: Read the current implementation**

Review the view toggle buttons in PortfolioToolbar.

**Step 2: Add aria-label to each toggle button**

For the grid/list view toggle buttons:
```typescript
<Button
  variant={viewMode === "grid" ? "default" : "outline"}
  size="icon"
  onClick={() => onViewModeChange("grid")}
  aria-label="Grid view"
  aria-pressed={viewMode === "grid"}
>
  <LayoutGrid className="h-4 w-4" />
</Button>
<Button
  variant={viewMode === "list" ? "default" : "outline"}
  size="icon"
  onClick={() => onViewModeChange("list")}
  aria-label="List view"
  aria-pressed={viewMode === "list"}
>
  <List className="h-4 w-4" />
</Button>
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/portfolio/PortfolioToolbar.tsx
git commit -m "fix(a11y): add ARIA labels to portfolio view toggle buttons"
```

---

### Task 5: Fix error handling in AddTransactionDialog

**Files:**
- Modify: `src/components/transactions/AddTransactionDialog.tsx:87`

**Step 1: Read the current implementation**

Review the error handling in AddTransactionDialog.

**Step 2: Update error handler to use getErrorMessage**

Replace:
```typescript
onError: (error) => {
  toast.error(error.message || "Failed to add transaction");
}
```

With:
```typescript
import { getErrorMessage } from "@/lib/errors";

onError: (error) => {
  toast.error(getErrorMessage(error));
}
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/transactions/AddTransactionDialog.tsx
git commit -m "fix(ui): use centralized error handling in AddTransactionDialog"
```

---

### Task 6: Add loading spinner to LoanForm submit button

**Files:**
- Modify: `src/components/loans/LoanForm.tsx:275-280`

**Step 1: Read the current implementation**

Review the LoanForm submit button.

**Step 2: Add Loader2 import**

```typescript
import { Loader2 } from "lucide-react";
```

**Step 3: Update submit button with spinner**

Replace the submit button:
```typescript
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    "Save Loan"
  )}
</Button>
```

**Step 4: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/loans/LoanForm.tsx
git commit -m "fix(ui): add loading spinner to LoanForm submit button"
```

---

### Task 7: Add form field descriptions to LoanForm

**Files:**
- Modify: `src/components/loans/LoanForm.tsx`

**Step 1: Read the current implementation**

Review the LoanForm fields that lack descriptions.

**Step 2: Add FormDescription to complex fields**

Add descriptions to help users understand financial terms:

For LVR field:
```typescript
<FormDescription>
  Loan-to-Value Ratio: the loan amount as a percentage of the property value
</FormDescription>
```

For loan type field:
```typescript
<FormDescription>
  Interest-only: pay only interest (lower payments, no equity built). Principal & Interest: pay both (higher payments, builds equity).
</FormDescription>
```

For interest rate field:
```typescript
<FormDescription>
  Enter the annual interest rate (e.g., 6.5 for 6.5% p.a.)
</FormDescription>
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/loans/LoanForm.tsx
git commit -m "fix(ui): add helpful descriptions to LoanForm fields"
```

---

### Task 8: Add loading state to alerts dismiss button

**Files:**
- Modify: `src/app/(dashboard)/alerts/page.tsx:25-35`

**Step 1: Read the current implementation**

Review the alerts page dismiss functionality.

**Step 2: Track dismiss loading state**

The mutation already has `isPending`. Use it in the button:
```typescript
<Button
  variant="ghost"
  size="sm"
  onClick={() => dismissAlert.mutate({ alertId: alert.id })}
  disabled={dismissAlert.isPending}
>
  {dismissAlert.isPending ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <X className="h-4 w-4" />
  )}
</Button>
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/alerts/page.tsx
git commit -m "fix(ui): add loading state to alerts dismiss button"
```

---

### Task 9: Add ARIA labels to EntitySwitcher

**Files:**
- Modify: `src/components/entities/EntitySwitcher.tsx`

**Step 1: Read the current implementation**

Review the EntitySwitcher component.

**Step 2: Add aria-label to the switcher button**

```typescript
<Button
  variant="outline"
  role="combobox"
  aria-expanded={open}
  aria-label={`Switch entity. Current: ${activeEntity?.name || 'Personal'}`}
  className="w-full justify-between"
>
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/entities/EntitySwitcher.tsx
git commit -m "fix(a11y): add ARIA labels to EntitySwitcher"
```

---

### Task 10: Add form description to AddPropertyValueDialog

**Files:**
- Modify: `src/components/portfolio/AddPropertyValueDialog.tsx`

**Step 1: Read the current implementation**

Review the AddPropertyValueDialog.

**Step 2: Add FormDescription to value field**

```typescript
<FormDescription>
  Enter your property's current estimated market value. This is used to track equity and portfolio performance.
</FormDescription>
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/portfolio/AddPropertyValueDialog.tsx
git commit -m "fix(ui): add description to property value field"
```

---

### Task 11: Add sr-only text to icon-only menu buttons

**Files:**
- Modify: `src/components/team/MemberList.tsx:179-182`

**Step 1: Read the current implementation**

Review the icon-only dropdown trigger buttons.

**Step 2: Add sr-only text**

```typescript
<Button variant="ghost" size="icon" aria-label="Member options">
  <MoreHorizontal className="h-4 w-4" />
  <span className="sr-only">Open member options</span>
</Button>
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/team/MemberList.tsx
git commit -m "fix(a11y): add screen reader text to icon-only buttons"
```

---

### Task 12: Improve validation error message in LoanForm

**Files:**
- Modify: `src/components/loans/LoanForm.tsx:31-36`

**Step 1: Read the current validation**

Review the loan amount validation.

**Step 2: Improve error message**

Replace:
```typescript
amount: z.number().positive("Invalid amount"),
```

With:
```typescript
amount: z.number().positive("Enter a valid loan amount (must be greater than 0)"),
```

**Step 3: Verify the build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/loans/LoanForm.tsx
git commit -m "fix(ui): improve loan amount validation error message"
```

---

### Task 13: Clean up unused test file

**Files:**
- Delete: `e2e/ui-ux-audit.spec.ts`

**Step 1: Remove the test file**

The UI/UX audit test was created for exploration but has auth issues. Remove it.

```bash
rm e2e/ui-ux-audit.spec.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove temporary UI/UX audit test file"
```

---

### Task 14: Final verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run ESLint**

Run: `npm run lint`
Expected: No errors or warnings

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

---

## Verification Checklist

After all tasks are complete:

- [ ] Properties page uses AlertDialog for delete confirmation
- [ ] Loans page uses AlertDialog for delete confirmation
- [ ] PortfolioSwitcher has ARIA labels
- [ ] PortfolioToolbar view toggles have ARIA labels
- [ ] AddTransactionDialog uses getErrorMessage
- [ ] LoanForm has loading spinner on submit
- [ ] LoanForm has field descriptions
- [ ] Alerts dismiss button shows loading state
- [ ] EntitySwitcher has ARIA labels
- [ ] AddPropertyValueDialog has field description
- [ ] MemberList icon buttons have sr-only text
- [ ] LoanForm validation messages are helpful
- [ ] All TypeScript/ESLint checks pass
- [ ] Build succeeds
