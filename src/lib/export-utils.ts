import jsPDF from "jspdf";
import * as XLSX from "xlsx";

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export function generateTaxReportPDF(data: TaxReportData): Blob {
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
  doc.text(`Total Income: ${formatCurrency(data.totals.totalIncome)}`, 20, y);
  y += 6;
  doc.text(`Total Deductions: ${formatCurrency(data.totals.totalDeductible)}`, 20, y);
  y += 6;
  doc.text(`Net Rental Income: ${formatCurrency(data.totals.netIncome)}`, 20, y);
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
    const income = report.atoBreakdown.filter((i) => !i.isDeductible && i.amount > 0);
    if (income.length > 0) {
      doc.text("Income:", 20, y);
      y += 5;
      for (const item of income) {
        doc.text(`  ${item.label}: ${formatCurrency(item.amount)}`, 20, y);
        y += 5;
      }
    }

    // Deductions
    const deductions = report.atoBreakdown.filter((i) => i.isDeductible && i.amount !== 0);
    if (deductions.length > 0) {
      doc.text("Deductions:", 20, y);
      y += 5;
      for (const item of deductions) {
        const ref = item.atoReference ? `[${item.atoReference}] ` : "";
        doc.text(`  ${ref}${item.label}: ${formatCurrency(Math.abs(item.amount))}`, 20, y);
        y += 5;
      }
    }

    doc.text(`Net: ${formatCurrency(report.metrics.netIncome)}`, 20, y);
    y += 15;
  }

  // Footer
  doc.setFontSize(8);
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-AU")} by PropertyTracker`,
    20,
    285
  );

  return doc.output("blob");
}

export function generateTransactionsExcel(
  transactions: Array<{
    date: string;
    description: string;
    amount: string;
    category: string;
    property?: { address: string } | null;
    isDeductible: boolean;
    isVerified: boolean;
  }>,
  financialYear: string
): Blob {
  const data = transactions.map((t) => ({
    Date: t.date,
    Property: t.property?.address || "Unassigned",
    Description: t.description,
    Amount: Number(t.amount),
    Category: t.category,
    Deductible: t.isDeductible ? "Yes" : "No",
    Verified: t.isVerified ? "Yes" : "No",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, financialYear);

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
