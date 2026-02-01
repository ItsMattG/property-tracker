import jsPDF from "jspdf";
import type { MyTaxReport, MyTaxPropertyReport } from "@/server/services/mytax";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function addPropertyPage(doc: jsPDF, prop: MyTaxPropertyReport, y: number): number {
  // Property header
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${prop.address}, ${prop.suburb} ${prop.state}`, 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Entity: ${prop.entityName}`, 20, y);
  y += 10;

  // Income section
  if (prop.income.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Income", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const item of prop.income) {
      doc.text(item.label, 25, y);
      doc.text(formatCurrency(item.amount), 160, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Deductions section
  if (prop.deductions.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Deductions (Item 21)", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const item of prop.deductions) {
      const ref = item.atoCode ? `[${item.atoCode}] ` : "";
      doc.text(`${ref}${item.label}`, 25, y);
      doc.text(formatCurrency(item.amount), 160, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Depreciation
  if (prop.depreciation.capitalWorks > 0 || prop.depreciation.plantEquipment > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Depreciation", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (prop.depreciation.capitalWorks > 0) {
      doc.text("[D14] Capital Works", 25, y);
      doc.text(formatCurrency(prop.depreciation.capitalWorks), 160, y, { align: "right" });
      y += 5;
    }
    if (prop.depreciation.plantEquipment > 0) {
      doc.text("Plant & Equipment", 25, y);
      doc.text(formatCurrency(prop.depreciation.plantEquipment), 160, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Property total
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.line(20, y, 170, y);
  y += 5;
  doc.text("Total Income:", 25, y);
  doc.text(formatCurrency(prop.totalIncome), 160, y, { align: "right" });
  y += 5;
  doc.text("Total Deductions:", 25, y);
  doc.text(formatCurrency(prop.totalDeductions), 160, y, { align: "right" });
  y += 5;
  const netLabel = prop.netResult >= 0 ? "Net Rental Income:" : "Net Rental Loss:";
  doc.text(netLabel, 25, y);
  doc.text(formatCurrency(prop.netResult), 160, y, { align: "right" });
  y += 10;

  return y;
}

export function generateMyTaxPDF(report: MyTaxReport): Blob {
  const doc = new jsPDF();
  let y = 20;

  // Cover page
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MyTax Reference Report", 20, y);
  y += 10;
  doc.setFontSize(14);
  doc.text(report.financialYear, 20, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${report.startDate} to ${report.endDate}`, 20, y);
  y += 5;
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString("en-AU")}`, 20, y);
  y += 5;
  doc.text(`Properties: ${report.properties.length}`, 20, y);
  y += 10;

  // Disclaimer
  doc.setFontSize(8);
  doc.text(
    "This is a reference document — not an official ATO submission. Consult your tax professional.",
    20,
    y
  );
  y += 15;

  // Portfolio summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Portfolio Summary", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Rental Income: ${formatCurrency(report.totalIncome)}`, 25, y);
  y += 6;
  doc.text(`Total Deductions: ${formatCurrency(report.totalDeductions)}`, 25, y);
  y += 6;
  doc.text(`Net Rental Result: ${formatCurrency(report.netRentalResult)}`, 25, y);
  y += 15;

  // Per-property pages
  for (const prop of report.properties) {
    if (y > 200) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Item 21 — Rent on Australian Properties", 20, y);
    y += 10;
    y = addPropertyPage(doc, prop, y);
  }

  // Personal summary page
  if (report.personalSummary) {
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Personal Tax Summary", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const ps = report.personalSummary;
    doc.text(`Gross Salary/Wages: ${formatCurrency(ps.grossSalary)}`, 25, y); y += 6;
    doc.text(`PAYG Withheld: ${formatCurrency(ps.paygWithheld)}`, 25, y); y += 6;
    doc.text(`Other Deductions: ${formatCurrency(ps.otherDeductions)}`, 25, y); y += 6;
    doc.text(`Net Rental Result: ${formatCurrency(report.netRentalResult)}`, 25, y); y += 6;
    doc.text(`HECS/HELP Debt: ${ps.hasHecsDebt ? "Yes" : "No"}`, 25, y); y += 6;
    doc.text(`Private Health Insurance: ${ps.hasPrivateHealth ? "Yes" : "No"}`, 25, y); y += 10;

    if (ps.taxPosition) {
      doc.setFont("helvetica", "bold");
      doc.text("Estimated Tax Position", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`Taxable Income: ${formatCurrency(ps.taxPosition.taxableIncome)}`, 25, y); y += 6;
      doc.text(`Base Tax: ${formatCurrency(ps.taxPosition.baseTax)}`, 25, y); y += 6;
      doc.text(`Medicare Levy: ${formatCurrency(ps.taxPosition.medicareLevy)}`, 25, y); y += 6;
      if (ps.taxPosition.medicareLevySurcharge > 0) {
        doc.text(`Medicare Levy Surcharge: ${formatCurrency(ps.taxPosition.medicareLevySurcharge)}`, 25, y); y += 6;
      }
      if (ps.taxPosition.hecsRepayment > 0) {
        doc.text(`HECS Repayment: ${formatCurrency(ps.taxPosition.hecsRepayment)}`, 25, y); y += 6;
      }
      doc.text(`Total Tax Liability: ${formatCurrency(ps.taxPosition.totalTaxLiability)}`, 25, y); y += 8;
      doc.setFont("helvetica", "bold");
      const resultLabel = ps.taxPosition.isRefund ? "Estimated Refund:" : "Estimated Owing:";
      doc.text(`${resultLabel} ${formatCurrency(Math.abs(ps.taxPosition.refundOrOwing))}`, 25, y);
    }
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Generated by BrickTrack — not an official ATO document.",
    20,
    285
  );

  return doc.output("blob");
}
