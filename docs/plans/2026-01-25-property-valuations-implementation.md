# Property Valuations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automated and manual property valuations with provider pattern and equity tracking.

**Architecture:** Extend existing propertyValues table with confidence range and provider-specific sources. Create valuation service with mock provider (real integrations later). Add ValuationCard to property detail and PortfolioEquityCard to portfolio page.

**Tech Stack:** Drizzle ORM, tRPC, Vitest, React, shadcn/ui

---

## Task 1: Extend Database Schema

**Files:**
- Modify: `/src/server/db/schema.ts`

**Step 1: Update the value source enum**

Change the existing `valueSourceEnum` to include provider-specific sources.

```typescript
// Find existing enum (around line 113):
export const valueSourceEnum = pgEnum("value_source", ["manual", "api"]);

// Replace with:
export const valuationSourceEnum = pgEnum("valuation_source", [
  "manual",
  "mock",
  "corelogic",
  "proptrack",
]);
```

**Step 2: Add confidence range columns to propertyValues table**

Add `confidenceLow`, `confidenceHigh`, and `apiResponseId` columns to the existing `propertyValues` table.

```typescript
// Find existing propertyValues table (around line 430) and add these columns:
confidenceLow: decimal("confidence_low", { precision: 12, scale: 2 }),
confidenceHigh: decimal("confidence_high", { precision: 12, scale: 2 }),
apiResponseId: text("api_response_id"),
```

Also update the `source` column to use the new enum name.

**Step 3: Run type check to verify schema changes**

