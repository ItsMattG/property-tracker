# Push Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build push and email notification system for rent received, sync failures, anomalies, and weekly digests.

**Architecture:** Database stores user preferences and push subscriptions. Notification service checks preferences, respects quiet hours, sends via web-push/Resend, logs attempts. Service worker handles browser push events. Cron job sends weekly digests.

**Tech Stack:** Drizzle ORM, tRPC, web-push, Resend, Service Workers, Vitest

---

## Task 1: Database Schema - Add Notification Tables

**Files:**
- Modify: `/src/server/db/schema.ts`

**Step 1: Add enums after existing enums**

Add after `anomalySeverityEnum`:

```typescript
export const notificationTypeEnum = pgEnum("notification_type", [
  "rent_received",
  "sync_failed",
  "anomaly_critical",
  "anomaly_warning",
  "weekly_digest",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "failed",
  "skipped_quiet_hours",
]);
```

**Step 2: Add notificationPreferences table**

Add after `cashFlowForecastsRelations`:

```typescript
export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  rentReceived: boolean("rent_received").default(true).notNull(),
  syncFailed: boolean("sync_failed").default(true).notNull(),
  anomalyDetected: boolean("anomaly_detected").default(true).notNull(),
  weeklyDigest: boolean("weekly_digest").default(true).notNull(),
  quietHoursStart: text("quiet_hours_start").default("21:00").notNull(),
  quietHoursEnd: text("quiet_hours_end").default("08:00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    index("push_subscriptions_endpoint_idx").on(table.endpoint),
  ]
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationStatusEnum("status").notNull(),
    metadata: text("metadata"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_log_user_id_idx").on(table.userId),
    index("notification_log_sent_at_idx").on(table.sentAt),
  ]
);
```

**Step 3: Add relations**

```typescript
export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const notificationLogRelations = relations(
  notificationLog,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationLog.userId],
      references: [users.id],
    }),
  })
);
```

**Step 4: Add type exports**

```typescript
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
export type NewNotificationLogEntry = typeof notificationLog.$inferInsert;
```

**Step 5: Generate migration**

Run: `npm run db:generate`

**Step 6: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add notification preferences, subscriptions, and log tables"
```

---

## Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install web-push and resend**

Run: `npm install web-push resend`

**Step 2: Add type definitions for web-push**

Run: `npm install -D @types/web-push`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add web-push and resend dependencies"
```

---

## Task 3: Notification Service - Core Logic

**Files:**
- Create: `/src/server/services/notification.ts`
- Create: `/src/server/services/__tests__/notification.test.ts`

**Step 1: Write failing tests**

Create `/src/server/services/__tests__/notification.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isQuietHours,
  shouldSendNotification,
  type NotificationPrefs,
} from "../notification";

describe("notification service", () => {
  describe("isQuietHours", () => {
    it("returns true during quiet hours (evening)", () => {
      // 10pm is after 9pm start
      const result = isQuietHours("21:00", "08:00", 22, 0);
      expect(result).toBe(true);
    });

    it("returns true during quiet hours (early morning)", () => {
      // 6am is before 8am end
      const result = isQuietHours("21:00", "08:00", 6, 0);
      expect(result).toBe(true);
    });

    it("returns false outside quiet hours", () => {
      // 2pm is outside 9pm-8am
      const result = isQuietHours("21:00", "08:00", 14, 0);
      expect(result).toBe(false);
    });

    it("returns false at exactly end time", () => {
      // 8am is end of quiet hours
      const result = isQuietHours("21:00", "08:00", 8, 0);
      expect(result).toBe(false);
    });
  });

  describe("shouldSendNotification", () => {
    const basePrefs: NotificationPrefs = {
      emailEnabled: true,
      pushEnabled: true,
      rentReceived: true,
      syncFailed: true,
      anomalyDetected: true,
      weeklyDigest: true,
    };

    it("returns true when preference is enabled", () => {
      const result = shouldSendNotification(basePrefs, "rent_received", "email");
      expect(result).toBe(true);
    });

    it("returns false when channel is disabled", () => {
      const prefs = { ...basePrefs, emailEnabled: false };
      const result = shouldSendNotification(prefs, "rent_received", "email");
      expect(result).toBe(false);
    });

    it("returns false when notification type is disabled", () => {
      const prefs = { ...basePrefs, rentReceived: false };
      const result = shouldSendNotification(prefs, "rent_received", "email");
      expect(result).toBe(false);
    });

    it("handles anomaly types correctly", () => {
      const result = shouldSendNotification(basePrefs, "anomaly_critical", "push");
      expect(result).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/notification.test.ts`
