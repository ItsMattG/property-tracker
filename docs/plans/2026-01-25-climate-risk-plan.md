# Climate Risk Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add climate risk assessment (flood/bushfire) to properties with badges, detail sections, and portfolio summary.

**Architecture:** Static postcode-level risk lookup stored locally. Risk data fetched on property creation and stored in JSONB column. UI shows badges on cards, detail section on property page, and portfolio summary widget.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, React, Tailwind CSS, Vitest

---

### Task 1: Add Climate Risk Data and Types

**Files:**
- Create: `src/server/data/climate-risk-data.ts`
- Create: `src/types/climate-risk.ts`

**Step 1: Create the types file**

Create `src/types/climate-risk.ts`:

```typescript
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface ClimateRisk {
  floodRisk: RiskLevel;
  bushfireRisk: RiskLevel;
  overallRisk: RiskLevel;
  fetchedAt: string;
}
```

**Step 2: Create the risk data lookup**

Create `src/server/data/climate-risk-data.ts`:

```typescript
import type { RiskLevel } from "@/types/climate-risk";

interface PostcodeRisk {
  flood: RiskLevel;
  bushfire: RiskLevel;
}

// Known high-risk postcodes from Australian government flood/bushfire mapping
// Flood-prone: Brisbane river, Hawkesbury-Nepean, Melbourne west, Townsville
// Bushfire-prone: Blue Mountains, Dandenong Ranges, Adelaide Hills
export const climateRiskData: Record<string, PostcodeRisk> = {
  // QLD - Brisbane flood-prone
  "4000": { flood: "medium", bushfire: "low" },
  "4005": { flood: "high", bushfire: "low" },
  "4007": { flood: "high", bushfire: "low" },
  "4010": { flood: "medium", bushfire: "low" },
  "4059": { flood: "high", bushfire: "low" },
  "4067": { flood: "extreme", bushfire: "low" },
  "4068": { flood: "high", bushfire: "low" },
  "4101": { flood: "high", bushfire: "low" },
  "4102": { flood: "medium", bushfire: "low" },
  "4810": { flood: "high", bushfire: "low" }, // Townsville
  "4811": { flood: "high", bushfire: "low" },

  // NSW - Hawkesbury-Nepean flood-prone
  "2750": { flood: "high", bushfire: "medium" }, // Penrith
  "2753": { flood: "extreme", bushfire: "medium" }, // Richmond
  "2756": { flood: "extreme", bushfire: "low" }, // Windsor
  "2757": { flood: "high", bushfire: "medium" },
  "2758": { flood: "high", bushfire: "high" },
  "2777": { flood: "medium", bushfire: "extreme" }, // Blue Mountains
  "2778": { flood: "medium", bushfire: "extreme" },
  "2779": { flood: "low", bushfire: "extreme" },
  "2780": { flood: "low", bushfire: "extreme" }, // Katoomba
  "2782": { flood: "low", bushfire: "high" },
  "2083": { flood: "high", bushfire: "medium" }, // Hawkesbury

  // VIC - Melbourne west flood-prone
  "3011": { flood: "high", bushfire: "low" }, // Footscray
  "3012": { flood: "high", bushfire: "low" },
  "3013": { flood: "medium", bushfire: "low" },
  "3020": { flood: "medium", bushfire: "low" },
  "3029": { flood: "high", bushfire: "low" }, // Werribee
  "3030": { flood: "high", bushfire: "low" },
  "3140": { flood: "low", bushfire: "high" }, // Lilydale
  "3160": { flood: "low", bushfire: "extreme" }, // Belgrave
  "3775": { flood: "low", bushfire: "extreme" }, // Yarra Glen
  "3777": { flood: "low", bushfire: "extreme" }, // Healesville
  "3786": { flood: "low", bushfire: "extreme" }, // Ferntree Gully
  "3787": { flood: "low", bushfire: "extreme" }, // Upper Ferntree Gully
  "3788": { flood: "low", bushfire: "extreme" }, // Sassafras

  // SA - Adelaide Hills bushfire-prone
  "5062": { flood: "low", bushfire: "high" },
  "5063": { flood: "low", bushfire: "medium" },
  "5072": { flood: "low", bushfire: "high" },
  "5073": { flood: "low", bushfire: "high" },
  "5074": { flood: "low", bushfire: "medium" },
  "5131": { flood: "low", bushfire: "extreme" }, // Stirling
  "5134": { flood: "low", bushfire: "extreme" }, // Crafers
  "5152": { flood: "low", bushfire: "extreme" }, // Aldgate
  "5153": { flood: "low", bushfire: "extreme" }, // Bridgewater

  // WA - Perth hills bushfire-prone
  "6076": { flood: "low", bushfire: "high" }, // Lesmurdie
  "6077": { flood: "low", bushfire: "high" },
  "6081": { flood: "low", bushfire: "extreme" }, // Mundaring
  "6083": { flood: "low", bushfire: "extreme" },
  "6084": { flood: "low", bushfire: "extreme" },

  // TAS - bushfire areas
  "7005": { flood: "low", bushfire: "high" },
  "7050": { flood: "low", bushfire: "high" },
  "7054": { flood: "low", bushfire: "high" },
};
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/types/climate-risk.ts src/server/data/climate-risk-data.ts
git commit -m "feat: add climate risk types and data"
```

