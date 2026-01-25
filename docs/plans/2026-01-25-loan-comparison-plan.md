# Loan Comparison & Refinancing Alerts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a loan comparison system with RBA rate tracking, savings calculators, and refinancing alerts.

**Architecture:** Three new database tables (rateHistory, loanComparisons, refinanceAlerts), two new services (rate-data, loan-comparison), one new router (loanComparison), two cron jobs, and three new pages with supporting components. Integrates with existing notification system.

**Tech Stack:** Next.js 14, tRPC, Drizzle ORM, PostgreSQL, Vitest, React, TailwindCSS, Resend (email)

---

## Task 1: Add Database Schema - Enums and Tables

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Write the failing test**

Create file `src/server/db/__tests__/loan-comparison-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  rateHistory,
  loanComparisons,
  refinanceAlerts,
  loanPurposeEnum,
} from "../schema";

describe("loan comparison schema", () => {
  it("exports rateHistory table", () => {
    expect(rateHistory).toBeDefined();
    expect(rateHistory.id).toBeDefined();
    expect(rateHistory.rateDate).toBeDefined();
    expect(rateHistory.cashRate).toBeDefined();
  });

  it("exports loanComparisons table", () => {
    expect(loanComparisons).toBeDefined();
    expect(loanComparisons.id).toBeDefined();
    expect(loanComparisons.loanId).toBeDefined();
    expect(loanComparisons.newRate).toBeDefined();
    expect(loanComparisons.switchingCosts).toBeDefined();
  });

  it("exports refinanceAlerts table", () => {
    expect(refinanceAlerts).toBeDefined();
    expect(refinanceAlerts.id).toBeDefined();
    expect(refinanceAlerts.loanId).toBeDefined();
    expect(refinanceAlerts.enabled).toBeDefined();
    expect(refinanceAlerts.rateGapThreshold).toBeDefined();
    expect(refinanceAlerts.notifyOnCashRateChange).toBeDefined();
  });

  it("exports loanPurposeEnum", () => {
    expect(loanPurposeEnum).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/db/__tests__/loan-comparison-schema.test.ts`

Expected: FAIL with "rateHistory is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts` after the existing enums (around line 198):

```typescript
export const loanPurposeEnum = pgEnum("loan_purpose", [
  "owner_occupied",
  "investor",
]);
```

Add after existing tables (at end of file, before relations):

```typescript
// Loan Comparison Tables
export const rateHistory = pgTable("rate_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  rateDate: date("rate_date").notNull(),
  cashRate: decimal("cash_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loanComparisons = pgTable(
  "loan_comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    loanId: uuid("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    newRate: decimal("new_rate", { precision: 5, scale: 3 }).notNull(),
    newLender: text("new_lender"),
    switchingCosts: decimal("switching_costs", { precision: 10, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("loan_comparisons_user_id_idx").on(table.userId),
    index("loan_comparisons_loan_id_idx").on(table.loanId),
  ]
);

export const refinanceAlerts = pgTable(
  "refinance_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    enabled: boolean("enabled").default(true).notNull(),
    rateGapThreshold: decimal("rate_gap_threshold", { precision: 3, scale: 2 }).default("0.50").notNull(),
    notifyOnCashRateChange: boolean("notify_on_cash_rate_change").default(true).notNull(),
    lastAlertedAt: timestamp("last_alerted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("refinance_alerts_loan_id_idx").on(table.loanId)]
);
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/db/__tests__/loan-comparison-schema.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/loan-comparison-schema.test.ts
git commit -m "feat(db): add loan comparison schema tables"
```

---

## Task 2: Add Database Relations

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Write the failing test**

Add to `src/server/db/__tests__/loan-comparison-schema.test.ts`:

```typescript
import {
  rateHistory,
  loanComparisons,
  refinanceAlerts,
  loanPurposeEnum,
  loanComparisonsRelations,
  refinanceAlertsRelations,
} from "../schema";

// Add new test
it("exports loanComparisonsRelations", () => {
  expect(loanComparisonsRelations).toBeDefined();
});

it("exports refinanceAlertsRelations", () => {
  expect(refinanceAlertsRelations).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/db/__tests__/loan-comparison-schema.test.ts`

Expected: FAIL with "loanComparisonsRelations is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts` after the new tables:

```typescript
export const loanComparisonsRelations = relations(loanComparisons, ({ one }) => ({
  user: one(users, {
    fields: [loanComparisons.userId],
    references: [users.id],
  }),
  loan: one(loans, {
    fields: [loanComparisons.loanId],
    references: [loans.id],
  }),
}));

export const refinanceAlertsRelations = relations(refinanceAlerts, ({ one }) => ({
  loan: one(loans, {
    fields: [refinanceAlerts.loanId],
    references: [loans.id],
  }),
}));
```

Also add to the existing `loansRelations` (find it and add these fields):

```typescript
comparisons: many(loanComparisons),
refinanceAlert: one(refinanceAlerts),
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/db/__tests__/loan-comparison-schema.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/loan-comparison-schema.test.ts
git commit -m "feat(db): add loan comparison relations"
```

---

## Task 3: Add Notification Types for Refinancing

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/services/notification.ts`

**Step 1: Write the failing test**

Create file `src/server/services/__tests__/notification-refinance.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NotificationType } from "../notification";

