# Portfolio Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add purpose-based tab filtering to the properties page with a new `purpose` enum on properties, tab pills with counts, a "show sold" toggle, purpose badge on property cards, and form integration.

**Architecture:** New `propertyPurposeEnum` and `purpose` column on properties table (default `investment`). Client-side filtering via `useMemo` on existing `property.list` query. PropertyForm gets a purpose dropdown. PropertyCard shows a purpose badge.

**Tech Stack:** Drizzle ORM (schema), tRPC v11 (router inputs), React 19 + Tailwind v4 (UI), Zod v4 (validation), Vitest (tests)

**Beads task:** property-tracker-u9e

---

### Task 1: Schema — Add propertyPurposeEnum and purpose column

**Files:**
- Modify: `src/server/db/schema/enums.ts` (add enum after `propertyStatusEnum` ~line 77)
- Modify: `src/server/db/schema/properties.ts` (add column after `status` ~line 34)

**Step 1: Add the enum to enums.ts**

In `src/server/db/schema/enums.ts`, add the new enum after `propertyStatusEnum` (line 77):

```typescript
export const propertyPurposeEnum = pgEnum("property_purpose", [
  "investment",
  "owner_occupied",
  "commercial",
  "short_term_rental",
]);
```

**Step 2: Add the column to properties.ts**

In `src/server/db/schema/properties.ts`:

1. Add `propertyPurposeEnum` to the import from `"./enums"` (line 8):
```typescript
import {
  stateEnum, propertyStatusEnum, propertyPurposeEnum, listingSourceTypeEnum, propertyTypeEnum,
  shareLevelEnum, valuationSourceEnum,
} from "./enums";
```

2. Add the `purpose` column to the `properties` table definition, after the `status` field (after line 34):
```typescript
  purpose: propertyPurposeEnum("purpose").default("investment").notNull(),
```

**Step 3: Push schema to database**

Run: `npx drizzle-kit push`

This creates the enum and adds the column with default `investment` (existing rows auto-backfilled).

**Step 4: Verify types are correct**

Run: `npx tsc --noEmit 2>&1 | head -20`

The `Property` type (exported via `$inferSelect`) will automatically include `purpose: "investment" | "owner_occupied" | "commercial" | "short_term_rental"`. No manual type changes needed.

**Step 5: Commit**

```bash
git add src/server/db/schema/enums.ts src/server/db/schema/properties.ts
git commit -m "feat: add propertyPurposeEnum and purpose column to properties"
```

---

### Task 2: Router — Accept purpose in create/update inputs

**Files:**
- Modify: `src/server/routers/property/property.ts` (lines 9-20 schema, lines 74-119 create, lines 158-186 update)
- Test: `src/server/routers/property/__tests__/purpose.test.ts`

**Step 1: Write the failing tests**

Create `src/server/routers/property/__tests__/purpose.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../../__tests__/test-utils";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validPropertyInput = {
  address: "123 Test St",
  suburb: "Sydney",
  state: "NSW" as const,
  postcode: "2000",
  purchasePrice: "500000",
  contractDate: "2024-01-15",
};

describe("property purpose", () => {
  let ctx: ReturnType<typeof createMockContext>;
  let caller: ReturnType<typeof createTestCaller>;

  beforeEach(() => {
    ctx = createMockContext({ userId: "user-1", user: mockUser });
    caller = createTestCaller(ctx);
  });

  describe("create", () => {
    it("defaults purpose to investment when not provided", async () => {
      const mockProperty = { id: "prop-1", ...validPropertyInput, purpose: "investment" };
      vi.mocked(ctx.uow.property.create).mockResolvedValue(mockProperty as never);
      vi.mocked(ctx.uow.property.countByOwner).mockResolvedValue(0);
      vi.mocked(ctx.uow.user.findById).mockResolvedValue({ ...mockUser, trialEndsAt: null, trialPlan: null } as never);
      vi.mocked(ctx.uow.user.findSubscriptionFull).mockResolvedValue(null);

      await caller.property.create(validPropertyInput);

      expect(vi.mocked(ctx.uow.property.create)).toHaveBeenCalledWith(
        expect.not.objectContaining({ purpose: expect.anything() })
      );
    });

    it("accepts a purpose value when provided", async () => {
      const mockProperty = { id: "prop-1", ...validPropertyInput, purpose: "commercial" };
      vi.mocked(ctx.uow.property.create).mockResolvedValue(mockProperty as never);
      vi.mocked(ctx.uow.property.countByOwner).mockResolvedValue(0);
      vi.mocked(ctx.uow.user.findById).mockResolvedValue({ ...mockUser, trialEndsAt: null, trialPlan: null } as never);
      vi.mocked(ctx.uow.user.findSubscriptionFull).mockResolvedValue(null);

      await caller.property.create({ ...validPropertyInput, purpose: "commercial" });

      expect(vi.mocked(ctx.uow.property.create)).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "commercial" })
      );
    });
  });

  describe("update", () => {
    it("passes purpose through when updating", async () => {
      const mockProperty = { id: "prop-1", ...validPropertyInput, purpose: "short_term_rental", updatedAt: new Date() };
      vi.mocked(ctx.uow.property.update).mockResolvedValue(mockProperty as never);

      await caller.property.update({ id: "550e8400-e29b-41d4-a716-446655440000", purpose: "short_term_rental" });

      expect(vi.mocked(ctx.uow.property.update)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        expect.objectContaining({ purpose: "short_term_rental" })
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/property/__tests__/purpose.test.ts`

