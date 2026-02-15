import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import type { Beneficiary } from "../../db/schema";
import {
  getCurrentFinancialYear,
  getDaysUntilDeadline,
  getDeadlineStatus,
  validateAllocationTotals,
} from "../../services/compliance";

export const trustComplianceRouter = router({
  // Beneficiary Management
  getBeneficiaries: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.uow.compliance.findEntityById(input.entityId, ctx.user.id);
      if (!entity || entity.type !== "trust") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trust entity not found" });
      }
      return ctx.uow.compliance.findBeneficiaries(input.entityId);
    }),

  addBeneficiary: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      name: z.string().min(1),
      relationship: z.string().min(1),
      tfn: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.uow.compliance.findEntityById(input.entityId, ctx.user.id);
      if (!entity || entity.type !== "trust") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trust entity not found" });
      }
      return ctx.uow.compliance.createBeneficiary({
        entityId: input.entityId,
        name: input.name,
        relationship: input.relationship,
        tfn: input.tfn,
      });
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
      const beneficiary = await ctx.uow.compliance.findBeneficiaryById(input.beneficiaryId);
      if (!beneficiary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Beneficiary not found" });
      }
      // Verify ownership via the beneficiary's parent entity
      const entity = await ctx.uow.compliance.findEntityById(beneficiary.entityId, ctx.user.id);
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Beneficiary not found" });
      }

      const updates: Partial<Beneficiary> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.relationship) updates.relationship = input.relationship;
      if (input.tfn !== undefined) updates.tfn = input.tfn;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      return ctx.uow.compliance.updateBeneficiary(input.beneficiaryId, updates);
    }),

  // Distributions
  getDistributions: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.compliance.findTrustDistributions(input.entityId);
    }),

  getDistribution: protectedProcedure
    .input(z.object({ distributionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const distribution = await ctx.uow.compliance.findTrustDistributionById(input.distributionId);
      if (!distribution) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Distribution not found" });
      }
      // Verify ownership via the distribution's parent entity
      const entity = await ctx.uow.compliance.findEntityById(distribution.entityId, ctx.user.id);
      if (!entity) {
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
      const entity = await ctx.uow.compliance.findEntityById(input.entityId, ctx.user.id);
      if (!entity || entity.type !== "trust") {
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
      const distribution = await ctx.uow.compliance.createTrustDistribution({
        entityId: input.entityId,
        financialYear: input.financialYear,
        resolutionDate: input.resolutionDate,
        totalAmount: input.totalAmount.toString(),
        capitalGainsComponent: input.capitalGainsComponent.toString(),
        frankingCreditsComponent: input.frankingCreditsComponent.toString(),
      });

      // Create allocations
      if (input.allocations.length > 0) {
        await ctx.uow.compliance.createDistributionAllocations(
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

      const distribution = await ctx.uow.compliance.findTrustDistributionByYear(
        input.entityId,
        year
      );

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

      const [allBeneficiaries, distributions] = await Promise.all([
        ctx.uow.compliance.findBeneficiaries(input.entityId),
        ctx.uow.compliance.findTrustDistributions(input.entityId),
      ]);

      // Filter active beneficiaries in JS (repo returns all)
      const activeBeneficiaries = allBeneficiaries.filter((b) => b.isActive);
      // Limit distributions in JS (repo returns all, ordered by year desc)
      const recentDistributions = distributions.slice(0, 5);

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
        beneficiaries: activeBeneficiaries.length,
        recentDistributions: recentDistributions.map((d) => ({
          id: d.id,
          financialYear: d.financialYear,
          totalAmount: parseFloat(d.totalAmount),
          resolutionDate: d.resolutionDate,
          allocations: d.allocations.length,
        })),
      };
    }),
});
