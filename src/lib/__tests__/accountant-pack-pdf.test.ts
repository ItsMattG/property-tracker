import { describe, it, expect, vi } from "vitest";

// Mock jsPDF with a class so it can be used with `new`
vi.mock("jspdf", () => {
  class MockJsPDF {
    setFontSize = vi.fn();
    setFont = vi.fn();
    setTextColor = vi.fn();
    text = vi.fn();
    line = vi.fn();
    setLineWidth = vi.fn();
    addPage = vi.fn();
    setPage = vi.fn();
    output = vi.fn().mockReturnValue(new ArrayBuffer(8));
    internal = {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      pages: [null, {}], // jsPDF pages array (index 0 is null, pages start at 1)
    };
  }
  return { default: MockJsPDF };
});

import {
  generateAccountantPackPDF,
  type AccountantPackConfig,
} from "../accountant-pack-pdf";

describe("generateAccountantPackPDF", () => {
  const baseConfig: AccountantPackConfig = {
    financialYear: 2025,
    userName: "Matt Gleeson",
    accountantName: "Jane Smith",
    sections: {
      incomeExpenses: true,
      depreciation: false,
      capitalGains: false,
      taxPosition: false,
      portfolioOverview: false,
      loanDetails: false,
    },
    data: {
      taxReport: {
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
      },
    },
  };

  it("returns an ArrayBuffer", () => {
    const result = generateAccountantPackPDF(baseConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles config with no sections enabled gracefully", () => {
    const emptyConfig: AccountantPackConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: false,
        depreciation: false,
        capitalGains: false,
        taxPosition: false,
        portfolioOverview: false,
        loanDetails: false,
      },
    };
    const result = generateAccountantPackPDF(emptyConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles config with all sections enabled", () => {
    const allConfig: AccountantPackConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: true,
        depreciation: true,
        capitalGains: true,
        taxPosition: true,
        portfolioOverview: true,
        loanDetails: true,
      },
      data: {
        ...baseConfig.data,
        myTaxReport: {
          financialYear: "FY2024-25",
          properties: [
            {
              address: "123 Test St",
              suburb: "Sydney",
              state: "NSW",
              entityName: "Personal",
              income: [{ label: "Gross Rent", amount: 26000 }],
              deductions: [
                { label: "Interest", amount: 12000, atoCode: "D5" },
              ],
              depreciation: { capitalWorks: 5000, plantEquipment: 2000 },
              totalIncome: 26000,
              totalDeductions: 19000,
              netResult: 7000,
            },
          ],
        },
        cgtData: [
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
        ],
        taxPosition: {
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
        },
        portfolioSnapshot: {
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
        },
        loanPackSnapshot: {
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
        },
      },
    };
    const result = generateAccountantPackPDF(allConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles missing optional accountant name", () => {
    const noAccountantConfig: AccountantPackConfig = {
      ...baseConfig,
      accountantName: undefined,
    };
    const result = generateAccountantPackPDF(noAccountantConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles section enabled but data missing gracefully", () => {
    const mismatchConfig: AccountantPackConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: true,
        depreciation: true,
        capitalGains: true,
        taxPosition: true,
        portfolioOverview: true,
        loanDetails: true,
      },
      data: {
        // Only taxReport provided, all other data undefined
        taxReport: baseConfig.data.taxReport,
      },
    };
    // Should not throw — sections without data are simply skipped
    const result = generateAccountantPackPDF(mismatchConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles empty CGT data array", () => {
    const emptyCgtConfig: AccountantPackConfig = {
      ...baseConfig,
      sections: {
        ...baseConfig.sections,
        capitalGains: true,
      },
      data: {
        ...baseConfig.data,
        cgtData: [],
      },
    };
    const result = generateAccountantPackPDF(emptyCgtConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("generates income/expenses with ATO-sorted deductions and two-column layout", () => {
    const multiDeductionConfig: AccountantPackConfig = {
      ...baseConfig,
      data: {
        taxReport: {
          ...baseConfig.data.taxReport!,
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
                totalIncome: 30000,
                totalExpenses: 20000,
                netIncome: 10000,
                totalDeductible: 20000,
              },
              atoBreakdown: [
                {
                  category: "rental_income",
                  label: "Gross Rent",
                  amount: 30000,
                  atoReference: "Item 21",
                  isDeductible: false,
                },
                {
                  category: "capital_works",
                  label: "Capital Works",
                  amount: 5000,
                  atoReference: "D14",
                  isDeductible: true,
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
                {
                  category: "other",
                  label: "Sundry",
                  amount: 1000,
                  atoReference: null,
                  isDeductible: true,
                },
              ],
              transactionCount: 40,
            },
          ],
        },
      },
    };
    // Should not throw — deductions are sorted D1, D5, D14, then null ref last
    const result = generateAccountantPackPDF(multiDeductionConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("generates per-property summary table when 2+ properties exist", () => {
    const multiPropertyConfig: AccountantPackConfig = {
      ...baseConfig,
      data: {
        taxReport: {
          ...baseConfig.data.taxReport!,
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
              ],
              transactionCount: 24,
            },
            {
              property: {
                id: "2",
                address: "456 Beach Rd",
                suburb: "Melbourne",
                state: "VIC",
                entityName: "Personal",
              },
              metrics: {
                totalIncome: 32000,
                totalExpenses: 22000,
                netIncome: 10000,
                totalDeductible: 22000,
              },
              atoBreakdown: [
                {
                  category: "rental_income",
                  label: "Gross Rent",
                  amount: 32000,
                  atoReference: "Item 21",
                  isDeductible: false,
                },
                {
                  category: "interest_on_loans",
                  label: "Interest on Loans",
                  amount: 15000,
                  atoReference: "D5",
                  isDeductible: true,
                },
              ],
              transactionCount: 30,
            },
          ],
          totals: {
            totalIncome: 58000,
            totalExpenses: 40000,
            netIncome: 18000,
            totalDeductible: 40000,
          },
        },
      },
    };
    // Should not throw — includes the Net Rental Income Summary table
    const result = generateAccountantPackPDF(multiPropertyConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });
});
