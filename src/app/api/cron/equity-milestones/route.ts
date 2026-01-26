import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  properties,
  propertyValues,
  loans,
  users,
  notificationPreferences,
  notificationLog,
  pushSubscriptions,
  equityMilestones,
  milestonePreferences,
  propertyMilestoneOverrides,
} from "@/server/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushNotification, sendEmailNotification, isQuietHours } from "@/server/services/notification";
import { getMilestoneMessage } from "@/lib/equity-milestones";
import { resolveThresholds } from "@/server/services/milestone-preferences";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    let newMilestones = 0;
    let notificationsSent = 0;

    const propertiesWithData = await db
      .select({
        property: properties,
        user: users,
      })
      .from(properties)
      .innerJoin(users, eq(properties.userId, users.id))
      .where(eq(properties.status, "active"));

    for (const { property, user } of propertiesWithData) {
      const latestValue = await db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, property.id),
        orderBy: [desc(propertyValues.valueDate)],
      });

      if (!latestValue) continue;

      const loanResult = await db
        .select({ total: sql<string>`COALESCE(SUM(current_balance), 0)` })
        .from(loans)
        .where(eq(loans.propertyId, property.id));

      const totalLoanBalance = Number(loanResult[0]?.total || 0);
      const estimatedValue = Number(latestValue.estimatedValue);

      if (estimatedValue <= 0) continue;

      const equity = estimatedValue - totalLoanBalance;
      const lvr = (totalLoanBalance / estimatedValue) * 100;

      const existingMilestones = await db.query.equityMilestones.findMany({
        where: eq(equityMilestones.propertyId, property.id),
      });

      const existingLvrMilestones = new Set(
        existingMilestones
          .filter((m) => m.milestoneType === "lvr")
          .map((m) => Number(m.milestoneValue))
      );
      const existingEquityMilestones = new Set(
        existingMilestones
          .filter((m) => m.milestoneType === "equity_amount")
          .map((m) => Number(m.milestoneValue))
      );

      // Get user's global milestone preferences
      const globalPrefs = await db.query.milestonePreferences.findFirst({
        where: eq(milestonePreferences.userId, user.id),
      });

      // Get property-specific override
      const propertyOverride = await db.query.propertyMilestoneOverrides.findFirst({
        where: eq(propertyMilestoneOverrides.propertyId, property.id),
      });

      // Resolve thresholds
      const config = resolveThresholds(
        globalPrefs ? {
          lvrThresholds: globalPrefs.lvrThresholds as number[],
          equityThresholds: globalPrefs.equityThresholds as number[],
          enabled: globalPrefs.enabled,
        } : null,
        propertyOverride ? {
          lvrThresholds: propertyOverride.lvrThresholds as number[] | null,
          equityThresholds: propertyOverride.equityThresholds as number[] | null,
          enabled: propertyOverride.enabled,
        } : null
      );

      // Skip if milestones disabled for this property
      if (!config.enabled) continue;

      const milestonesToRecord: Array<{ type: "lvr" | "equity_amount"; value: number }> = [];

      for (const threshold of config.lvrThresholds) {
        if (lvr <= threshold && !existingLvrMilestones.has(threshold)) {
          milestonesToRecord.push({ type: "lvr", value: threshold });
        }
      }

      for (const threshold of config.equityThresholds) {
        if (equity >= threshold && !existingEquityMilestones.has(threshold)) {
          milestonesToRecord.push({ type: "equity_amount", value: threshold });
        }
      }

      if (milestonesToRecord.length === 0) continue;

      const prefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, user.id),
      });

      for (const milestone of milestonesToRecord) {
        await db.insert(equityMilestones).values({
          propertyId: property.id,
          userId: user.id,
          milestoneType: milestone.type,
          milestoneValue: String(milestone.value),
          equityAtAchievement: String(equity),
          lvrAtAchievement: String(lvr),
        });
        newMilestones++;

        if (!prefs) continue;

        const { title, body } = getMilestoneMessage(milestone.type, milestone.value, property.address);
        const url = `/properties/${property.id}`;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";

        const now = new Date();
        const inQuietHours = isQuietHours(
          prefs.quietHoursStart,
          prefs.quietHoursEnd,
          now.getHours(),
          now.getMinutes()
        );

        if (prefs.pushEnabled && !inQuietHours) {
          const subs = await db.query.pushSubscriptions.findMany({
            where: eq(pushSubscriptions.userId, user.id),
          });

          for (const sub of subs) {
            await sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title, body, data: { url } }
            );
          }
        }

        if (prefs.emailEnabled) {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">${title}</h2>
              <p style="font-size: 16px; color: #374151;">${body}</p>
              <a href="${appUrl}${url}"
                 style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px;">
                View Property
              </a>
            </div>
          `;

          const success = await sendEmailNotification(user.email, title, emailHtml);

          await db.insert(notificationLog).values({
            userId: user.id,
            type: "equity_milestone",
            channel: "email",
            status: success ? "sent" : "failed",
            metadata: JSON.stringify({
              propertyId: property.id,
              milestoneType: milestone.type,
              milestoneValue: milestone.value,
            }),
          });

          if (success) notificationsSent++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      newMilestones,
      notificationsSent,
      propertiesChecked: propertiesWithData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Equity milestones cron error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
