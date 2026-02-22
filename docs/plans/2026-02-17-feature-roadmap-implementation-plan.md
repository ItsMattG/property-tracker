# BrickTrack Feature Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement P0 (Wave A) and P1 (Wave B) features from the BrickTrack feature roadmap to establish competitive parity and build a defensible moat.

**Architecture:** Each feature is a separate branch off `develop`, implemented with TDD, using existing repository/router/component patterns. Features touch schema, server, and client layers. Each feature = one PR.

**Tech Stack:** Next.js 16, React 19, tRPC v11, Drizzle ORM v0.45, Tailwind v4, Zod v4, Recharts v3, Vitest, Playwright

**Design Doc:** `docs/plans/2026-02-17-bricktrack-feature-roadmap-design.md`

---

## Tech Notes (Context7 Validation)

- **Tailwind v4 Dark Mode:** Use `dark:` prefix on utilities. CSS-level: `@variant dark { ... }`. Theme variables via `@theme { --color-x: ... }`. Already uses `@custom-variant dark (&:is(.dark *))` in globals.css.
- **Recharts v3 Sankey:** Native `<Sankey>` component. Data shape: `{ nodes: [{name}], links: [{source, target, value}] }`. Wrap in `<ResponsiveContainer>`. Import from `recharts`.
- **tRPC v11:** `protectedProcedure` / `writeProcedure` with middleware. Access repos via `ctx.uow.repoName`. Return typed results.
- **Drizzle ORM v0.45:** `pgTable()`, `pgEnum()`, `relations()`. Schema in `src/server/db/schema/`. Push with `drizzle-kit push`. Types via `$inferSelect` / `$inferInsert`.

---

## Wave A: Foundation Polish (P0)

> 5 features. Each gets its own branch. Target: immediate implementation.

---

### Task 1: Dark Mode Enhancement

**Current State:** Dark mode partially exists. `globals.css` has `@custom-variant dark (&:is(.dark *))` (line 5). ThemeProvider manages `data-theme` attribute. ThemeToggle exists with Sun/Moon icons. 5 themes exist including "dark". The gap is: dark theme CSS variables may be incomplete, chart colors don't adapt, and system preference detection is missing.

**Files:**
- Modify: `src/app/globals.css` — audit/complete dark variant CSS variables
- Modify: `src/styles/themes.css` — ensure dark theme has complete variable coverage
- Modify: `src/components/theme/ThemeProvider.tsx` — add system preference detection
- Modify: `src/components/theme/ThemeToggle.tsx` — add "system" option (Sun/Moon/Monitor icons)
- Modify: `src/components/portfolio/CashFlowBarChart.tsx` — dark-aware chart colors
- Modify: `src/components/reports/CashFlowChart.tsx` — dark-aware chart colors
- Modify: `src/components/dashboard/PortfolioValueChart.tsx` — dark-aware chart colors
- Test: `src/components/theme/__tests__/ThemeProvider.test.tsx`
- Test: `src/components/theme/__tests__/ThemeToggle.test.tsx`

**Step 1: Audit current dark theme coverage**

Run the app with dark theme active. Screenshot key pages (dashboard, properties, transactions, reports). Identify missing/broken dark styles.

**Step 2: Write failing tests for system preference detection**

```typescript
// src/components/theme/__tests__/ThemeProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to system preference when no stored theme", () => {
    // Mock matchMedia for dark preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    // ThemeProvider should detect and apply "dark"
  });

  it("respects stored theme over system preference", () => {
    localStorage.setItem("bricktrack-theme", "forest");
    // ThemeProvider should use "forest" regardless of system preference
  });

  it("supports 'system' option that follows OS preference", () => {
    localStorage.setItem("bricktrack-theme", "system");
    // Should resolve to actual theme based on matchMedia
  });
});
```

Run: `pnpm vitest run src/components/theme/__tests__/ThemeProvider.test.tsx`
Expected: FAIL (system preference not implemented yet)

**Step 3: Implement system preference detection in ThemeProvider**

Update `ThemeProvider.tsx`:
- Add `"system"` to Theme type
- On mount, check localStorage. If "system" or absent, use `window.matchMedia("(prefers-color-scheme: dark)")`
- Listen for `change` event on matchMedia to react to OS theme changes
- Resolve "system" to actual theme ("dark" or "forest" as default light)

