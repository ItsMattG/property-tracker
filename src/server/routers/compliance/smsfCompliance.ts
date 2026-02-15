import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { router, protectedProcedure } from "../../trpc";
import { entities } from "../../db/schema";
import type { SmsfMember } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateMinimumPension,
  getContributionCapStatus,
  getPensionDrawdownStatus,
  getCurrentFinancialYear,
  getMonthsElapsedInFY,
  DEFAULT_AUDIT_ITEMS,
  CONTRIBUTION_CAPS,
} from "../../services/compliance";

export const smsfComplianceRouter = router({
  // Member Management
  getMembers: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Cross-domain: entity ownership validation
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "smsf")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMSF entity not found" });
      }
      return ctx.uow.compliance.findSmsfMembers(input.entityId);
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
      // Cross-domain: entity ownership validation
      const entity = await ctx.db.query.entities.findFirst({
        where: and(eq(entities.id, input.entityId), eq(entities.type, "smsf")),
      });
      if (!entity || entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMSF entity not found" });
      }
      return ctx.uow.compliance.createSmsfMember({
        entityId: input.entityId,
        name: input.name,
        dateOfBirth: input.dateOfBirth,
        memberSince: input.memberSince,
        phase: input.phase,
        currentBalance: input.currentBalance.toString(),
      });
    }),

  updateMember: protectedProcedure
    .input(z.object({
      memberId: z.string().uuid(),
      name: z.string().min(1).optional(),
      phase: z.enum(["accumulation", "pension"]).optional(),
      currentBalance: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.uow.compliance.findSmsfMemberById(input.memberId);
      if (!member || member.entity.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }
      const updates: Partial<SmsfMember> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.phase) updates.phase = input.phase;
      if (input.currentBalance !== undefined) updates.currentBalance = input.currentBalance.toString();

      return ctx.uow.compliance.updateSmsfMember(input.memberId, updates);
    }),

  // Contributions
  getContributions: protectedProcedure
    .input(z.object({ entityId: z.string().uuid(), year: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();
      const contributions = await ctx.uow.compliance.findSmsfContributions(input.entityId, year);
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
      const existing = await ctx.uow.compliance.findSmsfContributionByMemberYear(
        input.entityId,
        input.memberId,
        year
      );

      if (existing) {
        const newConcessional = parseFloat(existing.concessional) + (input.concessional || 0);
        const newNonConcessional = parseFloat(existing.nonConcessional) + (input.nonConcessional || 0);

        const updated = await ctx.uow.compliance.updateSmsfContribution(existing.id, {
          concessional: newConcessional.toString(),
          nonConcessional: newNonConcessional.toString(),
          updatedAt: new Date(),
        });

        return {
          ...updated,
          status: getContributionCapStatus(newConcessional, newNonConcessional),
        };
      }

      const contribution = await ctx.uow.compliance.createSmsfContribution({
        entityId: input.entityId,
        memberId: input.memberId,
        financialYear: year,
        concessional: (input.concessional || 0).toString(),
        nonConcessional: (input.nonConcessional || 0).toString(),
      });

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
      const pensions = await ctx.uow.compliance.findSmsfPensions(input.entityId, year);

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

      const existing = await ctx.uow.compliance.findSmsfPensionByMemberYear(
        input.entityId,
        input.memberId,
        year
      );

      if (existing) {
        const newDrawn = parseFloat(existing.amountDrawn) + input.amount;
        return ctx.uow.compliance.updateSmsfPension(existing.id, {
          amountDrawn: newDrawn.toString(),
          updatedAt: new Date(),
        });
      }

      // Need to get member for minimum pension calculation
      const member = await ctx.uow.compliance.findSmsfMemberById(input.memberId);
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      const minimumRequired = calculateMinimumPension(
        parseFloat(member.currentBalance),
        new Date(member.dateOfBirth)
      );

      return ctx.uow.compliance.createSmsfPension({
        entityId: input.entityId,
        memberId: input.memberId,
        financialYear: year,
        openingBalance: member.currentBalance,
        minimumRequired: minimumRequired.toString(),
        amountDrawn: input.amount.toString(),
        frequency: "monthly",
      });
    }),

  // Audit Checklist
  getAuditChecklist: protectedProcedure
    .input(z.object({ entityId: z.string().uuid(), year: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || getCurrentFinancialYear();

      let items = await ctx.uow.compliance.findSmsfAuditItems(input.entityId, year);

      // Create default items if none exist
      if (items.length === 0) {
        const newItems = DEFAULT_AUDIT_ITEMS.map((item) => ({
          entityId: input.entityId,
          financialYear: year,
          item,
        }));
        items = await ctx.uow.compliance.createSmsfAuditItems(newItems);
      }

      return items;
    }),

  updateChecklistItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.compliance.updateSmsfAuditItem(input.itemId, {
        completed: input.completed,
        completedAt: input.completed ? new Date() : null,
      });
    }),

  // Dashboard
  getDashboard: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const year = getCurrentFinancialYear();

      const [members, contributions, pensions, auditItems] = await Promise.all([
        ctx.uow.compliance.findSmsfMembers(input.entityId),
        ctx.uow.compliance.findSmsfContributions(input.entityId, year),
        ctx.uow.compliance.findSmsfPensions(input.entityId, year),
        ctx.uow.compliance.findSmsfAuditItems(input.entityId, year),
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
