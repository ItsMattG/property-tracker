# Wave 0: Shared Infrastructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract duplicated validation schemas, consolidate formatting utilities, and create typed domain errors — the foundation all subsequent refactoring waves build on.

**Architecture:** Three independent PRs that can be implemented in any order. Each PR extracts duplicated code into shared modules, then updates all consumers to import from the new location. No behavioral changes.

**Tech Stack:** Zod 4, TypeScript 5 strict, tRPC 11, Vitest

**Design Doc:** `docs/plans/2026-02-14-full-codebase-refactor-design.md`

**Tech Notes (from context7, Feb 2026):**
- **Zod 4**: Format validators (`.email()`, `.uuid()`, `.url()`) have moved to top-level (`z.email()`, `z.uuid()`), but `.regex()` on `z.string()` is still the correct API for custom patterns. Our validation schemas use `.regex()` and are up-to-date.
- **tRPC 11**: `TRPCError({ code, message, cause })` is the standard error pattern. Our domain error → TRPCError mapper is aligned with current best practices.
- **Drizzle ORM**: Schema splitting across files is supported via `{ ...schema1, ...schema2 }` spread syntax. For Wave 1, use `defineRelationsPart()` from `drizzle-orm` for modular relation definitions.

---

## PR 0.1: Shared Validation Schemas

### Task 1: Create shared validation primitives

**Files:**
- Create: `src/lib/validation/common.ts`
- Create: `src/lib/validation/index.ts`
- Test: `src/lib/validation/__tests__/common.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/validation/__tests__/common.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  positiveAmountSchema,
  signedAmountSchema,
  australianPostcodeSchema,
  suburbSchema,
  timeSchema,
  abnSchema,
} from "../common";

describe("positiveAmountSchema", () => {
  it("accepts valid amounts", () => {
    expect(positiveAmountSchema.parse("100")).toBe("100");
    expect(positiveAmountSchema.parse("100.50")).toBe("100.50");
    expect(positiveAmountSchema.parse("0")).toBe("0");
    expect(positiveAmountSchema.parse("999999.99")).toBe("999999.99");
  });

  it("rejects negative amounts", () => {
    expect(() => positiveAmountSchema.parse("-100")).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() => positiveAmountSchema.parse("abc")).toThrow();
    expect(() => positiveAmountSchema.parse("")).toThrow();
    expect(() => positiveAmountSchema.parse("$100")).toThrow();
  });
});

describe("signedAmountSchema", () => {
  it("accepts positive amounts", () => {
    expect(signedAmountSchema.parse("100")).toBe("100");
  });

  it("accepts negative amounts", () => {
    expect(signedAmountSchema.parse("-100")).toBe("-100");
    expect(signedAmountSchema.parse("-100.50")).toBe("-100.50");
  });

  it("rejects non-numeric strings", () => {
    expect(() => signedAmountSchema.parse("abc")).toThrow();
  });
});

describe("australianPostcodeSchema", () => {
  it("accepts valid 4-digit postcodes", () => {
    expect(australianPostcodeSchema.parse("2000")).toBe("2000");
    expect(australianPostcodeSchema.parse("0800")).toBe("0800");
  });

  it("rejects invalid postcodes", () => {
    expect(() => australianPostcodeSchema.parse("200")).toThrow();
    expect(() => australianPostcodeSchema.parse("20000")).toThrow();
    expect(() => australianPostcodeSchema.parse("abcd")).toThrow();
  });
});

describe("suburbSchema", () => {
  it("accepts valid suburb names", () => {
    expect(suburbSchema.parse("Sydney")).toBe("Sydney");
    expect(suburbSchema.parse("Surry Hills")).toBe("Surry Hills");
    expect(suburbSchema.parse("O'Connor")).toBe("O'Connor");
    expect(suburbSchema.parse("Woy Woy")).toBe("Woy Woy");
  });

  it("rejects suburbs with numbers", () => {
    expect(() => suburbSchema.parse("Area 51")).toThrow();
  });
});

describe("timeSchema", () => {
  it("accepts valid HH:MM times", () => {
    expect(timeSchema.parse("09:00")).toBe("09:00");
    expect(timeSchema.parse("23:59")).toBe("23:59");
  });

  it("rejects invalid time formats", () => {
    expect(() => timeSchema.parse("9:00")).toThrow();
    expect(() => timeSchema.parse("25:00")).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/validation/__tests__/common.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/validation/common.ts`:

