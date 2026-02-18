"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { TaxReportView } from "@/components/reports/TaxReportView";
import { SuggestionList } from "@/components/tax/SuggestionList";
import { DepreciationUpload } from "@/components/tax/DepreciationUpload";
import { FileText, Download, Loader2, Lightbulb, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function TaxReportContent() {
  const currentYear = new Date().getMonth() >= 6
    ? new Date().getFullYear() + 1
    : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");

  const { data: availableYears, isLoading: yearsLoading } =
    trpc.reports.getAvailableYears.useQuery();

  const { data: properties } = trpc.property.list.useQuery();

  const { data: suggestionCount } = trpc.taxOptimization.getSuggestionCount.useQuery();

  const {
    data: taxReport,
    isLoading: reportLoading,
    refetch,
  } = trpc.reports.taxReport.useQuery(
    {
      year: selectedYear,
      propertyId: selectedProperty === "all" ? undefined : selectedProperty,
    },
    { enabled: !!selectedYear }
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Report</h2>
        <p className="text-muted-foreground">
          Generate ATO-compliant rental property tax reports
        </p>
      </div>

      {/* Tax Optimisation Suggestions */}
      {suggestionCount && suggestionCount.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Tax Optimisation Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SuggestionList />
          </CardContent>
        </Card>
      )}

      {/* Depreciation Schedules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Depreciation Schedules</CardTitle>
            <DepreciationUpload />
          </div>
        </CardHeader>
        <CardContent>
          <DepreciationSchedulesList />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Financial Year</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {yearsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : availableYears && availableYears.length > 0 ? (
                    availableYears.map((y) => (
                      <SelectItem key={y.year} value={String(y.year)}>
                        {y.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(currentYear)}>
                      FY {currentYear - 1}-{String(currentYear).slice(-2)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={selectedProperty}
                onValueChange={setSelectedProperty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              <Button variant="outline" disabled={!taxReport}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report View */}
      {reportLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Generating report...</p>
            </div>
          </CardContent>
        </Card>
      ) : taxReport ? (
        <TaxReportView data={taxReport} />
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>Select a financial year to generate your tax report</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DepreciationSchedulesList() {
  const { data: schedules, isLoading } =
    trpc.taxOptimization.getDepreciationSchedules.useQuery({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!schedules || schedules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No depreciation schedules uploaded yet. Upload a quantity surveyor report to track depreciation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="border rounded-lg">
          <div className="flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{schedule.property?.address}</p>
              <p className="text-sm text-muted-foreground">
                {schedule.assets?.length || 0} assets • $
                {parseFloat(schedule.totalValue).toLocaleString()} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Effective {schedule.effectiveDate}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExpandedId(expandedId === schedule.id ? null : schedule.id)
                }
              >
                {expandedId === schedule.id ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span className="ml-1 text-xs">Projection</span>
              </Button>
            </div>
          </div>
          {expandedId === schedule.id && (
            <DepreciationProjection scheduleId={schedule.id} />
          )}
        </div>
      ))}
    </div>
  );
}

function DepreciationProjection({ scheduleId }: { scheduleId: string }) {
  const { data, isLoading } = trpc.taxOptimization.getDepreciationProjection.useQuery({
    scheduleId,
    years: 10,
  });

  if (isLoading) {
    return (
      <div className="px-3 pb-3">
        <p className="text-sm text-muted-foreground">Loading projection...</p>
      </div>
    );
  }

  if (!data || data.yearlyTotals.length === 0) {
    return (
      <div className="px-3 pb-3">
        <p className="text-sm text-muted-foreground">No projection data available.</p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-3 border-t">
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-4 text-muted-foreground font-medium">Year</th>
              <th className="text-right py-1 px-4 font-medium">Total Deduction</th>
              <th className="text-right py-1 px-4 font-medium">Remaining Value</th>
            </tr>
          </thead>
          <tbody>
            {data.yearlyTotals.map((row) => (
              <tr key={row.year} className="border-b last:border-0">
                <td className="py-1 pr-4 text-muted-foreground">{row.year}</td>
                <td className="text-right py-1 px-4 font-mono">
                  {formatCurrency(row.totalDeduction)}
                </td>
                <td className="text-right py-1 px-4 font-mono">
                  {formatCurrency(row.totalRemaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