**Step 4: Run tests to verify**

Run: `pnpm vitest run src/components/theme/__tests__/ThemeProvider.test.tsx`
Expected: PASS

**Step 5: Update ThemeToggle to include system option**

Add third state to toggle cycle: Light (Sun) → Dark (Moon) → System (Monitor).
Import `Monitor` from lucide-react. Show current resolved theme as tooltip.

**Step 6: Audit and fix dark CSS variables in themes.css**

Ensure ALL CSS custom properties have dark variants:
- `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-input`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border-light`, `--border-default`
- Chart colors: `--chart-1` through `--chart-5`
- Use `#121212` for background, `#1E1E1E` for cards (per design doc)

**Step 7: Fix chart components for dark mode**

Add hook `useChartColors()` that reads CSS variables and returns color array.
Update `CashFlowBarChart`, `CashFlowChart`, `PortfolioValueChart` to use CSS variable colors instead of hardcoded hex.

**Step 8: Visual regression test with Playwright**

```typescript
// e2e/authenticated/dark-mode.spec.ts
test("dark mode renders correctly on dashboard", async ({ page }) => {
  await safeGoto(page, "/dashboard");
  // Toggle to dark mode
  await page.getByRole("button", { name: /theme/i }).click();
  // Verify dark background applied
  const bg = await page.locator("body").evaluate((el) =>
    getComputedStyle(el).getPropertyValue("background-color")
  );
  expect(bg).not.toBe("rgb(255, 255, 255)");
});
```

**Step 9: Commit**

```bash
git add -A && git commit -m "feat: enhance dark mode with system preference detection and chart support"
```

---

### Task 2: Milestone Celebrations

**Current State:** Equity milestones exist (`equityMilestones` table, cron job, `MilestonesCard.tsx`). Missing: celebration animations, broader milestone types (not just equity/LVR), achievement notifications with confetti, dashboard progress display.

**Files:**
- Create: `src/components/celebrations/ConfettiCelebration.tsx` — confetti animation component
- Create: `src/components/celebrations/MilestoneModal.tsx` — celebration modal
- Create: `src/server/services/milestone/types.ts` — milestone type definitions
- Create: `src/server/services/milestone/detector.ts` — milestone detection logic
- Modify: `src/server/routers/user/milestonePreferences.ts` — add achievement types
- Modify: `src/components/dashboard/DashboardClient.tsx` — milestone progress bar
- Modify: `src/server/db/schema/portfolio.ts` — extend milestone schema if needed
- Test: `src/server/services/milestone/__tests__/detector.test.ts`
- Test: `src/components/celebrations/__tests__/MilestoneModal.test.ts`

**Step 1: Define milestone types**

```typescript
// src/server/services/milestone/types.ts
export type MilestoneCategory = "portfolio" | "engagement" | "tax";

export interface MilestoneDefinition {
  id: string;
  category: MilestoneCategory;
  label: string;
  description: string;
  check: (context: MilestoneContext) => boolean;
}

export interface MilestoneContext {
  propertyCount: number;
  totalEquity: number;
  monthsPositiveCashFlow: number;
  categorizedTransactionPercent: number;
  bankAccountsConnected: number;
  taxReportsGenerated: number;
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    id: "first-property",
    category: "portfolio",
    label: "First Property Added",
    description: "You've added your first investment property",
    check: (ctx) => ctx.propertyCount >= 1,
  },
  {
    id: "equity-500k",
    category: "portfolio",
    label: "Portfolio reached $500K equity",
    description: "Your total portfolio equity has crossed $500,000",
    check: (ctx) => ctx.totalEquity >= 500_000,
  },
  {
    id: "positive-cashflow-12m",
    category: "portfolio",
    label: "12 months of positive cash flow",
    description: "Congratulations on a full year of positive cash flow",
    check: (ctx) => ctx.monthsPositiveCashFlow >= 12,
  },
  {
    id: "all-categorized",
    category: "engagement",
    label: "All transactions categorized",
    description: "Every transaction is categorized for the current FY",
    check: (ctx) => ctx.categorizedTransactionPercent >= 100,
  },
  {
    id: "bank-connected",
    category: "engagement",
    label: "Bank feeds connected",
    description: "Your bank accounts are syncing automatically",
    check: (ctx) => ctx.bankAccountsConnected >= 1,
  },
];
```

