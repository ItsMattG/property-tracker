# Compliance Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add property compliance tracking with state-specific requirements and automated reminders.

**Architecture:** Static config defines compliance requirements per Australian state. Database tracks completion records per property. tRPC router provides CRUD + portfolio queries. Daily cron sends escalating reminders. UI includes dedicated compliance page and per-property compliance section.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Next.js App Router, Vitest, Tailwind CSS, shadcn/ui

---

### Task 1: Create Compliance Requirements Config

**Files:**
- Create: `src/lib/compliance-requirements.ts`
- Test: `src/lib/__tests__/compliance-requirements.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/compliance-requirements.test.ts
import { describe, it, expect } from "vitest";
import {
  getRequirementsForState,
  getRequirementById,
  ALL_REQUIREMENTS,
  type ComplianceRequirement,
  type AustralianState,
} from "../compliance-requirements";

describe("compliance-requirements", () => {
  describe("getRequirementsForState", () => {
    it("returns VIC requirements including smoke alarm and gas safety", () => {
      const vicReqs = getRequirementsForState("VIC");
      expect(vicReqs.length).toBeGreaterThan(0);

      const smokeAlarm = vicReqs.find((r) => r.id === "smoke_alarm");
      expect(smokeAlarm).toBeDefined();
      expect(smokeAlarm?.frequencyMonths).toBe(12);

      const gasSafety = vicReqs.find((r) => r.id === "gas_safety");
      expect(gasSafety).toBeDefined();
      expect(gasSafety?.frequencyMonths).toBe(24);
    });

    it("returns NSW requirements (no gas safety)", () => {
      const nswReqs = getRequirementsForState("NSW");
      const smokeAlarm = nswReqs.find((r) => r.id === "smoke_alarm");
      expect(smokeAlarm).toBeDefined();

      const gasSafety = nswReqs.find((r) => r.id === "gas_safety");
      expect(gasSafety).toBeUndefined();
    });

    it("all states have smoke alarm requirement", () => {
      const states: AustralianState[] = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
      for (const state of states) {
        const reqs = getRequirementsForState(state);
        const smokeAlarm = reqs.find((r) => r.id === "smoke_alarm");
        expect(smokeAlarm).toBeDefined();
      }
    });
  });

  describe("getRequirementById", () => {
    it("returns requirement by id", () => {
      const req = getRequirementById("smoke_alarm");
      expect(req).toBeDefined();
      expect(req?.name).toBe("Smoke Alarm Check");
    });

    it("returns undefined for unknown id", () => {
      const req = getRequirementById("unknown_requirement");
      expect(req).toBeUndefined();
    });
  });

  describe("ALL_REQUIREMENTS", () => {
    it("exports all unique requirements", () => {
      expect(ALL_REQUIREMENTS.length).toBeGreaterThan(0);
      const ids = ALL_REQUIREMENTS.map((r) => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/compliance-requirements.test.ts`
Expected: FAIL with "Cannot find module '../compliance-requirements'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/compliance-requirements.ts
export type AustralianState = "VIC" | "NSW" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";

export type ComplianceRequirement = {
  id: string;
  name: string;
  description: string;
  frequencyMonths: number;
  legislationUrl?: string;
};

type StateRequirements = Record<AustralianState, ComplianceRequirement[]>;

// Base requirements that apply to all/multiple states
const SMOKE_ALARM: ComplianceRequirement = {
  id: "smoke_alarm",
  name: "Smoke Alarm Check",
  description: "Annual inspection and testing of smoke alarms. Replace batteries and ensure alarms are in working order.",
  frequencyMonths: 12,
  legislationUrl: "https://www.fire.nsw.gov.au/page.php?id=293",
};

const GAS_SAFETY: ComplianceRequirement = {
  id: "gas_safety",
  name: "Gas Safety Check",
  description: "Gas appliance safety inspection by a licensed gasfitter. Required every 2 years.",
  frequencyMonths: 24,
  legislationUrl: "https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-ستandards/gas-and-electrical-safety",
};

const ELECTRICAL_SAFETY: ComplianceRequirement = {
  id: "electrical_safety",
  name: "Electrical Safety Check",
  description: "Electrical safety inspection including switchboard, outlets, and fixed appliances.",
  frequencyMonths: 24,
};

const POOL_SAFETY_1YR: ComplianceRequirement = {
  id: "pool_safety",
  name: "Pool Safety Certificate",
  description: "Pool and spa barrier compliance inspection and certificate.",
  frequencyMonths: 12,
};

