import { z } from "zod";
import { positiveAmountSchema } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { loans } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { getValuationProvider, MockValuationProvider } from "../services/property-analysis";

export const propertyValueRouter = router({
  list: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.uow.propertyValue.findByProperty(input.propertyId, { limit: input.limit });
    }),

  getLatest: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.uow.propertyValue.findByProperty(input.propertyId, { limit: 1 }).then((r) => r[0] ?? null);
    }),

  getCurrent: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const valuation = await ctx.uow.propertyValue.findLatestByUser(
        input.propertyId,
        ctx.portfolio.ownerId
      );

      if (!valuation) return null;

      const valuationDate = new Date(valuation.valueDate);
      const today = new Date();
      const daysSinceUpdate = Math.floor(
        (today.getTime() - valuationDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return { valuation, daysSinceUpdate };
    }),

  refresh: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const provider = getValuationProvider();
      const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
      const result = await provider.getValuation({
        propertyId: property.id,
        purchasePrice: Number(property.purchasePrice),
        purchaseDate: property.purchaseDate,
        address: fullAddress,
        propertyType: "house",
      });

      if (!result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get valuation from provider" });
      }

      return ctx.uow.propertyValue.create({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        estimatedValue: result.estimatedValue.toString(),
        confidenceLow: result.confidenceLow.toString(),
        confidenceHigh: result.confidenceHigh.toString(),
        valueDate: new Date().toISOString().split("T")[0],
        source: result.source as "mock" | "corelogic" | "proptrack",
        apiResponseId: `mock-${Date.now()}`,
      });
    }),

  create: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        estimatedValue: positiveAmountSchema,
        valueDate: z.string(),
        source: z.enum(["manual", "mock", "corelogic", "proptrack"]).default("manual"),
        notes: z.string().optional(),
        confidenceLow: positiveAmountSchema.optional(),
        confidenceHigh: positiveAmountSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.uow.propertyValue.create({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        estimatedValue: input.estimatedValue,
        valueDate: input.valueDate,
        source: input.source,
        notes: input.notes,
        confidenceLow: input.confidenceLow,
        confidenceHigh: input.confidenceHigh,
      });
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const valuation = await ctx.uow.propertyValue.findById(input.id, ctx.portfolio.ownerId);
      if (!valuation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Valuation not found" });
      }

      if (valuation.source !== "manual") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only manual valuations can be deleted",
        });
      }

      await ctx.uow.propertyValue.delete(input.id);
      return { success: true };
    }),

  getValuationHistory: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.uow.propertyValue.findByProperty(input.propertyId, { orderAsc: true });
    }),

  getCapitalGrowthStats: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const recentValuations = await ctx.uow.propertyValue.findRecent(input.propertyId, 2);
      const latestValuation = recentValuations[0];
      const previousValuation = recentValuations[1];

      if (!latestValuation) return null;

      const currentValue = Number(latestValuation.estimatedValue);
      const purchasePrice = Number(property.purchasePrice);
      const totalGain = currentValue - purchasePrice;
      const totalGainPercent = purchasePrice > 0 ? (totalGain / purchasePrice) * 100 : 0;

      const purchaseDate = new Date(property.purchaseDate);
      const now = new Date();
      const yearsHeld = (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const annualizedGrowth = yearsHeld > 0
        ? (Math.pow(currentValue / purchasePrice, 1 / yearsHeld) - 1) * 100
        : 0;

      const previousValue = previousValuation ? Number(previousValuation.estimatedValue) : null;
      const monthlyChange = previousValue ? currentValue - previousValue : null;
      const monthlyChangePercent = previousValue && previousValue > 0
        ? ((currentValue - previousValue) / previousValue) * 100
        : null;

      // Cross-domain: loan aggregate by propertyId — no repo method for SUM by property
      const loanResult = await ctx.db
        .select({ total: sql<number>`COALESCE(SUM(current_balance), 0)::int` })
        .from(loans)
        .where(eq(loans.propertyId, input.propertyId));

      const totalLoanBalance = Number(loanResult[0]?.total || 0);
      const equity = currentValue - totalLoanBalance;
      const lvr = currentValue > 0 ? (totalLoanBalance / currentValue) * 100 : 0;
      const hasLoans = totalLoanBalance > 0;

      return {
        currentValue,
        purchasePrice,
        totalGain,
        totalGainPercent: Math.round(totalGainPercent * 100) / 100,
        annualizedGrowth: Math.round(annualizedGrowth * 100) / 100,
        monthlyChange,
        monthlyChangePercent: monthlyChangePercent !== null
          ? Math.round(monthlyChangePercent * 100) / 100
          : null,
        equity,
        lvr: Math.round(lvr * 100) / 100,
        hasLoans,
        lastUpdated: latestValuation.valueDate,
        source: latestValuation.source,
        confidenceLow: latestValuation.confidenceLow ? Number(latestValuation.confidenceLow) : null,
        confidenceHigh: latestValuation.confidenceHigh ? Number(latestValuation.confidenceHigh) : null,
      };
    }),

  triggerBackfill: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const existingValues = await ctx.uow.propertyValue.findByProperty(input.propertyId);
      if (existingValues.length > 2) {
        return { backfilled: 0, message: "History already exists" };
      }

      const provider = getValuationProvider();
      if (!("generateHistory" in provider)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provider does not support backfill" });
      }

      const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
      const history = await (provider as MockValuationProvider).generateHistory({
        propertyId: property.id,
        purchasePrice: Number(property.purchasePrice),
        purchaseDate: property.purchaseDate,
        address: fullAddress,
        propertyType: "house",
      });

      const existingDates = new Set(
        existingValues.length > 0
          ? await ctx.uow.propertyValue.findDatesByProperty(input.propertyId)
          : []
      );

      const toInsert = history
        .filter((h) => !existingDates.has(h.valueDate))
        .map((h) => ({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          estimatedValue: h.estimatedValue.toString(),
          confidenceLow: h.confidenceLow.toString(),
          confidenceHigh: h.confidenceHigh.toString(),
          valueDate: h.valueDate,
          source: "mock" as const,
          apiResponseId: `mock-backfill-${h.valueDate}`,
        }));

      if (toInsert.length > 0) {
        await ctx.uow.propertyValue.createMany(toInsert);
      }

      return { backfilled: toInsert.length };
    }),
});
