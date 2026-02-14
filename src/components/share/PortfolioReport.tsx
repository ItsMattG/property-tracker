"use client";

import type { PortfolioSnapshot } from "@/server/services/share";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface PortfolioReportProps {
  data: PortfolioSnapshot;
  privacyMode: string;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function PortfolioReport({ data, privacyMode }: PortfolioReportProps) {
  const { summary, properties } = data;
  const isRedacted = privacyMode === "redacted";
  const isSummaryOnly = privacyMode === "summary";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Properties Count Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.propertyCount}</div>
            <p className="text-xs text-muted-foreground">
              {summary.states.join(", ")}
            </p>
          </CardContent>
        </Card>

        {/* Total Equity Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Equity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRedacted ? (
              <div className="text-2xl font-bold text-muted-foreground">
                Redacted
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {summary.totalEquity === undefined ? "-" : formatCurrency(summary.totalEquity)}
              </div>
            )}
            {!isRedacted && summary.totalValue !== undefined && (
              <p className="text-xs text-muted-foreground">
                of {summary.totalValue === undefined ? "-" : formatCurrency(summary.totalValue)} value
              </p>
            )}
          </CardContent>
        </Card>

        {/* Portfolio LVR Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio LVR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(summary.portfolioLVR)}
            </div>
            <p className="text-xs text-muted-foreground">Loan to Value Ratio</p>
          </CardContent>
        </Card>

        {/* Cash Flow / Yield Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isRedacted ? "Cash Flow" : "Gross Yield"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRedacted ? (
              <div>
                {summary.cashFlowPositive !== undefined ? (
                  <Badge
                    variant={summary.cashFlowPositive ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {summary.cashFlowPositive ? "Positive" : "Negative"}
                  </Badge>
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">-</span>
                )}
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatPercent(summary.averageYield)}
                </div>
                {summary.cashFlow !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {summary.cashFlow === undefined ? "-" : formatCurrency(summary.cashFlow)}/yr cash flow
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property Breakdown Table - Only shown if not summary mode */}
      {!isSummaryOnly && properties && properties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Property Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  {!isRedacted && <TableHead className="text-right">Value</TableHead>}
                  <TableHead className="text-right">LVR</TableHead>
                  <TableHead className="text-right">Yield</TableHead>
                  <TableHead className="text-right">Portfolio %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="font-medium">
                        {property.address || property.suburb}
                      </div>
                      {property.address && (
                        <div className="text-sm text-muted-foreground">
                          {property.suburb}, {property.state}
                        </div>
                      )}
                      {!property.address && (
                        <div className="text-sm text-muted-foreground">
                          {property.state}
                        </div>
                      )}
                    </TableCell>
                    {!isRedacted && (
                      <TableCell className="text-right">
                        {property.currentValue === undefined ? "-" : formatCurrency(property.currentValue)}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {formatPercent(property.lvr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(property.grossYield)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(property.portfolioPercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