const POOL_SAFETY_3YR: ComplianceRequirement = {
  id: "pool_safety",
  name: "Pool Safety Certificate",
  description: "Pool and spa barrier compliance inspection and certificate.",
  frequencyMonths: 36,
};

const POOL_SAFETY_4YR: ComplianceRequirement = {
  id: "pool_safety",
  name: "Pool Safety Certificate",
  description: "Pool and spa barrier compliance inspection and certificate.",
  frequencyMonths: 48,
};

const STATE_REQUIREMENTS: StateRequirements = {
  VIC: [SMOKE_ALARM, GAS_SAFETY, ELECTRICAL_SAFETY, POOL_SAFETY_3YR],
  NSW: [SMOKE_ALARM, POOL_SAFETY_3YR],
  QLD: [SMOKE_ALARM, ELECTRICAL_SAFETY, POOL_SAFETY_1YR],
  SA: [SMOKE_ALARM],
  WA: [SMOKE_ALARM, POOL_SAFETY_4YR],
  TAS: [SMOKE_ALARM],
  NT: [SMOKE_ALARM],
  ACT: [SMOKE_ALARM],
};

export function getRequirementsForState(state: AustralianState): ComplianceRequirement[] {
  return STATE_REQUIREMENTS[state] || [];
}

export function getRequirementById(id: string): ComplianceRequirement | undefined {
  return ALL_REQUIREMENTS.find((r) => r.id === id);
}

// Deduplicated list of all requirements
export const ALL_REQUIREMENTS: ComplianceRequirement[] = [
  SMOKE_ALARM,
  GAS_SAFETY,
  ELECTRICAL_SAFETY,
  { ...POOL_SAFETY_3YR }, // Use 3yr as the canonical pool safety
];
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/compliance-requirements.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/compliance-requirements.ts src/lib/__tests__/compliance-requirements.test.ts
git commit -m "feat(compliance): add state-specific compliance requirements config"
```

---

### Task 2: Add Database Schema

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `src/server/db/__tests__/schema-compliance.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/db/__tests__/schema-compliance.test.ts
import { describe, it, expect } from "vitest";
import {
  complianceRecords,
  complianceStatusEnum,
  type ComplianceRecord,
  type NewComplianceRecord,
} from "../schema";

