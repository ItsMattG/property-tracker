"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc/client";
import {
  generateTaxReportPDF,
  generateTransactionsExcel,
  downloadBlob,
} from "@/lib/export-utils";
import { Download, FileSpreadsheet, FileText, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export default function AccountantExportPage() {
  const currentYear =
    new Date().getMonth() >= 6
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [includePDF, setIncludePDF] = useState(true);
  const [includeExcel, setIncludeExcel] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();
  const { data: taxReport } = trpc.reports.taxReport.useQuery(
    { year: selectedYear },
    { enabled: !!selectedYear }
  );

  const handleExportPDF = async () => {
    if (!taxReport) return;

    try {
      const blob = await generateTaxReportPDF(taxReport);
      downloadBlob(blob, `tax-report-${taxReport.financialYear}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      toast.error("Failed to generate PDF");
    }
  };

  const handleExportExcel = async () => {
    if (!taxReport) return;

    try {
      // Get all transactions for the FY
      const transactions = taxReport.properties.flatMap((p) =>
        p.atoBreakdown.map((item) => ({
          date: "",
          description: item.label,
          amount: String(item.amount),
          category: item.label,
          property: p.property,
          isDeductible: item.isDeductible,
          isVerified: true,
        }))
      );

      const blob = await generateTransactionsExcel(transactions, taxReport.financialYear);
      downloadBlob(blob, `transactions-${taxReport.financialYear}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (error) {
      toast.error("Failed to generate Excel");
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      if (includePDF) await handleExportPDF();
      if (includeExcel) await handleExportExcel();
      toast.success("Export package complete");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Accountant Export</h2>
        <p className="text-muted-foreground">
          Generate a complete export package for your accountant
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>
            Select the financial year and files to include
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Selection */}
          <div className="space-y-2">
            <Label>Financial Year</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears?.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                )) || (
                  <SelectItem value={String(currentYear)}>
                    FY {currentYear - 1}-{String(currentYear).slice(-2)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* File Selection */}
          <div className="space-y-4">
            <Label>Include in Export</Label>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="pdf"
                checked={includePDF}
                onCheckedChange={(checked) => setIncludePDF(checked === true)}
              />
              <label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                <span>Tax Summary (PDF)</span>
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="excel"
                checked={includeExcel}
                onCheckedChange={(checked) => setIncludeExcel(checked === true)}
              />
              <label htmlFor="excel" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span>Transaction Details (Excel)</span>
              </label>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleExportAll}
              disabled={isExporting || (!includePDF && !includeExcel) || !taxReport}
              className="flex-1"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Export Package
            </Button>
          </div>

          {/* Individual Downloads */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Or download individually:
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={!taxReport}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!taxReport}
              >
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {taxReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview - {taxReport.financialYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p>
                <strong>Properties:</strong> {taxReport.properties.length}
              </p>
              <p>
                <strong>Total Income:</strong>{" "}
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: "AUD",
                }).format(taxReport.totals.totalIncome)}
              </p>
              <p>
                <strong>Total Deductions:</strong>{" "}
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: "AUD",
                }).format(taxReport.totals.totalDeductible)}
              </p>
              <p>
                <strong>Net Rental Income:</strong>{" "}
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: "AUD",
                }).format(taxReport.totals.netIncome)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
