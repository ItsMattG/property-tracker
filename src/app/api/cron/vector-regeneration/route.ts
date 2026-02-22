import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { properties, propertyVectors, propertyValues, transactions, suburbBenchmarks } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generatePropertyVector } from "@/server/services/property-analysis/vector-generation";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    let vectorsGenerated = 0;
    let vectorsUpdated = 0;

    // Get all active properties
    const allProperties = await db.query.properties.findMany({
      where: eq(properties.status, "active"),
    });

    for (const property of allProperties) {
      // Get latest valuation
      const latestValue = await db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, property.id),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const currentValue = latestValue?.estimatedValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property.purchasePrice);

      // Calculate annual rent
      const rentTransactions = await db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, property.id),
          eq(transactions.category, "rental_income")
        ),
      });

      const annualRent = rentTransactions.reduce(
        (sum, t) => sum + Math.abs(parseFloat(t.amount)),
        0
      );

      const grossYield = currentValue > 0 ? (annualRent / currentValue) * 100 : 0;

      // Get suburb benchmark for growth
      const benchmark = await db.query.suburbBenchmarks.findFirst({
        where: and(
          eq(suburbBenchmarks.suburb, property.suburb),
          eq(suburbBenchmarks.state, property.state)
        ),
      });

      const capitalGrowthRate = benchmark?.priceGrowth1yr
        ? parseFloat(benchmark.priceGrowth1yr)
        : 3.0;

      const vector = generatePropertyVector({
        state: property.state,
        suburb: property.suburb,
        propertyType: "house", // TODO: Add to properties table
        currentValue,
        grossYield,
        capitalGrowthRate,
      });

      // Check if vector exists
      const existing = await db.query.propertyVectors.findFirst({
        where: eq(propertyVectors.propertyId, property.id),
      });

      if (existing) {
        await db
          .update(propertyVectors)
          .set({ vector, updatedAt: new Date() })
          .where(eq(propertyVectors.id, existing.id));
        vectorsUpdated++;
      } else {
        await db.insert(propertyVectors).values({
          propertyId: property.id,
          userId: property.userId,
          vector,
        });
        vectorsGenerated++;
      }
    }

    return NextResponse.json({
      success: true,
      propertiesProcessed: allProperties.length,
      vectorsGenerated,
      vectorsUpdated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Vector regeneration cron failed", error instanceof Error ? error : new Error(String(error)), { domain: "cron" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
