import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  users,
  notificationPreferences,
  notificationLog,
  transactions,
  properties,
  anomalyAlerts,
} from "@/server/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { sendEmailNotification } from "@/server/services/notification";
import { weeklyDigestTemplate, weeklyDigestSubject } from "@/lib/email/templates/weekly-digest";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const now = new Date();
    const weekEnd = endOfDay(subDays(now, 1)); // Yesterday
    const weekStart = startOfDay(subDays(now, 7)); // 7 days ago

    // Get users with weekly digest enabled
    const usersWithDigest = await db
      .select({
        userId: users.id,
        email: users.email,
      })
      .from(users)
      .innerJoin(
        notificationPreferences,
        eq(notificationPreferences.userId, users.id)
      )
      .where(
        and(
          eq(notificationPreferences.weeklyDigest, true),
          eq(notificationPreferences.emailEnabled, true)
        )
      );

    let sentCount = 0;
    let failedCount = 0;

    for (const user of usersWithDigest) {
      try {
        // Get user's properties
        const userProperties = await db.query.properties.findMany({
          where: eq(properties.userId, user.userId),
        });

        if (userProperties.length === 0) continue;

        // Get transactions for the week
        const weekTransactions = await db
          .select({
            propertyId: transactions.propertyId,
            amount: transactions.amount,
            transactionType: transactions.transactionType,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.userId),
              gte(transactions.date, format(weekStart, "yyyy-MM-dd")),
              lte(transactions.date, format(weekEnd, "yyyy-MM-dd"))
            )
          );

        // Calculate totals
        let totalIncome = 0;
        let totalExpenses = 0;
        const propertyTotals: Record<string, { income: number; expenses: number }> = {};

        for (const tx of weekTransactions) {
          const amount = Math.abs(Number(tx.amount));
          const propId = tx.propertyId || "unassigned";

          if (!propertyTotals[propId]) {
            propertyTotals[propId] = { income: 0, expenses: 0 };
          }

          if (tx.transactionType === "income") {
            totalIncome += amount;
            propertyTotals[propId].income += amount;
          } else if (tx.transactionType === "expense") {
            totalExpenses += amount;
            propertyTotals[propId].expenses += amount;
          }
        }

        // Get active alerts count
        const alertCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(anomalyAlerts)
          .where(
            and(
              eq(anomalyAlerts.userId, user.userId),
              eq(anomalyAlerts.status, "active")
            )
          );

        // Build property breakdown
        const propertyBreakdown = userProperties.map((p) => ({
          address: p.address,
          income: propertyTotals[p.id]?.income || 0,
          expenses: propertyTotals[p.id]?.expenses || 0,
        }));

        // Generate and send email
        const digestData = {
          weekStart: format(weekStart, "MMM d"),
          weekEnd: format(weekEnd, "MMM d, yyyy"),
          totalIncome,
          totalExpenses,
          netCashFlow: totalIncome - totalExpenses,
          propertyCount: userProperties.length,
          alertCount: Number(alertCount[0]?.count || 0),
          properties: propertyBreakdown,
        };

        const html = weeklyDigestTemplate(digestData);
        const subject = weeklyDigestSubject();

        const success = await sendEmailNotification(user.email, subject, html);

        // Log the notification
        await db.insert(notificationLog).values({
          userId: user.userId,
          type: "weekly_digest",
          channel: "email",
          status: success ? "sent" : "failed",
          metadata: JSON.stringify({ weekStart: weekStart.toISOString() }),
        });

        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        logger.error("Failed to send digest to user", error, { userId: user.userId });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: usersWithDigest.length,
    });
  } catch (error) {
    logger.error("Weekly digest cron error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
