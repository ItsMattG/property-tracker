"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BenchmarkSummaryGauges } from "@/components/analytics/BenchmarkSummaryGauges";
import { BenchmarkRankingTable } from "@/components/analytics/BenchmarkRankingTable";
import { trpc } from "@/lib/trpc/client";

function BenchmarkingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Gauge cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Table skeleton */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-5 w-48 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BenchmarkingPage() {
  const { data: scorecard, isLoading } =
    trpc.performanceBenchmarking.getPortfolioScorecard.useQuery(undefined, {
      staleTime: 5 * 60_000,
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Portfolio Benchmarking</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            See how your properties rank against each other and identify
            opportunities to improve returns.
          </p>
        </div>
        <BenchmarkingSkeleton />
      </div>
    );
  }

  if (!scorecard || scorecard.properties.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Portfolio Benchmarking</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            See how your properties rank against each other and identify
            opportunities to improve returns.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No benchmarking data yet</p>
            <p className="text-sm mt-1">
              Add properties and transactions to see portfolio benchmarks.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/properties/new">Add a Property</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Portfolio Benchmarking</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          See how your properties rank against each other and identify
          opportunities to improve returns.
        </p>
      </div>

      {/* Summary gauges */}
      <BenchmarkSummaryGauges data={scorecard} />

      {/* Property ranking table */}
      <BenchmarkRankingTable
        properties={scorecard.properties}
        averageScore={scorecard.averageScore}
        averageGrossYield={scorecard.averageGrossYield}
        averageNetYield={scorecard.averageNetYield}
      />
    </div>
  );
}
