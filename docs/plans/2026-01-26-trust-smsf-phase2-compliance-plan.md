# Trust/SMSF Phase 2 Compliance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SMSF and Trust compliance tracking (members, contributions, pensions, beneficiaries, distributions).

**Architecture:** New schema tables for compliance data, two new routers (smsfCompliance, trustCompliance), compliance dashboard pages under /entities/[id]/.

**Tech Stack:** Drizzle ORM, tRPC, React, shadcn/ui components.

---

## Task 1: Add SMSF Schema Tables

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add enums for SMSF**

Add after line 324 (after `entityMemberRoleEnum`):

```typescript
export const smsfMemberPhaseEnum = pgEnum("smsf_member_phase", [
  "accumulation",
  "pension",
]);

export const pensionFrequencyEnum = pgEnum("pension_frequency", [
  "monthly",
  "quarterly",
  "annual",
]);

export const smsfComplianceCheckTypeEnum = pgEnum("smsf_compliance_check_type", [
  "in_house_asset",
  "related_party",
  "arm_length",
]);

export const complianceStatusEnum = pgEnum("compliance_status", [
  "compliant",
  "warning",
  "breach",
]);
```

**Step 2: Add smsf_members table**

Add after `entityMembers` table:

```typescript
export const smsfMembers = pgTable(
  "smsf_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    memberSince: date("member_since").notNull(),
    phase: smsfMemberPhaseEnum("phase").notNull(),
    currentBalance: decimal("current_balance", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("smsf_members_entity_id_idx").on(table.entityId)]
);
```

**Step 3: Add smsf_contributions table**

```typescript
export const smsfContributions = pgTable(
  "smsf_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => smsfMembers.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    concessional: decimal("concessional", { precision: 12, scale: 2 }).default("0").notNull(),
    nonConcessional: decimal("non_concessional", { precision: 12, scale: 2 }).default("0").notNull(),
    totalSuperBalance: decimal("total_super_balance", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("smsf_contributions_entity_id_idx").on(table.entityId),
    index("smsf_contributions_member_id_idx").on(table.memberId),
  ]
);
```

**Step 4: Add smsf_pensions table**

```typescript
export const smsfPensions = pgTable(
  "smsf_pensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => smsfMembers.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    openingBalance: decimal("opening_balance", { precision: 14, scale: 2 }).notNull(),
    minimumRequired: decimal("minimum_required", { precision: 12, scale: 2 }).notNull(),
    amountDrawn: decimal("amount_drawn", { precision: 12, scale: 2 }).default("0").notNull(),
    frequency: pensionFrequencyEnum("frequency").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("smsf_pensions_entity_id_idx").on(table.entityId),
    index("smsf_pensions_member_id_idx").on(table.memberId),
  ]
);
```

**Step 5: Add smsf_compliance_checks table**

```typescript
export const smsfComplianceChecks = pgTable(
  "smsf_compliance_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    checkType: smsfComplianceCheckTypeEnum("check_type").notNull(),
    status: complianceStatusEnum("status").notNull(),
    details: jsonb("details"),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
  },
  (table) => [index("smsf_compliance_checks_entity_id_idx").on(table.entityId)]
);
```

**Step 6: Add smsf_audit_items table**

```typescript
export const smsfAuditItems = pgTable(
  "smsf_audit_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    item: text("item").notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("smsf_audit_items_entity_id_idx").on(table.entityId)]
);
```

**Step 7: Run migration**

Run: `npm run db:push`
Expected: Tables created successfully

**Step 8: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add SMSF compliance tables"
```

---

## Task 2: Add Trust Schema Tables

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add beneficiaries table**

```typescript
export const beneficiaries = pgTable(
  "beneficiaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    relationship: text("relationship").notNull(),
    tfn: text("tfn"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("beneficiaries_entity_id_idx").on(table.entityId)]
);
```

**Step 2: Add trust_distributions table**

```typescript
export const trustDistributions = pgTable(
  "trust_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    resolutionDate: date("resolution_date").notNull(),
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),
    capitalGainsComponent: decimal("capital_gains_component", { precision: 14, scale: 2 }).default("0").notNull(),
    frankingCreditsComponent: decimal("franking_credits_component", { precision: 12, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("trust_distributions_entity_id_idx").on(table.entityId)]
);
```

**Step 3: Add distribution_allocations table**

```typescript
export const distributionAllocations = pgTable(
  "distribution_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    distributionId: uuid("distribution_id")
      .references(() => trustDistributions.id, { onDelete: "cascade" })
      .notNull(),
    beneficiaryId: uuid("beneficiary_id")
      .references(() => beneficiaries.id, { onDelete: "cascade" })
      .notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    capitalGains: decimal("capital_gains", { precision: 14, scale: 2 }).default("0").notNull(),
    frankingCredits: decimal("franking_credits", { precision: 12, scale: 2 }).default("0").notNull(),
  },
  (table) => [
    index("distribution_allocations_distribution_id_idx").on(table.distributionId),
    index("distribution_allocations_beneficiary_id_idx").on(table.beneficiaryId),
  ]
);
```

**Step 4: Add relations for all new tables**

```typescript
export const smsfMembersRelations = relations(smsfMembers, ({ one, many }) => ({
  entity: one(entities, {
    fields: [smsfMembers.entityId],
    references: [entities.id],
  }),
  contributions: many(smsfContributions),
  pensions: many(smsfPensions),
}));