**Step 2: Write failing test for milestone detector**

```typescript
// src/server/services/milestone/__tests__/detector.test.ts
import { describe, it, expect } from "vitest";
import { detectNewMilestones, MILESTONES } from "../detector";
import type { MilestoneContext } from "../types";

describe("detectNewMilestones", () => {
  it("detects first-property milestone", () => {
    const ctx: MilestoneContext = {
      propertyCount: 1,
      totalEquity: 0,
      monthsPositiveCashFlow: 0,
      categorizedTransactionPercent: 0,
      bankAccountsConnected: 0,
      taxReportsGenerated: 0,
    };
    const achieved = ["bank-connected"]; // previously achieved
    const newMilestones = detectNewMilestones(ctx, achieved);
    expect(newMilestones.map((m) => m.id)).toContain("first-property");
    expect(newMilestones.map((m) => m.id)).not.toContain("bank-connected");
  });

  it("returns empty when all milestones already achieved", () => {
    const ctx: MilestoneContext = {
      propertyCount: 5,
      totalEquity: 1_000_000,
      monthsPositiveCashFlow: 24,
      categorizedTransactionPercent: 100,
      bankAccountsConnected: 3,
      taxReportsGenerated: 2,
    };
    const achieved = MILESTONES.map((m) => m.id);
    const newMilestones = detectNewMilestones(ctx, achieved);
    expect(newMilestones).toHaveLength(0);
  });
});
```

Run: `pnpm vitest run src/server/services/milestone/__tests__/detector.test.ts`
Expected: FAIL

**Step 3: Implement detector**

```typescript
// src/server/services/milestone/detector.ts
import { MILESTONES, type MilestoneContext, type MilestoneDefinition } from "./types";

export { MILESTONES };

export function detectNewMilestones(
  context: MilestoneContext,
  previouslyAchieved: string[],
): MilestoneDefinition[] {
  return MILESTONES.filter(
    (m) => !previouslyAchieved.includes(m.id) && m.check(context),
  );
}
```

Run: `pnpm vitest run src/server/services/milestone/__tests__/detector.test.ts`
Expected: PASS

**Step 4: Build confetti celebration component**

```typescript
// src/components/celebrations/ConfettiCelebration.tsx
"use client";
import { useEffect, useState } from "react";

// CSS-only confetti using keyframe animations (no external dependency)
// 30 colored squares that fall and rotate over 3 seconds
export function ConfettiCelebration({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Array<{ id: number; color: string; left: number; delay: number }>>([]);

  useEffect(() => {
    if (!active) return;
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
    setParticles(
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        color: colors[i % colors.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
      })),
    );
    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, [active]);

  if (!particles.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 h-3 w-3 animate-confetti rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
```

Add `@keyframes confetti` to globals.css:
```css
@keyframes confetti {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
.animate-confetti {
  animation: confetti 3s ease-out forwards;
}
```

**Step 5: Build milestone celebration modal**

```typescript
// src/components/celebrations/MilestoneModal.tsx
"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { ConfettiCelebration } from "./ConfettiCelebration";
import type { MilestoneDefinition } from "@/server/services/milestone/types";

interface MilestoneModalProps {
  milestone: MilestoneDefinition | null;
  onDismiss: () => void;
}

export function MilestoneModal({ milestone, onDismiss }: MilestoneModalProps) {
  return (
    <>
      <ConfettiCelebration active={!!milestone} />
      <Dialog open={!!milestone} onOpenChange={(open) => !open && onDismiss()}>
        <DialogContent className="text-center">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl">{milestone?.label}</DialogTitle>
            <DialogDescription>{milestone?.description}</DialogDescription>
          </DialogHeader>
          <Button onClick={onDismiss} className="mt-4">Continue</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 6: Integrate milestone checks into dashboard**

In `DashboardClient.tsx`, after loading dashboard data:
1. Build `MilestoneContext` from existing stats
2. Compare against user's `achievedMilestones` (stored in user preferences)
3. If new milestones detected, show `MilestoneModal`
4. On dismiss, save milestone as achieved

**Step 7: Add progress bar to dashboard**

Show a small "Achievements: X/Y" progress indicator on dashboard. Link to settings/milestones page for full list.

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: add milestone celebrations with confetti and progress tracking"
```

