"use client";

import { useState } from "react";
import Link from "next/link";
import { format, addMonths } from "date-fns";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

const LINE_STYLES: Array<string | undefined> = [undefined, "5 5", "3 3", "8 3"];

export default function CompareScenarios() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: scenarios } = trpc.scenario.list.useQuery();

  // Fetch details for each selected scenario
  const scenarioQueries = selectedIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.scenario.get.useQuery({ id }, { enabled: !!id })
  );

  function addScenario(id: string) {
    if (selectedIds.length < 4 && !selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  }

  function removeScenario(id: string) {
    setSelectedIds((prev) => prev.filter((s) => s !== id));
  }

  const availableScenarios = (scenarios ?? []).filter(
    (s) => !selectedIds.includes(s.id) && s.projection
  );

  // Build combined chart data
  const chartDataMap = new Map<string, Record<string, number>>();
  scenarioQueries.forEach((q, idx) => {
    if (!q.data?.projection) return;
    const monthlyResults: Array<{ netCashFlow: number }> = JSON.parse(
      q.data.projection.monthlyResults
    );
    monthlyResults.forEach((m, monthIdx) => {
      const label = format(addMonths(new Date(), monthIdx), "MMM yyyy");
      const existing = chartDataMap.get(label) ?? {};
      existing[`net_${idx}`] = m.netCashFlow;
      chartDataMap.set(label, existing);
    });
  });

  const chartData = Array.from(chartDataMap.entries()).map(([month, values]) => ({
    month,
    ...values,
  }));

  // Build metrics table
  const metricsRows = [
    { label: "Total Income", key: "totalIncome" },
    { label: "Total Expenses", key: "totalExpenses" },
    { label: "Net Position", key: "totalNet" },
    { label: "Avg Monthly Net", key: "averageMonthlyNet" },
    { label: "Negative Months", key: "monthsWithNegativeCashFlow", isCurrency: false },
    { label: "Lowest Month", key: "lowestMonthNet" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports/scenarios">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Compare Scenarios</h2>
          <p className="text-muted-foreground">
            Select up to 4 scenarios to compare side-by-side
          </p>
        </div>
      </div>

      {/* Scenario Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            {selectedIds.map((id, idx) => {
              const s = scenarios?.find((sc) => sc.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[idx] }}
                  />
                  <span>{s?.name ?? "Loading..."}</span>
                  <button
                    onClick={() => removeScenario(id)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Remove ${s?.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {selectedIds.length < 4 && availableScenarios.length > 0 && (
              <Select onValueChange={addScenario}>
                <SelectTrigger className="w-auto">
                  <Plus className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Add scenario" />
                </SelectTrigger>
                <SelectContent>
                  {availableScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Table */}
      {selectedIds.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Metrics Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                      Metric
                    </th>
                    {scenarioQueries.map((q, idx) => (
                      <th key={idx} className="text-right py-2 px-4 font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx] }}
                          />
                          {q.data?.name ?? "..."}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricsRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {row.label}
                      </td>
                      {scenarioQueries.map((q, idx) => {
                        const metrics = q.data?.projection
                          ? JSON.parse(q.data.projection.summaryMetrics)
                          : null;
                        const value = metrics?.[row.key];
                        return (
                          <td key={idx} className="text-right py-2 px-4 font-mono">
                            {value !== undefined
                              ? row.isCurrency === false
                                ? value
                                : formatCurrency(value)
                              : "\u2014"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overlaid Chart */}
      {selectedIds.length >= 2 && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Net Cash Flow Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                  {scenarioQueries.map((q, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={`net_${idx}`}
                      stroke={CHART_COLORS[idx]}
                      name={q.data?.name ?? `Scenario ${idx + 1}`}
                      strokeWidth={2}
                      strokeDasharray={LINE_STYLES[idx]}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedIds.length < 2 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              Select at least 2 scenarios with projections to compare
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
