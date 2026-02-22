# Borrowing Power Estimator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full APRA-style serviceability calculator with what-if scenarios at `/tools/borrowing-power`, pre-filled from portfolio data, pure client-side.

**Architecture:** A calculation engine (`src/lib/borrowing-power-calc.ts`) with pure functions for income shading, HEM lookup, PV annuity, and DTI check. A page component fetches existing `portfolio.getBorrowingPower` to pre-fill inputs, then runs all calculations client-side with live updates. Scenarios duplicate inputs for side-by-side comparison.

**Tech Stack:** React 19, tRPC v11 (existing query only), Tailwind v4, Vitest, lucide-react

---

### Task 1: Feature Flag + Route Mapping

**Files:**
- Modify: `src/config/feature-flags.ts`

**Step 1: Add feature flag and route mapping**

In `src/config/feature-flags.ts`, add `borrowingPowerEstimator: true` to the `featureFlags` object under the `// ── Other UI ──` section:

```typescript
  // ── Other UI ──────────────────────────────────────────────────────
  fySelector: false,
  aiAssistant: true,
  whatsNew: false,
  helpMenu: false,
  quickAdd: false,
  borrowingPowerEstimator: true,
```

Add the route mapping to `routeToFlag`:

```typescript
  "/settings/support": "support",
  "/tools/borrowing-power": "borrowingPowerEstimator",
```

**Step 2: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat: add borrowingPowerEstimator feature flag"
```

---

### Task 2: Calculation Engine — HEM + Income Shading

**Files:**
- Create: `src/lib/borrowing-power-calc.ts`
- Create: `src/lib/__tests__/borrowing-power-calc.test.ts`

**Step 1: Write failing tests for HEM lookup and income shading**

Create `src/lib/__tests__/borrowing-power-calc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getHemBenchmark,
  shadeIncome,
  type HouseholdType,
} from "../borrowing-power-calc";

describe("getHemBenchmark", () => {
  it("returns correct HEM for single no dependants", () => {
    expect(getHemBenchmark("single", 0)).toBe(1400);
  });

  it("returns correct HEM for couple no dependants", () => {
    expect(getHemBenchmark("couple", 0)).toBe(2100);
  });

  it("returns correct HEM for single with 1 dependant", () => {
    expect(getHemBenchmark("single", 1)).toBe(1800);
  });

  it("returns correct HEM for single with 2 dependants", () => {
    expect(getHemBenchmark("single", 2)).toBe(2100);
  });

  it("returns correct HEM for single with 3+ dependants", () => {
    expect(getHemBenchmark("single", 3)).toBe(2400);
    expect(getHemBenchmark("single", 5)).toBe(2400);
  });

  it("returns correct HEM for couple with 1 dependant", () => {
    expect(getHemBenchmark("couple", 1)).toBe(2400);
  });

  it("returns correct HEM for couple with 2 dependants", () => {
    expect(getHemBenchmark("couple", 2)).toBe(2700);
  });

  it("returns correct HEM for couple with 3+ dependants", () => {
    expect(getHemBenchmark("couple", 3)).toBe(3000);
    expect(getHemBenchmark("couple", 6)).toBe(3000);
  });
});