```typescript
import { z } from "zod";

/** Positive decimal amount (e.g., "100", "100.50"). Used for prices, rates, balances. */
export const positiveAmountSchema = z
  .string()
  .regex(/^\d+\.?\d*$/, "Must be a valid positive number");

/** Signed decimal amount (e.g., "-100.50", "200"). Used for transaction amounts. */
export const signedAmountSchema = z
  .string()
  .regex(/^-?\d+\.?\d*$/, "Must be a valid number");

/** Australian 4-digit postcode. */
export const australianPostcodeSchema = z
  .string()
  .regex(/^\d{4}$/, "Must be a 4-digit Australian postcode");

/** Suburb name — letters, spaces, hyphens, apostrophes only. */
export const suburbSchema = z
  .string()
  .regex(/^[a-zA-Z\s\-']+$/, "Must only contain letters, spaces, hyphens, or apostrophes");

/** Time in HH:MM format. */
export const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Must be in HH:MM format");

/** Australian Business Number (11 digits). */
export const abnSchema = z
  .string()
  .regex(/^\d{11}$/, "Must be an 11-digit ABN");
```

Create `src/lib/validation/index.ts`:

```typescript
export {
  positiveAmountSchema,
  signedAmountSchema,
  australianPostcodeSchema,
  suburbSchema,
  timeSchema,
  abnSchema,
} from "./common";
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/validation/__tests__/common.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/validation/
git commit -m "refactor: extract shared validation schemas (common primitives)"
```

---

### Task 2: Replace duplicated amount regex in server routers

**Files:**
- Modify: `src/server/routers/loan.ts` (lines 12-16, 129)
- Modify: `src/server/routers/recurring.ts` (lines 26, 35)
- Modify: `src/server/routers/loanComparison.ts` (lines 88, 90, 179)
- Modify: `src/server/routers/propertyValue.ts` (lines 134, 138-139)
- Modify: `src/server/routers/property.ts` (line 14)
- Modify: `src/server/routers/cgt.ts` (lines 169, 172-175)
- Modify: `src/server/routers/transaction.ts` (lines 196, 428)
- Modify: `src/server/routers/notification.ts` (lines 43-44)

**Step 1: In each file, replace inline regex with imported schema**

For each router file listed above:
1. Add import: `import { positiveAmountSchema, signedAmountSchema, timeSchema } from "@/lib/validation";`
2. Replace `z.string().regex(/^\d+\.?\d*$/, "...")` with `positiveAmountSchema`
3. Replace `z.string().regex(/^-?\d+\.?\d*$/, "...")` with `signedAmountSchema`
4. Replace `z.string().regex(/^\d{2}:\d{2}$/, "...")` with `timeSchema`

Example (loan.ts, before):
```typescript
const createLoanSchema = z.object({
  // ...
  originalAmount: z.string().regex(/^\d+\.?\d*$/, "Must be a valid amount"),
  currentBalance: z.string().regex(/^\d+\.?\d*$/, "Must be a valid amount"),
  interestRate: z.string().regex(/^\d+\.?\d*$/, "Must be a valid rate"),
  repaymentAmount: z.string().regex(/^\d+\.?\d*$/, "Must be a valid amount"),
  // ...
});
```