export const smsfContributionsRelations = relations(smsfContributions, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfContributions.entityId],
    references: [entities.id],
  }),
  member: one(smsfMembers, {
    fields: [smsfContributions.memberId],
    references: [smsfMembers.id],
  }),
}));

export const smsfPensionsRelations = relations(smsfPensions, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfPensions.entityId],
    references: [entities.id],
  }),
  member: one(smsfMembers, {
    fields: [smsfPensions.memberId],
    references: [smsfMembers.id],
  }),
}));

export const smsfComplianceChecksRelations = relations(smsfComplianceChecks, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfComplianceChecks.entityId],
    references: [entities.id],
  }),
}));

export const smsfAuditItemsRelations = relations(smsfAuditItems, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfAuditItems.entityId],
    references: [entities.id],
  }),
}));

export const beneficiariesRelations = relations(beneficiaries, ({ one, many }) => ({
  entity: one(entities, {
    fields: [beneficiaries.entityId],
    references: [entities.id],
  }),
  allocations: many(distributionAllocations),
}));

export const trustDistributionsRelations = relations(trustDistributions, ({ one, many }) => ({
  entity: one(entities, {
    fields: [trustDistributions.entityId],
    references: [entities.id],
  }),
  allocations: many(distributionAllocations),
}));

export const distributionAllocationsRelations = relations(distributionAllocations, ({ one }) => ({
  distribution: one(trustDistributions, {
    fields: [distributionAllocations.distributionId],
    references: [trustDistributions.id],
  }),
  beneficiary: one(beneficiaries, {
    fields: [distributionAllocations.beneficiaryId],
    references: [beneficiaries.id],
  }),
}));
```

**Step 5: Add type exports**

```typescript
export type SmsfMember = typeof smsfMembers.$inferSelect;
export type NewSmsfMember = typeof smsfMembers.$inferInsert;
export type SmsfContribution = typeof smsfContributions.$inferSelect;
export type NewSmsfContribution = typeof smsfContributions.$inferInsert;
export type SmsfPension = typeof smsfPensions.$inferSelect;
export type NewSmsfPension = typeof smsfPensions.$inferInsert;
export type SmsfComplianceCheck = typeof smsfComplianceChecks.$inferSelect;
export type NewSmsfComplianceCheck = typeof smsfComplianceChecks.$inferInsert;
export type SmsfAuditItem = typeof smsfAuditItems.$inferSelect;
export type NewSmsfAuditItem = typeof smsfAuditItems.$inferInsert;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type NewBeneficiary = typeof beneficiaries.$inferInsert;
export type TrustDistribution = typeof trustDistributions.$inferSelect;
export type NewTrustDistribution = typeof trustDistributions.$inferInsert;
export type DistributionAllocation = typeof distributionAllocations.$inferSelect;
export type NewDistributionAllocation = typeof distributionAllocations.$inferInsert;
```

**Step 6: Run migration**

Run: `npm run db:push`
Expected: Tables created successfully

**Step 7: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(db): add Trust compliance tables and relations"
```

---

## Task 3: Create SMSF Compliance Service

**Files:**
- Create: `src/server/services/smsf-compliance.ts`

**Step 1: Create the service file**

```typescript
// SMSF Compliance Constants and Calculations

export const CONTRIBUTION_CAPS = {
  concessional: 30000,
  nonConcessional: 120000,
  bringForward3Year: 360000,
} as const;

export const PENSION_MINIMUM_FACTORS: Record<string, number> = {
  "under65": 0.04,
  "65-74": 0.05,
  "75-79": 0.06,
  "80-84": 0.07,
  "85-89": 0.09,
  "90-94": 0.11,
  "95+": 0.14,
};

export function getAgeGroup(dateOfBirth: Date, asOfDate: Date = new Date()): string {
  const age = Math.floor(
    (asOfDate.getTime() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  if (age < 65) return "under65";
  if (age < 75) return "65-74";
  if (age < 80) return "75-79";
  if (age < 85) return "80-84";
  if (age < 90) return "85-89";
  if (age < 95) return "90-94";
  return "95+";
}

export function calculateMinimumPension(openingBalance: number, dateOfBirth: Date): number {
  const ageGroup = getAgeGroup(dateOfBirth);
  const factor = PENSION_MINIMUM_FACTORS[ageGroup];
  return Math.round(openingBalance * factor * 100) / 100;
}

export function getContributionCapStatus(
  concessional: number,
  nonConcessional: number
): { concessional: "ok" | "warning" | "breach"; nonConcessional: "ok" | "warning" | "breach" } {
  return {
    concessional:
      concessional > CONTRIBUTION_CAPS.concessional
        ? "breach"
        : concessional > CONTRIBUTION_CAPS.concessional * 0.9
        ? "warning"
        : "ok",
    nonConcessional:
      nonConcessional > CONTRIBUTION_CAPS.nonConcessional
        ? "breach"
        : nonConcessional > CONTRIBUTION_CAPS.nonConcessional * 0.9
        ? "warning"
        : "ok",
  };
}

export function getPensionDrawdownStatus(
  amountDrawn: number,
  minimumRequired: number,
  monthsElapsed: number
): "ok" | "warning" | "behind" {
  const proRataMinimum = (minimumRequired / 12) * monthsElapsed;
  if (amountDrawn >= proRataMinimum) return "ok";
  if (amountDrawn >= proRataMinimum * 0.8) return "warning";
  return "behind";
}

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // FY starts July 1
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

export function getMonthsElapsedInFY(): number {
  const now = new Date();
  const month = now.getMonth();
  // FY starts July (month 6)
  if (month >= 6) {
    return month - 6 + 1;
  }
  return month + 7;
}

export const DEFAULT_AUDIT_ITEMS = [
  "Investment strategy reviewed and documented",
  "Minutes of trustee meetings recorded",
  "Member statements issued",
  "Financial statements prepared",
  "Independent audit completed",
  "Annual return lodged with ATO",
  "Contribution caps verified for all members",
  "Pension minimum payments verified",
  "In-house asset test performed",
  "Related party transactions documented",
];
```

