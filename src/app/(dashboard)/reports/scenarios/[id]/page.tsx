"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Play, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FactorCard } from "@/components/scenarios";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import type { FactorType } from "@/lib/scenarios";

const ScenarioCashFlowChart = dynamic(
  () =>
    import("@/components/reports/ScenarioCashFlowChart").then((m) => ({
      default: m.ScenarioCashFlowChart,
    })),
  {
    loading: () => <ChartSkeleton height={320} />,
    ssr: false,
  }
);

function MetricCard({
  label,
  value,
  suffix = "",
  invertColor = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  invertColor?: boolean;
}) {
  const isPositive = value >= 0;
  const colorClass = invertColor
    ? isPositive
      ? "text-red-600"
      : "text-green-600"
    : isPositive
      ? "text-green-600"
      : "text-red-600";

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-muted-foreground mb-1 text-xs">{label}</p>
        <p className="text-xl font-bold">
          {formatCurrency(Math.abs(value))}
          {suffix}
        </p>
        <p className={`text-xs font-medium ${colorClass}`}>
          {isPositive ? "\u2191" : "\u2193"} {formatCurrency(Math.abs(value))}
          {suffix} projected
        </p>
      </CardContent>
    </Card>
  );
}

export default function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data: properties } = trpc.property.list.useQuery();

  const { data: scenario, isLoading } = trpc.scenario.get.useQuery({ id });

  const runMutation = trpc.scenario.run.useMutation({
    onSuccess: () => {
      toast.success("Projection recalculated");
      utils.scenario.get.invalidate({ id });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <ChartSkeleton height={320} />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Scenario not found</p>
      </div>
    );
  }

  const projection = scenario.projection;
  const summaryMetrics = projection
    ? (JSON.parse(projection.summaryMetrics) as {
        totalIncome: number;
        totalExpenses: number;
        totalNet: number;
        averageMonthlyIncome: number;
        averageMonthlyExpenses: number;
        averageMonthlyNet: number;
        monthsWithNegativeCashFlow: number;
        lowestMonthNet: number;
        highestMonthNet: number;
      })
    : null;
  const monthlyResults: Array<{
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
  }> = projection ? JSON.parse(projection.monthlyResults) : [];

  const chartData = monthlyResults.map((m, i) => ({
    month: format(addMonths(new Date(), i), "MMM yyyy"),
    income: m.totalIncome,
    expenses: m.totalExpenses,
    net: m.netCashFlow,
  }));

  const markers = scenario.factors.map((f) => {
    const typeMap: Record<
      string,
      "rate_change" | "vacancy" | "sale" | "purchase"
    > = {
      interest_rate: "rate_change",
      rent_change: "rate_change",
      expense_change: "rate_change",
      vacancy: "vacancy",
      sell_property: "sale",
      buy_property: "purchase",
    };
    return {
      month: Number(f.startMonth),
      label: f.factorType.replace(/_/g, " "),
      type: typeMap[f.factorType] ?? ("rate_change" as const),
    };
  });

  const propertyList = (properties ?? []).map((p) => ({
    id: p.id,
    address: p.address ?? `Property ${p.id.slice(0, 8)}`,
  }));

  const sellFactors = scenario.factors.filter(
    (f) => f.factorType === "sell_property"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reports/scenarios">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{scenario.name}</h2>
            {scenario.description && (
              <p className="text-muted-foreground">{scenario.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={scenario.status === "saved" ? "default" : "secondary"}
          >
            {scenario.status}
          </Badge>
          {projection?.isStale && <Badge variant="destructive">Stale</Badge>}
          <Button variant="outline" asChild>
            <Link href={`/reports/scenarios/new?branch=${id}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            onClick={() => runMutation.mutate({ id })}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {projection ? "Recalculate" : "Run Projection"}
          </Button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      {summaryMetrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Average Monthly Income"
            value={summaryMetrics.averageMonthlyIncome}
            suffix="/mo"
          />
          <MetricCard
            label="Average Monthly Expenses"
            value={summaryMetrics.averageMonthlyExpenses}
            suffix="/mo"
            invertColor
          />
          <MetricCard
            label="Net Position (Total)"
            value={summaryMetrics.totalNet}
          />
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-muted-foreground mb-1 text-xs">
                Negative Months
              </p>
              <p className="text-xl font-bold">
                {summaryMetrics.monthsWithNegativeCashFlow}
              </p>
              <p className="text-muted-foreground text-xs">
                of {monthlyResults.length} total months
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow Chart */}
      <ScenarioCashFlowChart data={chartData} markers={markers} />

      {/* CGT Breakdown + Factors side by side */}
      <div
        className={sellFactors.length > 0 ? "grid gap-6 lg:grid-cols-2" : ""}
      >
        {/* CGT Breakdown */}
        {sellFactors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Capital Gains Tax Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {sellFactors.map((f) => {
                const config = JSON.parse(f.config) as {
                  propertyId: string;
                  salePrice: number;
                  sellingCosts: number;
                };
                const propName =
                  propertyList.find((p) => p.id === config.propertyId)
                    ?.address ?? "Unknown";
                return (
                  <div key={f.id} className="space-y-2 text-sm">
                    <p className="font-medium">{propName}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Estimated Sale Price
                        </span>
                        <span>{formatCurrency(config.salePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Less: Selling Costs
                        </span>
                        <span>-{formatCurrency(config.sellingCosts)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-muted-foreground">
                          Net Sale Proceeds
                        </span>
                        <span className="font-medium">
                          {formatCurrency(
                            config.salePrice - config.sellingCosts
                          )}
                        </span>
                      </div>
                      <p className="text-muted-foreground pt-1 text-xs">
                        Full CGT calculation (cost base, discount) applied in
                        projection
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Configured Factors */}
        <Card>
          <CardHeader>
            <CardTitle>Scenario Factors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scenario.factors.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No factors configured (base case projection)
              </p>
            ) : (
              scenario.factors.map((factor) => (
                <FactorCard
                  key={factor.id}
                  factorType={factor.factorType as FactorType}
                  config={JSON.parse(factor.config)}
                  startMonth={Number(factor.startMonth)}
                  durationMonths={
                    factor.durationMonths
                      ? Number(factor.durationMonths)
                      : undefined
                  }
                  properties={propertyList}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
