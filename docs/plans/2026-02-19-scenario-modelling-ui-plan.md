# Scenario Modelling UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the What-If Scenario Modelling frontend from prototype-quality to production-quality UI with proper form controls, comparison views, and navigation.

**Architecture:** Frontend-only changes to 3 existing pages + 1 new comparison page + shared utilities. No backend changes — all 8 tRPC procedures and the projection engine are production-ready. Factor configs get typed Zod schemas replacing `Record<string, unknown>`. New shared utility (`formatFactorDescription`) drives human-readable factor display across all pages.

**Tech Stack:** React 19 · tRPC v11 · Zod v4 · Recharts · shadcn/ui (Slider, Select, Card) · Tailwind v4 · Vitest

**Design doc:** `docs/plans/2026-02-19-scenario-modelling-ui-design.md`

## Tech Notes

- **Recharts**: `ReferenceLine` accepts `x` prop for vertical lines on XAxis, `label` prop for text. `Legend` has `onClick` handler for toggling. `ReferenceArea` for shaded regions.
- **Zod v4**: Use `z.discriminatedUnion("factorType", [...])` for factor config schemas. `z.enum([...])` for factor type.
- **shadcn Slider**: Wraps `@radix-ui/react-slider`. Props: `value`, `onValueChange`, `min`, `max`, `step`. Value is `number[]`.
- **CSS chart colors**: The project uses `var(--color-chart-1)` through `var(--color-chart-5)` defined in `globals.css`.
- **tRPC cache**: Use `trpc.useUtils()` (not `useContext`). Invalidate with `utils.scenario.list.invalidate()`.
- **formatCurrency**: Import from `@/lib/utils`. Returns `"$1,000"` format (AUD, no cents).

---

### Task 1: Factor Zod Schemas & Description Formatter

**Files:**
- Create: `src/lib/scenarios/factor-schemas.ts`
- Create: `src/lib/scenarios/format-factor.ts`
- Create: `src/lib/scenarios/index.ts`
- Create: `src/lib/scenarios/__tests__/factor-schemas.test.ts`
- Create: `src/lib/scenarios/__tests__/format-factor.test.ts`

These are pure utilities shared by all scenario pages. No React, no tRPC — just Zod schemas and a formatter function.

**Step 1: Write failing tests for factor schemas**

```typescript
// src/lib/scenarios/__tests__/factor-schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  interestRateConfigSchema,
  vacancyConfigSchema,
  rentChangeConfigSchema,
  expenseChangeConfigSchema,
  sellPropertyConfigSchema,
  buyPropertyConfigSchema,
  factorFormSchema,
} from "../factor-schemas";

describe("factor-schemas", () => {
  describe("interestRateConfigSchema", () => {
    it("accepts valid config", () => {
      const result = interestRateConfigSchema.safeParse({
        changePercent: 1.5,
        applyTo: "all",
      });
      expect(result.success).toBe(true);
    });

    it("accepts property-specific config", () => {
      const result = interestRateConfigSchema.safeParse({
        changePercent: -0.5,
        applyTo: "some-uuid",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing changePercent", () => {
      const result = interestRateConfigSchema.safeParse({ applyTo: "all" });
      expect(result.success).toBe(false);
    });

    it("rejects changePercent outside range", () => {
      expect(
        interestRateConfigSchema.safeParse({ changePercent: 10, applyTo: "all" }).success
      ).toBe(false);
      expect(
        interestRateConfigSchema.safeParse({ changePercent: -5, applyTo: "all" }).success
      ).toBe(false);
    });
  });

  describe("vacancyConfigSchema", () => {
    it("accepts valid config", () => {
      const result = vacancyConfigSchema.safeParse({
        propertyId: "abc-123",
        months: 3,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero months", () => {
      const result = vacancyConfigSchema.safeParse({
        propertyId: "abc-123",
        months: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("rentChangeConfigSchema", () => {
    it("accepts valid config with optional propertyId", () => {
      expect(
        rentChangeConfigSchema.safeParse({ changePercent: -10 }).success
      ).toBe(true);
      expect(
        rentChangeConfigSchema.safeParse({ changePercent: 5, propertyId: "abc" }).success
      ).toBe(true);
    });

    it("rejects out-of-range", () => {
      expect(
        rentChangeConfigSchema.safeParse({ changePercent: 30 }).success
      ).toBe(false);
    });
  });

  describe("expenseChangeConfigSchema", () => {
    it("accepts valid config with optional category", () => {
      expect(
        expenseChangeConfigSchema.safeParse({ changePercent: 15 }).success
      ).toBe(true);
      expect(
        expenseChangeConfigSchema.safeParse({ changePercent: -5, category: "insurance" }).success
      ).toBe(true);
    });
  });

  describe("sellPropertyConfigSchema", () => {
    it("accepts valid config", () => {
      const result = sellPropertyConfigSchema.safeParse({
        propertyId: "abc",
        salePrice: 850000,
        sellingCosts: 25000,
        settlementMonth: 12,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative sale price", () => {
      const result = sellPropertyConfigSchema.safeParse({
        propertyId: "abc",
        salePrice: -100,
        sellingCosts: 0,
        settlementMonth: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("buyPropertyConfigSchema", () => {
    it("accepts valid config", () => {
      const result = buyPropertyConfigSchema.safeParse({
        purchasePrice: 600000,
        deposit: 120000,
        loanAmount: 480000,
        interestRate: 6.5,
        expectedRent: 2500,
        expectedExpenses: 600,
        purchaseMonth: 6,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("factorFormSchema", () => {
    it("accepts a complete factor with startMonth and duration", () => {
      const result = factorFormSchema.safeParse({
        factorType: "interest_rate",
        config: { changePercent: 1.5, applyTo: "all" },
        startMonth: 6,
        durationMonths: 12,
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown factor type", () => {
      const result = factorFormSchema.safeParse({
        factorType: "unknown",
        config: {},
        startMonth: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scenarios/__tests__/factor-schemas.test.ts`