**Step 2: Commit**

```bash
git add src/server/services/smsf-compliance.ts
git commit -m "feat: add SMSF compliance service with calculations"
```

---

## Task 4: Create SMSF Compliance Router

**Files:**
- Create: `src/server/routers/smsfCompliance.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  entities,
  smsfMembers,
  smsfContributions,
  smsfPensions,
  smsfComplianceChecks,
  smsfAuditItems,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateMinimumPension,
  getContributionCapStatus,
  getPensionDrawdownStatus,
  getCurrentFinancialYear,
  getMonthsElapsedInFY,
  DEFAULT_AUDIT_ITEMS,
  CONTRIBUTION_CAPS,
} from "../services/smsf-compliance";

export const smsfComplianceRouter = router({
  // Member Management
  getMembers: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "smsf")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMSF entity not found" });
      }
      return ctx.db.query.smsfMembers.findMany({
        where: eq(smsfMembers.entityId, input.entityId),
        orderBy: (members, { asc }) => [asc(members.name)],
      });
    }),

  addMember: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      name: z.string().min(1),
      dateOfBirth: z.string(),
      memberSince: z.string(),
      phase: z.enum(["accumulation", "pension"]),
      currentBalance: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "smsf")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMSF entity not found" });
      }
      const [member] = await ctx.db.insert(smsfMembers).values({
        entityId: input.entityId,
        name: input.name,
        dateOfBirth: input.dateOfBirth,
        memberSince: input.memberSince,
        phase: input.phase,
        currentBalance: input.currentBalance.toString(),
      }).returning();
      return member;
    }),

  updateMember: protectedProcedure
    .input(z.object({
      memberId: z.string().uuid(),
      name: z.string().min(1).optional(),
      phase: z.enum(["accumulation", "pension"]).optional(),
      currentBalance: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.query.smsfMembers.findFirst({
        where: eq(smsfMembers.id, input.memberId),
        with: { entity: true },
      });
      if (!member || member.entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.phase) updates.phase = input.phase;
      if (input.currentBalance !== undefined) updates.currentBalance = input.currentBalance.toString();

      const [updated] = await ctx.db.update(smsfMembers)
        .set(updates)
        .where(eq(smsfMembers.id, input.memberId))
        .returning();
      return updated;
    }),

  // Contributions
  getContributions: protectedProcedure
    .input(z.object({ entityId: z.string().uuid(), year: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();
      const contributions = await ctx.db.query.smsfContributions.findMany({
        where: and(
          eq(smsfContributions.entityId, input.entityId),
          eq(smsfContributions.financialYear, year)
        ),
        with: { member: true },
      });
      return contributions.map((c) => ({
        ...c,
        concessional: parseFloat(c.concessional),
        nonConcessional: parseFloat(c.nonConcessional),
        status: getContributionCapStatus(
          parseFloat(c.concessional),
          parseFloat(c.nonConcessional)
        ),
        caps: CONTRIBUTION_CAPS,
      }));
    }),

  addContribution: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      memberId: z.string().uuid(),
      year: z.string().optional(),
      concessional: z.number().min(0).optional(),
      nonConcessional: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();

      // Check if record exists for this member/year
      const existing = await ctx.db.query.smsfContributions.findFirst({
        where: and(
          eq(smsfContributions.entityId, input.entityId),
          eq(smsfContributions.memberId, input.memberId),
          eq(smsfContributions.financialYear, year)
        ),
      });

      if (existing) {
        const newConcessional = parseFloat(existing.concessional) + (input.concessional || 0);
        const newNonConcessional = parseFloat(existing.nonConcessional) + (input.nonConcessional || 0);

        const [updated] = await ctx.db.update(smsfContributions)
          .set({
            concessional: newConcessional.toString(),
            nonConcessional: newNonConcessional.toString(),
            updatedAt: new Date(),
          })
          .where(eq(smsfContributions.id, existing.id))
          .returning();

        return {
          ...updated,
          status: getContributionCapStatus(newConcessional, newNonConcessional),
        };
      }

      const [contribution] = await ctx.db.insert(smsfContributions).values({
        entityId: input.entityId,
        memberId: input.memberId,
        financialYear: year,
        concessional: (input.concessional || 0).toString(),
        nonConcessional: (input.nonConcessional || 0).toString(),
      }).returning();

      return {
        ...contribution,
        status: getContributionCapStatus(input.concessional || 0, input.nonConcessional || 0),
      };
    }),

  // Pensions
  getPensionStatus: protectedProcedure
    .input(z.object({ entityId: z.string().uuid(), year: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();
      const pensions = await ctx.db.query.smsfPensions.findMany({
        where: and(
          eq(smsfPensions.entityId, input.entityId),
          eq(smsfPensions.financialYear, year)
        ),
        with: { member: true },
      });

      const monthsElapsed = getMonthsElapsedInFY();

      return pensions.map((p) => ({
        ...p,
        openingBalance: parseFloat(p.openingBalance),
        minimumRequired: parseFloat(p.minimumRequired),
        amountDrawn: parseFloat(p.amountDrawn),
        status: getPensionDrawdownStatus(
          parseFloat(p.amountDrawn),
          parseFloat(p.minimumRequired),
          monthsElapsed
        ),
        monthsElapsed,
      }));
    }),

  recordPension: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      memberId: z.string().uuid(),
      amount: z.number().min(0),
      year: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();

      const existing = await ctx.db.query.smsfPensions.findFirst({
        where: and(
          eq(smsfPensions.entityId, input.entityId),
          eq(smsfPensions.memberId, input.memberId),
          eq(smsfPensions.financialYear, year)
        ),
      });

      if (existing) {
        const newDrawn = parseFloat(existing.amountDrawn) + input.amount;
        const [updated] = await ctx.db.update(smsfPensions)
          .set({ amountDrawn: newDrawn.toString(), updatedAt: new Date() })
          .where(eq(smsfPensions.id, existing.id))
          .returning();
        return updated;
      }

      // Need to create new pension record - get member for minimum calc
      const member = await ctx.db.query.smsfMembers.findFirst({
        where: eq(smsfMembers.id, input.memberId),
      });
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      const minimumRequired = calculateMinimumPension(
        parseFloat(member.currentBalance),
        new Date(member.dateOfBirth)
      );

      const [pension] = await ctx.db.insert(smsfPensions).values({
        entityId: input.entityId,
        memberId: input.memberId,
        financialYear: year,
        openingBalance: member.currentBalance,
        minimumRequired: minimumRequired.toString(),
        amountDrawn: input.amount.toString(),
        frequency: "monthly",
      }).returning();

      return pension;
    }),

  // Audit Checklist
  getAuditChecklist: protectedProcedure
    .input(z.object({ entityId: z.string().uuid(), year: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();

      let items = await ctx.db.query.smsfAuditItems.findMany({
        where: and(
          eq(smsfAuditItems.entityId, input.entityId),
          eq(smsfAuditItems.financialYear, year)
        ),
      });

      // Create default items if none exist
      if (items.length === 0) {
        const newItems = DEFAULT_AUDIT_ITEMS.map((item) => ({
          entityId: input.entityId,
          financialYear: year,
          item,
        }));
        items = await ctx.db.insert(smsfAuditItems).values(newItems).returning();
      }

      return items;
    }),

  updateChecklistItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(smsfAuditItems)
        .set({
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
        })
        .where(eq(smsfAuditItems.id, input.itemId))
        .returning();
      return updated;
    }),

  // Dashboard
  getDashboard: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const year = getCurrentFinancialYear();

      const [members, contributions, pensions, auditItems] = await Promise.all([
        ctx.db.query.smsfMembers.findMany({
          where: eq(smsfMembers.entityId, input.entityId),
        }),
        ctx.db.query.smsfContributions.findMany({
          where: and(
            eq(smsfContributions.entityId, input.entityId),
            eq(smsfContributions.financialYear, year)
          ),
          with: { member: true },
        }),
        ctx.db.query.smsfPensions.findMany({
          where: and(
            eq(smsfPensions.entityId, input.entityId),
            eq(smsfPensions.financialYear, year)
          ),
          with: { member: true },
        }),
        ctx.db.query.smsfAuditItems.findMany({
          where: and(
            eq(smsfAuditItems.entityId, input.entityId),
            eq(smsfAuditItems.financialYear, year)
          ),
        }),
      ]);

      const monthsElapsed = getMonthsElapsedInFY();

      return {
        financialYear: year,
        members: members.length,
        contributions: contributions.map((c) => ({
          memberId: c.memberId,
          memberName: c.member.name,
          concessional: parseFloat(c.concessional),
          nonConcessional: parseFloat(c.nonConcessional),
          status: getContributionCapStatus(parseFloat(c.concessional), parseFloat(c.nonConcessional)),
        })),
        pensions: pensions.map((p) => ({
          memberId: p.memberId,
          memberName: p.member.name,
          minimumRequired: parseFloat(p.minimumRequired),
          amountDrawn: parseFloat(p.amountDrawn),
          status: getPensionDrawdownStatus(parseFloat(p.amountDrawn), parseFloat(p.minimumRequired), monthsElapsed),
        })),
        auditChecklist: {
          total: auditItems.length,
          completed: auditItems.filter((i) => i.completed).length,
        },
        caps: CONTRIBUTION_CAPS,
      };
    }),
});
```

