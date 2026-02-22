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
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { TableProperties } from "lucide-react";

export function PortfolioSummaryTable() {
  const { data: metrics, isLoading } = trpc.portfolio.getPropertyMetrics.useQuery(
    { period: "annual", sortBy: "alphabetical", sortOrder: "asc" },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Portfolio Summary</CardTitle>
        <TableProperties className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {/* Mobile: card list */}
        <div className="md:hidden divide-y">
          {metrics.map((m) => (
            <Link
              key={m.propertyId}
              href={`/properties/${m.propertyId}`}
              prefetch={false}
              className="block px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{m.suburb}, {m.state}</span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    m.cashFlow >= 0
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  )}
                >
                  {formatCurrency(m.cashFlow)}/mo
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Val {formatCurrency(m.currentValue)}</span>
                <span>Loan {formatCurrency(m.totalLoans)}</span>
                <span>LVR {m.lvr === null ? "\u2014" : formatPercent(m.lvr)}</span>
              </div>
            </Link>
          ))}
          <div className="px-4 py-3 bg-muted/50 flex items-center justify-between text-sm font-bold">
            <span>Total</span>
            <span
              className={cn(
                "tabular-nums",
                totals.cash >= 0
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              )}
            >
              {formatCurrency(totals.cash)}/mo
            </span>
          </div>
        </div>

        {/* Desktop: table view */}
        <div className="hidden md:block overflow-x-auto">
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
                <TableRow key={m.propertyId} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="pl-6 font-medium">
                    <Link
                      href={`/properties/${m.propertyId}`}
                      prefetch={false}
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
                    {m.lvr === null ? "\u2014" : formatPercent(m.lvr)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums pr-6",
                      m.cashFlow >= 0
                        ? "text-green-700 dark:text-green-300"
                        : "text-red-700 dark:text-red-300"
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
                  {totalLvr === null ? "\u2014" : formatPercent(totalLvr)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums pr-6",
                    totals.cash >= 0
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
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