Expected: FAIL — module not found

**Step 3: Implement factor schemas**

```typescript
// src/lib/scenarios/factor-schemas.ts
import { z } from "zod";

export const FACTOR_TYPES = [
  "interest_rate",
  "vacancy",
  "rent_change",
  "expense_change",
  "sell_property",
  "buy_property",
] as const;

export type FactorType = (typeof FACTOR_TYPES)[number];

export const interestRateConfigSchema = z.object({
  changePercent: z.number().min(-3).max(5),
  applyTo: z.string().min(1),
});

export const vacancyConfigSchema = z.object({
  propertyId: z.string().min(1),
  months: z.number().int().min(1).max(24),
});

export const rentChangeConfigSchema = z.object({
  changePercent: z.number().min(-20).max(20),
  propertyId: z.string().optional(),
});

export const expenseChangeConfigSchema = z.object({
  changePercent: z.number().min(-20).max(20),
  category: z.string().optional(),
});

export const sellPropertyConfigSchema = z.object({
  propertyId: z.string().min(1),
  salePrice: z.number().min(0),
  sellingCosts: z.number().min(0),
  settlementMonth: z.number().int().min(1),
});

export const buyPropertyConfigSchema = z.object({
  purchasePrice: z.number().min(0),
  deposit: z.number().min(0),
  loanAmount: z.number().min(0),
  interestRate: z.number().min(0).max(20),
  expectedRent: z.number().min(0),
  expectedExpenses: z.number().min(0),
  purchaseMonth: z.number().int().min(0),
});

export type InterestRateConfig = z.infer<typeof interestRateConfigSchema>;
export type VacancyConfig = z.infer<typeof vacancyConfigSchema>;
export type RentChangeConfig = z.infer<typeof rentChangeConfigSchema>;
export type ExpenseChangeConfig = z.infer<typeof expenseChangeConfigSchema>;
export type SellPropertyConfig = z.infer<typeof sellPropertyConfigSchema>;
export type BuyPropertyConfig = z.infer<typeof buyPropertyConfigSchema>;

export const CONFIG_SCHEMAS: Record<FactorType, z.ZodType> = {
  interest_rate: interestRateConfigSchema,
  vacancy: vacancyConfigSchema,
  rent_change: rentChangeConfigSchema,
  expense_change: expenseChangeConfigSchema,
  sell_property: sellPropertyConfigSchema,
  buy_property: buyPropertyConfigSchema,
};

export const factorFormSchema = z.object({
  factorType: z.enum(FACTOR_TYPES),
  config: z.record(z.string(), z.unknown()),
  startMonth: z.number().int().min(0).default(0),
  durationMonths: z.number().int().min(1).optional(),
});

export type FactorFormValues = z.infer<typeof factorFormSchema>;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/scenarios/__tests__/factor-schemas.test.ts`
Expected: PASS (all tests)

**Step 5: Write failing tests for formatFactorDescription**

```typescript
// src/lib/scenarios/__tests__/format-factor.test.ts
import { describe, it, expect } from "vitest";
import { formatFactorDescription } from "../format-factor";
import type { FactorType } from "../factor-schemas";

const properties = [
  { id: "prop-1", address: "123 Main St, Sydney" },
  { id: "prop-2", address: "456 Oak Ave, Melbourne" },
];

describe("formatFactorDescription", () => {
  it("formats interest rate change for all properties", () => {
    const result = formatFactorDescription(
      "interest_rate",
      { changePercent: 1.5, applyTo: "all" },
      properties
    );
    expect(result).toBe("Interest rate +1.5% on all properties");
  });

  it("formats interest rate change for specific property", () => {
    const result = formatFactorDescription(
      "interest_rate",
      { changePercent: -0.25, applyTo: "prop-1" },
      properties
    );
    expect(result).toBe("Interest rate -0.25% on 123 Main St, Sydney");
  });

  it("formats vacancy", () => {
    const result = formatFactorDescription(
      "vacancy",
      { propertyId: "prop-2", months: 3 },
      properties
    );
    expect(result).toBe("3 months vacancy on 456 Oak Ave, Melbourne");
  });

  it("formats rent change for all properties", () => {
    const result = formatFactorDescription(
      "rent_change",
      { changePercent: -10 },
      properties
    );
    expect(result).toBe("Rent -10% on all properties");
  });

  it("formats rent change for specific property", () => {
    const result = formatFactorDescription(
      "rent_change",
      { changePercent: 5, propertyId: "prop-1" },
      properties
    );
    expect(result).toBe("Rent +5% on 123 Main St, Sydney");
  });

  it("formats expense change", () => {
    const result = formatFactorDescription(
      "expense_change",
      { changePercent: 20 },
      properties
    );
    expect(result).toBe("Expenses +20% on all categories");
  });

  it("formats expense change with category", () => {
    const result = formatFactorDescription(
      "expense_change",
      { changePercent: -5, category: "insurance" },
      properties
    );
    expect(result).toBe("Expenses -5% on insurance");
  });

  it("formats sell property", () => {
    const result = formatFactorDescription(
      "sell_property",
      { propertyId: "prop-1", salePrice: 850000, sellingCosts: 25000, settlementMonth: 12 },
      properties
    );
    expect(result).toBe("Sell 123 Main St, Sydney for $850,000");
  });

  it("formats buy property", () => {
    const result = formatFactorDescription(
      "buy_property",
      { purchasePrice: 600000, deposit: 120000, loanAmount: 480000, interestRate: 6.5, expectedRent: 2500, expectedExpenses: 600, purchaseMonth: 6 },
      properties
    );
    expect(result).toBe("Buy property for $600,000 (loan $480,000 @ 6.5%)");
  });

  it("handles unknown property gracefully", () => {
    const result = formatFactorDescription(
      "vacancy",
      { propertyId: "nonexistent", months: 2 },
      properties
    );
    expect(result).toBe("2 months vacancy on Unknown property");
  });
});
```

