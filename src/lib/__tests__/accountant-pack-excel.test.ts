import { describe, it, expect } from "vitest";

import ExcelJS from "exceljs";

import { generateAccountantPackExcel } from "../accountant-pack-excel";
import type { AccountantPackConfig } from "../accountant-pack-pdf";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleTaxReport: NonNullable<AccountantPackConfig["data"]["taxReport"]> =
  {
    financialYear: "FY2024-25",
    startDate: "2024-07-01",
    endDate: "2025-06-30",
    properties: [
      {
        property: {
          id: "1",
          address: "123 Test St",
          suburb: "Sydney",
          state: "NSW",
          entityName: "Personal",
        },
        metrics: {
          totalIncome: 26000,
          totalExpenses: 18000,
          netIncome: 8000,
          totalDeductible: 18000,
        },
        atoBreakdown: [
          {
            category: "rental_income",
            label: "Gross Rent",
            amount: 26000,
            atoReference: "Item 21",
            isDeductible: false,
          },
          {
            category: "interest_on_loans",
            label: "Interest on Loans",
            amount: 12000,
            atoReference: "D5",
            isDeductible: true,
          },
          {
            category: "insurance",
            label: "Insurance",
            amount: 2000,
            atoReference: "D1",
            isDeductible: true,
          },
        ],
        transactionCount: 24,
      },
    ],
    totals: {
      totalIncome: 26000,
      totalExpenses: 18000,
      netIncome: 8000,
      totalDeductible: 18000,
    },
    generatedAt: "2025-09-01T00:00:00Z",
  };

const sampleMyTaxReport: NonNullable<
  AccountantPackConfig["data"]["myTaxReport"]
> = {
  financialYear: "FY2024-25",
  properties: [
    {
      address: "123 Test St",
      suburb: "Sydney",
      state: "NSW",
      entityName: "Personal",
      income: [{ label: "Gross Rent", amount: 26000 }],
      deductions: [{ label: "Interest", amount: 12000, atoCode: "D5" }],
      depreciation: { capitalWorks: 5000, plantEquipment: 2000 },
      totalIncome: 26000,
      totalDeductions: 19000,
      netResult: 7000,
    },
  ],
};

const sampleCgtData: NonNullable<AccountantPackConfig["data"]["cgtData"]> = [
  {
    propertyAddress: "456 Sold Ave, Melbourne VIC",
    purchaseDate: "2018-03-15",
    saleDate: "2024-11-01",
    costBase: 500000,
    salePrice: 650000,
    capitalGain: 150000,
    discountedGain: 75000,
    heldOverTwelveMonths: true,
  },
];

const sampleTaxPosition: NonNullable<
  AccountantPackConfig["data"]["taxPosition"]
> = {
  taxableIncome: 95000,
  baseTax: 22967,
  medicareLevy: 1900,
  medicareLevySurcharge: 0,
  hecsRepayment: 0,
  totalTaxLiability: 24867,
  paygWithheld: 28000,
  refundOrOwing: 3133,
  isRefund: true,
  marginalRate: 0.37,
  propertySavings: 6660,
};

const samplePortfolioSnapshot: NonNullable<
  AccountantPackConfig["data"]["portfolioSnapshot"]
> = {
  properties: [
    {
      address: "123 Test St",
      suburb: "Sydney",
      state: "NSW",
      purchasePrice: 750000,
      currentValue: 850000,
      equity: 350000,
      lvr: 0.588,
    },
  ],
  totals: {
    totalValue: 850000,
    totalDebt: 500000,
    totalEquity: 350000,
    avgLvr: 0.588,
    propertyCount: 1,
  },
};

const sampleLoanPackSnapshot: NonNullable<
  AccountantPackConfig["data"]["loanPackSnapshot"]
> = {
  properties: [
    {
      address: "123 Test St",
      loans: [
        {
          lender: "CBA",
          balance: 500000,
          rate: 6.19,
          type: "P&I",
          monthlyRepayment: 3050,
        },
      ],
    },
  ],
  totals: {
    totalDebt: 500000,
    avgRate: 6.19,
    monthlyRepayments: 3050,
  },
};

function allSectionsEnabled(): AccountantPackConfig["sections"] {
  return {
    incomeExpenses: true,
    depreciation: true,
    capitalGains: true,
    taxPosition: true,
    portfolioOverview: true,
    loanDetails: true,
  };
}

