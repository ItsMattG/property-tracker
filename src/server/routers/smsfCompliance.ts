import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  entities,
  smsfMembers,
  smsfContributions,
  smsfPensions,
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
} from "../services/compliance";

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
