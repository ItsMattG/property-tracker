import jsPDF from "jspdf";
import type { PortfolioSnapshot } from "@/server/services/portfolio/share";
import { formatCurrency, formatPercent } from "@/lib/utils";

function addWatermark(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Set watermark style - light gray
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(45);

  // Calculate center position
  const text = "Powered by BrickTrack";
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;

  // Draw watermark diagonally across the page
  doc.text(text, centerX, centerY, {
    angle: 45,
    align: "center",
  });

  // Reset text color for subsequent content
  doc.setTextColor(0, 0, 0);
}

export function generateSharePDF(
  data: PortfolioSnapshot,
  privacyMode: string,
  title: string
): Blob {
  const doc = new jsPDF();
  let y = 20;

  // Add watermark to first page
  addWatermark(doc);

  // Title
  doc.setFontSize(20);
  doc.text(title, 20, y);
  y += 10;

  // Generated date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-AU")}`, 20, y);
  doc.setTextColor(0, 0, 0);
  y += 15;

  // Portfolio Summary Section
  doc.setFontSize(14);
  doc.text("Portfolio Summary", 20, y);
  y += 10;

  doc.setFontSize(10);
  const summary = data.summary;

  doc.text(`Properties: ${summary.propertyCount}`, 20, y);
  y += 6;

  doc.text(`States: ${summary.states.join(", ")}`, 20, y);
  y += 6;

  if (summary.totalValue !== undefined) {
    doc.text(`Total Value: ${formatCurrency(summary.totalValue)}`, 20, y);
    y += 6;
  }

  if (summary.totalDebt !== undefined) {
    doc.text(`Total Debt: ${formatCurrency(summary.totalDebt)}`, 20, y);
    y += 6;
  }

  if (summary.totalEquity !== undefined) {
    doc.text(`Total Equity: ${formatCurrency(summary.totalEquity)}`, 20, y);
    y += 6;
  }

  if (summary.portfolioLVR !== undefined) {
    doc.text(`Portfolio LVR: ${formatPercent(summary.portfolioLVR)}`, 20, y);
    y += 6;
  }

  if (summary.cashFlow !== undefined) {
    doc.text(`Annual Cash Flow: ${formatCurrency(summary.cashFlow)}`, 20, y);
    y += 6;
  } else if (summary.cashFlowPositive !== undefined) {
    doc.text(
      `Cash Flow: ${summary.cashFlowPositive ? "Positive" : "Negative"}`,
      20,
      y
    );
    y += 6;
  }

  if (summary.averageYield !== undefined) {
    doc.text(`Average Yield: ${formatPercent(summary.averageYield)}`, 20, y);
    y += 6;
  }

  y += 10;

  // Property Breakdown (if not summary mode)
  if (privacyMode !== "summary" && data.properties && data.properties.length > 0) {
    doc.setFontSize(14);
    doc.text("Property Breakdown", 20, y);
    y += 10;

    doc.setFontSize(10);

    for (const property of data.properties) {
      // Check if we need a new page
      if (y > 250) {
        doc.addPage();
        addWatermark(doc);
        y = 20;
      }

      // Property location
      doc.setFontSize(11);
      if (property.address) {
        doc.text(`${property.address}`, 20, y);
        y += 5;
        doc.setFontSize(9);
        doc.text(`${property.suburb}, ${property.state}`, 20, y);
      } else {
        doc.text(`${property.suburb}, ${property.state}`, 20, y);
      }
      y += 6;

      doc.setFontSize(9);

      // Property metrics based on privacy mode
      if (privacyMode === "redacted") {
        // Redacted mode: only show percentages and ratios
        if (property.lvr !== undefined) {
          doc.text(`  LVR: ${formatPercent(property.lvr)}`, 20, y);
          y += 5;
        }
        if (property.grossYield !== undefined) {
          doc.text(`  Gross Yield: ${formatPercent(property.grossYield)}`, 20, y);
          y += 5;
        }
        doc.text(`  Portfolio Share: ${formatPercent(property.portfolioPercent)}`, 20, y);
        y += 5;
      } else {
        // Full mode: show all values
        if (property.currentValue !== undefined) {
          doc.text(`  Value: ${formatCurrency(property.currentValue)}`, 20, y);
          y += 5;
        }
        if (property.totalLoans !== undefined) {
          doc.text(`  Loans: ${formatCurrency(property.totalLoans)}`, 20, y);
          y += 5;
        }
        if (property.equity !== undefined) {
          doc.text(`  Equity: ${formatCurrency(property.equity)}`, 20, y);
          y += 5;
        }
        if (property.lvr !== undefined) {
          doc.text(`  LVR: ${formatPercent(property.lvr)}`, 20, y);
          y += 5;
        }
        if (property.cashFlow !== undefined) {
          doc.text(`  Cash Flow: ${formatCurrency(property.cashFlow)}/yr`, 20, y);
          y += 5;
        }
        if (property.grossYield !== undefined) {
          doc.text(`  Gross Yield: ${formatPercent(property.grossYield)}`, 20, y);
          y += 5;
        }
        doc.text(`  Portfolio Share: ${formatPercent(property.portfolioPercent)}`, 20, y);
        y += 5;
      }

      y += 5;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Generated by BrickTrack - propertytracker.com.au",
    20,
    285
  );

  return doc.output("blob");
}
