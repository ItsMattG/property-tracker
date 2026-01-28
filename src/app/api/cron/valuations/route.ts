import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { properties, propertyValues } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { recordHeartbeat } from "@/lib/monitoring";
import { getValuationProvider, MockValuationProvider } from "@/server/services/valuation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    const provider = getValuationProvider();
    let valuationsCreated = 0;
    let propertiesProcessed = 0;
    let backfilled = 0;
    const errors: string[] = [];

    const activeProperties = await db.query.properties.findMany({
      where: eq(properties.status, "active"),
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    for (const property of activeProperties) {
      try {
        propertiesProcessed++;

        // Check existing valuations count
        const existing = await db.query.propertyValues.findMany({
          where: eq(propertyValues.propertyId, property.id),
          columns: { id: true, valueDate: true },
        });

        const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
        const input = {
          propertyId: property.id,
          purchasePrice: Number(property.purchasePrice),
          purchaseDate: property.purchaseDate,
          address: fullAddress,
          propertyType: "house",
        };

        // Backfill history if no valuations exist
        if (existing.length === 0 && provider instanceof MockValuationProvider) {
          const history = await provider.generateHistory(input);
          if (history.length > 0) {
            await db.insert(propertyValues).values(
              history.map(h => ({
                propertyId: property.id,
                userId: property.userId,
                estimatedValue: h.estimatedValue.toString(),
                confidenceLow: h.confidenceLow.toString(),
                confidenceHigh: h.confidenceHigh.toString(),
                valueDate: h.valueDate,
                source: "mock" as const,
                apiResponseId: `mock-backfill-${h.valueDate}`,
              }))
            );
            backfilled += history.length;
          }
          continue; // backfill includes current month
        }

        // Skip if current month already has a valuation
        const existingDates = existing.map(e => e.valueDate);
        if (existingDates.includes(currentMonth)) {
          continue;
        }

        // Generate current month valuation
        const result = await provider.getValuation(input);
        if (result) {
          await db.insert(propertyValues).values({
            propertyId: property.id,
            userId: property.userId,
            estimatedValue: result.estimatedValue.toString(),
            confidenceLow: result.confidenceLow.toString(),
            confidenceHigh: result.confidenceHigh.toString(),
            valueDate: currentMonth,
            source: result.source as "mock" | "corelogic" | "proptrack",
            apiResponseId: `mock-cron-${Date.now()}`,
          });
          valuationsCreated++;
        }
      } catch (error) {
        const msg = `Failed for property ${property.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(msg);
        logger.error("Valuation cron error for property", { propertyId: property.id, error });
      }
    }

    logger.info("Valuation cron completed", {
      propertiesProcessed,
      valuationsCreated,
      backfilled,
      errors: errors.length,
    });

    await recordHeartbeat("valuations", {
      status: errors.length > 0 ? "failure" : "success",
      durationMs: Date.now() - startTime,
      metadata: { propertiesProcessed, valuationsCreated, backfilled, errorCount: errors.length },
    });

    return NextResponse.json({
      success: true,
      propertiesProcessed,
      valuationsCreated,
      backfilled,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await recordHeartbeat("valuations", {
      status: "failure",
      durationMs: Date.now() - startTime,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    logger.error("Valuation cron error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
