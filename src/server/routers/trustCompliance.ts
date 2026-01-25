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