Expected: FAIL — `purpose` not in input schema.

**Step 3: Add purpose to the property input schema**

In `src/server/routers/property/property.ts`:

1. Add `purpose` to `propertySchema` (around line 9-20):
```typescript
const purposes = ["investment", "owner_occupied", "commercial", "short_term_rental"] as const;

const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().min(1, "Suburb is required"),
  state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]),
  postcode: australianPostcodeSchema,
  purchasePrice: positiveAmountSchema,
  contractDate: z.string().min(1, "Contract date is required"),
  settlementDate: z.string().optional(),
  entityName: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  purpose: z.enum(purposes).optional(),
});
```

2. In the `create` mutation body (~line 105), pass purpose through if provided:
```typescript
      const property = await ctx.uow.property.create({
        userId: ctx.portfolio.ownerId,
        address: input.address,
        suburb: input.suburb,
        state: input.state,
        postcode: input.postcode,
        purchasePrice: input.purchasePrice,
        purchaseDate: input.contractDate,
        contractDate: input.contractDate,
        settlementDate: input.settlementDate || null,
        entityName: input.entityName || "Personal",
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        climateRisk,
        ...(input.purpose && { purpose: input.purpose }),
      });
```

3. In the `update` mutation body (~line 164), `purpose` is already included via the spread of `data` from `input` (since `propertySchema.partial()` is used). The `Partial<Property>` type on `updateData` accepts it. No code change needed here beyond the schema addition.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/property/__tests__/purpose.test.ts`

Expected: All 3 tests PASS.

**Step 5: Run full property test suite**

Run: `npx vitest run src/server/routers/property/`

Expected: All existing tests still pass (purpose is optional, so no breaking changes).

**Step 6: Commit**

```bash
git add src/server/routers/property/property.ts src/server/routers/property/__tests__/purpose.test.ts
git commit -m "feat: accept purpose field in property create/update"
```

---

### Task 3: PropertyForm — Add purpose dropdown

**Files:**
- Modify: `src/components/properties/PropertyForm.tsx` (schema, form defaults, render)
- Modify: `src/app/(dashboard)/properties/[id]/edit/page.tsx` (pass purpose to defaultValues)

**Step 1: Add purpose to the form schema and render a Select**

In `src/components/properties/PropertyForm.tsx`:

1. Add `purpose` to the Zod schema (after `longitude`, ~line 42):
```typescript
  purpose: z.enum(["investment", "owner_occupied", "commercial", "short_term_rental"]).optional(),
```

2. Add a display label map outside the component:
```typescript
const purposeLabels: Record<string, string> = {
  investment: "Investment",
  owner_occupied: "Owner-Occupied",
  commercial: "Commercial",
  short_term_rental: "Short-Term Rental (Airbnb)",
};
```

3. Add `purpose` to form default values (~line 82, inside the `defaultValues` object):
```typescript
      purpose: "investment",