---

### Task 3: Categorization Rules Engine

**Current State:** AI categorization exists in `services/banking/categorization.ts`. Merchant memory tables exist (`merchantCategories`). Users can manually categorize and bulk-update. Missing: user-configurable rules with pattern matching, rule priority over AI, rules CRUD UI, rule testing.

**Files:**
- Create: `src/server/db/schema/categorization-rules.ts` — rules table
- Create: `src/server/repositories/categorization-rule.repository.ts` — CRUD repo
- Create: `src/server/repositories/interfaces/categorization-rule.repository.interface.ts`
- Create: `src/server/routers/banking/categorizationRules.ts` — tRPC router
- Create: `src/components/transactions/rules/RulesList.tsx` — rules management UI
- Create: `src/components/transactions/rules/RuleForm.tsx` — create/edit rule form
- Create: `src/server/services/banking/rule-matcher.ts` — pattern matching engine
- Modify: `src/server/services/banking/categorization.ts` — add rule check before AI
- Modify: `src/server/repositories/unit-of-work.ts` — register new repo
- Modify: `src/server/db/schema/index.ts` — export new schema
- Modify: `src/server/routers/index.ts` — register new router
- Test: `src/server/services/banking/__tests__/rule-matcher.test.ts`
- Test: `src/server/routers/banking/__tests__/categorizationRules.test.ts`
- Test: `src/server/repositories/__tests__/categorization-rule.repository.test.ts`

**Step 1: Create schema for categorization rules**

```typescript
// src/server/db/schema/categorization-rules.ts
import { pgTable, uuid, text, integer, timestamp, boolean, index } from "./_common";
import { users } from "./auth";
import { properties } from "./properties";
import { categoryEnum } from "./enums";

export const categorizationRules = pgTable("categorization_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // user-friendly label
  merchantPattern: text("merchant_pattern"), // e.g., "Body Corporate*"
  descriptionPattern: text("description_pattern"), // regex or contains
  matchType: text("match_type").notNull().default("contains"), // "contains" | "equals" | "starts_with" | "regex"
  amountMin: integer("amount_min"), // optional amount range filter
  amountMax: integer("amount_max"),
  targetCategory: categoryEnum("target_category").notNull(),
  targetPropertyId: uuid("target_property_id").references(() => properties.id, { onDelete: "set null" }),
  priority: integer("priority").notNull().default(0), // higher = checked first
  isActive: boolean("is_active").notNull().default(true),
  matchCount: integer("match_count").notNull().default(0), // usage tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("categorization_rules_user_id_idx").on(table.userId),
]);

export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type NewCategorizationRule = typeof categorizationRules.$inferInsert;
```

Push schema: `npx drizzle-kit push`

**Step 2: Write failing test for rule matcher**

```typescript
// src/server/services/banking/__tests__/rule-matcher.test.ts
import { describe, it, expect } from "vitest";
import { matchTransaction } from "../rule-matcher";
import type { CategorizationRule } from "@/server/db/schema/categorization-rules";

const mockRule = (overrides: Partial<CategorizationRule> = {}): CategorizationRule => ({
  id: "rule-1",
  userId: "user-1",
  name: "Body Corp Rule",
  merchantPattern: "Body Corporate",
  descriptionPattern: null,
  matchType: "contains",
  amountMin: null,
  amountMax: null,
  targetCategory: "strata_fees",
  targetPropertyId: "prop-1",
  priority: 0,
  isActive: true,
  matchCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("matchTransaction", () => {
  it("matches merchant name with contains", () => {
    const rules = [mockRule()];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate ABC Pty Ltd",
      description: "Monthly levy",
      amount: -450,
    });
    expect(result).not.toBeNull();
    expect(result!.targetCategory).toBe("strata_fees");
  });

  it("returns null when no rules match", () => {
    const rules = [mockRule()];
    const result = matchTransaction(rules, {
      merchant: "Bunnings Warehouse",
      description: "Paint supplies",
      amount: -89,
    });
    expect(result).toBeNull();
  });

  it("respects priority ordering (higher priority first)", () => {
    const rules = [
      mockRule({ id: "low", priority: 0, targetCategory: "other_expenses" }),
      mockRule({ id: "high", priority: 10, targetCategory: "strata_fees" }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate ABC",
      description: "",
      amount: -450,
    });
    expect(result!.id).toBe("high");
  });

  it("matches amount range when specified", () => {
    const rules = [
      mockRule({ amountMin: -500, amountMax: -100, merchantPattern: null, descriptionPattern: "levy" }),
    ];
    const result = matchTransaction(rules, {
      merchant: "Unknown",
      description: "Quarterly levy payment",
      amount: -450,
    });
    expect(result).not.toBeNull();
  });

  it("skips inactive rules", () => {
    const rules = [mockRule({ isActive: false })];
    const result = matchTransaction(rules, {
      merchant: "Body Corporate ABC",
      description: "",
      amount: -450,
    });
    expect(result).toBeNull();
  });
});
```

