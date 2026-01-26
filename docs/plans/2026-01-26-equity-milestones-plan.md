# Equity Milestone Notifications - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add customizable equity milestone notifications with global user preferences and per-property overrides.

**Architecture:** Two new tables (`milestone_preferences`, `property_milestone_overrides`) store user settings. Cron job resolves thresholds using property override → global preference → system defaults chain. Settings UI on notifications page, per-property overrides on property detail.

**Tech Stack:** Drizzle ORM, tRPC, React, shadcn/ui components

---

### Task 1: Add Database Schema for Preferences

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add milestone_preferences table after equityMilestones (around line 2012)**

```typescript
export const milestonePreferences = pgTable("milestone_preferences", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .primaryKey(),
  lvrThresholds: jsonb("lvr_thresholds").$type<number[]>().default([80, 60, 40, 20]).notNull(),
  equityThresholds: jsonb("equity_thresholds").$type<number[]>().default([100000, 250000, 500000, 1000000]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 2: Add property_milestone_overrides table after milestonePreferences**

```typescript
export const propertyMilestoneOverrides = pgTable("property_milestone_overrides", {
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .primaryKey(),
  lvrThresholds: jsonb("lvr_thresholds").$type<number[] | null>(),
  equityThresholds: jsonb("equity_thresholds").$type<number[] | null>(),
  enabled: boolean("enabled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 3: Add relations after existing relations**

```typescript
export const milestonePreferencesRelations = relations(milestonePreferences, ({ one }) => ({
  user: one(users, {
    fields: [milestonePreferences.userId],
    references: [users.id],
  }),
}));

export const propertyMilestoneOverridesRelations = relations(propertyMilestoneOverrides, ({ one }) => ({
  property: one(properties, {
    fields: [propertyMilestoneOverrides.propertyId],
    references: [properties.id],
  }),
}));
```

**Step 4: Add type exports at end of file**

```typescript
export type MilestonePreferences = typeof milestonePreferences.$inferSelect;
export type NewMilestonePreferences = typeof milestonePreferences.$inferInsert;
export type PropertyMilestoneOverride = typeof propertyMilestoneOverrides.$inferSelect;
export type NewPropertyMilestoneOverride = typeof propertyMilestoneOverrides.$inferInsert;
```

**Step 5: Run migration**

```bash
npm run db:generate && npm run db:migrate
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add milestone preferences schema"
```

---

### Task 2: Create Milestone Preferences Service

**Files:**
- Create: `src/server/services/milestone-preferences.ts`
- Test: `src/server/services/__tests__/milestone-preferences.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveThresholds,
  DEFAULT_LVR_THRESHOLDS,
  DEFAULT_EQUITY_THRESHOLDS,
} from "../milestone-preferences";

describe("milestone-preferences", () => {
  describe("resolveThresholds", () => {
    it("returns system defaults when no preferences exist", () => {
      const result = resolveThresholds(null, null);
      expect(result).toEqual({
        lvrThresholds: DEFAULT_LVR_THRESHOLDS,
        equityThresholds: DEFAULT_EQUITY_THRESHOLDS,
        enabled: true,
      });
    });

    it("returns global preferences when no override exists", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60],
        equityThresholds: [100000, 500000],
        enabled: true,
      };
      const result = resolveThresholds(globalPrefs, null);
      expect(result).toEqual(globalPrefs);
    });

    it("returns property override when it exists", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60],
        equityThresholds: [100000, 500000],
        enabled: true,
      };
      const override = {
        lvrThresholds: [40, 20],
        equityThresholds: null,
        enabled: false,
      };
      const result = resolveThresholds(globalPrefs, override);
      expect(result).toEqual({
        lvrThresholds: [40, 20],
        equityThresholds: [100000, 500000], // from global
        enabled: false,
      });
    });

    it("handles disabled at global level", () => {
      const globalPrefs = {
        lvrThresholds: [80, 60],
        equityThresholds: [100000],
        enabled: false,
      };
      const result = resolveThresholds(globalPrefs, null);
      expect(result.enabled).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/services/__tests__/milestone-preferences.test.ts
```

Expected: FAIL with module not found

**Step 3: Write the service**

```typescript
export const DEFAULT_LVR_THRESHOLDS = [80, 60, 40, 20] as const;
export const DEFAULT_EQUITY_THRESHOLDS = [100000, 250000, 500000, 1000000] as const;

export interface ThresholdConfig {
  lvrThresholds: number[];
  equityThresholds: number[];
  enabled: boolean;
}

export interface GlobalPrefs {
  lvrThresholds: number[];
  equityThresholds: number[];
  enabled: boolean;
}

export interface PropertyOverride {
  lvrThresholds: number[] | null;
  equityThresholds: number[] | null;
  enabled: boolean | null;
}

export function resolveThresholds(
  globalPrefs: GlobalPrefs | null,
  propertyOverride: PropertyOverride | null
): ThresholdConfig {
  // Start with system defaults
  let config: ThresholdConfig = {
    lvrThresholds: [...DEFAULT_LVR_THRESHOLDS],
    equityThresholds: [...DEFAULT_EQUITY_THRESHOLDS],
    enabled: true,
  };

  // Apply global preferences
  if (globalPrefs) {
    config = {
      lvrThresholds: globalPrefs.lvrThresholds,
      equityThresholds: globalPrefs.equityThresholds,
      enabled: globalPrefs.enabled,
    };
  }

  // Apply property overrides (null means inherit)
  if (propertyOverride) {
    if (propertyOverride.lvrThresholds !== null) {
      config.lvrThresholds = propertyOverride.lvrThresholds;
    }
    if (propertyOverride.equityThresholds !== null) {
      config.equityThresholds = propertyOverride.equityThresholds;
    }
    if (propertyOverride.enabled !== null) {
      config.enabled = propertyOverride.enabled;
    }
  }

  return config;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/server/services/__tests__/milestone-preferences.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add milestone preferences service with resolution logic"
```

---

### Task 3: Create tRPC Router for Milestone Preferences

**Files:**
- Create: `src/server/routers/milestonePreferences.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

```typescript
import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { milestonePreferences, propertyMilestoneOverrides } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_LVR_THRESHOLDS,
  DEFAULT_EQUITY_THRESHOLDS,
} from "../services/milestone-preferences";

export const milestonePreferencesRouter = router({
  getGlobal: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.query.milestonePreferences.findFirst({
      where: eq(milestonePreferences.userId, ctx.session.user.id),
    });

    return prefs ?? {
      userId: ctx.session.user.id,
      lvrThresholds: [...DEFAULT_LVR_THRESHOLDS],
      equityThresholds: [...DEFAULT_EQUITY_THRESHOLDS],
      enabled: true,
    };
  }),

  updateGlobal: writeProcedure
    .input(
      z.object({
        lvrThresholds: z.array(z.number().min(0).max(100)).optional(),
        equityThresholds: z.array(z.number().min(0)).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.milestonePreferences.findFirst({
        where: eq(milestonePreferences.userId, ctx.session.user.id),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(milestonePreferences)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(milestonePreferences.userId, ctx.session.user.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(milestonePreferences)
        .values({
          userId: ctx.session.user.id,
          lvrThresholds: input.lvrThresholds ?? [...DEFAULT_LVR_THRESHOLDS],
          equityThresholds: input.equityThresholds ?? [...DEFAULT_EQUITY_THRESHOLDS],
          enabled: input.enabled ?? true,
        })
        .returning();
      return created;
    }),

  getPropertyOverride: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.propertyMilestoneOverrides.findFirst({
        where: eq(propertyMilestoneOverrides.propertyId, input.propertyId),
      });
    }),

  updatePropertyOverride: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        lvrThresholds: z.array(z.number().min(0).max(100)).nullable().optional(),
        equityThresholds: z.array(z.number().min(0)).nullable().optional(),
        enabled: z.boolean().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, ...data } = input;

      const existing = await ctx.db.query.propertyMilestoneOverrides.findFirst({
        where: eq(propertyMilestoneOverrides.propertyId, propertyId),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(propertyMilestoneOverrides)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(propertyMilestoneOverrides.propertyId, propertyId))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(propertyMilestoneOverrides)
        .values({
          propertyId,
          lvrThresholds: data.lvrThresholds ?? null,
          equityThresholds: data.equityThresholds ?? null,
          enabled: data.enabled ?? null,
        })
        .returning();
      return created;
    }),

  deletePropertyOverride: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(propertyMilestoneOverrides)
        .where(eq(propertyMilestoneOverrides.propertyId, input.propertyId));
      return { success: true };
    }),
});
```

**Step 2: Register router in _app.ts**

Find the router imports section and add:
```typescript
import { milestonePreferencesRouter } from "./milestonePreferences";
```

Find the appRouter definition and add:
```typescript
milestonePreferences: milestonePreferencesRouter,
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add milestone preferences tRPC router"
```

---

### Task 4: Update Cron Job to Use Preferences

**Files:**
- Modify: `src/app/api/cron/equity-milestones/route.ts`

**Step 1: Update imports**

Add at top:
```typescript
import { milestonePreferences, propertyMilestoneOverrides } from "@/server/db/schema";
import { resolveThresholds } from "@/server/services/milestone-preferences";
```

**Step 2: Replace hardcoded thresholds with resolved thresholds**

Replace the section that gets thresholds (around lines 74-84) with:

```typescript
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
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: update cron to use customizable milestone thresholds"
```

---

### Task 5: Add Milestones Section to Notification Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/notifications/page.tsx`

