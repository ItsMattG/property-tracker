import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, properties, subscriptions } from "@/server/db/schema";
import { eq, and, lt, gte, asc, inArray } from "drizzle-orm";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { sendEmailNotification } from "@/server/services/notification";
import {
  trialReminderSubject,
  trialReminderTemplate,
} from "@/lib/email/templates/trial-reminder";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const now = new Date();
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/settings/billing`;

  try {
    // Find users with trials ending in 3 days
    const threeDaysFromNow = addDays(now, 3);
    const threeDayUsers = await db.query.users.findMany({
      where: and(
        gte(users.trialEndsAt, startOfDay(threeDaysFromNow)),
        lt(users.trialEndsAt, endOfDay(threeDaysFromNow))
      ),
    });

    // Find users with trials ending in 1 day
    const oneDayFromNow = addDays(now, 1);
    const oneDayUsers = await db.query.users.findMany({
      where: and(
        gte(users.trialEndsAt, startOfDay(oneDayFromNow)),
        lt(users.trialEndsAt, endOfDay(oneDayFromNow))
      ),
    });

    // Find users with trials that just expired (within last 24 hours)
    const expiredUsers = await db.query.users.findMany({
      where: and(
        lt(users.trialEndsAt, now),
        gte(users.trialEndsAt, addDays(now, -1))
      ),
    });

    let emailsSent = 0;
    let propertiesLocked = 0;

    // Send 3-day reminder
    for (const user of threeDayUsers) {
      // Skip if user has an active subscription
      const sub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, user.id),
          eq(subscriptions.status, "active")
        ),
      });
      if (sub) continue;

      try {
        await sendEmailNotification(
          user.email,
          trialReminderSubject(3),
          trialReminderTemplate({ name: user.name, daysLeft: 3, upgradeUrl })
        );
        emailsSent++;
      } catch (error) {
        logger.error("Failed to send 3-day trial reminder", error, {
          userId: user.id,
        });
      }
    }

    // Send 1-day reminder
    for (const user of oneDayUsers) {
      // Skip if user has an active subscription
      const sub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, user.id),
          eq(subscriptions.status, "active")
        ),
      });
      if (sub) continue;

      try {
        await sendEmailNotification(
          user.email,
          trialReminderSubject(1),
          trialReminderTemplate({ name: user.name, daysLeft: 1, upgradeUrl })
        );
        emailsSent++;
      } catch (error) {
        logger.error("Failed to send 1-day trial reminder", error, {
          userId: user.id,
        });
      }
    }

    // Process expired trials
    for (const user of expiredUsers) {
      // Skip if user has an active subscription
      const sub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, user.id),
          eq(subscriptions.status, "active")
        ),
      });
      if (sub) continue;

      // Lock properties beyond the first (oldest property stays unlocked)
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.userId, user.id),
        orderBy: [asc(properties.createdAt)],
      });

      const propertiesToLock = userProperties.slice(1).filter((p) => !p.locked);
      if (propertiesToLock.length > 0) {
        await db
          .update(properties)
          .set({ locked: true })
          .where(
            inArray(
              properties.id,
              propertiesToLock.map((p) => p.id)
            )
          );
        propertiesLocked += propertiesToLock.length;
      }

      try {
        await sendEmailNotification(
          user.email,
          trialReminderSubject(0),
          trialReminderTemplate({ name: user.name, daysLeft: 0, upgradeUrl })
        );
        emailsSent++;
      } catch (error) {
        logger.error("Failed to send trial expired email", error, {
          userId: user.id,
        });
      }
    }

    logger.info("Trial reminders processed", { emailsSent, propertiesLocked });

    return NextResponse.json({
      success: true,
      emailsSent,
      propertiesLocked,
      checked: {
        threeDayUsers: threeDayUsers.length,
        oneDayUsers: oneDayUsers.length,
        expiredUsers: expiredUsers.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Trial reminder cron error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