function allSectionsDisabled(): AccountantPackConfig["sections"] {
  return {
    incomeExpenses: false,
    depreciation: false,
    capitalGains: false,
    taxPosition: false,
    portfolioOverview: false,
    loanDetails: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateAccountantPackExcel", () => {
  it("generates valid Excel buffer with income/expenses sheet", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: {
        ...allSectionsDisabled(),
        incomeExpenses: true,
      },
      data: {
        taxReport: sampleTaxReport,
      },
    };

    const result = await generateAccountantPackExcel(config);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify we can read it back and it has the correct sheet
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("Income & Expenses");

    // Verify header row exists
    const headerRow = wb.worksheets[0].getRow(1);
    expect(headerRow.getCell(1).value).toBe("Property");
    expect(headerRow.getCell(5).value).toBe("Amount");

    // Verify data rows exist (1 income + 2 deductions + 1 subtotal + 1 blank + 1 grand total = 6)
    expect(wb.worksheets[0].actualRowCount).toBeGreaterThanOrEqual(4);
  });

  it("generates sheets for all enabled sections", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      accountantName: "Jane Smith",
      sections: allSectionsEnabled(),
      data: {
        taxReport: sampleTaxReport,
        myTaxReport: sampleMyTaxReport,
        cgtData: sampleCgtData,
        taxPosition: sampleTaxPosition,
        portfolioSnapshot: samplePortfolioSnapshot,
        loanPackSnapshot: sampleLoanPackSnapshot,
      },
    };

    const result = await generateAccountantPackExcel(config);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);

    expect(wb.worksheets).toHaveLength(6);
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual([
      "Income & Expenses",
      "Depreciation",
      "Capital Gains",
      "Tax Position",
      "Portfolio Overview",
      "Loan Details",
    ]);
  });

  it("skips sheets for disabled sections", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: {
        ...allSectionsDisabled(),
        taxPosition: true,
      },
      data: {
        taxPosition: sampleTaxPosition,
      },
    };

    const result = await generateAccountantPackExcel(config);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);

    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("Tax Position");
  });

  it("handles section enabled but data missing gracefully", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: allSectionsEnabled(),
      data: {
        // Only taxReport provided — other sections have no data
        taxReport: sampleTaxReport,
      },
    };

    const result = await generateAccountantPackExcel(config);

    expect(result).toBeInstanceOf(ArrayBuffer);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);

    // Only the sheet with data should be created
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("Income & Expenses");
  });

  it("shows 'no properties sold' row for empty CGT data", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: {
        ...allSectionsDisabled(),
        capitalGains: true,
      },
      data: {
        cgtData: [],
      },
    };

    const result = await generateAccountantPackExcel(config);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);

    const sheet = wb.worksheets[0];
    expect(sheet.name).toBe("Capital Gains");
    // Row 2 (first data row) should have the "no properties sold" message
    const firstDataRow = sheet.getRow(2);
    expect(firstDataRow.getCell(1).value).toContain("No properties sold");
  });

  it("formats loan rate as percentage (divided by 100)", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: {
        ...allSectionsDisabled(),
        loanDetails: true,
      },
      data: {
        loanPackSnapshot: sampleLoanPackSnapshot,
      },
    };

    const result = await generateAccountantPackExcel(config);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);

    const sheet = wb.worksheets[0];
    // Row 2 is first data row; rate column is 5th (E)
    const rateCell = sheet.getRow(2).getCell("E");
    // 6.19 stored as 6.19, divided by 100 = 0.0619
    expect(rateCell.value).toBeCloseTo(0.0619, 4);
    expect(rateCell.numFmt).toBe("0.0%");
  });

  it("applies bold styling to totals rows", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: {
        ...allSectionsDisabled(),
        portfolioOverview: true,
      },
      data: {
        portfolioSnapshot: samplePortfolioSnapshot,
      },
    };

    const result = await generateAccountantPackExcel(config);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);

    const sheet = wb.worksheets[0];
    // Last row should be the TOTAL row and should be bold
    const lastRow = sheet.lastRow;
    expect(lastRow).toBeDefined();
    expect(lastRow!.getCell(1).value).toBe("TOTAL");
    expect(lastRow!.font?.bold).toBe(true);
  });

  it("produces valid workbook even with no sections enabled", async () => {
    const config: AccountantPackConfig = {
      financialYear: 2025,
      userName: "Matt Gleeson",
      sections: allSectionsDisabled(),
      data: {},
    };

    const result = await generateAccountantPackExcel(config);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result);
    expect(wb.worksheets).toHaveLength(0);
  });
});
