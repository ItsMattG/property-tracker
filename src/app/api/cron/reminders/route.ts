import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { ReminderRepository } from "@/server/repositories/reminder.repository";
import { sendEmailNotification } from "@/server/services/notification";
import {
  reminderDueTemplate,
  reminderDueSubject,
} from "@/lib/email/templates/reminder-due";
import { propertyReminders } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const repo = new ReminderRepository(db);
    const today = new Date().toISOString().split("T")[0];

    const dueReminders = await repo.findDueForNotification(today);

    let sent = 0;
    let errors = 0;

    for (const reminder of dueReminders) {
      const dueDate = new Date(reminder.dueDate);
      const daysUntil = Math.ceil(
        (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const data = {
        title: reminder.title,
        propertyAddress: reminder.propertyAddress,
        dueDate: dueDate.toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        daysUntil,
        reminderType: reminder.reminderType,
        notes: reminder.notes,
      };

      try {
        await sendEmailNotification(
          reminder.userEmail,
          reminderDueSubject(data),
          reminderDueTemplate(data)
        );

        await db
          .update(propertyReminders)
          .set({ notifiedAt: new Date() })
          .where(eq(propertyReminders.id, reminder.id));

        sent++;
      } catch (emailError) {
        logger.error("Failed to send reminder email", emailError, {
          reminderId: reminder.id,
          userId: reminder.userId,
        });
        errors++;
      }
    }

    logger.info("Reminder cron completed", {
      found: dueReminders.length,
      sent,
      errors,
    });

    return NextResponse.json({
      success: true,
      found: dueReminders.length,
      sent,
      errors,
    });
  } catch (error) {
    logger.error("Reminder cron failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
