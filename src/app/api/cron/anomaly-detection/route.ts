import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  anomalyAlerts,
  expectedTransactions,
  recurringTransactions,
  properties,
} from "@/server/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { detectMissedRent } from "@/server/services/anomaly";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    // Find pending expected transactions past their due date
    const today = new Date().toISOString().split("T")[0];

    const pendingExpected = await db
      .select({
        id: expectedTransactions.id,
        expectedDate: expectedTransactions.expectedDate,
        expectedAmount: expectedTransactions.expectedAmount,
        userId: expectedTransactions.userId,
        propertyId: expectedTransactions.propertyId,
        recurringId: expectedTransactions.recurringTransactionId,
        alertDelayDays: recurringTransactions.alertDelayDays,
        description: recurringTransactions.description,
        propertyAddress: properties.address,
      })
      .from(expectedTransactions)
      .innerJoin(
        recurringTransactions,
        eq(expectedTransactions.recurringTransactionId, recurringTransactions.id)
      )
      .leftJoin(properties, eq(expectedTransactions.propertyId, properties.id))
      .where(
        and(
          eq(expectedTransactions.status, "pending"),
          lt(expectedTransactions.expectedDate, today)
        )
      );

    let alertsCreated = 0;

    for (const expected of pendingExpected) {
      // Check if alert already exists for this expected transaction
      const existingAlert = await db.query.anomalyAlerts.findFirst({
        where: and(
          eq(anomalyAlerts.expectedTransactionId, expected.id),
          eq(anomalyAlerts.status, "active")
        ),
      });

      if (existingAlert) continue;

      const result = detectMissedRent(
        {
          id: expected.id,
          expectedDate: expected.expectedDate,
          expectedAmount: expected.expectedAmount,
          recurringTransaction: {
            description: expected.description,
            property: expected.propertyAddress
              ? { address: expected.propertyAddress }
              : null,
          },
        },
        parseInt(expected.alertDelayDays)
      );

      if (result) {
        await db.insert(anomalyAlerts).values({
          userId: expected.userId,
          propertyId: expected.propertyId,
          expectedTransactionId: expected.id,
          recurringId: expected.recurringId,
          ...result,
        });
        alertsCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingExpected.length,
      alertsCreated,
    });
  } catch (error) {
    console.error("Anomaly detection cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
