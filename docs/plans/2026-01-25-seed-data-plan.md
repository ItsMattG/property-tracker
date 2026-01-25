# Seed Data System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified seed data system with demo, dev, and test modes for demos, development, and automated testing.

**Architecture:** Data generators create realistic Australian property portfolio data. Three profiles (demo/dev/test) use shared generators with different configurations. CLI scripts and API endpoint trigger seeding with configurable Clerk ID.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest for tests, tsx for scripts

---

### Task 1: Create Static Data Files

**Files:**
- Create: `src/lib/seed/data/addresses.ts`
- Create: `src/lib/seed/data/banks.ts`
- Create: `src/lib/seed/data/merchants.ts`

**Step 1: Create addresses data file**

Create `src/lib/seed/data/addresses.ts`:

```typescript
export interface AddressData {
  address: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  postcode: string;
}

// Realistic Australian addresses for demo mode
export const demoAddresses: AddressData[] = [
  {
    address: "42 Oxford Street",
    suburb: "Paddington",
    state: "NSW",
    postcode: "2021",
  },
  {
    address: "15 Beach Road",
    suburb: "Brighton",
    state: "VIC",
    postcode: "3186",
  },
  {
    address: "8 James Street",
    suburb: "Fortitude Valley",
    state: "QLD",
    postcode: "4006",
  },
  {
    address: "23 King Street",
    suburb: "Newtown",
    state: "NSW",
    postcode: "2042",
  },
];

// Obviously fake addresses for dev mode
export const devAddresses: AddressData[] = [
  {
    address: "123 Test Street",
    suburb: "Testville",
    state: "NSW",
    postcode: "2000",
  },
  {
    address: "456 Dev Avenue",
    suburb: "Mocktown",
    state: "VIC",
    postcode: "3000",
  },
];
```

**Step 2: Create banks data file**

Create `src/lib/seed/data/banks.ts`:

```typescript
export interface BankData {
  institution: string;
  accountTypes: ("transaction" | "savings" | "mortgage" | "offset")[];
}

// Real Australian banks for demo mode
export const demoBanks: BankData[] = [
  { institution: "Commonwealth Bank", accountTypes: ["transaction", "savings", "offset"] },
  { institution: "ANZ", accountTypes: ["transaction", "savings"] },
  { institution: "Westpac", accountTypes: ["transaction", "mortgage"] },
  { institution: "NAB", accountTypes: ["transaction", "savings"] },
];

// Fake bank for dev mode
export const devBanks: BankData[] = [
  { institution: "Dev Bank Australia", accountTypes: ["transaction", "savings", "offset"] },
];

export interface LenderData {
  name: string;
  rateRange: { min: number; max: number };
}

export const demoLenders: LenderData[] = [
  { name: "Commonwealth Bank", rateRange: { min: 6.0, max: 6.5 } },
  { name: "ANZ", rateRange: { min: 6.1, max: 6.6 } },
  { name: "Westpac", rateRange: { min: 5.9, max: 6.4 } },
];

export const devLenders: LenderData[] = [
  { name: "Test Lender", rateRange: { min: 6.0, max: 6.0 } },
];
```

**Step 3: Create merchants data file**

Create `src/lib/seed/data/merchants.ts`:

```typescript
import type { categoryEnum } from "@/server/db/schema";

type Category = (typeof categoryEnum.enumValues)[number];

export interface MerchantData {
  name: string;
  category: Category;
  amountRange: { min: number; max: number };
  frequency: "monthly" | "quarterly" | "annual" | "sporadic";
}

// Realistic merchants for demo mode
export const demoMerchants: MerchantData[] = [
  // Income
  { name: "REA Group - Rental Income", category: "rental_income", amountRange: { min: 2500, max: 3500 }, frequency: "monthly" },
  // Quarterly expenses
  { name: "Sydney Water Corporation", category: "water_charges", amountRange: { min: 150, max: 300 }, frequency: "quarterly" },
  { name: "City of Sydney Council", category: "council_rates", amountRange: { min: 400, max: 600 }, frequency: "quarterly" },
  // Annual expenses
  { name: "Allianz Insurance", category: "insurance", amountRange: { min: 1200, max: 2000 }, frequency: "annual" },
  { name: "Revenue NSW - Land Tax", category: "land_tax", amountRange: { min: 800, max: 1500 }, frequency: "annual" },
  { name: "Ray White Property Management", category: "property_agent_fees", amountRange: { min: 200, max: 400 }, frequency: "monthly" },
  // Sporadic expenses
  { name: "Jim's Mowing", category: "gardening", amountRange: { min: 80, max: 150 }, frequency: "sporadic" },
  { name: "Fantastic Cleaners", category: "cleaning", amountRange: { min: 150, max: 300 }, frequency: "sporadic" },
  { name: "Local Plumber Co", category: "repairs_and_maintenance", amountRange: { min: 200, max: 800 }, frequency: "sporadic" },
  { name: "Bunnings Warehouse", category: "repairs_and_maintenance", amountRange: { min: 50, max: 200 }, frequency: "sporadic" },
  { name: "Strata Plan 12345", category: "body_corporate", amountRange: { min: 800, max: 1500 }, frequency: "quarterly" },
];

// Fake merchants for dev mode
export const devMerchants: MerchantData[] = [
  { name: "Test Rental Income", category: "rental_income", amountRange: { min: 2000, max: 2000 }, frequency: "monthly" },
  { name: "Test Water", category: "water_charges", amountRange: { min: 200, max: 200 }, frequency: "quarterly" },
  { name: "Test Council", category: "council_rates", amountRange: { min: 500, max: 500 }, frequency: "quarterly" },
  { name: "Test Insurance", category: "insurance", amountRange: { min: 1500, max: 1500 }, frequency: "annual" },
  { name: "Test Repairs", category: "repairs_and_maintenance", amountRange: { min: 300, max: 300 }, frequency: "sporadic" },
];
```

**Step 4: Verify files compile**

Run: `npx tsc --noEmit src/lib/seed/data/*.ts 2>&1 | head -20`

Expected: No errors (or only unrelated existing errors)

**Step 5: Commit**

```bash
git add src/lib/seed/data/
git commit -m "feat(seed): add static data files for addresses, banks, merchants"
```

---

### Task 2: Create Core Seed Types and Utilities

**Files:**
- Create: `src/lib/seed/types.ts`
- Create: `src/lib/seed/utils.ts`

**Step 1: Create types file**

Create `src/lib/seed/types.ts`:

```typescript
export type SeedMode = "demo" | "dev" | "test";

export interface SeedOptions {
  clerkId: string;
  mode: SeedMode;
  clean?: boolean;
  force?: boolean;
}

export interface SeedSummary {
  users: number;
  properties: number;
  bankAccounts: number;
  transactions: number;
  loans: number;
  alerts: number;
  complianceRecords: number;
}

export interface SeedContext {
  userId: string;
  mode: SeedMode;
  startDate: Date;
  endDate: Date;
}

export interface PropertySeedConfig {
  address: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  postcode: string;
  purchasePrice: number;
  purchaseDate: Date;
  entityName?: string;
  status?: "active" | "sold";
  soldAt?: Date;
}

export interface LoanSeedConfig {
  propertyId: string;
  lender: string;
  loanType: "principal_and_interest" | "interest_only";
  rateType: "variable" | "fixed";
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  fixedRateExpiry?: Date;
  repaymentAmount: number;
  repaymentFrequency: string;
}

export interface TransactionPattern {
  merchantName: string;
  category: string;
  transactionType: "income" | "expense";
  frequency: "monthly" | "quarterly" | "annual" | "sporadic";
  amountRange: { min: number; max: number };
  dayOfMonth?: number;
}
```

**Step 2: Create utils file**

Create `src/lib/seed/utils.ts`:

```typescript
import { randomUUID } from "crypto";

/**
 * Generate a deterministic UUID from a seed string.
 * Same seed always produces same UUID.
 */
export function deterministicUUID(seed: string): string {
  // Simple hash-based UUID generation for determinism
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.padEnd(12, "0").slice(0, 12)}`;
}

/**
 * Generate a random amount within a range.
 */
export function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Generate dates for a recurring pattern.
 */
export function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  frequency: "monthly" | "quarterly" | "annual",
  dayOfMonth: number = 15
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setDate(dayOfMonth);

  const monthIncrement = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setMonth(current.getMonth() + monthIncrement);
  }

  return dates;
}

/**
 * Generate sporadic dates (random occurrences).
 */