```

4. Add a new row between "Purchase details" and "Dates" rows. Insert a full-width purpose dropdown (before the dates `<div className="grid grid-cols-2 gap-4">` at ~line 227):

```tsx
        {/* Purpose */}
        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purpose</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "investment"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(purposeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
```

**Step 2: Update edit page to pass purpose in defaultValues**

In `src/app/(dashboard)/properties/[id]/edit/page.tsx`, add `purpose` to the `defaultValues` prop (~line 82):

```typescript
            defaultValues={{
              address: property.address,
              suburb: property.suburb,
              state: property.state,
              postcode: property.postcode,
              purchasePrice: property.purchasePrice,
              contractDate: property.contractDate ?? property.purchaseDate,
              settlementDate: property.settlementDate ?? "",
              entityName: property.entityName,
              latitude: property.latitude ?? "",
              longitude: property.longitude ?? "",
              purpose: property.purpose ?? "investment",
            }}
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No new type errors (existing pre-existing ones may show).

**Step 4: Commit**

```bash
git add src/components/properties/PropertyForm.tsx src/app/(dashboard)/properties/\\[id\\]/edit/page.tsx
git commit -m "feat: add purpose dropdown to property create/edit form"
```

---

### Task 4: PropertyCard — Add purpose badge

**Files:**
- Modify: `src/components/properties/PropertyCard.tsx` (~line 181-196, badge section)

**Step 1: Add purpose badge to PropertyCard**

In `src/components/properties/PropertyCard.tsx`:

1. Add a purpose label map at the top of the file (after the interfaces, ~line 43):
```typescript
const purposeLabels: Record<string, string> = {
  investment: "Investment",
  owner_occupied: "Owner-Occupied",
  commercial: "Commercial",
  short_term_rental: "Short-Term Rental",
};
```

2. In the badge row at the bottom of the card (~line 181-196), add a purpose badge before the entity badge. Replace the existing badge section:

```tsx
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {property.purpose && property.purpose !== "investment" && (
              <Badge variant="outline">{purposeLabels[property.purpose] ?? property.purpose}</Badge>
            )}
            <Badge variant="secondary">{property.entityName}</Badge>
            {metrics && (
              <PerformanceBadge
                metrics={{
                  grossYield: metrics.grossYield,
                  cashFlow: metrics.cashFlow,
                  capitalGrowthPercent: metrics.capitalGrowthPercent,
                  lvr: metrics.lvr,
                  hasValue: metrics.hasValue,
                  annualIncome: metrics.annualIncome,
                }}
              />
            )}
          </div>
          {metrics?.grossYield !== null && metrics?.grossYield !== undefined && (
            <span className="text-xs text-muted-foreground">
              {formatPercent(metrics.grossYield)} yield
            </span>
          )}
        </div>
```

Note: Only show the purpose badge when purpose is NOT `investment` (since most properties will be investment, showing it for every card would be noise). Investment is the default/assumed purpose.

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors. The `property.purpose` field is available because `Property` type now includes it from the schema change in Task 1.

**Step 3: Commit**

```bash
git add src/components/properties/PropertyCard.tsx
git commit -m "feat: show purpose badge on property cards for non-investment types"
```

---

### Task 5: Properties Page — Tab pills + sold toggle + filtering

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx` (main properties page)

**Step 1: Add state and filtering logic**

In `src/app/(dashboard)/properties/page.tsx`:

1. Add new state variables after the existing `excludedEntities` state (~line 27):
```typescript
  const [activePurpose, setActivePurpose] = useState<string>("all");
  const [showSold, setShowSold] = useState(false);
```

2. Add the imports for `Checkbox` and `Label` at the top:
```typescript
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
```

3. Add a purpose label map and purposes array outside the component:
```typescript
const purposes = ["investment", "owner_occupied", "commercial", "short_term_rental"] as const;
const purposeLabels: Record<string, string> = {
  investment: "Investment",
  owner_occupied: "Owner-Occupied",
  commercial: "Commercial",
  short_term_rental: "Short-Term Rental",
};
```

4. Add a `useMemo` for purpose counts (after the existing `metricsMap` memo, ~line 86):
```typescript
  const purposeCounts = useMemo(() => {
    if (!properties) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const p of properties) {
      const purpose = p.purpose ?? "investment";
      counts.set(purpose, (counts.get(purpose) ?? 0) + 1);
    }
    return counts;
  }, [properties]);
