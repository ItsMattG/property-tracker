"use client";

import dynamic from "next/dynamic";
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
import { Building2, DollarSign, TrendingUp, Percent, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

const EquityDonutChart = dynamic(
  () =>
    import("./EquityDonutChart").then((m) => ({ default: m.EquityDonutChart })),
  {
    loading: () => (
      <div className="h-[300px] bg-muted animate-pulse rounded" />
    ),
    ssr: false,
  }
);

const CashFlowBarChart = dynamic(
  () =>
    import("./CashFlowBarChart").then((m) => ({ default: m.CashFlowBarChart })),
  {
    loading: () => (
      <div className="h-[300px] bg-muted animate-pulse rounded" />
    ),
    ssr: false,
  }
);

interface PortfolioSummary {
  propertyCount: number;
  totalValue: number;
  totalDebt: number;
  totalEquity: number;
  portfolioLVR: number | null;
  cashFlow: number;
  averageYield: number | null;
}

interface PropertyMetrics {
  propertyId: string;
  suburb: string;
  state: string;
  currentValue: number;
  equity: number;
  cashFlow: number;
  lvr: number | null;
}

interface AggregatedViewProps {
  summary: PortfolioSummary;
  properties: PropertyMetrics[];
  period: string;
}

export function AggregatedView({ summary, properties, period }: AggregatedViewProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "-";

  const periodLabel = period === "monthly" ? "Monthly" : period === "quarterly" ? "Quarterly" : "Annual";

  // Prepare chart data
  const equityData = properties
    .filter((p) => p.equity > 0)
    .map((p) => ({
      name: `${p.suburb}, ${p.state}`,
      value: p.equity,
    }));

  const cashFlowData = properties.map((p) => ({
    name: p.suburb,
    cashFlow: p.cashFlow,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Portfolio Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Debt
            </CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalDebt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Equity
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalEquity)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio LVR
            </CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(summary.portfolioLVR)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Properties
            </CardTitle>
            <Hash className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.propertyCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {periodLabel} Cash Flow
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              summary.cashFlow >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(summary.cashFlow)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Yield
            </CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(summary.averageYield)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Equity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityDonutChart data={equityData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow by Property</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowBarChart data={cashFlowData} />
          </CardContent>
        </Card>
      </div>

      {/* Property Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Property Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">LVR</TableHead>
                <TableHead className="text-right">Cash Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.propertyId}>
                  <TableCell>
                    <Link
                      href={`/properties/${property.propertyId}`}
                      className="hover:underline font-medium"
                    >
                      {property.suburb}, {property.state}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(property.currentValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(property.equity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercent(property.lvr)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right",
                    property.cashFlow >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(property.cashFlow)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
