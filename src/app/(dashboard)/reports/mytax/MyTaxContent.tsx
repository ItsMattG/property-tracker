"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, Info } from "lucide-react";
import { generateMyTaxPDF } from "@/lib/mytax-pdf";
import { downloadBlob } from "@/lib/export-utils";
import { MyTaxChecklist } from "./MyTaxChecklist";

export function MyTaxContent() {
  const currentFY =
    new Date().getMonth() >= 6
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentFY);

  const { data: years, isLoading: yearsLoading } =
    trpc.reports.getAvailableYears.useQuery();

  const { data: report, isLoading: reportLoading } =
    trpc.mytax.getReport.useQuery(
      { year: selectedYear },
      { enabled: !!selectedYear }
    );

  const handleExportPDF = () => {
    if (!report) return;
    const blob = generateMyTaxPDF(report);
    downloadBlob(blob, `MyTax-Report-${report.financialYear}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MyTax Export</h2>
          <p className="text-muted-foreground">
            ATO-aligned rental property report for your tax return
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select FY" />
            </SelectTrigger>
            <SelectContent>
              {yearsLoading ? (
                <SelectItem value={String(currentFY)}>
                  FY {currentFY - 1}-{String(currentFY).slice(-2)}
                </SelectItem>
              ) : (
                years?.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleExportPDF} disabled={!report || reportLoading}>
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          This is a reference document — not an official ATO submission. Consult
          your tax professional before lodging.
        </span>
      </div>

      {reportLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      ) : report ? (
        report.properties.length === 0 && !report.personalSummary ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No transaction data found for {report.financialYear}. Add
              transactions to generate your MyTax report.
            </CardContent>
          </Card>
        ) : (
          <MyTaxChecklist report={report} />
        )
      ) : null}
    </div>
  );
}
