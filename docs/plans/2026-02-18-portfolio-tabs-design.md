# Portfolio Tabs — Design

> **Beads task:** property-tracker-u9e

**Goal:** Add tab pills to filter properties by purpose type (Investment, Owner-Occupied, Commercial, Short-Term Rental) with property counts in each tab. Include a "show sold" toggle for status filtering.

**Architecture:** New `propertyPurposeEnum` added to schema with a `purpose` column on properties (default `investment`). Client-side filtering via `useMemo` on the existing `property.list` query — no new API endpoints. Tab pills render at the top of the properties page with counts derived from the unfiltered list.

## Schema Changes

### New Enum

```sql
CREATE TYPE property_purpose AS ENUM ('investment', 'owner_occupied', 'commercial', 'short_term_rental');
```

Added to `src/server/db/schema/enums.ts` as `propertyPurposeEnum`.

### Properties Table

New column on `properties`:

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `purpose` | `propertyPurposeEnum` | `'investment'` | No |

Applied via `drizzle-kit push` — existing rows backfilled with `investment`.

## UI Design

### Tab Pills

Horizontal row of pills at the top of the properties page:

```
[All (12)] [Investment (8)] [Owner-Occupied (2)] [Commercial (1)] [Short-Term Rental (1)]
```

- Active tab: filled background (primary color)
- Inactive tabs: outline/ghost style
- Counts always reflect total per purpose (not affected by other filters)
- Tabs with zero count still shown but visually muted

### Status Toggle

Below the tab row:

```
☐ Show sold properties
```

- Unchecked by default — sold properties hidden
- When checked, sold properties appear with a visual indicator (opacity, badge)

### Entity Filter

Existing entity filter chips preserved as a separate filter mechanism. Entity filtering is orthogonal to purpose filtering — both can be active simultaneously.

### PropertyCard Badge

Each property card shows a small purpose badge (e.g., "Investment", "Commercial") to distinguish purpose at a glance.

### Filter Chain

Client-side filtering applied in order:
1. Purpose tab (All shows everything)
2. Sold toggle (hide/show sold)
3. Entity filter (if active)

## Form Integration

### Property Create Form

- Add `purpose` select dropdown after address fields, before entity/ownership section
- Default: `investment`
- Options: Investment, Owner-Occupied, Commercial, Short-Term Rental (Airbnb)
- Uses existing `Select` UI component

### Property Edit Form

- Same dropdown, pre-populated with current value
- Changing purpose takes effect immediately on save

### tRPC Changes

- `property.create` — accept optional `purpose` field (schema default handles omission)
- `property.update` — accept optional `purpose` in update payload
- `property.list` — no changes (filtering is client-side)
- Repository: no new methods needed (Drizzle auto-includes new column)

## Testing Strategy

### Unit Tests

- Schema validation: `propertyPurposeEnum` values match expected set
- `property.create`: verify `purpose` persisted and returned
- `property.update`: verify `purpose` can be changed

### Component Testing

- Tab filtering logic (can be tested as pure function if extracted)
- Count derivation from property list

## Files Touched

| Action | File |
|--------|------|
| Modify | `src/server/db/schema/enums.ts` — add `propertyPurposeEnum` |
| Modify | `src/server/db/schema/properties.ts` — add `purpose` column |
| Modify | `src/server/routers/property/property.ts` — accept `purpose` in create/update |
| Modify | `src/app/(dashboard)/properties/page.tsx` — tab pills, sold toggle, filtering |
| Modify | Property create/edit form — add purpose dropdown |
| Modify | `PropertyCard` component — show purpose badge |
| Create | Tests for purpose CRUD and filtering logic |
