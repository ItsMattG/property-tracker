// src/server/routers/similarProperties.ts
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { eq, and, or, sql } from "drizzle-orm";
import {
  properties,
  propertyVectors,
  externalListings,
  sharingPreferences,
  transactions,
  suburbBenchmarks,
} from "../db/schema";
import {
  generatePropertyVector,
  calculateSimilarityScore,
  getPriceBracketLabel,
} from "../services/vector-generation";
import {
  extractListingData,
  detectInputType,
} from "../services/property-analysis";
import type { SimilarProperty } from "@/types/similar-properties";

export const similarPropertiesRouter = router({
  generateVector: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
        with: {
          propertyValues: {
            orderBy: (v, { desc }) => [desc(v.valueDate)],
            limit: 1,
          },
        },
      });

      if (!property) {
        throw new Error("Property not found");
      }

      // Calculate yield from transactions
      const rentTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          eq(transactions.category, "rental_income")
        ),
      });

      const annualRent = rentTransactions.reduce(
        (sum, t) => sum + Math.abs(parseFloat(t.amount)),
        0
      );

      const currentValue = property.propertyValues?.[0]?.estimatedValue
        ? parseFloat(property.propertyValues[0].estimatedValue)
        : parseFloat(property.purchasePrice);

      const grossYield = currentValue > 0 ? (annualRent / currentValue) * 100 : 0;

      // Get suburb growth rate
      const benchmark = await ctx.db.query.suburbBenchmarks.findFirst({
        where: and(
          eq(suburbBenchmarks.suburb, property.suburb),
          eq(suburbBenchmarks.state, property.state)
        ),
      });

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

      // Upsert vector
      const existing = await ctx.db.query.propertyVectors.findFirst({
        where: eq(propertyVectors.propertyId, input.propertyId),
      });

      if (existing) {
        await ctx.db
          .update(propertyVectors)
          .set({ vector, updatedAt: new Date() })
          .where(eq(propertyVectors.id, existing.id));
      } else {
        await ctx.db.insert(propertyVectors).values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          vector,
        });
      }

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
      const propertyVector = await ctx.db.query.propertyVectors.findFirst({
        where: eq(propertyVectors.propertyId, input.propertyId),
      });

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

      // Build query with conditional structure to avoid boolean interpolation
      // Note: pgvector requires the vector as a string literal for the <-> operator
      const results = input.includeCommunity
        ? await ctx.db.execute(sql`
            SELECT
              pv.id,
              pv.property_id,
              pv.external_listing_id,
              pv.user_id,
              pv.vector <-> ${vectorStr}::vector AS distance,
              p.suburb as property_suburb,
              p.state as property_state,
              p.address as property_address,
              el.suburb as listing_suburb,
              el.state as listing_state,
              el.property_type as listing_type,
              el.price as listing_price,
              el.source_url as listing_url
            FROM property_vectors pv
            LEFT JOIN properties p ON p.id = pv.property_id
            LEFT JOIN external_listings el ON el.id = pv.external_listing_id
            WHERE pv.id != ${propertyVector.id}
              AND (pv.user_id = ${ctx.portfolio.ownerId} OR pv.is_shared = true)
            ORDER BY pv.vector <-> ${vectorStr}::vector
            LIMIT ${input.limit}
          `)
        : await ctx.db.execute(sql`
            SELECT
              pv.id,
              pv.property_id,
              pv.external_listing_id,
              pv.user_id,
              pv.vector <-> ${vectorStr}::vector AS distance,
              p.suburb as property_suburb,
              p.state as property_state,
              p.address as property_address,
              el.suburb as listing_suburb,
              el.state as listing_state,
              el.property_type as listing_type,
              el.price as listing_price,
              el.source_url as listing_url
            FROM property_vectors pv
            LEFT JOIN properties p ON p.id = pv.property_id
            LEFT JOIN external_listings el ON el.id = pv.external_listing_id
            WHERE pv.id != ${propertyVector.id}
              AND pv.user_id = ${ctx.portfolio.ownerId}
            ORDER BY pv.vector <-> ${vectorStr}::vector
            LIMIT ${input.limit}
          `);

      return (results as unknown as Array<Record<string, unknown>>).map((row) => {
        const isPortfolio = row.property_id && row.user_id === ctx.portfolio.ownerId;
        const isExternal = !!row.external_listing_id;

        return {
          id: row.id as string,
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
          propertyId: row.property_id as string | undefined,
          address: row.property_address as string | undefined,
          externalListingId: row.external_listing_id as string | undefined,
          sourceUrl: row.listing_url as string | undefined,
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
      const benchmark = await ctx.db.query.suburbBenchmarks.findFirst({
        where: and(
          eq(suburbBenchmarks.suburb, input.extractedData.suburb),
          eq(suburbBenchmarks.state, input.extractedData.state)
        ),
      });

      const estimatedYield = benchmark?.rentalYield
        ? parseFloat(benchmark.rentalYield)
        : null;
      const estimatedGrowth = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : null;

      const [listing] = await ctx.db
        .insert(externalListings)
        .values({
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
        })
        .returning();

      // Generate vector for the listing
      const vector = generatePropertyVector({
        state: input.extractedData.state,
        suburb: input.extractedData.suburb,
        propertyType: input.extractedData.propertyType,
        currentValue: input.extractedData.price || 0,
        grossYield: estimatedYield || 0,
        capitalGrowthRate: estimatedGrowth || 0,
      });

      await ctx.db.insert(propertyVectors).values({
        externalListingId: listing.id,
        userId: ctx.portfolio.ownerId,
        vector,
      });

      return listing;
    }),

  listExternalListings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.externalListings.findMany({
      where: eq(externalListings.userId, ctx.portfolio.ownerId),
      orderBy: (el, { desc }) => [desc(el.createdAt)],
    });
  }),

  deleteExternalListing: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(externalListings)
        .where(
          and(
            eq(externalListings.id, input.id),
            eq(externalListings.userId, ctx.portfolio.ownerId)
          )
        );
      return { success: true };
    }),

  getSharingPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.sharingPreferences.findFirst({
      where: eq(sharingPreferences.userId, ctx.portfolio.ownerId),
    });

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
      const existing = await ctx.db.query.sharingPreferences.findFirst({
        where: eq(sharingPreferences.userId, ctx.portfolio.ownerId),
      });

      if (existing) {
        await ctx.db
          .update(sharingPreferences)
          .set({
            defaultShareLevel: input.defaultShareLevel,
            defaultSharedAttributes: input.defaultSharedAttributes,
            updatedAt: new Date(),
          })
          .where(eq(sharingPreferences.id, existing.id));
      } else {
        await ctx.db.insert(sharingPreferences).values({
          userId: ctx.portfolio.ownerId,
          defaultShareLevel: input.defaultShareLevel,
          defaultSharedAttributes: input.defaultSharedAttributes,
        });
      }

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
      const pv = await ctx.db.query.propertyVectors.findFirst({
        where: and(
          eq(propertyVectors.propertyId, input.propertyId),
          eq(propertyVectors.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!pv) {
        throw new Error("Property vector not found");
      }

      await ctx.db
        .update(propertyVectors)
        .set({
          isShared: input.shareLevel !== "none",
          shareLevel: input.shareLevel,
          sharedAttributes: input.sharedAttributes,
          updatedAt: new Date(),
        })
        .where(eq(propertyVectors.id, pv.id));

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
      const results = await ctx.db.query.propertyVectors.findMany({
        where: or(
          eq(propertyVectors.userId, ctx.portfolio.ownerId),
          eq(propertyVectors.isShared, true)
        ),
        limit: input.limit,
        offset: input.offset,
        with: {
          property: true,
          externalListing: true,
        },
      });

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
