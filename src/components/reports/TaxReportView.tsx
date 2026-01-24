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

interface PropertyReport {
  property: {
    id: string;
    address: string;
    suburb: string;
    state: string;
    entityName: string;
  };
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
  atoBreakdown: Array<{
    category: string;
    label: string;
    amount: number;
    atoReference?: string;
    isDeductible: boolean;
  }>;
  transactionCount: number;
}

interface TaxReportData {
  financialYear: string;
  startDate: string;
  endDate: string;
  properties: PropertyReport[];
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
  generatedAt: string;
}

interface TaxReportViewProps {
  data: TaxReportData;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export function TaxReportView({ data }: TaxReportViewProps) {
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Summary - {data.financialYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.totals.totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data.totals.totalExpenses)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Income</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.totals.netIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Deductible</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.totals.totalDeductible)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Property Breakdown */}
      {data.properties.map((report) => (
        <Card key={report.property.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {report.property.address}, {report.property.suburb}{" "}
              {report.property.state}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Entity: {report.property.entityName} •{" "}
              {report.transactionCount} transactions
            </p>
          </CardHeader>
          <CardContent>
            {/* Income Section */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">Income</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.atoBreakdown
                    .filter((item) => !item.isDeductible && item.amount > 0)
                    .map((item) => (
                      <TableRow key={item.category}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-bold">
                    <TableCell>Total Income</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(report.metrics.totalIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Deductions Section */}
            <div>
              <h4 className="font-medium mb-2">Deductions</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ATO Ref</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.atoBreakdown
                    .filter((item) => item.isDeductible && item.amount !== 0)
                    .map((item) => (
                      <TableRow key={item.category}>
                        <TableCell className="text-muted-foreground">
                          {item.atoReference || "-"}
                        </TableCell>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Math.abs(item.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-bold">
                    <TableCell></TableCell>
                    <TableCell>Total Deductions</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.metrics.totalDeductible)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Net Result */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-bold">Net Rental Income</span>
                <span
                  className={`text-xl font-bold ${
                    report.metrics.netIncome >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(report.metrics.netIncome)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