---

### Task 2: Create Climate Risk Service

**Files:**
- Create: `src/server/services/climate-risk.ts`
- Create: `src/server/services/__tests__/climate-risk.test.ts`

**Step 1: Write the failing tests**

Create `src/server/services/__tests__/climate-risk.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getClimateRisk,
  calculateOverallRisk,
} from "../climate-risk";

describe("climate-risk service", () => {
  describe("calculateOverallRisk", () => {
    it("returns the higher of two risk levels", () => {
      expect(calculateOverallRisk("low", "high")).toBe("high");
      expect(calculateOverallRisk("high", "low")).toBe("high");
      expect(calculateOverallRisk("medium", "extreme")).toBe("extreme");
      expect(calculateOverallRisk("low", "low")).toBe("low");
    });
  });

  describe("getClimateRisk", () => {
    it("returns known risk for high-risk postcode", () => {
      const risk = getClimateRisk("4067"); // Brisbane flood-prone
      expect(risk.floodRisk).toBe("extreme");
      expect(risk.bushfireRisk).toBe("low");
      expect(risk.overallRisk).toBe("extreme");
      expect(risk.fetchedAt).toBeDefined();
    });

    it("returns known risk for bushfire-prone postcode", () => {
      const risk = getClimateRisk("2780"); // Blue Mountains
      expect(risk.floodRisk).toBe("low");
      expect(risk.bushfireRisk).toBe("extreme");
      expect(risk.overallRisk).toBe("extreme");
    });

    it("returns low risk for unknown postcode", () => {
      const risk = getClimateRisk("9999");
      expect(risk.floodRisk).toBe("low");
      expect(risk.bushfireRisk).toBe("low");
      expect(risk.overallRisk).toBe("low");
    });

    it("returns low risk for invalid postcode format", () => {
      const risk = getClimateRisk("invalid");
      expect(risk.floodRisk).toBe("low");
      expect(risk.bushfireRisk).toBe("low");
      expect(risk.overallRisk).toBe("low");
    });

    it("handles empty string postcode", () => {
      const risk = getClimateRisk("");
      expect(risk.overallRisk).toBe("low");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/climate-risk.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement the service**

Create `src/server/services/climate-risk.ts`:

```typescript
import type { RiskLevel, ClimateRisk } from "@/types/climate-risk";
import { climateRiskData } from "../data/climate-risk-data";

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high", "extreme"];

export function calculateOverallRisk(
  floodRisk: RiskLevel,
  bushfireRisk: RiskLevel
): RiskLevel {
  const floodIndex = RISK_LEVELS.indexOf(floodRisk);
  const bushfireIndex = RISK_LEVELS.indexOf(bushfireRisk);
  return RISK_LEVELS[Math.max(floodIndex, bushfireIndex)];
}

