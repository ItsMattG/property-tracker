# Equity Milestone Notifications - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Notify users when properties hit equity milestones (LVR thresholds: 80/60/40/20% or equity amounts: $100k/$250k/$500k/$1M).

**Architecture:** New `equity_milestones` table tracks achieved milestones. Daily cron calculates equity/LVR for all properties, detects new milestones, records them, and sends push+email notifications.

**Tech Stack:** Drizzle ORM, Next.js API routes, existing notification service.

---

### Task 1: Add Database Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add enum after line ~295 (after privacyModeEnum)**

```typescript
export const milestoneTypeEnum = pgEnum("milestone_type", [
  "lvr",
  "equity_amount",
]);
```

**Step 2: Add table after the enums section**

```typescript
export const equityMilestones = pgTable(
  "equity_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    milestoneType: milestoneTypeEnum("milestone_type").notNull(),
    milestoneValue: decimal("milestone_value", { precision: 12, scale: 2 }).notNull(),
    equityAtAchievement: decimal("equity_at_achievement", { precision: 12, scale: 2 }).notNull(),
    lvrAtAchievement: decimal("lvr_at_achievement", { precision: 5, scale: 2 }).notNull(),
    achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  },
  (table) => [
    index("equity_milestones_property_id_idx").on(table.propertyId),
    index("equity_milestones_user_id_idx").on(table.userId),
  ]
);
```

**Step 3: Run migration**

```bash
npm run db:generate
npm run db:migrate
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add equity_milestones schema"
```

---

### Task 2: Add Milestone Config

**Files:**
- Create: `src/lib/equity-milestones.ts`

**Step 1: Create the config file**

```typescript
export const LVR_MILESTONES = [80, 60, 40, 20] as const;
export const EQUITY_MILESTONES = [100000, 250000, 500000, 1000000] as const;

export function formatMilestone(type: "lvr" | "equity_amount", value: number): string {
  if (type === "lvr") {
    return `${value}% LVR`;
  }
  return `$${(value / 1000).toLocaleString()}k equity`;
}

export function getMilestoneMessage(
  type: "lvr" | "equity_amount",
  value: number,
  address: string,
  currentEquityPercent: number
): { title: string; body: string } {
  if (type === "lvr") {
    return {
      title: `Milestone reached: ${value}% LVR`,
      body: `${address} has reached ${value}% LVR - you now have ${Math.round(100 - value)}% equity!`,
    };
  }
  return {
    title: `Milestone reached: $${(value / 1000).toLocaleString()}k equity`,
    body: `Congratulations! ${address} has crossed $${value.toLocaleString()} in equity!`,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/equity-milestones.ts && git commit -m "feat: add equity milestone config"
```

---

### Task 3: Create Cron Endpoint

**Files:**
- Create: `src/app/api/cron/equity-milestones/route.ts`

**Step 1: Create the cron route**