describe("Compliance schema", () => {
  it("exports complianceStatusEnum", () => {
    expect(complianceStatusEnum).toBeDefined();
    expect(complianceStatusEnum.enumValues).toContain("compliant");
    expect(complianceStatusEnum.enumValues).toContain("upcoming");
    expect(complianceStatusEnum.enumValues).toContain("due_soon");
    expect(complianceStatusEnum.enumValues).toContain("overdue");
  });

  it("exports complianceRecords table", () => {
    expect(complianceRecords).toBeDefined();
  });

  it("exports ComplianceRecord type", () => {
    const record: ComplianceRecord = {
      id: "test-id",
      propertyId: "prop-id",
      userId: "user-id",
      requirementId: "smoke_alarm",
      completedAt: "2026-01-01",
      nextDueAt: "2027-01-01",
      notes: null,
      documentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(record.requirementId).toBe("smoke_alarm");
  });

  it("exports NewComplianceRecord type", () => {
    const newRecord: NewComplianceRecord = {
      propertyId: "prop-id",
      userId: "user-id",
      requirementId: "smoke_alarm",
      completedAt: "2026-01-01",
      nextDueAt: "2027-01-01",
    };
    expect(newRecord.requirementId).toBe("smoke_alarm");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/db/__tests__/schema-compliance.test.ts`
Expected: FAIL with "complianceStatusEnum is not exported"

**Step 3: Write minimal implementation**

Add to `src/server/db/schema.ts` (after other enums, around line 295):

```typescript
export const complianceStatusEnum = pgEnum("compliance_status", [
  "compliant",
  "upcoming",
  "due_soon",
  "overdue",
]);
```

Add table (after portfolioShares table, around line 1478):

```typescript
export const complianceRecords = pgTable(
  "compliance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    requirementId: text("requirement_id").notNull(),
    completedAt: date("completed_at").notNull(),
    nextDueAt: date("next_due_at").notNull(),
    notes: text("notes"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("compliance_records_property_id_idx").on(table.propertyId),
    index("compliance_records_user_id_idx").on(table.userId),
    index("compliance_records_next_due_idx").on(table.nextDueAt),
  ]
);
```

Add relations (after portfolioSharesRelations):

```typescript
export const complianceRecordsRelations = relations(complianceRecords, ({ one }) => ({
  property: one(properties, {
    fields: [complianceRecords.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [complianceRecords.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [complianceRecords.documentId],
    references: [documents.id],
  }),
}));
```

Add type exports (at end of file):

```typescript
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type NewComplianceRecord = typeof complianceRecords.$inferInsert;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/db/__tests__/schema-compliance.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/__tests__/schema-compliance.test.ts
git commit -m "feat(compliance): add complianceRecords database schema"
```

---

### Task 3: Create Compliance Service

**Files:**
- Create: `src/server/services/compliance.ts`
- Test: `src/server/services/__tests__/compliance.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/compliance.test.ts
import { describe, it, expect } from "vitest";
import {
  calculateNextDueDate,
  calculateComplianceStatus,
  type ComplianceStatus,
} from "../compliance";

describe("compliance service", () => {
  describe("calculateNextDueDate", () => {
    it("adds frequency months to completion date", () => {
      const completedAt = new Date("2026-01-15");
      const nextDue = calculateNextDueDate(completedAt, 12);
      expect(nextDue.toISOString().split("T")[0]).toBe("2027-01-15");
    });

    it("handles 24-month frequency", () => {
      const completedAt = new Date("2026-06-01");
      const nextDue = calculateNextDueDate(completedAt, 24);
      expect(nextDue.toISOString().split("T")[0]).toBe("2028-06-01");
    });
  });

  describe("calculateComplianceStatus", () => {
    it("returns compliant when more than 30 days until due", () => {
      const today = new Date("2026-01-01");
      const nextDueAt = new Date("2026-03-01"); // 59 days away
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("compliant");
    });

    it("returns upcoming when 30 days or less until due", () => {
      const today = new Date("2026-01-01");
      const nextDueAt = new Date("2026-01-25"); // 24 days away
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("upcoming");
    });

    it("returns due_soon when 7 days or less until due", () => {
      const today = new Date("2026-01-01");
      const nextDueAt = new Date("2026-01-05"); // 4 days away
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("due_soon");
    });

    it("returns overdue when past due date", () => {
      const today = new Date("2026-01-15");
      const nextDueAt = new Date("2026-01-10"); // 5 days overdue
      const status = calculateComplianceStatus(nextDueAt, today);
      expect(status).toBe("overdue");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/services/__tests__/compliance.test.ts`
Expected: FAIL with "Cannot find module '../compliance'"

**Step 3: Write minimal implementation**

```typescript
// src/server/services/compliance.ts
import { addMonths, differenceInDays } from "date-fns";

export type ComplianceStatus = "compliant" | "upcoming" | "due_soon" | "overdue";

/**
 * Calculate the next due date based on completion date and frequency
 */
export function calculateNextDueDate(completedAt: Date, frequencyMonths: number): Date {
  return addMonths(completedAt, frequencyMonths);
}

/**
 * Calculate compliance status based on next due date
 * - compliant: > 30 days until due
 * - upcoming: <= 30 days until due
 * - due_soon: <= 7 days until due
 * - overdue: past due date
 */
export function calculateComplianceStatus(
  nextDueAt: Date,
  today: Date = new Date()
): ComplianceStatus {
  const daysUntilDue = differenceInDays(nextDueAt, today);

  if (daysUntilDue < 0) {
    return "overdue";
  }
  if (daysUntilDue <= 7) {
    return "due_soon";
  }
  if (daysUntilDue <= 30) {
    return "upcoming";
  }
  return "compliant";
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/services/__tests__/compliance.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/compliance.ts src/server/services/__tests__/compliance.test.ts
git commit -m "feat(compliance): add compliance service with status calculation"
```

---

### Task 4: Create Compliance Router

**Files:**
- Create: `src/server/routers/compliance.ts`
- Test: `src/server/routers/__tests__/compliance.test.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing test**

```typescript
// src/server/routers/__tests__/compliance.test.ts
import { describe, it, expect } from "vitest";
import { complianceRouter } from "../compliance";

describe("Compliance router", () => {
  it("exports complianceRouter", () => {
    expect(complianceRouter).toBeDefined();
  });

  it("has getPropertyCompliance procedure", () => {
    expect(complianceRouter.getPropertyCompliance).toBeDefined();
  });

  it("has getPortfolioCompliance procedure", () => {
    expect(complianceRouter.getPortfolioCompliance).toBeDefined();
  });

  it("has recordCompletion procedure", () => {
    expect(complianceRouter.recordCompletion).toBeDefined();
  });

  it("has getHistory procedure", () => {
    expect(complianceRouter.getHistory).toBeDefined();
  });

  it("has updateRecord procedure", () => {
    expect(complianceRouter.updateRecord).toBeDefined();
  });

  it("has deleteRecord procedure", () => {
    expect(complianceRouter.deleteRecord).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/routers/__tests__/compliance.test.ts`
Expected: FAIL with "Cannot find module '../compliance'"

**Step 3: Write minimal implementation**

```typescript
// src/server/routers/compliance.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { complianceRecords, properties } from "../db/schema";
import { eq, and, desc, lte, gte } from "drizzle-orm";
import { getRequirementsForState, getRequirementById, type AustralianState } from "@/lib/compliance-requirements";
import { calculateNextDueDate, calculateComplianceStatus } from "../services/compliance";
import { addDays } from "date-fns";

export const complianceRouter = router({
  getPropertyCompliance: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get property to determine state
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Get requirements for this state
      const requirements = getRequirementsForState(property.state as AustralianState);

      // Get existing compliance records for this property
      const records = await ctx.db.query.complianceRecords.findMany({
        where: eq(complianceRecords.propertyId, input.propertyId),
        orderBy: [desc(complianceRecords.completedAt)],
      });

      // Build compliance status for each requirement
      const today = new Date();
      const complianceItems = requirements.map((req) => {
        // Find the most recent record for this requirement
        const latestRecord = records.find((r) => r.requirementId === req.id);

        if (!latestRecord) {
          return {
            requirement: req,
            lastRecord: null,
            nextDueAt: null,
            status: "overdue" as const, // Never recorded = overdue
          };
        }

        const nextDueAt = new Date(latestRecord.nextDueAt);
        const status = calculateComplianceStatus(nextDueAt, today);

        return {
          requirement: req,
          lastRecord: {
            id: latestRecord.id,
            completedAt: latestRecord.completedAt,
            notes: latestRecord.notes,
          },
          nextDueAt: latestRecord.nextDueAt,
          status,
        };
      });

      return {
        propertyId: property.id,
        propertyAddress: property.address,
        state: property.state,
        items: complianceItems,
      };
    }),

  getPortfolioCompliance: protectedProcedure.query(async ({ ctx }) => {
    // Get all user's active properties
    const userProperties = await ctx.db.query.properties.findMany({
      where: and(
        eq(properties.userId, ctx.portfolio.ownerId),
        eq(properties.status, "active")
      ),
    });

    if (userProperties.length === 0) {
      return {
        summary: { total: 0, compliant: 0, upcoming: 0, dueSoon: 0, overdue: 0 },
        upcomingItems: [],
        overdueItems: [],
      };
    }

    // Get all compliance records
    const allRecords = await ctx.db.query.complianceRecords.findMany({
      where: eq(complianceRecords.userId, ctx.portfolio.ownerId),
      orderBy: [desc(complianceRecords.completedAt)],
    });

    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);

    let compliant = 0;
    let upcoming = 0;
    let dueSoon = 0;
    let overdue = 0;
    const upcomingItems: Array<{
      propertyId: string;
      propertyAddress: string;
      requirementName: string;
      nextDueAt: string;
      status: string;
    }> = [];
    const overdueItems: Array<{
      propertyId: string;
      propertyAddress: string;
      requirementName: string;
      nextDueAt: string | null;
      status: string;
    }> = [];

    for (const property of userProperties) {
      const requirements = getRequirementsForState(property.state as AustralianState);
      const propertyRecords = allRecords.filter((r) => r.propertyId === property.id);

      for (const req of requirements) {
        const latestRecord = propertyRecords.find((r) => r.requirementId === req.id);

        if (!latestRecord) {
          overdue++;
          overdueItems.push({
            propertyId: property.id,
            propertyAddress: property.address,
            requirementName: req.name,
            nextDueAt: null,
            status: "overdue",
          });
          continue;
        }

        const nextDueAt = new Date(latestRecord.nextDueAt);
        const status = calculateComplianceStatus(nextDueAt, today);

        switch (status) {
          case "compliant":
            compliant++;
            break;
          case "upcoming":
            upcoming++;
            upcomingItems.push({
              propertyId: property.id,
              propertyAddress: property.address,
              requirementName: req.name,
              nextDueAt: latestRecord.nextDueAt,
              status,
            });
            break;
          case "due_soon":
            dueSoon++;
            upcomingItems.push({
              propertyId: property.id,
              propertyAddress: property.address,
              requirementName: req.name,
              nextDueAt: latestRecord.nextDueAt,
              status,
            });
            break;
          case "overdue":
            overdue++;
            overdueItems.push({
              propertyId: property.id,
              propertyAddress: property.address,
              requirementName: req.name,
              nextDueAt: latestRecord.nextDueAt,
              status,
            });
            break;
        }
      }
    }

    const total = compliant + upcoming + dueSoon + overdue;

    // Sort upcoming by date (soonest first)
    upcomingItems.sort((a, b) => {
      if (!a.nextDueAt || !b.nextDueAt) return 0;
      return new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime();
    });

    return {
      summary: { total, compliant, upcoming, dueSoon, overdue },
      upcomingItems: upcomingItems.slice(0, 10),
      overdueItems: overdueItems.slice(0, 10),
    };
  }),

  recordCompletion: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        requirementId: z.string(),
        completedAt: z.string(), // ISO date string
        notes: z.string().optional(),
        documentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Verify requirement exists for this state
      const requirement = getRequirementById(input.requirementId);
      if (!requirement) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid requirement" });
      }

      const stateRequirements = getRequirementsForState(property.state as AustralianState);
      if (!stateRequirements.some((r) => r.id === input.requirementId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Requirement not applicable for property state",
        });
      }

      // Calculate next due date
      const completedAt = new Date(input.completedAt);
      const nextDueAt = calculateNextDueDate(completedAt, requirement.frequencyMonths);

      // Create record
      const [record] = await ctx.db
        .insert(complianceRecords)
        .values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          requirementId: input.requirementId,
          completedAt: input.completedAt,
          nextDueAt: nextDueAt.toISOString().split("T")[0],
          notes: input.notes,
          documentId: input.documentId,
        })
        .returning();

      return {
        record,
        nextDueAt: nextDueAt.toISOString().split("T")[0],
      };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        requirementId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.query.complianceRecords.findMany({
        where: and(
          eq(complianceRecords.propertyId, input.propertyId),
          eq(complianceRecords.requirementId, input.requirementId),
          eq(complianceRecords.userId, ctx.portfolio.ownerId)
        ),
        orderBy: [desc(complianceRecords.completedAt)],
      });

      return records;
    }),

  updateRecord: writeProcedure
    .input(
      z.object({
        recordId: z.string().uuid(),
        completedAt: z.string().optional(),
        notes: z.string().optional(),
        documentId: z.string().uuid().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify record belongs to user
      const existingRecord = await ctx.db.query.complianceRecords.findFirst({
        where: and(
          eq(complianceRecords.id, input.recordId),
          eq(complianceRecords.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!existingRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      }

      const updates: Partial<{
        completedAt: string;
        nextDueAt: string;
        notes: string;
        documentId: string | null;
        updatedAt: Date;
      }> = { updatedAt: new Date() };

      if (input.completedAt !== undefined) {
        const requirement = getRequirementById(existingRecord.requirementId);
        if (requirement) {
          const completedAt = new Date(input.completedAt);
          const nextDueAt = calculateNextDueDate(completedAt, requirement.frequencyMonths);
          updates.completedAt = input.completedAt;
          updates.nextDueAt = nextDueAt.toISOString().split("T")[0];
        }
      }

      if (input.notes !== undefined) {
        updates.notes = input.notes;
      }

      if (input.documentId !== undefined) {
        updates.documentId = input.documentId;
      }

      const [updated] = await ctx.db
        .update(complianceRecords)
        .set(updates)
        .where(eq(complianceRecords.id, input.recordId))
        .returning();

      return updated;
    }),

  deleteRecord: writeProcedure
    .input(z.object({ recordId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(complianceRecords)
        .where(
          and(
            eq(complianceRecords.id, input.recordId),
            eq(complianceRecords.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      }

      return { success: true };
    }),
});
```

**Step 4: Register router in _app.ts**

Add import to `src/server/routers/_app.ts`:

```typescript
import { complianceRouter } from "./compliance";
```

Add to router object:

```typescript
compliance: complianceRouter,
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/server/routers/__tests__/compliance.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/routers/compliance.ts src/server/routers/__tests__/compliance.test.ts src/server/routers/_app.ts
git commit -m "feat(compliance): add compliance tRPC router with CRUD operations"
```

---

### Task 5: Create Portfolio Compliance Page

**Files:**
- Create: `src/app/(dashboard)/reports/compliance/page.tsx`
- Create: `src/components/compliance/ComplianceStatusBadge.tsx`
- Create: `src/components/compliance/ComplianceTable.tsx`

**Step 1: Create ComplianceStatusBadge component**

```typescript
// src/components/compliance/ComplianceStatusBadge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ComplianceStatus = "compliant" | "upcoming" | "due_soon" | "overdue";

const statusConfig: Record<ComplianceStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  compliant: { label: "Compliant", variant: "default" },
  upcoming: { label: "Upcoming", variant: "secondary" },
  due_soon: { label: "Due Soon", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
};

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  className?: string;
}

export function ComplianceStatusBadge({ status, className }: ComplianceStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
```

**Step 2: Create ComplianceTable component**

```typescript
// src/components/compliance/ComplianceTable.tsx
"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";
import { ExternalLink } from "lucide-react";

interface ComplianceItem {
  propertyId: string;
  propertyAddress: string;
  requirementName: string;
  nextDueAt: string | null;
  status: string;
}

interface ComplianceTableProps {
  items: ComplianceItem[];
  showProperty?: boolean;
}

export function ComplianceTable({ items, showProperty = true }: ComplianceTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No compliance items to display
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showProperty && <TableHead>Property</TableHead>}
          <TableHead>Requirement</TableHead>
          <TableHead>Next Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${item.propertyId}-${item.requirementName}-${index}`}>
            {showProperty && (
              <TableCell>
                <Link
                  href={`/properties/${item.propertyId}`}
                  className="hover:underline"
                >
                  {item.propertyAddress}
                </Link>
              </TableCell>
            )}
            <TableCell className="font-medium">{item.requirementName}</TableCell>
            <TableCell>
              {item.nextDueAt
                ? format(new Date(item.nextDueAt), "dd MMM yyyy")
                : "Never recorded"}
            </TableCell>
            <TableCell>
              <ComplianceStatusBadge status={item.status as any} />
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/properties/${item.propertyId}/compliance`}>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 3: Create Portfolio Compliance page**

```typescript
// src/app/(dashboard)/reports/compliance/page.tsx
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceTable } from "@/components/compliance/ComplianceTable";
import { CheckCircle2, AlertTriangle, Clock, AlertCircle } from "lucide-react";

export default function CompliancePage() {
  const { data, isLoading } = trpc.compliance.getPortfolioCompliance.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Compliance Calendar</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = data?.summary ?? { total: 0, compliant: 0, upcoming: 0, dueSoon: 0, overdue: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Compliance Calendar</h2>
        <p className="text-muted-foreground">
          Track smoke alarms, gas safety, and other compliance requirements
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliant</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.compliant}</div>
            <p className="text-xs text-muted-foreground">
              of {summary.total} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.upcoming}</div>
            <p className="text-xs text-muted-foreground">due within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.dueSoon}</div>
            <p className="text-xs text-muted-foreground">due within 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
            <p className="text-xs text-muted-foreground">require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Items */}
      {data?.overdueItems && data.overdueItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Overdue Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTable items={data.overdueItems} />
          </CardContent>
        </Card>
      )}

      {/* Upcoming Items */}
      {data?.upcomingItems && data.upcomingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Due Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTable items={data.upcomingItems} />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {summary.total === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Properties Yet</h3>
            <p className="text-muted-foreground">
              Add properties to start tracking compliance requirements.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 4: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/compliance/page.tsx src/components/compliance/ComplianceStatusBadge.tsx src/components/compliance/ComplianceTable.tsx
git commit -m "feat(compliance): add portfolio compliance page with summary cards"
```

---

### Task 6: Create Record Completion Modal

**Files:**
- Create: `src/components/compliance/RecordCompletionModal.tsx`

**Step 1: Create the modal component**

```typescript
// src/components/compliance/RecordCompletionModal.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface RecordCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  requirementId: string;
  requirementName: string;
  onSuccess?: () => void;
}

export function RecordCompletionModal({
  open,
  onOpenChange,
  propertyId,
  requirementId,
  requirementName,
  onSuccess,
}: RecordCompletionModalProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();

  const recordMutation = trpc.compliance.recordCompletion.useMutation({
    onSuccess: (data) => {
      toast.success(`Recorded completion. Next due: ${format(new Date(data.nextDueAt), "dd MMM yyyy")}`);
      utils.compliance.getPropertyCompliance.invalidate({ propertyId });
      utils.compliance.getPortfolioCompliance.invalidate();
      onOpenChange(false);
      setDate(new Date());
      setNotes("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    recordMutation.mutate({
      propertyId,
      requirementId,
      completedAt: format(date, "yyyy-MM-dd"),
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Completion</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Requirement</p>
            <p className="font-medium">{requirementName}</p>
          </div>

          <div className="space-y-2">
            <Label>Completion Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="e.g., Replaced batteries in all alarms"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={recordMutation.isPending}>
            {recordMutation.isPending ? "Saving..." : "Record Completion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/compliance/RecordCompletionModal.tsx
git commit -m "feat(compliance): add record completion modal"
```

---

### Task 7: Create Property Compliance Section

**Files:**
- Create: `src/components/compliance/PropertyComplianceSection.tsx`
- Create: `src/app/(dashboard)/properties/[id]/compliance/page.tsx`
- Modify: `src/app/(dashboard)/properties/[id]/layout.tsx`

**Step 1: Create PropertyComplianceSection component**

```typescript
// src/components/compliance/PropertyComplianceSection.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";
import { RecordCompletionModal } from "./RecordCompletionModal";
import { CheckCircle2, ClipboardCheck, History } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface PropertyComplianceSectionProps {
  propertyId: string;
}

export function PropertyComplianceSection({ propertyId }: PropertyComplianceSectionProps) {
  const [open, setOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoading } = trpc.compliance.getPropertyCompliance.useQuery({
    propertyId,
  });

  const handleRecordClick = (requirementId: string, requirementName: string) => {
    setSelectedRequirement({ id: requirementId, name: requirementName });
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No compliance requirements for {data?.state || "this state"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Compliance ({data.state})
                </div>
                {open ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {data.items.map((item) => (
                <div
                  key={item.requirement.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.requirement.name}</span>
                      <ComplianceStatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.lastRecord
                        ? `Last: ${format(new Date(item.lastRecord.completedAt), "dd MMM yyyy")} • Next: ${format(new Date(item.nextDueAt!), "dd MMM yyyy")}`
                        : "Never recorded"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRecordClick(item.requirement.id, item.requirement.name)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Record
                  </Button>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {selectedRequirement && (
        <RecordCompletionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          propertyId={propertyId}
          requirementId={selectedRequirement.id}
          requirementName={selectedRequirement.name}
        />
      )}
    </>
  );
}
```

**Step 2: Create property compliance page**

```typescript
// src/app/(dashboard)/properties/[id]/compliance/page.tsx
"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceStatusBadge } from "@/components/compliance/ComplianceStatusBadge";
import { RecordCompletionModal } from "@/components/compliance/RecordCompletionModal";
import { Button } from "@/components/ui/button";
import { CheckCircle2, History, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PropertyCompliancePage() {
  const params = useParams();
  const propertyId = params.id as string;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);

  const { data, isLoading } = trpc.compliance.getPropertyCompliance.useQuery({
    propertyId,
  });

  const { data: history } = trpc.compliance.getHistory.useQuery(
    { propertyId, requirementId: showHistoryFor! },
    { enabled: !!showHistoryFor }
  );

  const handleRecordClick = (requirementId: string, requirementName: string) => {
    setSelectedRequirement({ id: requirementId, name: requirementName });
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Compliance</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Property not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" />
          Compliance Requirements
        </h3>
        <p className="text-muted-foreground">
          {data.state} compliance requirements for {data.propertyAddress}
        </p>
      </div>

      <div className="grid gap-4">
        {data.items.map((item) => (
          <Card key={item.requirement.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {item.requirement.name}
                  <ComplianceStatusBadge status={item.status} />
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShowHistoryFor(
                        showHistoryFor === item.requirement.id
                          ? null
                          : item.requirement.id
                      )
                    }
                  >
                    <History className="w-4 h-4 mr-1" />
                    History
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleRecordClick(item.requirement.id, item.requirement.name)
                    }
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Record
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                {item.requirement.description}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Frequency:</span> Every{" "}
                {item.requirement.frequencyMonths} months
              </p>
              {item.lastRecord && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Last completed:</span>{" "}
                  {format(new Date(item.lastRecord.completedAt), "dd MMM yyyy")}
                  {item.lastRecord.notes && ` — ${item.lastRecord.notes}`}
                </p>
              )}
              {item.nextDueAt && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Next due:</span>{" "}
                  {format(new Date(item.nextDueAt), "dd MMM yyyy")}
                </p>
              )}

              {/* History Table */}
              {showHistoryFor === item.requirement.id && history && history.length > 0 && (
                <div className="mt-4 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Completed</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.completedAt), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRequirement && (
        <RecordCompletionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          propertyId={propertyId}
          requirementId={selectedRequirement.id}
          requirementName={selectedRequirement.name}
        />
      )}
    </div>
  );
}
```

**Step 3: Update property layout to include compliance route**

In `src/app/(dashboard)/properties/[id]/layout.tsx`, add compliance to the breadcrumb logic (around line 37):

```typescript
      } else if (pathname.includes("/compliance")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Compliance" });
```

**Step 4: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/compliance/PropertyComplianceSection.tsx src/app/\(dashboard\)/properties/\[id\]/compliance/page.tsx src/app/\(dashboard\)/properties/\[id\]/layout.tsx
git commit -m "feat(compliance): add property compliance section and detail page"
```

---

### Task 8: Add Navigation Links

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx`

**Step 1: Add compliance link to sidebar**

In `src/components/layout/Sidebar.tsx`, add import:

```typescript
import { ClipboardCheck } from "lucide-react";
```

Add to navItems array (after the "reports/share" item):

```typescript
  { href: "/reports/compliance", label: "Compliance", icon: ClipboardCheck },
```

**Step 2: Add PropertyComplianceSection to property detail page**

In `src/app/(dashboard)/properties/[id]/page.tsx`, add import:

```typescript
import { PropertyComplianceSection } from "@/components/compliance/PropertyComplianceSection";
```

Add the section after the ValuationCard (inside the grid):

```typescript
      {/* Compliance Section */}
      <div className="lg:col-span-2">
        <PropertyComplianceSection propertyId={propertyId} />
      </div>
```

**Step 3: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/app/\(dashboard\)/properties/\[id\]/page.tsx
git commit -m "feat(compliance): add navigation links and property detail integration"
```

---

### Task 9: Add Notification Preferences

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/services/notification.ts`

**Step 1: Add complianceReminders to notificationPreferences**

In `src/server/db/schema.ts`, add to notificationPreferences table (around line 1042):

```typescript
  complianceReminders: boolean("compliance_reminders").default(true).notNull(),
```

**Step 2: Update notification service**

In `src/server/services/notification.ts`, add to NotificationType:

```typescript
  | "compliance_reminder";
```

Add to NotificationPrefs interface:

```typescript
  complianceReminders: boolean;
```

Add case in shouldSendNotification:

```typescript
    case "compliance_reminder":
      return prefs.complianceReminders;
```

Update getDefaultPreferences:

```typescript
    complianceReminders: true,
```

**Step 3: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/db/schema.ts src/server/services/notification.ts
git commit -m "feat(compliance): add compliance reminder notification preference"
```

---

### Task 10: Create Compliance Reminder Cron

**Files:**
- Create: `src/app/api/cron/compliance-reminders/route.ts`

**Step 1: Create cron endpoint**

```typescript
// src/app/api/cron/compliance-reminders/route.ts
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { complianceRecords, properties, users } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyUser } from "@/server/services/notification";
import { getRequirementById } from "@/lib/compliance-requirements";
import { format, addDays } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const in7Days = format(addDays(today, 7), "yyyy-MM-dd");
  const in30Days = format(addDays(today, 30), "yyyy-MM-dd");

  let sent = 0;

  // Get all compliance records with upcoming due dates
  const upcomingRecords = await db
    .select({
      record: complianceRecords,
      property: properties,
      user: users,
    })
    .from(complianceRecords)
    .innerJoin(properties, eq(complianceRecords.propertyId, properties.id))
    .innerJoin(users, eq(complianceRecords.userId, users.id))
    .where(
      and(
        sql`${complianceRecords.nextDueAt} IN (${todayStr}, ${in7Days}, ${in30Days})`
      )
    );

  for (const { record, property, user } of upcomingRecords) {
    const requirement = getRequirementById(record.requirementId);
    if (!requirement) continue;

    const dueDate = new Date(record.nextDueAt);
    const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let title: string;
    let body: string;

    if (daysUntil === 0) {
      title = `Due today: ${requirement.name}`;
      body = `${property.address} - ${requirement.name} is due today.`;
    } else if (daysUntil === 7) {
      title = `Due soon: ${requirement.name}`;
      body = `${property.address} - ${requirement.name} is due in 7 days.`;
    } else if (daysUntil === 30) {
      title = `Upcoming: ${requirement.name}`;
      body = `${property.address} - ${requirement.name} is due in 30 days.`;
    } else {
      continue;
    }

    try {
      await notifyUser(user.id, user.email, "compliance_reminder", {
        title,
        body,
        url: `/properties/${property.id}/compliance`,
        emailSubject: title,
        emailHtml: `
          <h2>${title}</h2>
          <p>${body}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/properties/${property.id}/compliance">View Compliance Details</a></p>
        `,
      });
      sent++;
    } catch (error) {
      console.error("Failed to send compliance reminder:", error);
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    timestamp: new Date().toISOString(),
  });
}
```

**Step 2: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/cron/compliance-reminders/route.ts
git commit -m "feat(compliance): add daily compliance reminder cron job"
```

---

### Task 11: Final Verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve any remaining lint/type issues"
```