export function getClimateRisk(postcode: string): ClimateRisk {
  // Validate postcode format (4 digits for Australia)
  if (!/^\d{4}$/.test(postcode)) {
    return {
      floodRisk: "low",
      bushfireRisk: "low",
      overallRisk: "low",
      fetchedAt: new Date().toISOString(),
    };
  }

  const riskData = climateRiskData[postcode];

  if (!riskData) {
    return {
      floodRisk: "low",
      bushfireRisk: "low",
      overallRisk: "low",
      fetchedAt: new Date().toISOString(),
    };
  }

  const floodRisk = riskData.flood;
  const bushfireRisk = riskData.bushfire;
  const overallRisk = calculateOverallRisk(floodRisk, bushfireRisk);

  return {
    floodRisk,
    bushfireRisk,
    overallRisk,
    fetchedAt: new Date().toISOString(),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/climate-risk.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```
git add src/server/services/climate-risk.ts src/server/services/__tests__/climate-risk.test.ts
git commit -m "feat: add climate risk service with tests"
```

---

### Task 3: Add Climate Risk Column to Properties Schema

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/0011_climate_risk.sql`

**Step 1: Add climateRisk column to properties table**

In `src/server/db/schema.ts`, find the `properties` table definition (around line 317) and add the `climateRisk` column after `soldAt`:

```typescript
export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  address: text("address").notNull(),
  suburb: text("suburb").notNull(),
  state: stateEnum("state").notNull(),
  postcode: text("postcode").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  entityName: text("entity_name").default("Personal").notNull(),
  status: propertyStatusEnum("status").default("active").notNull(),
  soldAt: date("sold_at"),
  climateRisk: jsonb("climate_risk").$type<import("@/types/climate-risk").ClimateRisk>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 2: Create migration file**

Create `drizzle/0011_climate_risk.sql`:

```sql
ALTER TABLE "properties" ADD COLUMN "climate_risk" jsonb;
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/server/db/schema.ts drizzle/0011_climate_risk.sql
git commit -m "feat: add climate_risk column to properties"
```

---

### Task 4: Integrate Climate Risk into Property Router

**Files:**
- Modify: `src/server/routers/property.ts`

**Step 1: Import climate risk service**

At the top of `src/server/routers/property.ts`, add:

```typescript
import { getClimateRisk } from "../services/climate-risk";
```

**Step 2: Update create mutation to fetch climate risk**

In the `create` mutation, add climate risk lookup. Replace the mutation body:

```typescript
  create: writeProcedure
    .input(propertySchema)
    .mutation(async ({ ctx, input }) => {
      const climateRisk = getClimateRisk(input.postcode);

      const [property] = await ctx.db
        .insert(properties)
        .values({
          userId: ctx.portfolio.ownerId,
          address: input.address,
          suburb: input.suburb,
          state: input.state,
          postcode: input.postcode,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
          entityName: input.entityName || "Personal",
          climateRisk,
        })
        .returning();

      return property;
    }),
```

**Step 3: Update update mutation to refresh climate risk when postcode changes**

In the `update` mutation, add climate risk refresh:

```typescript
  update: writeProcedure
    .input(z.object({ id: z.string().uuid() }).merge(propertySchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // If postcode is being updated, refresh climate risk
      const updateData: Record<string, unknown> = {
        ...data,
        updatedAt: new Date(),
      };

      if (data.postcode) {
        updateData.climateRisk = getClimateRisk(data.postcode);
      }

      const [property] = await ctx.db
        .update(properties)
        .set(updateData)
        .where(and(eq(properties.id, id), eq(properties.userId, ctx.portfolio.ownerId)))
        .returning();

      return property;
    }),
```

**Step 4: Add refreshClimateRisk endpoint**

Add a new endpoint after the `delete` mutation:

```typescript
  refreshClimateRisk: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.id),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      const climateRisk = getClimateRisk(property.postcode);

      const [updated] = await ctx.db
        .update(properties)
        .set({ climateRisk, updatedAt: new Date() })
        .where(eq(properties.id, input.id))
        .returning();

      return updated;
    }),
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 7: Commit**

```
git add src/server/routers/property.ts
git commit -m "feat: integrate climate risk into property router"
```

---

### Task 5: Create Climate Risk Badge Component

**Files:**
- Create: `src/components/climate-risk/ClimateRiskBadge.tsx`

**Step 1: Create the badge component**

Create `src/components/climate-risk/ClimateRiskBadge.tsx`:

```typescript
import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types/climate-risk";
import { cn } from "@/lib/utils";

interface ClimateRiskBadgeProps {
  level: RiskLevel;
  showLow?: boolean;
  className?: string;
}

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  extreme: {
    label: "Extreme",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
};

export function ClimateRiskBadge({
  level,
  showLow = false,
  className,
}: ClimateRiskBadgeProps) {
  // Don't show badge for low risk unless explicitly requested
  if (level === "low" && !showLow) {
    return null;
  }

  const config = riskConfig[level];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label} Risk
    </Badge>
  );
}
```

**Step 2: Create index export**

Create `src/components/climate-risk/index.ts`:

```typescript
export { ClimateRiskBadge } from "./ClimateRiskBadge";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/components/climate-risk/
git commit -m "feat: add ClimateRiskBadge component"
```

---

### Task 6: Create Climate Risk Detail Card Component

**Files:**
- Create: `src/components/climate-risk/ClimateRiskCard.tsx`
- Modify: `src/components/climate-risk/index.ts`

**Step 1: Create the detail card component**

Create `src/components/climate-risk/ClimateRiskCard.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClimateRiskBadge } from "./ClimateRiskBadge";
import { CloudRain, Flame, Shield, RefreshCw } from "lucide-react";
import type { ClimateRisk } from "@/types/climate-risk";
import { trpc } from "@/lib/trpc/client";
import { useState } from "react";