**Step 2: Register in _app.ts**

Add import and register the router:

```typescript
import { smsfComplianceRouter } from "./smsfCompliance";

// In appRouter:
smsfCompliance: smsfComplianceRouter,
```

**Step 3: Verify types**

Run: `npm run typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server/routers/smsfCompliance.ts src/server/routers/_app.ts
git commit -m "feat(api): add SMSF compliance router"
```

---

## Task 5: Create Trust Compliance Service

**Files:**
- Create: `src/server/services/trust-compliance.ts`

**Step 1: Create the service**

```typescript
// Trust Compliance - Distribution Deadlines and Calculations

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

export function getDistributionDeadline(financialYear: string): Date {
  // Distribution must be resolved by June 30
  const [startYear] = financialYear.split("-");
  const endYear = parseInt(startYear) + 1;
  return new Date(endYear, 5, 30); // June 30
}

export function getDaysUntilDeadline(financialYear: string): number {
  const deadline = getDistributionDeadline(financialYear);
  const now = new Date();
  const diffTime = deadline.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDeadlineStatus(
  financialYear: string,
  hasDistribution: boolean
): "compliant" | "info" | "warning" | "urgent" | "overdue" {
  if (hasDistribution) return "compliant";

  const daysUntil = getDaysUntilDeadline(financialYear);

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 5) return "urgent";
  if (daysUntil <= 15) return "warning";
  if (daysUntil <= 30) return "info";
  return "compliant";
}

export function validateAllocationTotals(
  totalAmount: number,
  capitalGainsComponent: number,
  frankingCreditsComponent: number,
  allocations: Array<{ amount: number; capitalGains: number; frankingCredits: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const allocatedAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
  const allocatedCG = allocations.reduce((sum, a) => sum + a.capitalGains, 0);
  const allocatedFranking = allocations.reduce((sum, a) => sum + a.frankingCredits, 0);

  if (Math.abs(allocatedAmount - totalAmount) > 0.01) {
    errors.push(`Total amount mismatch: allocated ${allocatedAmount}, expected ${totalAmount}`);
  }
  if (Math.abs(allocatedCG - capitalGainsComponent) > 0.01) {
    errors.push(`Capital gains mismatch: allocated ${allocatedCG}, expected ${capitalGainsComponent}`);
  }
  if (Math.abs(allocatedFranking - frankingCreditsComponent) > 0.01) {
    errors.push(`Franking credits mismatch: allocated ${allocatedFranking}, expected ${frankingCreditsComponent}`);
  }

  return { valid: errors.length === 0, errors };
}
```

