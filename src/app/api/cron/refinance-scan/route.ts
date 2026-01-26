import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  refinanceAlerts,
  loans,
  users,
  properties,
  propertyValues,
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { shouldAlertForLoan, calculateLvr } from "./helpers";
import { getEstimatedMarketRate } from "@/server/services/rate-data";
import { calculateMonthlySavings } from "@/server/services/loan-comparison";
import { sendEmailNotification } from "@/server/services/notification";
import {
  refinanceOpportunityTemplate,
  refinanceOpportunitySubject,
} from "@/lib/email/templates/refinance-opportunity";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    // Get all enabled refinance alerts with loan details
    const alerts = await db
      .select({
        alertId: refinanceAlerts.id,
        loanId: refinanceAlerts.loanId,
        threshold: refinanceAlerts.rateGapThreshold,
        lastAlertedAt: refinanceAlerts.lastAlertedAt,
        currentRate: loans.interestRate,
        currentBalance: loans.currentBalance,
        loanType: loans.loanType,
        userId: loans.userId,
        propertyId: loans.propertyId,
      })
      .from(refinanceAlerts)
      .innerJoin(loans, eq(loans.id, refinanceAlerts.loanId))
      .where(eq(refinanceAlerts.enabled, true));

    let scanned = 0;
    let alerted = 0;

    for (const alert of alerts) {
      scanned++;

      // Get property value for LVR calculation
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, alert.propertyId),
      });

      const latestValue = await db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, alert.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const propertyValue = latestValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property?.purchasePrice || "0");

      const loanBalance = parseFloat(alert.currentBalance);
      const lvr = calculateLvr(loanBalance, propertyValue);

      // Determine loan purpose (default to investor for investment properties)
      const purpose = "investor" as const;

      // Get estimated market rate
      const marketRate = await getEstimatedMarketRate(
        purpose,
        alert.loanType,
        lvr
      );

      if (marketRate === null) continue;

      const currentRate = parseFloat(alert.currentRate);
      const threshold = parseFloat(alert.threshold);

      // Check if should alert
      if (
        !shouldAlertForLoan({
          currentRate,
          marketRate,
          threshold,
          lastAlertedAt: alert.lastAlertedAt,
        })
      ) {
        continue;
      }

      // Calculate savings (assume 25 years remaining for estimate)
      const monthlySavings = calculateMonthlySavings(
        loanBalance,
        currentRate,
        marketRate,
        300
      );

      // Get user email
      const user = await db.query.users.findFirst({
        where: eq(users.id, alert.userId),
      });

      if (!user?.email || !property) continue;

      // Send notification
      await sendEmailNotification(
        user.email,
        refinanceOpportunitySubject({ monthlySavings }),
        refinanceOpportunityTemplate({
          propertyAddress: property.address,
          currentRate,
          marketRate,
          monthlySavings,
          loanId: alert.loanId,
        })
      );

      // Update last alerted timestamp
      await db
        .update(refinanceAlerts)
        .set({ lastAlertedAt: new Date() })
        .where(eq(refinanceAlerts.id, alert.alertId));

      alerted++;
    }

    return NextResponse.json({
      success: true,
      scanned,
      alerted,
    });
  } catch (error) {
    logger.error("Refinance scan error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
