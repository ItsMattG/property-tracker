import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { documents } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { extractDepreciationSchedule } from "../../services/property-analysis";
import { validateAndRecalculate, generateMultiYearSchedule } from "../../services/tax/depreciation-calc";
import {
  generateAllSuggestions,
  getCurrentFinancialYear,
} from "../../services/transaction";

export const taxOptimizationRouter = router({
  // Get active suggestions for current user
  getSuggestions: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().optional(),
        status: z.enum(["active", "dismissed", "actioned"]).default("active"),
      })
    )
    .query(async ({ ctx, input }) => {
      const fy = input.financialYear || getCurrentFinancialYear();

      return ctx.uow.tax.findSuggestions(ctx.portfolio.ownerId, fy.toString(), input.status);
    }),

  // Get suggestion count (for badges)
  getSuggestionCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.uow.tax.countActiveSuggestions(ctx.portfolio.ownerId);
    return { count };
  }),

  // Dismiss a suggestion
  dismissSuggestion: writeProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.uow.tax.updateSuggestionStatus(input.suggestionId, ctx.portfolio.ownerId, "dismissed");

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  // Mark suggestion as actioned
  markActioned: writeProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.uow.tax.updateSuggestionStatus(input.suggestionId, ctx.portfolio.ownerId, "actioned");

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  // Refresh suggestions
  refreshSuggestions: writeProcedure.mutation(async ({ ctx }) => {
    const count = await generateAllSuggestions(ctx.portfolio.ownerId);
    return { count };
  }),

  // Get depreciation schedules for a property
  getDepreciationSchedules: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.tax.findSchedules(ctx.portfolio.ownerId, input.propertyId);
    }),

  // Extract depreciation from uploaded document
  extractDepreciation: writeProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        propertyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cross-domain: verify document ownership from documents domain
      const doc = await ctx.db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.documentId),
          eq(documents.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      // Extract from PDF
      const result = await extractDepreciationSchedule(doc.storagePath);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to extract depreciation schedule",
        });
      }

      const validatedAssets = validateAndRecalculate(result.assets);
      const totalValue = validatedAssets.reduce((sum, a) => sum + a.originalCost, 0);

      return {
        assets: validatedAssets,
        totalValue,
        effectiveDate: result.effectiveDate,
      };
    }),

  // Save extracted depreciation schedule
  saveDepreciationSchedule: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        documentId: z.string().uuid(),
        effectiveDate: z.string(),
        totalValue: z.number(),
        assets: z.array(
          z.object({
            assetName: z.string(),
            category: z.enum(["plant_equipment", "capital_works"]),
            originalCost: z.number(),
            effectiveLife: z.number(),
            method: z.enum(["diminishing_value", "prime_cost"]),
            yearlyDeduction: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create schedule
      const schedule = await ctx.uow.tax.createSchedule({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        documentId: input.documentId,
        effectiveDate: input.effectiveDate,
        totalValue: input.totalValue.toFixed(2),
      });

      // Insert assets
      if (input.assets.length > 0) {
        await ctx.uow.tax.createAssets(
          input.assets.map((asset) => ({
            scheduleId: schedule.id,
            assetName: asset.assetName,
            category: asset.category,
            originalCost: asset.originalCost.toFixed(2),
            effectiveLife: asset.effectiveLife.toFixed(2),
            method: asset.method,
            yearlyDeduction: asset.yearlyDeduction.toFixed(2),
            remainingValue: asset.originalCost.toFixed(2), // Start with full value
          }))
        );
      }

      // Mark any "claim_depreciation" suggestions for this property as actioned
      await ctx.uow.tax.actionSuggestionsByPropertyAndType(
        ctx.portfolio.ownerId,
        input.propertyId,
        "claim_depreciation"
      );

      return schedule;
    }),

  // Delete depreciation schedule
  deleteDepreciationSchedule: writeProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.tax.deleteSchedule(input.scheduleId, ctx.portfolio.ownerId);
      return { success: true };
    }),

  // Get multi-year depreciation projection for a schedule
  getDepreciationProjection: protectedProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        years: z.number().int().min(1).max(40).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const schedules = await ctx.uow.tax.findSchedules(ctx.portfolio.ownerId);
      const schedule = schedules.find((s) => s.id === input.scheduleId);

      if (!schedule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found" });
      }

      const assetProjections = schedule.assets.map((asset) => {
        const originalCost = parseFloat(asset.originalCost);
        const effectiveLife = parseFloat(asset.effectiveLife);
        const method = asset.method;
        const years = input.years ?? Math.ceil(effectiveLife);

        return {
          assetName: asset.assetName,
          category: asset.category,
          schedule: generateMultiYearSchedule(originalCost, effectiveLife, method, years),
        };
      });

      const maxYears = Math.max(...assetProjections.map((a) => a.schedule.length), 0);
      const yearlyTotals: Array<{ year: number; totalDeduction: number; totalRemaining: number }> = [];

      for (let y = 0; y < maxYears; y++) {
        let totalDeduction = 0;
        let totalRemaining = 0;

        for (const ap of assetProjections) {
          if (y < ap.schedule.length) {
            totalDeduction += ap.schedule[y].deduction;
            totalRemaining += ap.schedule[y].closingValue;
          }
        }

        yearlyTotals.push({
          year: y + 1,
          totalDeduction: Math.round(totalDeduction * 100) / 100,
          totalRemaining: Math.round(totalRemaining * 100) / 100,
        });
      }

      return {
        scheduleId: schedule.id,
        propertyAddress: schedule.property?.address ?? "Unknown",
        assetProjections,
        yearlyTotals,
      };
    }),
});
