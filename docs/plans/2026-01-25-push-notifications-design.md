# Push Notifications Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Push and email notifications for property investment events. Users receive alerts when rent arrives, bank sync fails, anomalies are detected, and weekly portfolio digests.

---

## Data Model

```sql
notificationPreferences
- id (uuid, pk)
- userId (uuid, fk → users, unique)
- emailEnabled (boolean, default true)
- pushEnabled (boolean, default true)
- rentReceived (boolean, default true)
- syncFailed (boolean, default true)
- anomalyDetected (boolean, default true)
- weeklyDigest (boolean, default true)
- quietHoursStart (time, default 21:00)
- quietHoursEnd (time, default 08:00)
- createdAt, updatedAt

pushSubscriptions
- id (uuid, pk)
- userId (uuid, fk → users)
- endpoint (text) - Web Push endpoint URL
- p256dh (text) - Public key
- auth (text) - Auth secret
- userAgent (text) - Browser info
- createdAt

notificationLog
- id (uuid, pk)
- userId (uuid, fk → users)
- type (enum: rent_received, sync_failed, anomaly_critical, anomaly_warning, weekly_digest)
- channel (enum: email, push)
- status (enum: sent, failed, skipped_quiet_hours)
- metadata (jsonb) - propertyId, amount, alertId, etc.
- sentAt
```

**Key decisions:**
- One preferences row per user (created on first login)
- Multiple push subscriptions per user (different browsers/devices)
- Log all notification attempts for debugging and history

---

## Notification Triggers

| Event | Trigger Point | Channel | Default |
|-------|---------------|---------|---------|
| Rent received | Bank sync detects income matching recurring rent | Push + Email | On |
| Bank sync failed | Cron job detects no sync in 24+ hours | Email only | On |
| Anomaly (critical) | Anomaly service creates critical alert | Push | On |
| Anomaly (warning) | Anomaly service creates warning alert | Push | Off |
| Weekly digest | Sunday 9am AEST cron job | Email only | On |

---

## Service Layer

### Notification Service (`/src/server/services/notification.ts`)

```typescript
// Core functions
sendNotification(userId, type, data) → Promise<void>
  - Checks user preferences
  - Respects quiet hours (skip push, queue email)
  - Sends via appropriate channel(s)
  - Logs attempt

sendPushNotification(subscription, payload) → Promise<boolean>
sendEmailNotification(email, template, data) → Promise<boolean>

// Helpers
shouldSendNotification(prefs, type, channel) → boolean
isQuietHours(prefs) → boolean
```

### Integration Points
- `banking.ts` router: Call notification service after detecting rent income
- `anomaly.ts` service: Call notification service when creating alerts
- New cron `/api/cron/weekly-digest`: Generate and send digest emails
- Existing cron `/api/cron/sync-banks`: Check for stale connections, notify

---

## Web Push Implementation

**How it works:**
1. Browser requests permission → user accepts
2. Browser generates subscription (endpoint URL + keys)
3. Store subscription in `pushSubscriptions` table
4. When sending: use Web Push protocol to POST to browser's endpoint
5. Service worker receives push event, shows native notification

**Server-side (using `web-push` npm package):**

```typescript
// Environment variables
VAPID_PUBLIC_KEY   // Public key (shared with frontend)
VAPID_PRIVATE_KEY  // Private key (server only)
VAPID_SUBJECT      // mailto:support@propertytracker.com

// Send push
webpush.sendNotification(subscription, JSON.stringify({
  title: "Rent Received",
  body: "$2,400 from 123 Main St",
  icon: "/icon-192.png",
  data: { url: "/transactions?highlight=xxx" }
}))
```

**Client-side:**
- Service worker at `/public/sw.js` handles `push` and `notificationclick` events
- React hook `usePushSubscription()` manages permission request and subscription
- Settings page shows subscription status and test button

**Permission flow:**
- Don't prompt immediately on first visit
- Show banner on dashboard after 3rd visit: "Enable notifications to know when rent arrives"
- User clicks → browser permission prompt
- If granted, register subscription with server

---

## Email Implementation

**Setup:**
- `resend` npm package
- Environment variable: `RESEND_API_KEY`
- Sender: `notifications@propertytracker.com`

**Email templates:**

| Template | Subject | Content |
|----------|---------|---------|
| `rent-received` | "Rent received: $2,400 from 123 Main St" | Amount, property, date, link |
| `sync-failed` | "Bank connection needs attention" | Which bank, last sync, reconnect link |
| `anomaly-alert` | "Alert: Unusual transaction detected" | Description, amount, property, view link |
| `weekly-digest` | "Your weekly portfolio summary" | Income/expenses, property breakdown, alerts, forecast |

**Weekly digest cron (`/api/cron/weekly-digest`):**
- Runs Sunday 9am AEST
- Queries each user's last 7 days: income, expenses, net, alerts
- Sends personalized digest to users with `weeklyDigest: true`

---

## UI Design

### Settings Page (`/settings/notifications`)

- Push toggle with status (enabled/disabled, browser info)
- Email toggle
- Per-notification-type matrix (push/email checkboxes)
- Quiet hours time pickers
- Recent notifications log
- Test notification button

### Permission Banner (Dashboard)

- Shows after 3rd visit if push not enabled
- "Get notified when rent arrives" with Enable/Dismiss buttons
- Dismissing hides for 30 days (localStorage)

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add 3 tables + enums |
| `/src/server/services/notification.ts` | Core notification logic |
| `/src/server/routers/notification.ts` | Preferences CRUD, subscription management |
| `/src/lib/email/templates/*.tsx` | Email templates (4) |
| `/src/app/api/cron/weekly-digest/route.ts` | Sunday digest cron |
| `/public/sw.js` | Service worker for push |
| `/src/app/(dashboard)/settings/notifications/page.tsx` | Settings page |
| `/src/components/notifications/PushPermissionBanner.tsx` | Dashboard banner |
| `/src/hooks/usePushSubscription.ts` | Push subscription hook |

### Modified Files

| File | Change |
|------|--------|
| `/src/server/routers/_app.ts` | Register notification router |
| `/src/server/routers/banking.ts` | Trigger rent received notification |
| `/src/server/services/anomaly.ts` | Trigger anomaly notifications |
| `/src/app/api/cron/sync-banks/route.ts` | Trigger sync failed notification |
| `/src/app/(dashboard)/page.tsx` | Add permission banner |
| `package.json` | Add `resend`, `web-push` |

---

## Dependencies

- `resend` - Email API client
- `web-push` - Web Push protocol implementation
