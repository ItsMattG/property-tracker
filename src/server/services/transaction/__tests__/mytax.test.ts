import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    query: {
      properties: { findMany: vi.fn().mockResolvedValue([]) },
      taxProfiles: { findFirst: vi.fn().mockResolvedValue(null) },
      depreciationSchedules: { findMany: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock("../reports", () => ({
  getFinancialYearRange: vi.fn().mockReturnValue({
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    label: "FY 2025-26",
  }),
  getFinancialYearTransactions: vi.fn().mockResolvedValue([]),
  calculateCategoryTotals: vi.fn().mockReturnValue(new Map()),
}));

import { buildMyTaxReport, type MyTaxReport } from "../mytax";

describe("mytax service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildMyTaxReport", () => {
    it("returns empty report when no data", async () => {
      const report = await buildMyTaxReport("user-1", 2026);
      expect(report.financialYear).toBe("FY 2025-26");
      expect(report.properties).toEqual([]);
      expect(report.personalSummary).toBeNull();
      expect(report.totalIncome).toBe(0);
      expect(report.totalDeductions).toBe(0);
      expect(report.netRentalResult).toBe(0);
    });

    it("aggregates income and deductions per property", async () => {
      const { getFinancialYearTransactions, calculateCategoryTotals } =
        await import("../reports");
      const { db } = await import("@/server/db");

      const mockProps = [
        { id: "p1", address: "1 Main St", suburb: "Sydney", state: "NSW", entityName: "Personal" },
      ];
      vi.mocked(db.query.properties.findMany).mockResolvedValue(mockProps as any);

      const mockTxns = [
        { id: "t1", propertyId: "p1", category: "rental_income", amount: "2400", transactionType: "income" },
        { id: "t2", propertyId: "p1", category: "insurance", amount: "-500", transactionType: "expense" },
      ];
      vi.mocked(getFinancialYearTransactions).mockResolvedValue(mockTxns as any);

      const catTotals = new Map([
        ["rental_income", 2400],
        ["insurance", -500],
      ]);
      vi.mocked(calculateCategoryTotals).mockReturnValue(catTotals);

      const report = await buildMyTaxReport("user-1", 2026);
      expect(report.properties).toHaveLength(1);
      expect(report.properties[0].address).toBe("1 Main St");
      expect(report.properties[0].income).toHaveLength(1);
      expect(report.properties[0].income[0].amount).toBe(2400);
      expect(report.properties[0].deductions).toHaveLength(1);
      expect(report.properties[0].deductions[0].atoCode).toBe("D7");
    });

    it("includes tax profile when available", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.query.taxProfiles.findFirst).mockResolvedValue({
        grossSalary: "85000",
        paygWithheld: "20000",
        otherDeductions: "1500",
        hasHecsDebt: true,
        hasPrivateHealth: false,
        familyStatus: "single",
        dependentChildren: 0,
        partnerIncome: null,
      } as any);

      const report = await buildMyTaxReport("user-1", 2026);
      expect(report.personalSummary).not.toBeNull();
      expect(report.personalSummary!.grossSalary).toBe(85000);
      expect(report.personalSummary!.paygWithheld).toBe(20000);
    });

    it("includes depreciation when schedules exist", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.query.properties.findMany).mockResolvedValue([
        { id: "p1", address: "1 Main St", suburb: "Sydney", state: "NSW", entityName: "Personal" },
      ] as any);

      vi.mocked(db.query.depreciationSchedules.findMany).mockResolvedValue([
        {
          id: "ds1",
          propertyId: "p1",
          assets: [
            { category: "capital_works", yearlyDeduction: "5000" },
            { category: "plant_equipment", yearlyDeduction: "2000" },
          ],
        },
      ] as any);

      const report = await buildMyTaxReport("user-1", 2026);
      const prop = report.properties.find((p) => p.propertyId === "p1");
      expect(prop).toBeDefined();
      expect(prop!.depreciation.capitalWorks).toBe(5000);
      expect(prop!.depreciation.plantEquipment).toBe(2000);
    });
  });
});
