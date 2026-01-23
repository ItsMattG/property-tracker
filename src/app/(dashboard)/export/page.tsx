"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { format, startOfYear, endOfYear, subYears } from "date-fns";

export default function ExportPage() {
  const { data: properties } = trpc.property.list.useQuery();
  const currentYear = new Date().getFullYear();

  const [exportType, setExportType] = useState<"transactions" | "summary">("transactions");
  const [propertyId, setPropertyId] = useState<string>("all");
  const [financialYear, setFinancialYear] = useState<string>(currentYear.toString());
  const [includePersonal, setIncludePersonal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Calculate date range for financial year (1 July - 30 June)
      const fyStartYear = parseInt(financialYear) - 1;
      const startDate = `${fyStartYear}-07-01`;
      const endDate = `${financialYear}-06-30`;

      // Build query params
      const params = new URLSearchParams({
        type: exportType,
        startDate,
        endDate,
        includePersonal: includePersonal.toString(),
      });

      if (propertyId !== "all") {
        params.append("propertyId", propertyId);
      }

      // Trigger download
      const response = await fetch(`/api/export/csv?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `property-tracker-${exportType}-fy${financialYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Export Data</h2>
        <p className="text-muted-foreground">
          Export your transaction data for your accountant or tax return
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
          <CardDescription>
            Choose what data to export and the format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Export Type</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setExportType("transactions")}
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  exportType === "transactions"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <FileSpreadsheet className="w-6 h-6 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Transactions</div>
                  <div className="text-xs text-muted-foreground">
                    All individual transactions
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExportType("summary")}
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  exportType === "summary"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <FileText className="w-6 h-6 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Annual Summary</div>
                  <div className="text-xs text-muted-foreground">
                    Totals by category
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="financial-year">Financial Year</Label>
              <Select value={financialYear} onValueChange={setFinancialYear}>
                <SelectTrigger id="financial-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4].map((offset) => {
                    const year = currentYear - offset;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        FY {year - 1}/{year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger id="property">
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All properties</SelectItem>
                  {properties?.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-personal"
              checked={includePersonal}
              onCheckedChange={(checked) => setIncludePersonal(checked === true)}
            />
            <Label htmlFor="include-personal" className="text-sm font-normal">
              Include personal (non-property) transactions
            </Label>
          </div>

          <div className="border-t pt-6">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
              size="lg"
            >
              <FileDown className="w-4 h-4 mr-2" />
              {isExporting ? "Generating..." : "Download CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>For your accountant:</strong> Export the "Transactions"
            report with all properties. This includes ATO category codes for
            easy tax return preparation.
          </p>
          <p>
            <strong>For your records:</strong> The "Annual Summary" provides
            quick totals by category, perfect for reviewing your tax position.
          </p>
          <p>
            <strong>Tip:</strong> Review and verify all transactions before
            exporting to ensure accuracy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
