import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { propertyValues, properties } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getValuationProvider } from "../services/valuation";

export const propertyValueRouter = router({
  list: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.db.query.propertyValues.findMany({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
        limit: input.limit,
      });
    }),

  getLatest: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
      });
    }),

  getCurrent: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const valuation = await ctx.db.query.propertyValues.findFirst({
        where: and(
          eq(propertyValues.propertyId, input.propertyId),
          eq(propertyValues.userId, ctx.user.id)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });

      if (!valuation) {
        return null;
      }

      const valuationDate = new Date(valuation.valueDate);
      const today = new Date();
      const daysSinceUpdate = Math.floor(
        (today.getTime() - valuationDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        valuation,
        daysSinceUpdate,
      };
    }),

  refresh: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get property with address
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Get valuation from provider
      const provider = getValuationProvider();
      const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
      const result = await provider.getValuation(fullAddress, "house");

      if (!result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get valuation from provider" });
      }

      // Store the valuation
      const [value] = await ctx.db
        .insert(propertyValues)
        .values({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          estimatedValue: result.estimatedValue.toString(),
          confidenceLow: result.confidenceLow.toString(),
          confidenceHigh: result.confidenceHigh.toString(),
          valueDate: new Date().toISOString().split("T")[0],
          source: result.source as "mock" | "corelogic" | "proptrack",
          apiResponseId: `mock-${Date.now()}`,
        })
        .returning();

      return value;
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
        valueDate: z.string(),
        source: z.enum(["manual", "mock", "corelogic", "proptrack"]).default("manual"),
        notes: z.string().optional(),
        confidenceLow: z.string().regex(/^\d+\.?\d*$/).optional(),
        confidenceHigh: z.string().regex(/^\d+\.?\d*$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const [value] = await ctx.db
        .insert(propertyValues)
        .values({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          estimatedValue: input.estimatedValue,
          valueDate: input.valueDate,
          source: input.source,
          notes: input.notes,
          confidenceLow: input.confidenceLow,
          confidenceHigh: input.confidenceHigh,
        })
        .returning();

      return value;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Find the valuation first
      const valuation = await ctx.db.query.propertyValues.findFirst({
        where: and(
          eq(propertyValues.id, input.id),
          eq(propertyValues.userId, ctx.user.id)
        ),
      });

      if (!valuation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Valuation not found" });
      }

      // Only allow deleting manual valuations
      if (valuation.source !== "manual") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only manual valuations can be deleted",
        });
      }

      await ctx.db
        .delete(propertyValues)
        .where(eq(propertyValues.id, input.id));

      return { success: true };
    }),
});