export function generateSporadicDates(
  startDate: Date,
  endDate: Date,
  averagePerYear: number
): Date[] {
  const dates: Date[] = [];
  const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());
  const expectedCount = Math.round((totalMonths / 12) * averagePerYear);

  for (let i = 0; i < expectedCount; i++) {
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    dates.push(new Date(randomTime));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Format date as YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Add months to a date.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Check if a date falls within a vacancy period.
 */
export function isInVacancyPeriod(
  date: Date,
  vacancyPeriods: { start: Date; end: Date }[]
): boolean {
  return vacancyPeriods.some(
    (period) => date >= period.start && date <= period.end
  );
}
```

**Step 3: Verify files compile**

Run: `npx tsc --noEmit src/lib/seed/types.ts src/lib/seed/utils.ts 2>&1 | head -20`

Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/seed/types.ts src/lib/seed/utils.ts
git commit -m "feat(seed): add core types and utility functions"
```

---

### Task 3: Create Property Generator

**Files:**
- Create: `src/lib/seed/generators/properties.ts`
- Create: `src/lib/seed/__tests__/generators/properties.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/generators/properties.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateProperty, generatePropertySale } from "../../generators/properties";

describe("generateProperty", () => {
  it("creates a property with required fields", () => {
    const property = generateProperty({
      userId: "user-123",
      address: "42 Oxford Street",
      suburb: "Paddington",
      state: "NSW",
      postcode: "2021",
      purchasePrice: 850000,
      purchaseDate: new Date("2020-01-15"),
    });

    expect(property.id).toBeDefined();
    expect(property.userId).toBe("user-123");
    expect(property.address).toBe("42 Oxford Street");
    expect(property.suburb).toBe("Paddington");
    expect(property.state).toBe("NSW");
    expect(property.postcode).toBe("2021");
    expect(property.purchasePrice).toBe("850000.00");
    expect(property.purchaseDate).toBe("2020-01-15");
    expect(property.status).toBe("active");
    expect(property.climateRisk).toBeDefined();
  });

  it("creates a sold property with sale date", () => {
    const property = generateProperty({
      userId: "user-123",
      address: "23 King Street",
      suburb: "Newtown",
      state: "NSW",
      postcode: "2042",
      purchasePrice: 680000,
      purchaseDate: new Date("2020-02-01"),
      status: "sold",
      soldAt: new Date("2024-10-15"),
    });

    expect(property.status).toBe("sold");
    expect(property.soldAt).toBe("2024-10-15");
  });
});

describe("generatePropertySale", () => {
  it("creates a property sale record with CGT calculation", () => {
    const sale = generatePropertySale({
      propertyId: "prop-123",
      userId: "user-123",
      purchasePrice: 680000,
      purchaseDate: new Date("2020-02-01"),
      salePrice: 850000,
      settlementDate: new Date("2024-10-15"),
      agentCommission: 17000,
      legalFees: 2000,
    });

    expect(sale.propertyId).toBe("prop-123");
    expect(sale.salePrice).toBe("850000.00");
    expect(sale.agentCommission).toBe("17000.00");
    expect(sale.heldOverTwelveMonths).toBe(true);
    expect(parseFloat(sale.capitalGain)).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/properties.test.ts`

Expected: FAIL - module not found

**Step 3: Implement the generator**

Create `src/lib/seed/generators/properties.ts`:

```typescript
import { randomUUID } from "crypto";
import type { PropertySeedConfig } from "../types";
import { getClimateRisk } from "@/server/services/climate-risk";
import { formatDate } from "../utils";

export interface GeneratedProperty {
  id: string;
  userId: string;
  address: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
  postcode: string;
  purchasePrice: string;
  purchaseDate: string;
  entityName: string;
  status: "active" | "sold";
  soldAt: string | null;
  climateRisk: ReturnType<typeof getClimateRisk>;
  createdAt: Date;
  updatedAt: Date;
}

export function generateProperty(
  config: PropertySeedConfig & { userId: string }
): GeneratedProperty {
  const climateRisk = getClimateRisk(config.postcode);

  return {
    id: randomUUID(),
    userId: config.userId,
    address: config.address,
    suburb: config.suburb,
    state: config.state,
    postcode: config.postcode,
    purchasePrice: config.purchasePrice.toFixed(2),
    purchaseDate: formatDate(config.purchaseDate),
    entityName: config.entityName ?? "Personal",
    status: config.status ?? "active",
    soldAt: config.soldAt ? formatDate(config.soldAt) : null,
    climateRisk,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface PropertySaleConfig {
  propertyId: string;
  userId: string;
  purchasePrice: number;
  purchaseDate: Date;
  salePrice: number;
  settlementDate: Date;
  contractDate?: Date;
  agentCommission?: number;
  legalFees?: number;
  marketingCosts?: number;
  otherSellingCosts?: number;
}

export interface GeneratedPropertySale {
  id: string;
  propertyId: string;
  userId: string;
  salePrice: string;
  settlementDate: string;
  contractDate: string | null;
  agentCommission: string;
  legalFees: string;
  marketingCosts: string;
  otherSellingCosts: string;
  costBase: string;
  capitalGain: string;
  discountedGain: string | null;
  heldOverTwelveMonths: boolean;
  createdAt: Date;
}

export function generatePropertySale(config: PropertySaleConfig): GeneratedPropertySale {
  const agentCommission = config.agentCommission ?? 0;
  const legalFees = config.legalFees ?? 0;
  const marketingCosts = config.marketingCosts ?? 0;
  const otherSellingCosts = config.otherSellingCosts ?? 0;

  const totalSellingCosts = agentCommission + legalFees + marketingCosts + otherSellingCosts;
  const costBase = config.purchasePrice + totalSellingCosts;
  const capitalGain = config.salePrice - costBase;

  // Check if held over 12 months
  const holdingPeriodMs = config.settlementDate.getTime() - config.purchaseDate.getTime();
  const holdingPeriodMonths = holdingPeriodMs / (1000 * 60 * 60 * 24 * 30.44);
  const heldOverTwelveMonths = holdingPeriodMonths >= 12;

  // 50% CGT discount if held over 12 months and gain is positive
  const discountedGain = heldOverTwelveMonths && capitalGain > 0 ? capitalGain * 0.5 : null;

  return {
    id: randomUUID(),
    propertyId: config.propertyId,
    userId: config.userId,
    salePrice: config.salePrice.toFixed(2),
    settlementDate: formatDate(config.settlementDate),
    contractDate: config.contractDate ? formatDate(config.contractDate) : null,
    agentCommission: agentCommission.toFixed(2),
    legalFees: legalFees.toFixed(2),
    marketingCosts: marketingCosts.toFixed(2),
    otherSellingCosts: otherSellingCosts.toFixed(2),
    costBase: costBase.toFixed(2),
    capitalGain: capitalGain.toFixed(2),
    discountedGain: discountedGain !== null ? discountedGain.toFixed(2) : null,
    heldOverTwelveMonths,
    createdAt: new Date(),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/properties.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/generators/properties.ts src/lib/seed/__tests__/generators/properties.test.ts
git commit -m "feat(seed): add property generator with CGT calculation"
```

---

### Task 4: Create Transaction Generator

**Files:**
- Create: `src/lib/seed/generators/transactions.ts`
- Create: `src/lib/seed/__tests__/generators/transactions.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/generators/transactions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateTransactions, generateBankAccount } from "../../generators/transactions";

describe("generateBankAccount", () => {
  it("creates a bank account with required fields", () => {
    const account = generateBankAccount({
      userId: "user-123",
      institution: "Commonwealth Bank",
      accountName: "Property Expenses",
      accountType: "transaction",
    });

    expect(account.id).toBeDefined();
    expect(account.userId).toBe("user-123");
    expect(account.institution).toBe("Commonwealth Bank");
    expect(account.accountType).toBe("transaction");
    expect(account.isConnected).toBe(true);
  });
});

describe("generateTransactions", () => {
  it("generates monthly rent transactions", () => {
    const transactions = generateTransactions({
      userId: "user-123",
      bankAccountId: "account-123",
      propertyId: "prop-123",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-06-30"),
      patterns: [
        {
          merchantName: "Rental Income",
          category: "rental_income",
          transactionType: "income",
          frequency: "monthly",
          amountRange: { min: 2500, max: 2500 },
          dayOfMonth: 1,
        },
      ],
    });

    expect(transactions.length).toBe(6); // 6 months
    expect(transactions.every((t) => t.category === "rental_income")).toBe(true);
    expect(transactions.every((t) => parseFloat(t.amount) > 0)).toBe(true);
  });

  it("generates quarterly transactions", () => {
    const transactions = generateTransactions({
      userId: "user-123",
      bankAccountId: "account-123",
      propertyId: "prop-123",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      patterns: [
        {
          merchantName: "Water Bill",
          category: "water_charges",
          transactionType: "expense",
          frequency: "quarterly",
          amountRange: { min: 200, max: 200 },
        },
      ],
    });

    expect(transactions.length).toBe(4); // 4 quarters
    expect(transactions.every((t) => parseFloat(t.amount) < 0)).toBe(true);
  });

  it("skips rent during vacancy periods", () => {
    const transactions = generateTransactions({
      userId: "user-123",
      bankAccountId: "account-123",
      propertyId: "prop-123",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-06-30"),
      patterns: [
        {
          merchantName: "Rental Income",
          category: "rental_income",
          transactionType: "income",
          frequency: "monthly",
          amountRange: { min: 2500, max: 2500 },
        },
      ],
      vacancyPeriods: [
        { start: new Date("2024-03-01"), end: new Date("2024-04-30") },
      ],
    });

    // Should skip March and April
    expect(transactions.length).toBe(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/transactions.test.ts`

Expected: FAIL

**Step 3: Implement the generator**

Create `src/lib/seed/generators/transactions.ts`:

```typescript
import { randomUUID } from "crypto";
import type { TransactionPattern } from "../types";
import {
  generateRecurringDates,
  generateSporadicDates,
  randomAmount,
  formatDate,
  isInVacancyPeriod,
} from "../utils";

export interface BankAccountConfig {
  userId: string;
  institution: string;
  accountName: string;
  accountType: "transaction" | "savings" | "mortgage" | "offset" | "credit_card" | "line_of_credit";
  defaultPropertyId?: string;
}

export interface GeneratedBankAccount {
  id: string;
  userId: string;
  basiqConnectionId: string;
  basiqAccountId: string;
  institution: string;
  accountName: string;
  accountNumberMasked: string;
  accountType: "transaction" | "savings" | "mortgage" | "offset" | "credit_card" | "line_of_credit";
  defaultPropertyId: string | null;
  isConnected: boolean;
  connectionStatus: "connected" | "disconnected" | "error";
  lastSyncedAt: Date;
  createdAt: Date;
}

export function generateBankAccount(config: BankAccountConfig): GeneratedBankAccount {
  const id = randomUUID();
  return {
    id,
    userId: config.userId,
    basiqConnectionId: `seed_conn_${id.slice(0, 8)}`,
    basiqAccountId: `seed_acct_${id.slice(0, 8)}`,
    institution: config.institution,
    accountName: config.accountName,
    accountNumberMasked: `****${Math.floor(1000 + Math.random() * 9000)}`,
    accountType: config.accountType,
    defaultPropertyId: config.defaultPropertyId ?? null,
    isConnected: true,
    connectionStatus: "connected",
    lastSyncedAt: new Date(),
    createdAt: new Date(),
  };
}

export interface TransactionGeneratorConfig {
  userId: string;
  bankAccountId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  patterns: TransactionPattern[];
  vacancyPeriods?: { start: Date; end: Date }[];
}

export interface GeneratedTransaction {
  id: string;
  userId: string;
  bankAccountId: string;
  basiqTransactionId: string;
  propertyId: string;
  date: string;
  description: string;
  amount: string;
  category: string;
  transactionType: "income" | "expense" | "capital" | "transfer" | "personal";
  isDeductible: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function generateTransactions(
  config: TransactionGeneratorConfig
): GeneratedTransaction[] {
  const transactions: GeneratedTransaction[] = [];
  const vacancyPeriods = config.vacancyPeriods ?? [];

  for (const pattern of config.patterns) {
    let dates: Date[];

    if (pattern.frequency === "sporadic") {
      dates = generateSporadicDates(config.startDate, config.endDate, 4);
    } else {
      dates = generateRecurringDates(
        config.startDate,
        config.endDate,
        pattern.frequency,
        pattern.dayOfMonth ?? 15
      );
    }

    for (const date of dates) {
      // Skip rent during vacancy periods
      if (
        pattern.category === "rental_income" &&
        isInVacancyPeriod(date, vacancyPeriods)
      ) {
        continue;
      }

      const amount = randomAmount(pattern.amountRange.min, pattern.amountRange.max);
      const signedAmount = pattern.transactionType === "income" ? amount : -amount;

      const id = randomUUID();
      transactions.push({
        id,
        userId: config.userId,
        bankAccountId: config.bankAccountId,
        basiqTransactionId: `seed_txn_${id.slice(0, 8)}`,
        propertyId: config.propertyId,
        date: formatDate(date),
        description: pattern.merchantName,
        amount: signedAmount.toFixed(2),
        category: pattern.category,
        transactionType: pattern.transactionType,
        isDeductible: pattern.transactionType === "expense",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/transactions.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/generators/transactions.ts src/lib/seed/__tests__/generators/transactions.test.ts
git commit -m "feat(seed): add transaction generator with vacancy support"
```

---

### Task 5: Create Loan Generator

**Files:**
- Create: `src/lib/seed/generators/loans.ts`
- Create: `src/lib/seed/__tests__/generators/loans.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/generators/loans.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateLoan, generateRefinanceAlert } from "../../generators/loans";

describe("generateLoan", () => {
  it("creates a P&I loan", () => {
    const loan = generateLoan({
      userId: "user-123",
      propertyId: "prop-123",
      lender: "Commonwealth Bank",
      loanType: "principal_and_interest",
      rateType: "variable",
      originalAmount: 680000,
      currentBalance: 620000,
      interestRate: 6.29,
      repaymentAmount: 4200,
      repaymentFrequency: "monthly",
    });

    expect(loan.id).toBeDefined();
    expect(loan.loanType).toBe("principal_and_interest");
    expect(loan.rateType).toBe("variable");
    expect(loan.interestRate).toBe("6.29");
  });

  it("creates a fixed rate loan with expiry", () => {
    const loan = generateLoan({
      userId: "user-123",
      propertyId: "prop-123",
      lender: "ANZ",
      loanType: "interest_only",
      rateType: "fixed",
      originalAmount: 576000,
      currentBalance: 576000,
      interestRate: 6.45,
      fixedRateExpiry: new Date("2026-02-28"),
      repaymentAmount: 3100,
      repaymentFrequency: "monthly",
    });

    expect(loan.rateType).toBe("fixed");
    expect(loan.fixedRateExpiry).toBe("2026-02-28");
  });
});

describe("generateRefinanceAlert", () => {
  it("creates a refinance alert for a loan", () => {
    const alert = generateRefinanceAlert({
      loanId: "loan-123",
      enabled: true,
      rateGapThreshold: 0.5,
    });

    expect(alert.loanId).toBe("loan-123");
    expect(alert.enabled).toBe(true);
    expect(alert.rateGapThreshold).toBe("0.50");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/loans.test.ts`

Expected: FAIL

**Step 3: Implement the generator**

Create `src/lib/seed/generators/loans.ts`:

```typescript
import { randomUUID } from "crypto";
import type { LoanSeedConfig } from "../types";
import { formatDate } from "../utils";

export interface GeneratedLoan {
  id: string;
  userId: string;
  propertyId: string;
  lender: string;
  accountNumberMasked: string;
  loanType: "principal_and_interest" | "interest_only";
  rateType: "variable" | "fixed" | "split";
  originalAmount: string;
  currentBalance: string;
  interestRate: string;
  fixedRateExpiry: string | null;
  repaymentAmount: string;
  repaymentFrequency: string;
  offsetAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function generateLoan(
  config: LoanSeedConfig & { userId: string; offsetAccountId?: string }
): GeneratedLoan {
  return {
    id: randomUUID(),
    userId: config.userId,
    propertyId: config.propertyId,
    lender: config.lender,
    accountNumberMasked: `****${Math.floor(1000 + Math.random() * 9000)}`,
    loanType: config.loanType,
    rateType: config.rateType,
    originalAmount: config.originalAmount.toFixed(2),
    currentBalance: config.currentBalance.toFixed(2),
    interestRate: config.interestRate.toFixed(2),
    fixedRateExpiry: config.fixedRateExpiry ? formatDate(config.fixedRateExpiry) : null,
    repaymentAmount: config.repaymentAmount.toFixed(2),
    repaymentFrequency: config.repaymentFrequency,
    offsetAccountId: config.offsetAccountId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export interface RefinanceAlertConfig {
  loanId: string;
  enabled?: boolean;
  rateGapThreshold?: number;
  notifyOnCashRateChange?: boolean;
}

export interface GeneratedRefinanceAlert {
  id: string;
  loanId: string;
  enabled: boolean;
  rateGapThreshold: string;
  notifyOnCashRateChange: boolean;
  lastAlertedAt: Date | null;
  createdAt: Date;
}

export function generateRefinanceAlert(config: RefinanceAlertConfig): GeneratedRefinanceAlert {
  return {
    id: randomUUID(),
    loanId: config.loanId,
    enabled: config.enabled ?? true,
    rateGapThreshold: (config.rateGapThreshold ?? 0.5).toFixed(2),
    notifyOnCashRateChange: config.notifyOnCashRateChange ?? true,
    lastAlertedAt: null,
    createdAt: new Date(),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/loans.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/generators/loans.ts src/lib/seed/__tests__/generators/loans.test.ts
git commit -m "feat(seed): add loan generator with refinance alerts"
```

---

### Task 6: Create Alerts Generator

**Files:**
- Create: `src/lib/seed/generators/alerts.ts`
- Create: `src/lib/seed/__tests__/generators/alerts.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/generators/alerts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateAnomalyAlert, generateConnectionAlert } from "../../generators/alerts";

describe("generateAnomalyAlert", () => {
  it("creates a missed rent alert", () => {
    const alert = generateAnomalyAlert({
      userId: "user-123",
      propertyId: "prop-123",
      alertType: "missed_rent",
      severity: "warning",
      description: "Expected rent payment not received",
    });

    expect(alert.alertType).toBe("missed_rent");
    expect(alert.severity).toBe("warning");
    expect(alert.status).toBe("active");
  });

  it("creates an unusual amount alert", () => {
    const alert = generateAnomalyAlert({
      userId: "user-123",
      propertyId: "prop-123",
      alertType: "unusual_amount",
      severity: "info",
      description: "Plumber charge $4,500 is higher than typical $200-800",
      transactionId: "txn-123",
    });

    expect(alert.alertType).toBe("unusual_amount");
    expect(alert.transactionId).toBe("txn-123");
  });
});

describe("generateConnectionAlert", () => {
  it("creates a disconnected bank alert", () => {
    const alert = generateConnectionAlert({
      userId: "user-123",
      bankAccountId: "account-123",
      alertType: "disconnected",
      errorMessage: "Bank connection expired",
    });

    expect(alert.alertType).toBe("disconnected");
    expect(alert.status).toBe("active");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/alerts.test.ts`

Expected: FAIL

**Step 3: Implement the generator**

Create `src/lib/seed/generators/alerts.ts`:

```typescript
import { randomUUID } from "crypto";

export interface AnomalyAlertConfig {
  userId: string;
  propertyId?: string;
  alertType: "missed_rent" | "unusual_amount" | "unexpected_expense" | "duplicate_transaction";
  severity: "info" | "warning" | "critical";
  description: string;
  suggestedAction?: string;
  transactionId?: string;
  recurringId?: string;
  expectedTransactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedAnomalyAlert {
  id: string;
  userId: string;
  propertyId: string | null;
  alertType: "missed_rent" | "unusual_amount" | "unexpected_expense" | "duplicate_transaction";
  severity: "info" | "warning" | "critical";
  transactionId: string | null;
  recurringId: string | null;
  expectedTransactionId: string | null;
  description: string;
  suggestedAction: string | null;
  metadata: string | null;
  status: "active" | "dismissed" | "resolved";
  dismissalCount: string;
  createdAt: Date;
  dismissedAt: Date | null;
  resolvedAt: Date | null;
}

export function generateAnomalyAlert(config: AnomalyAlertConfig): GeneratedAnomalyAlert {
  return {
    id: randomUUID(),
    userId: config.userId,
    propertyId: config.propertyId ?? null,
    alertType: config.alertType,
    severity: config.severity,
    transactionId: config.transactionId ?? null,
    recurringId: config.recurringId ?? null,
    expectedTransactionId: config.expectedTransactionId ?? null,
    description: config.description,
    suggestedAction: config.suggestedAction ?? null,
    metadata: config.metadata ? JSON.stringify(config.metadata) : null,
    status: "active",
    dismissalCount: "0",
    createdAt: new Date(),
    dismissedAt: null,
    resolvedAt: null,
  };
}

export interface ConnectionAlertConfig {
  userId: string;
  bankAccountId: string;
  alertType: "disconnected" | "requires_reauth" | "sync_failed";
  errorMessage?: string;
}

export interface GeneratedConnectionAlert {
  id: string;
  userId: string;
  bankAccountId: string;
  alertType: "disconnected" | "requires_reauth" | "sync_failed";
  status: "active" | "dismissed" | "resolved";
  errorMessage: string | null;
  emailSentAt: Date | null;
  createdAt: Date;
  dismissedAt: Date | null;
  resolvedAt: Date | null;
}

export function generateConnectionAlert(config: ConnectionAlertConfig): GeneratedConnectionAlert {
  return {
    id: randomUUID(),
    userId: config.userId,
    bankAccountId: config.bankAccountId,
    alertType: config.alertType,
    status: "active",
    errorMessage: config.errorMessage ?? null,
    emailSentAt: null,
    createdAt: new Date(),
    dismissedAt: null,
    resolvedAt: null,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/alerts.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/generators/alerts.ts src/lib/seed/__tests__/generators/alerts.test.ts
git commit -m "feat(seed): add anomaly and connection alert generators"
```

---

### Task 7: Create Compliance Generator

**Files:**
- Create: `src/lib/seed/generators/compliance.ts`
- Create: `src/lib/seed/__tests__/generators/compliance.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/generators/compliance.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateComplianceRecord } from "../../generators/compliance";

describe("generateComplianceRecord", () => {
  it("creates a compliance record", () => {
    const record = generateComplianceRecord({
      propertyId: "prop-123",
      userId: "user-123",
      requirementId: "smoke_alarms",
      completedAt: new Date("2024-01-15"),
      nextDueAt: new Date("2025-01-15"),
    });

    expect(record.requirementId).toBe("smoke_alarms");
    expect(record.completedAt).toBe("2024-01-15");
    expect(record.nextDueAt).toBe("2025-01-15");
  });

  it("creates an overdue compliance record", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);

    const record = generateComplianceRecord({
      propertyId: "prop-123",
      userId: "user-123",
      requirementId: "smoke_alarms",
      completedAt: new Date("2023-01-15"),
      nextDueAt: pastDate,
    });

    expect(new Date(record.nextDueAt) < new Date()).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/compliance.test.ts`

Expected: FAIL

**Step 3: Implement the generator**

Create `src/lib/seed/generators/compliance.ts`:

```typescript
import { randomUUID } from "crypto";
import { formatDate } from "../utils";

export interface ComplianceRecordConfig {
  propertyId: string;
  userId: string;
  requirementId: string;
  completedAt: Date;
  nextDueAt: Date;
  notes?: string;
  documentId?: string;
}

export interface GeneratedComplianceRecord {
  id: string;
  propertyId: string;
  userId: string;
  requirementId: string;
  completedAt: string;
  nextDueAt: string;
  notes: string | null;
  documentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function generateComplianceRecord(
  config: ComplianceRecordConfig
): GeneratedComplianceRecord {
  return {
    id: randomUUID(),
    propertyId: config.propertyId,
    userId: config.userId,
    requirementId: config.requirementId,
    completedAt: formatDate(config.completedAt),
    nextDueAt: formatDate(config.nextDueAt),
    notes: config.notes ?? null,
    documentId: config.documentId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate standard compliance records for an Australian rental property.
 */
export function generateStandardComplianceRecords(
  propertyId: string,
  userId: string,
  state: string,
  purchaseDate: Date,
  options?: { includeOverdue?: boolean }
): GeneratedComplianceRecord[] {
  const records: GeneratedComplianceRecord[] = [];
  const now = new Date();

  // Smoke alarms - annual check
  const smokeAlarmDate = new Date(now);
  smokeAlarmDate.setFullYear(smokeAlarmDate.getFullYear() - 1);
  const smokeAlarmDue = new Date(smokeAlarmDate);
  smokeAlarmDue.setFullYear(smokeAlarmDue.getFullYear() + 1);

  // Make one overdue if requested
  if (options?.includeOverdue) {
    smokeAlarmDue.setMonth(smokeAlarmDue.getMonth() - 2);
  }

  records.push(
    generateComplianceRecord({
      propertyId,
      userId,
      requirementId: "smoke_alarms",
      completedAt: smokeAlarmDate,
      nextDueAt: smokeAlarmDue,
    })
  );

  // Gas safety - biennial in VIC
  if (state === "VIC") {
    const gasDate = new Date(now);
    gasDate.setFullYear(gasDate.getFullYear() - 1);
    records.push(
      generateComplianceRecord({
        propertyId,
        userId,
        requirementId: "gas_safety_vic",
        completedAt: gasDate,
        nextDueAt: new Date(gasDate.setFullYear(gasDate.getFullYear() + 2)),
      })
    );
  }

  // Electrical safety - varies by state
  if (state === "QLD") {
    const electricalDate = new Date(now);
    electricalDate.setFullYear(electricalDate.getFullYear() - 2);
    records.push(
      generateComplianceRecord({
        propertyId,
        userId,
        requirementId: "electrical_safety_qld",
        completedAt: electricalDate,
        nextDueAt: new Date(electricalDate.setFullYear(electricalDate.getFullYear() + 5)),
      })
    );
  }

  return records;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/generators/compliance.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/generators/compliance.ts src/lib/seed/__tests__/generators/compliance.test.ts
git commit -m "feat(seed): add compliance record generator"
```

---

### Task 8: Create Generator Index File

**Files:**
- Create: `src/lib/seed/generators/index.ts`

**Step 1: Create the index file**

Create `src/lib/seed/generators/index.ts`:

```typescript
export {
  generateProperty,
  generatePropertySale,
  type GeneratedProperty,
  type GeneratedPropertySale,
} from "./properties";

export {
  generateBankAccount,
  generateTransactions,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type TransactionGeneratorConfig,
} from "./transactions";

export {
  generateLoan,
  generateRefinanceAlert,
  type GeneratedLoan,
  type GeneratedRefinanceAlert,
} from "./loans";

export {
  generateAnomalyAlert,
  generateConnectionAlert,
  type GeneratedAnomalyAlert,
  type GeneratedConnectionAlert,
} from "./alerts";

export {
  generateComplianceRecord,
  generateStandardComplianceRecords,
  type GeneratedComplianceRecord,
} from "./compliance";
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/seed/generators/index.ts 2>&1 | head -20`

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/seed/generators/index.ts
git commit -m "feat(seed): add generators index file"
```

---

### Task 9: Create Demo Profile

**Files:**
- Create: `src/lib/seed/profiles/demo.ts`
- Create: `src/lib/seed/__tests__/profiles/demo.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/profiles/demo.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateDemoData } from "../../profiles/demo";