describe("shadeIncome", () => {
  it("shades salary at 100%", () => {
    expect(shadeIncome(10000, "salary")).toBe(10000);
  });

  it("shades rental income at 80%", () => {
    expect(shadeIncome(5000, "rental")).toBe(4000);
  });

  it("shades other income at 80%", () => {
    expect(shadeIncome(2000, "other")).toBe(1600);
  });

  it("returns 0 for zero input", () => {
    expect(shadeIncome(0, "salary")).toBe(0);
    expect(shadeIncome(0, "rental")).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/borrowing-power-calc.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement HEM lookup and income shading**

Create `src/lib/borrowing-power-calc.ts`:

```typescript
export type HouseholdType = "single" | "couple";
export type IncomeSource = "salary" | "rental" | "other";

/**
 * Monthly HEM benchmarks by household type and dependant count.
 * Source: Melbourne Institute HEM (approximate, updated annually).
 */
const HEM_TABLE: Record<HouseholdType, number[]> = {
  //                  0 deps, 1 dep, 2 deps, 3+ deps
  single: [1400, 1800, 2100, 2400],
  couple: [2100, 2400, 2700, 3000],
};

/** Returns monthly HEM benchmark for household type and dependant count. */
export function getHemBenchmark(
  householdType: HouseholdType,
  dependants: number
): number {
  const row = HEM_TABLE[householdType];
  const index = Math.min(dependants, 3);
  return row[index];
}

const INCOME_SHADING: Record<IncomeSource, number> = {
  salary: 1.0,
  rental: 0.8,
  other: 0.8,
};

/** Applies bank-standard income shading. */
export function shadeIncome(
  monthlyAmount: number,
  source: IncomeSource
): number {
  return monthlyAmount * INCOME_SHADING[source];
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/borrowing-power-calc.test.ts
```

Expected: All 14 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/borrowing-power-calc.ts src/lib/__tests__/borrowing-power-calc.test.ts
git commit -m "feat: add HEM lookup and income shading utilities"
```

---

### Task 3: Calculation Engine — PV Annuity, Assessment Rate, DTI

**Files:**
- Modify: `src/lib/borrowing-power-calc.ts`
- Modify: `src/lib/__tests__/borrowing-power-calc.test.ts`

**Step 1: Write failing tests**

Append to `src/lib/__tests__/borrowing-power-calc.test.ts`:

```typescript
import {
  getHemBenchmark,
  shadeIncome,
  getAssessmentRate,
  calculateMaxLoan,
  calculateDti,
  getDtiClassification,
  calculateBorrowingPower,
  type HouseholdType,
  type BorrowingPowerInputs,
  type BorrowingPowerResult,
} from "../borrowing-power-calc";

describe("getAssessmentRate", () => {
  it("uses product rate + 3% buffer when above floor", () => {
    expect(getAssessmentRate(6.0, 5.5)).toBe(9.0);
  });

  it("uses floor rate when product rate + buffer is below floor", () => {
    expect(getAssessmentRate(2.0, 5.5)).toBe(5.5);
  });

  it("uses product rate + buffer when equal to floor", () => {
    expect(getAssessmentRate(2.5, 5.5)).toBe(5.5);
  });
});

describe("calculateMaxLoan", () => {
  it("returns 0 when monthly surplus is 0", () => {
    expect(calculateMaxLoan(0, 6.0, 30)).toBe(0);
  });

  it("returns 0 when monthly surplus is negative", () => {
    expect(calculateMaxLoan(-500, 6.0, 30)).toBe(0);
  });

  it("calculates correct max loan for known values", () => {
    // $2000/mo surplus, 6% assessment rate, 30 years
    // PV = 2000 * ((1 - (1 + 0.005)^-360) / 0.005) ≈ $333,583
    const result = calculateMaxLoan(2000, 6.0, 30);
    expect(result).toBeGreaterThan(333000);
    expect(result).toBeLessThan(334000);
  });

  it("calculates correct max loan for shorter term", () => {
    // $2000/mo surplus, 6% rate, 15 years
    // PV = 2000 * ((1 - (1 + 0.005)^-180) / 0.005) ≈ $237,535
    const result = calculateMaxLoan(2000, 6.0, 15);
    expect(result).toBeGreaterThan(237000);
    expect(result).toBeLessThan(238000);
  });
});

describe("calculateDti", () => {
  it("calculates DTI ratio", () => {
    expect(calculateDti(600000, 100000)).toBeCloseTo(6.0);
  });

  it("returns 0 when no debt", () => {
    expect(calculateDti(0, 100000)).toBe(0);
  });

  it("returns Infinity when no income", () => {
    expect(calculateDti(500000, 0)).toBe(Infinity);
  });
});

describe("getDtiClassification", () => {
  it("returns green for DTI < 4", () => {
    expect(getDtiClassification(3.5)).toBe("green");
  });

  it("returns amber for DTI 4-6", () => {
    expect(getDtiClassification(4.0)).toBe("amber");
    expect(getDtiClassification(5.9)).toBe("amber");
  });

  it("returns red for DTI >= 6", () => {
    expect(getDtiClassification(6.0)).toBe("red");
    expect(getDtiClassification(8.0)).toBe("red");
  });
});

describe("calculateBorrowingPower", () => {
  const baseInputs: BorrowingPowerInputs = {
    grossSalary: 8000,
    rentalIncome: 3000,
    otherIncome: 0,
    householdType: "single",
    dependants: 0,
    livingExpenses: 2000,
    existingPropertyLoans: 1500,
    creditCardLimits: 10000,
    otherLoans: 0,
    hecsBalance: 0,
    targetRate: 6.2,
    loanTermYears: 30,
    floorRate: 5.5,
    existingDebt: 400000,
    grossAnnualIncome: 96000,
  };

  it("produces a positive borrowing power for typical inputs", () => {
    const result = calculateBorrowingPower(baseInputs);
    expect(result.maxLoan).toBeGreaterThan(0);
    expect(result.monthlySurplus).toBeGreaterThan(0);
    expect(result.assessmentRate).toBe(9.2);
  });

  it("uses HEM when declared expenses are below benchmark", () => {
    const inputs: BorrowingPowerInputs = {
      ...baseInputs,
      livingExpenses: 500, // well below HEM of 1400
    };
    const result = calculateBorrowingPower(inputs);
    expect(result.effectiveLivingExpenses).toBe(1400);
    expect(result.hemApplied).toBe(true);
  });

  it("uses declared expenses when above HEM", () => {
    const inputs: BorrowingPowerInputs = {
      ...baseInputs,
      livingExpenses: 3000, // above HEM of 1400
    };
    const result = calculateBorrowingPower(inputs);
    expect(result.effectiveLivingExpenses).toBe(3000);
    expect(result.hemApplied).toBe(false);
  });

  it("returns 0 max loan when expenses exceed income", () => {
    const inputs: BorrowingPowerInputs = {
      ...baseInputs,
      grossSalary: 2000,
      rentalIncome: 0,
      livingExpenses: 3000,
    };
    const result = calculateBorrowingPower(inputs);
    expect(result.maxLoan).toBe(0);
    expect(result.monthlySurplus).toBeLessThanOrEqual(0);
  });

  it("includes credit card commitments at 3.8% of limit", () => {
    const withCards: BorrowingPowerInputs = {
      ...baseInputs,
      creditCardLimits: 20000,
    };
    const withoutCards: BorrowingPowerInputs = {
      ...baseInputs,
      creditCardLimits: 0,
    };
    const resultWith = calculateBorrowingPower(withCards);
    const resultWithout = calculateBorrowingPower(withoutCards);
    expect(resultWithout.maxLoan).toBeGreaterThan(resultWith.maxLoan);
  });

  it("calculates DTI correctly", () => {
    const result = calculateBorrowingPower(baseInputs);
    const expectedDti = (baseInputs.existingDebt + result.maxLoan) / baseInputs.grossAnnualIncome;
    expect(result.dtiRatio).toBeCloseTo(expectedDti, 1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/borrowing-power-calc.test.ts
```

Expected: FAIL — functions not exported.

**Step 3: Implement calculation functions**

Append to `src/lib/borrowing-power-calc.ts`:

```typescript
export type DtiClassification = "green" | "amber" | "red";

const APRA_BUFFER = 3.0;
const CREDIT_CARD_COMMITMENT_RATE = 0.038; // 3.8% of limit per month

/** Returns the assessment rate: max(floor, productRate + APRA buffer). */
export function getAssessmentRate(
  productRate: number,
  floorRate: number
): number {
  return Math.max(floorRate, productRate + APRA_BUFFER);
}

/**
 * Calculates max loan using present value of an annuity formula.
 * PV = PMT × ((1 - (1 + r)^-n) / r)
 */
export function calculateMaxLoan(
  monthlySurplus: number,
  assessmentRatePercent: number,
  loanTermYears: number
): number {
  if (monthlySurplus <= 0) return 0;

  const r = assessmentRatePercent / 100 / 12;
  const n = loanTermYears * 12;
  const pv = monthlySurplus * ((1 - Math.pow(1 + r, -n)) / r);
  return Math.round(pv);
}

/** Returns total debt / gross annual income. */
export function calculateDti(
  totalDebt: number,
  grossAnnualIncome: number
): number {
  if (grossAnnualIncome === 0) return Infinity;
  return totalDebt / grossAnnualIncome;
}

/** Classifies DTI into traffic light categories. */
export function getDtiClassification(dti: number): DtiClassification {
  if (dti < 4) return "green";
  if (dti < 6) return "amber";
  return "red";
}

export interface BorrowingPowerInputs {
  grossSalary: number;
  rentalIncome: number;
  otherIncome: number;
  householdType: HouseholdType;
  dependants: number;
  livingExpenses: number;
  existingPropertyLoans: number;
  creditCardLimits: number;
  otherLoans: number;
  hecsBalance: number;
  targetRate: number;
  loanTermYears: number;
  floorRate: number;
  existingDebt: number;
  grossAnnualIncome: number;
}

export interface BorrowingPowerResult {
  shadedSalary: number;
  shadedRental: number;
  shadedOther: number;
  totalMonthlyIncome: number;
  hemBenchmark: number;
  effectiveLivingExpenses: number;
  hemApplied: boolean;
  creditCardCommitment: number;
  totalMonthlyCommitments: number;
  monthlySurplus: number;
  assessmentRate: number;
  maxLoan: number;
  monthlyRepayment: number;
  dtiRatio: number;
  dtiClassification: DtiClassification;
}

/** Full borrowing power calculation. */
export function calculateBorrowingPower(
  inputs: BorrowingPowerInputs
): BorrowingPowerResult {
  const shadedSalary = shadeIncome(inputs.grossSalary, "salary");
  const shadedRental = shadeIncome(inputs.rentalIncome, "rental");
  const shadedOther = shadeIncome(inputs.otherIncome, "other");
  const totalMonthlyIncome = shadedSalary + shadedRental + shadedOther;

  const hemBenchmark = getHemBenchmark(inputs.householdType, inputs.dependants);
  const effectiveLivingExpenses = Math.max(inputs.livingExpenses, hemBenchmark);
  const hemApplied = inputs.livingExpenses < hemBenchmark;

  const creditCardCommitment = inputs.creditCardLimits * CREDIT_CARD_COMMITMENT_RATE;
  const totalMonthlyCommitments =
    inputs.existingPropertyLoans +
    creditCardCommitment +
    inputs.otherLoans;

  const monthlySurplus =
    totalMonthlyIncome - effectiveLivingExpenses - totalMonthlyCommitments;

  const assessmentRate = getAssessmentRate(inputs.targetRate, inputs.floorRate);
  const maxLoan = calculateMaxLoan(
    monthlySurplus,
    assessmentRate,
    inputs.loanTermYears
  );

  // Monthly repayment at assessment rate for the max loan
  const r = assessmentRate / 100 / 12;
  const n = inputs.loanTermYears * 12;
  const monthlyRepayment =
    maxLoan > 0 ? maxLoan * (r / (1 - Math.pow(1 + r, -n))) : 0;

  const totalDebt = inputs.existingDebt + maxLoan;
  const dtiRatio = calculateDti(totalDebt, inputs.grossAnnualIncome);
  const dtiClassification = getDtiClassification(dtiRatio);

  return {
    shadedSalary,
    shadedRental,
    shadedOther,
    totalMonthlyIncome,
    hemBenchmark,
    effectiveLivingExpenses,
    hemApplied,
    creditCardCommitment,
    totalMonthlyCommitments,
    monthlySurplus,
    assessmentRate,
    maxLoan,
    monthlyRepayment: Math.round(monthlyRepayment),
    dtiRatio,
    dtiClassification,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/borrowing-power-calc.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/borrowing-power-calc.ts src/lib/__tests__/borrowing-power-calc.test.ts
git commit -m "feat: add APRA serviceability calculation engine"
```

---

### Task 4: Input Panel Component

**Files:**
- Create: `src/components/tools/BorrowingPowerInputs.tsx`

**Step 1: Create the input panel component**

This component receives current input values and an `onChange` callback. It renders collapsible sections for each input category.

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { getHemBenchmark, type HouseholdType, type BorrowingPowerInputs as CalcInputs } from "@/lib/borrowing-power-calc";

interface BorrowingPowerInputPanelProps {
  inputs: CalcInputs;
  onChange: (updates: Partial<CalcInputs>) => void;
  preFilledFields: Set<string>;
}

function NumberInput({
  label,
  value,
  onChange,
  prefix = "$",
  suffix,
  hint,
  preFilled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  preFilled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">
        {label}
        {preFilled && (
          <span className="text-xs text-muted-foreground ml-1">(from portfolio)</span>
        )}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => {
            const num = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
            onChange(isNaN(num) ? 0 : num);
          }}
          className={cn("tabular-nums", prefix && "pl-7", suffix && "pr-12")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-4 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 text-sm font-medium cursor-pointer"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="space-y-3 mt-2">{children}</div>}
    </div>
  );
}

export function BorrowingPowerInputPanel({
  inputs,
  onChange,
  preFilledFields,
}: BorrowingPowerInputPanelProps) {
  const hemBenchmark = getHemBenchmark(inputs.householdType, inputs.dependants);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section title="Income">
          <NumberInput
            label="Monthly gross salary"
            value={inputs.grossSalary}
            onChange={(v) => onChange({ grossSalary: v })}
          />
          <NumberInput
            label="Monthly rental income"
            value={inputs.rentalIncome}
            onChange={(v) => onChange({ rentalIncome: v })}
            preFilled={preFilledFields.has("rentalIncome")}
            hint="Shaded at 80% for assessment"
          />
          <NumberInput
            label="Other monthly income"
            value={inputs.otherIncome}
            onChange={(v) => onChange({ otherIncome: v })}
            hint="Dividends, business, etc. Shaded at 80%"
          />
        </Section>

        <Section title="Household">
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <Select
              value={inputs.householdType}
              onValueChange={(v) => onChange({ householdType: v as HouseholdType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="couple">Couple</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Dependants</label>
            <Select
              value={String(inputs.dependants)}
              onValueChange={(v) => onChange({ dependants: parseInt(v, 10) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Living Expenses">
          <NumberInput
            label="Monthly living expenses"
            value={inputs.livingExpenses}
            onChange={(v) => onChange({ livingExpenses: v })}
          />
          <div className={cn(
            "text-xs p-2 rounded-md",
            inputs.livingExpenses < hemBenchmark
              ? "bg-warning/10 text-warning"
              : "bg-muted text-muted-foreground"
          )}>
            HEM benchmark: {formatCurrency(hemBenchmark)}/mo.
            {inputs.livingExpenses < hemBenchmark
              ? " Banks will use HEM (higher) for assessment."
              : " Your declared expenses will be used."}
          </div>
        </Section>

        <Section title="Existing Commitments">
          <NumberInput
            label="Monthly property loan repayments"
            value={inputs.existingPropertyLoans}
            onChange={(v) => onChange({ existingPropertyLoans: v })}
            preFilled={preFilledFields.has("existingPropertyLoans")}
          />
          <NumberInput
            label="Total credit card limits"
            value={inputs.creditCardLimits}
            onChange={(v) => onChange({ creditCardLimits: v })}
            hint={`Banks use 3.8% of limit as commitment (${formatCurrency(inputs.creditCardLimits * 0.038)}/mo)`}
          />
          <NumberInput
            label="Other monthly loan repayments"
            value={inputs.otherLoans}
            onChange={(v) => onChange({ otherLoans: v })}
            hint="Car, personal loans, etc."
          />
          <NumberInput
            label="HECS/HELP balance"
            value={inputs.hecsBalance}
            onChange={(v) => onChange({ hecsBalance: v })}
            hint="Repayment calculated from income thresholds"
          />
        </Section>

        <Section title="Loan Settings" defaultOpen={false}>
          <NumberInput
            label="Target interest rate"
            value={inputs.targetRate}
            onChange={(v) => onChange({ targetRate: v })}
            prefix=""
            suffix="%"
          />
          <NumberInput
            label="Loan term"
            value={inputs.loanTermYears}
            onChange={(v) => onChange({ loanTermYears: v })}
            prefix=""
            suffix="years"
          />
          <NumberInput
            label="Floor rate"
            value={inputs.floorRate}
            onChange={(v) => onChange({ floorRate: v })}
            prefix=""
            suffix="%"
          />
        </Section>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/BorrowingPowerInputs.tsx
git commit -m "feat: add borrowing power input panel component"
```

---

### Task 5: Result Panel Component

**Files:**
- Create: `src/components/tools/BorrowingPowerResult.tsx`

**Step 1: Create the result panel component**

This component receives the `BorrowingPowerResult` and displays the headline, breakdown, and DTI traffic light.

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { BorrowingPowerResult } from "@/lib/borrowing-power-calc";

interface BorrowingPowerResultPanelProps {
  result: BorrowingPowerResult;
}

function getDtiColor(classification: string): string {
  if (classification === "green") return "text-success";
  if (classification === "amber") return "text-warning";
  return "text-destructive";
}

function getDtiBadgeVariant(classification: string) {
  if (classification === "green") return "default" as const;
  if (classification === "amber") return "warning" as const;
  return "destructive" as const;
}

export function BorrowingPowerResultPanel({
  result,
}: BorrowingPowerResultPanelProps) {
  const incomeTotal = result.totalMonthlyIncome;
  const expenseTotal = result.effectiveLivingExpenses + result.totalMonthlyCommitments;
  const repayment = result.monthlyRepayment;
  const total = incomeTotal;

  // Bar widths as percentages of income
  const expensePct = total > 0 ? (expenseTotal / total) * 100 : 0;
  const repaymentPct = total > 0 ? (repayment / total) * 100 : 0;
  const surplusPct = Math.max(0, 100 - expensePct - repaymentPct);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Headline */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Estimated Borrowing Power</p>
          <p className={cn(
            "text-4xl font-bold tabular-nums mt-1",
            result.maxLoan > 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(result.maxLoan)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            at {result.assessmentRate.toFixed(1)}% assessment rate
          </p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Monthly Repayment</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(result.monthlyRepayment)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Monthly Surplus</p>
            <p className={cn(
              "text-lg font-semibold tabular-nums",
              result.monthlySurplus > 0 ? "text-success" : "text-destructive"
            )}>
              {formatCurrency(Math.round(result.monthlySurplus))}
            </p>
          </div>
        </div>

        {/* DTI */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-xs text-muted-foreground">Debt-to-Income Ratio</p>
            <p className={cn("text-lg font-semibold tabular-nums", getDtiColor(result.dtiClassification))}>
              {isFinite(result.dtiRatio) ? result.dtiRatio.toFixed(1) : "--"}x
            </p>
          </div>
          <Badge variant={getDtiBadgeVariant(result.dtiClassification)}>
            {result.dtiClassification === "green" && "Healthy"}
            {result.dtiClassification === "amber" && "Elevated"}
            {result.dtiClassification === "red" && "High"}
          </Badge>
        </div>

        {result.dtiClassification === "red" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              APRA limits lending at DTI &ge; 6.0. Most lenders will restrict borrowing at this level.
            </span>
          </div>
        )}

        {/* Income breakdown bar */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Monthly Income Allocation</p>
          <div className="flex h-4 rounded-full overflow-hidden">
            <div
              className="bg-destructive/70"
              style={{ width: `${expensePct}%` }}
              title={`Expenses: ${formatCurrency(expenseTotal)}`}
            />
            <div
              className="bg-warning/70"
              style={{ width: `${repaymentPct}%` }}
              title={`New repayment: ${formatCurrency(repayment)}`}
            />
            <div
              className="bg-success/70"
              style={{ width: `${surplusPct}%` }}
              title={`Surplus: ${formatCurrency(Math.round(result.monthlySurplus))}`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Expenses</span>
            <span>Repayment</span>
            <span>Surplus</span>
          </div>
        </div>

        {/* Calculation details */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Shaded income (salary)</span>
            <span className="tabular-nums">{formatCurrency(result.shadedSalary)}/mo</span>
          </div>
          <div className="flex justify-between">
            <span>Shaded income (rental @ 80%)</span>
            <span className="tabular-nums">{formatCurrency(result.shadedRental)}/mo</span>
          </div>
          {result.shadedOther > 0 && (
            <div className="flex justify-between">
              <span>Shaded income (other @ 80%)</span>
              <span className="tabular-nums">{formatCurrency(result.shadedOther)}/mo</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 mt-1">
            <span>Living expenses {result.hemApplied ? "(HEM applied)" : ""}</span>
            <span className="tabular-nums">{formatCurrency(result.effectiveLivingExpenses)}/mo</span>
          </div>
          <div className="flex justify-between">
            <span>Existing commitments</span>
            <span className="tabular-nums">{formatCurrency(Math.round(result.totalMonthlyCommitments))}/mo</span>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground leading-tight border-t border-border pt-3">
          Estimate only. Does not account for lender-specific policies, credit history, or employment status.
          Consult a qualified mortgage broker for personalised advice.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/BorrowingPowerResult.tsx
git commit -m "feat: add borrowing power result panel component"
```

---

### Task 6: Scenario Comparison Component

**Files:**
- Create: `src/components/tools/BorrowingPowerScenarios.tsx`

**Step 1: Create the scenario comparison component**

This component manages up to 3 scenarios and displays them side by side.

```tsx
"use client";

import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { BorrowingPowerInputs, BorrowingPowerResult } from "@/lib/borrowing-power-calc";
import { calculateBorrowingPower } from "@/lib/borrowing-power-calc";

interface Scenario {
  id: string;
  label: string;
  inputs: BorrowingPowerInputs;
  result: BorrowingPowerResult;
}

interface BorrowingPowerScenariosProps {
  baseInputs: BorrowingPowerInputs;
  baseResult: BorrowingPowerResult;
  scenarios: Scenario[];
  onAddScenario: () => void;
  onRemoveScenario: (id: string) => void;
  onUpdateScenarioLabel: (id: string, label: string) => void;
}

function formatDiff(current: number, base: number): React.ReactNode {
  const diff = current - base;
  if (Math.abs(diff) < 1) return null;
  const sign = diff > 0 ? "+" : "";
  return (
    <span className={cn("text-xs", diff > 0 ? "text-success" : "text-destructive")}>
      {sign}{formatCurrency(diff)}
    </span>
  );
}

export function BorrowingPowerScenarios({
  baseResult,
  scenarios,
  onAddScenario,
  onRemoveScenario,
  onUpdateScenarioLabel,
}: BorrowingPowerScenariosProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Compare Scenarios</CardTitle>
        {scenarios.length < 3 && (
          <Button variant="outline" size="sm" onClick={onAddScenario}>
            <Plus className="w-4 h-4 mr-1" />
            Add Scenario
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Add a scenario to compare different interest rates, income levels, or loan terms side by side.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Metric</th>
                  <th className="text-right py-2 px-4 font-medium">Current</th>
                  {scenarios.map((s) => (
                    <th key={s.id} className="text-right py-2 px-4 font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={s.label}
                          onChange={(e) => onUpdateScenarioLabel(s.id, e.target.value)}
                          className="text-right bg-transparent border-none outline-none w-24 text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveScenario(s.id)}
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Borrowing Power</td>
                  <td className="text-right py-2 px-4 tabular-nums font-semibold">
                    {formatCurrency(baseResult.maxLoan)}
                  </td>
                  {scenarios.map((s) => (
                    <td key={s.id} className="text-right py-2 px-4 tabular-nums">
                      <div>
                        <span className="font-semibold">{formatCurrency(s.result.maxLoan)}</span>
                        <div>{formatDiff(s.result.maxLoan, baseResult.maxLoan)}</div>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Monthly Repayment</td>
                  <td className="text-right py-2 px-4 tabular-nums">
                    {formatCurrency(baseResult.monthlyRepayment)}
                  </td>
                  {scenarios.map((s) => (
                    <td key={s.id} className="text-right py-2 px-4 tabular-nums">
                      <div>
                        <span>{formatCurrency(s.result.monthlyRepayment)}</span>
                        <div>{formatDiff(s.result.monthlyRepayment, baseResult.monthlyRepayment)}</div>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Monthly Surplus</td>
                  <td className="text-right py-2 px-4 tabular-nums">
                    {formatCurrency(Math.round(baseResult.monthlySurplus))}
                  </td>
                  {scenarios.map((s) => (
                    <td key={s.id} className="text-right py-2 px-4 tabular-nums">
                      <div>
                        <span>{formatCurrency(Math.round(s.result.monthlySurplus))}</span>
                        <div>{formatDiff(Math.round(s.result.monthlySurplus), Math.round(baseResult.monthlySurplus))}</div>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">DTI Ratio</td>
                  <td className="text-right py-2 px-4">
                    <Badge variant={baseResult.dtiClassification === "green" ? "default" : baseResult.dtiClassification === "amber" ? "warning" : "destructive"}>
                      {isFinite(baseResult.dtiRatio) ? `${baseResult.dtiRatio.toFixed(1)}x` : "--"}
                    </Badge>
                  </td>
                  {scenarios.map((s) => (
                    <td key={s.id} className="text-right py-2 px-4">
                      <Badge variant={s.result.dtiClassification === "green" ? "default" : s.result.dtiClassification === "amber" ? "warning" : "destructive"}>
                        {isFinite(s.result.dtiRatio) ? `${s.result.dtiRatio.toFixed(1)}x` : "--"}
                      </Badge>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tools/BorrowingPowerScenarios.tsx
git commit -m "feat: add borrowing power scenario comparison component"
```

---

### Task 7: Page Component + Sidebar Navigation

**Files:**
- Create: `src/app/(dashboard)/tools/borrowing-power/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Create the page component**

The page orchestrates all three panels, manages state, and pre-fills from portfolio data.

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { Calculator, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { calculateBorrowingPower, type BorrowingPowerInputs } from "@/lib/borrowing-power-calc";
import { BorrowingPowerInputPanel } from "@/components/tools/BorrowingPowerInputs";
import { BorrowingPowerResultPanel } from "@/components/tools/BorrowingPowerResult";
import { BorrowingPowerScenarios } from "@/components/tools/BorrowingPowerScenarios";
import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_INPUTS: BorrowingPowerInputs = {
  grossSalary: 0,
  rentalIncome: 0,
  otherIncome: 0,
  householdType: "single",
  dependants: 0,
  livingExpenses: 0,
  existingPropertyLoans: 0,
  creditCardLimits: 0,
  otherLoans: 0,
  hecsBalance: 0,
  targetRate: 6.2,
  loanTermYears: 30,
  floorRate: 5.5,
  existingDebt: 0,
  grossAnnualIncome: 0,
};

interface Scenario {
  id: string;
  label: string;
  inputs: BorrowingPowerInputs;
  result: ReturnType<typeof calculateBorrowingPower>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[600px] bg-muted animate-pulse rounded-lg" />
        <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  );
}

export default function BorrowingPowerPage() {
  const { data: portfolioData, isLoading } = trpc.portfolio.getBorrowingPower.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  const preFilledFields = useMemo(() => {
    const fields = new Set<string>();
    if (portfolioData?.hasLoans) {
      fields.add("rentalIncome");
      fields.add("existingPropertyLoans");
    }
    return fields;
  }, [portfolioData]);

  const initialInputs = useMemo((): BorrowingPowerInputs => {
    if (!portfolioData?.hasLoans) return DEFAULT_INPUTS;
    return {
      ...DEFAULT_INPUTS,
      rentalIncome: Math.round(portfolioData.annualRentalIncome / 12),
      existingPropertyLoans: Math.round(portfolioData.annualRepayments / 12),
      existingDebt: portfolioData.totalDebt,
      targetRate: portfolioData.weightedAvgRate || 6.2,
    };
  }, [portfolioData]);

  const [inputs, setInputs] = useState<BorrowingPowerInputs>(DEFAULT_INPUTS);
  const [initialized, setInitialized] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioCounter, setScenarioCounter] = useState(0);

  // Initialize inputs from portfolio data once loaded
  if (!initialized && !isLoading) {
    setInputs(initialInputs);
    setInitialized(true);
  }

  const handleChange = useCallback((updates: Partial<BorrowingPowerInputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...updates };
      // Keep grossAnnualIncome in sync
      if ("grossSalary" in updates) {
        next.grossAnnualIncome = next.grossSalary * 12;
      }
      return next;
    });
  }, []);

  const result = useMemo(() => calculateBorrowingPower(inputs), [inputs]);

  const handleAddScenario = useCallback(() => {
    const num = scenarioCounter + 1;
    setScenarioCounter(num);
    const scenarioInputs = { ...inputs, targetRate: inputs.targetRate + 1 };
    setScenarios((prev) => [
      ...prev,
      {
        id: `scenario-${num}`,
        label: `Scenario ${num}`,
        inputs: scenarioInputs,
        result: calculateBorrowingPower(scenarioInputs),
      },
    ]);
  }, [inputs, scenarioCounter]);

  const handleRemoveScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleUpdateScenarioLabel = useCallback((id: string, label: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label } : s))
    );
  }, []);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Borrowing Power Estimator</h1>
        <p className="text-muted-foreground">
          Estimate how much you could borrow based on APRA serviceability guidelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BorrowingPowerInputPanel
          inputs={inputs}
          onChange={handleChange}
          preFilledFields={preFilledFields}
        />
        <div className="space-y-6">
          <BorrowingPowerResultPanel result={result} />
        </div>
      </div>

      <BorrowingPowerScenarios
        baseInputs={inputs}
        baseResult={result}
        scenarios={scenarios}
        onAddScenario={handleAddScenario}
        onRemoveScenario={handleRemoveScenario}
        onUpdateScenarioLabel={handleUpdateScenarioLabel}
      />
    </div>
  );
}
```

**Step 2: Add Tools section to sidebar**

In `src/components/layout/Sidebar.tsx`, add `Wrench` to the lucide-react imports:

```typescript
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  BarChart3,
  Landmark,
  Wallet,
  TrendingUp,
  Sparkles,
  Briefcase,
  Calculator,
  Compass,
  PieChart,
  Receipt,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  Award,
  FileOutput,
  Wrench,
} from "lucide-react";
```

Add a new "Tools" group after the "Personal Finance" group in `navGroups`:

```typescript
  {
    label: "Tools",
    items: [
      { href: "/tools/borrowing-power", label: "Borrowing Power", icon: Calculator, featureFlag: "borrowingPowerEstimator" },
    ],
  },
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/tools/borrowing-power/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add borrowing power page and tools nav section"
```

---

### Task 8: Final Verification

**Files:** None (verification only)

**Step 1: Run the calculation tests**

```bash
npx vitest run src/lib/__tests__/borrowing-power-calc.test.ts
```

Expected: All tests PASS.

**Step 2: TypeScript check on changed files**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -E "(borrowing-power|BorrowingPower|feature-flags)" || echo "No TS errors in our files"
```

Expected: No errors in our files.

**Step 3: Verify file count**

Expected files created/modified:
- `src/config/feature-flags.ts` (modified)
- `src/lib/borrowing-power-calc.ts` (created)
- `src/lib/__tests__/borrowing-power-calc.test.ts` (created)
- `src/components/tools/BorrowingPowerInputs.tsx` (created)
- `src/components/tools/BorrowingPowerResult.tsx` (created)
- `src/components/tools/BorrowingPowerScenarios.tsx` (created)
- `src/app/(dashboard)/tools/borrowing-power/page.tsx` (created)
- `src/components/layout/Sidebar.tsx` (modified)

---

## Tech Notes

- **APRA buffer:** 3 percentage points above product rate (confirmed Feb 2026)
- **DTI limit:** APRA activated DTI >= 6 cap from Feb 2026 (20% of new lending)
- **HEM:** Approximate values from Melbourne Institute, hardcoded as constants
- **PV annuity formula:** Standard financial math, `PV = PMT × ((1 - (1+r)^-n) / r)`
- **Credit card commitment:** 3.8% of total limit per month (industry standard)
- **Income shading:** 100% salary, 80% rental/other (standard bank practice)
- **No new backend:** Reuses existing `portfolio.getBorrowingPower` tRPC query
- **React patterns:** `useState` for inputs, `useMemo` for calculation results, `useCallback` for handlers