Run: `pnpm vitest run src/server/services/banking/__tests__/rule-matcher.test.ts`
Expected: FAIL

**Step 3: Implement rule matcher**

```typescript
// src/server/services/banking/rule-matcher.ts
import type { CategorizationRule } from "@/server/db/schema/categorization-rules";

interface TransactionInput {
  merchant: string;
  description: string;
  amount: number;
}

export function matchTransaction(
  rules: CategorizationRule[],
  txn: TransactionInput,
): CategorizationRule | null {
  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (matchesRule(rule, txn)) return rule;
  }
  return null;
}

function matchesRule(rule: CategorizationRule, txn: TransactionInput): boolean {
  // Check merchant pattern
  if (rule.merchantPattern) {
    if (!matchesPattern(rule.matchType, rule.merchantPattern, txn.merchant)) {
      return false;
    }
  }

  // Check description pattern
  if (rule.descriptionPattern) {
    if (!matchesPattern(rule.matchType, rule.descriptionPattern, txn.description)) {
      return false;
    }
  }

  // Must match at least one pattern
  if (!rule.merchantPattern && !rule.descriptionPattern) return false;

  // Check amount range
  if (rule.amountMin !== null && txn.amount < rule.amountMin) return false;
  if (rule.amountMax !== null && txn.amount > rule.amountMax) return false;

  return true;
}

function matchesPattern(matchType: string, pattern: string, value: string): boolean {
  const lower = value.toLowerCase();
  const patternLower = pattern.toLowerCase();

  switch (matchType) {
    case "contains":
      return lower.includes(patternLower);
    case "equals":
      return lower === patternLower;
    case "starts_with":
      return lower.startsWith(patternLower);
    case "regex":
      try {
        return new RegExp(pattern, "i").test(value);
      } catch {
        return false;
      }
    default:
      return false;
  }
}
```

Run: `pnpm vitest run src/server/services/banking/__tests__/rule-matcher.test.ts`
Expected: PASS

**Step 4: Create repository + interface**

Follow existing pattern from `budget.repository.ts`:
- Interface with `findByUser()`, `create()`, `update()`, `delete()`, `incrementMatchCount()`
- Repository implementing interface
- Register in `unit-of-work.ts`

**Step 5: Create tRPC router**

```typescript
// src/server/routers/banking/categorizationRules.ts
// Procedures: list, create, update, delete, test (dry-run rule against recent transactions)
// All use writeProcedure for mutations, protectedProcedure for queries
// Free tier: max 5 rules. Pro: unlimited.
```

**Step 6: Write router tests**

Follow pattern from `src/server/routers/banking/__tests__/transaction.test.ts`. Test CRUD + plan limits.

**Step 7: Integrate rules into categorization pipeline**

In `categorization.ts`, before calling Claude API:
1. Load user's active rules via `ctx.uow.categorizationRule.findByUser(userId)`
2. Call `matchTransaction(rules, txn)`
3. If match found: apply rule's category + property, increment match count, skip AI
4. If no match: proceed with existing AI categorization

**Step 8: Build rules management UI**