**Step 1: Add imports at top**

```typescript
import { useState } from "react";
import { TrendingUp, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
```

**Step 2: Add queries for milestone preferences**

After existing queries:
```typescript
  const { data: milestonePrefs } = trpc.milestonePreferences.getGlobal.useQuery();
  const updateMilestoneMutation = trpc.milestonePreferences.updateGlobal.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getGlobal.invalidate();
    },
  });
```

**Step 3: Add threshold toggle helpers**

After handleQuietHoursChange:
```typescript
  const toggleLvrThreshold = (threshold: number) => {
    if (!milestonePrefs) return;
    const current = milestonePrefs.lvrThresholds as number[];
    const newThresholds = current.includes(threshold)
      ? current.filter((t) => t !== threshold)
      : [...current, threshold].sort((a, b) => b - a);
    updateMilestoneMutation.mutate({ lvrThresholds: newThresholds });
  };

  const toggleEquityThreshold = (threshold: number) => {
    if (!milestonePrefs) return;
    const current = milestonePrefs.equityThresholds as number[];
    const newThresholds = current.includes(threshold)
      ? current.filter((t) => t !== threshold)
      : [...current, threshold].sort((a, b) => a - b);
    updateMilestoneMutation.mutate({ equityThresholds: newThresholds });
  };

  const formatEquityThreshold = (value: number) => {
    return value >= 1000000 ? `$${value / 1000000}M` : `$${value / 1000}k`;
  };
```

