"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank, Check, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type {
  BenchmarkStatus,
  CategoryBenchmark,
  ManagementFeeBenchmark,
} from "@/types/benchmarking";
import { cn } from "@/lib/utils";

interface BenchmarkCardProps {
  propertyId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusIcon({ status }: { status: BenchmarkStatus }) {
  if (status === "above") {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
  return <Check className="h-4 w-4 text-green-500" />;
}

function StatusLabel({ status }: { status: BenchmarkStatus }) {
  const labels: Record<BenchmarkStatus, { text: string; className: string }> = {
    below: { text: "Below Average", className: "text-green-600" },
    average: { text: "Average", className: "text-muted-foreground" },
    above: { text: "Above Average", className: "text-amber-600" },
  };
  const { text, className } = labels[status];
  return <span className={cn("text-sm font-medium", className)}>{text}</span>;
}

function BenchmarkRow({
  label,
  benchmark,
  showPercent,
}: {
  label: string;
  benchmark: CategoryBenchmark | ManagementFeeBenchmark | null;
  showPercent?: boolean;
}) {
  if (!benchmark) return null;

  const isManagement = showPercent && "userPercent" in benchmark;

  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <StatusIcon status={benchmark.status} />
        </div>
        <div className="text-sm text-muted-foreground">
          {isManagement ? (
            <>
              Your rate: {(benchmark as ManagementFeeBenchmark).userPercent}% ·
              Avg: {(benchmark as ManagementFeeBenchmark).averagePercent}%
            </>
          ) : (
            <>
              {formatCurrency(benchmark.userAmount)}/yr · Avg:{" "}
              {formatCurrency(benchmark.averageAmount)}
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <StatusLabel status={benchmark.status} />
        {benchmark.potentialSavings > 0 && (
          <p className="text-sm text-amber-600">
            Save ~{formatCurrency(benchmark.potentialSavings)}
          </p>
        )}
      </div>
    </div>
  );
}

export function BenchmarkCard({ propertyId }: BenchmarkCardProps) {
  const { data: benchmark, isLoading } =
    trpc.benchmarking.getPropertyBenchmark.useQuery({
      propertyId,
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Don't show card if no benchmark data
  if (
    !benchmark ||
    (!benchmark.insurance &&
      !benchmark.councilRates &&
      !benchmark.managementFees)
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PiggyBank className="w-5 h-5 text-emerald-500" />
          </div>
          <CardTitle>Cost Benchmarking</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          <BenchmarkRow label="Insurance" benchmark={benchmark.insurance} />
          <BenchmarkRow
            label="Council Rates"
            benchmark={benchmark.councilRates}
          />
          <BenchmarkRow
            label="Management Fees"
            benchmark={benchmark.managementFees}
            showPercent
          />
        </div>

        {benchmark.totalPotentialSavings > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Potential Savings</span>
              <span className="text-lg font-bold text-emerald-600">
                {formatCurrency(benchmark.totalPotentialSavings)}/year
              </span>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Compared against state averages from industry data. Based on last 12
          months of transactions.
        </p>
      </CardContent>
    </Card>
  );
}
