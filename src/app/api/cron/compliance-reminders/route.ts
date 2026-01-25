import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  complianceRecords,
  properties,
  users,
  notificationPreferences,
  notificationLog,
  pushSubscriptions,
} from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { sendPushNotification, sendEmailNotification, isQuietHours } from "@/server/services/notification";
import { getRequirementById } from "@/lib/compliance-requirements";
import { format, addDays } from "date-fns";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const in7Days = format(addDays(today, 7), "yyyy-MM-dd");
    const in30Days = format(addDays(today, 30), "yyyy-MM-dd");

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Get all compliance records with upcoming due dates (30, 7, or 0 days from today)
    const upcomingRecords = await db
      .select({
        record: complianceRecords,
        property: properties,
        user: users,
      })
      .from(complianceRecords)
      .innerJoin(properties, eq(complianceRecords.propertyId, properties.id))
      .innerJoin(users, eq(complianceRecords.userId, users.id))
      .where(inArray(complianceRecords.nextDueAt, [todayStr, in7Days, in30Days]));

    for (const { record, property, user } of upcomingRecords) {
      const requirement = getRequirementById(record.requirementId);
      if (!requirement) continue;

      // Get user notification preferences
      const prefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, user.id),
      });

      if (!prefs || !prefs.complianceReminders) {
        skippedCount++;
        continue;
      }

      const dueDate = new Date(record.nextDueAt);
      const daysUntil = Math.round(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let title: string;
      let body: string;
      let urgency: "upcoming" | "due_soon" | "due_today";

      if (daysUntil === 0) {
        title = `Due today: ${requirement.name}`;
        body = `${property.address} - ${requirement.name} is due today.`;
        urgency = "due_today";
      } else if (daysUntil <= 7) {
        title = `Due soon: ${requirement.name}`;
        body = `${property.address} - ${requirement.name} is due in ${daysUntil} days.`;
        urgency = "due_soon";
      } else if (daysUntil <= 30) {
        title = `Upcoming: ${requirement.name}`;
        body = `${property.address} - ${requirement.name} is due on ${format(dueDate, "dd MMM yyyy")}.`;
        urgency = "upcoming";
      } else {
        continue;
      }

      const url = `/properties/${property.id}/compliance`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";

      try {
        // Check quiet hours for push notifications
        const now = new Date();
        const inQuietHours = isQuietHours(
          prefs.quietHoursStart,
          prefs.quietHoursEnd,
          now.getHours(),
          now.getMinutes()
        );

        // Send push notification (if enabled and not quiet hours)
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

        // Send email notification (if enabled)
        if (prefs.emailEnabled) {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${urgency === "due_today" ? "#dc2626" : urgency === "due_soon" ? "#d97706" : "#2563eb"};">
                ${title}
              </h2>
              <p style="font-size: 16px; color: #374151;">${body}</p>
              <p style="font-size: 14px; color: #6b7280;">
                ${requirement.description}
              </p>
              <a href="${appUrl}${url}"
                 style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                View Compliance Details
              </a>
            </div>
          `;

          const success = await sendEmailNotification(user.email, title, emailHtml);

          // Log the notification
          await db.insert(notificationLog).values({
            userId: user.id,
            type: "compliance_reminder",
            channel: "email",
            status: success ? "sent" : "failed",
            metadata: JSON.stringify({
              propertyId: property.id,
              requirementId: record.requirementId,
              daysUntilDue: daysUntil,
            }),
          });

          if (success) {
            sentCount++;
          } else {
            failedCount++;
          }
        }
      } catch (error) {
        console.error(
          `Failed to send compliance reminder for user ${user.id}:`,
          error
        );
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      recordsChecked: upcomingRecords.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Compliance reminders cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
