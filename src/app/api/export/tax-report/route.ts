import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import jsPDF from "jspdf";
import { formatCurrencyWithCents } from "@/lib/utils";

interface TaxReportData {
  financialYear: string;
  properties: Array<{
    property: {
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
      label: string;
      amount: number;
      atoReference?: string;
      isDeductible: boolean;
    }>;
  }>;
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data: TaxReportData = await req.json();

    const doc = new jsPDF();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.text(`Rental Property Tax Report - ${data.financialYear}`, 20, y);
    y += 15;

    // Summary
    doc.setFontSize(14);
    doc.text("Summary", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Total Income: ${formatCurrencyWithCents(data.totals.totalIncome)}`, 20, y);
    y += 6;
    doc.text(
      `Total Deductions: ${formatCurrencyWithCents(data.totals.totalDeductible)}`,
      20,
      y
    );
    y += 6;
    doc.text(
      `Net Rental Income: ${formatCurrencyWithCents(data.totals.netIncome)}`,
      20,
      y
    );
    y += 15;

    // Per Property
    for (const report of data.properties) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.text(
        `${report.property.address}, ${report.property.suburb} ${report.property.state}`,
        20,
        y
      );
      y += 6;

      doc.setFontSize(9);
      doc.text(`Entity: ${report.property.entityName}`, 20, y);
      y += 8;

      // Income
      const income = report.atoBreakdown.filter(
        (i) => !i.isDeductible && i.amount > 0
      );
      if (income.length > 0) {
        doc.text("Income:", 20, y);
        y += 5;
        for (const item of income) {
          doc.text(`  ${item.label}: ${formatCurrencyWithCents(item.amount)}`, 20, y);
          y += 5;
        }
      }

      // Deductions
      const deductions = report.atoBreakdown.filter(
        (i) => i.isDeductible && i.amount !== 0
      );
      if (deductions.length > 0) {
        doc.text("Deductions:", 20, y);
        y += 5;
        for (const item of deductions) {
          const ref = item.atoReference ? `[${item.atoReference}] ` : "";
          doc.text(
            `  ${ref}${item.label}: ${formatCurrencyWithCents(Math.abs(item.amount))}`,
            20,
            y
          );
          y += 5;
        }
      }

      doc.text(`Net: ${formatCurrencyWithCents(report.metrics.netIncome)}`, 20, y);
      y += 15;
    }

    // Footer
    doc.setFontSize(8);
    doc.text(
      `Generated on ${new Date().toLocaleDateString("en-AU")} by BrickTrack`,
      20,
      285
    );

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tax-report-${data.financialYear}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate tax report PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
