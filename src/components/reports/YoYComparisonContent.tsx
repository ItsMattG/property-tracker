"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc/client";
import { YoYComparisonTable } from "./YoYComparisonTable";
import { ChevronDown, Loader2, BarChart3 } from "lucide-react";

export function YoYComparisonContent() {
  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();

  // Default to current FY (most recent year)
  const currentYear = availableYears?.[0]?.year;
  const priorYears = availableYears?.filter((y) => y.year !== currentYear) ?? [];

  const [comparisonYear, setComparisonYear] = useState<number | undefined>(undefined);

  // Use prior year as default once available
  const effectiveComparisonYear = comparisonYear ?? (priorYears[0]?.year);

  const { data, isLoading } = trpc.yoyComparison.getComparison.useQuery(
    { currentYear: currentYear!, comparisonYear: effectiveComparisonYear! },
    { enabled: !!currentYear && !!effectiveComparisonYear },
  );

  if (!availableYears || availableYears.length < 2) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Year-over-Year Comparison</h2>
          <p className="text-muted-foreground">
            Compare expense categories across financial years
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              You need at least two financial years of data to compare. Keep tracking your expenses and check back next financial year.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Year-over-Year Comparison</h2>
          <p className="text-muted-foreground">
            Compare expense categories across financial years
          </p>
        </div>
        {priorYears.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Compare against:</span>
            <Select
              value={String(effectiveComparisonYear)}
              onValueChange={(v) => setComparisonYear(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorYears.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* Portfolio Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Portfolio Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.portfolio.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expense data found for either financial year.
                </p>
              ) : (
                <YoYComparisonTable
                  categories={data.portfolio}
                  currentYearLabel={data.currentYearLabel}
                  comparisonYearLabel={data.comparisonYearLabel}
                  totalCurrent={data.totalCurrent}
                  totalComparison={data.totalComparison}
                  totalChange={data.totalChange}
                  totalChangePercent={data.totalChangePercent}
                />
              )}
            </CardContent>
          </Card>

          {/* Per-Property Breakdowns */}
          {data.properties.map((prop) => (
            <Collapsible key={prop.propertyId}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{prop.address}</CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <YoYComparisonTable
                      categories={prop.categories}
                      currentYearLabel={data.currentYearLabel}
                      comparisonYearLabel={data.comparisonYearLabel}
                      totalCurrent={prop.totalCurrent}
                      totalComparison={prop.totalComparison}
                      totalChange={prop.totalChange}
                      totalChangePercent={prop.totalChangePercent}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </>
      )}
    </div>
  );
}
