"use client";

import { TrendingUp, AlertTriangle, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyScorecard } from "@/components/analytics/PropertyScorecard";
import { ScorecardComparison } from "@/components/analytics/ScorecardComparison";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

function ScorecardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  const { data: scorecard, isLoading } =
    trpc.performanceBenchmarking.getPortfolioScorecard.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Performance Scorecard</h1>
          <p className="text-muted-foreground">
            Compare your properties side-by-side and identify top performers.
          </p>
        </div>
        <ScorecardSkeleton />
      </div>
    );
  }

  if (!scorecard || scorecard.properties.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Performance Scorecard</h1>
          <p className="text-muted-foreground">
            Compare your properties side-by-side and identify top performers.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No properties to score</p>
            <p className="text-sm mt-1">
              Add properties and transactions to see your performance scorecard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Performance Scorecard</h1>
        <p className="text-muted-foreground">
          Compare your properties side-by-side and identify top performers.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio Score</p>
            <p className={cn(
              "text-2xl font-bold",
              scorecard.averageScore >= 70 ? "text-success" :
              scorecard.averageScore >= 40 ? "text-warning" : "text-destructive"
            )}>
              {scorecard.averageScore}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-success" />
              <p className="text-sm text-muted-foreground">Best Performer</p>
            </div>
            {scorecard.bestPerformer ? (
              <>
                <p className="text-sm font-bold truncate">{scorecard.bestPerformer.address}</p>
                <p className="text-xs text-muted-foreground">Score: {scorecard.bestPerformer.score}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
            {scorecard.worstPerformer ? (
              <>
                <p className="text-sm font-bold truncate">{scorecard.worstPerformer.address}</p>
                <p className="text-xs text-muted-foreground">Score: {scorecard.worstPerformer.score}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">--</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Gross Yield</p>
            <p className="text-2xl font-bold">{scorecard.averageGrossYield}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side comparison */}
      {scorecard.properties.length >= 2 && (
        <ScorecardComparison
          properties={scorecard.properties}
          averageGrossYield={scorecard.averageGrossYield}
          averageNetYield={scorecard.averageNetYield}
          averageScore={scorecard.averageScore}
        />
      )}

      {/* Individual property scorecards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Property Scorecards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scorecard.properties.map((entry, index) => (
            <PropertyScorecard
              key={entry.propertyId}
              entry={entry}
              highlight={index === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