Page at `/transactions/rules` (or section in transactions page settings):
- List existing rules with match count, active toggle
- Create/edit form: name, merchant pattern, match type dropdown, category select, property select, priority
- "Test Rule" button: dry-run against last 50 transactions, show what would match
- Delete with confirmation

**Step 9: Commit**

```bash
git add -A && git commit -m "feat: add categorization rules engine with pattern matching"
```

---

### Task 4: Property Performance Scorecard

**Current State:** `performanceBenchmarking.ts` router exists with yield, expense ratio, percentile calculations. `BenchmarkCard.tsx` exists. Missing: dedicated comparison view, side-by-side scorecard, color-coded indicators, portfolio-level summary.

**Files:**
- Create: `src/app/(dashboard)/analytics/scorecard/page.tsx` — scorecard page
- Create: `src/components/analytics/PropertyScorecard.tsx` — per-property card
- Create: `src/components/analytics/ScorecardComparison.tsx` — side-by-side view
- Create: `src/components/analytics/ScoreIndicator.tsx` — color-coded metric
- Modify: `src/server/routers/analytics/performanceBenchmarking.ts` — add portfolio summary procedure
- Test: `src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts`
- Test: `src/components/analytics/__tests__/ScoreIndicator.test.tsx`

**Step 1: Write failing test for portfolio performance summary**

```typescript
// Extend existing performanceBenchmarking.test.ts
describe("getPortfolioSummary", () => {
  it("returns performance metrics for all properties", async () => {
    // Mock: 2 properties with transaction data
    // Expect: array of PropertyPerformanceResult, sorted by score descending
  });

  it("returns empty array for user with no properties", async () => {
    // Expect: []
  });
});
```

Run: `pnpm vitest run src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts`
Expected: FAIL

**Step 2: Add getPortfolioSummary procedure**

New `protectedProcedure` in `performanceBenchmarking.ts` that:
1. Fetches all user properties
2. For each, calculates: gross yield, net yield, cap rate, cash-on-cash return, equity growth %, annual cash flow, tax benefit
3. Returns sorted by overall score (descending)

**Step 3: Run tests**

Expected: PASS

**Step 4: Build ScoreIndicator component**

```typescript
// src/components/analytics/ScoreIndicator.tsx
// Color-coded metric display:
// - Green (>75th percentile): "Excellent"
// - Amber (25-75th): "Average"
// - Red (<25th): "Below Average"
// Shows: metric name, value, percentile bar, status label
```

**Step 5: Build PropertyScorecard component**

Card showing all metrics for one property:
- ROI, cash-on-cash, cap rate, gross yield, net yield
- Equity growth %, annual cash flow, tax benefit
- Overall score with status badge
- Each metric uses `ScoreIndicator`

**Step 6: Build ScorecardComparison page**

Side-by-side comparison:
- Property selector (multi-select up to 4)
- Table/grid view with each property as a column
- Highlight best performer per metric (bold green)
- Portfolio average column

**Step 7: Add page route and navigation**

Add `/analytics/scorecard` page. Add nav link in sidebar under Analytics.

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: add property performance scorecard with comparison view"
```

---

### Task 5: Referral Enhancement

**Current State:** Full referral system exists: router, schema, repository, cookie tracking, `/r/[code]` handler, settings page. Missing: prominent in-app visibility, "give a month get a month" messaging, milestone-triggered share prompts, referral dashboard with pending/completed, email nudges.

**Files:**
- Modify: `src/app/(dashboard)/settings/referrals/page.tsx` — enhance referral dashboard
- Create: `src/components/referral/SharePrompt.tsx` — contextual share prompt
- Create: `src/components/referral/ReferralDashboard.tsx` — rich referral stats
- Modify: `src/server/routers/user/referral.ts` — add referral details procedure
- Modify: `src/components/celebrations/MilestoneModal.tsx` — add share CTA after celebrations
- Test: `src/server/routers/user/__tests__/referral.test.ts`

**Step 1: Enhance referral stats procedure**

Add `getReferralDetails` procedure returning:
- User's referral code and shareable URL
- List of referrals with status, date, refereeDisplayName
- Total credits earned, credits pending
- "Give a month, get a month" banner copy

**Step 2: Build ReferralDashboard component**

Rich dashboard showing:
- Big shareable URL with copy button
- "Give a month, get a month" explainer card
- Stats: X invited, Y converted, $Z credits earned
- List of referrals with status badges (pending/qualified/rewarded)

**Step 3: Add share prompt to milestone celebrations**

After dismissing milestone modal, show "Share your achievement?" prompt with:
- Pre-filled share text: "Just hit [milestone] on BrickTrack!"
- Copy link button
- Direct share to Twitter/LinkedIn

**Step 4: Add referral visibility to dashboard**

Small "Invite friends, get a free month" card on dashboard sidebar or below main widgets.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: enhance referral program with dashboard and share prompts"
```

