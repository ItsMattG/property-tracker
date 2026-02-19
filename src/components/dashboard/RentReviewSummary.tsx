"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";

const STATUS_DOT_CLASS: Record<string, string> = {
  below_market_critical: "bg-destructive",
  below_market_warning: "bg-amber-500",
  at_market: "bg-green-500",
  above_market: "bg-blue-500",
  no_review: "bg-muted-foreground/30",
};

function Skeleton() {
  return (
    <Card data-testid="rent-review-summary">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Rent Review</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RentReviewSummary() {
  const { data, isLoading } = trpc.rentReview.getPortfolioSummary.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return <Skeleton />;
  }

  if (!data || data.properties.length === 0) {
    return (
      <Card data-testid="rent-review-summary">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Rent Review</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Set market rents on your properties to see rent review insights
          </p>
        </CardContent>
      </Card>
    );
  }

  const { properties: reviewedProperties, summary } = data;
  const displayProperties = reviewedProperties.slice(0, 4);

  return (
    <Card data-testid="rent-review-summary">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Rent Review</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {summary.reviewedCount}/{summary.totalCount} reviewed
          </span>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayProperties.map((property) => (
          <Link
            key={property.propertyId}
            href={`/properties/${property.propertyId}`}
            className="flex items-center gap-3 group"
            prefetch={false}
          >
            <div
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                STATUS_DOT_CLASS[property.status] ?? STATUS_DOT_CLASS.no_review
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {property.suburb ?? property.address}
              </p>
              {property.gapPercent !== null && (
                <p className="text-xs text-muted-foreground">
                  {property.gapPercent > 0
                    ? `${property.gapPercent.toFixed(1)}% below market`
                    : property.gapPercent < 0
                      ? `${Math.abs(property.gapPercent).toFixed(1)}% above market`
                      : "At market rate"}
                </p>
              )}
            </div>
            {property.currentRentWeekly !== null &&
              property.marketRentWeekly !== null && (
                <div className="text-right shrink-0">
                  <p className="text-xs tabular-nums">
                    ${property.currentRentWeekly.toFixed(0)}
                    <span className="text-muted-foreground"> / </span>
                    ${property.marketRentWeekly.toFixed(0)}
                    <span className="text-muted-foreground text-[10px]"> pw</span>
                  </p>
                </div>
              )}
          </Link>
        ))}

        {summary.totalAnnualUplift > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Potential annual uplift
              </span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                +{formatCurrency(summary.totalAnnualUplift)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
