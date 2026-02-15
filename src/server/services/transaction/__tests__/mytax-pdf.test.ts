import { describe, it, expect, vi } from "vitest";

// Mock jsPDF
vi.mock("jspdf", () => {
  class MockJsPDF {
    setFontSize = vi.fn();
    setFont = vi.fn();
    text = vi.fn();
    addPage = vi.fn();
    line = vi.fn();
    output = vi.fn().mockReturnValue(new Blob(["pdf-content"]));
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  }
  return { default: MockJsPDF };
});

import { generateMyTaxPDF } from "@/lib/mytax-pdf";
import type { MyTaxReport } from "../mytax";

describe("generateMyTaxPDF", () => {
  const emptyReport: MyTaxReport = {
    financialYear: "FY 2025-26",
    fyNumber: 2026,
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    properties: [],
    personalSummary: null,
    totalIncome: 0,
    totalDeductions: 0,
    netRentalResult: 0,
    generatedAt: "2026-01-28T00:00:00.000Z",
  };

  it("returns a Blob", () => {
    const result = generateMyTaxPDF(emptyReport);
    expect(result).toBeInstanceOf(Blob);
  });

  it("generates PDF for report with properties", () => {
    const report: MyTaxReport = {
      ...emptyReport,
      properties: [
        {
          propertyId: "p1",
          address: "1 Main St",
          suburb: "Sydney",
          state: "NSW",
          entityName: "Personal",
          income: [
            { label: "Rental Income", atoCode: "", category: "rental_income", amount: 24000, transactionCount: 12 },
          ],
          deductions: [
            { label: "Insurance", atoCode: "D7", category: "insurance", amount: 1200, transactionCount: 1 },
          ],
          depreciation: { capitalWorks: 5000, plantEquipment: 2000 },
          totalIncome: 24000,
          totalDeductions: 8200,
          netResult: 15800,
        },
      ],
      totalIncome: 24000,
      totalDeductions: 8200,
      netRentalResult: 15800,
    };

    const result = generateMyTaxPDF(report);
    expect(result).toBeInstanceOf(Blob);
  });

  it("generates PDF with personal summary", () => {
    const report: MyTaxReport = {
      ...emptyReport,
      personalSummary: {
        grossSalary: 85000,
        paygWithheld: 20000,
        otherDeductions: 1500,
        hasHecsDebt: true,
        hasPrivateHealth: false,
        taxPosition: {
          taxableIncome: 83500,
          baseTax: 18000,
          medicareLevy: 1670,
          medicareLevySurcharge: 0,
          hecsRepayment: 4175,
          totalTaxLiability: 23845,
          refundOrOwing: -3845,
          isRefund: false,
        },
      },
    };

    const result = generateMyTaxPDF(report);
    expect(result).toBeInstanceOf(Blob);
  });
});