describe("notification refinance types", () => {
  it("includes refinance_opportunity type", () => {
    const type: NotificationType = "refinance_opportunity";
    expect(type).toBe("refinance_opportunity");
  });

  it("includes cash_rate_changed type", () => {
    const type: NotificationType = "cash_rate_changed";
    expect(type).toBe("cash_rate_changed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/notification-refinance.test.ts`

Expected: FAIL with type error

**Step 3: Write minimal implementation**

In `src/server/db/schema.ts`, find `notificationTypeEnum` and add the new values:

```typescript
export const notificationTypeEnum = pgEnum("notification_type", [
  "rent_received",
  "sync_failed",
  "anomaly_critical",
  "anomaly_warning",
  "weekly_digest",
  "eofy_suggestions",
  "refinance_opportunity",
  "cash_rate_changed",
]);
```

In `src/server/services/notification.ts`, update the `NotificationType` union:

```typescript
export type NotificationType =
  | "rent_received"
  | "sync_failed"
  | "anomaly_critical"
  | "anomaly_warning"
  | "weekly_digest"
  | "eofy_suggestions"
  | "refinance_opportunity"
  | "cash_rate_changed";
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/notification-refinance.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/services/notification.ts src/server/services/__tests__/notification-refinance.test.ts
git commit -m "feat(notification): add refinance notification types"
```

---

## Task 4: Create Rate Data Service - Margin Lookup

**Files:**
- Create: `src/server/services/rate-data.ts`
- Create: `src/server/services/__tests__/rate-data.test.ts`

**Step 1: Write the failing test**

Create file `src/server/services/__tests__/rate-data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getMargin, LoanPurpose, RepaymentType } from "../rate-data";

describe("rate-data service", () => {
  describe("getMargin", () => {
    it("returns 2.00 for owner occupied P&I with LVR <= 80%", () => {
      const margin = getMargin("owner_occupied", "principal_and_interest", 80);
      expect(margin).toBe(2.0);
    });

    it("returns 2.30 for owner occupied P&I with LVR > 80%", () => {
      const margin = getMargin("owner_occupied", "principal_and_interest", 85);
      expect(margin).toBe(2.3);
    });

    it("returns 2.40 for owner occupied IO with LVR <= 80%", () => {
      const margin = getMargin("owner_occupied", "interest_only", 70);
      expect(margin).toBe(2.4);
    });

    it("returns 2.70 for owner occupied IO with LVR > 80%", () => {
      const margin = getMargin("owner_occupied", "interest_only", 90);
      expect(margin).toBe(2.7);
    });

    it("returns 2.30 for investor P&I with LVR <= 80%", () => {
      const margin = getMargin("investor", "principal_and_interest", 75);
      expect(margin).toBe(2.3);
    });

    it("returns 2.60 for investor P&I with LVR > 80%", () => {
      const margin = getMargin("investor", "principal_and_interest", 85);
      expect(margin).toBe(2.6);
    });

    it("returns 2.60 for investor IO with LVR <= 80%", () => {
      const margin = getMargin("investor", "interest_only", 80);
      expect(margin).toBe(2.6);
    });

    it("returns 2.90 for investor IO with LVR > 80%", () => {
      const margin = getMargin("investor", "interest_only", 95);
      expect(margin).toBe(2.9);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/rate-data.test.ts`

Expected: FAIL with "Cannot find module '../rate-data'"

**Step 3: Write minimal implementation**

Create file `src/server/services/rate-data.ts`:

```typescript
export type LoanPurpose = "owner_occupied" | "investor";
export type RepaymentType = "principal_and_interest" | "interest_only";

interface MarginTable {
  [purpose: string]: {
    [repaymentType: string]: {
      lowLvr: number;
      highLvr: number;
    };
  };
}

const MARGIN_TABLE: MarginTable = {
  owner_occupied: {
    principal_and_interest: { lowLvr: 2.0, highLvr: 2.3 },
    interest_only: { lowLvr: 2.4, highLvr: 2.7 },
  },
  investor: {
    principal_and_interest: { lowLvr: 2.3, highLvr: 2.6 },
    interest_only: { lowLvr: 2.6, highLvr: 2.9 },
  },
};

const LVR_THRESHOLD = 80;

export function getMargin(
  purpose: LoanPurpose,
  repaymentType: RepaymentType,
  lvr: number
): number {
  const rates = MARGIN_TABLE[purpose][repaymentType];
  return lvr <= LVR_THRESHOLD ? rates.lowLvr : rates.highLvr;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/rate-data.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/rate-data.ts src/server/services/__tests__/rate-data.test.ts
git commit -m "feat(rate-data): add margin lookup for loan types"
```

---

## Task 5: Rate Data Service - RBA Rate Functions

**Files:**
- Modify: `src/server/services/rate-data.ts`
- Modify: `src/server/services/__tests__/rate-data.test.ts`

**Step 1: Write the failing test**

Add to `src/server/services/__tests__/rate-data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMargin,
  getEstimatedMarketRate,
  getLatestCashRate,
  LoanPurpose,
  RepaymentType
} from "../rate-data";
import { db } from "@/server/db";

vi.mock("@/server/db", () => ({
  db: {
    query: {
      rateHistory: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("getLatestCashRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest cash rate from database", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue({
      id: "123",
      rateDate: "2026-01-20",
      cashRate: "4.35",
      createdAt: new Date(),
    });

    const rate = await getLatestCashRate();
    expect(rate).toBe(4.35);
  });

  it("returns null when no rates exist", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue(null);

    const rate = await getLatestCashRate();
    expect(rate).toBeNull();
  });
});

describe("getEstimatedMarketRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cash rate plus margin", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue({
      id: "123",
      rateDate: "2026-01-20",
      cashRate: "4.35",
      createdAt: new Date(),
    });

    const rate = await getEstimatedMarketRate("owner_occupied", "principal_and_interest", 75);
    expect(rate).toBe(6.35); // 4.35 + 2.0
  });

  it("returns null when no cash rate available", async () => {
    vi.mocked(db.query.rateHistory.findFirst).mockResolvedValue(null);

    const rate = await getEstimatedMarketRate("owner_occupied", "principal_and_interest", 75);
    expect(rate).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/rate-data.test.ts`

Expected: FAIL with "getLatestCashRate is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/rate-data.ts`:

```typescript
import { db } from "@/server/db";
import { rateHistory } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export async function getLatestCashRate(): Promise<number | null> {
  const latest = await db.query.rateHistory.findFirst({
    orderBy: [desc(rateHistory.rateDate)],
  });

  if (!latest) return null;
  return parseFloat(latest.cashRate);
}

export async function getEstimatedMarketRate(
  purpose: LoanPurpose,
  repaymentType: RepaymentType,
  lvr: number
): Promise<number | null> {
  const cashRate = await getLatestCashRate();
  if (cashRate === null) return null;

  const margin = getMargin(purpose, repaymentType, lvr);
  return cashRate + margin;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/rate-data.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/rate-data.ts src/server/services/__tests__/rate-data.test.ts
git commit -m "feat(rate-data): add cash rate lookup and market rate estimation"
```

---

## Task 6: Loan Comparison Service - Monthly Payment Calculation

**Files:**
- Create: `src/server/services/loan-comparison.ts`
- Create: `src/server/services/__tests__/loan-comparison.test.ts`

**Step 1: Write the failing test**

Create file `src/server/services/__tests__/loan-comparison.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateMonthlyPayment } from "../loan-comparison";

describe("loan-comparison service", () => {
  describe("calculateMonthlyPayment", () => {
    it("calculates monthly payment for P&I loan", () => {
      // $500,000 at 6% over 30 years = $2,997.75/month
      const payment = calculateMonthlyPayment(500000, 6, 360);
      expect(payment).toBeCloseTo(2997.75, 0);
    });

    it("calculates monthly payment for smaller loan", () => {
      // $300,000 at 5% over 25 years = $1,753.77/month
      const payment = calculateMonthlyPayment(300000, 5, 300);
      expect(payment).toBeCloseTo(1753.77, 0);
    });

    it("returns 0 for zero principal", () => {
      const payment = calculateMonthlyPayment(0, 6, 360);
      expect(payment).toBe(0);
    });

    it("returns principal/months for zero rate", () => {
      const payment = calculateMonthlyPayment(120000, 0, 120);
      expect(payment).toBe(1000);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: FAIL with "Cannot find module '../loan-comparison'"

**Step 3: Write minimal implementation**

Create file `src/server/services/loan-comparison.ts`:

```typescript
/**
 * Calculate monthly payment for a P&I loan using standard amortization formula
 * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): number {
  if (principal === 0) return 0;
  if (annualRatePercent === 0) return principal / termMonths;

  const monthlyRate = annualRatePercent / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);

  return principal * (monthlyRate * factor) / (factor - 1);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/loan-comparison.ts src/server/services/__tests__/loan-comparison.test.ts
git commit -m "feat(loan-comparison): add monthly payment calculation"
```

---

## Task 7: Loan Comparison Service - Savings Calculations

**Files:**
- Modify: `src/server/services/loan-comparison.ts`
- Modify: `src/server/services/__tests__/loan-comparison.test.ts`

**Step 1: Write the failing test**

Add to `src/server/services/__tests__/loan-comparison.test.ts`:

```typescript
import {
  calculateMonthlyPayment,
  calculateMonthlySavings,
  calculateTotalInterestSaved,
} from "../loan-comparison";

describe("calculateMonthlySavings", () => {
  it("calculates positive savings when new rate is lower", () => {
    // $500,000, 360 months remaining
    // Current: 6% = $2,997.75
    // New: 5.5% = $2,838.95
    // Savings = $158.80
    const savings = calculateMonthlySavings(500000, 6, 5.5, 360);
    expect(savings).toBeCloseTo(158.80, 0);
  });

  it("returns negative when new rate is higher", () => {
    const savings = calculateMonthlySavings(500000, 5, 6, 360);
    expect(savings).toBeLessThan(0);
  });

  it("returns 0 when rates are equal", () => {
    const savings = calculateMonthlySavings(500000, 5.5, 5.5, 360);
    expect(savings).toBe(0);
  });
});

describe("calculateTotalInterestSaved", () => {
  it("calculates total interest saved over remaining term", () => {
    // Monthly savings of ~$158.80 over 360 months = ~$57,168
    const saved = calculateTotalInterestSaved(500000, 6, 5.5, 360);
    expect(saved).toBeCloseTo(57168, -2); // Within 100
  });

  it("returns 0 when rates are equal", () => {
    const saved = calculateTotalInterestSaved(500000, 5.5, 5.5, 360);
    expect(saved).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: FAIL with "calculateMonthlySavings is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/loan-comparison.ts`:

```typescript
export function calculateMonthlySavings(
  principal: number,
  currentRatePercent: number,
  newRatePercent: number,
  remainingMonths: number
): number {
  const currentPayment = calculateMonthlyPayment(principal, currentRatePercent, remainingMonths);
  const newPayment = calculateMonthlyPayment(principal, newRatePercent, remainingMonths);

  return currentPayment - newPayment;
}

export function calculateTotalInterestSaved(
  principal: number,
  currentRatePercent: number,
  newRatePercent: number,
  remainingMonths: number
): number {
  const monthlySavings = calculateMonthlySavings(
    principal,
    currentRatePercent,
    newRatePercent,
    remainingMonths
  );

  return monthlySavings * remainingMonths;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/loan-comparison.ts src/server/services/__tests__/loan-comparison.test.ts
git commit -m "feat(loan-comparison): add savings calculations"
```

---

## Task 8: Loan Comparison Service - Break-even Calculation

**Files:**
- Modify: `src/server/services/loan-comparison.ts`
- Modify: `src/server/services/__tests__/loan-comparison.test.ts`

**Step 1: Write the failing test**

Add to `src/server/services/__tests__/loan-comparison.test.ts`:

```typescript
import {
  calculateMonthlyPayment,
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
} from "../loan-comparison";

describe("calculateBreakEvenMonths", () => {
  it("calculates months to recover switching costs", () => {
    // $159/month savings, $3000 switching costs = ~19 months
    const months = calculateBreakEvenMonths(159, 3000);
    expect(months).toBeCloseTo(19, 0);
  });

  it("returns Infinity when savings are zero", () => {
    const months = calculateBreakEvenMonths(0, 3000);
    expect(months).toBe(Infinity);
  });

  it("returns Infinity when savings are negative", () => {
    const months = calculateBreakEvenMonths(-100, 3000);
    expect(months).toBe(Infinity);
  });

  it("returns 0 when switching costs are zero", () => {
    const months = calculateBreakEvenMonths(159, 0);
    expect(months).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: FAIL with "calculateBreakEvenMonths is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/loan-comparison.ts`:

```typescript
export function calculateBreakEvenMonths(
  monthlySavings: number,
  switchingCosts: number
): number {
  if (switchingCosts === 0) return 0;
  if (monthlySavings <= 0) return Infinity;

  return Math.ceil(switchingCosts / monthlySavings);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/loan-comparison.ts src/server/services/__tests__/loan-comparison.test.ts
git commit -m "feat(loan-comparison): add break-even calculation"
```

---

## Task 9: Loan Comparison Service - Amortization Schedule

**Files:**
- Modify: `src/server/services/loan-comparison.ts`
- Modify: `src/server/services/__tests__/loan-comparison.test.ts`

**Step 1: Write the failing test**

Add to `src/server/services/__tests__/loan-comparison.test.ts`:

```typescript
import {
  calculateMonthlyPayment,
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
  generateAmortizationSchedule,
  AmortizationEntry,
} from "../loan-comparison";

describe("generateAmortizationSchedule", () => {
  it("generates correct number of entries", () => {
    const schedule = generateAmortizationSchedule(100000, 5, 12);
    expect(schedule).toHaveLength(12);
  });

  it("has correct structure for each entry", () => {
    const schedule = generateAmortizationSchedule(100000, 5, 12);
    const first = schedule[0];

    expect(first).toHaveProperty("month");
    expect(first).toHaveProperty("payment");
    expect(first).toHaveProperty("principal");
    expect(first).toHaveProperty("interest");
    expect(first).toHaveProperty("balance");
  });

  it("ends with zero balance", () => {
    const schedule = generateAmortizationSchedule(100000, 5, 60);
    const last = schedule[schedule.length - 1];

    expect(last.balance).toBeCloseTo(0, 0);
  });

  it("first payment interest is correct", () => {
    // $100,000 at 5% = $416.67 first month interest
    const schedule = generateAmortizationSchedule(100000, 5, 60);
    expect(schedule[0].interest).toBeCloseTo(416.67, 0);
  });

  it("monthly payment stays constant", () => {
    const schedule = generateAmortizationSchedule(100000, 5, 60);
    const payments = schedule.map(e => e.payment);
    const firstPayment = payments[0];

    payments.forEach(p => {
      expect(p).toBeCloseTo(firstPayment, 0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: FAIL with "generateAmortizationSchedule is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/services/loan-comparison.ts`:

```typescript
export interface AmortizationEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function generateAmortizationSchedule(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): AmortizationEntry[] {
  const schedule: AmortizationEntry[] = [];
  const monthlyPayment = calculateMonthlyPayment(principal, annualRatePercent, termMonths);
  const monthlyRate = annualRatePercent / 100 / 12;

  let balance = principal;

  for (let month = 1; month <= termMonths; month++) {
    const interest = balance * monthlyRate;
    const principalPaid = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPaid);

    schedule.push({
      month,
      payment: monthlyPayment,
      principal: principalPaid,
      interest,
      balance,
    });
  }

  return schedule;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/services/__tests__/loan-comparison.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/loan-comparison.ts src/server/services/__tests__/loan-comparison.test.ts
git commit -m "feat(loan-comparison): add amortization schedule generation"
```

---

## Task 10: Create Loan Comparison Router

**Files:**
- Create: `src/server/routers/loanComparison.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing test**

Create file `src/server/routers/__tests__/loanComparison.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loanComparisonRouter } from "../loanComparison";

describe("loanComparison router", () => {
  it("exports the router", () => {
    expect(loanComparisonRouter).toBeDefined();
  });

  it("has calculate procedure", () => {
    expect(loanComparisonRouter.calculate).toBeDefined();
  });

  it("has getMarketRate procedure", () => {
    expect(loanComparisonRouter.getMarketRate).toBeDefined();
  });

  it("has saveComparison procedure", () => {
    expect(loanComparisonRouter.saveComparison).toBeDefined();
  });

  it("has listComparisons procedure", () => {
    expect(loanComparisonRouter.listComparisons).toBeDefined();
  });

  it("has deleteComparison procedure", () => {
    expect(loanComparisonRouter.deleteComparison).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/routers/__tests__/loanComparison.test.ts`

Expected: FAIL with "Cannot find module '../loanComparison'"

**Step 3: Write minimal implementation**

Create file `src/server/routers/loanComparison.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { loanComparisons, loans } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateMonthlySavings,
  calculateTotalInterestSaved,
  calculateBreakEvenMonths,
  generateAmortizationSchedule,
} from "../services/loan-comparison";
import { getEstimatedMarketRate } from "../services/rate-data";

export const loanComparisonRouter = router({
  calculate: protectedProcedure
    .input(
      z.object({
        principal: z.number().positive(),
        currentRate: z.number().min(0),
        newRate: z.number().min(0),
        remainingMonths: z.number().int().positive(),
        switchingCosts: z.number().min(0).default(0),
      })
    )
    .query(({ input }) => {
      const monthlySavings = calculateMonthlySavings(
        input.principal,
        input.currentRate,
        input.newRate,
        input.remainingMonths
      );

      const totalInterestSaved = calculateTotalInterestSaved(
        input.principal,
        input.currentRate,
        input.newRate,
        input.remainingMonths
      );

      const breakEvenMonths = calculateBreakEvenMonths(
        monthlySavings,
        input.switchingCosts
      );

      const currentSchedule = generateAmortizationSchedule(
        input.principal,
        input.currentRate,
        input.remainingMonths
      );

      const newSchedule = generateAmortizationSchedule(
        input.principal,
        input.newRate,
        input.remainingMonths
      );

      return {
        monthlySavings,
        totalInterestSaved,
        breakEvenMonths,
        currentSchedule,
        newSchedule,
      };
    }),

  getMarketRate: protectedProcedure
    .input(
      z.object({
        purpose: z.enum(["owner_occupied", "investor"]),
        repaymentType: z.enum(["principal_and_interest", "interest_only"]),
        lvr: z.number().min(0).max(100),
      })
    )
    .query(async ({ input }) => {
      const rate = await getEstimatedMarketRate(
        input.purpose,
        input.repaymentType,
        input.lvr
      );

      return { estimatedRate: rate };
    }),

  saveComparison: writeProcedure
    .input(
      z.object({
        loanId: z.string().uuid(),
        name: z.string().min(1),
        newRate: z.string().regex(/^\d+\.?\d*$/),
        newLender: z.string().optional(),
        switchingCosts: z.string().regex(/^\d+\.?\d*$/).default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comparison] = await ctx.db
        .insert(loanComparisons)
        .values({
          userId: ctx.portfolio.ownerId,
          loanId: input.loanId,
          name: input.name,
          newRate: input.newRate,
          newLender: input.newLender || null,
          switchingCosts: input.switchingCosts,
        })
        .returning();

      return comparison;
    }),

  listComparisons: protectedProcedure
    .input(z.object({ loanId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(loanComparisons.userId, ctx.portfolio.ownerId)];

      if (input?.loanId) {
        conditions.push(eq(loanComparisons.loanId, input.loanId));
      }

      return ctx.db.query.loanComparisons.findMany({
        where: and(...conditions),
        with: {
          loan: {
            with: {
              property: true,
            },
          },
        },
        orderBy: (lc, { desc }) => [desc(lc.createdAt)],
      });
    }),

  deleteComparison: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(loanComparisons)
        .where(
          and(
            eq(loanComparisons.id, input.id),
            eq(loanComparisons.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),
});
```

Update `src/server/routers/_app.ts`:

```typescript
import { loanComparisonRouter } from "./loanComparison";

// In the router object, add:
loanComparison: loanComparisonRouter,
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/routers/__tests__/loanComparison.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/loanComparison.ts src/server/routers/_app.ts src/server/routers/__tests__/loanComparison.test.ts
git commit -m "feat(router): add loan comparison router"
```

---

## Task 11: Create Refinance Alert Router

**Files:**
- Modify: `src/server/routers/loanComparison.ts`
- Modify: `src/server/routers/__tests__/loanComparison.test.ts`

**Step 1: Write the failing test**

Add to `src/server/routers/__tests__/loanComparison.test.ts`:

```typescript
it("has getAlertConfig procedure", () => {
  expect(loanComparisonRouter.getAlertConfig).toBeDefined();
});

it("has updateAlertConfig procedure", () => {
  expect(loanComparisonRouter.updateAlertConfig).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/server/routers/__tests__/loanComparison.test.ts`

Expected: FAIL with "getAlertConfig is undefined"

**Step 3: Write minimal implementation**

Add to `src/server/routers/loanComparison.ts`:

```typescript
import { loanComparisons, loans, refinanceAlerts } from "../db/schema";

// Add these procedures to the router:

getAlertConfig: protectedProcedure
  .input(z.object({ loanId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // Verify loan belongs to user
    const loan = await ctx.db.query.loans.findFirst({
      where: and(
        eq(loans.id, input.loanId),
        eq(loans.userId, ctx.portfolio.ownerId)
      ),
    });

    if (!loan) {
      throw new Error("Loan not found");
    }

    const config = await ctx.db.query.refinanceAlerts.findFirst({
      where: eq(refinanceAlerts.loanId, input.loanId),
    });

    return config || {
      loanId: input.loanId,
      enabled: false,
      rateGapThreshold: "0.50",
      notifyOnCashRateChange: true,
      lastAlertedAt: null,
    };
  }),

updateAlertConfig: writeProcedure
  .input(
    z.object({
      loanId: z.string().uuid(),
      enabled: z.boolean(),
      rateGapThreshold: z.string().regex(/^\d+\.?\d*$/),
      notifyOnCashRateChange: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Verify loan belongs to user
    const loan = await ctx.db.query.loans.findFirst({
      where: and(
        eq(loans.id, input.loanId),
        eq(loans.userId, ctx.portfolio.ownerId)
      ),
    });

    if (!loan) {
      throw new Error("Loan not found");
    }

    const existing = await ctx.db.query.refinanceAlerts.findFirst({
      where: eq(refinanceAlerts.loanId, input.loanId),
    });

    if (existing) {
      const [updated] = await ctx.db
        .update(refinanceAlerts)
        .set({
          enabled: input.enabled,
          rateGapThreshold: input.rateGapThreshold,
          notifyOnCashRateChange: input.notifyOnCashRateChange,
        })
        .where(eq(refinanceAlerts.loanId, input.loanId))
        .returning();

      return updated;
    }

    const [created] = await ctx.db
      .insert(refinanceAlerts)
      .values({
        loanId: input.loanId,
        enabled: input.enabled,
        rateGapThreshold: input.rateGapThreshold,
        notifyOnCashRateChange: input.notifyOnCashRateChange,
      })
      .returning();

    return created;
  }),
```

**Step 4: Run test to verify it passes**

Run: `npm test src/server/routers/__tests__/loanComparison.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/loanComparison.ts src/server/routers/__tests__/loanComparison.test.ts
git commit -m "feat(router): add refinance alert config endpoints"
```

---

## Task 12: Create Email Templates

**Files:**
- Create: `src/lib/email/templates/refinance-opportunity.ts`
- Create: `src/lib/email/templates/cash-rate-changed.ts`

**Step 1: Write the failing test**

Create file `src/lib/email/templates/__tests__/refinance-templates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  refinanceOpportunityTemplate,
  refinanceOpportunitySubject,
} from "../refinance-opportunity";
import {
  cashRateChangedTemplate,
  cashRateChangedSubject,
} from "../cash-rate-changed";

describe("refinance email templates", () => {
  describe("refinanceOpportunityTemplate", () => {
    it("includes the rate gap", () => {
      const html = refinanceOpportunityTemplate({
        propertyAddress: "123 Main St",
        currentRate: 6.5,
        marketRate: 5.8,
        monthlySavings: 159,
        loanId: "abc123",
      });

      expect(html).toContain("0.70%");
    });

    it("includes the monthly savings", () => {
      const html = refinanceOpportunityTemplate({
        propertyAddress: "123 Main St",
        currentRate: 6.5,
        marketRate: 5.8,
        monthlySavings: 159,
        loanId: "abc123",
      });

      expect(html).toContain("$159");
    });
  });

  describe("refinanceOpportunitySubject", () => {
    it("returns appropriate subject", () => {
      const subject = refinanceOpportunitySubject({ monthlySavings: 159 });
      expect(subject).toContain("$159");
    });
  });

  describe("cashRateChangedTemplate", () => {
    it("includes old and new rates", () => {
      const html = cashRateChangedTemplate({
        oldRate: 4.35,
        newRate: 4.10,
        changeDirection: "decreased",
      });

      expect(html).toContain("4.35%");
      expect(html).toContain("4.10%");
    });
  });

  describe("cashRateChangedSubject", () => {
    it("indicates decrease", () => {
      const subject = cashRateChangedSubject({
        changeDirection: "decreased",
        newRate: 4.1,
      });

      expect(subject.toLowerCase()).toContain("decrease");
    });

    it("indicates increase", () => {
      const subject = cashRateChangedSubject({
        changeDirection: "increased",
        newRate: 4.6,
      });

      expect(subject.toLowerCase()).toContain("increase");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/lib/email/templates/__tests__/refinance-templates.test.ts`

Expected: FAIL with "Cannot find module '../refinance-opportunity'"

**Step 3: Write minimal implementation**

Create file `src/lib/email/templates/refinance-opportunity.ts`:

```typescript
import { baseTemplate } from "./base";

interface RefinanceOpportunityData {
  propertyAddress: string;
  currentRate: number;
  marketRate: number;
  monthlySavings: number;
  loanId: string;
}

export function refinanceOpportunityTemplate(data: RefinanceOpportunityData): string {
  const rateGap = (data.currentRate - data.marketRate).toFixed(2);
  const formattedSavings = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(data.monthlySavings);

  const content = `
    <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #92400e; margin: 0 0 10px 0;">Refinancing Opportunity</h2>
      <p style="font-size: 18px; margin: 0;">
        Your loan rate is <strong>${rateGap}%</strong> above the estimated market rate
      </p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Property</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.propertyAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Your Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.currentRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Market Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.marketRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Potential Savings</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500; color: #16a34a;">${formattedSavings}/month</td>
      </tr>
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/loans/${data.loanId}/compare"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Compare Options
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function refinanceOpportunitySubject(data: { monthlySavings: number }): string {
  const formattedSavings = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(data.monthlySavings);

  return `Refinancing could save you ${formattedSavings}/month`;
}
```

Create file `src/lib/email/templates/cash-rate-changed.ts`:

```typescript
import { baseTemplate } from "./base";

interface CashRateChangedData {
  oldRate: number;
  newRate: number;
  changeDirection: "increased" | "decreased";
}

export function cashRateChangedTemplate(data: CashRateChangedData): string {
  const change = Math.abs(data.newRate - data.oldRate).toFixed(2);
  const directionColor = data.changeDirection === "decreased" ? "#16a34a" : "#dc2626";
  const directionText = data.changeDirection === "decreased" ? "dropped" : "risen";

  const content = `
    <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #0369a1; margin: 0 0 10px 0;">RBA Cash Rate Update</h2>
      <p style="font-size: 18px; margin: 0;">
        The cash rate has <span style="color: ${directionColor}; font-weight: bold;">${directionText} by ${change}%</span>
      </p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Previous Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.oldRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">New Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.newRate.toFixed(2)}%</td>
      </tr>
    </table>
    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      ${data.changeDirection === "decreased"
        ? "This could mean lower repayments if your lender passes on the reduction."
        : "Your lender may increase your rate. Review your loan options."}
    </p>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/loans/compare"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Compare Your Loans
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function cashRateChangedSubject(data: {
  changeDirection: "increased" | "decreased";
  newRate: number;
}): string {
  const action = data.changeDirection === "decreased" ? "decrease" : "increase";
  return `RBA cash rate ${action} to ${data.newRate.toFixed(2)}%`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/lib/email/templates/__tests__/refinance-templates.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/email/templates/refinance-opportunity.ts src/lib/email/templates/cash-rate-changed.ts src/lib/email/templates/__tests__/refinance-templates.test.ts
git commit -m "feat(email): add refinance notification templates"
```

---

## Task 13: Create RBA Rate Check Cron Job

**Files:**
- Create: `src/app/api/cron/rba-rate-check/route.ts`

**Step 1: Write the failing test**

Create file `src/app/api/cron/__tests__/rba-rate-check.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the helper functions, not the route directly
import { parseRbaCashRate, shouldNotifyRateChange } from "../rba-rate-check/helpers";

describe("rba-rate-check helpers", () => {
  describe("parseRbaCashRate", () => {
    it("extracts cash rate from RBA API response", () => {
      const mockResponse = {
        data: [
          { date: "2026-01-20", value: 4.35 },
          { date: "2026-01-15", value: 4.35 },
        ],
      };

      const result = parseRbaCashRate(mockResponse);
      expect(result).toEqual({ date: "2026-01-20", rate: 4.35 });
    });

    it("returns null for empty data", () => {
      const result = parseRbaCashRate({ data: [] });
      expect(result).toBeNull();
    });
  });

  describe("shouldNotifyRateChange", () => {
    it("returns true when rate changed", () => {
      expect(shouldNotifyRateChange(4.35, 4.10)).toBe(true);
    });

    it("returns false when rate unchanged", () => {
      expect(shouldNotifyRateChange(4.35, 4.35)).toBe(false);
    });

    it("returns true when no previous rate", () => {
      expect(shouldNotifyRateChange(null, 4.35)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/cron/__tests__/rba-rate-check.test.ts`

Expected: FAIL with "Cannot find module '../rba-rate-check/helpers'"

**Step 3: Write minimal implementation**

Create file `src/app/api/cron/rba-rate-check/helpers.ts`:

```typescript
export interface RbaApiResponse {
  data: Array<{ date: string; value: number }>;
}

export interface ParsedRate {
  date: string;
  rate: number;
}

export function parseRbaCashRate(response: RbaApiResponse): ParsedRate | null {
  if (!response.data || response.data.length === 0) {
    return null;
  }

  const latest = response.data[0];
  return {
    date: latest.date,
    rate: latest.value,
  };
}

export function shouldNotifyRateChange(
  previousRate: number | null,
  newRate: number
): boolean {
  if (previousRate === null) return true;
  return previousRate !== newRate;
}
```

Create file `src/app/api/cron/rba-rate-check/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { rateHistory, refinanceAlerts, loans, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseRbaCashRate, shouldNotifyRateChange } from "./helpers";
import { sendEmailNotification } from "@/server/services/notification";
import {
  cashRateChangedTemplate,
  cashRateChangedSubject,
} from "@/lib/email/templates/cash-rate-changed";

const RBA_API_URL = "https://api.rba.gov.au/statistics/tables/f1/data.json";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch current RBA cash rate
    const response = await fetch(RBA_API_URL);
    if (!response.ok) {
      console.error("RBA API error:", response.status);
      return NextResponse.json({ error: "RBA API unavailable" }, { status: 503 });
    }

    const data = await response.json();
    const parsed = parseRbaCashRate(data);

    if (!parsed) {
      return NextResponse.json({ error: "Could not parse RBA data" }, { status: 500 });
    }

    // Get previous rate
    const previousRate = await db.query.rateHistory.findFirst({
      orderBy: [desc(rateHistory.rateDate)],
    });

    const previousRateValue = previousRate ? parseFloat(previousRate.cashRate) : null;

    // Check if rate changed
    if (!shouldNotifyRateChange(previousRateValue, parsed.rate)) {
      return NextResponse.json({ message: "No rate change", rate: parsed.rate });
    }

    // Store new rate
    await db.insert(rateHistory).values({
      rateDate: parsed.date,
      cashRate: parsed.rate.toString(),
    });

    // Notify users who have notifyOnCashRateChange enabled
    const alertConfigs = await db
      .select({
        loanId: refinanceAlerts.loanId,
        userId: loans.userId,
      })
      .from(refinanceAlerts)
      .innerJoin(loans, eq(loans.id, refinanceAlerts.loanId))
      .where(eq(refinanceAlerts.notifyOnCashRateChange, true));

    // Get unique user IDs
    const userIds = [...new Set(alertConfigs.map((a) => a.userId))];

    let notified = 0;
    for (const userId of userIds) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (user?.email) {
        const changeDirection = parsed.rate < (previousRateValue || 0) ? "decreased" : "increased";

        await sendEmailNotification(
          user.email,
          cashRateChangedSubject({ changeDirection, newRate: parsed.rate }),
          cashRateChangedTemplate({
            oldRate: previousRateValue || 0,
            newRate: parsed.rate,
            changeDirection,
          })
        );
        notified++;
      }
    }

    return NextResponse.json({
      success: true,
      previousRate: previousRateValue,
      newRate: parsed.rate,
      notified,
    });
  } catch (error) {
    console.error("RBA rate check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/cron/__tests__/rba-rate-check.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/cron/rba-rate-check/route.ts src/app/api/cron/rba-rate-check/helpers.ts src/app/api/cron/__tests__/rba-rate-check.test.ts
git commit -m "feat(cron): add RBA cash rate check job"
```

---

## Task 14: Create Refinance Scan Cron Job

**Files:**
- Create: `src/app/api/cron/refinance-scan/route.ts`

**Step 1: Write the failing test**

Create file `src/app/api/cron/__tests__/refinance-scan.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldAlertForLoan, calculateLvr } from "../refinance-scan/helpers";

describe("refinance-scan helpers", () => {
  describe("calculateLvr", () => {
    it("calculates LVR correctly", () => {
      const lvr = calculateLvr(400000, 500000);
      expect(lvr).toBe(80);
    });

    it("handles zero property value", () => {
      const lvr = calculateLvr(400000, 0);
      expect(lvr).toBe(100);
    });
  });

  describe("shouldAlertForLoan", () => {
    it("returns true when rate gap exceeds threshold", () => {
      const result = shouldAlertForLoan({
        currentRate: 6.5,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: null,
      });
      expect(result).toBe(true);
    });

    it("returns false when rate gap below threshold", () => {
      const result = shouldAlertForLoan({
        currentRate: 6.0,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: null,
      });
      expect(result).toBe(false);
    });

    it("returns false when alerted recently (within 7 days)", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 3);

      const result = shouldAlertForLoan({
        currentRate: 6.5,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: recent,
      });
      expect(result).toBe(false);
    });

    it("returns true when last alert was over 7 days ago", () => {
      const old = new Date();
      old.setDate(old.getDate() - 10);

      const result = shouldAlertForLoan({
        currentRate: 6.5,
        marketRate: 5.8,
        threshold: 0.5,
        lastAlertedAt: old,
      });
      expect(result).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/cron/__tests__/refinance-scan.test.ts`

Expected: FAIL with "Cannot find module '../refinance-scan/helpers'"

**Step 3: Write minimal implementation**

Create file `src/app/api/cron/refinance-scan/helpers.ts`:

```typescript
const ALERT_COOLDOWN_DAYS = 7;

export function calculateLvr(loanBalance: number, propertyValue: number): number {
  if (propertyValue === 0) return 100;
  return (loanBalance / propertyValue) * 100;
}

export function shouldAlertForLoan(params: {
  currentRate: number;
  marketRate: number;
  threshold: number;
  lastAlertedAt: Date | null;
}): boolean {
  const { currentRate, marketRate, threshold, lastAlertedAt } = params;

  // Check rate gap
  const rateGap = currentRate - marketRate;
  if (rateGap < threshold) {
    return false;
  }

  // Check cooldown
  if (lastAlertedAt) {
    const daysSinceLastAlert =
      (Date.now() - lastAlertedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastAlert < ALERT_COOLDOWN_DAYS) {
      return false;
    }
  }

  return true;
}
```

Create file `src/app/api/cron/refinance-scan/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  refinanceAlerts,
  loans,
  users,
  properties,
  propertyValues,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { shouldAlertForLoan, calculateLvr } from "./helpers";
import { getEstimatedMarketRate } from "@/server/services/rate-data";
import { calculateMonthlySavings } from "@/server/services/loan-comparison";
import { sendEmailNotification } from "@/server/services/notification";
import {
  refinanceOpportunityTemplate,
  refinanceOpportunitySubject,
} from "@/lib/email/templates/refinance-opportunity";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all enabled refinance alerts with loan details
    const alerts = await db
      .select({
        alertId: refinanceAlerts.id,
        loanId: refinanceAlerts.loanId,
        threshold: refinanceAlerts.rateGapThreshold,
        lastAlertedAt: refinanceAlerts.lastAlertedAt,
        currentRate: loans.interestRate,
        currentBalance: loans.currentBalance,
        loanType: loans.loanType,
        userId: loans.userId,
        propertyId: loans.propertyId,
      })
      .from(refinanceAlerts)
      .innerJoin(loans, eq(loans.id, refinanceAlerts.loanId))
      .where(eq(refinanceAlerts.enabled, true));

    let scanned = 0;
    let alerted = 0;

    for (const alert of alerts) {
      scanned++;

      // Get property value for LVR calculation
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, alert.propertyId),
      });

      const latestValue = await db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, alert.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const propertyValue = latestValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property?.purchasePrice || "0");

      const loanBalance = parseFloat(alert.currentBalance);
      const lvr = calculateLvr(loanBalance, propertyValue);

      // Determine loan purpose (default to investor for investment properties)
      const purpose = "investor" as const; // Could be enhanced to detect from property data

      // Get estimated market rate
      const marketRate = await getEstimatedMarketRate(
        purpose,
        alert.loanType,
        lvr
      );

      if (marketRate === null) continue;

      const currentRate = parseFloat(alert.currentRate);
      const threshold = parseFloat(alert.threshold);

      // Check if should alert
      if (
        !shouldAlertForLoan({
          currentRate,
          marketRate,
          threshold,
          lastAlertedAt: alert.lastAlertedAt,
        })
      ) {
        continue;
      }

      // Calculate savings (assume 25 years remaining for estimate)
      const monthlySavings = calculateMonthlySavings(
        loanBalance,
        currentRate,
        marketRate,
        300 // 25 years
      );

      // Get user email
      const user = await db.query.users.findFirst({
        where: eq(users.id, alert.userId),
      });

      if (!user?.email || !property) continue;

      // Send notification
      await sendEmailNotification(
        user.email,
        refinanceOpportunitySubject({ monthlySavings }),
        refinanceOpportunityTemplate({
          propertyAddress: property.address,
          currentRate,
          marketRate,
          monthlySavings,
          loanId: alert.loanId,
        })
      );

      // Update last alerted timestamp
      await db
        .update(refinanceAlerts)
        .set({ lastAlertedAt: new Date() })
        .where(eq(refinanceAlerts.id, alert.alertId));

      alerted++;
    }

    return NextResponse.json({
      success: true,
      scanned,
      alerted,
    });
  } catch (error) {
    console.error("Refinance scan error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/cron/__tests__/refinance-scan.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/cron/refinance-scan/route.ts src/app/api/cron/refinance-scan/helpers.ts src/app/api/cron/__tests__/refinance-scan.test.ts
git commit -m "feat(cron): add weekly refinance scan job"
```

---

## Task 15: Create Comparison Calculator Page

**Files:**
- Create: `src/app/(dashboard)/loans/[id]/compare/page.tsx`

**Step 1: Verify loans page structure exists**

Run: `ls src/app/(dashboard)/loans/`

Expected: Should see `page.tsx` and `new/` directory

**Step 2: Create the comparison page**

Create directory and file `src/app/(dashboard)/loans/[id]/compare/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, TrendingDown, Clock, DollarSign } from "lucide-react";
import Link from "next/link";

export default function LoanComparePage() {
  const params = useParams();
  const loanId = params.id as string;

  const [newRate, setNewRate] = useState("");
  const [switchingCosts, setSwitchingCosts] = useState("3000");

  const { data: loan, isLoading: loanLoading } = trpc.loan.get.useQuery({ id: loanId });

  const { data: marketRate } = trpc.loanComparison.getMarketRate.useQuery(
    {
      purpose: "investor",
      repaymentType: loan?.loanType || "principal_and_interest",
      lvr: 80,
    },
    { enabled: !!loan }
  );

  const { data: comparison, isLoading: calculating } = trpc.loanComparison.calculate.useQuery(
    {
      principal: parseFloat(loan?.currentBalance || "0"),
      currentRate: parseFloat(loan?.interestRate || "0"),
      newRate: parseFloat(newRate || "0"),
      remainingMonths: 300, // Default 25 years
      switchingCosts: parseFloat(switchingCosts || "0"),
    },
    { enabled: !!loan && !!newRate && parseFloat(newRate) > 0 }
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  if (loanLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!loan) {
    return <div>Loan not found</div>;
  }

  const currentRate = parseFloat(loan.interestRate);
  const rateGap = marketRate?.estimatedRate
    ? currentRate - marketRate.estimatedRate
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/loans">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Loans
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Compare Loan Options</h1>
          <p className="text-muted-foreground">{loan.property?.address}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Loan */}
        <Card>
          <CardHeader>
            <CardTitle>Current Loan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lender</span>
              <span className="font-medium">{loan.lender}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(loan.currentBalance))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{currentRate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">
                {loan.loanType.replace(/_/g, " ")}
              </span>
            </div>

            {rateGap !== null && rateGap > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Your rate is <strong>{rateGap.toFixed(2)}%</strong> above the
                  estimated market rate of{" "}
                  <strong>{marketRate?.estimatedRate?.toFixed(2)}%</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparison Input */}
        <Card>
          <CardHeader>
            <CardTitle>Compare With</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newRate">New Interest Rate (%)</Label>
              <Input
                id="newRate"
                type="number"
                step="0.01"
                placeholder={marketRate?.estimatedRate?.toFixed(2) || "5.50"}
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
              />
              {marketRate?.estimatedRate && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={() => setNewRate(marketRate.estimatedRate!.toFixed(2))}
                >
                  Use market rate ({marketRate.estimatedRate.toFixed(2)}%)
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="switchingCosts">Switching Costs ($)</Label>
              <Input
                id="switchingCosts"
                type="number"
                step="100"
                placeholder="3000"
                value={switchingCosts}
                onChange={(e) => setSwitchingCosts(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include discharge fees, application fees, legal costs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {comparison && parseFloat(newRate) > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Savings</p>
                  <p className="text-2xl font-bold">
                    {comparison.monthlySavings > 0 ? (
                      <span className="text-green-600">
                        {formatCurrency(comparison.monthlySavings)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        -{formatCurrency(Math.abs(comparison.monthlySavings))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Interest Saved</p>
                  <p className="text-2xl font-bold">
                    {comparison.totalInterestSaved > 0 ? (
                      <span className="text-green-600">
                        {formatCurrency(comparison.totalInterestSaved)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        -{formatCurrency(Math.abs(comparison.totalInterestSaved))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Break-even</p>
                  <p className="text-2xl font-bold">
                    {comparison.breakEvenMonths === Infinity ? (
                      <span className="text-muted-foreground">N/A</span>
                    ) : (
                      <span>{comparison.breakEvenMonths} months</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Amortization Tables would go here - simplified for now */}
      {comparison && comparison.monthlySavings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Refinancing could save you{" "}
              <strong>{formatCurrency(comparison.monthlySavings)}/month</strong> and{" "}
              <strong>{formatCurrency(comparison.totalInterestSaved)}</strong> in total
              interest over the remaining loan term.
            </p>
            {comparison.breakEvenMonths < 36 && (
              <p className="mt-2 text-green-600">
                You'll recover your switching costs in just{" "}
                <strong>{comparison.breakEvenMonths} months</strong>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 3: Verify the page renders**

Run the dev server and navigate to `/loans/[any-loan-id]/compare`

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/loans/\[id\]/compare/page.tsx
git commit -m "feat(ui): add loan comparison calculator page"
```

---

## Task 16: Create Comparisons List Page

**Files:**
- Create: `src/app/(dashboard)/loans/compare/page.tsx`

**Step 1: Create the comparisons list page**

Create file `src/app/(dashboard)/loans/compare/page.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ComparisonsListPage() {
  const utils = trpc.useUtils();

  const { data: comparisons, isLoading } = trpc.loanComparison.listComparisons.useQuery();

  const deleteComparison = trpc.loanComparison.deleteComparison.useMutation({
    onSuccess: () => {
      utils.loanComparison.listComparisons.invalidate();
    },
  });

  const formatCurrency = (amount: string) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/loans">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Loans
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Saved Comparisons</h1>
        </div>
      </div>

      {!comparisons || comparisons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No saved comparisons yet</p>
            <Link href="/loans">
              <Button>Compare a Loan</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comparisons.map((comparison) => (
            <Card key={comparison.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{comparison.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteComparison.mutate({ id: comparison.id })}
                    disabled={deleteComparison.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {comparison.loan?.property?.address}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New Rate</span>
                  <span className="font-medium">{comparison.newRate}%</span>
                </div>
                {comparison.newLender && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lender</span>
                    <span>{comparison.newLender}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Switching Costs</span>
                  <span>{formatCurrency(comparison.switchingCosts)}</span>
                </div>
                <Link href={`/loans/${comparison.loanId}/compare`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/loans/compare/page.tsx
git commit -m "feat(ui): add saved comparisons list page"
```

---

## Task 17: Create Refinance Alerts Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/refinance-alerts/page.tsx`

**Step 1: Create the settings page**

Create file `src/app/(dashboard)/settings/refinance-alerts/page.tsx`:

```typescript
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Bell, Home } from "lucide-react";
import { useState, useEffect } from "react";

interface LoanAlertConfig {
  loanId: string;
  enabled: boolean;
  rateGapThreshold: string;
  notifyOnCashRateChange: boolean;
}

function LoanAlertCard({
  loan,
  config,
  onUpdate,
}: {
  loan: {
    id: string;
    lender: string;
    interestRate: string;
    property?: { address: string } | null;
  };
  config: LoanAlertConfig;
  onUpdate: (config: LoanAlertConfig) => void;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [threshold, setThreshold] = useState(parseFloat(config.rateGapThreshold));
  const [cashRateNotify, setCashRateNotify] = useState(config.notifyOnCashRateChange);

  useEffect(() => {
    onUpdate({
      loanId: loan.id,
      enabled,
      rateGapThreshold: threshold.toFixed(2),
      notifyOnCashRateChange: cashRateNotify,
    });
  }, [enabled, threshold, cashRateNotify, loan.id, onUpdate]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Home className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{loan.property?.address || "Unknown Property"}</CardTitle>
            <CardDescription>
              {loan.lender} • {parseFloat(loan.interestRate).toFixed(2)}%
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Alert when rate gap exceeds</Label>
              <span className="text-sm font-medium">{threshold.toFixed(2)}%</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={([value]) => setThreshold(value)}
              min={0.25}
              max={1}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              You'll be notified when your rate is this much above market
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notify on RBA rate changes</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when the cash rate changes
              </p>
            </div>
            <Switch checked={cashRateNotify} onCheckedChange={setCashRateNotify} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function RefinanceAlertsPage() {
  const { data: loans, isLoading: loansLoading } = trpc.loan.list.useQuery();
  const utils = trpc.useUtils();

  const updateConfig = trpc.loanComparison.updateAlertConfig.useMutation({
    onSuccess: () => {
      utils.loanComparison.getAlertConfig.invalidate();
    },
  });

  // Fetch configs for all loans
  const loanIds = loans?.map((l) => l.id) || [];
  const configs = trpc.useQueries((t) =>
    loanIds.map((id) => t.loanComparison.getAlertConfig({ loanId: id }))
  );

  const handleUpdate = (config: LoanAlertConfig) => {
    updateConfig.mutate(config);
  };

  if (loansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Refinance Alerts</h1>
        <p className="text-muted-foreground">
          Get notified when better loan rates are available
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                We monitor your loan rates against estimated market rates and alert you when refinancing could save money.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!loans || loans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No loans found. Add a loan to enable alerts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {loans.map((loan, index) => {
            const configQuery = configs[index];
            const config = configQuery?.data || {
              loanId: loan.id,
              enabled: false,
              rateGapThreshold: "0.50",
              notifyOnCashRateChange: true,
            };

            return (
              <LoanAlertCard
                key={loan.id}
                loan={loan}
                config={config}
                onUpdate={handleUpdate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/settings/refinance-alerts/page.tsx
git commit -m "feat(ui): add refinance alerts settings page"
```

---

## Task 18: Add Navigation Links

**Files:**
- Modify: Navigation component (find existing nav)

**Step 1: Find the navigation component**

Run: `grep -r "Loans" src/components --include="*.tsx" | head -5`

**Step 2: Add loan comparison links to navigation**

Locate the navigation component and add:
- Under Loans section: "Compare" link to `/loans/compare`
- Under Settings section: "Refinance Alerts" link to `/settings/refinance-alerts`

**Step 3: Commit**

```bash
git add src/components/[navigation-file].tsx
git commit -m "feat(nav): add loan comparison navigation links"
```

---

## Task 19: Run Database Migration

**Step 1: Generate migration**

Run: `npm run db:generate`

This will create a migration file for the new tables.

**Step 2: Apply migration**

Run: `npm run db:migrate`

**Step 3: Verify tables exist**

Run: `npm run db:studio` and check that `rate_history`, `loan_comparisons`, and `refinance_alerts` tables exist.

**Step 4: Commit migration file**

```bash
git add drizzle/
git commit -m "chore(db): add loan comparison migration"
```

---

## Task 20: Run All Tests and Final Verification

**Step 1: Run all tests**

Run: `npm test`

Expected: All tests pass

**Step 2: Run type check**

Run: `npm run typecheck`

Expected: No type errors

**Step 3: Run lint**

Run: `npm run lint`

Expected: No lint errors

**Step 4: Manual verification**

1. Start dev server: `npm run dev`
2. Navigate to `/loans` and click "Compare" on a loan
3. Enter a new rate and verify calculations display
4. Navigate to `/settings/refinance-alerts` and toggle alerts
5. Check `/loans/compare` for saved comparisons

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete loan comparison feature"
```

---

## Summary

This plan implements the Loan Comparison & Refinancing Alerts feature with:

- **3 new database tables**: rateHistory, loanComparisons, refinanceAlerts
- **2 new services**: rate-data.ts, loan-comparison.ts
- **1 new router**: loanComparison.ts with 7 endpoints
- **2 cron jobs**: rba-rate-check, refinance-scan
- **2 email templates**: refinance-opportunity, cash-rate-changed
- **3 new pages**: /loans/[id]/compare, /loans/compare, /settings/refinance-alerts

Total: ~20 tasks, each with TDD approach (test first, then implement).