**Step 6: Run test to verify it fails**

Run: `npx vitest run src/lib/scenarios/__tests__/format-factor.test.ts`
Expected: FAIL — module not found

**Step 7: Implement formatFactorDescription**

```typescript
// src/lib/scenarios/format-factor.ts
import type { FactorType } from "./factor-schemas";

interface PropertyRef {
  id: string;
  address: string;
}

function findPropertyName(id: string, properties: PropertyRef[]): string {
  return properties.find((p) => p.id === id)?.address ?? "Unknown property";
}

function formatPercent(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

export function formatFactorDescription(
  factorType: FactorType,
  config: Record<string, unknown>,
  properties: PropertyRef[]
): string {
  switch (factorType) {
    case "interest_rate": {
      const change = config.changePercent as number;
      const target =
        config.applyTo === "all"
          ? "all properties"
          : findPropertyName(config.applyTo as string, properties);
      return `Interest rate ${formatPercent(change)} on ${target}`;
    }
    case "vacancy": {
      const months = config.months as number;
      const name = findPropertyName(config.propertyId as string, properties);
      return `${months} months vacancy on ${name}`;
    }
    case "rent_change": {
      const change = config.changePercent as number;
      const target = config.propertyId
        ? findPropertyName(config.propertyId as string, properties)
        : "all properties";
      return `Rent ${formatPercent(change)} on ${target}`;
    }
    case "expense_change": {
      const change = config.changePercent as number;
      const target = config.category
        ? (config.category as string)
        : "all categories";
      return `Expenses ${formatPercent(change)} on ${target}`;
    }
    case "sell_property": {
      const name = findPropertyName(config.propertyId as string, properties);
      const price = (config.salePrice as number).toLocaleString("en-AU");
      return `Sell ${name} for $${price}`;
    }
    case "buy_property": {
      const price = (config.purchasePrice as number).toLocaleString("en-AU");
      const loan = (config.loanAmount as number).toLocaleString("en-AU");
      const rate = config.interestRate as number;
      return `Buy property for $${price} (loan $${loan} @ ${rate}%)`;
    }
    default:
      return "Unknown factor";
  }
}
```

**Step 8: Create barrel export**

```typescript
// src/lib/scenarios/index.ts
export {
  FACTOR_TYPES,
  interestRateConfigSchema,
  vacancyConfigSchema,
  rentChangeConfigSchema,
  expenseChangeConfigSchema,
  sellPropertyConfigSchema,
  buyPropertyConfigSchema,
  factorFormSchema,
  CONFIG_SCHEMAS,
  type FactorType,
  type InterestRateConfig,
  type VacancyConfig,
  type RentChangeConfig,
  type ExpenseChangeConfig,
  type SellPropertyConfig,
  type BuyPropertyConfig,
  type FactorFormValues,
} from "./factor-schemas";

export { formatFactorDescription } from "./format-factor";
```

**Step 9: Run all tests to verify they pass**

Run: `npx vitest run src/lib/scenarios/__tests__/`
Expected: PASS (all tests across both files)

**Step 10: Commit**

```bash
git add src/lib/scenarios/
git commit -m "feat: add factor Zod schemas and description formatter"
```

---

### Task 2: FactorCard Shared Component

**Files:**
- Create: `src/components/scenarios/FactorCard.tsx`
- Create: `src/components/scenarios/index.ts`

Shared read-only card that displays a single factor in human-readable format. Used by both the create/edit page (with edit/remove) and results page (read-only).

**Step 1: Create FactorCard component**

```tsx
// src/components/scenarios/FactorCard.tsx
"use client";

import {
  TrendingUp,
  TrendingDown,
  Home,
  Ban,
  DollarSign,
  ShoppingCart,
  Pencil,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFactorDescription } from "@/lib/scenarios";
import type { FactorType } from "@/lib/scenarios";

interface PropertyRef {
  id: string;
  address: string;
}

interface FactorCardProps {
  factorType: FactorType;
  config: Record<string, unknown>;
  startMonth: number;
  durationMonths?: number;
  properties: PropertyRef[];
  onEdit?: () => void;
  onRemove?: () => void;
}

const FACTOR_ICONS: Record<FactorType, React.ElementType> = {
  interest_rate: TrendingUp,
  vacancy: Ban,
  rent_change: Home,
  expense_change: TrendingDown,
  sell_property: DollarSign,
  buy_property: ShoppingCart,
};

export function FactorCard({
  factorType,
  config,
  startMonth,
  durationMonths,
  properties,
  onEdit,
  onRemove,
}: FactorCardProps) {
  const Icon = FACTOR_ICONS[factorType];
  const description = formatFactorDescription(factorType, config, properties);

  const monthRange = durationMonths
    ? `Months ${startMonth}–${startMonth + durationMonths}`
    : `From month ${startMonth}`;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{description}</p>
          <p className="text-xs text-muted-foreground">{monthRange}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {factorType.replace(/_/g, " ")}
        </Badge>
        {(onEdit || onRemove) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Edit factor">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Remove factor">
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create barrel export**

```typescript
// src/components/scenarios/index.ts
export { FactorCard } from "./FactorCard";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in scenario files (pre-existing errors OK)

**Step 4: Commit**

```bash
git add src/components/scenarios/
git commit -m "feat: add FactorCard shared component"
```

---

### Task 3: Create/Edit Page Redesign

**Files:**
- Modify: `src/app/(dashboard)/reports/scenarios/new/page.tsx` (full rewrite — 620 lines → ~350)

Replace DOM hacks with proper React state. Add sliders for percentage factors. Use Zod schemas for validation. Show FactorCard summaries.

**Step 1: Rewrite the page**