---

## Wave B: Core Differentiators (P1)

> 7 features. Higher effort, each needs its own design review. Architecture notes provided here — detailed task plans created per-feature when Wave A is complete.

---

### Task 6: Receipt/Document OCR (Feature #3)

**Architecture:**
- Upload flow: `react-dropzone` → Supabase storage → tRPC `document.extract` mutation
- OCR: Claude Vision API (`@anthropic-ai/sdk`) — send image → extract merchant, amount, date, GST, category suggestion
- Existing infrastructure: `documentExtraction.extractDepreciation()` router, `document.repository.ts`
- New: `document.extractReceipt()` procedure, `ReceiptUploader.tsx` component, `ReceiptReview.tsx` (confirm extracted data → create transaction)
- Free tier: 2 receipts/day. Pro: unlimited.
- Schema: reuse `documents` table, add `extractionType: "receipt" | "depreciation"` column

**Key files to modify:**
- `src/server/routers/documents/documentExtraction.ts` — add `extractReceipt` procedure
- `src/server/services/document/extraction.ts` — receipt extraction logic
- `src/components/documents/ReceiptUploader.tsx` — new camera/upload component
- `src/app/(dashboard)/transactions/page.tsx` — add "Scan Receipt" button

---

### Task 7: Email My Accountant (Feature #4)

**Architecture:**
- One-click export: generate branded PDF package (income/expense summary, property schedule, depreciation, CGT, loans)
- Existing: `jspdf` integration in `mytax-pdf.ts`, `share-pdf.ts`, tax report router, email templates
- New: `accountant-pack-pdf.ts` that assembles multi-section PDF, `reportExport.emailAccountant` procedure
- Email via Resend (`resend` package already installed)
- Accountant email stored in user settings or entered at send time

**Key files to modify:**
- Create: `src/lib/accountant-pack-pdf.ts`
- Modify: `src/server/routers/analytics/reports.ts` — add `emailAccountant` procedure
- Create: `src/lib/email/templates/accountant-pack.ts`
- Modify: `src/app/(dashboard)/reports/export/page.tsx` — add "Email to Accountant" button

---

### Task 8: Sankey Cash Flow Diagrams (Feature #7)

**Architecture:**
- Recharts v3 has native `<Sankey>` component (confirmed via context7)
- Data shape: `{ nodes: [{name: "Rental Income"}, {name: "Mortgage"}, ...], links: [{source: 0, target: 1, value: 2500}] }`
- Source data: cash flow router already calculates income/expense breakdowns
- New procedure: `cashFlow.getSankeyData` — aggregates transactions by category into nodes/links
- Component: `SankeyCashFlow.tsx` wrapping `<Sankey>` in `<ResponsiveContainer>`
- Per-property and portfolio-level views
- Place on cash flow page as new tab alongside calendar/list views

**Key files to modify:**
- Modify: `src/server/routers/lending/cashFlowCalendar.ts` — add `getSankeyData` procedure
- Create: `src/components/cash-flow/SankeyCashFlow.tsx`
- Modify: `src/components/cash-flow/CashFlowClient.tsx` — add "sankey" view mode

---

### Task 9: AI Property Advisor (Feature #6)

**Architecture:**
- Infrastructure exists: chat API route (`src/app/api/chat/route.ts`), ChatProvider, tools system
- Currently feature-flagged off (`featureFlags.aiAssistant`)
- Model: `claude-sonnet-4-20250514` via Vercel AI SDK
- Tools already defined in `services/chat/tools.ts` for read-only data access
- Steps to enable:
  1. Flip feature flag to `true` (or make Pro-tier gated)
  2. Enhance system prompt with full portfolio context injection
  3. Add action tools: categorize transactions, generate reports, run scenarios
  4. Add rate limiting: 10 messages/day free, 100/day Pro
  5. Polish chat UI (markdown rendering, tool result display)