Expected: FAIL - module not found

**Step 3: Implement the service**

Create `/src/server/services/notification.ts`:

```typescript
import webpush from "web-push";
import { Resend } from "resend";

// Types
export type NotificationType =
  | "rent_received"
  | "sync_failed"
  | "anomaly_critical"
  | "anomaly_warning"
  | "weekly_digest";

export type NotificationChannel = "email" | "push";

export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  rentReceived: boolean;
  syncFailed: boolean;
  anomalyDetected: boolean;
  weeklyDigest: boolean;
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
export function getDefaultPreferences(): Omit<NotificationPrefs, "emailEnabled" | "pushEnabled"> & {
  emailEnabled: boolean;
  pushEnabled: boolean;
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
    quietHoursStart: "21:00",
    quietHoursEnd: "08:00",
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/notification.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/services/notification.ts src/server/services/__tests__/notification.test.ts
git commit -m "feat(notification): add core notification service with quiet hours logic"
```

---

## Task 4: Notification Router

**Files:**
- Create: `/src/server/routers/notification.ts`
- Modify: `/src/server/routers/_app.ts`

**Step 1: Create the notification router**

Create `/src/server/routers/notification.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  notificationPreferences,
  pushSubscriptions,
  notificationLog,
} from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getDefaultPreferences } from "../services/notification";

export const notificationRouter = router({
  // Get or create preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    let prefs = await ctx.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, ctx.user.id),
    });

    if (!prefs) {
      const defaults = getDefaultPreferences();
      const [created] = await ctx.db
        .insert(notificationPreferences)
        .values({
          userId: ctx.user.id,
          ...defaults,
        })
        .returning();
      prefs = created;
    }

    return prefs;
  }),

  // Update preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        emailEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        rentReceived: z.boolean().optional(),
        syncFailed: z.boolean().optional(),
        anomalyDetected: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
        quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure preferences exist
      const existing = await ctx.db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, ctx.user.id),
      });

      if (!existing) {
        const defaults = getDefaultPreferences();
        const [created] = await ctx.db
          .insert(notificationPreferences)
          .values({
            userId: ctx.user.id,
            ...defaults,
            ...input,
          })
          .returning();
        return created;
      }

      const [updated] = await ctx.db
        .update(notificationPreferences)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, ctx.user.id))
        .returning();

      return updated;
    }),

  // Register push subscription
  registerPushSubscription: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if subscription already exists
      const existing = await ctx.db.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.userId, ctx.user.id),
          eq(pushSubscriptions.endpoint, input.endpoint)
        ),
      });

      if (existing) {
        return existing;
      }

      const [subscription] = await ctx.db
        .insert(pushSubscriptions)
        .values({
          userId: ctx.user.id,
          ...input,
        })
        .returning();

      return subscription;
    }),

  // Unregister push subscription
  unregisterPushSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        );

      return { success: true };
    }),

  // List user's push subscriptions
  listPushSubscriptions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.pushSubscriptions.findMany({
      where: eq(pushSubscriptions.userId, ctx.user.id),
      orderBy: [desc(pushSubscriptions.createdAt)],
    });
  }),

  // Get recent notification log
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.notificationLog.findMany({
        where: eq(notificationLog.userId, ctx.user.id),
        orderBy: [desc(notificationLog.sentAt)],
        limit: input.limit,
      });
    }),

  // Get VAPID public key for client
  getVapidPublicKey: protectedProcedure.query(() => {
    return process.env.VAPID_PUBLIC_KEY || null;
  }),
});
```

**Step 2: Register the router in _app.ts**

Add import:
```typescript
import { notificationRouter } from "./notification";
```

Add to appRouter:
```typescript
notification: notificationRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/notification.ts src/server/routers/_app.ts
git commit -m "feat(notification): add router with preferences and subscription management"
```

---

## Task 5: Service Worker for Push

**Files:**
- Create: `/public/sw.js`

**Step 1: Create service worker**

Create `/public/sw.js`:

```javascript
// Service Worker for Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    const options = {
      body: payload.body,
      icon: payload.icon || "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.data || {},
      requireInteraction: true,
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  } catch (error) {
    console.error("Error showing notification:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new window if none found
      return clients.openWindow(url);
    })
  );
});

// Handle subscription changes
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/notification/subscription-changed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldEndpoint: event.oldSubscription?.endpoint,
        newSubscription: event.newSubscription,
      }),
    })
  );
});
```

**Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat(notification): add service worker for push notifications"
```

---

## Task 6: Push Subscription Hook

**Files:**
- Create: `/src/hooks/usePushSubscription.ts`

**Step 1: Create the hook**

Create `/src/hooks/usePushSubscription.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";

type SubscriptionStatus = "loading" | "unsupported" | "denied" | "prompt" | "subscribed";

export function usePushSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const { data: vapidKey } = trpc.notification.getVapidPublicKey.useQuery();
  const registerMutation = trpc.notification.registerPushSubscription.useMutation();
  const unregisterMutation = trpc.notification.unregisterPushSubscription.useMutation();

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const permission = Notification.permission;

    if (permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setStatus("subscribed");
      } else {
        setStatus("prompt");
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
      setStatus("prompt");
    }
  };

  const subscribe = useCallback(async () => {
    if (!vapidKey) {
      setError("Push notifications not configured");
      return false;
    }

    try {
      setError(null);

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send to server
      const json = subscription.toJSON();
      await registerMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
        userAgent: navigator.userAgent,
      });

      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("Error subscribing:", err);
      setError("Failed to enable notifications");
      return false;
    }
  }, [vapidKey, registerMutation]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await unregisterMutation.mutateAsync({ endpoint: subscription.endpoint });
      }

      setStatus("prompt");
      return true;
    } catch (err) {
      console.error("Error unsubscribing:", err);
      setError("Failed to disable notifications");
      return false;
    }
  }, [unregisterMutation]);

  return {
    status,
    error,
    subscribe,
    unsubscribe,
    isSupported: status !== "unsupported",
  };
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
```

**Step 2: Commit**

```bash
git add src/hooks/usePushSubscription.ts
git commit -m "feat(notification): add usePushSubscription hook for client-side push management"
```

---

## Task 7: Email Templates

**Files:**
- Create: `/src/lib/email/templates/rent-received.ts`
- Create: `/src/lib/email/templates/weekly-digest.ts`
- Create: `/src/lib/email/templates/base.ts`

**Step 1: Create base template**

Create `/src/lib/email/templates/base.ts`:

```typescript
export function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PropertyTracker</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin: 0;">PropertyTracker</h1>
  </div>
  ${content}
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
    <p>You're receiving this because you have notifications enabled.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a></p>
  </div>
</body>
</html>
`;
}
```

**Step 2: Create rent received template**

Create `/src/lib/email/templates/rent-received.ts`:

```typescript
import { baseTemplate } from "./base";

interface RentReceivedData {
  propertyAddress: string;
  amount: number;
  date: string;
  transactionId: string;
}

export function rentReceivedTemplate(data: RentReceivedData): string {
  const formattedAmount = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(data.amount);

  const content = `
    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #16a34a; margin: 0 0 10px 0;">Rent Received</h2>
      <p style="font-size: 24px; font-weight: bold; margin: 0;">${formattedAmount}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Property</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.propertyAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.date}</td>
      </tr>
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/transactions?highlight=${data.transactionId}"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Transaction
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function rentReceivedSubject(data: RentReceivedData): string {
  const formattedAmount = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(data.amount);

  return `Rent received: ${formattedAmount} from ${data.propertyAddress}`;
}
```

**Step 3: Create weekly digest template**

Create `/src/lib/email/templates/weekly-digest.ts`:

```typescript
import { baseTemplate } from "./base";

interface WeeklyDigestData {
  weekStart: string;
  weekEnd: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  propertyCount: number;
  alertCount: number;
  properties: Array<{
    address: string;
    income: number;
    expenses: number;
  }>;
}

