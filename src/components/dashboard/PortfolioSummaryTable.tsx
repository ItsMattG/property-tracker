"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import { TableProperties } from "lucide-react";

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

export function PortfolioSummaryTable() {
  const { data: metrics, isLoading } = trpc.portfolio.getPropertyMetrics.useQuery(
    { period: "annual", sortBy: "alphabetical", sortOrder: "asc" },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Summary</CardTitle>
          <TableProperties className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) return null;

  // Compute totals from the metrics array
  const totals = metrics.reduce(
    (acc, m) => ({
      value: acc.value + m.currentValue,
      loans: acc.loans + m.totalLoans,
      equity: acc.equity + m.equity,
      cash: acc.cash + m.cashFlow,
    }),
    { value: 0, loans: 0, equity: 0, cash: 0 }
  );
  const totalLvr = totals.value > 0 ? (totals.loans / totals.value) * 100 : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Portfolio Summary</CardTitle>
        <TableProperties className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Property</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Loan</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">LVR</TableHead>
                <TableHead className="text-right pr-6">Cash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.propertyId}>
                  <TableCell className="pl-6 font-medium">
                    <Link
                      href={`/properties/${m.propertyId}`}
                      className="hover:underline"
                    >
                      {m.suburb}, {m.state}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.currentValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.totalLoans)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.equity)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      m.lvr !== null && m.lvr > 80 && "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {formatPercent(m.lvr)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums pr-6",
                      m.cashFlow >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {formatCurrency(m.cashFlow)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="border-t-2 font-bold bg-muted/50">
                <TableCell className="pl-6">Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.value)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.loans)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.equity)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    totalLvr !== null && totalLvr > 80 && "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {formatPercent(totalLvr)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums pr-6",
                    totals.cash >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {formatCurrency(totals.cash)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
