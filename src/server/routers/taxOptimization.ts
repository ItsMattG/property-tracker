import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  taxSuggestions,
  depreciationSchedules,
  depreciationAssets,
  documents,
} from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { extractDepreciationSchedule } from "../services/depreciation-extract";
import {
  generateAllSuggestions,
  getCurrentFinancialYear,
} from "../services/transaction";

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

      const suggestions = await ctx.db.query.taxSuggestions.findMany({
        where: and(
          eq(taxSuggestions.userId, ctx.portfolio.ownerId),
          eq(taxSuggestions.financialYear, fy.toString()),
          eq(taxSuggestions.status, input.status)
        ),
        with: {
          property: true,
        },
        orderBy: [desc(taxSuggestions.estimatedSavings)],
      });

      return suggestions;
    }),

  // Get suggestion count (for badges)
  getSuggestionCount: protectedProcedure.query(async ({ ctx }) => {
    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(taxSuggestions)
      .where(
        and(
          eq(taxSuggestions.userId, ctx.portfolio.ownerId),
          eq(taxSuggestions.status, "active")
        )
      );

    return { count };
  }),

  // Dismiss a suggestion
  dismissSuggestion: writeProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(taxSuggestions)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(taxSuggestions.id, input.suggestionId),
            eq(taxSuggestions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  // Mark suggestion as actioned
  markActioned: writeProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(taxSuggestions)
        .set({ status: "actioned" })
        .where(
          and(
            eq(taxSuggestions.id, input.suggestionId),
            eq(taxSuggestions.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

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
      const conditions = [eq(depreciationSchedules.userId, ctx.portfolio.ownerId)];

      if (input.propertyId) {
        conditions.push(eq(depreciationSchedules.propertyId, input.propertyId));
      }

      const schedules = await ctx.db.query.depreciationSchedules.findMany({
        where: and(...conditions),
        with: {
          property: true,
          assets: true,
          document: true,
        },
        orderBy: [desc(depreciationSchedules.createdAt)],
      });

      return schedules;
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
      // Verify document ownership
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

      return {
        assets: result.assets,
        totalValue: result.totalValue,
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
      const [schedule] = await ctx.db
        .insert(depreciationSchedules)
        .values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          documentId: input.documentId,
          effectiveDate: input.effectiveDate,
          totalValue: input.totalValue.toFixed(2),
        })
        .returning();

      // Insert assets
      if (input.assets.length > 0) {
        await ctx.db.insert(depreciationAssets).values(
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
      await ctx.db
        .update(taxSuggestions)
        .set({ status: "actioned" })
        .where(
          and(
            eq(taxSuggestions.userId, ctx.portfolio.ownerId),
            eq(taxSuggestions.propertyId, input.propertyId),
            eq(taxSuggestions.type, "claim_depreciation"),
            eq(taxSuggestions.status, "active")
          )
        );

      return schedule;
    }),

  // Delete depreciation schedule
  deleteDepreciationSchedule: writeProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(depreciationSchedules)
        .where(
          and(
            eq(depreciationSchedules.id, input.scheduleId),
            eq(depreciationSchedules.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),
});