**Step 4: Add Milestones card after Quiet Hours card**

```typescript
      {/* Equity Milestones */}
      {milestonePrefs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Equity Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable milestone notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when properties hit equity milestones
                </p>
              </div>
              <Button
                variant={milestonePrefs.enabled ? "outline" : "default"}
                size="sm"
                onClick={() => updateMilestoneMutation.mutate({ enabled: !milestonePrefs.enabled })}
              >
                {milestonePrefs.enabled ? "Disable" : "Enable"}
              </Button>
            </div>

            {milestonePrefs.enabled && (
              <>
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4" />
                    LVR Thresholds
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Notify when LVR drops below these levels
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[80, 60, 40, 20].map((threshold) => (
                      <Badge
                        key={threshold}
                        variant={(milestonePrefs.lvrThresholds as number[]).includes(threshold) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleLvrThreshold(threshold)}
                      >
                        {threshold}%
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4" />
                    Equity Thresholds
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Notify when equity rises above these amounts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[100000, 250000, 500000, 1000000].map((threshold) => (
                      <Badge
                        key={threshold}
                        variant={(milestonePrefs.equityThresholds as number[]).includes(threshold) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleEquityThreshold(threshold)}
                      >
                        {formatEquityThreshold(threshold)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
```

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add milestone threshold settings to notifications page"
```

---

### Task 6: Add Milestones Section to Property Detail

**Files:**
- Create: `src/components/properties/MilestonesCard.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trophy, Settings2, Target, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatMilestone } from "@/lib/equity-milestones";

interface MilestonesCardProps {
  propertyId: string;
}