```

5. Replace the existing `filteredProperties` (~line 88) with a multi-stage filter:
```typescript
  const filteredProperties = useMemo(() => {
    if (!properties) return undefined;
    return properties.filter((p) => {
      // Purpose filter
      if (activePurpose !== "all" && (p.purpose ?? "investment") !== activePurpose) return false;
      // Sold toggle
      if (!showSold && p.status === "sold") return false;
      // Entity filter
      if (excludedEntities.has(p.entityName)) return false;
      return true;
    });
  }, [properties, activePurpose, showSold, excludedEntities]);
```

**Step 2: Add tab pills and sold toggle to the UI**

Insert the following between the header section and the entity filter chips section (after the closing `</div>` of the header at ~line 107, before the entity filter `{entityNames.length > 1 && (` block):

```tsx
      {/* Purpose tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActivePurpose("all")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border",
              activePurpose === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            All
            <span className={cn(
              "text-xs",
              activePurpose === "all" ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {properties?.length ?? 0}
            </span>
          </button>
          {purposes.map((purpose) => {
            const count = purposeCounts.get(purpose) ?? 0;
            const isActive = activePurpose === purpose;
            return (
              <button
                key={purpose}
                onClick={() => setActivePurpose(purpose)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : count === 0
                      ? "bg-background text-muted-foreground/50 border-border/50 cursor-default"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
                disabled={count === 0}
              >
                {purposeLabels[purpose]}
                <span className={cn(
                  "text-xs",
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Show sold toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-sold"
            checked={showSold}
            onCheckedChange={(checked) => setShowSold(checked === true)}
          />
          <Label htmlFor="show-sold" className="text-sm text-muted-foreground cursor-pointer">
            Show sold properties
          </Label>
        </div>
      </div>
```

**Step 3: Update the "all filtered out" empty state**

Replace the existing "No properties match your current filters" block (~line 162-170) to also handle the new filters:

```tsx
      ) : properties && properties.length > 0 ? (
        // All properties filtered out
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No properties match your current filters.</p>
          <button
            onClick={() => {
              setExcludedEntities(new Set());
              setActivePurpose("all");
              setShowSold(false);
            }}
            className="text-sm text-primary hover:underline mt-2 cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
```

Also update the existing entity "Show all" button at the end of entity filter chips to say "Clear" instead:

```tsx
            <button
              onClick={() => setExcludedEntities(new Set())}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline"
            >
              Clear
            </button>
```

**Step 4: Verify no type errors**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No new type errors.

**Step 5: Commit**

```bash
git add src/app/\\(dashboard\\)/properties/page.tsx
git commit -m "feat: add purpose tab pills, sold toggle, and multi-filter to properties page"
```

---

### Task 6: Final verification

**Step 1: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass, including the new `purpose.test.ts`.

**Step 2: Type check**

Run: `npx tsc --noEmit`

Expected: No new type errors.

**Step 3: Lint changed files**

Run: `npx eslint src/server/db/schema/enums.ts src/server/db/schema/properties.ts src/server/routers/property/property.ts src/components/properties/PropertyForm.tsx src/components/properties/PropertyCard.tsx "src/app/(dashboard)/properties/page.tsx"`

Expected: No errors.

---

## Tech Notes

- **Drizzle pgEnum:** Project already has 50+ enums in `enums.ts` — follow exact same pattern: `export const xEnum = pgEnum("x", [...])`. The `$inferSelect` type automatically picks up the new column, so `Property` type includes `purpose` without manual changes.
- **drizzle-kit push:** Used instead of migration files (established project pattern). Default value handles backfill.
- **Client-side filtering:** Properties list is already fully fetched client-side. No need for server-side filtering since the dataset is small (typically <20 properties per user). `useMemo` ensures filter computation only runs when dependencies change.
- **PropertyForm schema:** The existing form uses `propertySchema.partial()` for updates, so adding `purpose` as optional to the base schema automatically makes it available in both create and update.
- **Badge visibility:** Purpose badge only shown for non-investment properties to reduce visual noise (investment is the overwhelmingly common case).
- **Sold filter:** Properties have `status: "active" | "sold"` — the toggle filters on this existing field, no schema change needed.