Example (loan.ts, after):
```typescript
import { positiveAmountSchema } from "@/lib/validation";

const createLoanSchema = z.object({
  // ...
  originalAmount: positiveAmountSchema,
  currentBalance: positiveAmountSchema,
  interestRate: positiveAmountSchema,
  repaymentAmount: positiveAmountSchema,
  // ...
});
```

**Step 2: Run type check and existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: ALL PASS (no behavioral change — same regex patterns)

**Step 3: Commit**

```bash
git add src/server/routers/
git commit -m "refactor: use shared validation schemas in server routers"
```

---

### Task 3: Replace duplicated amount regex in components

**Files:**
- Modify: `src/components/loans/LoanForm.tsx` (lines 35-39)
- Modify: `src/components/recurring/MakeRecurringDialog.tsx` (lines 58, 66)
- Modify: `src/components/valuation/AddValuationModal.tsx` (line 29)
- Modify: `src/components/portfolio/AddPropertyValueDialog.tsx` (line 31)
- Modify: `src/components/properties/PropertyForm.tsx` (lines 31-34)
- Modify: `src/components/transactions/AddTransactionDialog.tsx` (line 44)
- Modify: `src/components/cgt/RecordSaleDialog.tsx` (lines 30-38)
- Modify: `src/app/(dashboard)/transactions/new/page.tsx` (line 44)
- Modify: `src/app/(dashboard)/transactions/[id]/edit/page.tsx` (line 45)

**Step 1: In each component file, replace inline regex with imported schema**

Same pattern as Task 2. Add import from `@/lib/validation` and replace inline regex.

Example (PropertyForm.tsx, before):
```typescript
const propertyFormSchema = z.object({
  suburb: z.string().regex(/^[a-zA-Z\s\-']+$/, "Suburb must only contain letters"),
  postcode: z.string().regex(/^\d{4}$/, "Must be a valid 4-digit postcode"),
  purchasePrice: z.string().regex(/^\d+\.?\d*$/, "Must be a valid amount"),
  // ...
});
```

Example (PropertyForm.tsx, after):
```typescript
import { positiveAmountSchema, australianPostcodeSchema, suburbSchema } from "@/lib/validation";

const propertyFormSchema = z.object({
  suburb: suburbSchema,
  postcode: australianPostcodeSchema,
  purchasePrice: positiveAmountSchema,
  // ...
});
```

**Step 2: Run type check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/components/ src/app/
git commit -m "refactor: use shared validation schemas in components"
```

---

## PR 0.2: Utility Consolidation

### Task 4: Add formatPercent and formatCurrencyWithCents to utils.ts

**Files:**
- Modify: `src/lib/utils.ts`
- Test: `src/lib/__tests__/utils.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/utils.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatCurrencyWithCents,
  formatCurrencyCompact,
  formatPercent,
  formatDate,
  formatDateShort,
  formatDateISO,
} from "../utils";

describe("formatCurrency", () => {
  it("formats positive amounts in AUD", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-1000)).toBe("-$1,000");
  });

  it("rounds to whole dollars (no cents)", () => {
    expect(formatCurrency(1000.99)).toBe("$1,001");
  });
});

describe("formatCurrencyWithCents", () => {
  it("formats with 2 decimal places", () => {
    expect(formatCurrencyWithCents(1000.5)).toBe("$1,000.50");
    expect(formatCurrencyWithCents(1000)).toBe("$1,000.00");
  });

  it("accepts string input", () => {
    expect(formatCurrencyWithCents("1000.50")).toBe("$1,000.50");
  });

  it("accepts number input", () => {
    expect(formatCurrencyWithCents(1000.5)).toBe("$1,000.50");
  });
});

describe("formatCurrencyCompact", () => {
  it("formats thousands as K", () => {
    expect(formatCurrencyCompact(1500)).toBe("$1.5K");
    expect(formatCurrencyCompact(50000)).toBe("$50K");
  });

  it("formats millions as M", () => {
    expect(formatCurrencyCompact(1500000)).toBe("$1.5M");
  });

  it("formats small amounts normally", () => {
    expect(formatCurrencyCompact(500)).toBe("$500");
  });
});

