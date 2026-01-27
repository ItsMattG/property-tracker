import webpush from "web-push";
import { Resend } from "resend";
import { db } from "@/server/db";
import { notificationPreferences, pushSubscriptions, notificationLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Types
export type NotificationType =
  | "rent_received"
  | "sync_failed"
  | "anomaly_critical"
  | "anomaly_warning"
  | "weekly_digest"
  | "eofy_suggestions"
  | "refinance_opportunity"
  | "cash_rate_changed"
  | "compliance_reminder"
  | "task_reminder"
  | "task_assigned"
  | "task_completed";

export type NotificationChannel = "email" | "push";

export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  rentReceived: boolean;
  syncFailed: boolean;
  anomalyDetected: boolean;
  weeklyDigest: boolean;
  complianceReminders: boolean;
  taskReminders: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
}

// Initialize services (lazy)
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function initWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@propertytracker.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
}

/**
 * Check if current time is within quiet hours
 */
export function isQuietHours(
  start: string,
  end: string,
  currentHour: number,
  currentMinute: number
): boolean {
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);

  const current = currentHour * 60 + currentMinute;
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  // Quiet hours span midnight (e.g., 21:00 - 08:00)
  if (startTime > endTime) {
    return current >= startTime || current < endTime;
  }

  // Quiet hours within same day (e.g., 13:00 - 15:00)
  return current >= startTime && current < endTime;
}

/**
 * Check if notification should be sent based on preferences
 */
export function shouldSendNotification(
  prefs: NotificationPrefs,
  type: NotificationType,
  channel: NotificationChannel
): boolean {
  // Check channel enabled
  if (channel === "email" && !prefs.emailEnabled) return false;
  if (channel === "push" && !prefs.pushEnabled) return false;

  // Check notification type enabled
  switch (type) {
    case "rent_received":
      return prefs.rentReceived;
    case "sync_failed":
      return prefs.syncFailed;
    case "anomaly_critical":
    case "anomaly_warning":
      return prefs.anomalyDetected;
    case "weekly_digest":
      return prefs.weeklyDigest;
    case "compliance_reminder":
      return prefs.complianceReminders;
    case "task_reminder":
    case "task_assigned":
    case "task_completed":
      return prefs.taskReminders;
    default:
      return false;
  }
}

/**
 * Send push notification to a subscription
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    initWebPush();

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    );

    return true;
  } catch (error) {
    console.error("Push notification failed:", error);
    return false;
  }
}

/**
 * Send email notification
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const resend = getResend();

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "PropertyTracker <notifications@propertytracker.com>",
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("Email notification failed:", error);
    return false;
  }
}

/**
 * Get default notification preferences
 */
export function getDefaultPreferences(): NotificationPrefs & {
  quietHoursStart: string;
  quietHoursEnd: string;
} {
  return {
    emailEnabled: true,
    pushEnabled: true,
    rentReceived: true,
    syncFailed: true,
    anomalyDetected: true,
    weeklyDigest: true,
    complianceReminders: true,
    taskReminders: true,
    quietHoursStart: "21:00",
    quietHoursEnd: "08:00",
  };
}

/**
 * Send notification to user across all enabled channels
 */
export async function notifyUser(
  userId: string,
  userEmail: string,
  type: NotificationType,
  payload: {
    title: string;
    body: string;
    url?: string;
    emailHtml?: string;
    emailSubject?: string;
  }
): Promise<void> {
  // Get user preferences
  const prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (!prefs) return;

  const now = new Date();
  const inQuietHours = isQuietHours(
    prefs.quietHoursStart,
    prefs.quietHoursEnd,
    now.getHours(),
    now.getMinutes()
  );

  // Send push notifications (if not quiet hours)
  if (shouldSendNotification(prefs, type, "push") && !inQuietHours) {
    const subscriptions = await db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.userId, userId),
    });

    for (const sub of subscriptions) {
      const success = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title: payload.title, body: payload.body, data: { url: payload.url || "/dashboard" } }
      );

      await db.insert(notificationLog).values({
        userId,
        type,
        channel: "push",
        status: success ? "sent" : "failed",
        metadata: JSON.stringify({ subscriptionId: sub.id }),
      });
    }
  }

  // Send email
  if (shouldSendNotification(prefs, type, "email") && payload.emailHtml && payload.emailSubject) {
    const success = await sendEmailNotification(userEmail, payload.emailSubject, payload.emailHtml);

    await db.insert(notificationLog).values({
      userId,
      type,
      channel: "email",
      status: success ? "sent" : (inQuietHours ? "skipped_quiet_hours" : "failed"),
    });
  }
}