**Step 2: Commit**

```bash
git add src/server/services/trust-compliance.ts
git commit -m "feat: add Trust compliance service"
```

---

## Task 6: Create Trust Compliance Router

**Files:**
- Create: `src/server/routers/trustCompliance.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  entities,
  beneficiaries,
  trustDistributions,
  distributionAllocations,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  getCurrentFinancialYear,
  getDaysUntilDeadline,
  getDeadlineStatus,
  validateAllocationTotals,
} from "../services/trust-compliance";

export const trustComplianceRouter = router({
  // Beneficiary Management
  getBeneficiaries: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "trust")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trust entity not found" });
      }
      return ctx.db.query.beneficiaries.findMany({
        where: eq(beneficiaries.entityId, input.entityId),
        orderBy: (b, { asc }) => [asc(b.name)],
      });
    }),

  addBeneficiary: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      name: z.string().min(1),
      relationship: z.string().min(1),
      tfn: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "trust")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trust entity not found" });
      }
      const [beneficiary] = await ctx.db.insert(beneficiaries).values({
        entityId: input.entityId,
        name: input.name,
        relationship: input.relationship,
        tfn: input.tfn,
      }).returning();
      return beneficiary;
    }),

  updateBeneficiary: protectedProcedure
    .input(z.object({
      beneficiaryId: z.string().uuid(),
      name: z.string().min(1).optional(),
      relationship: z.string().min(1).optional(),
      tfn: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const beneficiary = await ctx.db.query.beneficiaries.findFirst({
        where: eq(beneficiaries.id, input.beneficiaryId),
        with: { entity: true },
      });
      if (!beneficiary || beneficiary.entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Beneficiary not found" });
      }
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.relationship) updates.relationship = input.relationship;
      if (input.tfn !== undefined) updates.tfn = input.tfn;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      const [updated] = await ctx.db.update(beneficiaries)
        .set(updates)
        .where(eq(beneficiaries.id, input.beneficiaryId))
        .returning();
      return updated;
    }),

  // Distributions
  getDistributions: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.trustDistributions.findMany({
        where: eq(trustDistributions.entityId, input.entityId),
        with: { allocations: { with: { beneficiary: true } } },
        orderBy: [desc(trustDistributions.financialYear)],
      });
    }),

  getDistribution: protectedProcedure
    .input(z.object({ distributionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const distribution = await ctx.db.query.trustDistributions.findFirst({
        where: eq(trustDistributions.id, input.distributionId),
        with: {
          allocations: { with: { beneficiary: true } },
          entity: true,
        },
      });
      if (!distribution || distribution.entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Distribution not found" });
      }
      return distribution;
    }),

  createDistribution: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      financialYear: z.string(),
      resolutionDate: z.string(),
      totalAmount: z.number().min(0),
      capitalGainsComponent: z.number().min(0).default(0),
      frankingCreditsComponent: z.number().min(0).default(0),
      allocations: z.array(z.object({
        beneficiaryId: z.string().uuid(),
        amount: z.number().min(0),
        capitalGains: z.number().min(0).default(0),
        frankingCredits: z.number().min(0).default(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "trust")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trust entity not found" });
      }

      // Validate allocations sum to totals
      const validation = validateAllocationTotals(
        input.totalAmount,
        input.capitalGainsComponent,
        input.frankingCreditsComponent,
        input.allocations
      );
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.join("; "),
        });
      }

      // Create distribution
      const [distribution] = await ctx.db.insert(trustDistributions).values({
        entityId: input.entityId,
        financialYear: input.financialYear,
        resolutionDate: input.resolutionDate,
        totalAmount: input.totalAmount.toString(),
        capitalGainsComponent: input.capitalGainsComponent.toString(),
        frankingCreditsComponent: input.frankingCreditsComponent.toString(),
      }).returning();

      // Create allocations
      if (input.allocations.length > 0) {
        await ctx.db.insert(distributionAllocations).values(
          input.allocations.map((a) => ({
            distributionId: distribution.id,
            beneficiaryId: a.beneficiaryId,
            amount: a.amount.toString(),
            capitalGains: a.capitalGains.toString(),
            frankingCredits: a.frankingCredits.toString(),
          }))
        );
      }

      return distribution;
    }),

  // Deadline Status
  getDeadlineStatus: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const year = getCurrentFinancialYear();

      const distribution = await ctx.db.query.trustDistributions.findFirst({
        where: and(
          eq(trustDistributions.entityId, input.entityId),
          eq(trustDistributions.financialYear, year)
        ),
      });

      const hasDistribution = !!distribution;
      const daysUntil = getDaysUntilDeadline(year);
      const status = getDeadlineStatus(year, hasDistribution);

      return {
        financialYear: year,
        hasDistribution,
        daysUntilDeadline: daysUntil,
        status,
        distribution: distribution || null,
      };
    }),

  // Dashboard
  getDashboard: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const year = getCurrentFinancialYear();

      const [beneficiaryList, distributions] = await Promise.all([
        ctx.db.query.beneficiaries.findMany({
          where: and(
            eq(beneficiaries.entityId, input.entityId),
            eq(beneficiaries.isActive, true)
          ),
        }),
        ctx.db.query.trustDistributions.findMany({
          where: eq(trustDistributions.entityId, input.entityId),
          with: { allocations: { with: { beneficiary: true } } },
          orderBy: [desc(trustDistributions.financialYear)],
          limit: 5,
        }),
      ]);

      const currentYearDistribution = distributions.find((d) => d.financialYear === year);
      const hasDistribution = !!currentYearDistribution;
      const daysUntil = getDaysUntilDeadline(year);
      const status = getDeadlineStatus(year, hasDistribution);

      return {
        financialYear: year,
        deadline: {
          daysUntil,
          status,
          hasDistribution,
        },
        beneficiaries: beneficiaryList.length,
        recentDistributions: distributions.map((d) => ({
          id: d.id,
          financialYear: d.financialYear,
          totalAmount: parseFloat(d.totalAmount),
          resolutionDate: d.resolutionDate,
          allocations: d.allocations.length,
        })),
      };
    }),
});
```

