// src/server/routers/property/similarProperties.ts
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  generatePropertyVector,
  calculateSimilarityScore,
  getPriceBracketLabel,
} from "../../services/property-analysis/vector-generation";
import {
  extractListingData,
  detectInputType,
} from "../../services/property-analysis";
import type { SimilarProperty } from "@/types/similar-properties";

export const similarPropertiesRouter = router({
  generateVector: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(
        input.propertyId,
        ctx.portfolio.ownerId
      );

      if (!property) {
        throw new Error("Property not found");
      }

      // Get latest property value
      const recentValues = await ctx.uow.propertyValue.findRecent(input.propertyId, 1);

      // Calculate yield from rent transactions
      const rentTransactions = await ctx.uow.transactions.findAllByOwner(
        ctx.portfolio.ownerId,
        { propertyId: input.propertyId, category: "rental_income" }
      );

      const annualRent = rentTransactions.reduce(
        (sum, t) => sum + Math.abs(parseFloat(t.amount)),
        0
      );

      const currentValue = recentValues[0]?.estimatedValue
        ? parseFloat(recentValues[0].estimatedValue)
        : parseFloat(property.purchasePrice);

      const grossYield = currentValue > 0 ? (annualRent / currentValue) * 100 : 0;

      // Get suburb growth rate
      const benchmark = await ctx.uow.similarProperties.findSuburbBenchmark(
        property.suburb,
        property.state
      );

      const capitalGrowthRate = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : 3.0; // Default 3%

      const vector = generatePropertyVector({
        state: property.state,
        suburb: property.suburb,
        propertyType: "house", // TODO: Add propertyType to properties table
        currentValue,
        grossYield,
        capitalGrowthRate,
      });

      await ctx.uow.similarProperties.upsertVector(
        input.propertyId,
        ctx.portfolio.ownerId,
        vector
      );

      return { success: true, vector };
    }),

  findSimilar: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        limit: z.number().default(10),
        includeCommunity: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }): Promise<SimilarProperty[]> => {
      const propertyVector = await ctx.uow.similarProperties.findVectorByProperty(
        input.propertyId
      );

      if (!propertyVector) {
        return [];
      }

      // Validate vector data before using in SQL
      const vectorArray = propertyVector.vector;
      if (
        !Array.isArray(vectorArray) ||
        !vectorArray.every((n) => typeof n === "number" && isFinite(n))
      ) {
        throw new Error("Invalid vector data");
      }
      const vectorStr = `[${vectorArray.join(",")}]`;

      const results = await ctx.uow.similarProperties.findSimilarVectors(
        propertyVector.id,
        vectorStr,
        ctx.portfolio.ownerId,
        input.includeCommunity,
        input.limit
      );

      return results.map((row) => {
        const isPortfolio = row.property_id && row.user_id === ctx.portfolio.ownerId;
        const isExternal = !!row.external_listing_id;

        return {
          id: row.id,
          type: isPortfolio ? "portfolio" : isExternal ? "external" : "community",
          suburb: (row.property_suburb || row.listing_suburb) as string,
          state: (row.property_state || row.listing_state) as string,
          propertyType: (row.listing_type || "house") as "house" | "townhouse" | "unit",
          priceBracket: getPriceBracketLabel(Number(row.listing_price) || 0),
          yield: null,
          growth: null,
          distance: Number(row.distance),
          similarityScore: calculateSimilarityScore(Number(row.distance)),
          isEstimated: false,
          propertyId: row.property_id ?? undefined,
          address: row.property_address ?? undefined,
          externalListingId: row.external_listing_id ?? undefined,
          sourceUrl: row.listing_url ?? undefined,
        };
      });
    }),

  extractListing: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        sourceType: z.enum(["url", "text"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const detectedType = input.sourceType || detectInputType(input.content);
      const result = await extractListingData(input.content, detectedType);
      return result;
    }),

  saveExternalListing: writeProcedure
    .input(
      z.object({
        sourceType: z.enum(["url", "text", "manual"]),
        sourceUrl: z.string().optional(),
        rawInput: z.string().optional(),
        extractedData: z.object({
          address: z.string().optional(),
          suburb: z.string(),
          state: z.string(),
          postcode: z.string(),
          price: z.number().optional(),
          propertyType: z.enum(["house", "townhouse", "unit"]),
          bedrooms: z.number().optional(),
          bathrooms: z.number().optional(),
          landSize: z.number().optional(),
          estimatedRent: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get suburb benchmark for yield/growth estimates
      const benchmark = await ctx.uow.similarProperties.findSuburbBenchmark(
        input.extractedData.suburb,
        input.extractedData.state
      );

      const estimatedYield = benchmark?.rentalYield
        ? parseFloat(benchmark.rentalYield)
        : null;
      const estimatedGrowth = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : null;

      const listing = await ctx.uow.similarProperties.createExternalListing({
        userId: ctx.portfolio.ownerId,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        rawInput: input.rawInput,
        extractedData: input.extractedData,
        suburb: input.extractedData.suburb,
        state: input.extractedData.state as "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT",
        postcode: input.extractedData.postcode,
        propertyType: input.extractedData.propertyType,
        price: input.extractedData.price?.toString(),
        estimatedYield: estimatedYield?.toString(),
        estimatedGrowth: estimatedGrowth?.toString(),
        isEstimated: !input.extractedData.price,
      });

      // Generate vector for the listing
      const vector = generatePropertyVector({
        state: input.extractedData.state,
        suburb: input.extractedData.suburb,
        propertyType: input.extractedData.propertyType,
        currentValue: input.extractedData.price || 0,
        grossYield: estimatedYield || 0,
        capitalGrowthRate: estimatedGrowth || 0,
      });

      await ctx.uow.similarProperties.insertVector({
        externalListingId: listing.id,
        userId: ctx.portfolio.ownerId,
        vector,
      });

      return listing;
    }),

  listExternalListings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.similarProperties.listExternalListings(ctx.portfolio.ownerId);
  }),

  deleteExternalListing: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.similarProperties.deleteExternalListing(
        input.id,
        ctx.portfolio.ownerId
      );
      return { success: true };
    }),

  getSharingPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.uow.similarProperties.findSharingPreferences(
      ctx.portfolio.ownerId
    );

    return (
      prefs || {
        defaultShareLevel: "none",
        defaultSharedAttributes: ["suburb", "state", "propertyType", "priceBracket", "yield"],
      }
    );
  }),

  updateSharingPreferences: writeProcedure
    .input(
      z.object({
        defaultShareLevel: z.enum(["none", "anonymous", "pseudonymous", "controlled"]),
        defaultSharedAttributes: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.similarProperties.upsertSharingPreferences(
        ctx.portfolio.ownerId,
        {
          defaultShareLevel: input.defaultShareLevel,
          defaultSharedAttributes: input.defaultSharedAttributes,
        }
      );

      return { success: true };
    }),

  setPropertyShareLevel: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        shareLevel: z.enum(["none", "anonymous", "pseudonymous", "controlled"]),
        sharedAttributes: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pv = await ctx.uow.similarProperties.findVectorByPropertyAndUser(
        input.propertyId,
        ctx.portfolio.ownerId
      );

      if (!pv) {
        throw new Error("Property vector not found");
      }

      await ctx.uow.similarProperties.updateVectorSharing(pv.id, {
        isShared: input.shareLevel !== "none",
        shareLevel: input.shareLevel,
        sharedAttributes: input.sharedAttributes,
      });

      return { success: true };
    }),

  discoverProperties: protectedProcedure
    .input(
      z.object({
        filters: z
          .object({
            states: z.array(z.string()).optional(),
            priceMin: z.number().optional(),
            priceMax: z.number().optional(),
            yieldMin: z.number().optional(),
            yieldMax: z.number().optional(),
            propertyTypes: z.array(z.enum(["house", "townhouse", "unit"])).optional(),
          })
          .optional(),
        source: z.enum(["portfolio", "community", "both"]).default("both"),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // For now, return community shared properties
      // TODO: Add filtering logic
      const results = await ctx.uow.similarProperties.discoverVectors(
        ctx.portfolio.ownerId,
        input.limit,
        input.offset
      );

      return results.map((pv) => ({
        id: pv.id,
        type: pv.property ? "portfolio" : "external",
        suburb: pv.property?.suburb || pv.externalListing?.suburb || "",
        state: pv.property?.state || pv.externalListing?.state || "",
        isShared: pv.isShared,
        shareLevel: pv.shareLevel,
      }));
    }),
});