Run: `npm run typecheck`
Expected: PASS (or type errors in router that we'll fix next)

**Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(valuations): extend schema with confidence range and provider sources"
```

---

## Task 2: Create Valuation Service with Mock Provider

**Files:**
- Create: `/src/server/services/valuation.ts`
- Create: `/src/server/services/__tests__/valuation.test.ts`

**Step 1: Write failing tests for valuation service**

```typescript
import { describe, it, expect } from "vitest";
import {
  MockValuationProvider,
  getValuationProvider,
  type ValuationResult,
} from "../valuation";

describe("MockValuationProvider", () => {
  const provider = new MockValuationProvider();

  it("should return provider name", () => {
    expect(provider.getName()).toBe("mock");
  });

  it("should return valuation for Sydney address", async () => {
    const result = await provider.getValuation(
      "123 Test St, Sydney NSW 2000",
      "house"
    );

    expect(result).not.toBeNull();
    expect(result!.estimatedValue).toBeGreaterThan(0);
    expect(result!.confidenceLow).toBeLessThan(result!.estimatedValue);
    expect(result!.confidenceHigh).toBeGreaterThan(result!.estimatedValue);
    expect(result!.source).toBe("mock");
  });

  it("should return higher values for Sydney than regional", async () => {
    const sydneyResult = await provider.getValuation(
      "123 Test St, Sydney NSW 2000",
      "house"
    );
    const regionalResult = await provider.getValuation(
      "456 Rural Rd, Dubbo NSW 2830",
      "house"
    );

    expect(sydneyResult!.estimatedValue).toBeGreaterThan(
      regionalResult!.estimatedValue
    );
  });

  it("should return consistent values for same address (deterministic)", async () => {
    const result1 = await provider.getValuation(
      "789 Same St, Melbourne VIC 3000",
      "house"
    );
    const result2 = await provider.getValuation(
      "789 Same St, Melbourne VIC 3000",
      "house"
    );

    expect(result1!.estimatedValue).toBe(result2!.estimatedValue);
  });

  it("should return null occasionally to simulate API failures", async () => {
    // Use a specific address that triggers failure
    const result = await provider.getValuation(
      "FAIL Test Address",
      "house"
    );

    expect(result).toBeNull();
  });
});

describe("getValuationProvider", () => {
  it("should return MockValuationProvider by default", () => {
    const provider = getValuationProvider();
    expect(provider.getName()).toBe("mock");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/server/services/__tests__/valuation.test.ts`
Expected: FAIL with "Cannot find module '../valuation'"

**Step 3: Implement valuation service**

```typescript
export interface ValuationResult {
  estimatedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
  source: string;
}

export interface ValuationProvider {
  getValuation(
    address: string,
    propertyType: string
  ): Promise<ValuationResult | null>;
  getName(): string;
}

// Simple hash function for deterministic values
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Detect capital city from address
function isCapitalCity(address: string): boolean {
  const capitalCities = [
    "sydney",
    "melbourne",
    "brisbane",
    "perth",
    "adelaide",
    "hobart",
    "darwin",
    "canberra",
  ];
  const lowerAddress = address.toLowerCase();
  return capitalCities.some((city) => lowerAddress.includes(city));
}

export class MockValuationProvider implements ValuationProvider {
  getName(): string {
    return "mock";
  }

  async getValuation(
    address: string,
    propertyType: string
  ): Promise<ValuationResult | null> {
    // Simulate occasional failures
    if (address.includes("FAIL")) {
      return null;
    }

    // Base value depends on location
    const baseValue = isCapitalCity(address) ? 900000 : 450000;

    // Use hash for deterministic variation (±20%)
    const hash = hashString(address + propertyType);
    const variation = (hash % 40) - 20; // -20 to +19
    const estimatedValue = Math.round(baseValue * (1 + variation / 100));

    // Confidence range ±7.5%
    const confidenceLow = Math.round(estimatedValue * 0.925);
    const confidenceHigh = Math.round(estimatedValue * 1.075);

    return {
      estimatedValue,
      confidenceLow,
      confidenceHigh,
      source: "mock",
    };
  }
}

export function getValuationProvider(): ValuationProvider {
  const provider = process.env.VALUATION_PROVIDER;

  if (provider === "corelogic") {
    // Future: return new CoreLogicProvider();
    throw new Error("CoreLogic provider not implemented");
  }

  if (provider === "proptrack") {
    // Future: return new PropTrackProvider();
    throw new Error("PropTrack provider not implemented");
  }

  return new MockValuationProvider();
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/server/services/__tests__/valuation.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/server/services/valuation.ts src/server/services/__tests__/valuation.test.ts
git commit -m "feat(valuations): add valuation service with mock provider"
```

---

## Task 3: Update Property Value Router

**Files:**
- Modify: `/src/server/routers/propertyValue.ts`

**Step 1: Add refresh endpoint for automated valuations**

Add a new `refresh` mutation that calls the valuation provider and stores the result.

```typescript
import { getValuationProvider } from "../services/valuation";

// Add to the router:
refresh: protectedProcedure
  .input(z.object({ propertyId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // Get property with address
    const property = await ctx.db.query.properties.findFirst({
      where: and(
        eq(properties.id, input.propertyId),
        eq(properties.userId, ctx.user.id)
      ),
    });

    if (!property) {
      throw new Error("Property not found");
    }

    // Get valuation from provider
    const provider = getValuationProvider();
    const fullAddress = `${property.address}, ${property.suburb} ${property.state} ${property.postcode}`;
    const result = await provider.getValuation(fullAddress, "house");

    if (!result) {
      throw new Error("Failed to get valuation from provider");
    }

    // Store the valuation
    const [value] = await ctx.db
      .insert(propertyValues)
      .values({
        propertyId: input.propertyId,
        userId: ctx.user.id,
        estimatedValue: result.estimatedValue.toString(),
        confidenceLow: result.confidenceLow.toString(),
        confidenceHigh: result.confidenceHigh.toString(),
        valueDate: new Date().toISOString().split("T")[0],
        source: result.source as "mock" | "corelogic" | "proptrack",
        apiResponseId: `mock-${Date.now()}`,
      })
      .returning();

    return value;
  }),
```

**Step 2: Update create mutation to accept confidence range**

Modify the existing `create` mutation input schema to accept optional confidence values.

```typescript
create: protectedProcedure
  .input(
    z.object({
      propertyId: z.string().uuid(),
      estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
      valueDate: z.string(),
      source: z.enum(["manual", "mock", "corelogic", "proptrack"]).default("manual"),
      notes: z.string().optional(),
      confidenceLow: z.string().regex(/^\d+\.?\d*$/).optional(),
      confidenceHigh: z.string().regex(/^\d+\.?\d*$/).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // ... existing validation ...

    const [value] = await ctx.db
      .insert(propertyValues)
      .values({
        propertyId: input.propertyId,
        userId: ctx.user.id,
        estimatedValue: input.estimatedValue,
        confidenceLow: input.confidenceLow,
        confidenceHigh: input.confidenceHigh,
        valueDate: input.valueDate,
        source: input.source,
        notes: input.notes,
      })
      .returning();

    return value;
  }),
```

**Step 3: Add getCurrent endpoint with days since update**

```typescript
getCurrent: protectedProcedure
  .input(z.object({ propertyId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const valuation = await ctx.db.query.propertyValues.findFirst({
      where: and(
        eq(propertyValues.propertyId, input.propertyId),
        eq(propertyValues.userId, ctx.user.id)
      ),
      orderBy: [desc(propertyValues.valueDate)],
    });

    if (!valuation) {
      return null;
    }

    const valuationDate = new Date(valuation.valueDate);
    const today = new Date();
    const daysSinceUpdate = Math.floor(
      (today.getTime() - valuationDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      valuation,
      daysSinceUpdate,
    };
  }),
```

**Step 4: Run type check**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/propertyValue.ts
git commit -m "feat(valuations): add refresh endpoint and confidence range support"
```

---

## Task 4: Create ValuationCard Component

**Files:**
- Create: `/src/components/valuation/ValuationCard.tsx`

**Step 1: Create the ValuationCard component**

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { RefreshCw, Plus, History, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddValuationModal } from "./AddValuationModal";
import { ValuationHistoryModal } from "./ValuationHistoryModal";

interface ValuationCardProps {
  propertyId: string;
}

export function ValuationCard({ propertyId }: ValuationCardProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.propertyValue.getCurrent.useQuery({
    propertyId,
  });

  const refreshMutation = trpc.propertyValue.refresh.useMutation({
    onSuccess: () => {
      toast.success("Valuation refreshed");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to refresh valuation");
    },
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      manual: "Manual",
      mock: "Estimated",
      corelogic: "CoreLogic",
      proptrack: "PropTrack",
    };
    return labels[source] || source;
  };

  const getSourceVariant = (source: string) => {
    if (source === "manual") return "secondary";
    return "default";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Property Valuation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const valuation = data?.valuation;
  const daysSinceUpdate = data?.daysSinceUpdate ?? 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Property Valuation
          </CardTitle>
          {valuation && (
            <Badge variant={getSourceVariant(valuation.source)}>
              {getSourceLabel(valuation.source)}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {valuation ? (
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold">
                  {formatCurrency(valuation.estimatedValue)}
                </p>
                {valuation.confidenceLow && valuation.confidenceHigh && (
                  <p className="text-sm text-muted-foreground">
                    Range: {formatCurrency(valuation.confidenceLow)} -{" "}
                    {formatCurrency(valuation.confidenceHigh)}
                  </p>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                Last updated {daysSinceUpdate === 0 ? "today" : `${daysSinceUpdate} days ago`}
                {valuation.notes && (
                  <span className="block mt-1 italic">{valuation.notes}</span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshMutation.mutate({ propertyId })}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw
                    className={cn(
                      "w-4 h-4 mr-2",
                      refreshMutation.isPending && "animate-spin"
                    )}
                  />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Manual
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryModalOpen(true)}
                >
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                No valuation recorded yet
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => refreshMutation.mutate({ propertyId })}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw
                    className={cn(
                      "w-4 h-4 mr-2",
                      refreshMutation.isPending && "animate-spin"
                    )}
                  />
                  Get Estimate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manual
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddValuationModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        propertyId={propertyId}
        onSuccess={() => {
          refetch();
          setAddModalOpen(false);
        }}
      />

      <ValuationHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        propertyId={propertyId}
      />
    </>
  );
}
```

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: FAIL (AddValuationModal and ValuationHistoryModal don't exist yet)

**Step 3: Commit (partial, will complete with modals)**

Wait until modals are created before committing.

---

## Task 5: Create AddValuationModal Component

**Files:**
- Create: `/src/components/valuation/AddValuationModal.tsx`

**Step 1: Create the AddValuationModal component**

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const formSchema = z.object({
  estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
  valueDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddValuationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onSuccess: () => void;
}

export function AddValuationModal({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: AddValuationModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      estimatedValue: "",
      valueDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const createMutation = trpc.propertyValue.create.useMutation({
    onSuccess: () => {
      toast.success("Valuation added");
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add valuation");
    },
  });

  const handleSubmit = (values: FormValues) => {
    createMutation.mutate({
      propertyId,
      estimatedValue: values.estimatedValue,
      valueDate: values.valueDate,
      source: "manual",
      notes: values.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Manual Valuation</DialogTitle>
          <DialogDescription>
            Enter a valuation from a bank, agent, or your own estimate.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="650000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valuation Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Bank valuation, Agent estimate"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: Still waiting for ValuationHistoryModal

---

## Task 6: Create ValuationHistoryModal Component

**Files:**
- Create: `/src/components/valuation/ValuationHistoryModal.tsx`

**Step 1: Create the ValuationHistoryModal component**

```typescript
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface ValuationHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function ValuationHistoryModal({
  open,
  onOpenChange,
  propertyId,
}: ValuationHistoryModalProps) {
  const { data: valuations, refetch } = trpc.propertyValue.list.useQuery(
    { propertyId },
    { enabled: open }
  );

  const deleteMutation = trpc.propertyValue.delete.useMutation({
    onSuccess: () => {
      toast.success("Valuation deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete");
    },
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      manual: "Manual",
      mock: "Estimated",
      corelogic: "CoreLogic",
      proptrack: "PropTrack",
    };
    return labels[source] || source;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Valuation History</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {valuations && valuations.length > 0 ? (
            valuations.map((valuation) => (
              <div
                key={valuation.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {formatCurrency(valuation.estimatedValue)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {getSourceLabel(valuation.source)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(valuation.valueDate)}
                    {valuation.confidenceLow && valuation.confidenceHigh && (
                      <span className="ml-2">
                        ({formatCurrency(valuation.confidenceLow)} -{" "}
                        {formatCurrency(valuation.confidenceHigh)})
                      </span>
                    )}
                  </div>
                  {valuation.notes && (
                    <p className="text-sm italic text-muted-foreground">
                      {valuation.notes}
                    </p>
                  )}
                </div>

                {valuation.source === "manual" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate({ id: valuation.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No valuation history
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create barrel export**

Create `/src/components/valuation/index.ts`:

```typescript
export { ValuationCard } from "./ValuationCard";
export { AddValuationModal } from "./AddValuationModal";
export { ValuationHistoryModal } from "./ValuationHistoryModal";
```

**Step 3: Run type check**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit all valuation components**

```bash
git add src/components/valuation/
git commit -m "feat(valuations): add ValuationCard, AddValuationModal, ValuationHistoryModal"
```

---

## Task 7: Create PortfolioEquityCard Component

**Files:**
- Create: `/src/components/portfolio/PortfolioEquityCard.tsx`

**Step 1: Create the PortfolioEquityCard component**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Building2, Wallet, PiggyBank } from "lucide-react";

interface PortfolioEquityCardProps {
  totalValue: number;
  totalLoans: number;
  propertyCount: number;
}

export function PortfolioEquityCard({
  totalValue,
  totalLoans,
  propertyCount,
}: PortfolioEquityCardProps) {
  const totalEquity = totalValue - totalLoans;
  const equityPercentage = totalValue > 0 ? (totalEquity / totalValue) * 100 : 0;
  const avgLvr = totalValue > 0 ? (totalLoans / totalValue) * 100 : 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <PiggyBank className="w-5 h-5" />
          Portfolio Equity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              Total Value
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="w-4 h-4" />
              Total Loans
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalLoans)}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <PiggyBank className="w-4 h-4" />
              Net Equity
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalEquity)}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="w-4 h-4" />
              Properties
            </div>
            <p className="text-2xl font-bold">{propertyCount}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Equity Position</span>
            <span className="font-medium">{equityPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={equityPercentage} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Average LVR: {avgLvr.toFixed(1)}%</span>
            <span>
              {avgLvr < 60 ? "Low risk" : avgLvr < 80 ? "Moderate" : "High LVR"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Export from barrel**

Add to `/src/components/portfolio/index.ts` (or create if not exists):

```typescript
export { PortfolioEquityCard } from "./PortfolioEquityCard";
```

**Step 3: Run type check**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/portfolio/PortfolioEquityCard.tsx
git commit -m "feat(valuations): add PortfolioEquityCard component"
```

---

## Task 8: Integrate ValuationCard into Property Detail

**Files:**
- Modify: `/src/app/(dashboard)/properties/[id]/layout.tsx` or create property detail page

**Step 1: Check if property detail page exists or needs creation**

If `/src/app/(dashboard)/properties/[id]/page.tsx` doesn't exist, create it:

```typescript
"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValuationCard } from "@/components/valuation";
import { Building2, MapPin, Calendar } from "lucide-react";

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.id as string;

  const { data: property, isLoading } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!property) {
    return <div>Property not found</div>;
  }

  const formatCurrency = (value: string | number | null) => {
    if (value === null) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Property Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">{property.address}</p>
              <p className="text-muted-foreground">
                {property.suburb}, {property.state} {property.postcode}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Purchase Price</p>
              <p className="font-semibold">
                {formatCurrency(property.purchasePrice)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Purchase Date</p>
              <p className="font-semibold flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(property.purchaseDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Entity</p>
              <p className="font-semibold">{property.entityName || "Personal"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold capitalize">{property.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ValuationCard propertyId={propertyId} />
    </div>
  );
}
```

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/page.tsx
git commit -m "feat(valuations): add property detail page with ValuationCard"
```

---

## Task 9: Add PortfolioEquityCard to Portfolio Page

**Files:**
- Modify: `/src/app/(dashboard)/portfolio/page.tsx`

**Step 1: Import and add PortfolioEquityCard**

Add the import at the top:

```typescript
import { PortfolioEquityCard } from "@/components/portfolio/PortfolioEquityCard";
```

Add the card above the PortfolioToolbar in the return statement:

```typescript
return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      {/* ... existing header ... */}
    </div>

    {/* Add equity summary card */}
    {summary && (
      <PortfolioEquityCard
        totalValue={summary.totalValue}
        totalLoans={summary.totalLoans}
        propertyCount={metrics?.length ?? 0}
      />
    )}

    <PortfolioToolbar
      {/* ... existing props ... */}
    />
    {/* ... rest of page ... */}
  </div>
);
```

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/portfolio/page.tsx
git commit -m "feat(valuations): add PortfolioEquityCard to portfolio page"
```

---

## Task 10: Final Integration and Testing

**Files:**
- All files from previous tasks

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS (or fix any issues)

**Step 4: Manual testing checklist**

- [ ] Navigate to a property detail page - see ValuationCard
- [ ] Click "Get Estimate" - should show mock valuation with confidence range
- [ ] Click "Add Manual" - should open modal, save valuation
- [ ] Click "History" - should show all valuations
- [ ] Delete a manual valuation from history
- [ ] Navigate to Portfolio page - see PortfolioEquityCard at top
- [ ] Verify equity calculations are correct

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "feat(valuations): complete property valuations feature"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Extend database schema | schema.ts |
| 2 | Create valuation service with mock provider | valuation.ts, valuation.test.ts |
| 3 | Update property value router | propertyValue.ts |
| 4 | Create ValuationCard component | ValuationCard.tsx |
| 5 | Create AddValuationModal component | AddValuationModal.tsx |
| 6 | Create ValuationHistoryModal component | ValuationHistoryModal.tsx |
| 7 | Create PortfolioEquityCard component | PortfolioEquityCard.tsx |
| 8 | Integrate into property detail page | [id]/page.tsx |
| 9 | Add equity card to portfolio page | portfolio/page.tsx |
| 10 | Final integration and testing | All files |