**Step 2: Register in _app.ts**

```typescript
import { trustComplianceRouter } from "./trustCompliance";

// In appRouter:
trustCompliance: trustComplianceRouter,
```

**Step 3: Verify types**

Run: `npm run typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server/routers/trustCompliance.ts src/server/routers/_app.ts
git commit -m "feat(api): add Trust compliance router"
```

---

## Task 7: Create SMSF Compliance Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/entities/[id]/compliance/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const config = {
    ok: { label: "On Track", variant: "default" as const, icon: CheckCircle2 },
    compliant: { label: "Compliant", variant: "default" as const, icon: CheckCircle2 },
    warning: { label: "Warning", variant: "secondary" as const, icon: AlertTriangle },
    info: { label: "Info", variant: "secondary" as const, icon: Clock },
    behind: { label: "Behind", variant: "destructive" as const, icon: XCircle },
    breach: { label: "Breach", variant: "destructive" as const, icon: XCircle },
    urgent: { label: "Urgent", variant: "destructive" as const, icon: AlertTriangle },
    overdue: { label: "Overdue", variant: "destructive" as const, icon: XCircle },
  }[status] || { label: status, variant: "outline" as const, icon: Clock };

  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function EntityCompliancePage() {
  const params = useParams();
  const entityId = params.id as string;

  const { data: entity, isLoading: entityLoading } = trpc.entity.get.useQuery({ entityId });
  const { data: smsfDashboard, isLoading: smsfLoading } = trpc.smsfCompliance.getDashboard.useQuery(
    { entityId },
    { enabled: entity?.type === "smsf" }
  );
  const { data: trustDashboard, isLoading: trustLoading } = trpc.trustCompliance.getDashboard.useQuery(
    { entityId },
    { enabled: entity?.type === "trust" }
  );

  if (entityLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!entity) {
    return <Alert><AlertDescription>Entity not found</AlertDescription></Alert>;
  }

  if (entity.type === "smsf") {
    if (smsfLoading || !smsfDashboard) {
      return <Skeleton className="h-96" />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">SMSF Compliance</h1>
          <p className="text-muted-foreground">Financial Year {smsfDashboard.financialYear}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Contribution Caps */}
          <Card>
            <CardHeader>
              <CardTitle>Contribution Caps</CardTitle>
              <CardDescription>Track member contributions against limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {smsfDashboard.contributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contributions recorded</p>
              ) : (
                smsfDashboard.contributions.map((c) => (
                  <div key={c.memberId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{c.memberName}</span>
                      <StatusBadge status={c.status.concessional} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Concessional</span>
                        <span>${c.concessional.toLocaleString()} / ${smsfDashboard.caps.concessional.toLocaleString()}</span>
                      </div>
                      <Progress value={(c.concessional / smsfDashboard.caps.concessional) * 100} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Non-concessional</span>
                        <span>${c.nonConcessional.toLocaleString()} / ${smsfDashboard.caps.nonConcessional.toLocaleString()}</span>
                      </div>
                      <Progress value={(c.nonConcessional / smsfDashboard.caps.nonConcessional) * 100} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pension Drawdowns */}
          <Card>
            <CardHeader>
              <CardTitle>Pension Drawdowns</CardTitle>
              <CardDescription>Minimum pension requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {smsfDashboard.pensions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pension members</p>
              ) : (
                smsfDashboard.pensions.map((p) => (
                  <div key={p.memberId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{p.memberName}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Drawn / Minimum</span>
                        <span>${p.amountDrawn.toLocaleString()} / ${p.minimumRequired.toLocaleString()}</span>
                      </div>
                      <Progress value={(p.amountDrawn / p.minimumRequired) * 100} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Audit Checklist */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Audit Checklist</CardTitle>
              <CardDescription>
                {smsfDashboard.auditChecklist.completed} of {smsfDashboard.auditChecklist.total} items completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress
                value={(smsfDashboard.auditChecklist.completed / smsfDashboard.auditChecklist.total) * 100}
                className="h-2"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (entity.type === "trust") {
    if (trustLoading || !trustDashboard) {
      return <Skeleton className="h-96" />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Trust Compliance</h1>
          <p className="text-muted-foreground">Financial Year {trustDashboard.financialYear}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Distribution Deadline */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution Deadline</CardTitle>
              <CardDescription>June 30 resolution requirement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-3xl font-bold",
                    trustDashboard.deadline.daysUntil < 0 && "text-destructive",
                    trustDashboard.deadline.daysUntil <= 5 && trustDashboard.deadline.daysUntil >= 0 && "text-orange-500"
                  )}>
                    {trustDashboard.deadline.daysUntil < 0
                      ? `${Math.abs(trustDashboard.deadline.daysUntil)} days overdue`
                      : `${trustDashboard.deadline.daysUntil} days`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">until deadline</p>
                </div>
                <StatusBadge status={trustDashboard.deadline.status} />
              </div>
              {trustDashboard.deadline.hasDistribution && (
                <p className="mt-4 text-sm text-green-600">Distribution recorded for this year</p>
              )}
            </CardContent>
          </Card>

          {/* Beneficiaries */}
          <Card>
            <CardHeader>
              <CardTitle>Beneficiaries</CardTitle>
              <CardDescription>Active trust beneficiaries</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{trustDashboard.beneficiaries}</p>
              <p className="text-sm text-muted-foreground">registered beneficiaries</p>
            </CardContent>
          </Card>

          {/* Recent Distributions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Distribution History</CardTitle>
            </CardHeader>
            <CardContent>
              {trustDashboard.recentDistributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No distributions recorded</p>
              ) : (
                <div className="space-y-2">
                  {trustDashboard.recentDistributions.map((d) => (
                    <div key={d.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <span className="font-medium">{d.financialYear}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({d.allocations} beneficiaries)
                        </span>
                      </div>
                      <span className="font-medium">${d.totalAmount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Alert>
      <AlertDescription>
        Compliance tracking is only available for Trust and SMSF entities.
      </AlertDescription>
    </Alert>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/entities/\[id\]/compliance/page.tsx
git commit -m "feat(ui): add entity compliance dashboard page"
```

---

## Task 8: Add Sidebar Navigation for Entity Compliance

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add compliance link to entity section**

After the EntitySwitcher component, add conditional compliance link:

```typescript
// Add to imports
import { Scale } from "lucide-react";

// After EntitySwitcher, add:
const { data: activeEntity } = trpc.entity.getActive.useQuery();

// Render compliance link if entity is trust or smsf:
{activeEntity && (activeEntity.type === "trust" || activeEntity.type === "smsf") && (
  <Link
    href={`/entities/${activeEntity.id}/compliance`}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      pathname === `/entities/${activeEntity.id}/compliance`
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}
  >
    <Scale className="w-5 h-5" />
    Compliance
  </Link>
)}
```

**Step 2: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add compliance link to sidebar for Trust/SMSF"
```

---

## Task 9: Add Members Management Page (SMSF)

**Files:**
- Create: `src/app/(dashboard)/entities/[id]/members/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, User } from "lucide-react";

export default function MembersPage() {
  const params = useParams();
  const entityId = params.id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    memberSince: "",
    phase: "accumulation" as "accumulation" | "pension",
    currentBalance: "",
  });

  const { data: entity, isLoading: entityLoading } = trpc.entity.get.useQuery({ entityId });
  const { data: members, isLoading, refetch } = trpc.smsfCompliance.getMembers.useQuery(
    { entityId },
    { enabled: entity?.type === "smsf" }
  );

  const addMember = trpc.smsfCompliance.addMember.useMutation({
    onSuccess: () => {
      refetch();
      setIsOpen(false);
      setFormData({
        name: "",
        dateOfBirth: "",
        memberSince: "",
        phase: "accumulation",
        currentBalance: "",
      });
    },
  });

  if (entityLoading || isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!entity || entity.type !== "smsf") {
    return (
      <Alert>
        <AlertDescription>Member management is only available for SMSF entities.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SMSF Members</h1>
          <p className="text-muted-foreground">{entity.name}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add SMSF Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="memberSince">Member Since</Label>
                <Input
                  id="memberSince"
                  type="date"
                  value={formData.memberSince}
                  onChange={(e) => setFormData({ ...formData, memberSince: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phase">Phase</Label>
                <Select
                  value={formData.phase}
                  onValueChange={(v) => setFormData({ ...formData, phase: v as "accumulation" | "pension" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accumulation">Accumulation</SelectItem>
                    <SelectItem value="pension">Pension</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="balance">Current Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, currentBalance: e.target.value })}
                />
              </div>
              <Button
                onClick={() => addMember.mutate({
                  entityId,
                  ...formData,
                  currentBalance: parseFloat(formData.currentBalance) || 0,
                })}
                disabled={!formData.name || !formData.dateOfBirth || addMember.isPending}
                className="w-full"
              >
                {addMember.isPending ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {members?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No members added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {members?.map((member) => (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{member.name}</CardTitle>
                  <Badge variant={member.phase === "pension" ? "default" : "secondary"}>
                    {member.phase}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>DOB: {member.dateOfBirth}</p>
                  <p>Member since: {member.memberSince}</p>
                  <p className="font-medium">Balance: ${parseFloat(member.currentBalance).toLocaleString()}</p>
                </div>
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
git add src/app/\(dashboard\)/entities/\[id\]/members/page.tsx
git commit -m "feat(ui): add SMSF members management page"
```

---

## Task 10: Add Beneficiaries Management Page (Trust)

**Files:**
- Create: `src/app/(dashboard)/entities/[id]/beneficiaries/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";

export default function BeneficiariesPage() {
  const params = useParams();
  const entityId = params.id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    tfn: "",
  });

  const { data: entity, isLoading: entityLoading } = trpc.entity.get.useQuery({ entityId });
  const { data: beneficiaries, isLoading, refetch } = trpc.trustCompliance.getBeneficiaries.useQuery(
    { entityId },
    { enabled: entity?.type === "trust" }
  );

  const addBeneficiary = trpc.trustCompliance.addBeneficiary.useMutation({
    onSuccess: () => {
      refetch();
      setIsOpen(false);
      setFormData({ name: "", relationship: "", tfn: "" });
    },
  });

  if (entityLoading || isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!entity || entity.type !== "trust") {
    return (
      <Alert>
        <AlertDescription>Beneficiary management is only available for Trust entities.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Trust Beneficiaries</h1>
          <p className="text-muted-foreground">{entity.name}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Beneficiary
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Beneficiary</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Input
                  id="relationship"
                  placeholder="e.g., Spouse, Child, Parent"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tfn">TFN (optional)</Label>
                <Input
                  id="tfn"
                  value={formData.tfn}
                  onChange={(e) => setFormData({ ...formData, tfn: e.target.value })}
                />
              </div>
              <Button
                onClick={() => addBeneficiary.mutate({
                  entityId,
                  ...formData,
                  tfn: formData.tfn || undefined,
                })}
                disabled={!formData.name || !formData.relationship || addBeneficiary.isPending}
                className="w-full"
              >
                {addBeneficiary.isPending ? "Adding..." : "Add Beneficiary"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {beneficiaries?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No beneficiaries added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {beneficiaries?.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <Badge variant={b.isActive ? "default" : "secondary"}>
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{b.relationship}</p>
                {b.tfn && <p className="text-sm text-muted-foreground mt-1">TFN: ***-***-{b.tfn.slice(-3)}</p>}
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
git add src/app/\(dashboard\)/entities/\[id\]/beneficiaries/page.tsx
git commit -m "feat(ui): add Trust beneficiaries management page"
```

---

## Task 11: Run Full Test Suite and Fix Issues

**Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors (fix any that appear)

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and type issues"
```

---

## Task 12: Final Commit and Summary

**Step 1: Review all changes**

Run: `git log --oneline -10`

**Step 2: Create summary commit if needed**

If there are uncommitted changes:
```bash
git add -A
git commit -m "feat: complete Trust/SMSF Phase 2 compliance implementation"
```

---

## Summary

This plan implements:
- **Database:** 8 new tables for SMSF and Trust compliance
- **Services:** Calculation helpers for contribution caps, pension minimums, distribution deadlines
- **API:** 2 new routers with full CRUD and dashboard endpoints
- **UI:** Compliance dashboard, members page, beneficiaries page
- **Navigation:** Sidebar link for Trust/SMSF entities

Total: 12 tasks with bite-sized steps for TDD implementation.