export function weeklyDigestTemplate(data: WeeklyDigestData): string {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(value);

  const netColor = data.netCashFlow >= 0 ? "#16a34a" : "#dc2626";

  const propertyRows = data.properties
    .map(
      (p) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${p.address}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #16a34a;">${formatCurrency(p.income)}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #dc2626;">${formatCurrency(p.expenses)}</td>
      </tr>
    `
    )
    .join("");

  const content = `
    <h2 style="margin: 0 0 5px 0;">Weekly Portfolio Summary</h2>
    <p style="color: #666; margin: 0 0 20px 0;">${data.weekStart} - ${data.weekEnd}</p>

    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 12px;">Income</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #16a34a;">${formatCurrency(data.totalIncome)}</p>
      </div>
      <div style="flex: 1; background: #fef2f2; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 12px;">Expenses</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #dc2626;">${formatCurrency(data.totalExpenses)}</p>
      </div>
      <div style="flex: 1; background: #f0f9ff; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 12px;">Net</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: ${netColor};">${formatCurrency(data.netCashFlow)}</p>
      </div>
    </div>

    ${data.alertCount > 0 ? `
    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <p style="margin: 0; color: #92400e;">
        <strong>${data.alertCount} alert${data.alertCount > 1 ? "s" : ""}</strong> require your attention.
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts" style="color: #92400e;">View alerts</a>
      </p>
    </div>
    ` : ""}

    <h3 style="margin: 20px 0 10px 0;">By Property</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f9fafb;">
        <th style="padding: 10px; text-align: left; font-weight: 500;">Property</th>
        <th style="padding: 10px; text-align: right; font-weight: 500;">Income</th>
        <th style="padding: 10px; text-align: right; font-weight: 500;">Expenses</th>
      </tr>
      ${propertyRows}
    </table>

    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Dashboard
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function weeklyDigestSubject(): string {
  return "Your weekly portfolio summary";
}
```

**Step 4: Commit**

```bash
git add src/lib/email/templates/
git commit -m "feat(notification): add email templates for rent received and weekly digest"
```

---

## Task 8: Notification Settings Page

**Files:**
- Create: `/src/app/(dashboard)/settings/notifications/page.tsx`

**Step 1: Create the settings page**

Create `/src/app/(dashboard)/settings/notifications/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Mail, Smartphone, Check, X } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { formatDistanceToNow } from "date-fns";

export default function NotificationSettingsPage() {
  const utils = trpc.useUtils();
  const { status: pushStatus, subscribe, unsubscribe, isSupported } = usePushSubscription();

  const { data: preferences, isLoading } = trpc.notification.getPreferences.useQuery();
  const { data: history } = trpc.notification.getHistory.useQuery({ limit: 10 });

  const updateMutation = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notification.getPreferences.invalidate();
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleQuietHoursChange = (field: "quietHoursStart" | "quietHoursEnd", value: string) => {
    updateMutation.mutate({ [field]: value });
  };

  if (isLoading || !preferences) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Notification Settings</h2>
          <p className="text-muted-foreground">Manage how you receive notifications</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Notification Settings</h2>
        <p className="text-muted-foreground">Manage how you receive notifications</p>
      </div>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Smartphone className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  {pushStatus === "subscribed" && "Enabled"}
                  {pushStatus === "prompt" && "Click to enable"}
                  {pushStatus === "denied" && "Blocked by browser"}
                  {pushStatus === "unsupported" && "Not supported"}
                  {pushStatus === "loading" && "Loading..."}
                </p>
              </div>
            </div>
            {isSupported && pushStatus !== "denied" && (
              <Button
                variant={pushStatus === "subscribed" ? "outline" : "default"}
                size="sm"
                onClick={() => pushStatus === "subscribed" ? unsubscribe() : subscribe()}
              >
                {pushStatus === "subscribed" ? "Disable" : "Enable"}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Mail className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  {preferences.emailEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            <Button
              variant={preferences.emailEnabled ? "outline" : "default"}
              size="sm"
              onClick={() => handleToggle("emailEnabled", !preferences.emailEnabled)}
            >
              {preferences.emailEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notify Me About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { key: "rentReceived", label: "Rent received", description: "When rental income is detected" },
              { key: "syncFailed", label: "Bank sync failed", description: "When bank connection needs attention" },
              { key: "anomalyDetected", label: "Anomalies detected", description: "Unusual transactions or missed rent" },
              { key: "weeklyDigest", label: "Weekly digest", description: "Sunday morning portfolio summary" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <Label>{item.label}</Label>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(item.key, !preferences[item.key as keyof typeof preferences])}
                >
                  {preferences[item.key as keyof typeof preferences] ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quiet Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Push notifications won't be sent during these hours
          </p>
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="quietStart">From</Label>
              <Input
                id="quietStart"
                type="time"
                value={preferences.quietHoursStart}
                onChange={(e) => handleQuietHoursChange("quietHoursStart", e.target.value)}
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="quietEnd">To</Label>
              <Input
                id="quietEnd"
                type="time"
                value={preferences.quietHoursEnd}
                onChange={(e) => handleQuietHoursChange("quietHoursEnd", e.target.value)}
                className="w-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {entry.channel === "email" ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="capitalize">{entry.type.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.sentAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add "src/app/(dashboard)/settings/notifications/page.tsx"
git commit -m "feat(ui): add notification settings page"
```

---

## Task 9: Weekly Digest Cron Job

**Files:**
- Create: `/src/app/api/cron/weekly-digest/route.ts`

**Step 1: Create the cron endpoint**

Create `/src/app/api/cron/weekly-digest/route.ts`:

```typescript
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

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        console.error(`Failed to send digest to user ${user.userId}:`, error);
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
    console.error("Weekly digest cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/weekly-digest/route.ts
git commit -m "feat(notification): add weekly digest cron job"
```

---

## Task 10: Integration - Trigger Notifications

**Files:**
- Modify: `/src/server/services/anomaly.ts`
- Modify: `/src/server/routers/banking.ts`

**Step 1: Read existing files to understand structure**

Read the anomaly service and banking router to understand how to integrate notification triggers.

**Step 2: Create notification trigger helper**

Add to `/src/server/services/notification.ts`:

```typescript
import { db } from "@/server/db";
import { notificationPreferences, pushSubscriptions, notificationLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";

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
```

**Step 3: Update anomaly service to trigger notifications**

The anomaly alerts are created in the banking router after bank sync. Add notification trigger after alert creation.

**Step 4: Commit**

```bash
git add src/server/services/notification.ts src/server/routers/banking.ts
git commit -m "feat(notification): integrate notification triggers with anomaly detection"
```

---

## Task 11: Push Permission Banner

**Files:**
- Create: `/src/components/notifications/PushPermissionBanner.tsx`
- Modify: `/src/components/dashboard/DashboardClient.tsx`

**Step 1: Create the banner component**

Create `/src/components/notifications/PushPermissionBanner.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, X } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const BANNER_DISMISSED_KEY = "push-banner-dismissed";
const VISIT_COUNT_KEY = "dashboard-visit-count";
const MIN_VISITS_BEFORE_PROMPT = 3;

export function PushPermissionBanner() {
  const [show, setShow] = useState(false);
  const { status, subscribe, isSupported } = usePushSubscription();

  useEffect(() => {
    // Don't show if not supported or already subscribed/denied
    if (!isSupported || status === "subscribed" || status === "denied") {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 30) return;
    }

    // Track visit count
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    // Show after minimum visits
    if (visitCount >= MIN_VISITS_BEFORE_PROMPT) {
      setShow(true);
    }
  }, [isSupported, status]);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, new Date().toISOString());
    setShow(false);
  };

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 mb-6">
      <div className="p-4 flex items-center gap-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full">
          <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Get notified when rent arrives</p>
          <p className="text-sm text-muted-foreground">
            Enable push notifications to stay updated on your portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Not now
          </Button>
          <Button size="sm" onClick={handleEnable}>
            Enable
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
```

**Step 2: Add banner to DashboardClient**

Import and add `<PushPermissionBanner />` at the top of the dashboard content.

**Step 3: Commit**

```bash
git add src/components/notifications/PushPermissionBanner.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat(ui): add push notification permission banner to dashboard"
```

---

## Task 12: Final Integration and Testing

**Files:**
- Modify: `/src/components/layout/Sidebar.tsx` (add Settings link if needed)

**Step 1: Verify all tests pass**

Run: `npm run test:unit`

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Add settings link to sidebar if not present**

Check Sidebar.tsx and ensure there's a link to `/settings/notifications` (either under a Settings group or standalone).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete push notifications implementation"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | schema.ts | Database tables for preferences, subscriptions, log |
| 2 | package.json | Install web-push and resend |
| 3 | notification.ts, notification.test.ts | Core service with quiet hours logic |
| 4 | notification.ts (router), _app.ts | Preferences and subscription CRUD |
| 5 | sw.js | Service worker for browser push |
| 6 | usePushSubscription.ts | Client-side push management hook |
| 7 | email/templates/*.ts | Email templates for notifications |
| 8 | settings/notifications/page.tsx | User preferences UI |
| 9 | cron/weekly-digest/route.ts | Sunday digest cron job |
| 10 | notification.ts, banking.ts | Trigger notifications from events |
| 11 | PushPermissionBanner.tsx, DashboardClient.tsx | Dashboard permission prompt |
| 12 | Sidebar.tsx | Final integration and testing |

## Environment Variables Required

```
VAPID_PUBLIC_KEY=     # Generate with: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=    # Generate with: npx web-push generate-vapid-keys
VAPID_SUBJECT=mailto:support@propertytracker.com
RESEND_API_KEY=       # From Resend dashboard
EMAIL_FROM=PropertyTracker <notifications@propertytracker.com>
```
