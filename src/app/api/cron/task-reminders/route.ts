import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  tasks,
  users,
  properties,
} from "@/server/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { notifyUser } from "@/server/services/notification";
import { shouldSendReminder } from "@/server/services/feedback/task";
import { format, parseISO } from "date-fns";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  try {
    const today = new Date();
    let sentCount = 0;
    const skippedCount = 0;

    // Get all tasks with due dates and reminder offsets that aren't done
    const tasksWithReminders = await db
      .select({
        task: tasks,
        user: users,
        propertyAddress: properties.address,
      })
      .from(tasks)
      .innerJoin(users, eq(tasks.userId, users.id))
      .leftJoin(properties, eq(tasks.propertyId, properties.id))
      .where(
        and(
          isNotNull(tasks.dueDate),
          isNotNull(tasks.reminderOffset),
          ne(tasks.status, "done")
        )
      );

    for (const { task, user, propertyAddress } of tasksWithReminders) {
      if (
        !shouldSendReminder(
          task.dueDate,
          task.reminderOffset,
          task.status as "todo" | "in_progress" | "done",
          today
        )
      ) {
        continue;
      }

      const dueDate = parseISO(task.dueDate!);
      const daysUntil = task.reminderOffset!;
      const dueDateFormatted = format(dueDate, "dd MMM yyyy");

      const title =
        daysUntil === 0
          ? `Task due today: ${task.title}`
          : `Task due in ${daysUntil} day${daysUntil > 1 ? "s" : ""}: ${task.title}`;

      const body = propertyAddress
        ? `${propertyAddress} \u2014 ${task.title} is due ${daysUntil === 0 ? "today" : `on ${dueDateFormatted}`}.`
        : `${task.title} is due ${daysUntil === 0 ? "today" : `on ${dueDateFormatted}`}.`;

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";
      const url = "/tasks";

      try {
        await notifyUser(user.id, user.email, "task_reminder", {
          title,
          body,
          url,
          emailSubject: title,
          emailHtml: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${daysUntil === 0 ? "#dc2626" : "#2563eb"};">
                ${title}
              </h2>
              <p style="font-size: 16px; color: #374151;">${body}</p>
              <a href="${appUrl}${url}"
                 style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
                View Tasks
              </a>
            </div>
          `,
        });
        sentCount++;
      } catch (error) {
        logger.error("Failed to send task reminder", error, {
          taskId: task.id,
          userId: user.id,
        });
      }

      // Also notify assignee if different from owner
      if (task.assigneeId && task.assigneeId !== task.userId) {
        const assignee = await db.query.users.findFirst({
          where: eq(users.id, task.assigneeId),
        });
        if (assignee) {
          try {
            await notifyUser(assignee.id, assignee.email, "task_reminder", {
              title,
              body,
              url,
              emailSubject: title,
              emailHtml: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: ${daysUntil === 0 ? "#dc2626" : "#2563eb"};">${title}</h2>
                  <p style="font-size: 16px; color: #374151;">${body}</p>
                  <a href="${appUrl}${url}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Tasks</a>
                </div>
              `,
            });
          } catch (error) {
            logger.error("Failed to send task reminder to assignee", error, {
              taskId: task.id,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      checked: tasksWithReminders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Task reminders cron error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
