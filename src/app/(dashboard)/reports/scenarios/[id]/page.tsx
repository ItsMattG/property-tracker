"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, addMonths } from "date-fns";

export default function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();

  const { data: scenario, isLoading } = trpc.scenario.get.useQuery({ id });

  const runMutation = trpc.scenario.run.useMutation({
    onSuccess: () => {
      toast.success("Projection recalculated");
      utils.scenario.get.invalidate({ id });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Scenario not found</p>
      </div>
    );
  }

  const projection = scenario.projection;
  const summaryMetrics = projection
    ? JSON.parse(projection.summaryMetrics)
    : null;
  const monthlyResults = projection
    ? JSON.parse(projection.monthlyResults)
    : [];

  // Format chart data
  const chartData = monthlyResults.map((m: { totalIncome: number; totalExpenses: number; netCashFlow: number }, i: number) => ({
    month: format(addMonths(new Date(), i), "MMM yyyy"),
    income: m.totalIncome,
    expenses: m.totalExpenses,
    net: m.netCashFlow,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reports/scenarios">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
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
          <Badge variant={scenario.status === "saved" ? "default" : "secondary"}>
            {scenario.status}
          </Badge>
          {projection?.isStale && (
            <Badge variant="destructive">Stale</Badge>
          )}
          <Button
            onClick={() => runMutation.mutate({ id })}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {projection ? "Recalculate" : "Run Projection"}
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      {summaryMetrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold">
                  ${summaryMetrics.totalIncome?.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-2xl font-bold">
                  ${summaryMetrics.totalExpenses?.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span
                  className={`text-2xl font-bold ${
                    summaryMetrics.totalNet >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${summaryMetrics.totalNet?.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Negative Months
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summaryMetrics.monthsWithNegativeCashFlow > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
                <span className="text-2xl font-bold">
                  {summaryMetrics.monthsWithNegativeCashFlow}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => `$${Number(value).toLocaleString()}`}
                  />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#22c55e"
                    name="Income"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    name="Expenses"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#3b82f6"
                    name="Net"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Factors Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Factors</CardTitle>
        </CardHeader>
        <CardContent>
          {scenario.factors.length === 0 ? (
            <p className="text-muted-foreground">No factors configured (base case)</p>
          ) : (
            <div className="space-y-2">
              {scenario.factors.map((factor) => {
                const config = JSON.parse(factor.config);
                return (
                  <div
                    key={factor.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {factor.factorType.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {JSON.stringify(config)}
                      </p>
                    </div>
                    <Badge variant="outline">
                      Month {factor.startMonth}
                      {factor.durationMonths && ` - ${Number(factor.startMonth) + Number(factor.durationMonths)}`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
