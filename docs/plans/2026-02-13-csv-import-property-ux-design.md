# CSV Import — Property Assignment UX Design

## Problem

When importing a CSV, users must select a fallback property upfront. If they have no properties or their CSV property values don't match existing ones, rows are marked as errors and can't be imported. This blocks the entire import flow.

## Solution

Make property assignment optional and add inline property creation from the preview step.

## Design

### 1. Unmatched Row Handling

- Rows without `resolvedPropertyId` get **warning** status (not error)
- Issue text: "No property assigned"
- Rows are still importable — transactions created with `propertyId: null`
- Property column cell shows amber highlight for unmatched rows
- Warning banner: "N rows have no property — transactions will be unassigned"

### 2. Quick-Create Property Dialog

**Trigger:** "+ Create property" option at bottom of the property `<Select>` dropdown in each preview row.

**Form fields (all required):**
- Address (text)
- Suburb (text)
- State (select: NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
- Postcode (4-digit)
- Purchase Price (number)
- Contract Date (date picker)

**On submit:**
1. Call `trpc.property.create.mutate()`
2. Add new property to local properties list
3. Re-run `matchProperty()` on all null-property rows — auto-assign matches
4. Force-assign to the triggering row regardless of match
5. Toast: "Property created and assigned to N rows"
6. Plan limit errors (403) shown as inline error in dialog

### 3. Files

| File | Change |
|------|--------|
| `src/components/transactions/import/PreviewStep.tsx` | null property → warning, add "+ Create" to dropdown, auto-assign logic |
| `src/components/transactions/import/QuickCreatePropertyDialog.tsx` | New — compact property creation dialog |
| `src/components/transactions/ImportCSVDialog.tsx` | Already done — property optional on step 1 |
| `src/server/routers/transaction.ts` | Already done — propertyId nullable |

No schema changes. Reuses existing `property.create` mutation.