```typescript
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
} from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { sendPushNotification, sendEmailNotification, isQuietHours } from "@/server/services/notification";
import { LVR_MILESTONES, EQUITY_MILESTONES, getMilestoneMessage } from "@/lib/equity-milestones";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let newMilestones = 0;
    let notificationsSent = 0;

    // Get all active properties with their latest values and loans
    const propertiesWithData = await db
      .select({
        property: properties,
        user: users,
      })
      .from(properties)
      .innerJoin(users, eq(properties.userId, users.id))
      .where(eq(properties.status, "active"));

    for (const { property, user } of propertiesWithData) {
      // Get latest property value
      const latestValue = await db.query.propertyValues.findFirst({
        where: eq(propertyValues.propertyId, property.id),
        orderBy: [desc(propertyValues.valueDate)],
      });

      if (!latestValue) continue;

      // Get total loan balance for this property
      const loanResult = await db
        .select({ total: sql<string>`COALESCE(SUM(current_balance), 0)` })
        .from(loans)
        .where(eq(loans.propertyId, property.id));

      const totalLoanBalance = Number(loanResult[0]?.total || 0);
      const estimatedValue = Number(latestValue.estimatedValue);

      if (estimatedValue <= 0) continue;

      const equity = estimatedValue - totalLoanBalance;
      const lvr = (totalLoanBalance / estimatedValue) * 100;

      // Get existing milestones for this property
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

      const milestonesToRecord: Array<{
        type: "lvr" | "equity_amount";
        value: number;
      }> = [];

      // Check LVR milestones (milestone hit when LVR drops BELOW threshold)
      for (const threshold of LVR_MILESTONES) {
        if (lvr <= threshold && !existingLvrMilestones.has(threshold)) {
          milestonesToRecord.push({ type: "lvr", value: threshold });
        }
      }

      // Check equity milestones (milestone hit when equity rises ABOVE threshold)
      for (const threshold of EQUITY_MILESTONES) {
        if (equity >= threshold && !existingEquityMilestones.has(threshold)) {
          milestonesToRecord.push({ type: "equity_amount", value: threshold });
        }
      }

      if (milestonesToRecord.length === 0) continue;

      // Get user notification preferences
      const prefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, user.id),
      });

      for (const milestone of milestonesToRecord) {
        // Record the milestone
        await db.insert(equityMilestones).values({
          propertyId: property.id,
          userId: user.id,
          milestoneType: milestone.type,
          milestoneValue: String(milestone.value),
          equityAtAchievement: String(equity),
          lvrAtAchievement: String(lvr),
        });
        newMilestones++;

        // Send notifications if enabled
        if (!prefs) continue;

        const { title, body } = getMilestoneMessage(
          milestone.type,
          milestone.value,
          property.address,
          100 - lvr
        );
        const url = `/properties/${property.id}`;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";

        // Check quiet hours
        const now = new Date();
        const inQuietHours = isQuietHours(
          prefs.quietHoursStart,
          prefs.quietHoursEnd,
          now.getHours(),
          now.getMinutes()
        );

        // Send push notification
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

        // Send email notification
        if (prefs.emailEnabled) {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">🎉 ${title}</h2>
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
    console.error("Equity milestones cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/cron/equity-milestones/route.ts && git commit -m "feat: add equity milestones cron endpoint"
```

---

### Task 4: Add notification_type to enum

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add 'equity_milestone' to notificationTypeEnum (around line 159)**

Find:
```typescript
export const notificationTypeEnum = pgEnum("notification_type", [
```

Add `"equity_milestone"` to the array.

**Step 2: Run migration**

```bash
npm run db:generate
npm run db:migrate
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add equity_milestone notification type"
```

---

### Task 5: Add Milestones UI to Property Page

**Files:**
- Create: `src/components/properties/MilestonesSection.tsx`
- Modify: Property detail page to include the section

**Step 1: Create MilestonesSection component**

```typescript
"use client";

import { format } from "date-fns";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMilestone } from "@/lib/equity-milestones";

interface Milestone {
  id: string;
  milestoneType: "lvr" | "equity_amount";
  milestoneValue: string;
  equityAtAchievement: string;
  lvrAtAchievement: string;
  achievedAt: Date;
}

interface MilestonesSectionProps {
  milestones: Milestone[];
}

export function MilestonesSection({ milestones }: MilestonesSectionProps) {
  if (milestones.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Milestones Achieved
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="flex justify-between items-center">
              <span className="font-medium">
                {formatMilestone(milestone.milestoneType, Number(milestone.milestoneValue))}
              </span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(milestone.achievedAt), "dd MMM yyyy")}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add tRPC procedure to fetch milestones**

Add to property router (`src/server/routers/property.ts`):

```typescript
getMilestones: protectedProcedure
  .input(z.object({ propertyId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    return await ctx.db.query.equityMilestones.findMany({
      where: and(
        eq(equityMilestones.propertyId, input.propertyId),
        eq(equityMilestones.userId, ctx.session.user.id)
      ),
      orderBy: [desc(equityMilestones.achievedAt)],
    });
  }),
```

**Step 3: Add MilestonesSection to property detail page**

Find property detail page and add the component, fetching milestones via the new tRPC procedure.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add milestones UI to property page"
```

---

### Task 6: Final Verification

**Step 1: Run all tests**

```bash
npm test
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Run lint**

```bash
npm run lint
```

**Step 4: Fix any issues found**

**Step 5: Final commit if needed**

```bash
git add -A && git commit -m "fix: resolve any remaining issues"
```
