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
import { FileText, Download, Loader2, Lightbulb } from "lucide-react";

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

      {/* Tax Optimization Suggestions */}
      {suggestionCount && suggestionCount.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Tax Optimization Suggestions
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
        <div
          key={schedule.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div>
            <p className="font-medium">{schedule.property?.address}</p>
            <p className="text-sm text-muted-foreground">
              {schedule.assets?.length || 0} assets • $
              {parseFloat(schedule.totalValue).toLocaleString()} total
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Effective {schedule.effectiveDate}
          </p>
        </div>
      ))}
    </div>
  );
}