export function MilestonesCard({ propertyId }: MilestonesCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const utils = trpc.useUtils();

  const { data: milestones } = trpc.property.getMilestones.useQuery({ propertyId });
  const { data: globalPrefs } = trpc.milestonePreferences.getGlobal.useQuery();
  const { data: override } = trpc.milestonePreferences.getPropertyOverride.useQuery({ propertyId });

  const updateOverrideMutation = trpc.milestonePreferences.updatePropertyOverride.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getPropertyOverride.invalidate({ propertyId });
    },
  });

  const deleteOverrideMutation = trpc.milestonePreferences.deletePropertyOverride.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getPropertyOverride.invalidate({ propertyId });
    },
  });

  const hasOverride = override !== null && override !== undefined;
  const isEnabled = hasOverride && override.enabled !== null ? override.enabled : (globalPrefs?.enabled ?? true);

  const currentLvrThresholds = hasOverride && override.lvrThresholds
    ? (override.lvrThresholds as number[])
    : (globalPrefs?.lvrThresholds as number[] ?? [80, 60, 40, 20]);

  const currentEquityThresholds = hasOverride && override.equityThresholds
    ? (override.equityThresholds as number[])
    : (globalPrefs?.equityThresholds as number[] ?? [100000, 250000, 500000, 1000000]);

  const toggleOverride = (useGlobal: boolean) => {
    if (useGlobal) {
      deleteOverrideMutation.mutate({ propertyId });
    } else {
      updateOverrideMutation.mutate({
        propertyId,
        lvrThresholds: null,
        equityThresholds: null,
        enabled: null,
      });
    }
  };

  const toggleEnabled = () => {
    updateOverrideMutation.mutate({
      propertyId,
      enabled: !isEnabled,
    });
  };

  const toggleLvrThreshold = (threshold: number) => {
    const newThresholds = currentLvrThresholds.includes(threshold)
      ? currentLvrThresholds.filter((t) => t !== threshold)
      : [...currentLvrThresholds, threshold].sort((a, b) => b - a);
    updateOverrideMutation.mutate({
      propertyId,
      lvrThresholds: newThresholds,
    });
  };

  const toggleEquityThreshold = (threshold: number) => {
    const newThresholds = currentEquityThresholds.includes(threshold)
      ? currentEquityThresholds.filter((t) => t !== threshold)
      : [...currentEquityThresholds, threshold].sort((a, b) => a - b);
    updateOverrideMutation.mutate({
      propertyId,
      equityThresholds: newThresholds,
    });
  };

  const formatEquity = (value: number) => {
    return value >= 1000000 ? `$${value / 1000000}M` : `$${value / 1000}k`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Milestones
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Achieved milestones */}
        {milestones && milestones.length > 0 ? (
          <ul className="space-y-2">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex justify-between items-center text-sm">
                <span className="font-medium">
                  {formatMilestone(milestone.milestoneType, Number(milestone.milestoneValue))}
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(milestone.achievedAt), "dd MMM yyyy")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No milestones achieved yet</p>
        )}

        {/* Settings collapsible */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="use-global">Use global settings</Label>
              <Switch
                id="use-global"
                checked={!hasOverride}
                onCheckedChange={(checked) => toggleOverride(checked)}
              />
            </div>

            {hasOverride && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enable for this property</Label>
                  <Switch
                    id="enabled"
                    checked={isEnabled}
                    onCheckedChange={toggleEnabled}
                  />
                </div>

                {isEnabled && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        LVR Thresholds
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {[80, 60, 40, 20].map((t) => (
                          <Badge
                            key={t}
                            variant={currentLvrThresholds.includes(t) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleLvrThreshold(t)}
                          >
                            {t}%
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Equity Thresholds
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {[100000, 250000, 500000, 1000000].map((t) => (
                          <Badge
                            key={t}
                            variant={currentEquityThresholds.includes(t) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleEquityThreshold(t)}
                          >
                            {formatEquity(t)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add MilestonesCard component for property detail"
```

---

### Task 7: Integrate MilestonesCard into Property Detail Page

**Files:**
- Modify: Property detail page (find the correct file)

**Step 1: Find the property detail page**

```bash
find src/app -name "page.tsx" | xargs grep -l "property.*detail\|propertyId" | head -5
```

**Step 2: Add import**

```typescript
import { MilestonesCard } from "@/components/properties/MilestonesCard";
```

**Step 3: Add MilestonesCard to the page layout**

Add in an appropriate location (likely in a grid or sidebar):
```typescript
<MilestonesCard propertyId={property.id} />
```

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: integrate milestones card into property detail page"
```

---

### Task 8: Run All Tests and Fix Issues

**Step 1: Run all tests**

```bash
npx vitest run
```

**Step 2: Fix any failing tests**

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Run lint**

```bash
npm run lint
```

**Step 5: Fix any issues found**

**Step 6: Final commit if needed**

```bash
git add -A && git commit -m "fix: resolve test and lint issues"
```

---

### Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database schema | schema.ts |
| 2 | Service with resolution logic | milestone-preferences.ts |
| 3 | tRPC router | milestonePreferences.ts, _app.ts |
| 4 | Update cron job | route.ts |
| 5 | Settings UI | notifications/page.tsx |
| 6 | Property card component | MilestonesCard.tsx |
| 7 | Integrate card | property detail page |
| 8 | Final verification | all |
