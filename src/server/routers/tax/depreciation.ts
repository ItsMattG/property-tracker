import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  projectSchedule,
  getCurrentFinancialYear,
  type ProjectionAsset,
  type ProjectionCapitalWork,
} from "../../services/depreciation-calculator";

// ─── Helpers ──────────────────────────────────────────────────────

function assignPoolType(cost: number): "individual" | "low_value" | "immediate_writeoff" {
  if (cost <= 300) return "immediate_writeoff";
  if (cost <= 1000) return "low_value";
  return "individual";
}

/**
 * Calculate yearly deduction for an asset based on its method and effective life.
 * For diminishing value: cost * (2 / effectiveLife)
 * For prime cost: cost / effectiveLife
 */
function calculateYearlyDeduction(
  cost: number,
  effectiveLife: number,
  method: "diminishing_value" | "prime_cost"
): number {
  if (effectiveLife <= 0) return cost;
  if (method === "diminishing_value") {
    return Math.round((cost * (2 / effectiveLife)) * 100) / 100;
  }
  return Math.round((cost / effectiveLife) * 100) / 100;
}

// ─── Router ───────────────────────────────────────────────────────

export const depreciationRouter = router({
  /**
   * List all depreciation schedules and capital works for a property.
   * Returns { schedules, capitalWorks } fetched in parallel.
   */
  list: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [schedules, capitalWorksList] = await Promise.all([
        ctx.uow.depreciation.findSchedulesByProperty(input.propertyId, ctx.portfolio.ownerId),
        ctx.uow.depreciation.findCapitalWorksByProperty(input.propertyId, ctx.portfolio.ownerId),
      ]);

      return { schedules, capitalWorks: capitalWorksList };
    }),

  /**
   * Get a multi-year depreciation projection for a property.
   * Fetches schedules + capital works, converts to projection types, and runs calculator.
   */
  getProjection: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        fromFY: z.number().int().optional(),
        toFY: z.number().int().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [schedules, capitalWorksList] = await Promise.all([
        ctx.uow.depreciation.findSchedulesByProperty(input.propertyId, ctx.portfolio.ownerId),
        ctx.uow.depreciation.findCapitalWorksByProperty(input.propertyId, ctx.portfolio.ownerId),
      ]);

      const currentFY = getCurrentFinancialYear();
      const fromFY = input.fromFY ?? currentFY;
      const toFY = input.toFY ?? currentFY + 10;

      // Convert schedule assets to ProjectionAsset[]
      const assets: ProjectionAsset[] = schedules.flatMap((schedule) =>
        schedule.assets.map((asset) => ({
          id: asset.id,
          cost: parseFloat(asset.originalCost),
          effectiveLife: parseFloat(asset.effectiveLife),
          method: asset.method,
          purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : new Date(schedule.effectiveDate),
          poolType: asset.poolType,
        }))
      );

      // Convert capital works to ProjectionCapitalWork[]
      const projectionCapitalWorks: ProjectionCapitalWork[] = capitalWorksList.map((cw) => ({
        id: cw.id,
        constructionCost: parseFloat(cw.constructionCost),
        constructionDate: new Date(cw.constructionDate),
        claimStartDate: new Date(cw.claimStartDate),
      }));

      return projectSchedule({
        assets,
        capitalWorks: projectionCapitalWorks,
        fromFY,
        toFY,
      });
    }),

  /**
   * Add a new asset to a depreciation schedule.
   * Auto-assigns poolType based on cost thresholds and calculates yearlyDeduction.
   */
  addAsset: writeProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        assetName: z.string().min(1),
        category: z.enum(["plant_equipment", "capital_works"]),
        originalCost: z.number().positive(),
        effectiveLife: z.number().positive(),
        method: z.enum(["diminishing_value", "prime_cost"]),
        purchaseDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const poolType = assignPoolType(input.originalCost);
      const yearlyDeduction = poolType === "immediate_writeoff"
        ? input.originalCost
        : calculateYearlyDeduction(input.originalCost, input.effectiveLife, input.method);

      return ctx.uow.depreciation.createAsset({
        scheduleId: input.scheduleId,
        assetName: input.assetName,
        category: input.category,
        originalCost: input.originalCost.toFixed(2),
        effectiveLife: input.effectiveLife.toFixed(2),
        method: input.method,
        purchaseDate: input.purchaseDate ?? null,
        poolType,
        yearlyDeduction: yearlyDeduction.toFixed(2),
        remainingValue: input.originalCost.toFixed(2),
      });
    }),

  /**
   * Update an existing asset. Only sets fields that are provided.
   * Recalculates poolType if cost changes.
   */
  updateAsset: writeProcedure
    .input(
      z.object({
        assetId: z.string().uuid(),
        assetName: z.string().min(1).optional(),
        originalCost: z.number().positive().optional(),
        effectiveLife: z.number().positive().optional(),
        method: z.enum(["diminishing_value", "prime_cost"]).optional(),
        purchaseDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { assetId, ...fields } = input;

      // Build update payload with only provided fields
      const data: Record<string, string | null> = {};

      if (fields.assetName !== undefined) data.assetName = fields.assetName;
      if (fields.purchaseDate !== undefined) data.purchaseDate = fields.purchaseDate;

      // If cost changes, recalculate poolType
      if (fields.originalCost !== undefined) {
        data.originalCost = fields.originalCost.toFixed(2);
        data.poolType = assignPoolType(fields.originalCost);
      }

      if (fields.effectiveLife !== undefined) {
        data.effectiveLife = fields.effectiveLife.toFixed(2);
      }

      if (fields.method !== undefined) {
        data.method = fields.method;
      }

      // Recalculate yearlyDeduction if cost, effectiveLife, or method changed
      if (fields.originalCost !== undefined || fields.effectiveLife !== undefined || fields.method !== undefined) {
        // Need existing asset data for fields not being updated
        const existing = await ctx.uow.depreciation.findAssetById(assetId, ctx.portfolio.ownerId);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        }

        const cost = fields.originalCost ?? parseFloat(existing.originalCost);
        const life = fields.effectiveLife ?? parseFloat(existing.effectiveLife);
        const method = fields.method ?? existing.method;
        const poolType = assignPoolType(cost);

        const yearlyDeduction = poolType === "immediate_writeoff"
          ? cost
          : calculateYearlyDeduction(cost, life, method);

        data.yearlyDeduction = yearlyDeduction.toFixed(2);
        data.poolType = poolType;
      }

      const updated = await ctx.uow.depreciation.updateAsset(
        assetId,
        ctx.portfolio.ownerId,
        data
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }

      return updated;
    }),

  /**
   * Delete an asset from a depreciation schedule.
   */
  deleteAsset: writeProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.depreciation.deleteAsset(input.assetId, ctx.portfolio.ownerId);
      return { success: true };
    }),

  /**
   * Add a new capital works entry for a property.
   */
  addCapitalWorks: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        description: z.string().min(1),
        constructionDate: z.string(),
        constructionCost: z.number().positive(),
        claimStartDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.depreciation.createCapitalWork({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        description: input.description,
        constructionDate: input.constructionDate,
        constructionCost: input.constructionCost.toFixed(2),
        claimStartDate: input.claimStartDate,
      });
    }),

  /**
   * Update a capital works entry. Only sets provided fields.
   */
  updateCapitalWorks: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().min(1).optional(),
        constructionDate: z.string().optional(),
        constructionCost: z.number().positive().optional(),
        claimStartDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const data: Record<string, string> = {};
      if (fields.description !== undefined) data.description = fields.description;
      if (fields.constructionDate !== undefined) data.constructionDate = fields.constructionDate;
      if (fields.constructionCost !== undefined) data.constructionCost = fields.constructionCost.toFixed(2);
      if (fields.claimStartDate !== undefined) data.claimStartDate = fields.claimStartDate;

      const updated = await ctx.uow.depreciation.updateCapitalWork(
        id,
        ctx.portfolio.ownerId,
        data
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Capital works entry not found" });
      }

      return updated;
    }),

  /**
   * Delete a capital works entry.
   */
  deleteCapitalWorks: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.depreciation.deleteCapitalWork(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  /**
   * Record depreciation claims for a financial year.
   * Creates one claim per item in the amounts array.
   */
  claimFY: writeProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        financialYear: z.number().int(),
        amounts: z.array(
          z.object({
            assetId: z.string().uuid().nullable(),
            amount: z.number().nonnegative(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const claims = [];
      for (const item of input.amounts) {
        const claim = await ctx.uow.depreciation.createClaim({
          scheduleId: input.scheduleId,
          financialYear: input.financialYear,
          assetId: item.assetId,
          amount: item.amount.toFixed(2),
        });
        claims.push(claim);
      }
      return claims;
    }),

  /**
   * Remove all depreciation claims for a schedule in a given financial year.
   */
  unclaimFY: writeProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        financialYear: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.depreciation.deleteClaimsByFY(input.scheduleId, input.financialYear);
      return { success: true };
    }),

  /**
   * Move an asset to the low-value pool.
   * Only allowed if remaining value <= $1000.
   */
  moveToPool: writeProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.uow.depreciation.findAssetById(input.assetId, ctx.portfolio.ownerId);

      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }

      const remainingValue = parseFloat(asset.remainingValue);

      if (remainingValue > 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Remaining value ($${remainingValue.toFixed(2)}) exceeds $1,000 threshold for low-value pool`,
        });
      }

      const updated = await ctx.uow.depreciation.updateAsset(
        input.assetId,
        ctx.portfolio.ownerId,
        {
          poolType: "low_value",
          openingWrittenDownValue: remainingValue.toFixed(2),
        }
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }

      return updated;
    }),
});