interface ClimateRiskCardProps {
  propertyId: string;
  climateRisk: ClimateRisk | null;
}

export function ClimateRiskCard({ propertyId, climateRisk }: ClimateRiskCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const refreshMutation = trpc.property.refreshClimateRisk.useMutation({
    onSuccess: () => {
      utils.property.get.invalidate({ id: propertyId });
    },
    onSettled: () => {
      setIsRefreshing(false);
    },
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMutation.mutate({ id: propertyId });
  };

  if (!climateRisk) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <CardTitle>Climate Risk</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Assess Risk
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Climate risk has not been assessed for this property.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <CardTitle>Climate Risk</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <CloudRain className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Flood Risk</p>
              <ClimateRiskBadge level={climateRisk.floodRisk} showLow />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Bushfire Risk</p>
              <ClimateRiskBadge level={climateRisk.bushfireRisk} showLow />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Risk</span>
            <ClimateRiskBadge level={climateRisk.overallRisk} showLow />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Based on postcode-level government flood and bushfire mapping data.
          Last updated: {new Date(climateRisk.fetchedAt).toLocaleDateString("en-AU")}
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update index export**

Update `src/components/climate-risk/index.ts`:

```typescript
export { ClimateRiskBadge } from "./ClimateRiskBadge";
export { ClimateRiskCard } from "./ClimateRiskCard";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/components/climate-risk/
git commit -m "feat: add ClimateRiskCard component"
```

---

### Task 7: Add Climate Risk to Property Detail Page

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx`

**Step 1: Import ClimateRiskCard**

At the top of the file, add:

```typescript
import { ClimateRiskCard } from "@/components/climate-risk";
```

**Step 2: Add ClimateRiskCard to the page**

Find where the existing cards are rendered (after the property details and valuation cards). Add the ClimateRiskCard. Look for the grid layout and add:

```typescript
<ClimateRiskCard
  propertyId={propertyId}
  climateRisk={property.climateRisk}
/>
```

Place it after the `ValuationCard` in the grid layout.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/app/(dashboard)/properties/[id]/page.tsx
git commit -m "feat: add climate risk card to property detail page"
```

---

### Task 8: Create Portfolio Climate Summary Widget

**Files:**
- Create: `src/components/climate-risk/ClimateRiskSummary.tsx`
- Modify: `src/components/climate-risk/index.ts`

**Step 1: Create the summary widget component**

Create `src/components/climate-risk/ClimateRiskSummary.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle } from "lucide-react";
import type { ClimateRisk } from "@/types/climate-risk";

interface PropertyWithRisk {
  id: string;
  address: string;
  climateRisk: ClimateRisk | null;
}

interface ClimateRiskSummaryProps {
  properties: PropertyWithRisk[];
}

export function ClimateRiskSummary({ properties }: ClimateRiskSummaryProps) {
  const propertiesWithRisk = properties.filter((p) => p.climateRisk);

  const elevatedRiskCount = propertiesWithRisk.filter(
    (p) => p.climateRisk && ["medium", "high", "extreme"].includes(p.climateRisk.overallRisk)
  ).length;

  const highFloodCount = propertiesWithRisk.filter(
    (p) => p.climateRisk && ["high", "extreme"].includes(p.climateRisk.floodRisk)
  ).length;

  const highBushfireCount = propertiesWithRisk.filter(
    (p) => p.climateRisk && ["high", "extreme"].includes(p.climateRisk.bushfireRisk)
  ).length;

  // Don't show widget if no properties have elevated risk
  if (elevatedRiskCount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-orange-500" />
          </div>
          <CardTitle className="text-base">Climate Exposure</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-sm">
            <strong>{elevatedRiskCount}</strong> of {properties.length} properties in elevated risk zones
          </span>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {highFloodCount > 0 && (
            <p>{highFloodCount} with high/extreme flood risk</p>
          )}
          {highBushfireCount > 0 && (
            <p>{highBushfireCount} with high/extreme bushfire risk</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update index export**

Update `src/components/climate-risk/index.ts`:

```typescript
export { ClimateRiskBadge } from "./ClimateRiskBadge";
export { ClimateRiskCard } from "./ClimateRiskCard";
export { ClimateRiskSummary } from "./ClimateRiskSummary";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/components/climate-risk/
git commit -m "feat: add ClimateRiskSummary widget"
```

---

### Task 9: Add Climate Risk Summary to Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Import ClimateRiskSummary**

Add import at the top:

```typescript
import { ClimateRiskSummary } from "@/components/climate-risk";
```

**Step 2: Add query to fetch properties with climate risk**

Add a new query for properties:

```typescript
const { data: properties } = trpc.property.list.useQuery();
```

**Step 3: Add ClimateRiskSummary to the dashboard**

Add the widget in the dashboard layout, after the existing cards:

```typescript
{properties && properties.length > 0 && (
  <ClimateRiskSummary properties={properties} />
)}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add climate risk summary to dashboard"
```

---

### Task 10: Backfill Existing Properties

**Files:**
- Create: `src/scripts/backfill-climate-risk.ts`

**Step 1: Create backfill script**

Create `src/scripts/backfill-climate-risk.ts`:

```typescript
import { db } from "@/server/db";
import { properties } from "@/server/db/schema";
import { getClimateRisk } from "@/server/services/climate-risk";
import { isNull } from "drizzle-orm";

async function backfillClimateRisk() {
  console.log("Starting climate risk backfill...");

  const propertiesWithoutRisk = await db
    .select()
    .from(properties)
    .where(isNull(properties.climateRisk));

  console.log(`Found ${propertiesWithoutRisk.length} properties to update`);

  for (const property of propertiesWithoutRisk) {
    const climateRisk = getClimateRisk(property.postcode);

    await db
      .update(properties)
      .set({ climateRisk })
      .where(isNull(properties.id));

    console.log(`Updated ${property.address} (${property.postcode}): ${climateRisk.overallRisk} risk`);
  }

  console.log("Backfill complete!");
}

backfillClimateRisk()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
```

**Step 2: Add npm script (optional)**

This is optional - document that the script can be run with:
`npx tsx src/scripts/backfill-climate-risk.ts`

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add src/scripts/backfill-climate-risk.ts
git commit -m "feat: add climate risk backfill script"
```

---

### Task 11: Final Verification

**Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests pass (including new climate-risk tests)

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Final commit if any fixes needed**

If any fixes were made:
```
git add -A
git commit -m "fix: address lint/type issues"
```

**Step 5: Push to remote**

```
git push origin main
```