describe("generateDemoData", () => {
  it("generates 4 properties (1 sold)", () => {
    const data = generateDemoData("user-123");

    expect(data.properties).toHaveLength(4);
    expect(data.properties.filter((p) => p.status === "sold")).toHaveLength(1);
    expect(data.properties.filter((p) => p.status === "active")).toHaveLength(3);
  });

  it("generates loans for active properties only", () => {
    const data = generateDemoData("user-123");

    expect(data.loans).toHaveLength(3);
  });

  it("generates property sale for sold property", () => {
    const data = generateDemoData("user-123");

    expect(data.propertySales).toHaveLength(1);
  });

  it("generates transactions spanning 5 years", () => {
    const data = generateDemoData("user-123");

    const dates = data.transactions.map((t) => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const yearSpan = (maxDate.getFullYear() - minDate.getFullYear());
    expect(yearSpan).toBeGreaterThanOrEqual(4);
  });

  it("generates anomaly alerts", () => {
    const data = generateDemoData("user-123");

    expect(data.anomalyAlerts.length).toBeGreaterThan(0);
    expect(data.anomalyAlerts.some((a) => a.alertType === "missed_rent")).toBe(true);
  });

  it("generates compliance records with one overdue", () => {
    const data = generateDemoData("user-123");

    expect(data.complianceRecords.length).toBeGreaterThan(0);
    const hasOverdue = data.complianceRecords.some(
      (r) => new Date(r.nextDueAt) < new Date()
    );
    expect(hasOverdue).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/profiles/demo.test.ts`

Expected: FAIL

**Step 3: Implement the demo profile**

Create `src/lib/seed/profiles/demo.ts`:

```typescript
import { demoAddresses } from "../data/addresses";
import { demoBanks, demoLenders } from "../data/banks";
import { demoMerchants } from "../data/merchants";
import {
  generateProperty,
  generatePropertySale,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateRefinanceAlert,
  generateAnomalyAlert,
  generateStandardComplianceRecords,
  type GeneratedProperty,
  type GeneratedPropertySale,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedRefinanceAlert,
  type GeneratedAnomalyAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths } from "../utils";

export interface DemoData {
  properties: GeneratedProperty[];
  propertySales: GeneratedPropertySale[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
  refinanceAlerts: GeneratedRefinanceAlert[];
  anomalyAlerts: GeneratedAnomalyAlert[];
  complianceRecords: GeneratedComplianceRecord[];
}

export function generateDemoData(userId: string): DemoData {
  const now = new Date();
  const fiveYearsAgo = addMonths(now, -60);

  // Property configurations matching the design doc
  const propertyConfigs = [
    {
      ...demoAddresses[0],
      purchasePrice: 850000,
      purchaseDate: new Date("2020-01-15"),
      status: "active" as const,
      rentAmount: 3200,
      loan: { amount: 680000, balance: 620000, rate: 6.29, type: "principal_and_interest" as const, rateType: "variable" as const, lender: "Commonwealth Bank" },
    },
    {
      ...demoAddresses[1],
      purchasePrice: 720000,
      purchaseDate: new Date("2021-03-01"),
      status: "active" as const,
      rentAmount: 2800,
      loan: { amount: 576000, balance: 576000, rate: 6.45, type: "interest_only" as const, rateType: "fixed" as const, lender: "ANZ", fixedExpiry: addMonths(now, 1) },
    },
    {
      ...demoAddresses[2],
      purchasePrice: 550000,
      purchaseDate: new Date("2022-06-15"),
      status: "active" as const,
      rentAmount: 2500,
      loan: { amount: 440000, balance: 410000, rate: 6.15, type: "principal_and_interest" as const, rateType: "variable" as const, lender: "Westpac" },
    },
    {
      ...demoAddresses[3],
      purchasePrice: 680000,
      purchaseDate: new Date("2020-02-01"),
      status: "sold" as const,
      soldAt: new Date("2024-10-15"),
      salePrice: 850000,
      rentAmount: 2600,
    },
  ];

  const properties: GeneratedProperty[] = [];
  const propertySales: GeneratedPropertySale[] = [];
  const bankAccounts: GeneratedBankAccount[] = [];
  const transactions: GeneratedTransaction[] = [];
  const loans: GeneratedLoan[] = [];
  const refinanceAlerts: GeneratedRefinanceAlert[] = [];
  const anomalyAlerts: GeneratedAnomalyAlert[] = [];
  const complianceRecords: GeneratedComplianceRecord[] = [];

  // Create main bank account
  const mainAccount = generateBankAccount({
    userId,
    institution: demoBanks[0].institution,
    accountName: "Property Investment Account",
    accountType: "transaction",
  });
  bankAccounts.push(mainAccount);

  // Create offset account for property 1
  const offsetAccount = generateBankAccount({
    userId,
    institution: demoBanks[0].institution,
    accountName: "Offset Account",
    accountType: "offset",
  });
  bankAccounts.push(offsetAccount);

  for (let i = 0; i < propertyConfigs.length; i++) {
    const config = propertyConfigs[i];

    // Generate property
    const property = generateProperty({
      userId,
      address: config.address,
      suburb: config.suburb,
      state: config.state,
      postcode: config.postcode,
      purchasePrice: config.purchasePrice,
      purchaseDate: config.purchaseDate,
      status: config.status,
      soldAt: config.soldAt,
    });
    properties.push(property);

    // Generate transactions for this property
    const transactionEndDate = config.status === "sold" ? config.soldAt! : now;
    const vacancyPeriods = [
      { start: addMonths(config.purchaseDate, 18), end: addMonths(config.purchaseDate, 19) },
    ];

    // Build patterns for this property
    const patterns = [
      {
        merchantName: `Rental Income - ${config.suburb}`,
        category: "rental_income",
        transactionType: "income" as const,
        frequency: "monthly" as const,
        amountRange: { min: config.rentAmount, max: config.rentAmount + 100 },
        dayOfMonth: 1,
      },
      ...demoMerchants.filter((m) => m.category !== "rental_income").map((m) => ({
        merchantName: m.name,
        category: m.category,
        transactionType: "expense" as const,
        frequency: m.frequency,
        amountRange: m.amountRange,
      })),
    ];

    const propertyTransactions = generateTransactions({
      userId,
      bankAccountId: mainAccount.id,
      propertyId: property.id,
      startDate: config.purchaseDate,
      endDate: transactionEndDate,
      patterns,
      vacancyPeriods,
    });
    transactions.push(...propertyTransactions);

    // Generate loan for active properties
    if (config.status === "active" && config.loan) {
      const loan = generateLoan({
        userId,
        propertyId: property.id,
        lender: config.loan.lender,
        loanType: config.loan.type,
        rateType: config.loan.rateType,
        originalAmount: config.loan.amount,
        currentBalance: config.loan.balance,
        interestRate: config.loan.rate,
        fixedRateExpiry: config.loan.fixedExpiry,
        repaymentAmount: config.loan.type === "interest_only" ? config.loan.balance * (config.loan.rate / 100 / 12) : config.loan.amount * 0.006,
        repaymentFrequency: "monthly",
        offsetAccountId: i === 0 ? offsetAccount.id : undefined,
      });
      loans.push(loan);

      // Refinance alert for fixed rate expiring soon
      if (config.loan.fixedExpiry) {
        refinanceAlerts.push(generateRefinanceAlert({
          loanId: loan.id,
          enabled: true,
          rateGapThreshold: 0.5,
        }));
      }
    }

    // Generate property sale for sold property
    if (config.status === "sold" && config.salePrice) {
      propertySales.push(generatePropertySale({
        propertyId: property.id,
        userId,
        purchasePrice: config.purchasePrice,
        purchaseDate: config.purchaseDate,
        salePrice: config.salePrice,
        settlementDate: config.soldAt!,
        agentCommission: config.salePrice * 0.02,
        legalFees: 2000,
      }));
    }

    // Generate compliance records (with one overdue for first property)
    complianceRecords.push(
      ...generateStandardComplianceRecords(
        property.id,
        userId,
        config.state,
        config.purchaseDate,
        { includeOverdue: i === 0 }
      )
    );
  }

  // Add anomaly alerts
  // Missed rent for property 2
  anomalyAlerts.push(generateAnomalyAlert({
    userId,
    propertyId: properties[1].id,
    alertType: "missed_rent",
    severity: "warning",
    description: `Expected rent payment of $${propertyConfigs[1].rentAmount} not received for ${propertyConfigs[1].suburb}`,
    suggestedAction: "Contact property manager to follow up with tenant",
  }));

  // Unusual expense - find a repair transaction and flag it
  const repairTxn = transactions.find((t) =>
    t.category === "repairs_and_maintenance" &&
    Math.abs(parseFloat(t.amount)) > 1000
  );
  if (repairTxn) {
    // Add an unusually high plumber expense
    const highExpense = generateTransactions({
      userId,
      bankAccountId: mainAccount.id,
      propertyId: properties[0].id,
      startDate: addMonths(now, -1),
      endDate: now,
      patterns: [{
        merchantName: "Emergency Plumber Services",
        category: "repairs_and_maintenance",
        transactionType: "expense",
        frequency: "sporadic",
        amountRange: { min: 4500, max: 4500 },
      }],
    })[0];

    if (highExpense) {
      transactions.push(highExpense);
      anomalyAlerts.push(generateAnomalyAlert({
        userId,
        propertyId: properties[0].id,
        alertType: "unusual_amount",
        severity: "info",
        description: "Plumber charge of $4,500 is significantly higher than typical range ($200-$800)",
        transactionId: highExpense.id,
        suggestedAction: "Review invoice to confirm this is a legitimate expense",
      }));
    }
  }

  return {
    properties,
    propertySales,
    bankAccounts,
    transactions,
    loans,
    refinanceAlerts,
    anomalyAlerts,
    complianceRecords,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/profiles/demo.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/profiles/demo.ts src/lib/seed/__tests__/profiles/demo.test.ts
git commit -m "feat(seed): add demo profile with 5-year realistic data"
```

---

### Task 10: Create Dev Profile

**Files:**
- Create: `src/lib/seed/profiles/dev.ts`
- Create: `src/lib/seed/__tests__/profiles/dev.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/profiles/dev.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateDevData } from "../../profiles/dev";

describe("generateDevData", () => {
  it("generates 2 properties", () => {
    const data = generateDevData("user-123");

    expect(data.properties).toHaveLength(2);
    expect(data.properties.every((p) => p.status === "active")).toBe(true);
  });

  it("uses obviously fake addresses", () => {
    const data = generateDevData("user-123");

    expect(data.properties[0].address).toContain("Test");
    expect(data.properties[1].address).toContain("Dev");
  });

  it("generates ~100 transactions over 1 year", () => {
    const data = generateDevData("user-123");

    expect(data.transactions.length).toBeGreaterThan(50);
    expect(data.transactions.length).toBeLessThan(150);
  });

  it("generates one of each alert type", () => {
    const data = generateDevData("user-123");

    const alertTypes = data.anomalyAlerts.map((a) => a.alertType);
    expect(alertTypes).toContain("missed_rent");
    expect(alertTypes).toContain("unusual_amount");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/profiles/dev.test.ts`

Expected: FAIL

**Step 3: Implement the dev profile**

Create `src/lib/seed/profiles/dev.ts`:

```typescript
import { devAddresses } from "../data/addresses";
import { devBanks, devLenders } from "../data/banks";
import { devMerchants } from "../data/merchants";
import {
  generateProperty,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateAnomalyAlert,
  generateConnectionAlert,
  generateComplianceRecord,
  type GeneratedProperty,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedAnomalyAlert,
  type GeneratedConnectionAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths, formatDate } from "../utils";

export interface DevData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
  anomalyAlerts: GeneratedAnomalyAlert[];
  connectionAlerts: GeneratedConnectionAlert[];
  complianceRecords: GeneratedComplianceRecord[];
}

export function generateDevData(userId: string): DevData {
  const now = new Date();
  const oneYearAgo = addMonths(now, -12);

  const properties: GeneratedProperty[] = [];
  const bankAccounts: GeneratedBankAccount[] = [];
  const transactions: GeneratedTransaction[] = [];
  const loans: GeneratedLoan[] = [];
  const anomalyAlerts: GeneratedAnomalyAlert[] = [];
  const connectionAlerts: GeneratedConnectionAlert[] = [];
  const complianceRecords: GeneratedComplianceRecord[] = [];

  // Create bank account
  const mainAccount = generateBankAccount({
    userId,
    institution: devBanks[0].institution,
    accountName: "Test Property Account",
    accountType: "transaction",
  });
  bankAccounts.push(mainAccount);

  // Create two properties with dev addresses
  for (let i = 0; i < devAddresses.length; i++) {
    const addr = devAddresses[i];
    const purchaseDate = i === 0 ? new Date("2024-01-01") : new Date("2024-06-01");

    const property = generateProperty({
      userId,
      address: addr.address,
      suburb: addr.suburb,
      state: addr.state,
      postcode: addr.postcode,
      purchasePrice: i === 0 ? 500000 : 400000,
      purchaseDate,
    });
    properties.push(property);

    // Generate transactions
    const patterns = devMerchants.map((m) => ({
      merchantName: m.name,
      category: m.category,
      transactionType: m.category === "rental_income" ? "income" as const : "expense" as const,
      frequency: m.frequency,
      amountRange: m.amountRange,
    }));

    const propertyTransactions = generateTransactions({
      userId,
      bankAccountId: mainAccount.id,
      propertyId: property.id,
      startDate: purchaseDate,
      endDate: now,
      patterns,
    });
    transactions.push(...propertyTransactions);

    // Generate loan
    const loan = generateLoan({
      userId,
      propertyId: property.id,
      lender: devLenders[0].name,
      loanType: "principal_and_interest",
      rateType: "variable",
      originalAmount: i === 0 ? 400000 : 320000,
      currentBalance: i === 0 ? 390000 : 315000,
      interestRate: 6.0,
      repaymentAmount: 2500,
      repaymentFrequency: "monthly",
    });
    loans.push(loan);

    // Generate compliance record
    complianceRecords.push(generateComplianceRecord({
      propertyId: property.id,
      userId,
      requirementId: "smoke_alarms",
      completedAt: purchaseDate,
      nextDueAt: addMonths(purchaseDate, 12),
    }));
  }

  // Add one of each alert type
  anomalyAlerts.push(generateAnomalyAlert({
    userId,
    propertyId: properties[0].id,
    alertType: "missed_rent",
    severity: "warning",
    description: "Test missed rent alert",
  }));

  anomalyAlerts.push(generateAnomalyAlert({
    userId,
    propertyId: properties[0].id,
    alertType: "unusual_amount",
    severity: "info",
    description: "Test unusual amount alert",
  }));

  anomalyAlerts.push(generateAnomalyAlert({
    userId,
    propertyId: properties[1].id,
    alertType: "unexpected_expense",
    severity: "info",
    description: "Test unexpected expense alert",
  }));

  // Add a connection alert
  connectionAlerts.push(generateConnectionAlert({
    userId,
    bankAccountId: mainAccount.id,
    alertType: "sync_failed",
    errorMessage: "Test sync failure",
  }));

  return {
    properties,
    bankAccounts,
    transactions,
    loans,
    anomalyAlerts,
    connectionAlerts,
    complianceRecords,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/profiles/dev.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/profiles/dev.ts src/lib/seed/__tests__/profiles/dev.test.ts
git commit -m "feat(seed): add dev profile with fake test data"
```

---

### Task 11: Create Test Fixtures Profile

**Files:**
- Create: `src/lib/seed/profiles/test.ts`
- Create: `src/lib/seed/__tests__/profiles/test.test.ts`

**Step 1: Write the test**

Create `src/lib/seed/__tests__/profiles/test.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  seedMinimalPortfolio,
  seedMultiPropertyPortfolio,
  seedCGTScenario,
  seedAnomalyScenario,
} from "../../profiles/test";

describe("test fixtures", () => {
  describe("seedMinimalPortfolio", () => {
    it("creates 1 property, 1 loan, and transactions", () => {
      const data = seedMinimalPortfolio("user-123");

      expect(data.properties).toHaveLength(1);
      expect(data.loans).toHaveLength(1);
      expect(data.transactions.length).toBeGreaterThan(0);
      expect(data.transactions.length).toBeLessThanOrEqual(10);
    });
  });

  describe("seedMultiPropertyPortfolio", () => {
    it("creates 3 properties for list testing", () => {
      const data = seedMultiPropertyPortfolio("user-123");

      expect(data.properties).toHaveLength(3);
    });
  });

  describe("seedCGTScenario", () => {
    it("creates a sold property with sale record", () => {
      const data = seedCGTScenario("user-123");

      expect(data.properties).toHaveLength(1);
      expect(data.properties[0].status).toBe("sold");
      expect(data.propertySales).toHaveLength(1);
    });
  });

  describe("seedAnomalyScenario", () => {
    it("creates property with various alert types", () => {
      const data = seedAnomalyScenario("user-123");

      expect(data.properties).toHaveLength(1);
      expect(data.anomalyAlerts.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/seed/__tests__/profiles/test.test.ts`

Expected: FAIL

**Step 3: Implement the test fixtures**

Create `src/lib/seed/profiles/test.ts`:

```typescript
import {
  generateProperty,
  generatePropertySale,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateAnomalyAlert,
  generateComplianceRecord,
  type GeneratedProperty,
  type GeneratedPropertySale,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedAnomalyAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths } from "../utils";

export interface MinimalPortfolioData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
}

/**
 * Minimal fixture: 1 property, 1 loan, 5 transactions
 */
export function seedMinimalPortfolio(userId: string): MinimalPortfolioData {
  const now = new Date();
  const threeMonthsAgo = addMonths(now, -3);

  const bankAccount = generateBankAccount({
    userId,
    institution: "Test Bank",
    accountName: "Test Account",
    accountType: "transaction",
  });

  const property = generateProperty({
    userId,
    address: "1 Test Lane",
    suburb: "Testburg",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 500000,
    purchaseDate: threeMonthsAgo,
  });

  const transactions = generateTransactions({
    userId,
    bankAccountId: bankAccount.id,
    propertyId: property.id,
    startDate: threeMonthsAgo,
    endDate: now,
    patterns: [
      {
        merchantName: "Test Rent",
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly",
        amountRange: { min: 2000, max: 2000 },
      },
    ],
  });

  const loan = generateLoan({
    userId,
    propertyId: property.id,
    lender: "Test Lender",
    loanType: "principal_and_interest",
    rateType: "variable",
    originalAmount: 400000,
    currentBalance: 395000,
    interestRate: 6.0,
    repaymentAmount: 2500,
    repaymentFrequency: "monthly",
  });

  return {
    properties: [property],
    bankAccounts: [bankAccount],
    transactions,
    loans: [loan],
  };
}

export interface MultiPropertyData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
}

/**
 * Multi-property fixture: 3 properties for list/filter testing
 */
export function seedMultiPropertyPortfolio(userId: string): MultiPropertyData {
  const states = ["NSW", "VIC", "QLD"] as const;
  const properties: GeneratedProperty[] = [];

  for (let i = 0; i < 3; i++) {
    properties.push(generateProperty({
      userId,
      address: `${i + 1} Test Street`,
      suburb: `Suburb ${i + 1}`,
      state: states[i],
      postcode: `${2000 + i * 1000}`,
      purchasePrice: 400000 + i * 100000,
      purchaseDate: addMonths(new Date(), -(12 * (i + 1))),
    }));
  }

  const bankAccount = generateBankAccount({
    userId,
    institution: "Test Bank",
    accountName: "Test Account",
    accountType: "transaction",
  });

  return {
    properties,
    bankAccounts: [bankAccount],
  };
}

export interface CGTScenarioData {
  properties: GeneratedProperty[];
  propertySales: GeneratedPropertySale[];
}

/**
 * CGT scenario: Sold property with complete sale record
 */
export function seedCGTScenario(userId: string): CGTScenarioData {
  const purchaseDate = new Date("2020-01-01");
  const saleDate = new Date("2024-06-01");

  const property = generateProperty({
    userId,
    address: "99 Sold Street",
    suburb: "Salesville",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 500000,
    purchaseDate,
    status: "sold",
    soldAt: saleDate,
  });

  const sale = generatePropertySale({
    propertyId: property.id,
    userId,
    purchasePrice: 500000,
    purchaseDate,
    salePrice: 650000,
    settlementDate: saleDate,
    agentCommission: 13000,
    legalFees: 2000,
    marketingCosts: 3000,
  });

  return {
    properties: [property],
    propertySales: [sale],
  };
}

export interface AnomalyScenarioData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  anomalyAlerts: GeneratedAnomalyAlert[];
}

/**
 * Anomaly scenario: Property with various alert types
 */
export function seedAnomalyScenario(userId: string): AnomalyScenarioData {
  const now = new Date();
  const sixMonthsAgo = addMonths(now, -6);

  const bankAccount = generateBankAccount({
    userId,
    institution: "Test Bank",
    accountName: "Test Account",
    accountType: "transaction",
  });

  const property = generateProperty({
    userId,
    address: "42 Alert Avenue",
    suburb: "Alertville",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 500000,
    purchaseDate: sixMonthsAgo,
  });

  const transactions = generateTransactions({
    userId,
    bankAccountId: bankAccount.id,
    propertyId: property.id,
    startDate: sixMonthsAgo,
    endDate: now,
    patterns: [
      {
        merchantName: "Test Rent",
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly",
        amountRange: { min: 2000, max: 2000 },
      },
    ],
  });

  const anomalyAlerts: GeneratedAnomalyAlert[] = [
    generateAnomalyAlert({
      userId,
      propertyId: property.id,
      alertType: "missed_rent",
      severity: "warning",
      description: "Expected rent not received",
    }),
    generateAnomalyAlert({
      userId,
      propertyId: property.id,
      alertType: "unusual_amount",
      severity: "info",
      description: "Unusually high expense detected",
      transactionId: transactions[0]?.id,
    }),
  ];

  return {
    properties: [property],
    bankAccounts: [bankAccount],
    transactions,
    anomalyAlerts,
  };
}

export interface ComplianceScenarioData {
  properties: GeneratedProperty[];
  complianceRecords: GeneratedComplianceRecord[];
}

/**
 * Compliance scenario: Properties with due/overdue items
 */
export function seedComplianceScenario(userId: string): ComplianceScenarioData {
  const now = new Date();
  const property = generateProperty({
    userId,
    address: "1 Compliance Court",
    suburb: "Rulesville",
    state: "VIC",
    postcode: "3000",
    purchasePrice: 500000,
    purchaseDate: addMonths(now, -24),
  });

  const complianceRecords: GeneratedComplianceRecord[] = [
    // Overdue smoke alarm
    generateComplianceRecord({
      propertyId: property.id,
      userId,
      requirementId: "smoke_alarms",
      completedAt: addMonths(now, -14),
      nextDueAt: addMonths(now, -2), // 2 months overdue
    }),
    // Upcoming gas safety
    generateComplianceRecord({
      propertyId: property.id,
      userId,
      requirementId: "gas_safety_vic",
      completedAt: addMonths(now, -22),
      nextDueAt: addMonths(now, 2), // Due in 2 months
    }),
  ];

  return {
    properties: [property],
    complianceRecords,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/seed/__tests__/profiles/test.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/seed/profiles/test.ts src/lib/seed/__tests__/profiles/test.test.ts
git commit -m "feat(seed): add test fixture functions for E2E testing"
```

---

### Task 12: Create Main Seed Entry Point and Database Insert Logic

**Files:**
- Create: `src/lib/seed/index.ts`
- Create: `src/lib/seed/db.ts`

**Step 1: Create database operations file**

Create `src/lib/seed/db.ts`:

```typescript
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { DemoData } from "./profiles/demo";
import type { DevData } from "./profiles/dev";
import type { SeedSummary } from "./types";

/**
 * Get or create user by Clerk ID
 */
export async function getOrCreateUser(clerkId: string): Promise<string> {
  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkId),
  });

  if (existingUser) {
    return existingUser.id;
  }

  // Create user
  const [newUser] = await db
    .insert(schema.users)
    .values({
      clerkId,
      email: `seed-${clerkId}@propertytracker.local`,
      name: "Seeded User",
    })
    .returning();

  return newUser.id;
}

/**
 * Clean up all data for a user (respects foreign key order)
 */
export async function cleanupUserData(userId: string): Promise<void> {
  // Delete in reverse dependency order
  await db.delete(schema.anomalyAlerts).where(eq(schema.anomalyAlerts.userId, userId));
  await db.delete(schema.connectionAlerts).where(eq(schema.connectionAlerts.userId, userId));
  await db.delete(schema.complianceRecords).where(eq(schema.complianceRecords.userId, userId));
  await db.delete(schema.refinanceAlerts).where(
    eq(schema.refinanceAlerts.loanId,
      db.select({ id: schema.loans.id }).from(schema.loans).where(eq(schema.loans.userId, userId)) as any
    )
  );
  await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
  await db.delete(schema.loans).where(eq(schema.loans.userId, userId));
  await db.delete(schema.propertySales).where(eq(schema.propertySales.userId, userId));
  await db.delete(schema.bankAccounts).where(eq(schema.bankAccounts.userId, userId));
  await db.delete(schema.properties).where(eq(schema.properties.userId, userId));
  await db.delete(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, userId));
  await db.delete(schema.userOnboarding).where(eq(schema.userOnboarding.userId, userId));
}

/**
 * Insert demo data into database
 */
export async function insertDemoData(data: DemoData): Promise<SeedSummary> {
  // Insert in dependency order
  await db.insert(schema.properties).values(data.properties);
  await db.insert(schema.bankAccounts).values(data.bankAccounts);
  await db.insert(schema.loans).values(data.loans);

  if (data.propertySales.length > 0) {
    await db.insert(schema.propertySales).values(data.propertySales);
  }

  // Insert transactions in batches to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < data.transactions.length; i += BATCH_SIZE) {
    const batch = data.transactions.slice(i, i + BATCH_SIZE);
    await db.insert(schema.transactions).values(batch);
  }

  if (data.refinanceAlerts.length > 0) {
    await db.insert(schema.refinanceAlerts).values(data.refinanceAlerts);
  }

  if (data.anomalyAlerts.length > 0) {
    await db.insert(schema.anomalyAlerts).values(data.anomalyAlerts);
  }

  if (data.complianceRecords.length > 0) {
    await db.insert(schema.complianceRecords).values(data.complianceRecords);
  }

  return {
    users: 1,
    properties: data.properties.length,
    bankAccounts: data.bankAccounts.length,
    transactions: data.transactions.length,
    loans: data.loans.length,
    alerts: data.anomalyAlerts.length + (data.refinanceAlerts?.length ?? 0),
    complianceRecords: data.complianceRecords.length,
  };
}

/**
 * Insert dev data into database
 */
export async function insertDevData(data: DevData): Promise<SeedSummary> {
  await db.insert(schema.properties).values(data.properties);
  await db.insert(schema.bankAccounts).values(data.bankAccounts);
  await db.insert(schema.loans).values(data.loans);

  const BATCH_SIZE = 100;
  for (let i = 0; i < data.transactions.length; i += BATCH_SIZE) {
    const batch = data.transactions.slice(i, i + BATCH_SIZE);
    await db.insert(schema.transactions).values(batch);
  }

  if (data.anomalyAlerts.length > 0) {
    await db.insert(schema.anomalyAlerts).values(data.anomalyAlerts);
  }

  if (data.connectionAlerts.length > 0) {
    await db.insert(schema.connectionAlerts).values(data.connectionAlerts);
  }

  if (data.complianceRecords.length > 0) {
    await db.insert(schema.complianceRecords).values(data.complianceRecords);
  }

  return {
    users: 1,
    properties: data.properties.length,
    bankAccounts: data.bankAccounts.length,
    transactions: data.transactions.length,
    loans: data.loans.length,
    alerts: data.anomalyAlerts.length + data.connectionAlerts.length,
    complianceRecords: data.complianceRecords.length,
  };
}
```

**Step 2: Create main entry point**

Create `src/lib/seed/index.ts`:

```typescript
import type { SeedMode, SeedOptions, SeedSummary } from "./types";
import { generateDemoData } from "./profiles/demo";
import { generateDevData } from "./profiles/dev";
import {
  getOrCreateUser,
  cleanupUserData,
  insertDemoData,
  insertDevData,
} from "./db";

export { type SeedMode, type SeedOptions, type SeedSummary } from "./types";

// Re-export test fixtures for E2E tests
export {
  seedMinimalPortfolio,
  seedMultiPropertyPortfolio,
  seedCGTScenario,
  seedAnomalyScenario,
  seedComplianceScenario,
} from "./profiles/test";

/**
 * Main seed function - seeds data based on mode
 */
export async function seed(options: SeedOptions): Promise<SeedSummary> {
  const { clerkId, mode, clean = false } = options;

  console.log(`Starting seed in ${mode} mode for Clerk ID: ${clerkId}`);

  // Get or create user
  const userId = await getOrCreateUser(clerkId);
  console.log(`User ID: ${userId}`);

  // Clean existing data if requested
  if (clean) {
    console.log("Cleaning existing data...");
    await cleanupUserData(userId);
  }

  // Generate and insert data based on mode
  let summary: SeedSummary;

  if (mode === "demo") {
    console.log("Generating demo data (5-year realistic portfolio)...");
    const data = generateDemoData(userId);
    summary = await insertDemoData(data);
  } else if (mode === "dev") {
    console.log("Generating dev data (1-year fake data)...");
    const data = generateDevData(userId);
    summary = await insertDevData(data);
  } else {
    throw new Error(`Unknown seed mode: ${mode}. Use test fixtures directly for test mode.`);
  }

  console.log("Seed complete!");
  console.log("Summary:", summary);

  return summary;
}

/**
 * Clean up all seeded data for a user
 */
export async function clean(clerkId: string): Promise<void> {
  const userId = await getOrCreateUser(clerkId);
  await cleanupUserData(userId);
  console.log(`Cleaned all data for user: ${userId}`);
}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit src/lib/seed/index.ts src/lib/seed/db.ts 2>&1 | head -30`

Expected: No errors (or only unrelated existing errors)

**Step 4: Commit**

```bash
git add src/lib/seed/index.ts src/lib/seed/db.ts
git commit -m "feat(seed): add main entry point and database operations"
```

---

### Task 13: Create CLI Scripts

**Files:**
- Create: `src/scripts/seed.ts`
- Modify: `package.json` (add seed scripts)

**Step 1: Create CLI script**

Create `src/scripts/seed.ts`:

```typescript
import { seed, clean } from "@/lib/seed";
import type { SeedMode } from "@/lib/seed";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const mode = args.find((a) => ["demo", "dev"].includes(a)) as SeedMode | undefined;
  const clerkIdArg = args.find((a) => a.startsWith("--clerk-id="));
  const clerkId = clerkIdArg?.split("=")[1];
  const shouldClean = args.includes("--clean") || args.includes("clean");
  const forceClean = args.includes("--force");

  // Validate
  if (!clerkId) {
    console.error("Error: --clerk-id=<clerk_id> is required");
    console.log("\nUsage:");
    console.log("  npm run seed:demo -- --clerk-id=user_xxx");
    console.log("  npm run seed:dev -- --clerk-id=user_xxx");
    console.log("  npm run seed:clean -- --clerk-id=user_xxx");
    console.log("\nOptions:");
    console.log("  --clean    Remove existing data before seeding");
    console.log("  --force    Required for clean operation");
    process.exit(1);
  }

  // Handle clean command
  if (shouldClean && !mode) {
    if (!forceClean) {
      console.error("Error: --force flag required to clean data");
      console.log("Run: npm run seed:clean -- --clerk-id=xxx --force");
      process.exit(1);
    }

    console.log(`Cleaning all data for ${clerkId}...`);
    await clean(clerkId);
    console.log("Done!");
    process.exit(0);
  }

  // Handle seed command
  if (!mode) {
    console.error("Error: Mode required (demo or dev)");
    process.exit(1);
  }

  try {
    const summary = await seed({
      clerkId,
      mode,
      clean: shouldClean,
    });

    console.log("\n=== Seed Summary ===");
    console.log(`Properties:    ${summary.properties}`);
    console.log(`Bank Accounts: ${summary.bankAccounts}`);
    console.log(`Transactions:  ${summary.transactions}`);
    console.log(`Loans:         ${summary.loans}`);
    console.log(`Alerts:        ${summary.alerts}`);
    console.log(`Compliance:    ${summary.complianceRecords}`);
    console.log("====================\n");

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
```

**Step 2: Add npm scripts to package.json**

Modify `package.json` to add these scripts after the existing scripts:

```json
{
  "scripts": {
    "seed:demo": "tsx src/scripts/seed.ts demo",
    "seed:dev": "tsx src/scripts/seed.ts dev",
    "seed:clean": "tsx src/scripts/seed.ts clean"
  }
}
```

**Step 3: Test the script help output**

Run: `npx tsx src/scripts/seed.ts 2>&1 | head -20`

Expected: Shows usage help with --clerk-id requirement

**Step 4: Commit**

```bash
git add src/scripts/seed.ts package.json
git commit -m "feat(seed): add CLI scripts for seeding data"
```

---

### Task 14: Create API Endpoint

**Files:**
- Create: `src/app/api/seed/route.ts`

**Step 1: Create the API route**

Create `src/app/api/seed/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { seed } from "@/lib/seed";
import type { SeedMode } from "@/lib/seed";

export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed endpoint is not available in production" },
      { status: 403 }
    );
  }

  // Require authentication
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const mode = body.mode as SeedMode;
    const clean = body.options?.clean ?? false;

    if (!mode || !["demo", "dev"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Use 'demo' or 'dev'" },
        { status: 400 }
      );
    }

    const summary = await seed({
      clerkId,
      mode,
      clean,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Seed API error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/app/api/seed/route.ts 2>&1 | head -20`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/seed/route.ts
git commit -m "feat(seed): add API endpoint for browser-based seeding"
```

---

### Task 15: Create Integration Test

**Files:**
- Create: `src/lib/seed/__tests__/integration.test.ts`

**Step 1: Write integration test**

Create `src/lib/seed/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateDemoData } from "../profiles/demo";
import { generateDevData } from "../profiles/dev";

describe("seed integration", () => {
  describe("demo profile data generation", () => {
    it("generates complete demo data without errors", () => {
      const data = generateDemoData("test-user-123");

      // Verify all required data is present
      expect(data.properties.length).toBe(4);
      expect(data.bankAccounts.length).toBeGreaterThan(0);
      expect(data.transactions.length).toBeGreaterThan(500);
      expect(data.loans.length).toBe(3);
      expect(data.propertySales.length).toBe(1);
      expect(data.anomalyAlerts.length).toBeGreaterThan(0);
      expect(data.complianceRecords.length).toBeGreaterThan(0);
    });

    it("generates valid property references in transactions", () => {
      const data = generateDemoData("test-user-123");
      const propertyIds = new Set(data.properties.map((p) => p.id));

      for (const txn of data.transactions) {
        expect(propertyIds.has(txn.propertyId)).toBe(true);
      }
    });

    it("generates valid bank account references in transactions", () => {
      const data = generateDemoData("test-user-123");
      const accountIds = new Set(data.bankAccounts.map((a) => a.id));

      for (const txn of data.transactions) {
        expect(accountIds.has(txn.bankAccountId)).toBe(true);
      }
    });

    it("generates sold property with valid sale record", () => {
      const data = generateDemoData("test-user-123");
      const soldProperty = data.properties.find((p) => p.status === "sold");
      const sale = data.propertySales[0];

      expect(soldProperty).toBeDefined();
      expect(sale.propertyId).toBe(soldProperty!.id);
      expect(sale.heldOverTwelveMonths).toBe(true);
    });
  });

  describe("dev profile data generation", () => {
    it("generates complete dev data without errors", () => {
      const data = generateDevData("test-user-123");

      expect(data.properties.length).toBe(2);
      expect(data.bankAccounts.length).toBeGreaterThan(0);
      expect(data.transactions.length).toBeGreaterThan(50);
      expect(data.loans.length).toBe(2);
    });

    it("uses fake addresses", () => {
      const data = generateDevData("test-user-123");

      expect(data.properties[0].address).toContain("Test");
    });
  });
});
```

**Step 2: Run the integration test**

Run: `npm run test:unit -- src/lib/seed/__tests__/integration.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/seed/__tests__/integration.test.ts
git commit -m "test(seed): add integration tests for data generation"
```

---

### Task 16: Final Verification and Documentation

**Files:**
- Modify: `docs/plans/2026-01-25-seed-data-design.md` (mark as implemented)

**Step 1: Run all seed tests**

Run: `npm run test:unit -- src/lib/seed`

Expected: All tests pass

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors related to seed files

**Step 3: Update design doc status**

Edit `docs/plans/2026-01-25-seed-data-design.md` line 4:

Change: `**Status:** Approved`
To: `**Status:** Implemented`

**Step 4: Create final commit**

```bash
git add docs/plans/2026-01-25-seed-data-design.md
git commit -m "docs(seed): mark seed data system as implemented"
```

**Step 5: Run full test suite**

Run: `npm run test:unit`

Expected: All tests pass

---

## Summary

This plan creates a complete seed data system with:

1. **Static data files** - Australian addresses, banks, merchants
2. **Generators** - Properties, transactions, loans, alerts, compliance
3. **Profiles** - Demo (realistic 5-year), Dev (fake 1-year), Test (fixtures)
4. **CLI scripts** - `npm run seed:demo/dev/clean`
5. **API endpoint** - `POST /api/seed` for browser use
6. **Tests** - Unit tests for each generator and integration tests

Total: 16 tasks with TDD approach and frequent commits.