**Key files to modify:**
- Modify: `src/config/feature-flags.ts` — enable or Pro-gate AI
- Modify: `src/server/services/chat/system-prompt.ts` — inject portfolio context
- Modify: `src/server/services/chat/tools.ts` — add action tools
- Modify: `src/app/api/chat/route.ts` — add rate limiting
- Modify: `src/components/chat/ChatProvider.tsx` — plan tier check

---

### Task 10: Improved Onboarding (Feature #15)

**Architecture:**
- Onboarding infrastructure exists: wizard, checklist, tours (driver.js), progress tracking
- Enhancement focus: progressive disclosure, contextual empty states, guided first experience
- Steps:
  1. Simplify wizard to 3 steps: Add Property → Connect Bank → See First Insight
  2. Add contextual empty states to all major pages (transactions, reports, cash flow)
  3. Add "Discover" section on dashboard showing unused features
  4. Improve tour configs for new users
  5. Add "Quick Win" badges (complete profile, add property, connect bank)

**Key files to modify:**
- Modify: `src/components/onboarding/EnhancedWizard.tsx` — simplify steps
- Create: `src/components/shared/EmptyState.tsx` — reusable empty state with CTA
- Modify: `src/components/dashboard/DashboardClient.tsx` — add Discover section
- Modify: `src/config/tours/` — refine tour configs

---

### Task 11: Dashboard Redesign (Feature #12)

**Architecture:**
- Current dashboard has many widgets. Redesign to 3-tier progressive disclosure.
- Tier 1 (always visible): Portfolio value, monthly cash flow, total equity, gross yield, action items
- Tier 2 (expandable): Per-property breakdown, NOI, cap rate, DSCR
- Tier 3 (drill-down): Full reports, scenarios, tax position
- Reuse existing `DashboardClient.tsx` data fetching, restructure layout
- Card-based with interactive mini-graphs in each KPI card
- Responsive: 2-column on desktop, single column on mobile

**Key files to modify:**
- Modify: `src/components/dashboard/DashboardClient.tsx` — restructure layout
- Create: `src/components/dashboard/KpiCard.tsx` — unified KPI card component
- Create: `src/components/dashboard/TierTwoSection.tsx` — expandable details
- Modify: `src/components/dashboard/*.tsx` — refactor existing widgets to fit new layout

---

### Task 12: Mobile-Optimized Views (Feature #14)

**Architecture:**
- PWA-first approach: responsive optimization + "Add to homescreen" prompt
- Focus on 4 mobile views: Portfolio summary, Recent transactions (swipe-to-categorize), Notifications, Quick transaction entry
- Add PWA manifest + service worker for offline portfolio value caching
- Responsive breakpoints: use Tailwind `sm:` / `md:` / `lg:` consistently
- Add `next-pwa` or manual service worker registration

**Key files to modify:**
- Create: `public/manifest.json` — PWA manifest
- Modify: `src/app/layout.tsx` — add manifest link + theme-color meta
- Create: `src/components/mobile/MobilePortfolioSummary.tsx`
- Create: `src/components/mobile/SwipeCategorize.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx` — responsive mobile layout

---

## Execution Notes

### Branch Strategy
Each task = separate branch off `develop`:
- `feature/dark-mode-enhancement`
- `feature/milestone-celebrations`
- `feature/categorization-rules`
- `feature/performance-scorecard`
- `feature/referral-enhancement`
- (Wave B features: branch when starting)

### Test Commands
- Unit tests: `pnpm vitest run <path>`
- All unit tests: `pnpm test:unit`
- E2E tests: `pnpm test:e2e`
- Type check: `npx tsc --noEmit`

### Schema Changes
After modifying any file in `src/server/db/schema/`:
```bash
npx drizzle-kit push
```

### Pre-PR Checklist
1. All unit tests pass: `pnpm test:unit`
2. Type check passes: `npx tsc --noEmit`
3. No lint errors on changed files
4. No anti-patterns introduced (check `.claude/rules/anti-patterns.md`)
5. Context7 consulted for any new library usage