describe("formatPercent", () => {
  it("formats percentages with 1 decimal", () => {
    expect(formatPercent(5.5)).toBe("5.5%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats negative percentages", () => {
    expect(formatPercent(-3.2)).toBe("-3.2%");
  });
});

describe("formatDate", () => {
  it("formats Date objects", () => {
    const date = new Date("2024-01-15T00:00:00Z");
    const result = formatDate(date);
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
  });

  it("formats date strings", () => {
    const result = formatDate("2024-01-15");
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
  });
});
```

**Step 2: Run tests to verify new tests fail**

Run: `npx vitest run src/lib/__tests__/utils.test.ts`
Expected: FAIL — formatCurrencyWithCents, formatCurrencyCompact, formatPercent not found

**Step 3: Add the missing exports to utils.ts**

Add to `src/lib/utils.ts` (after the existing `formatCurrency`):

```typescript
/**
 * Format currency with cents (e.g., "$1,000.50"). Use for transaction amounts
 * where cent precision matters.
 */
export function formatCurrencyWithCents(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format currency in compact notation (e.g., "$1.5M", "$50K").
 * Use for dashboard widgets and charts where space is limited.
 */
export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `$${amount}`;
}

/**
 * Format a percentage (e.g., "5.5%").
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/utils.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts
git commit -m "refactor: add formatPercent, formatCurrencyWithCents, formatCurrencyCompact to utils"
```

---

### Task 5: Replace all local formatCurrency definitions with imports

**Files to modify:** 48 files with local formatCurrency definitions (see full list below).

This task is mechanical: for each file, delete the local `formatCurrency` definition and add `import { formatCurrency } from "@/lib/utils"` (or add it to existing import if `cn` is already imported from there).

**Key variant handling:**
- Files using `maximumFractionDigits: 2` (TransactionCardList.tsx) → import `formatCurrencyWithCents` instead
- Files accepting `string | number` → the canonical version accepts `number`. If the call site passes a string, wrap with `parseFloat()` or use `formatCurrencyWithCents` which accepts both
- Files with compact format (og/share route) → import `formatCurrencyCompact`

**Step 1: Replace in component files**

For each of the 48 files listed in the exploration report:
1. Delete the local `formatCurrency` function definition
2. Add import from `@/lib/utils`
3. If the call site passes a string, add `parseFloat()` wrapper or use `formatCurrencyWithCents`

**Step 2: Replace local formatPercent definitions**

For each of the 9 files with local `formatPercent`:
1. Delete the local definition
2. Add `import { formatPercent } from "@/lib/utils"`

**Step 3: Replace local formatDate definitions**

For each of the 11 files with local `formatDate`:
1. Delete the local definition
2. Add `import { formatDate } from "@/lib/utils"` (or `formatDateShort` / `formatDateISO` as appropriate)

**Step 4: Run type check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: ALL PASS

**Step 5: Run all tests**

Run: `npx vitest run && npm run test:e2e`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: consolidate all formatting utilities to lib/utils"
```

---

### Task 6: Create Serialized<T> utility type

**Files:**
- Create: `src/lib/types.ts`
- Test: `src/lib/__tests__/types.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/types.test.ts`:

```typescript
import { describe, expectTypeOf, it } from "vitest";
import type { Serialized } from "../types";

describe("Serialized type", () => {
  it("converts Date fields to string", () => {
    type Input = { id: string; createdAt: Date; updatedAt: Date; name: string };
    type Result = Serialized<Input>;

    expectTypeOf<Result>().toEqualTypeOf<{
      id: string;
      createdAt: string;
      updatedAt: string;
      name: string;
    }>();
  });

  it("handles optional Date fields", () => {
    type Input = { id: string; deletedAt: Date | null };
    type Result = Serialized<Input>;

    expectTypeOf<Result>().toEqualTypeOf<{
      id: string;
      deletedAt: string | null;
    }>();
  });

  it("passes through non-Date fields unchanged", () => {
    type Input = { id: string; count: number; tags: string[] };
    type Result = Serialized<Input>;

    expectTypeOf<Result>().toEqualTypeOf<{
      id: string;
      count: number;
      tags: string[];
    }>();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/types.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the type**

Create `src/lib/types.ts`:

```typescript
/**
 * Converts all Date fields in a type to string.
 * Use this instead of manual `Omit<T, 'createdAt'> & { createdAt: string }` patterns.
 *
 * tRPC without superjson serializes Dates as ISO strings. This type reflects
 * the actual shape received on the client.
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K] extends Date | undefined
        ? string | undefined
        : T[K];
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/types.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/__tests__/types.test.ts
git commit -m "refactor: add Serialized<T> utility type for Date→string mapping"
```

---

### Task 7: Replace ad-hoc Date serialization types with Serialized<T>

**Files to modify:** Search for `Omit<` combined with `createdAt` or `Date | string` patterns across components. Replace each with `Serialized<OriginalType>`.

**Step 1: Find and replace all ad-hoc patterns**

Search for patterns like:
```typescript
type SerializedProperty = Omit<Property, "createdAt" | "updatedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};
```

Replace with:
```typescript
import type { Serialized } from "@/lib/types";
type SerializedProperty = Serialized<Property>;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: use Serialized<T> type instead of ad-hoc Date serialization"
```

---

## PR 0.3: Typed Domain Errors

### Task 8: Create domain error classes

**Files:**
- Create: `src/server/errors/domain-errors.ts`
- Create: `src/server/errors/index.ts`
- Test: `src/server/errors/__tests__/domain-errors.test.ts`

**Step 1: Write the failing tests**

Create `src/server/errors/__tests__/domain-errors.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  ExternalServiceError,
  domainErrorToTrpcError,
} from "../domain-errors";

describe("DomainError", () => {
  it("creates error with code and message", () => {
    const error = new NotFoundError("User not found");
    expect(error.message).toBe("User not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it("preserves cause", () => {
    const cause = new Error("original");
    const error = new ExternalServiceError("Basiq failed", "basiq", cause);
    expect(error.cause).toBe(cause);
    expect(error.service).toBe("basiq");
  });
});

describe("domainErrorToTrpcError", () => {
  it("maps NotFoundError to NOT_FOUND", () => {
    const domain = new NotFoundError("User not found");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc).toBeInstanceOf(TRPCError);
    expect(trpc.code).toBe("NOT_FOUND");
    expect(trpc.message).toBe("User not found");
  });

  it("maps ForbiddenError to FORBIDDEN", () => {
    const domain = new ForbiddenError("Insufficient permissions");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("FORBIDDEN");
  });

  it("maps ValidationError to BAD_REQUEST", () => {
    const domain = new ValidationError("Invalid CSV format");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("BAD_REQUEST");
  });

  it("maps ConflictError to CONFLICT", () => {
    const domain = new ConflictError("Already exists");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("CONFLICT");
  });

  it("maps ExternalServiceError to INTERNAL_SERVER_ERROR", () => {
    const domain = new ExternalServiceError("Basiq API error", "basiq");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpc.message).toBe("Basiq API error");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/errors/__tests__/domain-errors.test.ts`
Expected: FAIL — module not found

**Step 3: Implement domain errors**

Create `src/server/errors/domain-errors.ts`:

```typescript
import { TRPCError } from "@trpc/server";

export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "EXTERNAL_SERVICE"
  | "PRECONDITION_FAILED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.code = code;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("NOT_FOUND", message, cause);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("FORBIDDEN", message, cause);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("VALIDATION", message, cause);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("CONFLICT", message, cause);
  }
}

export class ExternalServiceError extends DomainError {
  readonly service: string;

  constructor(message: string, service: string, cause?: unknown) {
    super("EXTERNAL_SERVICE", message, cause);
    this.service = service;
  }
}

const DOMAIN_TO_TRPC_CODE: Record<DomainErrorCode, TRPCError["code"]> = {
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  EXTERNAL_SERVICE: "INTERNAL_SERVER_ERROR",
  PRECONDITION_FAILED: "PRECONDITION_FAILED",
};

/**
 * Convert a DomainError to a TRPCError for the transport layer.
 * Use this in routers to catch service-layer domain errors.
 */
export function domainErrorToTrpcError(error: DomainError): TRPCError {
  return new TRPCError({
    code: DOMAIN_TO_TRPC_CODE[error.code],
    message: error.message,
    cause: error.cause,
  });
}
```

Create `src/server/errors/index.ts`:

```typescript
export {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  ExternalServiceError,
  domainErrorToTrpcError,
} from "./domain-errors";
export type { DomainErrorCode } from "./domain-errors";
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/errors/__tests__/domain-errors.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/server/errors/
git commit -m "refactor: add typed domain error classes and tRPC error mapper"
```

---

### Task 9: Replace generic Error throws in services with domain errors

**Files:**
- Modify: `src/server/services/loanPack.ts` (lines 83, 88)
- Modify: `src/server/services/csv-import.ts` (lines 234, 253, 272, 273, 275)
- Modify: `src/server/services/gmail-token.ts` (line 41)
- Modify: `src/server/services/basiq.ts` (lines 81, 95, 133)
- Modify: `src/server/services/valuation.ts` (lines 103, 107)
- Modify: `src/server/services/tax-position.ts` (line 170)
- Modify: `src/server/services/property-manager/propertyme.ts` (lines 56, 81, 101)
- Modify: `src/server/services/document-extraction.ts` (line 122)
- Modify: `src/server/services/depreciation-extract.ts` (line 78)

**Step 1: Replace each generic Error with appropriate domain error**

For each file:
1. Add import: `import { NotFoundError, ValidationError, ExternalServiceError } from "@/server/errors";`
2. Replace throws based on context:

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| loanPack.ts | 83 | `new Error("User not found")` | `new NotFoundError("User not found")` |
| loanPack.ts | 88 | `new Error("No properties found")` | `new NotFoundError("No properties found for this user")` |
| csv-import.ts | 234 | `new Error("Could not parse date...")` | `new ValidationError("Could not parse date: " + dateStr)` |
| csv-import.ts | 253 | `new Error("CSV must have at least...")` | `new ValidationError("CSV must have at least a header row and one data row")` |
| csv-import.ts | 272 | `new Error("Could not find date column")` | `new ValidationError("Could not find date column")` |
| csv-import.ts | 273 | `new Error("Could not find description column")` | `new ValidationError("Could not find description column")` |
| csv-import.ts | 275 | `new Error("Could not find amount column(s)")` | `new ValidationError("Could not find amount column(s)")` |
| gmail-token.ts | 41 | `new Error("No access token...")` | `new ExternalServiceError("No access token in refresh response", "gmail")` |
| basiq.ts | 81 | `new Error("BASIQ_API_KEY is not configured")` | `new ExternalServiceError("BASIQ_API_KEY is not configured", "basiq")` |
| basiq.ts | 95 | `new Error("Failed to get Basiq access token...")` | `new ExternalServiceError("Failed to get Basiq access token: " + response.statusText, "basiq")` |
| basiq.ts | 133 | `new Error("Basiq API error...")` | `new ExternalServiceError("Basiq API error: " + response.statusText, "basiq")` |
| valuation.ts | 103 | `new Error("CoreLogic provider not implemented")` | `new ExternalServiceError("CoreLogic provider not implemented", "corelogic")` |
| valuation.ts | 107 | `new Error("PropTrack provider not implemented")` | `new ExternalServiceError("PropTrack provider not implemented", "proptrack")` |
| tax-position.ts | 170 | `new Error("Tax tables not available...")` | `new ValidationError("Tax tables not available for FY" + input.financialYear)` |
| propertyme.ts | 56 | `new Error("Token exchange failed...")` | `new ExternalServiceError("Token exchange failed: " + response.statusText, "propertyme")` |
| propertyme.ts | 81 | `new Error("Token refresh failed...")` | `new ExternalServiceError("Token refresh failed: " + response.statusText, "propertyme")` |
| propertyme.ts | 101 | `new Error("PropertyMe API error...")` | `new ExternalServiceError("PropertyMe API error: " + response.statusText, "propertyme")` |
| document-extraction.ts | 122 | `new Error("Failed to download document...")` | `new ExternalServiceError("Failed to download document: " + error?.message, "supabase")` |
| depreciation-extract.ts | 78 | `new Error("Failed to download PDF...")` | `new ExternalServiceError("Failed to download PDF: " + error?.message, "supabase")` |

**Step 2: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: ALL PASS

Note: This is safe because all callers currently catch generic `Error` or let it propagate to tRPC's error handler. `DomainError extends Error`, so all existing catch blocks still work. The tRPC middleware will catch unhandled errors and return INTERNAL_SERVER_ERROR, same as before.

**Step 3: Commit**

```bash
git add src/server/services/
git commit -m "refactor: replace generic Error throws with typed domain errors in services"
```

---

### Task 10: Final validation and PR creation

**Step 1: Run full validation**

```bash
npx tsc --noEmit
npm run lint
npm run build
npx vitest run
```

Expected: ALL PASS

**Step 2: Create PR**

```bash
git push -u origin feature/wave0-shared-infrastructure
gh pr create --base develop --title "refactor: Wave 0 — shared validation, utilities, domain errors" --body "## Summary
- Extract shared Zod validation schemas (positiveAmountSchema, signedAmountSchema, etc.)
- Consolidate formatCurrency (48 duplicates → 1 import), formatDate (11 duplicates), formatPercent (9 duplicates)
- Add Serialized<T> utility type to replace ad-hoc Date→string Omit patterns
- Create typed domain error classes (NotFoundError, ValidationError, ExternalServiceError, etc.)
- Replace 17 generic Error throws in services with typed domain errors
- Add unit tests for all new modules

## Behaviour preserved
- All validation regex patterns identical to originals
- All formatting output identical to originals
- Error messages identical to originals
- No changes to tRPC procedure inputs/outputs
- No changes to auth/permissions/rate limiting

## Test plan
- [ ] Unit tests pass for validation schemas
- [ ] Unit tests pass for formatting utilities
- [ ] Unit tests pass for domain errors
- [ ] Type check passes (npx tsc --noEmit)
- [ ] Build passes (npm run build)
- [ ] All existing tests pass
- [ ] E2E tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 3: Run code review**

Run: `/code-review`

---

## Completion Checklist

- [ ] `src/lib/validation/` — shared Zod schemas with tests
- [ ] All 15+ server router files updated to use shared schemas
- [ ] All 9+ component files updated to use shared schemas
- [ ] `formatPercent`, `formatCurrencyWithCents`, `formatCurrencyCompact` added to utils.ts with tests
- [ ] 48 local formatCurrency definitions replaced with imports
- [ ] 11 local formatDate definitions replaced with imports
- [ ] 9 local formatPercent definitions replaced with imports
- [ ] `Serialized<T>` utility type created with tests
- [ ] Ad-hoc Date serialization types replaced with `Serialized<T>`
- [ ] Domain error classes created with tests
- [ ] 17 generic Error throws replaced with domain errors in 9 service files
- [ ] All existing tests pass
- [ ] Type check, lint, build pass
- [ ] PR created targeting develop
