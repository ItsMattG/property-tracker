"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PieChart, Download, TrendingUp, Calculator } from "lucide-react";

const reportTypes = [
  {
    title: "Tax Report",
    description: "Generate ATO-compliant rental property tax reports for your financial year",
    icon: FileText,
    href: "/reports/tax",
  },
  {
    title: "Portfolio Dashboard",
    description: "Monitor cash flow, yields, and performance across all properties",
    icon: PieChart,
    href: "/reports/portfolio",
  },
  {
    title: "Accountant Export",
    description: "Download a complete export package for your accountant",
    icon: Download,
    href: "/reports/export",
  },
  {
    title: "Capital Gains Tax",
    description: "Track cost base, record sales, and calculate CGT with 50% discount",
    icon: Calculator,
    href: "/reports/cgt",
  },
  {
    title: "Cash Flow Forecast",
    description: "12-month projections with scenario modeling",
    icon: TrendingUp,
    href: "/reports/forecast",
  },
];

export default function ReportsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-muted-foreground">
          Generate reports and exports for tax time and portfolio analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