Replace the entire contents of `src/app/(dashboard)/reports/scenarios/new/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Play,
  Plus,
  Save,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { FactorCard } from "@/components/scenarios";
import {
  FACTOR_TYPES,
  type FactorType,
  interestRateConfigSchema,
  vacancyConfigSchema,
  rentChangeConfigSchema,
  expenseChangeConfigSchema,
  sellPropertyConfigSchema,
  buyPropertyConfigSchema,
} from "@/lib/scenarios";

interface FactorEntry {
  factorType: FactorType;
  config: Record<string, unknown>;
  startMonth: number;
  durationMonths?: number;
}

const FACTOR_LABELS: Record<FactorType, string> = {
  interest_rate: "Interest Rate Change",
  vacancy: "Vacancy Period",
  rent_change: "Rent Change",
  expense_change: "Expense Change",
  sell_property: "Sell Property",
  buy_property: "Buy Property",
};

function NewScenarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchFromId = searchParams?.get("branch");

  // Scenario settings
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [timeHorizon, setTimeHorizon] = useState(60);
  const [marginalTaxRate, setMarginalTaxRate] = useState(0.37);
  const [factors, setFactors] = useState<FactorEntry[]>([]);

  // Factor input state
  const [addingType, setAddingType] = useState<FactorType | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Per-type input state
  const [interestChange, setInterestChange] = useState(0);
  const [interestApplyTo, setInterestApplyTo] = useState("all");
  const [vacancyProperty, setVacancyProperty] = useState("");
  const [vacancyMonths, setVacancyMonths] = useState(3);
  const [rentChange, setRentChange] = useState(0);
  const [rentProperty, setRentProperty] = useState("");
  const [expenseChange, setExpenseChange] = useState(0);
  const [expenseCategory, setExpenseCategory] = useState("");
  const [sellProperty, setSellProperty] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [sellCosts, setSellCosts] = useState(0);
  const [sellMonth, setSellMonth] = useState(12);
  const [buyPrice, setBuyPrice] = useState(0);
  const [buyDeposit, setBuyDeposit] = useState(0);
  const [buyLoan, setBuyLoan] = useState(0);
  const [buyRate, setBuyRate] = useState(6.5);
  const [buyRent, setBuyRent] = useState(0);
  const [buyExpenses, setBuyExpenses] = useState(0);
  const [buyMonth, setBuyMonth] = useState(6);
  const [factorStartMonth, setFactorStartMonth] = useState(0);
  const [factorDuration, setFactorDuration] = useState<number | undefined>(undefined);

  const { data: properties } = trpc.property.list.useQuery();
  const { data: parentScenario } = trpc.scenario.get.useQuery(
    { id: branchFromId! },
    { enabled: !!branchFromId }
  );

  const createMutation = trpc.scenario.create.useMutation({
    onSuccess: (scenario) => {
      toast.success("Scenario created");
      router.push(`/reports/scenarios/${scenario.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const propertyList = (properties ?? []).map((p) => ({
    id: p.id,
    address: p.address ?? `Property ${p.id.slice(0, 8)}`,
  }));

  function resetFactorInputs() {
    setInterestChange(0);
    setInterestApplyTo("all");
    setVacancyProperty("");
    setVacancyMonths(3);
    setRentChange(0);
    setRentProperty("");
    setExpenseChange(0);
    setExpenseCategory("");
    setSellProperty("");
    setSellPrice(0);
    setSellCosts(0);
    setSellMonth(12);
    setBuyPrice(0);
    setBuyDeposit(0);
    setBuyLoan(0);
    setBuyRate(6.5);
    setBuyRent(0);
    setBuyExpenses(0);
    setBuyMonth(6);
    setFactorStartMonth(0);
    setFactorDuration(undefined);
    setAddingType(null);
    setEditingIndex(null);
  }

  function addCurrentFactor() {
    if (!addingType) return;

    let config: Record<string, unknown> = {};
    let valid = false;

    switch (addingType) {
      case "interest_rate":
        config = { changePercent: interestChange, applyTo: interestApplyTo };
        valid = interestRateConfigSchema.safeParse(config).success;
        break;
      case "vacancy":
        config = { propertyId: vacancyProperty, months: vacancyMonths };
        valid = vacancyConfigSchema.safeParse(config).success;
        break;
      case "rent_change":
        config = { changePercent: rentChange, ...(rentProperty ? { propertyId: rentProperty } : {}) };
        valid = rentChangeConfigSchema.safeParse(config).success;
        break;
      case "expense_change":
        config = { changePercent: expenseChange, ...(expenseCategory ? { category: expenseCategory } : {}) };
        valid = expenseChangeConfigSchema.safeParse(config).success;
        break;
      case "sell_property":
        config = { propertyId: sellProperty, salePrice: sellPrice, sellingCosts: sellCosts, settlementMonth: sellMonth };
        valid = sellPropertyConfigSchema.safeParse(config).success;
        break;
      case "buy_property":
        config = { purchasePrice: buyPrice, deposit: buyDeposit, loanAmount: buyLoan, interestRate: buyRate, expectedRent: buyRent, expectedExpenses: buyExpenses, purchaseMonth: buyMonth };
        valid = buyPropertyConfigSchema.safeParse(config).success;
        break;
    }

    if (!valid) {
      toast.error("Please fill in all required fields");
      return;
    }

    const entry: FactorEntry = {
      factorType: addingType,
      config,
      startMonth: factorStartMonth,
      durationMonths: factorDuration,
    };

    if (editingIndex !== null) {
      setFactors((prev) => prev.map((f, i) => (i === editingIndex ? entry : f)));
    } else {
      setFactors((prev) => [...prev, entry]);
    }
    resetFactorInputs();
  }

  function handleEditFactor(index: number) {
    const f = factors[index];
    setAddingType(f.factorType);
    setEditingIndex(index);
    setFactorStartMonth(f.startMonth);
    setFactorDuration(f.durationMonths);

    const c = f.config;
    switch (f.factorType) {
      case "interest_rate":
        setInterestChange(c.changePercent as number);
        setInterestApplyTo(c.applyTo as string);
        break;
      case "vacancy":
        setVacancyProperty(c.propertyId as string);
        setVacancyMonths(c.months as number);
        break;
      case "rent_change":
        setRentChange(c.changePercent as number);
        setRentProperty((c.propertyId as string) ?? "");
        break;
      case "expense_change":
        setExpenseChange(c.changePercent as number);
        setExpenseCategory((c.category as string) ?? "");
        break;
      case "sell_property":
        setSellProperty(c.propertyId as string);
        setSellPrice(c.salePrice as number);
        setSellCosts(c.sellingCosts as number);
        setSellMonth(c.settlementMonth as number);
        break;
      case "buy_property":
        setBuyPrice(c.purchasePrice as number);
        setBuyDeposit(c.deposit as number);
        setBuyLoan(c.loanAmount as number);
        setBuyRate(c.interestRate as number);
        setBuyRent(c.expectedRent as number);
        setBuyExpenses(c.expectedExpenses as number);
        setBuyMonth(c.purchaseMonth as number);
        break;
    }
  }

  function handleSubmit(runAfter: boolean) {
    if (!name.trim()) {
      toast.error("Please enter a scenario name");
      return;
    }
    createMutation.mutate({
      name,
      description: description || undefined,
      timeHorizonMonths: timeHorizon,
      marginalTaxRate,
      parentScenarioId: branchFromId || undefined,
      factors: factors.length > 0 ? factors : undefined,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports/scenarios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">
            {branchFromId ? "Branch Scenario" : "New Scenario"}
          </h2>
          {parentScenario && (
            <p className="text-muted-foreground">
              Branching from: {parentScenario.name}
            </p>
          )}
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Scenario Name</Label>
            <Input
              id="name"
              placeholder="e.g., Rate rise stress test"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What are you modeling?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Time Horizon</Label>
              <Select
                value={String(timeHorizon)}
                onValueChange={(v) => setTimeHorizon(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">1 year</SelectItem>
                  <SelectItem value="24">2 years</SelectItem>
                  <SelectItem value="36">3 years</SelectItem>
                  <SelectItem value="60">5 years</SelectItem>
                  <SelectItem value="120">10 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marginal Tax Rate</Label>
              <Select
                value={String(marginalTaxRate)}
                onValueChange={(v) => setMarginalTaxRate(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="0.19">19%</SelectItem>
                  <SelectItem value="0.325">32.5%</SelectItem>
                  <SelectItem value="0.37">37%</SelectItem>
                  <SelectItem value="0.45">45%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Factors</CardTitle>
          {!addingType && (
            <Select onValueChange={(v) => setAddingType(v as FactorType)}>
              <SelectTrigger className="w-auto">
                <Plus className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Add factor" />
              </SelectTrigger>
              <SelectContent>
                {FACTOR_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FACTOR_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing factors */}
          {factors.map((f, i) => (
            <FactorCard
              key={i}
              factorType={f.factorType}
              config={f.config}
              startMonth={f.startMonth}
              durationMonths={f.durationMonths}
              properties={propertyList}
              onEdit={() => handleEditFactor(i)}
              onRemove={() => setFactors((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}

          {factors.length === 0 && !addingType && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No factors added yet. Add factors to model what-if scenarios.
            </p>
          )}

          {/* Factor input form — renders based on addingType */}
          {addingType && (
            <Card className="border-primary/20">
              <CardContent className="space-y-4 pt-4">
                <p className="font-medium text-sm">{FACTOR_LABELS[addingType]}</p>

                {/* Interest Rate */}
                {addingType === "interest_rate" && (
                  <>
                    <div className="space-y-2">
                      <Label>Rate Change: {interestChange >= 0 ? "+" : ""}{interestChange}%</Label>
                      <Slider
                        value={[interestChange]}
                        onValueChange={([v]) => setInterestChange(v)}
                        min={-3}
                        max={5}
                        step={0.25}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-3%</span>
                        <span>+5%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Apply To</Label>
                      <Select value={interestApplyTo} onValueChange={setInterestApplyTo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All properties</SelectItem>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Vacancy */}
                {addingType === "vacancy" && (
                  <>
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select value={vacancyProperty} onValueChange={setVacancyProperty}>
                        <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                        <SelectContent>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration: {vacancyMonths} months</Label>
                      <Slider
                        value={[vacancyMonths]}
                        onValueChange={([v]) => setVacancyMonths(v)}
                        min={1}
                        max={24}
                        step={1}
                      />
                    </div>
                  </>
                )}

                {/* Rent Change */}
                {addingType === "rent_change" && (
                  <>
                    <div className="space-y-2">
                      <Label>Rent Change: {rentChange >= 0 ? "+" : ""}{rentChange}%</Label>
                      <Slider
                        value={[rentChange]}
                        onValueChange={([v]) => setRentChange(v)}
                        min={-20}
                        max={20}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-20%</span>
                        <span>+20%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Property (optional)</Label>
                      <Select value={rentProperty} onValueChange={setRentProperty}>
                        <SelectTrigger><SelectValue placeholder="All properties" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All properties</SelectItem>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Expense Change */}
                {addingType === "expense_change" && (
                  <>
                    <div className="space-y-2">
                      <Label>Expense Change: {expenseChange >= 0 ? "+" : ""}{expenseChange}%</Label>
                      <Slider
                        value={[expenseChange]}
                        onValueChange={([v]) => setExpenseChange(v)}
                        min={-20}
                        max={20}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-20%</span>
                        <span>+20%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Category (optional)</Label>
                      <Input
                        placeholder="All categories"
                        value={expenseCategory}
                        onChange={(e) => setExpenseCategory(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Sell Property */}
                {addingType === "sell_property" && (
                  <>
                    <div className="space-y-2">
                      <Label>Property to Sell</Label>
                      <Select value={sellProperty} onValueChange={setSellProperty}>
                        <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                        <SelectContent>
                          {propertyList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Sale Price ($)</Label>
                        <Input type="number" value={sellPrice || ""} onChange={(e) => setSellPrice(Number(e.target.value))} placeholder="850,000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Selling Costs ($)</Label>
                        <Input type="number" value={sellCosts || ""} onChange={(e) => setSellCosts(Number(e.target.value))} placeholder="25,000" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Settlement Month</Label>
                      <Input type="number" min={1} max={120} value={sellMonth} onChange={(e) => setSellMonth(Number(e.target.value))} />
                    </div>
                  </>
                )}

                {/* Buy Property */}
                {addingType === "buy_property" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Purchase Price ($)</Label>
                        <Input type="number" value={buyPrice || ""} onChange={(e) => setBuyPrice(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Deposit ($)</Label>
                        <Input type="number" value={buyDeposit || ""} onChange={(e) => setBuyDeposit(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Loan Amount ($)</Label>
                        <Input type="number" value={buyLoan || ""} onChange={(e) => setBuyLoan(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Interest Rate (%)</Label>
                        <Input type="number" step={0.1} value={buyRate} onChange={(e) => setBuyRate(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Expected Rent ($/mo)</Label>
                        <Input type="number" value={buyRent || ""} onChange={(e) => setBuyRent(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Expenses ($/mo)</Label>
                        <Input type="number" value={buyExpenses || ""} onChange={(e) => setBuyExpenses(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Month</Label>
                      <Input type="number" min={0} max={120} value={buyMonth} onChange={(e) => setBuyMonth(Number(e.target.value))} />
                    </div>
                  </>
                )}

                {/* Timing (shared for all types) */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Start Month</Label>
                    <Input type="number" min={0} value={factorStartMonth} onChange={(e) => setFactorStartMonth(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (months, optional)</Label>
                    <Input type="number" min={1} value={factorDuration ?? ""} onChange={(e) => setFactorDuration(e.target.value ? Number(e.target.value) : undefined)} />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetFactorInputs}>Cancel</Button>
                  <Button onClick={addCurrentFactor}>
                    {editingIndex !== null ? "Update Factor" : "Add Factor"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/reports/scenarios">Cancel</Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={createMutation.isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Draft
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={createMutation.isPending}
        >
          <Play className="w-4 h-4 mr-2" />
          {createMutation.isPending ? "Creating..." : "Create & Run"}
        </Button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function NewScenarioPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewScenarioContent />
    </Suspense>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"` (or `head -30`)
Expected: No new errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/scenarios/new/page.tsx
git commit -m "feat: redesign scenario create page with sliders and Zod validation"
```

---

### Task 4: Enhanced ScenarioCashFlowChart

**Files:**
- Modify: `src/components/reports/ScenarioCashFlowChart.tsx` (full rewrite — 73 lines → ~120)

Replace hardcoded hex colors with CSS variables. Add factor event markers as `ReferenceLine`s. Add `Legend` for toggling lines. Better tooltip with `formatCurrency`.

**Step 1: Rewrite the chart**

Replace the entire contents of `src/components/reports/ScenarioCashFlowChart.tsx`:

```tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ChartDataPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface FactorMarker {
  month: number;
  label: string;
  type: "rate_change" | "vacancy" | "sale" | "purchase";
}

interface ScenarioCashFlowChartProps {
  data: ChartDataPoint[];
  markers?: FactorMarker[];
}

const MARKER_STYLES: Record<FactorMarker["type"], { stroke: string; strokeDasharray: string }> = {
  rate_change: { stroke: "var(--color-chart-4)", strokeDasharray: "5 5" },
  vacancy: { stroke: "var(--color-chart-5)", strokeDasharray: "3 3" },
  sale: { stroke: "var(--color-destructive)", strokeDasharray: "0" },
  purchase: { stroke: "var(--color-chart-3)", strokeDasharray: "0" },
};

export function ScenarioCashFlowChart({ data, markers = [] }: ScenarioCashFlowChartProps) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Projection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
              {markers.map((m, i) => (
                <ReferenceLine
                  key={i}
                  x={data[m.month]?.month}
                  stroke={MARKER_STYLES[m.type].stroke}
                  strokeDasharray={MARKER_STYLES[m.type].strokeDasharray}
                  label={{ value: m.label, position: "top", fontSize: 10 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="income"
                stroke="var(--color-chart-1)"
                name="Income"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="var(--color-chart-2)"
                name="Expenses"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="var(--color-chart-3)"
                name="Net"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "ScenarioCashFlowChart"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/reports/ScenarioCashFlowChart.tsx
git commit -m "feat: enhance scenario chart with CSS variables, markers, and legend"
```

---

### Task 5: Results Page Redesign

**Files:**
- Modify: `src/app/(dashboard)/reports/scenarios/[id]/page.tsx` (full rewrite — 250 lines → ~300)

Add comparison strip (before/after metrics with deltas), CGT breakdown card, human-readable factor cards. Replace raw JSON factor display with FactorCard components.

**Step 1: Rewrite the detail page**

Replace the entire contents of `src/app/(dashboard)/reports/scenarios/[id]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { format, addMonths } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { FactorCard } from "@/components/scenarios";
import type { FactorType } from "@/lib/scenarios";

const ScenarioCashFlowChart = dynamic(
  () =>
    import("@/components/reports/ScenarioCashFlowChart").then((m) => ({
      default: m.ScenarioCashFlowChart,
    })),
  {
    loading: () => <ChartSkeleton height={320} />,
    ssr: false,
  }
);

interface MetricDelta {
  label: string;
  value: number;
  suffix?: string;
  invertColor?: boolean;
}

function MetricCard({ label, value, suffix = "", invertColor = false }: MetricDelta) {
  const isPositive = value >= 0;
  const colorClass = invertColor
    ? isPositive ? "text-red-600" : "text-green-600"
    : isPositive ? "text-green-600" : "text-red-600";
  const arrow = isPositive ? "↑" : "↓";

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold">
          {formatCurrency(Math.abs(value))}{suffix}
        </p>
        <p className={`text-xs font-medium ${colorClass}`}>
          {arrow} {formatCurrency(Math.abs(value))}{suffix} projected
        </p>
      </CardContent>
    </Card>
  );
}

export default function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data: properties } = trpc.property.list.useQuery();

  const { data: scenario, isLoading } = trpc.scenario.get.useQuery({ id });

  const runMutation = trpc.scenario.run.useMutation({
    onSuccess: () => {
      toast.success("Projection recalculated");
      utils.scenario.get.invalidate({ id });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <ChartSkeleton height={320} />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Scenario not found</p>
      </div>
    );
  }

  const projection = scenario.projection;
  const summaryMetrics = projection
    ? (JSON.parse(projection.summaryMetrics) as {
        totalIncome: number;
        totalExpenses: number;
        totalNet: number;
        averageMonthlyIncome: number;
        averageMonthlyExpenses: number;
        averageMonthlyNet: number;
        monthsWithNegativeCashFlow: number;
        lowestMonthNet: number;
        highestMonthNet: number;
      })
    : null;
  const monthlyResults: Array<{
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
  }> = projection ? JSON.parse(projection.monthlyResults) : [];

  // Chart data
  const chartData = monthlyResults.map((m, i) => ({
    month: format(addMonths(new Date(), i), "MMM yyyy"),
    income: m.totalIncome,
    expenses: m.totalExpenses,
    net: m.netCashFlow,
  }));

  // Build factor markers for chart
  const markers = scenario.factors.map((f) => {
    const typeMap: Record<string, "rate_change" | "vacancy" | "sale" | "purchase"> = {
      interest_rate: "rate_change",
      rent_change: "rate_change",
      expense_change: "rate_change",
      vacancy: "vacancy",
      sell_property: "sale",
      buy_property: "purchase",
    };
    return {
      month: Number(f.startMonth),
      label: f.factorType.replace(/_/g, " "),
      type: typeMap[f.factorType] ?? ("rate_change" as const),
    };
  });

  const propertyList = (properties ?? []).map((p) => ({
    id: p.id,
    address: p.address ?? `Property ${p.id.slice(0, 8)}`,
  }));

  // Check for sell factors — for CGT card
  const sellFactors = scenario.factors.filter((f) => f.factorType === "sell_property");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reports/scenarios">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{scenario.name}</h2>
            {scenario.description && (
              <p className="text-muted-foreground">{scenario.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={scenario.status === "saved" ? "default" : "secondary"}>
            {scenario.status}
          </Badge>
          {projection?.isStale && <Badge variant="destructive">Stale</Badge>}
          <Button variant="outline" asChild>
            <Link href={`/reports/scenarios/new?branch=${id}`}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button
            onClick={() => runMutation.mutate({ id })}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {projection ? "Recalculate" : "Run Projection"}
          </Button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      {summaryMetrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Average Monthly Income"
            value={summaryMetrics.averageMonthlyIncome}
            suffix="/mo"
          />
          <MetricCard
            label="Average Monthly Expenses"
            value={summaryMetrics.averageMonthlyExpenses}
            suffix="/mo"
            invertColor
          />
          <MetricCard
            label="Net Position (Total)"
            value={summaryMetrics.totalNet}
          />
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Negative Months</p>
              <p className="text-xl font-bold">
                {summaryMetrics.monthsWithNegativeCashFlow}
              </p>
              <p className="text-xs text-muted-foreground">
                of {monthlyResults.length} total months
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow Chart */}
      <ScenarioCashFlowChart data={chartData} markers={markers} />

      {/* CGT Breakdown + Factors side by side */}
      <div className={sellFactors.length > 0 ? "grid gap-6 lg:grid-cols-2" : ""}>
        {/* CGT Breakdown */}
        {sellFactors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Capital Gains Tax Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {sellFactors.map((f) => {
                const config = JSON.parse(f.config) as {
                  propertyId: string;
                  salePrice: number;
                  sellingCosts: number;
                };
                const propName = propertyList.find((p) => p.id === config.propertyId)?.address ?? "Unknown";
                return (
                  <div key={f.id} className="space-y-2 text-sm">
                    <p className="font-medium">{propName}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimated Sale Price</span>
                        <span>{formatCurrency(config.salePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Less: Selling Costs</span>
                        <span>-{formatCurrency(config.sellingCosts)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-muted-foreground">Net Sale Proceeds</span>
                        <span className="font-medium">
                          {formatCurrency(config.salePrice - config.sellingCosts)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        Full CGT calculation (cost base, discount) applied in projection
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Configured Factors */}
        <Card>
          <CardHeader>
            <CardTitle>Scenario Factors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scenario.factors.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No factors configured (base case projection)
              </p>
            ) : (
              scenario.factors.map((factor) => (
                <FactorCard
                  key={factor.id}
                  factorType={factor.factorType as FactorType}
                  config={JSON.parse(factor.config)}
                  startMonth={Number(factor.startMonth)}
                  durationMonths={factor.durationMonths ? Number(factor.durationMonths) : undefined}
                  properties={propertyList}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "scenarios/\[id\]"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/scenarios/\[id\]/page.tsx
git commit -m "feat: redesign scenario results page with metrics strip and factor cards"
```

---

### Task 6: Sidebar Navigation & Reports Hub

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (add 1 nav item)
- Modify: `src/app/(dashboard)/reports/page.tsx` (add 1 report card)

**Step 1: Add Scenarios to sidebar**

In `src/components/layout/Sidebar.tsx`:
- Add `GitBranch` to the lucide-react import
- Add nav item to the "Reports & Tax" section after the existing items:

```typescript
{ href: "/reports/scenarios", label: "Scenarios", icon: GitBranch },
```

**Step 2: Add Scenarios card to reports hub**

In `src/app/(dashboard)/reports/page.tsx`:
- Add `GitBranch` to the lucide-react import
- Add to the `reportTypes` array:

```typescript
{
  title: "Scenario Simulator",
  description: "Model what-if scenarios: rate changes, vacancy, buy/sell decisions",
  icon: GitBranch,
  href: "/reports/scenarios",
},
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "Sidebar|reports/page"`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/app/\(dashboard\)/reports/page.tsx
git commit -m "feat: add Scenarios to sidebar navigation and reports hub"
```

---

### Task 7: Comparison Page

**Files:**
- Create: `src/app/(dashboard)/reports/scenarios/compare/page.tsx`

New page for side-by-side scenario comparison: select 2-4 scenarios, view metrics table and overlaid chart.

**Step 1: Create comparison page**

```tsx
// src/app/(dashboard)/reports/scenarios/compare/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, addMonths } from "date-fns";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

const LINE_STYLES: Array<string | undefined> = [undefined, "5 5", "3 3", "8 3"];

export default function CompareScenarios() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: scenarios } = trpc.scenario.list.useQuery();

  // Fetch details for each selected scenario
  const scenarioQueries = selectedIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.scenario.get.useQuery({ id }, { enabled: !!id })
  );

  function addScenario(id: string) {
    if (selectedIds.length < 4 && !selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  }

  function removeScenario(id: string) {
    setSelectedIds((prev) => prev.filter((s) => s !== id));
  }

  const availableScenarios = (scenarios ?? []).filter(
    (s) => !selectedIds.includes(s.id) && s.projection
  );

  // Build combined chart data
  const chartDataMap = new Map<string, Record<string, number>>();
  scenarioQueries.forEach((q, idx) => {
    if (!q.data?.projection) return;
    const monthlyResults: Array<{ netCashFlow: number }> = JSON.parse(
      q.data.projection.monthlyResults
    );
    monthlyResults.forEach((m, monthIdx) => {
      const label = format(addMonths(new Date(), monthIdx), "MMM yyyy");
      const existing = chartDataMap.get(label) ?? {};
      existing[`net_${idx}`] = m.netCashFlow;
      chartDataMap.set(label, existing);
    });
  });

  const chartData = Array.from(chartDataMap.entries()).map(([month, values]) => ({
    month,
    ...values,
  }));

  // Build metrics table
  const metricsRows = [
    { label: "Total Income", key: "totalIncome" },
    { label: "Total Expenses", key: "totalExpenses" },
    { label: "Net Position", key: "totalNet" },
    { label: "Avg Monthly Net", key: "averageMonthlyNet" },
    { label: "Negative Months", key: "monthsWithNegativeCashFlow", isCurrency: false },
    { label: "Lowest Month", key: "lowestMonthNet" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports/scenarios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Compare Scenarios</h2>
          <p className="text-muted-foreground">
            Select up to 4 scenarios to compare side-by-side
          </p>
        </div>
      </div>

      {/* Scenario Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            {selectedIds.map((id, idx) => {
              const s = scenarios?.find((sc) => sc.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[idx] }}
                  />
                  <span>{s?.name ?? "Loading..."}</span>
                  <button
                    onClick={() => removeScenario(id)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Remove ${s?.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {selectedIds.length < 4 && availableScenarios.length > 0 && (
              <Select onValueChange={addScenario}>
                <SelectTrigger className="w-auto">
                  <Plus className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Add scenario" />
                </SelectTrigger>
                <SelectContent>
                  {availableScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Table */}
      {selectedIds.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Metrics Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                      Metric
                    </th>
                    {scenarioQueries.map((q, idx) => (
                      <th key={idx} className="text-right py-2 px-4 font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx] }}
                          />
                          {q.data?.name ?? "..."}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricsRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {row.label}
                      </td>
                      {scenarioQueries.map((q, idx) => {
                        const metrics = q.data?.projection
                          ? JSON.parse(q.data.projection.summaryMetrics)
                          : null;
                        const value = metrics?.[row.key];
                        return (
                          <td key={idx} className="text-right py-2 px-4 font-mono">
                            {value !== undefined
                              ? row.isCurrency === false
                                ? value
                                : formatCurrency(value)
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overlaid Chart */}
      {selectedIds.length >= 2 && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Net Cash Flow Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                  {scenarioQueries.map((q, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={`net_${idx}`}
                      stroke={CHART_COLORS[idx]}
                      name={q.data?.name ?? `Scenario ${idx + 1}`}
                      strokeWidth={2}
                      strokeDasharray={LINE_STYLES[idx]}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedIds.length < 2 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              Select at least 2 scenarios with projections to compare
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Add Compare button to scenarios list page**

In `src/app/(dashboard)/reports/scenarios/page.tsx`, add a "Compare" button in the header next to "New Scenario":

In the import section, add `BarChart3` to the lucide-react import.

After the "New Scenario" button (around line 76), add:

```tsx
<Button variant="outline" asChild>
  <Link href="/reports/scenarios/compare">
    <BarChart3 className="w-4 h-4 mr-2" />
    Compare
  </Link>
</Button>
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: 0 new errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/reports/scenarios/compare/ src/app/\(dashboard\)/reports/scenarios/page.tsx
git commit -m "feat: add scenario comparison page with overlaid charts"
```

---

### Task 8: Final Verification & Cleanup

**Files:**
- No new files — verification pass

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors (or only pre-existing ones)

**Step 2: Run all unit tests**

Run: `npx vitest run src/lib/scenarios/`
Expected: All passing

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All passing (pre-existing failures OK)

**Step 4: Visual verification (optional)**

If dev server is running, check:
- `/reports/scenarios/new` — sliders work, factors add/remove
- `/reports/scenarios/[id]` — metrics strip, chart with markers, factor cards
- `/reports/scenarios/compare` — scenario selector, overlaid chart, metrics table
- Sidebar has "Scenarios" item under Reports & Tax
- `/reports` hub has "Scenario Simulator" card

**Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: scenario modelling UI cleanup and verification"
```
